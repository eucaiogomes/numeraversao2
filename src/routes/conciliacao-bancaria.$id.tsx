import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  TrendingUp,
  Landmark,
  Building2,
  FileText,
  Sparkles,
  ArrowRight,
  Save,
  RotateCcw,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Calendar,
  Files,
  BadgeCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import {
  fetchBankingReconciliation,
  getBankingReconciliation,
  updateBankingReviewItem,
} from '@/lib/banking/banking-reconciliation-store';
import type { BankingReconciliationCase } from '@/lib/banking/banking-reconciliation-store';
import type {
  BalanceReconciliationResult,
  BankingReviewItem,
  SuggestedBankingEntry,
  ViacrediInvestmentStatement,
} from '@/lib/banking/types';

export const Route = createFileRoute('/conciliacao-bancaria/$id')({
  component: BankingReconciliationPage,
});

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtCurrency(v: number | undefined) {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso: string | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtMonth(ym: string | undefined) {
  if (!ym) return '—';
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const [y, m] = ym.split('-');
  return `${months[parseInt(m, 10) - 1]} de ${y}`;
}
function fmtDateTime(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Derive client name from statements ─────────────────────────────────────

function deriveClientName(rec: BankingReconciliationCase): string | null {
  for (const inv of rec.investmentStatements ?? []) {
    // investmentStatements don't have customerName in current type
    void inv;
  }
  // Try to extract from file names heuristically
  const names = [rec.fileNames.trialBalance, rec.fileNames.ledger, ...rec.fileNames.statements];
  for (const name of names) {
    const cleaned = name.replace(/\.(pdf|xls|xlsx)$/i, '').replace(/[-_]/g, ' ').trim();
    if (cleaned.length > 4 && cleaned.length < 60) return cleaned;
  }
  return null;
}

// ── KPI strip ───────────────────────────────────────────────────────────────

function KpiStrip({ results, reviewItems }: { results: BalanceReconciliationResult[]; reviewItems: BankingReviewItem[] }) {
  const reconciled = results.filter((r) => r.status === 'reconciled');
  const divergent = results.filter((r) => r.status === 'divergent');
  const missing = results.filter((r) => r.status === 'missing_statement' || r.status === 'missing_ledger');
  const open = reviewItems.filter((i) => i.status === 'open').length;

  const totalBalance = reconciled.reduce((s, r) => s + Math.abs(r.finalCheckpoint?.statementBalance ?? 0), 0);
  const totalDiff = divergent.reduce((s, r) => s + Math.abs(r.difference ?? 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <KpiCard
        icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        label="Conciliadas"
        value={String(reconciled.length)}
        sub={totalBalance > 0 ? fmtCurrency(totalBalance) : undefined}
        color="emerald"
      />
      <KpiCard
        icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        label="Divergentes"
        value={String(divergent.length)}
        sub={totalDiff > 0 ? `Δ ${fmtCurrency(totalDiff)}` : undefined}
        color="amber"
      />
      <KpiCard
        icon={<FileWarning className="w-5 h-5 text-gray-400" />}
        label="Sem documento"
        value={String(missing.length)}
        sub="conta(s)"
        color="gray"
      />
      <KpiCard
        icon={<Clock className="w-5 h-5 text-rose-400" />}
        label="Revisão pendente"
        value={String(open)}
        sub="item(ns) aberto(s)"
        color={open > 0 ? 'rose' : 'gray'}
      />
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: 'emerald' | 'amber' | 'gray' | 'rose';
}) {
  const bg = { emerald: 'from-emerald-50', amber: 'from-amber-50', gray: 'from-gray-50', rose: 'from-rose-50' }[color];
  const border = { emerald: 'border-emerald-100', amber: 'border-amber-100', gray: 'border-gray-100', rose: 'border-rose-100' }[color];
  const text = { emerald: 'text-emerald-700', amber: 'text-amber-700', gray: 'text-gray-600', rose: 'text-rose-600' }[color];
  return (
    <div className={`rounded-xl border ${border} bg-gradient-to-br ${bg} to-white p-3 sm:p-4`}>
      <div className="flex items-center gap-1.5 sm:gap-2 mb-2">{icon}<span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide leading-tight">{label}</span></div>
      <p className={`text-2xl sm:text-3xl font-bold leading-none ${text}`}>{value}</p>
      {sub && <p className={`text-[10px] sm:text-[11px] mt-1.5 ${text} opacity-70 truncate`}>{sub}</p>}
    </div>
  );
}

// ── Account card ────────────────────────────────────────────────────────────

function AccountCard({ result }: { result: BalanceReconciliationResult }) {
  const [open, setOpen] = useState(result.status === 'divergent');
  const isDivergent = result.status === 'divergent';
  const isReconciled = result.status === 'reconciled';
  const hasSuggested = (result.suggestedEntries?.length ?? 0) > 0;
  const hasDetail = isDivergent || hasSuggested || result.status === 'investment_statement_parsed';

  const statusMap: Record<BalanceReconciliationResult['status'], { label: string; cls: string; icon: React.ReactNode }> = {
    reconciled:                  { label: 'Conciliada',      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    divergent:                   { label: 'Divergente',      cls: 'bg-amber-100 text-amber-700 border-amber-200',       icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    missing_statement:           { label: 'Sem extrato',     cls: 'bg-gray-100 text-gray-500 border-gray-200',          icon: <FileWarning className="w-3.5 h-3.5" /> },
    missing_ledger:              { label: 'Sem razão',       cls: 'bg-red-100 text-red-600 border-red-200',             icon: <FileWarning className="w-3.5 h-3.5" /> },
    investment_statement_parsed: { label: 'Aplicação lida', cls: 'bg-teal-100 text-teal-700 border-teal-200',          icon: <TrendingUp className="w-3.5 h-3.5" /> },
    insufficient_data:           { label: 'Dados insuf.',   cls: 'bg-gray-100 text-gray-400 border-gray-200',          icon: <Clock className="w-3.5 h-3.5" /> },
  };
  const s = statusMap[result.status];
  const period = result.periodStart ? `${fmtDate(result.periodStart)} – ${fmtDate(result.periodEnd)}` : null;

  return (
    <div className={`rounded-xl border overflow-hidden ${isDivergent ? 'border-amber-200' : 'border-gray-100'} bg-white`}>
      {/* Row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${hasDetail ? 'cursor-pointer hover:bg-gray-50/60' : ''}`}
        onClick={() => hasDetail && setOpen((o) => !o)}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${result.accountKind === 'cash_investment' ? 'bg-teal-100' : 'bg-blue-100'}`}>
          {result.accountKind === 'cash_investment'
            ? <TrendingUp className="w-4.5 h-4.5 text-teal-600" />
            : <Landmark className="w-4 h-4 text-blue-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-semibold text-[#0a2520]">{result.accountCode} — {result.accountName}</p>
            <span className={`inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>
              {s.icon}{s.label}
            </span>
          </div>
          {period && <p className="text-[11.5px] text-gray-400 mt-0.5">{period}</p>}
        </div>
        {result.finalCheckpoint && (
          <div className="text-right shrink-0">
            <p className="text-[12px] sm:text-[13px] font-bold text-[#0a2520] tabular-nums">{fmtCurrency(result.finalCheckpoint.statementBalance)}</p>
            <p className="text-[10px] sm:text-[10.5px] text-gray-400">extrato {fmtDate(result.finalCheckpoint.date)}</p>
          </div>
        )}
        {hasDetail && <span className="text-gray-300 ml-1 shrink-0">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>}
      </div>

      {/* Detail */}
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-3">
          {/* Balance comparison */}
          {result.finalCheckpoint && (
            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Saldo final · {fmtDate(result.finalCheckpoint.date)}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-lg p-2.5 border ${isReconciled ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'}`}>
                  <p className="text-[10px] text-gray-400 mb-0.5">Extrato bancário</p>
                  <p className={`text-[14px] font-bold tabular-nums ${isReconciled ? 'text-emerald-700' : 'text-[#0a2520]'}`}>{fmtCurrency(result.finalCheckpoint.statementBalance)}</p>
                </div>
                {result.finalCheckpoint.ledgerBalance !== undefined && (
                  <div className={`rounded-lg p-2.5 border ${isReconciled ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                    <p className="text-[10px] text-gray-400 mb-0.5">Razão contábil</p>
                    <p className={`text-[14px] font-bold tabular-nums ${isReconciled ? 'text-emerald-700' : 'text-amber-700'}`}>{fmtCurrency(result.finalCheckpoint.ledgerBalance)}</p>
                  </div>
                )}
              </div>
              {isDivergent && result.difference !== undefined && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-100 border border-amber-200 px-3 py-2">
                  <span className="text-[11.5px] font-semibold text-amber-800">Diferença</span>
                  <span className="text-[14px] font-bold text-amber-800 tabular-nums">{fmtCurrency(Math.abs(result.difference))}</span>
                </div>
              )}
            </div>
          )}

          {/* Divergence timeline */}
          {isDivergent && (result.lastMatchedCheckpoint || result.firstDivergentCheckpoint) && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
              <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Linha do tempo</p>
              <div className="space-y-2">
                {result.lastMatchedCheckpoint && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
                    <div>
                      <p className="text-[11.5px] font-medium text-gray-600">Último OK: {fmtDate(result.lastMatchedCheckpoint.date)}</p>
                      <p className="text-[11px] text-gray-400">{fmtCurrency(result.lastMatchedCheckpoint.statementBalance)} (extrato = razão)</p>
                    </div>
                  </div>
                )}
                {result.firstDivergentCheckpoint && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                    <div>
                      <p className="text-[11.5px] font-medium text-amber-700">1ª divergência: {fmtDate(result.firstDivergentCheckpoint.date)}</p>
                      <p className="text-[11px] text-amber-600">Diferença de {fmtCurrency(Math.abs(result.firstDivergentCheckpoint.difference ?? 0))}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Entries on divergence date */}
          {isDivergent && (result.statementEntriesOnDivergenceDate.length > 0 || result.ledgerEntriesOnDivergenceDate.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {result.statementEntriesOnDivergenceDate.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> Extrato na data
                  </p>
                  <div className="space-y-1.5">
                    {result.statementEntriesOnDivergenceDate.slice(0, 5).map((e, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-500 truncate flex-1">{e.description}</span>
                        <span className={`text-[11.5px] font-semibold tabular-nums shrink-0 ${e.amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmtCurrency(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.ledgerEntriesOnDivergenceDate.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Razão na data
                  </p>
                  <div className="space-y-1.5">
                    {result.ledgerEntriesOnDivergenceDate.slice(0, 5).map((e, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-500 truncate flex-1">{e.history}</span>
                        <span className={`text-[11.5px] font-semibold tabular-nums shrink-0 ${e.amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmtCurrency(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggested entries */}
          {hasSuggested && (
            <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3">
              <p className="text-[10.5px] font-semibold text-teal-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Lançamentos sugeridos
              </p>
              <div className="space-y-2">
                {result.suggestedEntries!.map((e) => (
                  <SuggestedEntryRow key={e.id} entry={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestedEntryRow({ entry }: { entry: SuggestedBankingEntry }) {
  return (
    <div className="flex items-start gap-2 bg-white rounded-lg border border-teal-100 px-3 py-2">
      <Sparkles className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-teal-800">{entry.history}</p>
        <p className="text-[11px] text-teal-600 mt-0.5 flex items-center gap-1 flex-wrap">
          <span className="truncate max-w-[120px] sm:max-w-none">{entry.debitAccountName}</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[120px] sm:max-w-none">{entry.creditAccountName}</span>
        </p>
        <p className="text-[10.5px] text-gray-400 mt-0.5">{fmtDate(entry.date)} · {entry.sourceDescription}</p>
      </div>
      <span className="text-[12.5px] font-bold text-teal-700 tabular-nums shrink-0">{fmtCurrency(entry.amount)}</span>
    </div>
  );
}

// ── Review item card ────────────────────────────────────────────────────────

function ReviewCard({
  item,
  reconciliationId,
  onUpdate,
}: {
  item: BankingReviewItem;
  reconciliationId: string;
  onUpdate: (id: string, patch: Partial<Pick<BankingReviewItem, 'status' | 'note'>>) => Promise<void>;
}) {
  const [note, setNote] = useState(item.note ?? '');
  const isCompleted = item.status === 'done' || item.status === 'approved';
  const isSuggested = item.kind === 'suggested_entry';

  const kindLabel: Record<BankingReviewItem['kind'], string> = {
    missing_statement: 'Extrato pendente',
    missing_ledger: 'Razão pendente',
    divergence_check: 'Divergência',
    suggested_entry: 'Lançamento sugerido',
    insufficient_data: 'Dados insuficientes',
  };
  const kindCls: Record<BankingReviewItem['kind'], string> = {
    missing_statement: 'bg-gray-50 text-gray-500 border-gray-200',
    missing_ledger: 'bg-red-50 text-red-600 border-red-200',
    divergence_check: 'bg-amber-50 text-amber-700 border-amber-200',
    suggested_entry: 'bg-teal-50 text-teal-700 border-teal-100',
    insufficient_data: 'bg-gray-50 text-gray-400 border-gray-200',
  };
  const statusCls = isCompleted
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : item.status === 'ignored'
      ? 'bg-gray-50 text-gray-400 border-gray-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';
  const statusLabel = { open: 'Pendente', approved: 'Aprovado', done: 'Resolvido', ignored: 'Ignorado' }[item.status];

  return (
    <div className={`rounded-xl border p-3.5 transition-opacity ${item.status === 'ignored' ? 'opacity-50 border-gray-100 bg-gray-50/50' : isCompleted ? 'border-emerald-100 bg-emerald-50/20' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start gap-2 mb-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#0a2520] leading-snug">{item.title}</p>
          {item.amount !== undefined && (
            <p className="text-[12px] font-bold text-[#0d9488] mt-0.5">{fmtCurrency(item.amount)}</p>
          )}
        </div>
        <div className="flex gap-1 flex-wrap shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${kindCls[item.kind]}`}>{kindLabel[item.kind]}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusCls}`}>{statusLabel}</span>
        </div>
      </div>
      <p className="text-[12px] text-gray-500 mb-2.5 leading-relaxed">{item.detail}</p>
      {item.dueDate && (
        <p className="text-[11px] text-gray-400 mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Vencimento: {fmtDate(item.dueDate)}</p>
      )}
      {item.updatedAt && (
        <p className="text-[11px] text-gray-300 mb-2">Atualizado em {fmtDateTime(item.updatedAt)}</p>
      )}
      <div className="flex flex-col gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação..."
          rows={1}
          className="w-full min-h-[32px] max-h-[72px] text-[12px] text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 resize-y outline-none focus:border-[#0d9488]/50 bg-white"
        />
        <div className="flex gap-1.5">
          <button onClick={() => onUpdate(item.id, { note })} title="Salvar" className="h-8 px-2 rounded-lg border border-gray-200 text-gray-400 hover:text-[#0d9488] hover:border-[#0d9488]/40 transition-colors flex items-center">
            <Save className="w-3.5 h-3.5" />
          </button>
          {isCompleted ? (
            <button onClick={() => onUpdate(item.id, { status: 'open' })} className="h-8 px-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors flex items-center">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={() => onUpdate(item.id, { status: isSuggested ? 'approved' : 'done', note })} className="h-8 flex-1 sm:flex-none px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSuggested ? 'Aprovar' : 'Resolver'}
            </button>
          )}
          {item.status !== 'ignored' && (
            <button onClick={() => onUpdate(item.id, { status: 'ignored' })} title="Ignorar" className="h-8 px-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 hover:bg-gray-100 transition-colors flex items-center">
              <MinusCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Investment section ──────────────────────────────────────────────────────

function InvestmentSection({ statements }: { statements: ViacrediInvestmentStatement[] }) {
  if (!statements?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-teal-50/40 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-teal-600" />
        <p className="text-[13px] font-semibold text-[#0a2520]">Aplicações Programadas</p>
        <span className="ml-auto text-[11px] text-teal-600 bg-teal-100 rounded-full px-2 py-0.5">{statements.length} extrato(s)</span>
      </div>
      <div className="divide-y divide-gray-50">
        {statements.map((s, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[12.5px] font-semibold text-[#0a2520]">{s.productName?.replace('_', ' ') ?? 'Aplicação'}</p>
                {s.contractNumber && <p className="text-[11px] text-gray-400">Contrato {s.contractNumber}</p>}
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-teal-700 tabular-nums">{fmtCurrency(s.finalBalance)}</p>
                <p className="text-[10.5px] text-gray-400">{fmtDate(s.periodEnd)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] text-gray-400">Saldo inicial</p>
                <p className="text-[12px] font-semibold text-gray-700 tabular-nums">{fmtCurrency(s.openingBalance)}</p>
              </div>
              <div className="rounded-lg bg-teal-50 p-2">
                <p className="text-[10px] text-teal-500">Rendimentos</p>
                <p className="text-[12px] font-semibold text-teal-700 tabular-nums">{fmtCurrency(s.monthlyIncomeProvisions?.reduce((a, e) => a + e.amount, 0))}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-[10px] text-gray-400">IR</p>
                <p className="text-[12px] font-semibold text-gray-700 tabular-nums">{fmtCurrency(s.incomeTaxDebits?.reduce((a, e) => a + Math.abs(e.amount), 0))}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function BankingReconciliationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [reconciliation, setReconciliation] = useState<BankingReconciliationCase | undefined>(
    () => getBankingReconciliation(id),
  );
  const [loading, setLoading] = useState(!reconciliation);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBankingReconciliation(id)
      .then((c) => { if (active) setReconciliation(c); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading && !reconciliation) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto mt-20 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#0d9488] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[14px] text-gray-500">Carregando conciliação...</p>
        </div>
      </AppLayout>
    );
  }

  if (!reconciliation) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-20 text-center">
          <FileWarning className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h1 className="text-[16px] font-semibold text-[#0a2520]">Conciliação não encontrada</h1>
          <p className="text-[13px] text-gray-400 mt-1 mb-5">O resultado fica salvo apenas nesta sessão por enquanto.</p>
          <button
            onClick={() => navigate({ to: '/conciliacao-bancaria' })}
            className="h-9 px-5 rounded-lg bg-[#0a2520] text-white text-[13px] font-medium hover:bg-[#0d3530] transition-colors"
          >
            Nova conciliação
          </button>
        </div>
      </AppLayout>
    );
  }

  const clientName = deriveClientName(reconciliation);
  const open = reconciliation.reviewItems.filter((i) => i.status === 'open').length;
  const done = reconciliation.reviewItems.filter((i) => i.status === 'done' || i.status === 'approved').length;
  const progress = reconciliation.reviewItems.length > 0
    ? Math.round((done / reconciliation.reviewItems.length) * 100)
    : 100;

  async function handleReviewItemUpdate(
    itemId: string,
    patch: Partial<Pick<BankingReviewItem, 'status' | 'note'>>,
  ) {
    const updated = await updateBankingReviewItem(reconciliation!.id, itemId, patch);
    if (updated) setReconciliation(updated);
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto pb-10">

        {/* ── Hero header ── */}
        <div className="rounded-2xl bg-gradient-to-br from-[#0a2520] via-[#0d3530] to-[#0a2520] p-4 sm:p-5 md:p-7 mb-5 sm:mb-6 shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #5fd9be 0%, transparent 60%)' }} />
          <div className="relative">
            <button
              onClick={() => navigate({ to: '/conciliacao-bancaria' })}
              className="flex items-center gap-1.5 text-white/50 hover:text-white text-[12px] mb-4 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o chat
            </button>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10.5px] font-semibold text-[#5fd9be] uppercase tracking-wider bg-[#5fd9be]/10 border border-[#5fd9be]/20 px-2 py-0.5 rounded-full">
                    Conciliação Bancária
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
                  {fmtMonth(reconciliation.competence + '-01')}
                </h1>
                {clientName && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <User className="w-3.5 h-3.5 text-white/40" />
                    <p className="text-[12.5px] text-white/60">{clientName}</p>
                  </div>
                )}
              </div>

              {/* Meta chips */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                  <Calendar className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-[11.5px] text-white/70">{new Date(reconciliation.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                  <Files className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-[11.5px] text-white/70">{reconciliation.statementsCount} extrato(s)</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                  <Landmark className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-[11.5px] text-white/70">{reconciliation.bankAccountsCount} conta(s)</span>
                </div>
                {open === 0 ? (
                  <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-lg px-3 py-1.5">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11.5px] text-emerald-300 font-medium">Revisão completa</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/30 rounded-lg px-3 py-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11.5px] text-amber-300 font-medium">{open} pendência(s)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {reconciliation.reviewItems.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-white/40 uppercase tracking-wide font-semibold">Progresso da revisão</span>
                  <span className="text-[11px] text-white/50">{done}/{reconciliation.reviewItems.length}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#5fd9be] to-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI strip ── */}
        <KpiStrip results={reconciliation.results} reviewItems={reconciliation.reviewItems} />

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-[1fr_340px] gap-5">

          {/* Left: accounts + investments */}
          <div className="space-y-5">
            {/* Accounts */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-[#0d9488]" />
                  <p className="text-[13.5px] font-semibold text-[#0a2520]">Contas analisadas</p>
                </div>
                <span className="text-[11px] text-gray-400">{reconciliation.results.length} conta(s)</span>
              </div>
              <div className="p-4 space-y-3">
                {reconciliation.results.map((r, i) => (
                  <AccountCard key={`${r.accountCode}-${i}`} result={r} />
                ))}
              </div>
            </div>

            {/* Investment statements */}
            <InvestmentSection statements={reconciliation.investmentStatements} />

            {/* Files processed */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Files className="w-4 h-4 text-gray-400" />
                <p className="text-[13px] font-semibold text-[#0a2520]">Arquivos processados</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                <FileRow label="Balancete" name={reconciliation.fileNames.trialBalance} />
                <FileRow label="Razão" name={reconciliation.fileNames.ledger} />
                {reconciliation.fileNames.statements.map((s, i) => (
                  <FileRow key={i} label={i === 0 ? 'Extrato(s)' : ''} name={s} />
                ))}
              </div>
            </div>
          </div>

          {/* Right: review panel */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm lg:sticky lg:top-4">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-[13.5px] font-semibold text-[#0a2520]">Itens de revisão</p>
                <div className="flex items-center gap-1.5">
                  {open > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      {open} pendente{open > 1 ? 's' : ''}
                    </span>
                  )}
                  {done > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {done} resolvido{done > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 space-y-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
                {reconciliation.reviewItems.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                    <p className="text-[12px] text-gray-400">Nenhuma pendência operacional.</p>
                  </div>
                ) : (
                  reconciliation.reviewItems.map((item) => (
                    <ReviewCard
                      key={item.id}
                      item={item}
                      reconciliationId={reconciliation.id}
                      onUpdate={handleReviewItemUpdate}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function FileRow({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <FileText className="w-3.5 h-3.5 text-gray-300 shrink-0" />
      <span className="text-[11px] text-gray-400 w-16 shrink-0">{label}</span>
      <span className="text-[12px] text-gray-600 truncate">{name}</span>
    </div>
  );
}
