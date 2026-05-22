import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  ClipboardCheck,
  MinusCircle,
  RotateCcw,
  Save,
  ExternalLink,
  Banknote,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { BalanceReconciliationResult, BankingReviewItem } from '@/lib/banking/types';
import { updateBankingReviewItem } from '@/lib/banking/banking-reconciliation-store';

function fmtCurrency(value: number | undefined) {
  if (value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── KPI strip ──────────────────────────────────────────────────────────────

function KpiStrip({ results }: { results: BalanceReconciliationResult[] }) {
  const reconciled = results.filter((r) => r.status === 'reconciled').length;
  const divergent = results.filter((r) => r.status === 'divergent').length;
  const missing = results.filter(
    (r) => r.status === 'missing_statement' || r.status === 'missing_ledger',
  ).length;

  return (
    <div className="grid grid-cols-3 gap-1.5 md:gap-2 mb-4">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-center">
        <p className="text-[22px] font-bold text-emerald-700 leading-none">{reconciled}</p>
        <p className="text-[11px] text-emerald-600 mt-1">Conciliada(s)</p>
      </div>
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-center">
        <p className="text-[22px] font-bold text-amber-700 leading-none">{divergent}</p>
        <p className="text-[11px] text-amber-600 mt-1">Divergente(s)</p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-center">
        <p className="text-[22px] font-bold text-gray-600 leading-none">{missing}</p>
        <p className="text-[11px] text-gray-500 mt-1">Sem doc.</p>
      </div>
    </div>
  );
}

// ── Results list ───────────────────────────────────────────────────────────

function ResultRow({ result }: { result: BalanceReconciliationResult }) {
  const isReconciled = result.status === 'reconciled';
  const isDivergent = result.status === 'divergent';

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="mt-0.5 shrink-0">
        {isReconciled && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        {isDivergent && <AlertTriangle className="w-4 h-4 text-amber-500" />}
        {!isReconciled && !isDivergent && <FileWarning className="w-4 h-4 text-gray-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-[#0a2520]">
          {result.accountCode} — {result.accountName}
        </p>
        {result.periodStart && (
          <p className="text-[11.5px] text-gray-400 mt-0.5">
            {fmtDate(result.periodStart)} a {fmtDate(result.periodEnd)}
          </p>
        )}
        {isReconciled && (
          <p className="text-[11.5px] text-emerald-600 mt-0.5">
            Saldo {fmtDate(result.finalCheckpoint?.date)}: {fmtCurrency(result.finalCheckpoint?.statementBalance)} ✓
          </p>
        )}
        {isDivergent && (
          <p className="text-[11.5px] text-amber-700 mt-0.5">
            Último OK: {fmtDate(result.lastMatchedCheckpoint?.date)} · Diferença em {fmtDate(result.firstDivergentCheckpoint?.date)}: {fmtCurrency(result.difference)}
          </p>
        )}
        {result.status === 'missing_statement' && (
          <p className="text-[11.5px] text-gray-500 mt-0.5">Sem extrato correspondente</p>
        )}
        {result.status === 'missing_ledger' && (
          <p className="text-[11.5px] text-gray-500 mt-0.5">Conta não encontrada no Razão</p>
        )}
      </div>
    </div>
  );
}

// ── Review item card ───────────────────────────────────────────────────────

function ReviewCard({
  item,
  reconciliationId,
  onUpdate,
}: {
  item: BankingReviewItem;
  reconciliationId: string;
  onUpdate: (updated: BankingReviewItem) => void;
}) {
  const [note, setNote] = useState(item.note ?? '');
  const isCompleted = item.status === 'done' || item.status === 'approved';
  const isSuggested = item.kind === 'suggested_entry';

  async function handleUpdate(patch: Partial<Pick<BankingReviewItem, 'status' | 'note'>>) {
    const updated = await updateBankingReviewItem(reconciliationId, item.id, {
      ...patch,
      note: patch.note ?? note,
    });
    if (updated) {
      const found = updated.reviewItems.find((i) => i.id === item.id);
      if (found) onUpdate(found);
    }
  }

  const kindLabel: Record<BankingReviewItem['kind'], string> = {
    missing_statement: 'Extrato pendente',
    missing_ledger: 'Razão pendente',
    divergence_check: 'Divergência',
    suggested_entry: 'Lançamento sugerido',
    insufficient_data: 'Dados insuficientes',
  };

  const statusColor =
    isCompleted
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : item.status === 'ignored'
        ? 'bg-gray-50 text-gray-500 border-gray-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';

  const statusLabel = { open: 'Pendente', approved: 'Aprovado', done: 'Resolvido', ignored: 'Ignorado' };

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-2 flex-wrap mb-2 min-w-0">
        <p className="text-[12px] md:text-[12.5px] font-semibold text-[#0a2520] flex-1 min-w-0">{item.title}</p>
        <span className="text-[10.5px] px-2 py-0.5 rounded-full border border-teal-100 bg-teal-50 text-[#0d9488] shrink-0">
          {kindLabel[item.kind]}
        </span>
        <span className={`text-[10.5px] px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>
          {statusLabel[item.status]}
        </span>
      </div>
      <p className="text-[11.5px] text-gray-500 mb-2">{item.detail}</p>

      <div className="flex flex-col sm:flex-row gap-2 items-start">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação..."
          rows={1}
          className="w-full sm:flex-1 min-h-[32px] max-h-[80px] text-[11.5px] text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 resize-y outline-none focus:border-[#0d9488]/50 bg-white"
        />
        <div className="flex gap-1.5 shrink-0 self-end sm:self-start">
          <button
            onClick={() => handleUpdate({ note })}
            className="h-8 px-2 rounded-lg border border-gray-200 text-gray-500 text-[11px] flex items-center gap-1 hover:border-[#0d9488]/40 hover:text-[#0d9488] transition-colors"
          >
            <Save className="w-3 h-3" />
          </button>
          {isCompleted ? (
            <button
              onClick={() => handleUpdate({ status: 'open' })}
              className="h-8 px-2 rounded-lg bg-amber-50 text-amber-700 text-[11px] flex items-center gap-1 hover:bg-amber-100 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={() => handleUpdate({ status: isSuggested ? 'approved' : 'done' })}
              className="h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-medium flex items-center gap-1 hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              {isSuggested ? 'Aprovar' : 'Resolver'}
            </button>
          )}
          {item.status !== 'ignored' && (
            <button
              onClick={() => handleUpdate({ status: 'ignored' })}
              className="h-8 px-2 rounded-lg bg-gray-50 text-gray-500 text-[11px] flex items-center gap-1 hover:bg-gray-100 transition-colors"
            >
              <MinusCircle className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────

export function ChatDashboard({
  reconciliationId,
  results,
  initialReviewItems,
  competence,
}: {
  reconciliationId: string;
  results: BalanceReconciliationResult[];
  initialReviewItems: BankingReviewItem[];
  competence: string;
}) {
  const [reviewItems, setReviewItems] = useState(initialReviewItems);

  const open = reviewItems.filter((i) => i.status === 'open').length;

  function handleItemUpdate(updated: BankingReviewItem) {
    setReviewItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
  }

  return (
    <div className="flex items-start gap-2 md:gap-3 max-w-full md:max-w-[680px]">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0d9488] to-[#0a2520] flex items-center justify-center shrink-0 mt-0.5">
        <Banknote className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 min-w-0 bg-white border border-gray-200/80 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-3 md:px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-[#0a2520]">Conciliação bancária</p>
            <p className="text-[11.5px] text-gray-400 mt-0.5">Competência: {competence}</p>
          </div>
          <Link
            to="/conciliacao-bancaria/$id"
            params={{ id: reconciliationId }}
            className="flex items-center gap-1.5 text-[11.5px] text-[#0d9488] hover:underline shrink-0"
          >
            Ver completo
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="px-3 md:px-4 pt-4 pb-2">
          <KpiStrip results={results} />

          {/* Results */}
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Resultados por conta
            </p>
            {results.map((r, i) => (
              <ResultRow key={`${r.accountCode}-${r.periodStart ?? i}`} result={r} />
            ))}
          </div>

          {/* Review items */}
          {reviewItems.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Revisão operacional
                </p>
                {open > 0 && (
                  <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {open} pendente(s)
                  </span>
                )}
              </div>
              {reviewItems.map((item) => (
                <ReviewCard
                  key={item.id}
                  item={item}
                  reconciliationId={reconciliationId}
                  onUpdate={handleItemUpdate}
                />
              ))}
            </div>
          )}

          {reviewItems.length === 0 && (
            <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-[12px] text-emerald-700">Nenhuma pendência operacional.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
