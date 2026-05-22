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
} = require('../src/lib/banking/balance-reconciliation-engine.ts');
const {
  buildBankingReviewItems,
} = require('../src/lib/banking/banking-review-items.ts');

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
    matchBankAccountsToStatements(trialBalance.bankLikeAccounts, ledger, [
      statementOct,
      statementNov,
    ]),
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
  assert.equal(aplicacao && aplicacao.status, 'missing_statement');
  assert.equal(aplicacao && aplicacao.accountKind, 'cash_investment');

  const reviewItems = buildBankingReviewItems(results);
  assert.equal(reviewItems.length, 3);
  assert.ok(reviewItems.some((item) => item.kind === 'missing_statement' && item.accountCode === '9'));
  assert.ok(
    reviewItems.some((item) => item.kind === 'missing_statement' && item.accountCode === '5038'),
  );
  assert.ok(
    reviewItems.some(
      (item) =>
        item.kind === 'divergence_check' &&
        item.accountCode === '4961' &&
        item.dueDate === '2025-11-19',
    ),
  );
  assert.ok(reviewItems.every((item) => item.status === 'open'));

  console.log('Fluxo bancario validado com sucesso.');
})();
