import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import type {
  AccountingBalanceSide,
  QuestorLedgerAccount,
  QuestorLedgerEntry,
  QuestorLedgerParseResult,
} from './types';
import {
  cleanText,
  parseBrazilianNumber,
  parseQuestorDate,
} from './questor-utils';

type LedgerCellRow = unknown[];

interface CurrentAccount {
  accountCode: string;
  accountName: string;
  entries: QuestorLedgerEntry[];
  dailyBalances: Record<string, number>;
}

function parseAccountHeader(value: unknown): { accountCode: string; accountName: string } | null {
  const text = cleanText(value);
  const match = text.match(/^Conta:\s*(\d+)\s*-\s*(.+)$/i);
  if (!match) return null;

  return {
    accountCode: match[1].trim(),
    accountName: match[2].trim(),
  };
}

function parseBalance(value: unknown): { balance: number; balanceSide: AccountingBalanceSide } {
  const text = cleanText(value);
  const sideMark = text.match(/([DC])$/i)?.[1]?.toUpperCase();
  const amount = Math.abs(parseBrazilianNumber(text));

  if (sideMark === 'D') return { balance: amount, balanceSide: 'debit' };
  if (sideMark === 'C') return { balance: -amount, balanceSide: 'credit' };

  return { balance: parseBrazilianNumber(text), balanceSide: 'none' };
}

function buildEntry(
  row: LedgerCellRow,
  rowIndex: number,
  account: CurrentAccount,
): QuestorLedgerEntry | null {
  const date = parseQuestorDate(row[0]);
  if (!date) return null;

  const history = cleanText(row[1]);
  const debit = parseBrazilianNumber(row[4]);
  const credit = parseBrazilianNumber(row[5]);
  const { balance, balanceSide } = parseBalance(row[6]);

  if (!history && debit === 0 && credit === 0 && balance === 0) return null;

  return {
    accountCode: account.accountCode,
    accountName: account.accountName,
    date,
    history,
    counterpartyAccount: cleanText(row[2]) || undefined,
    description: cleanText(row[3]) || undefined,
    debit,
    credit,
    amount: debit - credit,
    balance,
    balanceSide,
    branch: cleanText(row[7]) || undefined,
    user: cleanText(row[8]) || undefined,
    origin: cleanText(row[9]) || undefined,
    rowNumber: rowIndex + 1,
    rawData: {
      data: row[0],
      historico: row[1],
      contrapartida: row[2],
      descricao: row[3],
      debito: row[4],
      credito: row[5],
      saldo: row[6],
      filial: row[7],
      usuario: row[8],
      origem: row[9],
    },
  };
}

export function parseQuestorLedgerRows(rows: LedgerCellRow[]): QuestorLedgerParseResult {
  const accounts: CurrentAccount[] = [];
  let current: CurrentAccount | null = null;

  rows.forEach((row, rowIndex) => {
    const accountHeader = parseAccountHeader(row[1]);
    if (accountHeader) {
      current = {
        ...accountHeader,
        entries: [],
        dailyBalances: {},
      };
      accounts.push(current);
      return;
    }

    if (!current) return;

    const entry = buildEntry(row, rowIndex, current);
    if (!entry) return;

    current.entries.push(entry);
    current.dailyBalances[entry.date] = entry.balance;
  });

  const normalizedAccounts: QuestorLedgerAccount[] = accounts.map((account) => ({
    accountCode: account.accountCode,
    accountName: account.accountName,
    entries: account.entries,
    dailyBalances: account.dailyBalances,
  }));

  return {
    accounts: normalizedAccounts,
    accountsByCode: Object.fromEntries(
      normalizedAccounts.map((account) => [account.accountCode, account]),
    ),
  };
}

export function parseQuestorLedger(buffer: ArrayBuffer): QuestorLedgerParseResult {
  const workbook = xlsxRead(new Uint8Array(buffer), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsxUtils.sheet_to_json<LedgerCellRow>(sheet, { header: 1, defval: '' });

  return parseQuestorLedgerRows(rows);
}

export async function parseQuestorLedgerFile(file: File): Promise<QuestorLedgerParseResult> {
  return parseQuestorLedger(await file.arrayBuffer());
}
