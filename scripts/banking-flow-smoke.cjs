require('sucrase/register');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseQuestorTrialBalance,
} = require('../src/lib/banking/questor-balancete-parser.ts');
const { parseQuestorLedger } = require('../src/lib/banking/questor-razao-parser.ts');
const {
  parseViacrediStatementTextTokens,
} = require('../src/lib/banking/viacredi-statement-parser.ts');
const {
  parseViacrediInvestmentStatementTextTokens,
} = require('../src/lib/banking/viacredi-investment-statement-parser.ts');
const {
  matchBankAccountsToStatements,
} = require('../src/lib/banking/account-statement-matcher.ts');
const {
  reconcileMatchedBankAccounts,
  reconcileAccountStatementByBalance,
} = require('../src/lib/banking/balance-reconciliation-engine.ts');
const {
  buildBankingReviewItems,
} = require('../src/lib/banking/banking-review-items.ts');
const {
  buildApprovedQuestorImportFile,
} = require('../src/lib/banking/questor-import-export.ts');

const downloads = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads');

function findDownloadFile(predicate) {
  const fileName = fs.readdirSync(downloads).find(predicate);
  return fileName ? path.join(downloads, fileName) : '';
}

const files = {
  trialBalance: findDownloadFile((name) => name === 'Balancete exportado do questor.xlsx'),
  ledger: findDownloadFile((name) => name.toLowerCase().includes('questor') && name.endsWith('.xls')),
  statementOct: findDownloadFile(
    (name) => name.includes('Conta Corrente 10-2025') && name.endsWith('.pdf'),
  ),
  statementNov: findDownloadFile(
    (name) => name.includes('Conta Corrente 11-2025') && name.endsWith('.pdf'),
  ),
  investmentOct: findDownloadFile((name) => name.startsWith('2.') && name.endsWith('.pdf')),
};

function readArrayBuffer(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function extractPdfTokens(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjs.getDocument({ data }).promise;
  const tokens = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const item of content.items) {
      const text = item.str && item.str.trim();
      if (text) tokens.push(text);
    }
  }

  return tokens;
}

function cents(value) {
  return Math.round(value * 100);
}

