export interface OFXTransaction {
  id: string;
  postedAt: string; // ISO YYYY-MM-DD
  amount: number;
  description: string;
  rawData: { fitid: string; trntype: string };
}

const STMTTRN_RE = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;

function getField(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([^<\n]*)`, 'i'));
  return m ? m[1].trim() : null;
}

export function parseOFX(text: string): OFXTransaction[] {
  const txs: OFXTransaction[] = [];
  STMTTRN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = STMTTRN_RE.exec(text)) !== null) {
    const block = m[1];
    const rawDate = getField(block, 'DTPOSTED');
    if (!rawDate) continue;

    const postedAt = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const amountStr = getField(block, 'TRNAMT');
    if (!amountStr) continue;

    const amount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amount)) continue;

    const description = (getField(block, 'MEMO') ?? getField(block, 'NAME') ?? '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();

    txs.push({
      id: crypto.randomUUID(),
      postedAt,
      amount,
      description,
      rawData: {
        fitid: getField(block, 'FITID') ?? '',
        trntype: getField(block, 'TRNTYPE') ?? '',
      },
    });
  }

  return txs;
}
