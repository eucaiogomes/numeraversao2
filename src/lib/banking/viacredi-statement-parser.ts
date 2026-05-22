import type { BankStatementEntry, ViacrediStatement } from './types';
import { cleanText, parseBrazilianNumber, parseQuestorDate } from './questor-utils';

function isDateToken(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

function isMoneyToken(value: string): boolean {
  return /^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(value) || /^-?\d+,\d{2}$/.test(value);
}

function parsePeriod(tokens: string[]): { periodStart: string; periodEnd: string } {
  const periodToken = tokens.find((token) => /^Per[ií]odo\s+/i.test(token));
  const match = periodToken?.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
  const periodStart = match ? parseQuestorDate(match[1]) : null;
  const periodEnd = match ? parseQuestorDate(match[2]) : null;

  if (!periodStart || !periodEnd) {
    throw new Error('Nao foi possivel identificar o periodo do extrato Viacredi.');
  }

  return { periodStart, periodEnd };
}

function parseMetadata(
  tokens: string[],
): Pick<ViacrediStatement, 'customerName' | 'bankCode' | 'agency' | 'accountNumber'> {
  const customerToken = tokens.find((token) => token.startsWith('Nome:'));
  const bankToken = tokens.find((token) => token.includes('Cooperativa:'));

  const customerName = customerToken?.replace(/^Nome:\s*/i, '').trim() || undefined;
  const bankCode = bankToken?.match(/Banco:\s*([^|]+)/i)?.[1]?.trim();
  const agency = bankToken?.match(/Ag[eê]ncia:\s*([^|]+)/i)?.[1]?.trim();
  const accountNumber = bankToken?.match(/Conta:\s*([^|]+)/i)?.[1]?.trim();

  return { customerName, bankCode, agency, accountNumber };
}

function findOpeningBalance(tokens: string[]): { openingBalance: number; nextIndex: number } {
  const saldoIndex = tokens.findIndex(
    (token, index) =>
      token.toUpperCase() === 'SALDO' && tokens[index + 1]?.toUpperCase() === 'ANTERIOR',
  );

  if (saldoIndex === -1) return { openingBalance: 0, nextIndex: 0 };

  const balanceIndex = tokens.findIndex(
    (token, index) => index > saldoIndex + 1 && isMoneyToken(token),
  );
  if (balanceIndex === -1) return { openingBalance: 0, nextIndex: saldoIndex + 2 };

  return {
    openingBalance: parseBrazilianNumber(tokens[balanceIndex]),
    nextIndex: balanceIndex + 1,
  };
}

function parseEntries(tokens: string[], startIndex: number): BankStatementEntry[] {
  const entries: BankStatementEntry[] = [];
  let cursor = startIndex;

  for (let i = startIndex; i < tokens.length; i += 1) {
    if (tokens[i] === 'Os' && tokens[i + 1]?.startsWith('dados')) break;
    if (tokens[i].toUpperCase() === 'TOTAL') break;
    if (!isDateToken(tokens[i])) continue;

    const amountToken = tokens[i + 1];
    const balanceToken = tokens[i + 2];
    const documentToken = tokens[i + 3];
    if (!isMoneyToken(amountToken) || !isMoneyToken(balanceToken)) continue;

    const date = parseQuestorDate(tokens[i]);
    if (!date) continue;

    const descriptionTokens = tokens.slice(cursor, i).filter((token) => token !== 'SALDO (R$)');
    const description = cleanText(descriptionTokens.join(' '));
    if (!description) continue;

    const rawTokens = tokens.slice(cursor, i + 4);
    entries.push({
      date,
      description,
      amount: parseBrazilianNumber(amountToken),
      balance: parseBrazilianNumber(balanceToken),
      document: documentToken && !isDateToken(documentToken) ? documentToken : undefined,
      sequence: entries.length + 1,
      rawTokens,
    });

    cursor = i + 4;
    i += 3;
  }

  return entries;
}

export function parseViacrediStatementTextTokens(tokens: string[]): ViacrediStatement {
  const joined = tokens.join(' ');
  if (!joined.includes('VIACREDI')) {
    throw new Error('O PDF informado nao parece ser um extrato Viacredi.');
  }

  const { periodStart, periodEnd } = parsePeriod(tokens);
  const metadata = parseMetadata(tokens);
  const { openingBalance, nextIndex } = findOpeningBalance(tokens);
  const entries = parseEntries(tokens, nextIndex);

  if (entries.length === 0) {
    throw new Error('Nao foi possivel extrair lancamentos do extrato Viacredi.');
  }

  const dailyBalances = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.date] = entry.balance;
    return acc;
  }, {});

  return {
    institutionName: 'VIACREDI',
    ...metadata,
    periodStart,
    periodEnd,
    openingBalance,
    finalBalance: entries.at(-1)?.balance ?? openingBalance,
    entries,
    dailyBalances,
    rawTextTokens: tokens,
  };
}
