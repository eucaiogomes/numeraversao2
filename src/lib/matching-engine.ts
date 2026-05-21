import type { OFXTransaction } from './ofx-parser';
import type { CSVTransaction } from './csv-parser';

export interface Match {
  id: string;
  transactionAId: string;
  transactionBId: string;
  matchType: 'exact' | 'fuzzy_date' | 'fuzzy_amount' | 'description';
  confidence: number;
  dateDiffDays: number;
  amountDiff: number;
  userConfirmed: boolean;
}

export interface Divergence {
  id: string;
  side: 'a_only' | 'b_only';
  transactionAId?: string;
  transactionBId?: string;
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
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  return ta.size + tb.size === 0 ? 0 : (2 * intersection) / (ta.size + tb.size);
}

export function runMatching(
  txsA: OFXTransaction[],
  txsB: CSVTransaction[],
): { matches: Match[]; divergences: Divergence[] } {
  const matches: Match[] = [];
  const usedA = new Set<string>();
  const usedB = new Set<string>();

  function tryMatch(
    aId: string,
    bId: string,
    type: Match['matchType'],
    confidence: number,
    diffDays: number,
    diffAmount: number,
  ) {
    if (usedA.has(aId) || usedB.has(bId)) return;
    usedA.add(aId);
    usedB.add(bId);
    matches.push({
      id: crypto.randomUUID(),
      transactionAId: aId,
      transactionBId: bId,
      matchType: type,
      confidence,
      dateDiffDays: diffDays,
      amountDiff: diffAmount,
      userConfirmed: false,
    });
  }

  // Layer 1: Exact — same date + same amount
  for (const a of txsA) {
    for (const b of txsB) {
      if (usedA.has(a.id) || usedB.has(b.id)) continue;
      if (a.postedAt === b.postedAt && a.amount === b.amount) {
        tryMatch(a.id, b.id, 'exact', 1.0, 0, 0);
        break;
      }
    }
  }

  // Layer 2a: same amount + date diff ≤ 3 days
  for (const a of txsA) {
    if (usedA.has(a.id)) continue;
    for (const b of txsB) {
      if (usedB.has(b.id)) continue;
      const dd = dateDiffDays(a.postedAt, b.postedAt);
      if (a.amount === b.amount && dd <= 3) {
        tryMatch(a.id, b.id, 'fuzzy_date', 0.85, dd, 0);
        break;
      }
    }
  }

  // Layer 2b: same date + amount diff ≤ 0.01
  for (const a of txsA) {
    if (usedA.has(a.id)) continue;
    for (const b of txsB) {
      if (usedB.has(b.id)) continue;
      const ad = Math.abs(a.amount - b.amount);
      if (a.postedAt === b.postedAt && ad <= 0.01) {
        tryMatch(a.id, b.id, 'fuzzy_amount', 0.85, 0, ad);
        break;
      }
    }
  }

  // Layer 3: Description similarity ≥ 0.6 + amount diff ≤ 1.00 + date diff ≤ 7 days
  for (const a of txsA) {
    if (usedA.has(a.id)) continue;
    let bestScore = 0;
    let bestB: CSVTransaction | null = null;

    for (const b of txsB) {
      if (usedB.has(b.id)) continue;
      const ad = Math.abs(a.amount - b.amount);
      const dd = dateDiffDays(a.postedAt, b.postedAt);
      if (ad > 1.0 || dd > 7) continue;
      const sim = trigramSimilarity(a.description, b.description);
      if (sim >= 0.6 && sim > bestScore) {
        bestScore = sim;
        bestB = b;
      }
    }

    if (bestB) {
      tryMatch(
        a.id,
        bestB.id,
        'description',
        bestScore,
        dateDiffDays(a.postedAt, bestB.postedAt),
        Math.abs(a.amount - bestB.amount),
      );
    }
  }

  // Divergences: unmatched transactions
  const divergences: Divergence[] = [];

  for (const a of txsA) {
    if (!usedA.has(a.id)) {
      divergences.push({
        id: crypto.randomUUID(),
        side: 'a_only',
        transactionAId: a.id,
        resolution: 'pending',
      });
    }
  }

  for (const b of txsB) {
    if (!usedB.has(b.id)) {
      divergences.push({
        id: crypto.randomUUID(),
        side: 'b_only',
        transactionBId: b.id,
        resolution: 'pending',
      });
    }
  }

  return { matches, divergences };
}
