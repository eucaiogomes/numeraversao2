import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  FileWarning,
  Landmark,
  ListChecks,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppLayout } from '@/components/AppLayout';
import {
  fetchBankingReconciliation,
  getBankingReconciliation,
  updateBankingReviewItem,
} from '@/lib/banking/banking-reconciliation-store';
import type { BankingReconciliationCase } from '@/lib/banking/banking-reconciliation-store';
import type {
  BalanceCheckpoint,
  BalanceReconciliationResult,
  BankingReviewItem,
  BankStatementEntry,
  QuestorLedgerEntry,
} from '@/lib/banking/types';

export const Route = createFileRoute('/conciliacao-bancaria/$id')({
  component: BankingReconciliationPage,
});

function fmtCurrency(value: number | undefined) {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNumber(value: number | undefined) {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | undefined) {
  if (!iso) return '-';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function fmtShortDate(iso: string | undefined) {
  if (!iso) return '-';
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

function fmtMonth(value: string | undefined) {
  if (!value) return '-';
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const [year, month] = value.slice(0, 7).split('-');
  return `${months[Number(month) - 1] ?? month} ${year}`;
}

function statusLabel(status: BalanceReconciliationResult['status']) {
  const labels: Record<BalanceReconciliationResult['status'], string> = {
    reconciled: 'Conciliada',
    divergent: 'Divergente',
    missing_statement: 'Sem extrato',
    missing_ledger: 'Sem razão',
    investment_statement_parsed: 'Aplicação lida',
    insufficient_data: 'Dados insuficientes',
  };
  return labels[status];
}

const surface = 'border-[#c8ded8] bg-[#f4faf8]';
const insetSurface = 'border-[#d7e7e3] bg-[#edf6f3]';
const panelSurface = 'border-[#d7e7e3] bg-white/58';
const subtleText = 'text-[#6f827d]';
const bodyText = 'text-[#17332e]';
const mutedText = 'text-[#8da09b]';
const successText = 'text-[#087568]';
const dangerText = 'text-[#c44d59]';
const successPanel = 'border-[#9fd8cc] bg-[#e8f7f3]';
const dangerPanel = 'border-[#efb5bb] bg-[#fff1f2]';

function StatusPill({ status }: { status: BalanceReconciliationResult['status'] }) {
  const cls =
    status === 'reconciled'
      ? 'border-[#9fd8cc] bg-[#dbf4ee] text-[#087568]'
      : status === 'divergent'
        ? 'border-[#efb5bb] bg-[#ffe4e7] text-[#b63d4a]'
        : 'border-[#e6ca8b] bg-[#fff4d8] text-[#8a6508]';

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

function accountDisplayName(result: BalanceReconciliationResult | undefined) {
  if (!result) return 'Conta bancária';
  return `${result.accountCode} - ${result.accountName}`;
}

function getPrimaryResult(results: BalanceReconciliationResult[]) {
  return (
    results.find((result) => result.status === 'divergent') ??
    results.find((result) => result.status === 'reconciled') ??
    results[0]
  );
}

function buildChartRows(result: BalanceReconciliationResult | undefined) {
  const checkpoints = result?.checkpoints ?? [];
  return checkpoints.map((checkpoint) => ({
    date: fmtShortDate(checkpoint.date),
    extrato: checkpoint.statementBalance,
    questor: checkpoint.ledgerBalance,
    difference: checkpoint.difference ?? 0,
  }));
}

function periodResults(
  results: BalanceReconciliationResult[],
  primary: BalanceReconciliationResult | undefined,
) {
  return results
    .filter(
      (result) =>
        (result.periodStart || result.periodEnd) &&
        (!primary || result.accountCode === primary.accountCode),
    )
    .sort((a, b) => (a.periodStart ?? '').localeCompare(b.periodStart ?? ''));
}

function KpiCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'ok' | 'danger' | 'neutral';
}) {
  const valueClass =
    tone === 'ok' ? successText : tone === 'danger' ? dangerText : bodyText;
  return (
    <div className={`rounded-lg border ${panelSurface} p-3 shadow-sm`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${mutedText}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className={`mt-0.5 text-[11px] ${subtleText}`}>{sub}</p>}
    </div>
  );
}

function PeriodCard({ result }: { result: BalanceReconciliationResult }) {
  const isOk = result.status === 'reconciled';
  const diff = Math.abs(result.difference ?? result.finalCheckpoint?.difference ?? 0);

  return (
    <div
      className={`rounded-lg border p-3 ${
        isOk ? successPanel : dangerPanel
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className={`text-sm font-bold ${isOk ? successText : dangerText}`}>
            {fmtMonth(result.periodStart ?? result.periodEnd)}
          </h2>
          <p className={`mt-0.5 text-[11px] ${subtleText}`}>{isOk ? 'Conciliado' : 'Pendente de ajuste'}</p>
        </div>
        <StatusPill status={result.status} />
      </div>

      <div className="space-y-1.5 text-[11px]">
        <BalanceLine label="Saldo extrato" value={result.finalCheckpoint?.statementBalance} />
        <BalanceLine label="Saldo Questor" value={result.finalCheckpoint?.ledgerBalance} />
        <BalanceLine
          label="Diferença"
          value={diff}
          tone={diff > 0 ? 'danger' : 'ok'}
          forceSign={diff > 0}
        />
      </div>

      {result.lastMatchedCheckpoint && (
        <div className={`mt-3 rounded-md border ${insetSurface} px-2.5 py-2`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${mutedText}`}>
            Último dia conciliado
          </p>
          <p className={`mt-0.5 text-[12px] font-semibold ${bodyText}`}>{fmtDate(result.lastMatchedCheckpoint.date)}</p>
        </div>
      )}
    </div>
  );
}

