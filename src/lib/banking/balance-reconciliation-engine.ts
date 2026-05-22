import type {
  AccountStatementMatch,
  BalanceCheckpoint,
  InvestmentStatementEntry,
  BalanceReconciliationResult,
  QuestorLedgerAccount,
  SuggestedBankingEntry,
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

function findInvestmentMissingEntries(
  statementEntries: InvestmentStatementEntry[],
  ledgerAccount: QuestorLedgerAccount,
): InvestmentStatementEntry[] {
  return statementEntries.filter((statementEntry) => {
    const expectedAmount = Math.abs(statementEntry.amount);

    return !ledgerAccount.entries.some((ledgerEntry) => {
      const sameDate = ledgerEntry.date === statementEntry.date;
      const ledgerAmount =
        statementEntry.kind === 'income_tax' ? ledgerEntry.credit : ledgerEntry.debit;

      return sameDate && Math.abs(Math.abs(ledgerAmount) - expectedAmount) <= 0.009;
    });
  });
}

function buildInvestmentSuggestions(
  accountCode: string,
  accountName: string,
  entries: InvestmentStatementEntry[],
): SuggestedBankingEntry[] {
  return entries
    .filter((entry) => entry.kind === 'income_provision' || entry.kind === 'income_tax')
    .map((entry) => {
      const amount = Math.abs(entry.amount);
      const month = entry.date.slice(5, 7);
      const year = entry.date.slice(0, 4);

      if (entry.kind === 'income_tax') {
        return {
          id: `investment-income-tax:${accountCode}:${entry.date}:${entry.sequence}`,
          kind: 'investment_income_tax',
          date: entry.date,
          debitAccountName: 'IR sobre aplicacao financeira',
          creditAccountCode: accountCode,
          creditAccountName: accountName,
          amount,
          history: `IR sobre Aplicacao Financeira ${month}/${year}`,
          sourceDescription: entry.description,
        };
      }

      return {
        id: `investment-income:${accountCode}:${entry.date}:${entry.sequence}`,
        kind: 'investment_income',
        date: entry.date,
        debitAccountCode: accountCode,
        debitAccountName: accountName,
        creditAccountName: 'Receita de Aplicacao Financeira',
        amount,
        history: `Rendimento Aplicacao Financeira ${month}/${year}`,
        sourceDescription: entry.description,
      };
    });
}

export function reconcileAccountStatementByBalance(
  match: AccountStatementMatch,
  tolerance = DEFAULT_TOLERANCE,
): BalanceReconciliationResult {
  const accountName = match.account.name;
  const accountCode = match.account.accountCode;
  const accountKind = match.account.kind;

  if (match.investmentStatement) {
    if (!match.ledgerAccount) {
      return {
        accountCode,
        accountName,
        accountKind,
        status: 'missing_ledger',
        periodStart: match.investmentStatement.periodStart,
        periodEnd: match.investmentStatement.periodEnd,
        ledgerEntriesOnDivergenceDate: [],
        statementEntriesOnDivergenceDate: [],
        investmentEntriesOnDivergenceDate: [],
        suggestedEntries: [],
        message: 'Extrato de aplicacao encontrado, mas a conta nao foi localizada no Razao.',
      };
    }

    const finalCheckpoint = buildCheckpoint(
      match.ledgerAccount,
      match.investmentStatement.periodEnd,
      match.investmentStatement.finalBalance,
      tolerance,
    );
    const candidateEntries = [
      ...findInvestmentMissingEntries(
        match.investmentStatement.monthlyIncomeProvisions,
        match.ledgerAccount,
      ),
      ...findInvestmentMissingEntries(match.investmentStatement.incomeTaxDebits, match.ledgerAccount),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.sequence - b.sequence);

    if (finalCheckpoint.matches) {
      return {
        accountCode,
        accountName,
        accountKind,
        status: 'reconciled',
        periodStart: match.investmentStatement.periodStart,
        periodEnd: match.investmentStatement.periodEnd,
        finalCheckpoint,
        lastMatchedCheckpoint: finalCheckpoint,
        difference: finalCheckpoint.difference,
        ledgerEntriesOnDivergenceDate: [],
        statementEntriesOnDivergenceDate: [],
        investmentEntriesOnDivergenceDate: [],
        suggestedEntries: [],
        message: 'Saldo final da aplicacao confere com o saldo do Razao.',
      };
    }

    const divergenceDate = candidateEntries[0]?.date ?? match.investmentStatement.periodEnd;

    return {
      accountCode,
      accountName,
      accountKind,
      status: 'divergent',
      periodStart: match.investmentStatement.periodStart,
      periodEnd: match.investmentStatement.periodEnd,
      finalCheckpoint,
      firstDivergentCheckpoint: finalCheckpoint,
      difference: finalCheckpoint.difference,
      ledgerEntriesOnDivergenceDate: match.ledgerAccount.entries.filter(
        (entry) => entry.date === divergenceDate,
      ),
      statementEntriesOnDivergenceDate: [],
      investmentEntriesOnDivergenceDate: candidateEntries,
      suggestedEntries: buildInvestmentSuggestions(accountCode, accountName, candidateEntries),
      message:
        candidateEntries.length > 0
          ? 'Saldo final da aplicacao nao confere; foram identificados rendimento/IR do extrato sem lancamento correspondente no Razao.'
          : 'Saldo final da aplicacao nao confere com o Razao.',
    };
  }

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
