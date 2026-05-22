import type {
  BalanceReconciliationResult,
  BankingReviewItem,
  BankingReviewItemKind,
} from './types';

function fmtCurrency(value: number | undefined): string {
  if (value === undefined) return 'sem valor calculado';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(value: string | undefined): string {
  if (!value) return 'sem data';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function itemId(
  kind: BankingReviewItemKind,
  result: BalanceReconciliationResult,
  date?: string,
): string {
  return [
    kind,
    result.accountCode,
    result.periodStart ?? 'sem-periodo',
    date ?? 'sem-data',
  ].join(':');
}

function accountLabel(result: BalanceReconciliationResult): string {
  return `${result.accountCode} - ${result.accountName}`;
}

function missingStatementTitle(result: BalanceReconciliationResult): string {
  if (result.accountKind === 'cash_investment') {
    return `Anexar extrato de aplicacao da conta ${accountLabel(result)}`;
  }

  return `Solicitar extrato da conta ${accountLabel(result)}`;
}

function missingStatementDetail(result: BalanceReconciliationResult): string {
  if (result.accountKind === 'cash_investment') {
    return 'A conta aparece como aplicacao financeira analitica no balancete. A leitura do extrato de aplicacao entra na fase 9.2.';
  }

  return 'A conta aparece como analitica bancaria no balancete, mas nenhum PDF digital correspondente foi enviado.';
}

export function buildBankingReviewItems(
  results: BalanceReconciliationResult[],
  existingItems: BankingReviewItem[] = [],
): BankingReviewItem[] {
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  const items: BankingReviewItem[] = [];

  for (const result of results) {
    if (result.status === 'missing_statement') {
      const id = itemId('missing_statement', result);
      items.push({
        id,
        kind: 'missing_statement',
        status: existingById.get(id)?.status ?? 'open',
        accountCode: result.accountCode,
        accountName: result.accountName,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        title: missingStatementTitle(result),
        detail: missingStatementDetail(result),
        note: existingById.get(id)?.note,
        updatedAt: existingById.get(id)?.updatedAt,
      });
    }

    if (result.status === 'missing_ledger') {
      const id = itemId('missing_ledger', result);
      items.push({
        id,
        kind: 'missing_ledger',
        status: existingById.get(id)?.status ?? 'open',
        accountCode: result.accountCode,
        accountName: result.accountName,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        title: `Localizar conta ${accountLabel(result)} no Razao`,
        detail:
          'O extrato foi encontrado, mas a conta contabil nao apareceu no Razao exportado do Questor.',
        note: existingById.get(id)?.note,
        updatedAt: existingById.get(id)?.updatedAt,
      });
    }

    if (result.status === 'divergent') {
      const date = result.firstDivergentCheckpoint?.date;
      const candidate =
        result.statementEntriesOnDivergenceDate[0] ?? result.investmentEntriesOnDivergenceDate?.[0];
      const id = itemId('divergence_check', result, date);
      items.push({
        id,
        kind: 'divergence_check',
        status: existingById.get(id)?.status ?? 'open',
        accountCode: result.accountCode,
        accountName: result.accountName,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        title: `Conferir diferenca em ${accountLabel(result)}`,
        detail: `Ultimo dia conciliado: ${fmtDate(result.lastMatchedCheckpoint?.date)}. Primeira divergencia: ${fmtDate(date)}. Diferenca: ${fmtCurrency(result.difference)}.`,
        amount: result.difference,
        dueDate: date,
        candidateDescription: candidate
          ? `${candidate.description} (${fmtCurrency(candidate.amount)})`
          : undefined,
        note: existingById.get(id)?.note,
        updatedAt: existingById.get(id)?.updatedAt,
      });
    }

    for (const suggestedEntry of result.suggestedEntries ?? []) {
      const id = `suggested_entry:${suggestedEntry.id}`;
      const existing = existingById.get(id);
      items.push({
        id,
        kind: 'suggested_entry',
        status: existing?.status ?? 'open',
        accountCode: result.accountCode,
        accountName: result.accountName,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        title: `Aprovar lancamento: ${suggestedEntry.history}`,
        detail: `Debito: ${suggestedEntry.debitAccountCode ? `${suggestedEntry.debitAccountCode} - ` : ''}${suggestedEntry.debitAccountName}. Credito: ${suggestedEntry.creditAccountCode ? `${suggestedEntry.creditAccountCode} - ` : ''}${suggestedEntry.creditAccountName}. Valor: ${fmtCurrency(suggestedEntry.amount)}.`,
        amount: suggestedEntry.amount,
        dueDate: suggestedEntry.date,
        candidateDescription: suggestedEntry.sourceDescription,
        note: existing?.note,
        updatedAt: existing?.updatedAt,
      });
    }

    if (result.status === 'insufficient_data') {
      const id = itemId('insufficient_data', result);
      items.push({
        id,
        kind: 'insufficient_data',
        status: existingById.get(id)?.status ?? 'open',
        accountCode: result.accountCode,
        accountName: result.accountName,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        title: `Revisar dados da conta ${accountLabel(result)}`,
        detail:
          'O app nao encontrou informacao suficiente para comparar os saldos com seguranca.',
        note: existingById.get(id)?.note,
        updatedAt: existingById.get(id)?.updatedAt,
      });
    }
  }

  return items;
}
