export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function parseBrazilianNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const text = cleanText(value);
  if (!text) return 0;

  const negativeByParens = /^\(.*\)$/.test(text);
  const cleaned = text
    .replace(/[R$\s]/g, '')
    .replace(/[()]/g, '')
    .replace(/[^\d,.-]/g, '');

  if (!cleaned) return 0;

  let parsed: number;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const commaPos = cleaned.lastIndexOf(',');
    const dotPos = cleaned.lastIndexOf('.');
    parsed = commaPos > dotPos
      ? Number(cleaned.replace(/\./g, '').replace(',', '.'))
      : Number(cleaned.replace(/,/g, ''));
  } else if (cleaned.includes(',')) {
    parsed = Number(cleaned.replace(',', '.'));
  } else {
    parsed = Number(cleaned);
  }

  if (!Number.isFinite(parsed)) return 0;
  return negativeByParens ? -parsed : parsed;
}

export function excelSerialToISODate(value: number): string | null {
  if (!Number.isFinite(value)) return null;

  const utc = Math.round((value - 25569) * 86_400_000);
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

export function parseQuestorDate(value: unknown): string | null {
  if (typeof value === 'number') return excelSerialToISODate(value);

  const text = cleanText(value);
  if (!text) return null;

  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20_000) return excelSerialToISODate(serial);

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return text.slice(0, 10);

  return null;
}

export function splitClassificationAndName(value: unknown): {
  classification: string;
  name: string;
} {
  const text = cleanText(value);
  const match = text.match(/^([\d.]+)\s+(.+)$/);
  if (!match) return { classification: '', name: text };

  return {
    classification: match[1].trim(),
    name: match[2].trim(),
  };
}
