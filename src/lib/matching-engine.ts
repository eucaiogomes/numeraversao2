import type { NormalizedTransaction } from './universal-parser';

export type { NormalizedTransaction };

export interface TransactionSource {
  id: string;
  fileName: string;
  label: string;
  format: string;
  color: string;
  transactions: NormalizedTransaction[];
}

export interface Match {
  id: string;
  transactionAId: string;
  transactionBId: string;
  sourceAId: string;
  sourceBId: string;
  matchType: 'exact' | 'fuzzy_date' | 'fuzzy_amount' | 'description';
  confidence: number;
  dateDiffDays: number;
  amountDiff: number;
  userConfirmed: boolean;
}

export interface Divergence {
  id: string;
  transactionId: string;
  sourceId: string;
  aiProbableCause?: string;
  aiSuggestedAction?: string;
  aiConfidence?: 'high' | 'medium' | 'low';
  aiAnalyzedAt?: string;
  resolution: 'pending' | 'accepted' | 'ignored' | 'investigating' | 'resolved';
  resolutionNote?: string;
}

function dateDiffDays(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const trigrams = (s: string) => {
    const set = new Set<string>();
    const padded = `  ${s}  `;
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    return set;
  };
  const ta = trigrams(a);
  const tb = trigrams(b);
  let n = 0;
  for (const t of ta) if (tb.has(t)) n++;
  return ta.size + tb.size === 0 ? 0 : (2 * n) / (ta.size + tb.size);
}

function matchPair(
  txsA: NormalizedTransaction[],
  txsB: NormalizedTransaction[],
  usedIds: Set<string>,
  sourceAId: string,
  sourceBId: string,
): Match[] {
  const matches: Match[] = [];

  function tryMatch(
    aId: string, bId: string,
    type: Match['matchType'], confidence: number,
    diffDays: number, diffAmount: number,
  ) {
    if (usedIds.has(aId) || usedIds.has(bId)) return false;
    usedIds.add(aId);
    usedIds.add(bId);
    matches.push({ id: crypto.randomUUID(), transactionAId: aId, transactionBId: bId, sourceAId, sourceBId, matchType: type, confidence, dateDiffDays: diffDays, amountDiff: diffAmount, userConfirmed: false });
    return true;
  }

  const availA = () => txsA.filter((t) => !usedIds.has(t.id));
  const availB = () => txsB.filter((t) => !usedIds.has(t.id));

  // Layer 1: exact date + amount
  for (const a of availA()) {
    for (const b of availB()) {
      if (a.postedAt === b.postedAt && a.amount === b.amount) {
        if (tryMatch(a.id, b.id, 'exact', 1.0, 0, 0)) break;
      }
    }
  }

  // Layer 2a: same amount, date ≤ 3 days
  for (const a of availA()) {
    for (const b of availB()) {
      const dd = dateDiffDays(a.postedAt, b.postedAt);
      if (a.amount === b.amount && dd <= 3) {
        if (tryMatch(a.id, b.id, 'fuzzy_date', 0.85, dd, 0)) break;
      }
    }
  }

  // Layer 2b: same date, amount diff ≤ 0.01
  for (const a of availA()) {
    for (const b of availB()) {
      const ad = Math.abs(a.amount - b.amount);
      if (a.postedAt === b.postedAt && ad <= 0.01) {
        if (tryMatch(a.id, b.id, 'fuzzy_amount', 0.85, 0, ad)) break;
      }
    }
  }

  // Layer 3: description similarity
  for (const a of availA()) {
    let best = 0;
    let bestB: NormalizedTransaction | null = null;
    for (const b of availB()) {
      const ad = Math.abs(a.amount - b.amount);
      const dd = dateDiffDays(a.postedAt, b.postedAt);
      if (ad > 1.0 || dd > 7) continue;
      const sim = trigramSimilarity(a.description, b.description);
      if (sim >= 0.6 && sim > best) { best = sim; bestB = b; }
    }
    if (bestB) {
      tryMatch(a.id, bestB.id, 'description', best,
        dateDiffDays(a.postedAt, bestB.postedAt),
        Math.abs(a.amount - bestB.amount));
    }
  }

  return matches;
}

export function runMatchingMultiSource(sources: TransactionSource[]): {
  matches: Match[];
  divergences: Divergence[];
} {
  const matches: Match[] = [];
  const usedIds = new Set<string>();

  // Match all pairs of sources
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const pairMatches = matchPair(
        sources[i].transactions,
        sources[j].transactions,
        usedIds,
        sources[i].id,
        sources[j].id,
      );
      matches.push(...pairMatches);
    }
  }

  // All unmatched transactions become divergences
  const divergences: Divergence[] = [];
  for (const source of sources) {
    for (const tx of source.transactions) {
      if (!usedIds.has(tx.id)) {
        divergences.push({
          id: crypto.randomUUID(),
          transactionId: tx.id,
          sourceId: source.id,
          resolution: 'pending',
        });
      }
    }
  }

  return { matches, divergences };
}
