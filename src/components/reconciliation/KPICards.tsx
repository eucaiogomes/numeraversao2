import { CheckCircle2, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';

interface KPICardsProps {
  matchedCount: number;
  totalA: number;
  totalB: number;
  divergenceCount: number;
  pendingDivergences: number;
  aiAnalyzedCount: number;
}

export function KPICards({
  matchedCount,
  totalA,
  totalB,
  divergenceCount,
  pendingDivergences,
  aiAnalyzedCount,
}: KPICardsProps) {
  const total = matchedCount + divergenceCount;
  const matchRate = total > 0 ? Math.round((matchedCount / total) * 100) : 0;
  const diff = totalA - totalB;

  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl border border-gray-200/70 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
            Conciliados
          </span>
        </div>
        <p className="text-2xl font-bold text-[#0a2520]">{matchRate}%</p>
        <p className="text-[12px] text-gray-400 mt-0.5">
          {matchedCount} de {total} lançamentos
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
            Divergências
          </span>
        </div>
        <p className="text-2xl font-bold text-[#0a2520]">{divergenceCount}</p>
        <p className="text-[12px] text-gray-400 mt-0.5">{pendingDivergences} pendentes</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
            Diferença
          </span>
        </div>
        <p className={`text-2xl font-bold ${diff === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
          {fmt(diff)}
        </p>
        <p className="text-[12px] text-gray-400 mt-0.5">A: {fmt(totalA)} · B: {fmt(totalB)}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#0d9488]" />
          </div>
          <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
            IA Analisou
          </span>
        </div>
        <p className="text-2xl font-bold text-[#0a2520]">{aiAnalyzedCount}</p>
        <p className="text-[12px] text-gray-400 mt-0.5">
          de {divergenceCount} divergências
        </p>
      </div>
    </div>
  );
}
