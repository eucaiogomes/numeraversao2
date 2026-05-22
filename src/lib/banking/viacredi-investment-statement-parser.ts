import type {
  InvestmentStatementEntry,
  InvestmentStatementEntryKind,
  ViacrediInvestmentStatement,
} from './types';
import { cleanText, normalizeText, parseBrazilianNumber, parseQuestorDate } from './questor-utils';

function isDateToken(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

function isMoneyToken(value: string): boolean {
  return /^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(value) || /^-?\d+,\d{2}$/.test(value);
}

function entryKind(description: string): InvestmentStatementEntryKind {
  const normalized = normalizeText(description);

  if (normalized.includes('provisao') || normalized.includes('rendimento')) {
    return 'income_provision';
  }

  if (normalized.includes('ir')) {
    return 'income_tax';
  }

  if (normalized.includes('resgate')) {
    return 'redemption';
  }

  if (normalized.includes('plano') || normalized.includes('prog')) {
    return 'monthly_application';
  }

  return 'other';
}

function isDocumentToken(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = normalizeText(value);

  return !['data', 'historico', 'doc.', 'credito (r$)', 'debito (r$)', 'saldo (r$)', 'saldo total'].includes(
    normalized,
  );
}

function findOpeningBalance(tokens: string[]): {
  openingBalanceDate?: string;
  openingBalance: number;
  nextIndex: number;
} {
  const saldoIndex = tokens.findIndex(
    (token, index) =>
      token.toUpperCase() === 'SALDO' && tokens[index + 1]?.toUpperCase() === 'ANTERIOR',
  );

  if (saldoIndex === -1) return { openingBalance: 0, nextIndex: 0 };

  const dateIndex = tokens.findIndex((token, index) => index > saldoIndex + 1 && isDateToken(token));
  const balanceIndex = tokens.findIndex(
    (token, index) => index > (dateIndex === -1 ? saldoIndex + 1 : dateIndex) && isMoneyToken(token),
  );

  return {
    openingBalanceDate: dateIndex === -1 ? undefined : parseQuestorDate(tokens[dateIndex]) ?? undefined,
    openingBalance: balanceIndex === -1 ? 0 : parseBrazilianNumber(tokens[balanceIndex]),
    nextIndex: balanceIndex === -1 ? saldoIndex + 2 : balanceIndex + 1,
  };
}

function parseMetadata(tokens: string[]): Pick<ViacrediInvestmentStatement, 'contractNumber' | 'purpose'> {
  const contractLabelIndex = tokens.findIndex((token) => normalizeText(token) === 'contrato');
  const purposeLabelIndex = tokens.findIndex((token) => normalizeText(token) === 'finalidade');

  return {
    contractNumber:
      contractLabelIndex !== -1 && contractLabelIndex + 2 < tokens.length
        ? cleanText(tokens[contractLabelIndex + 2])
        : undefined,
    purpose:
      purposeLabelIndex !== -1 && purposeLabelIndex + 2 < tokens.length
        ? cleanText(tokens.slice(purposeLabelIndex + 2, purposeLabelIndex + 4).join(' '))
        : undefined,
  };
}

function parseEntries(tokens: string[], startIndex: number): InvestmentStatementEntry[] {
  const entries: InvestmentStatementEntry[] = [];
  let cursor = startIndex;

  for (let i = startIndex; i < tokens.length; i += 1) {
    if (normalizeText(tokens[i]) === 'data') break;
    if (normalizeText(tokens[i]) === 'saldo total') break;
    if (!isDateToken(tokens[i])) continue;

    const creditToken = tokens[i + 1];
    const debitToken = tokens[i + 2];
    const balanceToken = tokens[i + 3];
    const documentToken = tokens[i + 4];

    if (!isMoneyToken(creditToken) || !isMoneyToken(debitToken) || !isMoneyToken(balanceToken)) {
      continue;
    }

    const date = parseQuestorDate(tokens[i]);
    if (!date) continue;

    const description = cleanText(tokens.slice(cursor, i).join(' '));
    if (!description) continue;

    const credit = parseBrazilianNumber(creditToken);
    const debit = parseBrazilianNumber(debitToken);
    const balance = parseBrazilianNumber(balanceToken);
    const rawTokens = tokens.slice(cursor, i + 5);
    const kind = entryKind(description);

    entries.push({
      date,
      description,
      kind,
      credit,
      debit,
      amount: credit - debit,
      balance,
      document: isDocumentToken(documentToken) ? documentToken : undefined,
      sequence: entries.length + 1,
      rawTokens,
    });

    cursor = i + (isDocumentToken(documentToken) ? 5 : 4);
    i = cursor - 1;
  }

  return entries;
}

function findFinalBalance(tokens: string[], entries: InvestmentStatementEntry[], openingBalance: number): number {
  const totalIndex = tokens.findIndex((token) => normalizeText(token) === 'saldo total');
  if (totalIndex !== -1) {
    const balanceToken = tokens.find((token, index) => index > totalIndex && isMoneyToken(token));
    if (balanceToken) return parseBrazilianNumber(balanceToken);
  }

  return entries.at(-1)?.balance ?? openingBalance;
}

export function parseViacrediInvestmentStatementTextTokens(
  tokens: string[],
): ViacrediInvestmentStatement {
  const joined = normalizeText(tokens.join(' '));
  if (!joined.includes('extrato aplicacao programada')) {
    throw new Error('O PDF informado nao parece ser um extrato de Aplicacao Programada Viacredi.');
  }

  const { openingBalanceDate, openingBalance, nextIndex } = findOpeningBalance(tokens);
  const entries = parseEntries(tokens, nextIndex);

  if (entries.length === 0) {
    throw new Error('Nao foi possivel extrair movimentos do extrato de aplicacao Viacredi.');
  }

  const finalBalance = findFinalBalance(tokens, entries, openingBalance);
  const dailyBalances = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.date] = entry.balance;
    return acc;
  }, {});

  return {
    institutionName: 'VIACREDI',
    productName: 'APLICACAO_PROGRAMADA',
    ...parseMetadata(tokens),
    periodStart: openingBalanceDate ?? entries[0].date,
    periodEnd: entries.at(-1)?.date ?? openingBalanceDate ?? entries[0].date,
    openingBalanceDate,
    openingBalance,
    finalBalance,
    entries,
    monthlyApplications: entries.filter((entry) => entry.kind === 'monthly_application'),
    monthlyIncomeProvisions: entries.filter((entry) => entry.kind === 'income_provision'),
    incomeTaxDebits: entries.filter((entry) => entry.kind === 'income_tax'),
    dailyBalances,
    rawTextTokens: tokens,
  };
}
