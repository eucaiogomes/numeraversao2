import { parseOFX } from './ofx-parser';
import { parseCSVText, detectColumns, applyMapping } from './csv-parser';
import type { CSVColumnMapping } from './csv-parser';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';

export type FileFormat = 'ofx' | 'csv' | 'xlsx' | 'txt' | 'pdf' | 'unknown';

export interface NormalizedTransaction {
  id: string;
  sourceId: string;
  postedAt: string;
  amount: number;
  description: string;
  rawData: Record<string, unknown>;
}

export interface ParsedSource {
  tempId: string;
  fileName: string;
  format: FileFormat;
  transactions: NormalizedTransaction[];
  // CSV/XLSX that need column mapping
  needsMapping: boolean;
  headers?: string[];
  rows?: Record<string, string>[];
  detectedMapping?: Partial<CSVColumnMapping>;
}

export const SOURCE_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316',
];

export function detectFormat(fileName: string): FileFormat {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'ofx' || ext === 'qfx') return 'ofx';
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'txt') return 'txt';
  if (ext === 'pdf') return 'pdf';
  return 'unknown';
}

function xlsxToRows(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = xlsxRead(new Uint8Array(buffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = xlsxUtils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (raw.length < 2) return { headers: [], rows: [] };

  const headers = (raw[0] as unknown[]).map((h) => String(h ?? '').trim());
  const rows = (raw.slice(1) as unknown[][]).map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? '').trim()])),
  );

  return { headers, rows };
}

export async function parseFile(file: File): Promise<ParsedSource> {
  const tempId = crypto.randomUUID();
  const format = detectFormat(file.name);

  if (format === 'pdf') {
    return {
      tempId,
      fileName: file.name,
      format: 'pdf',
      transactions: [],
      needsMapping: false,
    };
  }

  if (format === 'ofx') {
    const text = await file.text();
    const txs = parseOFX(text).map((t) => ({
      id: t.id,
      sourceId: tempId,
      postedAt: t.postedAt,
      amount: t.amount,
      description: t.description,
      rawData: t.rawData as Record<string, unknown>,
    }));
    return { tempId, fileName: file.name, format, transactions: txs, needsMapping: false };
  }

  if (format === 'csv' || format === 'txt') {
    const text = await file.text();
    const { headers, rows } = parseCSVText(text);
    const detected = detectColumns(headers);
    const autoOk = !!detected.dateColumn && !!detected.amountColumn && !!detected.descriptionColumn;

    if (!autoOk) {
      return { tempId, fileName: file.name, format, transactions: [], needsMapping: true, headers, rows, detectedMapping: detected };
    }

    const mapped = applyMapping(rows, detected as CSVColumnMapping);
    const txs = mapped.map((t) => ({ id: t.id, sourceId: tempId, postedAt: t.postedAt, amount: t.amount, description: t.description, rawData: t.rawData }));
    return { tempId, fileName: file.name, format, transactions: txs, needsMapping: false };
  }

  if (format === 'xlsx') {
    const buffer = await file.arrayBuffer();
    const { headers, rows } = xlsxToRows(buffer);
    const detected = detectColumns(headers);
    const autoOk = !!detected.dateColumn && !!detected.amountColumn && !!detected.descriptionColumn;

    if (!autoOk) {
      return { tempId, fileName: file.name, format, transactions: [], needsMapping: true, headers, rows, detectedMapping: detected };
    }

    const mapped = applyMapping(rows, detected as CSVColumnMapping);
    const txs = mapped.map((t) => ({ id: t.id, sourceId: tempId, postedAt: t.postedAt, amount: t.amount, description: t.description, rawData: t.rawData }));
    return { tempId, fileName: file.name, format, transactions: txs, needsMapping: false };
  }

  return { tempId, fileName: file.name, format: 'unknown', transactions: [], needsMapping: false };
}

export function applyMappingToSource(
  source: ParsedSource,
  mapping: CSVColumnMapping,
): NormalizedTransaction[] {
  const mapped = applyMapping(source.rows ?? [], mapping);
  return mapped.map((t) => ({
    id: t.id,
    sourceId: source.tempId,
    postedAt: t.postedAt,
    amount: t.amount,
    description: t.description,
    rawData: t.rawData,
  }));
}
