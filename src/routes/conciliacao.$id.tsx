import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FileText, CheckCircle2, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { KPICards } from '@/components/reconciliation/KPICards';
import { MatchesTable } from '@/components/reconciliation/MatchesTable';
import { DivergencesTable } from '@/components/reconciliation/DivergencesTable';
import {
  getReconciliation,
  updateReconciliation,
  updateDivergence,
} from '@/lib/reconciliation-store';
import type { Reconciliation } from '@/lib/reconciliation-store';
import { analyzeDivergencesBatch, buildDivergenceInputs } from '@/lib/claude-analysis';

export const Route = createFileRoute('/conciliacao/$id')({
  component: ReconciliationPage,
});

type Tab = 'matches' | 'divergences';

function ReconciliationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [rec, setRec] = useState<Reconciliation | undefined>(() => getReconciliation(id));
  const [tab, setTab] = useState<Tab>('divergences');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);

  const refresh = useCallback(() => {
    setRec({ ...getReconciliation(id)! });
  }, [id]);

  // Auto-trigger AI analysis on mount if not done yet
  useEffect(() => {
    const r = getReconciliation(id);
    if (!r) return;
    const unanalyzed = r.divergences.filter((d) => !d.aiProbableCause);
    if (unanalyzed.length === 0) {
      setAiDone(true);
      return;
    }
    runAIAnalysis(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runAIAnalysis(r: Reconciliation) {
    setAnalyzing(true);
    setAnalyzeError(null);

    const unanalyzed = r.divergences.filter((d) => !d.aiProbableCause);
    const BATCH = 20;

    try {
      for (let i = 0; i < unanalyzed.length; i += BATCH) {
        const batch = unanalyzed.slice(i, i + BATCH);
        const inputs = buildDivergenceInputs(batch, r.transactionsA, r.transactionsB);

        const period = `${r.periodStart} a ${r.periodEnd}`;
        const results = await analyzeDivergencesBatch({
          data: {
            divergences: inputs,
            period,
            accountLabel: r.accountLabel,
          },
        });

        const now = new Date().toISOString();
        for (const result of results) {
          updateDivergence(id, result.divergence_id, {
            aiProbableCause: result.probable_cause,
            aiSuggestedAction: result.suggested_action,
            aiConfidence: result.confidence,
            aiAnalyzedAt: now,
          });
        }
        refresh();
      }
      setAiDone(true);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Erro na análise IA');
    } finally {
      setAnalyzing(false);
    }
  }

  if (!rec) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-gray-400">
          Conciliação não encontrada.
        </div>
      </AppLayout>
    );
  }

  const pendingDivergences = rec.divergences.filter((d) => d.resolution === 'pending').length;
  const aiAnalyzedCount = rec.divergences.filter((d) => !!d.aiProbableCause).length;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: '/conciliacao' })}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#0d9488] hover:border-[#0d9488]/40 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-[#0a2520] tracking-tight">
                {rec.accountLabel}
              </h1>
              <p className="text-[12.5px] text-gray-400 mt-0.5">
                {rec.periodStart} a {rec.periodEnd} · {rec.fileAName} × {rec.fileBName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {analyzing && (
              <div className="flex items-center gap-1.5 text-[12px] text-[#0d9488] bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-full">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                IA analisando divergências…
              </div>
            )}
            {aiDone && !analyzing && (
              <div className="flex items-center gap-1.5 text-[12px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                <Sparkles className="w-3.5 h-3.5" />
                Análise IA concluída
              </div>
            )}
            {analyzeError && (
              <div
                className="flex items-center gap-1.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full cursor-pointer"
                onClick={() => runAIAnalysis(rec)}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Sem chave IA — clique para tentar
              </div>
            )}
            <button
              onClick={() => {
                updateReconciliation(id, { status: 'closed' });
                refresh();
              }}
              disabled={rec.status === 'closed'}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#0a2520] text-white text-[12.5px] font-medium hover:bg-[#0d3530] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {rec.status === 'closed' ? 'Fechado' : 'Fechar conciliação'}
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <KPICards
          matchedCount={rec.matchedCount}
          totalA={rec.totalA}
          totalB={rec.totalB}
          divergenceCount={rec.divergenceCount}
          pendingDivergences={pendingDivergences}
          aiAnalyzedCount={aiAnalyzedCount}
        />

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {(
              [
                { id: 'divergences', label: 'Divergências', badge: rec.divergenceCount },
                { id: 'matches', label: 'Correspondências', badge: rec.matchedCount },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-6 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-[#0d9488] text-[#0a2520]'
                    : 'border-transparent text-gray-400 hover:text-[#0a2520]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {t.label}
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.id ? 'bg-[#0d9488]/10 text-[#0d9488]' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {t.badge}
                </span>
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === 'divergences' && (
              <DivergencesTable
                reconciliationId={id}
                divergences={rec.divergences}
                txsA={rec.transactionsA}
                txsB={rec.transactionsB}
                onUpdate={refresh}
              />
            )}
            {tab === 'matches' && (
              <MatchesTable
                matches={rec.matches}
                txsA={rec.transactionsA}
                txsB={rec.transactionsB}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
