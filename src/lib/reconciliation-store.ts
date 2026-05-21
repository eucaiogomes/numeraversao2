import type { OFXTransaction } from './ofx-parser';
import type { CSVTransaction } from './csv-parser';
import type { Match, Divergence } from './matching-engine';

export interface Reconciliation {
  id: string;
  prompt: string;
  periodStart: string;
  periodEnd: string;
  accountLabel: string;
  status: 'reviewing' | 'closed';
  fileAName: string;
  fileBName: string;
  totalA: number;
  totalB: number;
  matchedCount: number;
  divergenceCount: number;
  transactionsA: OFXTransaction[];
  transactionsB: CSVTransaction[];
  matches: Match[];
  divergences: Divergence[];
  createdAt: string;
}

// Module-level store — persists for the lifetime of the browser session
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
  const divergences = r.divergences.map((d) => (d.id === divergenceId ? { ...d, ...updates } : d));
  store.set(reconciliationId, { ...r, divergences });
}
