import type {
  AccountStatementMatch,
  BankAccountKind,
  QuestorLedgerAccount,
  QuestorLedgerParseResult,
  QuestorTrialBalanceAccount,
  ViacrediInvestmentStatement,
  ViacrediStatement,
} from './types';
import { normalizeText } from './questor-utils';

function accountLooksLikeViacredi(account: QuestorTrialBalanceAccount): boolean {
  return normalizeText(account.name).includes('viacredi');
}

function ledgerAccountLooksLikeBank(account: QuestorLedgerAccount): boolean {
  const normalizedName = normalizeText(account.accountName);
  return [
    'banco',
    'bradesco',
    'viacredi',
    'sicoob',
    'sicredi',
    'itau',
    'caixa',
    'santander',
    'banco do brasil',
    'nubank',
    'inter',
    'aplicacao',
  ].some((hint) => normalizedName.includes(hint));
}

function detectLedgerAccountKind(account: QuestorLedgerAccount): BankAccountKind {
  const normalizedName = normalizeText(account.accountName);
  if (normalizedName.includes('aplicacao')) return 'cash_investment';
  if (ledgerAccountLooksLikeBank(account)) return 'bank_account';
  return 'other';
}

export function buildBankLikeAccountsFromLedger(
  ledger: QuestorLedgerParseResult,
): QuestorTrialBalanceAccount[] {
  return ledger.accounts
    .filter((account) => ledgerAccountLooksLikeBank(account))
    .map((account, index) => {
      const debit = account.entries.reduce((sum, entry) => sum + entry.debit, 0);
      const credit = account.entries.reduce((sum, entry) => sum + entry.credit, 0);
      const lastEntry = [...account.entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1);

      return {
        accountCode: account.accountCode,
        isSynthetic: false,
        classification: '',
        name: account.accountName,
        previousBalance: 0,
        debit,
        credit,
        endingBalance: lastEntry?.balance ?? 0,
        kind: detectLedgerAccountKind(account),
        rowNumber: index + 1,
        rawData: {
          source: 'ledger_inferred',
        },
      };
    })
    .filter((account) => account.kind !== 'other');
}

function statementLooksLikeViacredi(statement: ViacrediStatement): boolean {
  return statement.institutionName === 'VIACREDI';
}

function statementOverlapsAccountMovement(
  account: QuestorTrialBalanceAccount,
  statement: ViacrediStatement,
): boolean {
  const accountHasMovement = Math.abs(account.debit) > 0 || Math.abs(account.credit) > 0;
  const statementHasMovement = statement.entries.length > 0;

  return accountHasMovement && statementHasMovement;
}

export function matchBankAccountsToStatements(
  accounts: QuestorTrialBalanceAccount[],
  ledger: QuestorLedgerParseResult,
  statements: ViacrediStatement[],
  investmentStatements: ViacrediInvestmentStatement[] = [],
): AccountStatementMatch[] {
  const matches: AccountStatementMatch[] = [];
  const accountsByCode = ledger.accountsByCode ?? {};

  accounts
    .filter((account) => account.kind !== 'other')
    .forEach((account) => {
      const ledgerAccount = accountsByCode[account.accountCode];

      if (account.kind === 'cash_investment') {
        const investmentCandidate = investmentStatements.find((statement) =>
          accountLooksLikeViacredi(account) && statement.institutionName === 'VIACREDI',
        );

        if (investmentCandidate) {
          matches.push({
            account,
            ledgerAccount,
            investmentStatement: investmentCandidate,
            status: 'review',
            confidence: 'high',
            reason:
              'Conta analitica de aplicacao financeira encontrada no balancete e extrato de aplicacao Viacredi lido.',
          });
          return;
        }

        matches.push({
          account,
          ledgerAccount,
          status: 'missing_statement',
          confidence: 'none',
          reason:
            'Conta analitica de aplicacao financeira encontrada no balancete; parser do extrato de aplicacao sera tratado na proxima etapa.',
        });
        return;
      }

      const viacrediCandidates = statements.filter((statement) =>
        accountLooksLikeViacredi(account) && statementLooksLikeViacredi(statement),
      );

      if (viacrediCandidates.length > 0) {
        for (const statement of viacrediCandidates) {
          matches.push({
            account,
            ledgerAccount,
            statement,
            status: 'matched',
            confidence: statementOverlapsAccountMovement(account, statement) ? 'high' : 'medium',
            reason: 'Nome da conta contábil contém Viacredi e o extrato é da Viacredi.',
          });
        }
        return;
      }

      matches.push({
        account,
        ledgerAccount,
        status: 'missing_statement',
        confidence: 'none',
        reason: 'Conta bancária analítica encontrada no balancete, mas nenhum extrato correspondente foi enviado.',
      });
    });

  return matches;
}