(async () => {
  for (const filePath of Object.values(files)) {
    assert.ok(fs.existsSync(filePath), `Arquivo de teste nao encontrado: ${filePath}`);
  }

  const trialBalance = parseQuestorTrialBalance(readArrayBuffer(files.trialBalance));
  const ledger = parseQuestorLedger(readArrayBuffer(files.ledger));
  const statementOct = parseViacrediStatementTextTokens(await extractPdfTokens(files.statementOct));
  const statementNov = parseViacrediStatementTextTokens(await extractPdfTokens(files.statementNov));
  const investmentOct = parseViacrediInvestmentStatementTextTokens(
    await extractPdfTokens(files.investmentOct),
  );

  assert.equal(trialBalance.analyticalAccounts.length, 51);
  assert.ok(trialBalance.bankLikeAccounts.some((account) => account.accountCode === '9'));
  assert.ok(trialBalance.bankLikeAccounts.some((account) => account.accountCode === '4961'));
  assert.ok(
    trialBalance.bankLikeAccounts.some(
      (account) => account.accountCode === '5038' && account.kind === 'cash_investment',
    ),
  );

  assert.equal(cents(ledger.accountsByCode['4961'].dailyBalances['2025-10-31']), 20180);
  assert.equal(cents(ledger.accountsByCode['4961'].dailyBalances['2025-11-26']), 56643);
  assert.equal(cents(ledger.accountsByCode['9'].dailyBalances['2025-11-19']), -20000);

  assert.equal(cents(statementOct.finalBalance), 20180);
  assert.equal(cents(statementNov.finalBalance), 38295);
  assert.equal(cents(statementNov.dailyBalances['2025-11-17']), 312957);
  assert.equal(cents(statementNov.dailyBalances['2025-11-19']), 327557);
  assert.equal(cents(statementNov.dailyBalances['2025-11-26']), 38295);

  assert.equal(investmentOct.productName, 'APLICACAO_PROGRAMADA');
  assert.equal(investmentOct.periodStart, '2025-10-01');
  assert.equal(investmentOct.periodEnd, '2025-10-31');
  assert.equal(cents(investmentOct.openingBalance), 25642);
  assert.equal(cents(investmentOct.finalBalance), 30948);
  assert.equal(investmentOct.monthlyApplications.length, 1);
  assert.equal(cents(investmentOct.monthlyApplications[0].credit), 5000);
  assert.equal(investmentOct.monthlyIncomeProvisions.length, 1);
  assert.equal(cents(investmentOct.monthlyIncomeProvisions[0].credit), 306);
  assert.equal(investmentOct.incomeTaxDebits.length, 0);

  const results = reconcileMatchedBankAccounts(
    matchBankAccountsToStatements(
      trialBalance.bankLikeAccounts,
      ledger,
      [statementOct, statementNov],
      [investmentOct],
    ),
  );

  const bradesco = results.find((result) => result.accountCode === '9');
  const outubro = results.find(
    (result) => result.accountCode === '4961' && result.periodStart === '2025-10-01',
  );
  const novembro = results.find(
    (result) => result.accountCode === '4961' && result.periodStart === '2025-11-01',
  );
  const aplicacao = results.find((result) => result.accountCode === '5038');

  assert.equal(bradesco && bradesco.status, 'missing_statement');
  assert.equal(bradesco && bradesco.accountKind, 'bank_account');
  assert.equal(outubro && outubro.status, 'reconciled');
  assert.equal(cents(outubro.difference || 0), 0);
  assert.equal(novembro && novembro.status, 'divergent');
  assert.equal(cents(novembro.difference || 0), 18348);
  assert.equal(novembro.lastMatchedCheckpoint.date, '2025-11-17');
  assert.equal(novembro.firstDivergentCheckpoint.date, '2025-11-19');
  assert.ok(
    novembro.statementEntriesOnDivergenceDate.some((entry) => cents(entry.amount) === -18348),
  );
  assert.equal(aplicacao && aplicacao.status, 'divergent');
  assert.equal(aplicacao && aplicacao.accountKind, 'cash_investment');
  assert.equal(aplicacao.finalCheckpoint.date, '2025-10-31');
  assert.equal(aplicacao.finalCheckpoint.ledgerBalanceDate, '2025-10-15');
  assert.equal(cents(aplicacao.finalCheckpoint.statementBalance), 30948);
  assert.equal(cents(aplicacao.finalCheckpoint.ledgerBalance), 30642);
  assert.equal(cents(aplicacao.difference), -306);
  assert.equal(aplicacao.investmentEntriesOnDivergenceDate.length, 1);
  assert.equal(aplicacao.investmentEntriesOnDivergenceDate[0].date, '2025-10-31');
  assert.equal(cents(aplicacao.investmentEntriesOnDivergenceDate[0].credit), 306);
  assert.equal(aplicacao.suggestedEntries.length, 1);
  assert.equal(aplicacao.suggestedEntries[0].kind, 'investment_income');
  assert.equal(aplicacao.suggestedEntries[0].debitAccountCode, '5038');
  assert.equal(aplicacao.suggestedEntries[0].creditAccountName, 'Receita de Aplicacao Financeira');
  assert.equal(cents(aplicacao.suggestedEntries[0].amount), 306);

  const irResult = reconcileAccountStatementByBalance({
    account: {
      accountCode: '5038',
      isSynthetic: false,
      classification: '1.1.01.003.001',
      name: 'Aplicacao Programada Viacredi',
      previousBalance: 0,
      debit: 0,
      credit: 0,
      endingBalance: 0,
      kind: 'cash_investment',
      rowNumber: 1,
      rawData: {},
    },
    ledgerAccount: {
      accountCode: '5038',
      accountName: 'Aplicacao Programada Viacredi',
      entries: [],
      dailyBalances: { '2025-10-31': 30948 },
    },
    investmentStatement: {
      ...investmentOct,
      finalBalance: 30947,
      dailyBalances: { ...investmentOct.dailyBalances, '2025-10-31': 30947 },
      entries: [
        ...investmentOct.entries,
        {
          date: '2025-10-31',
          description: 'IR APLICACAO',
          kind: 'income_tax',
          credit: 0,
          debit: 1,
          amount: -1,
          balance: 30947,
          sequence: 99,
          rawTokens: [],
        },
      ],
      incomeTaxDebits: [
        {
          date: '2025-10-31',
          description: 'IR APLICACAO',
          kind: 'income_tax',
          credit: 0,
          debit: 1,
          amount: -1,
          balance: 30947,
          sequence: 99,
          rawTokens: [],
        },
      ],
    },
    status: 'review',
    confidence: 'high',
    reason: 'Teste IR',
  });
  const irSuggestion = irResult.suggestedEntries.find(
    (entry) => entry.kind === 'investment_income_tax',
  );
  assert.ok(irSuggestion);
  assert.equal(irSuggestion.debitAccountName, 'IR sobre aplicacao financeira');
  assert.equal(irSuggestion.creditAccountCode, '5038');
  assert.equal(cents(irSuggestion.amount), 100);

  const reviewItems = buildBankingReviewItems(results);
  assert.equal(reviewItems.length, 4);
  assert.ok(reviewItems.some((item) => item.kind === 'missing_statement' && item.accountCode === '9'));
  assert.ok(
    reviewItems.some(
      (item) =>
        item.kind === 'divergence_check' &&
        item.accountCode === '5038' &&
        item.dueDate === '2025-10-31',
    ),
  );
  const suggestedReviewItem = reviewItems.find(
    (item) =>
      item.kind === 'suggested_entry' &&
      item.accountCode === '5038' &&
      item.dueDate === '2025-10-31' &&
      item.suggestedEntryId === aplicacao.suggestedEntries[0].id,
  );
  assert.ok(suggestedReviewItem);
  assert.equal(suggestedReviewItem.title, 'Aprovar lancamento de rendimento');
  assert.ok(
    reviewItems.some(
      (item) =>
        item.kind === 'divergence_check' &&
        item.accountCode === '4961' &&
        item.dueDate === '2025-11-19',
    ),
  );
  assert.ok(reviewItems.every((item) => item.status === 'open'));

  const approvedReviewItems = buildBankingReviewItems(results, [
    {
      ...suggestedReviewItem,
      status: 'approved',
      note: 'Lancamento conferido pela equipe.',
    },
  ]);
  const approvedItem = approvedReviewItems.find((item) => item.id === suggestedReviewItem.id);
  assert.equal(approvedItem.status, 'approved');
  assert.equal(approvedItem.note, 'Lancamento conferido pela equipe.');

  const blockedImportFile = buildApprovedQuestorImportFile({
    id: 'smoke-questor-import',
    competence: '2025-10',
    createdAt: new Date().toISOString(),
    fileNames: {
      trialBalance: path.basename(files.trialBalance),
      ledger: path.basename(files.ledger),
      statements: [path.basename(files.statementOct), path.basename(files.investmentOct)],
    },
    bankAccountsCount: trialBalance.bankLikeAccounts.length,
    ledgerAccountsCount: ledger.accounts.length,
    statementsCount: 1,
    investmentStatementsCount: 1,
    investmentStatements: [investmentOct],
    results,
    reviewItems: approvedReviewItems,
  });
  assert.equal(blockedImportFile.approvedCount, 1);
  assert.equal(blockedImportFile.rows.length, 0);
  assert.equal(blockedImportFile.blockedEntries.length, 1);

  const questorImportFile = buildApprovedQuestorImportFile(
    {
      id: 'smoke-questor-import',
      competence: '2025-10',
      createdAt: new Date().toISOString(),
      fileNames: {
        trialBalance: path.basename(files.trialBalance),
        ledger: path.basename(files.ledger),
        statements: [path.basename(files.statementOct), path.basename(files.investmentOct)],
      },
      bankAccountsCount: trialBalance.bankLikeAccounts.length,
      ledgerAccountsCount: ledger.accounts.length,
      statementsCount: 1,
      investmentStatementsCount: 1,
      investmentStatements: [investmentOct],
      results,
      reviewItems: approvedReviewItems,
    },
    {
      investmentIncomeCreditAccountCode: '9001',
      historyCode: '1',
    },
  );
  assert.equal(questorImportFile.rows.length, 1);
  assert.equal(questorImportFile.blockedEntries.length, 0);
  assert.equal(
    questorImportFile.content,
    '31/10/2025;5038;9001;3,06;1;Rendimento Aplicacao Financeira 10/2025\r\n',
  );

  console.log('Fluxo bancario validado com sucesso.');
})();
