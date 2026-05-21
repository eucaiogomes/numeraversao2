import { useState } from 'react';
import { Sparkles, CheckCircle2, EyeOff, Search, AlertCircle, ChevronDown } from 'lucide-react';
import type { Divergence, TransactionSource } from '@/lib/matching-engine';
import { updateDivergence } from '@/lib/reconciliation-store';

interface DivergencesTableProps {
  reconciliationId: string;
  divergences: Divergence[];
  sources: TransactionSource[];
  onUpdate: () => void;
}

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

const RESOLUTION_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-600 border border-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  ignored: 'bg-gray-100 text-gray-500 border border-gray-200',
  investigating: 'bg-blue-50 text-blue-700 border border-blue-200',
  resolved: 'bg-teal-50 text-teal-700 border border-teal-200',
};

const RESOLUTION_LABEL: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceito',
  ignored: 'Ignorado',
  investigating: 'Investigando',
  resolved: 'Resolvido',
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function DivergencesTable({
  reconciliationId,
  divergences,
  sources,
  onUpdate,
}: DivergencesTableProps) {
  const [filterSource, setFilterSource] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const txMap = new Map(
    sources.flatMap((s) => s.transactions.map((t) => [t.id, { tx: t, source: s }])),
  );
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  const filtered = divergences.filter((d) => {
    if (filterSource !== 'all' && d.sourceId !== filterSource) return false;
    if (search) {
      const entry = txMap.get(d.transactionId);
      if (!entry?.tx.description.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });

  function setResolution(d: Divergence, res: Divergence['resolution']) {
    updateDivergence(reconciliationId, d.id, { resolution: res });
    onUpdate();
  }

  if (divergences.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
        <p className="text-sm font-medium text-gray-600">Tudo conciliado!</p>
        <p className="text-xs mt-1">Nenhuma divergência encontrada neste período.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          <button
            onClick={() => setFilterSource('all')}
            className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
              filterSource === 'all'
                ? 'bg-white text-[#0a2520] shadow-sm'
                : 'text-gray-500 hover:text-[#0a2520]'
            }`}
          >
            Todos
          </button>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterSource(s.id)}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                filterSource === s.id
                  ? 'bg-white text-[#0a2520] shadow-sm'
                  : 'text-gray-500 hover:text-[#0a2520]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição..."
            className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg outline-none focus:border-[#0d9488]/40 focus:ring-1 focus:ring-[#0d9488]/20"
          />
        </div>
        <span className="text-[12px] text-gray-400 ml-auto">
          {filtered.length} de {divergences.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Data</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500 whitespace-nowrap">
                Valor
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Descrição</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 whitespace-nowrap">
                Fonte
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#0d9488]" />
                  Causa provável (IA)
                </div>
              </th>
              <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((d) => {
              const entry = txMap.get(d.transactionId);
              const source = sourceMap.get(d.sourceId);
              const expanded = expandedId === d.id;

              return (
                <>
                  <tr
                    key={d.id}
                    className={`hover:bg-gray-50/60 transition-colors ${
                      d.resolution !== 'pending' ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                      {entry?.tx.postedAt ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-gray-700 whitespace-nowrap">
                      {entry ? fmt(entry.tx.amount) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 max-w-[200px]">
                      <span className="truncate block">{entry?.tx.description ?? '—'}</span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {source && (
                        <span
                          className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                          style={{ backgroundColor: source.color }}
                        >
                          {source.label}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {d.aiProbableCause ? (
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 leading-snug">{d.aiProbableCause}</span>
                          {d.aiConfidence && (
                            <span
                              className={`shrink-0 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${CONFIDENCE_BADGE[d.aiConfidence]}`}
                            >
                              {d.aiConfidence}
                            </span>
                          )}
                          {d.aiSuggestedAction && (
                            <button
                              onClick={() => setExpandedId(expanded ? null : d.id)}
                              className="shrink-0 text-gray-400 hover:text-[#0d9488] transition-colors"
                            >
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                              />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-[12px]">Aguardando análise…</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${RESOLUTION_BADGE[d.resolution]}`}
                      >
                        {RESOLUTION_LABEL[d.resolution]}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setResolution(d, 'accepted')}
                          title="Aceitar como conciliado"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setResolution(d, 'investigating')}
                          title="Marcar para investigar"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setResolution(d, 'ignored')}
                          title="Ignorar"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded && d.aiSuggestedAction && (
                    <tr key={`${d.id}-expanded`} className="bg-teal-50/40">
                      <td colSpan={7} className="px-4 pb-3 pt-0">
                        <div className="flex items-start gap-2 ml-16">
                          <Sparkles className="w-3.5 h-3.5 text-[#0d9488] mt-0.5 shrink-0" />
                          <p className="text-[12.5px] text-[#0a4540]">
                            <span className="font-medium">Ação sugerida:</span>{' '}
                            {d.aiSuggestedAction}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma divergência para esses filtros</p>
        </div>
      )}
    </div>
  );
}
