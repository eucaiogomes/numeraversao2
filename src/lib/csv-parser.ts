export interface CSVTransaction {
  id: string;
  postedAt: string;
  amount: number;
  description: string;
  accountCode?: string;
  rawData: Record<string, string>;
}

export interface CSVColumnMapping {
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  accountCodeColumn?: string;
}

const DATE_HINTS = [
  'data', 'date', 'dt', 'datapagamento', 'datalancamento', 'datacompetencia',
  'datacaixa', 'datamovimento', 'datmov', 'datlan', 'competencia', 'vencimento',
  'emissao', 'lancamento', 'movimento', 'postdate', 'posted',
];
const AMOUNT_HINTS = [
  'valor', 'amount', 'value', 'vl', 'vlr', 'montante', 'debito', 'credito',
  'vlorcredito', 'vlordebito', 'debit', 'credit', 'saldo', 'total', 'preco',
  'price', 'quantia', 'importe', 'valorlancamento', 'vlrlancamento', 'valoroperacao',
];
const DESC_HINTS = [
  'historico', 'descricao', 'description', 'memo', 'complemento', 'obs',
  'observacao', 'hist', 'discriminacao', 'historico', 'detalhes', 'detalhe',
  'ocorrencia', 'natureza', 'documento', 'doc', 'operacao', 'tipo', 'lancamento',
  'historicolan', 'complementolan', 'texto', 'narrative', 'name', 'nome',
];
const ACCOUNT_HINTS = [
  'conta', 'account', 'codconta', 'codigoconta', 'contabilidade', 'cod', 'codigo',
  'plano', 'ccusto', 'centrocusto',
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function looksLikeDate(v: string): boolean {
  return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(v.trim()) ||
    /^\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(v.trim()) ||
    /^\d{8}$/.test(v.trim());
}

function looksLikeAmount(v: string): boolean {
  const cleaned = v.replace(/[R$\s.]/g, '').replace(',', '.');
  return !isNaN(parseFloat(cleaned)) && cleaned.trim() !== '';
}

export function detectColumns(
  headers: string[],
  rows?: Record<string, string>[],
): Partial<CSVColumnMapping> {
  const find = (hints: string[]) =>
    headers.find((h) => hints.some((hint) => normalize(h) === hint || normalize(h).startsWith(hint) || normalize(h).includes(hint)));

  const byName: Partial<CSVColumnMapping> = {
    dateColumn: find(DATE_HINTS),
    amountColumn: find(AMOUNT_HINTS),
    descriptionColumn: find(DESC_HINTS),
    accountCodeColumn: find(ACCOUNT_HINTS),
  };

  // If all three required fields found by name, return immediately
  if (byName.dateColumn && byName.amountColumn && byName.descriptionColumn) return byName;

  // Fallback: scan up to 20 rows to detect columns by content
  if (!rows || rows.length === 0) return byName;
  const sample = rows.slice(0, 20);

  // Score each header for each role
  const scores: Record<string, { date: number; amount: number; text: number }> = {};
  for (const h of headers) {
    scores[h] = { date: 0, amount: 0, text: 0 };
    for (const row of sample) {
      const v = (row[h] ?? '').trim();
      if (!v) continue;
      if (looksLikeDate(v)) scores[h].date++;
      else if (looksLikeAmount(v)) scores[h].amount++;
      else if (v.length > 3) scores[h].text++;
    }
  }

  const threshold = Math.ceil(sample.length * 0.4);
  const byContent: Partial<CSVColumnMapping> = {};

  if (!byName.dateColumn) {
    const best = headers
      .filter((h) => scores[h].date >= threshold)
      .sort((a, b) => scores[b].date - scores[a].date)[0];
    if (best) byContent.dateColumn = best;
  }
  if (!byName.amountColumn) {
    const best = headers
      .filter((h) => scores[h].amount >= threshold && h !== (byContent.dateColumn ?? byName.dateColumn))
      .sort((a, b) => scores[b].amount - scores[a].amount)[0];
    if (best) byContent.amountColumn = best;
  }
  if (!byName.descriptionColumn) {
    const usedCols = new Set([byContent.dateColumn, byName.dateColumn, byContent.amountColumn, byName.amountColumn]);
    const best = headers
      .filter((h) => !usedCols.has(h) && scores[h].text >= threshold)
      .sort((a, b) => scores[b].text - scores[a].text)[0];
    if (best) byContent.descriptionColumn = best;
  }

  return {
    dateColumn: byName.dateColumn ?? byContent.dateColumn,
    amountColumn: byName.amountColumn ?? byContent.amountColumn,
    descriptionColumn: byName.descriptionColumn ?? byContent.descriptionColumn,
    accountCodeColumn: byName.accountCodeColumn,
  };
}

function parseDate(s: string): string | null {
  if (!s) return null;
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return s.slice(0, 10);
  const m3 = s.match(/^(\d{8})/);
  if (m3) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  // DD-MM-YYYY
  const m4 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m4) return `${m4[3]}-${m4[2].padStart(2, '0')}-${m4[1].padStart(2, '0')}`;
  return null;
}

function parseAmount(s: string): number {
  const cleaned = s.replace(/[^\d,.-]/g, '');
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const commaPos = cleaned.lastIndexOf(',');
    const dotPos = cleaned.lastIndexOf('.');
    if (commaPos > dotPos) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(cleaned.replace(/,/g, ''));
  }
  if (cleaned.includes(',')) return parseFloat(cleaned.replace(',', '.'));
  return parseFloat(cleaned);
}

function splitLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === sep && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

export function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = splitLine(lines[0], sep);
  const rows = lines.slice(1).map((line) => {
    const values = splitLine(line, sep);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });

  return { headers, rows };
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: CSVColumnMapping,
): CSVTransaction[] {
  return rows
    .map((row) => {
      const dateStr = row[mapping.dateColumn] ?? '';
      const amountStr = row[mapping.amountColumn] ?? '';
      const description = (row[mapping.descriptionColumn] ?? '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

      const postedAt = parseDate(dateStr);
      if (!postedAt) return null;

      const amount = parseAmount(amountStr);
      if (isNaN(amount)) return null;

      return {
        id: crypto.randomUUID(),
        postedAt,
        amount,
        description,
        accountCode: mapping.accountCodeColumn ? row[mapping.accountCodeColumn] : undefined,
        rawData: row,
      } as CSVTransaction;
    })
    .filter((t): t is CSVTransaction => t !== null);
}
