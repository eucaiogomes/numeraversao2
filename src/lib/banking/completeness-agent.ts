import { matchBankAccountsToStatements } from './account-statement-matcher';
import type { ClassificationSummary } from './file-classifier-agent';

export interface MissingStatement {
  accountCode: string;
  accountName: string;
}

export type CompletenessResult =
  | { ready: true; matchedAccounts: number }
  | {
      ready: false;
      missingTrialBalance: boolean;
      missingLedger: boolean;
      missingStatements: MissingStatement[];
      questionText: string;
    };

export function runCompletenessAgent(summary: ClassificationSummary): CompletenessResult {
  if (!summary.trialBalance || !summary.ledger) {
    const missing: string[] = [];
    if (!summary.trialBalance) missing.push('balancete Questor (XLS/XLSX)');
    if (!summary.ledger) missing.push('razão Questor (XLS/XLSX)');

    return {
      ready: false,
      missingTrialBalance: !summary.trialBalance,
      missingLedger: !summary.ledger,
      missingStatements: [],
      questionText: `Para iniciar a conciliação ainda preciso de: ${missing.join(' e ')}. Pode enviar?`,
    };
  }

  const allStatements = summary.checkingStatements.map((s) => s.result);
  const allInvestments = summary.investmentStatements.map((s) => s.result);

  const matches = matchBankAccountsToStatements(
    summary.trialBalance.result.bankLikeAccounts,
    summary.ledger.result,
    allStatements,
    allInvestments,
  );

  const missingStatements: MissingStatement[] = matches
    .filter((m) => m.status === 'missing_statement')
    .map((m) => ({ accountCode: m.account.accountCode, accountName: m.account.name }));

  if (missingStatements.length === 0) {
    return { ready: true, matchedAccounts: matches.filter((m) => m.status !== 'missing_statement').length };
  }

  const accountList = missingStatements
    .map((a) => `${a.accountCode} – ${a.accountName}`)
    .join(', ');

  return {
    ready: false,
    missingTrialBalance: false,
    missingLedger: false,
    missingStatements,
    questionText: `Encontrei ${missingStatements.length} conta(s) bancária(s) no balancete sem extrato correspondente: ${accountList}. Deseja enviar o(s) extrato(s) ou prosseguir sem eles?`,
  };
}

export function mergeSummaries(
  base: ClassificationSummary,
  incoming: ClassificationSummary,
): ClassificationSummary {
  return {
    trialBalance: incoming.trialBalance ?? base.trialBalance,
    ledger: incoming.ledger ?? base.ledger,
    checkingStatements: [
      ...base.checkingStatements,
      ...incoming.checkingStatements.filter(
        (s) => !base.checkingStatements.some((b) => b.file.name === s.file.name),
      ),
    ],
    investmentStatements: [
      ...base.investmentStatements,
      ...incoming.investmentStatements.filter(
        (s) => !base.investmentStatements.some((b) => b.file.name === s.file.name),
      ),
    ],
    unknown: [...base.unknown, ...incoming.unknown],
  };
}
