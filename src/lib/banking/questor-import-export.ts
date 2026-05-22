import type { BankingReconciliationCase } from './banking-reconciliation-store';
import type { BankingReviewItem, SuggestedBankingEntry } from './types';

export interface QuestorImportRow {
  date: string;
  debitAccountCode: string;
  creditAccountCode: string;
  amount: number;
  historyCode: string;
  historyComplement: string;
  suggestedEntryId: string;
}

export interface BlockedQuestorImportEntry {
  suggestedEntryId: string;
  history: string;
  reason: string;
}

export interface QuestorImportBuildResult {
  rows: QuestorImportRow[];
  blockedEntries: BlockedQuestorImportEntry[];
  approvedCount: number;
  content: string;
  fileName: string;
}

export interface QuestorImportAccountMappings {
  investmentIncomeCreditAccountCode?: string;
  investmentIncomeTaxDebitAccountCode?: string;
  historyCode?: string;
}

function formatQuestorDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatQuestorAmount(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function sanitizeText(value: string, maxLength: number): string {
  return value.replace(/[;\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function findApprovedSuggestedEntryIds(reviewItems: BankingReviewItem[]): Set<string> {
  return new Set(
    reviewItems
      .filter(
        (item) =>
          item.kind === 'suggested_entry' &&
          item.status === 'approved' &&
          Boolean(item.suggestedEntryId),
      )
      .map((item) => item.suggestedEntryId as string),
  );
}

function findSuggestedEntries(caseData: BankingReconciliationCase): SuggestedBankingEntry[] {
  return caseData.results.flatMap((result) => result.suggestedEntries ?? []);
}

function buildQuestorRow(
  entry: SuggestedBankingEntry,
  mappings: QuestorImportAccountMappings,
): QuestorImportRow | BlockedQuestorImportEntry {
  const debitAccountCode =
    entry.debitAccountCode ??
    (entry.kind === 'investment_income_tax'
      ? mappings.investmentIncomeTaxDebitAccountCode
      : undefined);
  const creditAccountCode =
    entry.creditAccountCode ??
    (entry.kind === 'investment_income' ? mappings.investmentIncomeCreditAccountCode : undefined);

  if (!debitAccountCode) {
    return {
      suggestedEntryId: entry.id,
      history: entry.history,
      reason: 'Conta debito nao informada na sugestao.',
    };
  }

  if (!creditAccountCode) {
    return {
      suggestedEntryId: entry.id,
      history: entry.history,
      reason: 'Conta credito nao informada na sugestao.',
    };
  }

  return {
    date: entry.date,
    debitAccountCode,
    creditAccountCode,
    amount: entry.amount,
    historyCode: mappings.historyCode ?? '',
    historyComplement: entry.history,
    suggestedEntryId: entry.id,
  };
}

export function serializeQuestorImportRows(rows: QuestorImportRow[]): string {
  if (rows.length === 0) return '';

  return `${rows
    .map((row) =>
      [
        formatQuestorDate(row.date),
        row.debitAccountCode,
        row.creditAccountCode,
        formatQuestorAmount(row.amount),
        row.historyCode,
        sanitizeText(row.historyComplement, 300),
      ].join(';'),
    )
    .join('\r\n')}\r\n`;
}

export function buildApprovedQuestorImportFile(
  caseData: BankingReconciliationCase,
  mappings: QuestorImportAccountMappings = {},
): QuestorImportBuildResult {
  const approvedIds = findApprovedSuggestedEntryIds(caseData.reviewItems);
  const rows: QuestorImportRow[] = [];
  const blockedEntries: BlockedQuestorImportEntry[] = [];

  for (const entry of findSuggestedEntries(caseData)) {
    if (!approvedIds.has(entry.id)) continue;

    const rowOrBlocked = buildQuestorRow(entry, mappings);
    if ('reason' in rowOrBlocked) {
      blockedEntries.push(rowOrBlocked);
    } else {
      rows.push(rowOrBlocked);
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.suggestedEntryId.localeCompare(b.suggestedEntryId));

  return {
    rows,
    blockedEntries,
    approvedCount: approvedIds.size,
    content: serializeQuestorImportRows(rows),
    fileName: `questor-lancamentos-${caseData.competence}.txt`,
  };
}
