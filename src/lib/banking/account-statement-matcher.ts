import type {
  AccountStatementMatch,
  QuestorLedgerParseResult,
  QuestorTrialBalanceAccount,
  ViacrediStatement,
} from './types';
import { normalizeText } from './questor-utils';

function accountLooksLikeViacredi(account: QuestorTrialBalanceAccount): boolean {
  return normalizeText(account.name).includes('viacredi');
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
): AccountStatementMatch[] {
  const matches: AccountStatementMatch[] = [];

  accounts
    .filter((account) => account.kind !== 'other')
    .forEach((account) => {
      const ledgerAccount = ledger.accountsByCode[account.accountCode];

      if (account.kind === 'cash_investment') {
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
