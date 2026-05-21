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

const DATE_HINTS = ['data', 'date', 'dt', 'datapagamento', 'datalancamento', 'datacompetencia', 'datacaixa'];
const AMOUNT_HINTS = ['valor', 'amount', 'value', 'vl', 'vlr', 'montante', 'debito', 'credito', 'vlorcredito', 'vlordebito'];
const DESC_HINTS = ['historico', 'descricao', 'description', 'memo', 'complemento', 'obs', 'observacao', 'hist', 'discriminacao'];
const ACCOUNT_HINTS = ['conta', 'account', 'codconta', 'codigoconta', 'contabilidade'];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function detectColumns(headers: string[]): Partial<CSVColumnMapping> {
  const find = (hints: string[]) =>
    headers.find((h) => hints.some((hint) => normalize(h).includes(hint)));
  return {
    dateColumn: find(DATE_HINTS),
    amountColumn: find(AMOUNT_HINTS),
    descriptionColumn: find(DESC_HINTS),
    accountCodeColumn: find(ACCOUNT_HINTS),
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
