import type {
  AccountStatementMatch,
  BalanceCheckpoint,
  BalanceReconciliationResult,
  QuestorLedgerAccount,
} from './types';

const DEFAULT_TOLERANCE = 0.009;

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function findLedgerBalanceOnOrBefore(
  ledgerAccount: QuestorLedgerAccount,
  date: string,
): { date: string; balance: number } | undefined {
  const ledgerDates = Object.keys(ledgerAccount.dailyBalances)
    .filter((ledgerDate) => ledgerDate <= date)
    .sort();

  const ledgerDate = ledgerDates.at(-1);
  if (!ledgerDate) return undefined;

  return { date: ledgerDate, balance: ledgerAccount.dailyBalances[ledgerDate] };
}

function buildCheckpoint(
  ledgerAccount: QuestorLedgerAccount,
  date: string,
  statementBalance: number,
  tolerance: number,
): BalanceCheckpoint {
  const ledgerBalance = findLedgerBalanceOnOrBefore(ledgerAccount, date);
  if (!ledgerBalance) {
    return {
      date,
      statementBalance,
      matches: false,
    };
  }

  const difference = roundCents(ledgerBalance.balance - statementBalance);

  return {
    date,
    statementBalance,
    ledgerBalance: ledgerBalance.balance,
    ledgerBalanceDate: ledgerBalance.date,
    difference,
    matches: Math.abs(difference) <= tolerance,
  };
}

export function reconcileAccountStatementByBalance(
  match: AccountStatementMatch,
  tolerance = DEFAULT_TOLERANCE,
): BalanceReconciliationResult {
  const accountName = match.account.name;
  const accountCode = match.account.accountCode;
  const accountKind = match.account.kind;

  if (!match.statement) {
    return {
      accountCode,
      accountName,
      accountKind,
      status: 'missing_statement',
      ledgerEntriesOnDivergenceDate: [],
      statementEntriesOnDivergenceDate: [],
      message:
        accountKind === 'cash_investment'
          ? 'Conta de aplicacao financeira identificada no balancete; aguardando extrato de aplicacao para conciliacao.'
          : 'Conta bancaria possui movimento no balancete, mas nao ha extrato correspondente.',
    };
  }

  if (!match.ledgerAccount) {
    return {
      accountCode,
      accountName,
      accountKind,
      status: 'missing_ledger',
      periodStart: match.statement.periodStart,
      periodEnd: match.statement.periodEnd,
      ledgerEntriesOnDivergenceDate: [],
      statementEntriesOnDivergenceDate: [],
      message: 'Extrato encontrado, mas a conta não foi localizada no Razão.',
    };
  }

  const statementDates = Object.keys(match.statement.dailyBalances).sort();
  if (statementDates.length === 0) {
    return {
      accountCode,
      accountName,
      accountKind,
      status: 'insufficient_data',
      periodStart: match.statement.periodStart,
      periodEnd: match.statement.periodEnd,
      ledgerEntriesOnDivergenceDate: [],
      statementEntriesOnDivergenceDate: [],
      message: 'Extrato sem saldos diários suficientes para conciliação.',
    };
  }

  const checkpoints = statementDates.map((date) =>
    buildCheckpoint(match.ledgerAccount!, date, match.statement!.dailyBalances[date], tolerance),
  );

  const finalCheckpoint = checkpoints.at(-1);
  if (!finalCheckpoint) {
    return {
      accountCode,
      accountName,
      accountKind,
      status: 'insufficient_data',
      periodStart: match.statement.periodStart,
      periodEnd: match.statement.periodEnd,
      ledgerEntriesOnDivergenceDate: [],
      statementEntriesOnDivergenceDate: [],
      message: 'Não foi possível montar os checkpoints de saldo.',
    };
  }

  if (finalCheckpoint.matches) {
    return {
      accountCode,
      accountName,
      accountKind,
      status: 'reconciled',
      periodStart: match.statement.periodStart,
      periodEnd: match.statement.periodEnd,
      finalCheckpoint,
      lastMatchedCheckpoint: finalCheckpoint,
      difference: finalCheckpoint.difference,
      ledgerEntriesOnDivergenceDate: [],
      statementEntriesOnDivergenceDate: [],
      message: 'Saldo final do extrato confere com o saldo do Razão.',
    };
  }

  const reversed = [...checkpoints].reverse();
  const lastMatchedCheckpoint = reversed.find((checkpoint) => checkpoint.matches);
  const lastMatchedIndex = lastMatchedCheckpoint
    ? checkpoints.findIndex((checkpoint) => checkpoint.date === lastMatchedCheckpoint.date)
    : -1;
  const firstDivergentCheckpoint = checkpoints[lastMatchedIndex + 1] ?? checkpoints[0];
  const divergenceDate = firstDivergentCheckpoint.date;

  return {
    accountCode,
    accountName,
    accountKind,
    status: 'divergent',
    periodStart: match.statement.periodStart,
    periodEnd: match.statement.periodEnd,
    finalCheckpoint,
    lastMatchedCheckpoint,
    firstDivergentCheckpoint,
    difference: firstDivergentCheckpoint.difference ?? finalCheckpoint.difference,
    ledgerEntriesOnDivergenceDate: match.ledgerAccount.entries.filter(
      (entry) => entry.date === divergenceDate,
    ),
    statementEntriesOnDivergenceDate: match.statement.entries.filter(
      (entry) => entry.date === divergenceDate,
    ),
    message: lastMatchedCheckpoint
      ? 'Saldo final não confere; foi encontrado o último dia conciliado e a primeira data divergente.'
      : 'Saldo final não confere e não houve data anterior conciliada no período do extrato.',
  };
}

export function reconcileMatchedBankAccounts(
  matches: AccountStatementMatch[],
  tolerance = DEFAULT_TOLERANCE,
): BalanceReconciliationResult[] {
  return matches.map((match) => reconcileAccountStatementByBalance(match, tolerance));
}
