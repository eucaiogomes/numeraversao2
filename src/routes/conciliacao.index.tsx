import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Calculator, Plus, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { listReconciliations } from '@/lib/reconciliation-store';
import type { Reconciliation } from '@/lib/reconciliation-store';

export const Route = createFileRoute('/conciliacao/')({
  component: ConciliacaoIndex,
});

function StatusBadge({ status }: { status: Reconciliation['status'] }) {
  if (status === 'closed') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        Fechado
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" />
      Em revisão
    </span>
  );
}

function ConciliacaoIndex() {
  const [recs] = useState<Reconciliation[]>(() => listReconciliations());

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#0a2520] tracking-tight">Conciliações</h1>
            <p className="text-[13px] text-gray-400 mt-1">
              Histórico de conciliações bancárias realizadas nesta sessão
            </p>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#0a2520] text-white text-[13px] font-medium hover:bg-[#0d3530] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova conciliação
          </Link>
        </div>

        {recs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
              <Calculator className="w-7 h-7 text-gray-300" />
            </div>
            <h2 className="text-[15px] font-medium text-gray-600 mb-2">
              Nenhuma conciliação ainda
            </h2>
            <p className="text-[13px] text-gray-400 mb-6 max-w-xs mx-auto">
              Faça upload de um extrato OFX e um razão CSV na tela inicial para começar.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#0d9488] text-white text-[13px] font-medium hover:bg-[#0a7a70] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Iniciar conciliação
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden divide-y divide-gray-50">
            {recs.map((r) => {
              const matchRate =
                r.matchedCount + r.divergenceCount > 0
                  ? Math.round((r.matchedCount / (r.matchedCount + r.divergenceCount)) * 100)
                  : 0;

              return (
                <Link
                  key={r.id}
                  to="/conciliacao/$id"
                  params={{ id: r.id }}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                    <Calculator className="w-5 h-5 text-[#0d9488]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-[14px] text-[#0a2520] truncate">
                        {r.accountLabel}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-[12px] text-gray-400">
                      {r.periodStart} a {r.periodEnd} · {r.fileAName} × {r.fileBName}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-[13px] font-semibold text-[#0a2520]">{matchRate}% conciliado</p>
                    <p className="text-[11px] text-gray-400">
                      {r.divergenceCount} divergências · {fmt(r.totalA - r.totalB)} dif.
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#0d9488] transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