function BalanceLine({
  label,
  value,
  tone,
  forceSign = false,
}: {
  label: string;
  value?: number;
  tone?: 'ok' | 'danger';
  forceSign?: boolean;
}) {
  const color = tone === 'ok' ? successText : tone === 'danger' ? dangerText : bodyText;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={subtleText}>{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>
        {forceSign && value ? '+ ' : ''}
        {fmtCurrency(value)}
      </span>
    </div>
  );
}

function DivergenceNarrative({ result }: { result: BalanceReconciliationResult | undefined }) {
  if (!result || result.status !== 'divergent') return null;

  const statementCandidate = result.statementEntriesOnDivergenceDate.find(
    (entry) => Math.abs(Math.abs(entry.amount) - Math.abs(result.difference ?? 0)) <= 0.009,
  );
  const candidate = statementCandidate ?? result.statementEntriesOnDivergenceDate[0];

  return (
    <section className="rounded-lg border border-amber-300/40 bg-amber-200 p-4 text-[#2d2104] shadow-[0_12px_30px_-20px_rgba(0,0,0,.7)]">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h2 className="text-sm font-bold">Ação necessária: lançamento faltante no Questor</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed">
            O último dia conciliado foi <strong>{fmtDate(result.lastMatchedCheckpoint?.date)}</strong>.
            A primeira divergência aparece em <strong>{fmtDate(result.firstDivergentCheckpoint?.date)}</strong>,
            com diferença de <strong>{fmtCurrency(Math.abs(result.difference ?? 0))}</strong>.
            {candidate
              ? ` O lançamento mais provável no extrato é "${candidate.description}", no valor de ${fmtCurrency(candidate.amount)}.`
              : ' Não foi possível selecionar automaticamente um lançamento candidato no extrato.'}
          </p>
        </div>
      </div>
    </section>
  );
}

