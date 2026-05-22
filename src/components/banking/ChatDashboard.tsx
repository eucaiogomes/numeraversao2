import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  Clock,
  TrendingUp,
  Building2,
  Landmark,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save,
  MinusCircle,
  Banknote,
  ArrowRight,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { BalanceReconciliationResult, BankingReviewItem, SuggestedBankingEntry } from '@/lib/banking/types';
import { updateBankingReviewItem } from '@/lib/banking/banking-reconciliation-store';

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtCurrency(value: number | undefined) {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtCompetence(iso: string | undefined) {
  if (!iso) return '—';
  const [y, m] = iso.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]}/${y}`;
}

// ── Summary bar ────────────────────────────────────────────────────────────

function SummaryBar({ results }: { results: BalanceReconciliationResult[] }) {
  const reconciled = results.filter((r) => r.status === 'reconciled');
  const divergent = results.filter((r) => r.status === 'divergent');
  const missing = results.filter(
    (r) => r.status === 'missing_statement' || r.status === 'missing_ledger',
  );
  const investment = results.filter((r) => r.status === 'investment_statement_parsed');

  const totalDifference = divergent.reduce((s, r) => s + Math.abs(r.difference ?? 0), 0);
  const totalReconciled = reconciled.reduce(
    (s, r) => s + Math.abs(r.finalCheckpoint?.statementBalance ?? 0),
    0,
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Conciliadas</span>
        </div>
        <p className="text-[22px] font-bold text-emerald-700 leading-none">{reconciled.length}</p>
        {totalReconciled > 0 && (
          <p className="text-[10px] text-emerald-500 mt-1 truncate">{fmtCurrency(totalReconciled)}</p>
        )}
      </div>

      <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Divergentes</span>
        </div>
        <p className="text-[22px] font-bold text-amber-700 leading-none">{divergent.length}</p>
        {totalDifference > 0 && (
          <p className="text-[10px] text-amber-500 mt-1 truncate">{fmtCurrency(totalDifference)}</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <FileWarning className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sem doc.</span>
        </div>
        <p className="text-[22px] font-bold text-gray-600 leading-none">{missing.length}</p>
        <p className="text-[10px] text-gray-400 mt-1">conta(s)</p>
      </div>

      <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-teal-500" />
          <span className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide">Aplicações</span>
        </div>
        <p className="text-[22px] font-bold text-teal-700 leading-none">{investment.length}</p>
        <p className="text-[10px] text-teal-500 mt-1">lidas</p>
      </div>
    </div>
  );
}

// ── Account icon ───────────────────────────────────────────────────────────

function AccountIcon({ kind }: { kind: string }) {
  if (kind === 'cash_investment')
    return (
      <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
        <TrendingUp className="w-4 h-4 text-teal-600" />
      </div>
    );
  return (
    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
      <Landmark className="w-4 h-4 text-blue-600" />
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BalanceReconciliationResult['status'] }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    reconciled: {
      label: 'Conciliada',
      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    divergent: {
      label: 'Divergente',
      cls: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    missing_statement: {
      label: 'Sem extrato',
      cls: 'bg-gray-100 text-gray-500 border-gray-200',
      icon: <FileWarning className="w-3 h-3" />,
    },
    missing_ledger: {
      label: 'Sem razão',
      cls: 'bg-gray-100 text-gray-500 border-gray-200',
      icon: <FileWarning className="w-3 h-3" />,
    },
    investment_statement_parsed: {
      label: 'Aplicação lida',
      cls: 'bg-teal-100 text-teal-700 border-teal-200',
      icon: <TrendingUp className="w-3 h-3" />,
    },
    insufficient_data: {
      label: 'Dados insuf.',
      cls: 'bg-gray-100 text-gray-400 border-gray-200',
      icon: <Clock className="w-3 h-3" />,
    },
  };
  const s = map[status] ?? map.insufficient_data;
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

// ── Balance comparison row ─────────────────────────────────────────────────

function BalanceRow({ label, value, highlight }: { label: string; value: string; highlight?: 'ok' | 'err' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-400">{label}</span>
      <span className={`text-[11.5px] font-semibold tabular-nums ${
        highlight === 'ok' ? 'text-emerald-600' :
        highlight === 'err' ? 'text-amber-700' :
        'text-[#0a2520]'
      }`}>{value}</span>
    </div>
  );
}

// ── Suggested entry chip ───────────────────────────────────────────────────

function SuggestedEntryChip({ entry }: { entry: SuggestedBankingEntry }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-teal-50 border border-teal-100 px-2.5 py-2 mt-2">
      <Sparkles className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-teal-800 leading-tight">{entry.history}</p>
        <p className="text-[10.5px] text-teal-600 mt-0.5">
          {fmtDate(entry.date)} · {fmtCurrency(entry.amount)}
        </p>
        <p className="text-[10px] text-teal-500 mt-0.5 flex items-center gap-1">
          <span>{entry.debitAccountName}</span>
          <ArrowRight className="w-2.5 h-2.5" />
          <span>{entry.creditAccountName}</span>
        </p>
      </div>
    </div>
  );
}

// ── Account result card ────────────────────────────────────────────────────

function AccountCard({ result }: { result: BalanceReconciliationResult }) {
  const [expanded, setExpanded] = useState(result.status === 'divergent');
  const isDivergent = result.status === 'divergent';
  const isReconciled = result.status === 'reconciled';
  const hasSuggested = (result.suggestedEntries?.length ?? 0) > 0;
  const hasDetails =
    isDivergent ||
    hasSuggested ||
    result.status === 'investment_statement_parsed';

  const period = result.periodStart
    ? `${fmtDate(result.periodStart)} – ${fmtDate(result.periodEnd)}`
    : null;

  return (
    <div className={`rounded-xl border ${isDivergent ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-white'} overflow-hidden`}>
      {/* Header row */}
      <div
        className={`flex items-center gap-2.5 px-3 py-2.5 ${hasDetails ? 'cursor-pointer hover:bg-gray-50/80' : ''}`}
        onClick={() => hasDetails && setExpanded((e) => !e)}
      >
        <AccountIcon kind={result.accountKind} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[12.5px] font-semibold text-[#0a2520] truncate">
              {result.accountCode} — {result.accountName}
            </p>
            <StatusBadge status={result.status} />
          </div>
          {period && (
            <p className="text-[11px] text-gray-400 mt-0.5">{period}</p>
          )}
        </div>

        {/* Quick balance */}
        {result.finalCheckpoint && (
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-[12px] font-bold text-[#0a2520] tabular-nums">
              {fmtCurrency(result.finalCheckpoint.statementBalance)}
            </p>
            <p className="text-[10px] text-gray-400">extrato {fmtDate(result.finalCheckpoint.date)}</p>
          </div>
        )}

        {hasDetails && (
          <button className="shrink-0 text-gray-400 ml-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2.5 space-y-2.5">
          {/* Balance comparison for reconciled/divergent */}
          {result.finalCheckpoint && (
            <div className="rounded-lg bg-white border border-gray-100 p-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Saldo final · {fmtDate(result.finalCheckpoint.date)}
              </p>
              <BalanceRow
                label="Extrato bancário"
                value={fmtCurrency(result.finalCheckpoint.statementBalance)}
                highlight={isReconciled ? 'ok' : undefined}
              />
              {result.finalCheckpoint.ledgerBalance !== undefined && (
                <BalanceRow
                  label="Razão contábil"
                  value={fmtCurrency(result.finalCheckpoint.ledgerBalance)}
                  highlight={isReconciled ? 'ok' : undefined}
                />
              )}
              {isDivergent && result.difference !== undefined && (
                <>
                  <div className="border-t border-amber-100 pt-1.5 mt-1">
                    <BalanceRow
                      label="Diferença"
                      value={fmtCurrency(Math.abs(result.difference))}
                      highlight="err"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Divergence timeline */}
          {isDivergent && (result.lastMatchedCheckpoint || result.firstDivergentCheckpoint) && (
            <div className="rounded-lg bg-white border border-amber-100 p-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Linha do tempo
              </p>
              {result.lastMatchedCheckpoint && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[11px] text-gray-500">
                    Último OK: {fmtDate(result.lastMatchedCheckpoint.date)} · {fmtCurrency(result.lastMatchedCheckpoint.statementBalance)}
                  </span>
                </div>
              )}
              {result.firstDivergentCheckpoint && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[11px] text-amber-700">
                    1ª divergência: {fmtDate(result.firstDivergentCheckpoint.date)} · diferença {fmtCurrency(result.firstDivergentCheckpoint.difference)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Entries on divergence date */}
          {isDivergent && (result.ledgerEntriesOnDivergenceDate.length > 0 || result.statementEntriesOnDivergenceDate.length > 0) && (
            <div className="space-y-1.5">
              {result.statementEntriesOnDivergenceDate.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Extrato na data
                  </p>
                  {result.statementEntriesOnDivergenceDate.slice(0, 3).map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-[11px] text-gray-500 truncate flex-1">{e.description}</span>
                      <span className={`text-[11px] font-medium tabular-nums shrink-0 ${e.amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {fmtCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {result.ledgerEntriesOnDivergenceDate.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Razão na data
                  </p>
                  {result.ledgerEntriesOnDivergenceDate.slice(0, 3).map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-[11px] text-gray-500 truncate flex-1">{e.history}</span>
                      <span className={`text-[11px] font-medium tabular-nums shrink-0 ${e.amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {fmtCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggested entries */}
          {hasSuggested && (
            <div>
              <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Lançamentos sugeridos
              </p>
              {result.suggestedEntries!.map((e) => (
                <SuggestedEntryChip key={e.id} entry={e} />
              ))}
            </div>
          )}
        </div>
      )}
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

  const kindColor: Record<BankingReviewItem['kind'], string> = {
    missing_statement: 'bg-gray-50 text-gray-500 border-gray-200',
    missing_ledger: 'bg-gray-50 text-gray-500 border-gray-200',
    divergence_check: 'bg-amber-50 text-amber-700 border-amber-200',
    suggested_entry: 'bg-teal-50 text-teal-700 border-teal-100',
    insufficient_data: 'bg-gray-50 text-gray-400 border-gray-200',
  };

  const statusColor = isCompleted
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : item.status === 'ignored'
      ? 'bg-gray-50 text-gray-400 border-gray-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';

  const statusLabel = { open: 'Pendente', approved: 'Aprovado', done: 'Resolvido', ignored: 'Ignorado' };

  return (
    <div className={`rounded-xl border p-3 ${isCompleted ? 'border-emerald-100 bg-emerald-50/20' : item.status === 'ignored' ? 'border-gray-100 bg-gray-50/50 opacity-60' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start gap-2 flex-wrap mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#0a2520] leading-snug">{item.title}</p>
          {item.amount !== undefined && (
            <p className="text-[11.5px] font-bold text-[#0d9488] mt-0.5">{fmtCurrency(item.amount)}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${kindColor[item.kind]}`}>
            {kindLabel[item.kind]}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusColor}`}>
            {statusLabel[item.status]}
          </span>
        </div>
      </div>

      <p className="text-[11.5px] text-gray-500 mb-2.5 leading-relaxed">{item.detail}</p>

      {item.dueDate && (
        <p className="text-[10.5px] text-gray-400 mb-2 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Vencimento: {fmtDate(item.dueDate)}
        </p>
      )}

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
            title="Salvar observação"
            className="h-8 px-2 rounded-lg border border-gray-200 text-gray-500 text-[11px] flex items-center gap-1 hover:border-[#0d9488]/40 hover:text-[#0d9488] transition-colors"
          >
            <Save className="w-3 h-3" />
          </button>
          {isCompleted ? (
            <button
              onClick={() => handleUpdate({ status: 'open' })}
              title="Reabrir"
              className="h-8 px-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[11px] flex items-center gap-1 hover:bg-amber-100 transition-colors"
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
              title="Ignorar"
              className="h-8 px-2 rounded-lg bg-gray-50 text-gray-400 border border-gray-200 text-[11px] flex items-center gap-1 hover:bg-gray-100 transition-colors"
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
  const done = reviewItems.filter((i) => i.status === 'done' || i.status === 'approved').length;
  const progress = reviewItems.length > 0 ? Math.round((done / reviewItems.length) * 100) : 100;

  function handleItemUpdate(updated: BankingReviewItem) {
    setReviewItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
  }

  return (
    <div className="flex items-start gap-2 md:gap-3 max-w-full md:max-w-[700px]">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0d9488] to-[#0a2520] flex items-center justify-center shrink-0 mt-0.5">
        <Banknote className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 min-w-0 bg-white border border-gray-200/80 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-[#0a2520] to-[#0d3530]">
          <div>
            <p className="text-[14px] font-semibold text-white">Conciliação bancária</p>
            <p className="text-[11px] text-white/50 mt-0.5">
              Competência: {fmtCompetence(competence + '-01')}
            </p>
          </div>
          <Link
            to="/conciliacao-bancaria/$id"
            params={{ id: reconciliationId }}
            className="flex items-center gap-1.5 text-[11.5px] text-white/70 hover:text-white transition-colors shrink-0"
          >
            Ver completo
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="px-3 md:px-4 pt-4 pb-3">
          {/* Summary bar */}
          <SummaryBar results={results} />

          {/* Progress bar */}
          {reviewItems.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Progresso da revisão
                </p>
                <span className="text-[11px] text-gray-500">{done}/{reviewItems.length} resolvidos</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0d9488] to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Account cards */}
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Contas analisadas
            </p>
            <div className="space-y-2">
              {results.map((r, i) => (
                <AccountCard key={`${r.accountCode}-${i}`} result={r} />
              ))}
            </div>
          </div>

          {/* Review items */}
          {reviewItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Itens de revisão
                </p>
                {open > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {open} pendente{open > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {reviewItems.map((item) => (
                  <ReviewCard
                    key={item.id}
                    item={item}
                    reconciliationId={reconciliationId}
                    onUpdate={handleItemUpdate}
                  />
                ))}
              </div>
            </div>
          )}

          {reviewItems.length === 0 && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-[12px] text-emerald-700">Nenhuma pendência operacional.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
