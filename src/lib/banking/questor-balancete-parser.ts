import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import type {
  BankAccountKind,
  QuestorTrialBalanceAccount,
  QuestorTrialBalanceParseResult,
} from './types';
import {
  cleanText,
  normalizeText,
  parseBrazilianNumber,
  splitClassificationAndName,
} from './questor-utils';

type TrialBalanceRow = Record<string, unknown>;

const BANK_NAME_HINTS = [
  'banco',
  'bradesco',
  'viacredi',
  'sicoob',
  'sicredi',
  'itau',
  'caixa',
  'santander',
  'bb ',
  'banco do brasil',
  'nubank',
  'inter',
];

function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function pick(row: TrialBalanceRow, aliases: string[]): unknown {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const found = entries.find(([key]) => normalizeHeader(key) === alias);
    if (found) return found[1];
  }
  return undefined;
}

function detectKind(classification: string, name: string): BankAccountKind {
  const normalizedName = normalizeText(name);
  const normalizedClassification = normalizeText(classification);

  if (normalizedClassification.startsWith('1.1.01.002')) {
    return 'bank_account';
  }

  if (
    normalizedClassification.startsWith('1.1.01.003') ||
    normalizedName.includes('aplicacao')
  ) {
    return 'cash_investment';
  }

  if (normalizedName.includes('cotas') || normalizedName.includes('capital')) {
    return 'other';
  }

  if (BANK_NAME_HINTS.some((hint) => normalizedName.includes(hint.trim()))) {
    return 'bank_account';
  }

  return 'other';
}

function rowToAccount(row: TrialBalanceRow, index: number): QuestorTrialBalanceAccount | null {
  const accountCode = cleanText(pick(row, ['conta']));
  const classificationCell = pick(row, ['classificacao', 'classificao']);

  if (!accountCode || !classificationCell) return null;

  const syntheticMarker = normalizeText(pick(row, ['s']));
  const { classification, name } = splitClassificationAndName(classificationCell);
  if (!classification || !name) return null;

  const previousBalance = parseBrazilianNumber(pick(row, ['saldoant', 'saldoanterior']));
  const debit = parseBrazilianNumber(pick(row, ['debito']));
  const credit = parseBrazilianNumber(pick(row, ['credito']));
  const endingBalance = parseBrazilianNumber(pick(row, ['saldo']));

  return {
    accountCode,
    isSynthetic: syntheticMarker === 's',
    classification,
    name,
    previousBalance,
    debit,
    credit,
    endingBalance,
    kind: detectKind(classification, name),
    rowNumber: index + 2,
    rawData: row,
  };
}

export function parseQuestorTrialBalanceRows(
  rows: TrialBalanceRow[],
): QuestorTrialBalanceParseResult {
  const accounts = rows
    .map((row, index) => rowToAccount(row, index))
    .filter((account): account is QuestorTrialBalanceAccount => account !== null);

  const analyticalAccounts = accounts.filter((account) => !account.isSynthetic);
  const bankLikeAccounts = analyticalAccounts.filter((account) => account.kind !== 'other');

  return { accounts, analyticalAccounts, bankLikeAccounts };
}

export function parseQuestorTrialBalance(buffer: ArrayBuffer): QuestorTrialBalanceParseResult {
  const workbook = xlsxRead(new Uint8Array(buffer), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsxUtils.sheet_to_json<TrialBalanceRow>(sheet, { defval: '' });

  return parseQuestorTrialBalanceRows(rows);
}

export async function parseQuestorTrialBalanceFile(
  file: File,
): Promise<QuestorTrialBalanceParseResult> {
  return parseQuestorTrialBalance(await file.arrayBuffer());
}