function EntriesTable({
  title,
  subtitle,
  statementEntries,
  ledgerEntries,
  highlightAmount,
}: {
  title: string;
  subtitle: string;
  statementEntries: BankStatementEntry[];
  ledgerEntries: QuestorLedgerEntry[];
  highlightAmount?: number;
}) {
  const rows = [
    ...statementEntries.map((entry) => ({
      side: 'B',
      date: entry.date,
      description: entry.description,
      debit: entry.amount < 0 ? Math.abs(entry.amount) : 0,
      credit: entry.amount > 0 ? entry.amount : 0,
      amount: entry.amount,
      status:
        highlightAmount !== undefined &&
        Math.abs(Math.abs(entry.amount) - Math.abs(highlightAmount)) <= 0.009
          ? 'Provável'
          : 'Extrato',
    })),
    ...ledgerEntries.map((entry) => ({
      side: 'A',
      date: entry.date,
      description: entry.history,
      debit: entry.debit,
      credit: entry.credit,
      amount: entry.amount,
      status: 'Questor',
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.side.localeCompare(b.side));

  return (
    <section className={`rounded-lg border ${panelSurface} p-4 shadow-sm`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={`text-sm font-bold ${bodyText}`}>{title}</h2>
          <p className={`mt-0.5 text-[11px] ${subtleText}`}>{subtitle}</p>
        </div>
        <span className="rounded-full border border-[#efb5bb] bg-[#ffe4e7] px-2 py-1 text-[10px] font-semibold text-[#b63d4a]">
          conciliação parcial
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[11.5px]">
          <thead>
            <tr className={`border-b border-[#d7e7e3] ${mutedText}`}>
              <th className="py-2 pr-3 font-medium">Lado</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Descrição</th>
              <th className="px-3 py-2 text-right font-medium">Débito</th>
              <th className="px-3 py-2 text-right font-medium">Crédito</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="py-2 pl-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d7e7e3]">
            {rows.map((row, index) => {
              const probable = row.status === 'Provável';
              return (
                <tr key={`${row.side}-${row.date}-${row.description}-${index}`} className={probable ? 'bg-[#fff1f2]' : ''}>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                        row.side === 'A' ? 'bg-[#dfeeff] text-[#2563a8]' : 'bg-[#dbf4ee] text-[#087568]'
                      }`}
                    >
                      {row.side}
                    </span>
                  </td>
                  <td className={`px-3 py-2 ${subtleText}`}>{fmtDate(row.date)}</td>
                  <td className={`max-w-[300px] px-3 py-2 ${bodyText}`}>{row.description}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${subtleText}`}>{fmtCurrency(row.debit)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${successText}`}>{fmtCurrency(row.credit)}</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${row.amount < 0 ? dangerText : successText}`}>
                    {fmtCurrency(row.amount)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        probable ? 'bg-[#f4a9b2] text-[#5f1018]' : 'bg-[#e4efec] text-[#647873]'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BalanceChart({ result }: { result: BalanceReconciliationResult | undefined }) {
  const rows = buildChartRows(result);
  if (rows.length === 0) return null;

  return (
    <section className={`rounded-lg border ${panelSurface} p-4 shadow-sm`}>
      <div className="mb-3">
        <h2 className={`text-sm font-bold ${bodyText}`}>Evolução do saldo</h2>
        <p className={`mt-0.5 text-[11px] ${subtleText}`}>
          Extrato bancário comparado ao saldo diário encontrado no Razão.
        </p>
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="statementFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#5fd9be" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#5fd9be" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(23,51,46,.12)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#6f827d', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: '#6f827d', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(value) => fmtNumber(Number(value))}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(95,217,190,.45)' }}
              contentStyle={{
                background: '#f8fcfb',
                border: '1px solid #c8ded8',
                borderRadius: 8,
                color: '#17332e',
                fontSize: 12,
              }}
              formatter={(value: number, name) => [fmtCurrency(value), name === 'extrato' ? 'Extrato' : 'Questor']}
            />
            <Area
              type="monotone"
              dataKey="extrato"
              stroke="#5fd9be"
              fill="url(#statementFill)"
              strokeWidth={2}
              dot={{ r: 2, fill: '#5fd9be' }}
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="questor"
              stroke="#93c5fd"
              fill="transparent"
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ReviewActions({
  items,
  onUpdate,
}: {
  items: BankingReviewItem[];
  onUpdate: (itemId: string, status: BankingReviewItem['status']) => void;
}) {
  if (items.length === 0) {
    return (
      <section className={`rounded-lg border ${successPanel} p-4`}>
        <div className={`flex items-center gap-2 ${successText}`}>
          <CheckCircle2 className="h-4 w-4" />
          <h2 className="text-sm font-bold">Nenhuma ação pendente</h2>
        </div>
      </section>
    );
  }

  return (
    <section className={`rounded-lg border ${panelSurface} p-4 shadow-sm`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className={`text-sm font-bold ${bodyText}`}>Verificação e regularização</h2>
          <p className={`mt-0.5 text-[11px] ${subtleText}`}>Checklist operacional gerado a partir das divergências.</p>
        </div>
        <span className="rounded-full border border-[#aac7e8] bg-[#e8f2ff] px-2 py-1 text-[10px] font-semibold text-[#2563a8]">
          pronto para revisão
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[11.5px]">
          <thead>
            <tr className={`border-b border-[#d7e7e3] ${mutedText}`}>
              <th className="py-2 pr-3 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Ação sugerida</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="py-2 pl-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d7e7e3]">
            {items.map((item) => {
              const complete = item.status === 'done' || item.status === 'approved';
              return (
                <tr key={item.id}>
                  <td className={`py-2 pr-3 ${subtleText}`}>{fmtDate(item.dueDate)}</td>
                  <td className="px-3 py-2">
                    <p className={`font-medium ${bodyText}`}>{item.title}</p>
                    <p className={`mt-0.5 text-[10.5px] ${subtleText}`}>{item.detail}</p>
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${dangerText}`}>
                    {fmtCurrency(item.amount)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => onUpdate(item.id, complete ? 'open' : item.kind === 'suggested_entry' ? 'approved' : 'done')}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                        complete
                          ? 'bg-[#9fd8cc] text-[#083b34]'
                          : 'bg-[#f4a9b2] text-[#5f1018] hover:bg-[#f8bdc4]'
                      }`}
                    >
                      {complete ? 'Resolvido' : item.kind === 'suggested_entry' ? 'Aprovar' : 'Corrigir'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MissingDocs({ results }: { results: BalanceReconciliationResult[] }) {
  const missing = results.filter((result) => result.status === 'missing_statement' || result.status === 'missing_ledger');
  if (missing.length === 0) return null;

  return (
    <section className={`rounded-lg border ${panelSurface} p-4 shadow-sm`}>
      <div className="mb-3 flex items-center gap-2">
        <FileWarning className="h-4 w-4 text-[#a97805]" />
        <h2 className={`text-sm font-bold ${bodyText}`}>Contas fora da conciliação automática</h2>
      </div>
      <div className="space-y-2">
        {missing.map((result) => (
          <div key={`${result.accountCode}-${result.status}`} className={`flex items-center justify-between gap-3 rounded-md border ${insetSurface} px-3 py-2`}>
            <div>
              <p className={`text-[12px] font-semibold ${bodyText}`}>{accountDisplayName(result)}</p>
              <p className={`mt-0.5 text-[11px] ${subtleText}`}>{result.message}</p>
            </div>
            <StatusPill status={result.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

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
      .then((caseData) => {
        if (active) setReconciliation(caseData);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const primary = useMemo(() => getPrimaryResult(reconciliation?.results ?? []), [reconciliation]);
  const periods = useMemo(
    () => periodResults(reconciliation?.results ?? [], primary),
    [reconciliation, primary],
  );

  if (loading && !reconciliation) {
    return (
      <AppLayout>
        <div className="mx-auto mt-20 max-w-md text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#0d9488] border-t-transparent" />
          <p className="text-sm text-gray-500">Carregando conciliação...</p>
        </div>
      </AppLayout>
    );
  }

  if (!reconciliation) {
    return (
      <AppLayout>
        <div className="mx-auto mt-20 max-w-md text-center">
          <FileWarning className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <h1 className="text-base font-semibold text-[#0a2520]">Conciliação não encontrada</h1>
          <p className="mb-5 mt-1 text-sm text-gray-400">O resultado ainda não está salvo nesta sessão.</p>
          <button
            onClick={() => navigate({ to: '/conciliacao-bancaria' })}
            className="h-9 rounded-lg bg-[#0a2520] px-5 text-sm font-medium text-white hover:bg-[#0d3530]"
          >
            Nova conciliação
          </button>
        </div>
      </AppLayout>
    );
  }

  const reconciled = reconciliation.results.filter((result) => result.status === 'reconciled').length;
  const divergent = reconciliation.results.filter((result) => result.status === 'divergent').length;
  const missing = reconciliation.results.filter((result) => result.status === 'missing_statement' || result.status === 'missing_ledger').length;
  const primaryDifference = Math.abs(primary?.difference ?? 0);
  const finalStatementBalance = primary?.finalCheckpoint?.statementBalance;
  const finalLedgerBalance = primary?.finalCheckpoint?.ledgerBalance;
  const openReviewItems = reconciliation.reviewItems.filter((item) => item.status === 'open');

  async function handleReviewUpdate(itemId: string, status: BankingReviewItem['status']) {
    const updated = await updateBankingReviewItem(reconciliation.id, itemId, { status });
    if (updated) setReconciliation(updated);
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl pb-10">
        <div className={`overflow-hidden rounded-xl border ${surface} bg-[#eaf4f1] shadow-[0_22px_70px_-42px_rgba(10,37,32,.55)]`}>
          <header className="border-b border-[#c8ded8] bg-gradient-to-br from-[#dff0ec] via-[#eef8f5] to-[#d8ebe6] px-5 py-4">
            <button
              onClick={() => navigate({ to: '/conciliacao-bancaria' })}
              className={`mb-3 inline-flex items-center gap-1.5 text-[12px] ${subtleText} transition-colors hover:text-[#0d9488]`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para a IA Contábil
            </button>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full border border-[#9fd8cc] bg-[#dbf4ee] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#087568]">
                    Relatório completo
                  </span>
                  <span className={`text-[11px] ${subtleText}`}>Gerado em {new Date(reconciliation.createdAt).toLocaleString('pt-BR')}</span>
                </div>
                <h1 className={`text-2xl font-bold tracking-tight ${bodyText}`}>Conciliação bancária</h1>
                <p className={`mt-1 text-[12.5px] ${subtleText}`}>
                  {accountDisplayName(primary)} · competência {fmtMonth(reconciliation.competence)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to="/conciliacao-bancaria"
                  className="rounded-lg border border-[#c8ded8] bg-white/60 px-3 py-2 text-[12px] font-semibold text-[#17332e] transition-colors hover:border-[#0d9488]/40 hover:bg-white"
                >
                  Nova análise
                </Link>
              </div>
            </div>
          </header>

          <main className="space-y-4 p-4 md:p-5">
            <section className="grid gap-3 md:grid-cols-4">
              <KpiCard label="Saldo extrato" value={fmtCurrency(finalStatementBalance)} sub="último PDF lido" tone={primary?.status === 'reconciled' ? 'ok' : 'neutral'} />
              <KpiCard label="Saldo Questor" value={fmtCurrency(finalLedgerBalance)} sub="Razão contábil" />
              <KpiCard label="Diferença apurada" value={fmtCurrency(primaryDifference)} sub={`${divergent} conta(s) divergente(s)`} tone={primaryDifference > 0 ? 'danger' : 'ok'} />
              <KpiCard label="Pendências" value={String(openReviewItems.length + missing)} sub={`${reconciled} conciliada(s)`} tone={openReviewItems.length + missing > 0 ? 'danger' : 'ok'} />
            </section>

            {periods.length > 0 && (
              <section className="grid gap-3 md:grid-cols-2">
                {periods.map((result, index) => (
                  <PeriodCard key={`${result.accountCode}-${result.periodStart}-${index}`} result={result} />
                ))}
              </section>
            )}

            <DivergenceNarrative result={primary} />

            {primary?.status === 'divergent' && (
              <EntriesTable
                title={`Análise do dia ${fmtDate(primary.firstDivergentCheckpoint?.date)}`}
                subtitle="Lado A = Questor/Razão. Lado B = extrato bancário enviado pelo cliente."
                statementEntries={primary.statementEntriesOnDivergenceDate}
                ledgerEntries={primary.ledgerEntriesOnDivergenceDate}
                highlightAmount={primary.difference}
              />
            )}

            <BalanceChart result={primary} />

            <ReviewActions items={reconciliation.reviewItems} onUpdate={handleReviewUpdate} />

            <MissingDocs results={reconciliation.results} />

            <section className="grid gap-3 md:grid-cols-3">
              <div className={`rounded-lg border ${panelSurface} p-4`}>
                <div className={`mb-2 flex items-center gap-2 ${successText}`}>
                  <CheckCircle2 className="h-4 w-4" />
                  <h2 className="text-sm font-bold">Lado A</h2>
                </div>
                <p className={`text-[12px] leading-relaxed ${subtleText}`}>
                  Questor: balancete para identificar contas analíticas e Razão para validar saldos e lançamentos.
                </p>
              </div>
              <div className={`rounded-lg border ${panelSurface} p-4`}>
                <div className="mb-2 flex items-center gap-2 text-[#2563a8]">
                  <Building2 className="h-4 w-4" />
                  <h2 className="text-sm font-bold">Lado B</h2>
                </div>
                <p className={`text-[12px] leading-relaxed ${subtleText}`}>
                  Documentação do cliente: extratos PDF de conta corrente ou aplicação usados como fonte externa.
                </p>
              </div>
              <div className={`rounded-lg border ${panelSurface} p-4`}>
                <div className="mb-2 flex items-center gap-2 text-[#a97805]">
                  <ListChecks className="h-4 w-4" />
                  <h2 className="text-sm font-bold">Critério</h2>
                </div>
                <p className={`text-[12px] leading-relaxed ${subtleText}`}>
                  Se o saldo final fecha, a conta é conciliada. Se não fecha, o relatório mostra último dia OK e primeira divergência.
                </p>
              </div>
            </section>

            <footer className={`flex flex-wrap items-center justify-between gap-2 border-t border-[#c8ded8] pt-4 text-[11px] ${subtleText}`}>
              <span className="inline-flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" />
                {reconciliation.fileNames.trialBalance} · {reconciliation.fileNames.ledger}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {reconciliation.fileNames.statements.length} extrato(s) processado(s)
              </span>
              {reconciliation.investmentStatementsCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {reconciliation.investmentStatementsCount} aplicação(ões)
                </span>
              )}
              {openReviewItems.length === 0 && (
                <span className={`inline-flex items-center gap-1.5 ${successText}`}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Revisão concluída
                </span>
              )}
            </footer>
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
