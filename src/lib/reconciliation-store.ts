import type { TransactionSource, Match, Divergence } from './matching-engine';

export interface Reconciliation {
  id: string;
  prompt: string;
  status: 'reviewing' | 'closed';
  sources: TransactionSource[];
  matches: Match[];
  divergences: Divergence[];
  createdAt: string;
  closedAt?: string;
}

const store = new Map<string, Reconciliation>();

export function saveReconciliation(r: Reconciliation): void {
  store.set(r.id, r);
}

export function getReconciliation(id: string): Reconciliation | undefined {
  return store.get(id);
}

export function listReconciliations(): Reconciliation[] {
  return Array.from(store.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateReconciliation(id: string, updates: Partial<Reconciliation>): void {
  const r = store.get(id);
  if (!r) return;
  store.set(id, { ...r, ...updates });
}

export function updateDivergence(
  reconciliationId: string,
  divergenceId: string,
  updates: Partial<Divergence>,
): void {
  const r = store.get(reconciliationId);
  if (!r) return;
  store.set(reconciliationId, {
    ...r,
    divergences: r.divergences.map((d) => (d.id === divergenceId ? { ...d, ...updates } : d)),
  });
}

// Helpers
export function getTotalTransactions(r: Reconciliation): number {
  return r.sources.reduce((s, src) => s + src.transactions.length, 0);
}

export function getMatchRate(r: Reconciliation): number {
  const total = getTotalTransactions(r);
  if (total === 0) return 0;
  return Math.round((r.matches.length * 2 / total) * 100);
}

export function getPeriod(r: Reconciliation): { start: string; end: string } {
  const dates = r.sources.flatMap((s) => s.transactions.map((t) => t.postedAt)).sort();
  return { start: dates[0] ?? '', end: dates[dates.length - 1] ?? '' };
}
