import { Check, AlertCircle } from 'lucide-react';
import type { Match, TransactionSource } from '@/lib/matching-engine';

interface MatchesTableProps {
  matches: Match[];
  sources: TransactionSource[];
}

const MATCH_TYPE_LABEL: Record<Match['matchType'], string> = {
  exact: 'Exato',
  fuzzy_date: 'Data próx.',
  fuzzy_amount: 'Valor próx.',
  description: 'Descrição',
};

const MATCH_TYPE_COLOR: Record<Match['matchType'], string> = {
  exact: 'bg-emerald-100 text-emerald-700',
  fuzzy_date: 'bg-blue-100 text-blue-700',
  fuzzy_amount: 'bg-purple-100 text-purple-700',
  description: 'bg-amber-100 text-amber-700',
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function MatchesTable({ matches, sources }: MatchesTableProps) {
  const txMap = new Map(
    sources.flatMap((s) => s.transactions.map((t) => [t.id, { tx: t, source: s }])),
  );
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhum lançamento conciliado automaticamente</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Fonte A</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Data</th>
            <th className="text-right py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Valor A</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Descrição A</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Descrição B</th>
            <th className="text-right py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Valor B</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Fonte B</th>
            <th className="text-center py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Tipo</th>
            <th className="text-center py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Conf.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {matches.map((m) => {
            const entryA = txMap.get(m.transactionAId);
            const entryB = txMap.get(m.transactionBId);
            const srcA = sourceMap.get(m.sourceAId);
            const srcB = sourceMap.get(m.sourceBId);
            return (
              <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="py-2.5 px-4 whitespace-nowrap">
                  {srcA && (
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                      style={{ backgroundColor: srcA.color }}
                    >
                      {srcA.label}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                  {entryA?.tx.postedAt ?? '—'}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-gray-700 whitespace-nowrap">
                  {entryA ? fmt(entryA.tx.amount) : '—'}
                </td>
                <td className="py-2.5 px-4 text-gray-600 max-w-[180px] truncate">
                  {entryA?.tx.description ?? '—'}
                </td>
                <td className="py-2.5 px-4 text-gray-600 max-w-[180px] truncate">
                  {entryB?.tx.description ?? '—'}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-gray-700 whitespace-nowrap">
                  {entryB ? fmt(entryB.tx.amount) : '—'}
                </td>
                <td className="py-2.5 px-4 whitespace-nowrap">
                  {srcB && (
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                      style={{ backgroundColor: srcB.color }}
                    >
                      {srcB.label}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${MATCH_TYPE_COLOR[m.matchType]}`}
                  >
                    {MATCH_TYPE_LABEL[m.matchType]}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {m.confidence >= 0.95 ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : null}
                    <span
                      className={`text-[12px] font-medium ${
                        m.confidence >= 0.95
                          ? 'text-emerald-600'
                          : m.confidence >= 0.7
                            ? 'text-amber-600'
                            : 'text-red-500'
                      }`}
                    >
                      {Math.round(m.confidence * 100)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
