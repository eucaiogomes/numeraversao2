import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Banknote, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { BankAccountResults } from '@/components/banking/BankAccountResults';
import { BankingReport } from '@/components/banking/BankingReport';
import { BankingReviewPanel } from '@/components/banking/BankingReviewPanel';
import {
  fetchBankingReconciliation,
  getBankingReconciliation,
  updateBankingReviewItem,
} from '@/lib/banking/banking-reconciliation-store';
import type { BankingReconciliationCase } from '@/lib/banking/banking-reconciliation-store';
import type { BankingReviewItem } from '@/lib/banking/types';

export const Route = createFileRoute('/conciliacao-bancaria/$id')({
  component: BankingReconciliationPage,
});

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
      .catch((error) => {
        console.warn('Nao foi possivel carregar a conciliacao bancaria.', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading && !reconciliation) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto bg-white border border-gray-200/80 rounded-xl shadow-sm p-10 text-center">
          <FileText className="w-9 h-9 text-gray-300 mx-auto mb-3" />
          <h1 className="text-[16px] font-semibold text-[#0a2520]">
            Carregando conciliação bancária
          </h1>
          <p className="text-[13px] text-gray-400 mt-1">
            Buscando resultado salvo.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (!reconciliation) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto bg-white border border-gray-200/80 rounded-xl shadow-sm p-10 text-center">
          <FileText className="w-9 h-9 text-gray-300 mx-auto mb-3" />
          <h1 className="text-[16px] font-semibold text-[#0a2520]">
            Conciliação bancária não encontrada
          </h1>
          <p className="text-[13px] text-gray-400 mt-1">
            O resultado fica salvo apenas nesta sessão por enquanto.
          </p>
          <button
            onClick={() => navigate({ to: '/conciliacao-bancaria' })}
            className="mt-5 h-9 px-4 rounded-lg bg-[#0a2520] text-white text-[13px] font-medium hover:bg-[#0d3530] transition-colors"
          >
            Nova conciliação bancária
          </button>
        </div>
      </AppLayout>
    );
  }

  const reconciled = reconciliation.results.filter((result) => result.status === 'reconciled').length;
  const divergent = reconciliation.results.filter((result) => result.status === 'divergent').length;
  const missingStatement = reconciliation.results.filter(
    (result) => result.status === 'missing_statement',
  ).length;

  async function handleReviewItemUpdate(
    itemId: string,
    patch: Partial<Pick<BankingReviewItem, 'status' | 'note'>>,
  ) {
    const updatedCase = await updateBankingReviewItem(reconciliation.id, itemId, patch);
    if (updatedCase) setReconciliation(updatedCase);
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate({ to: '/conciliacao-bancaria' })}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#0d9488] hover:border-[#0d9488]/40 transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[#0a2520] tracking-tight">
                Resultado da conciliação bancária
              </h1>
              <p className="text-[13px] text-gray-400 mt-1">
                Competência {reconciliation.competence} · {reconciliation.statementsCount} conta corrente · {reconciliation.investmentStatementsCount} aplicacao
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white border border-gray-200/80 rounded-xl px-3 py-2 shadow-sm">
            <Banknote className="w-4 h-4 text-[#0d9488]" />
            <span className="text-[12px] text-gray-500">
              {reconciliation.bankAccountsCount} conta(s) de disponivel
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-5">
          <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm p-4">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
              Conciliadas
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{reconciled}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm p-4">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
              Divergentes
            </p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{divergent}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm p-4">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
              Sem extrato
            </p>
            <p className="text-2xl font-bold text-gray-700 mt-1">{missingStatement}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm p-4 mb-5">
          <h2 className="text-[13px] font-semibold text-[#0a2520] mb-2">Arquivos processados</h2>
          <div className="text-[12.5px] text-gray-500 space-y-1">
            <p>Balancete: {reconciliation.fileNames.trialBalance}</p>
            <p>Razão: {reconciliation.fileNames.ledger}</p>
            <p>Extratos: {reconciliation.fileNames.statements.join(', ')}</p>
            <p>Aplicacoes lidas: {reconciliation.investmentStatementsCount}</p>
          </div>
        </div>

        <BankingReviewPanel
          items={reconciliation.reviewItems}
          onUpdate={handleReviewItemUpdate}
        />

        <BankingReport reconciliation={reconciliation} />

        <BankAccountResults results={reconciliation.results} />
      </div>
    </AppLayout>
  );
}
