import { Link } from '@tanstack/react-router';
import { AlertCircle, Banknote, ChevronRight, Clock, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  fetchBankingReconciliations,
  type BankingReconciliationCase,
} from '@/lib/banking/banking-reconciliation-store';

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function countStatus(caseData: BankingReconciliationCase, status: string) {
  return caseData.results.filter((result) => result.status === status).length;
}

export function BankingHistory() {
  const [items, setItems] = useState<BankingReconciliationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadHistory() {
    setLoading(true);
    setError('');

    try {
      setItems(await fetchBankingReconciliations());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar o historico de conciliacoes bancarias.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="mt-8 bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#0a2520]">
            Historico bancario
          </h2>
          <p className="text-[12.5px] text-gray-400 mt-0.5">
            Conciliacoes processadas e salvas
          </p>
        </div>
        <button
          onClick={loadHistory}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#0d9488] hover:border-[#0d9488]/40 transition-colors"
          aria-label="Atualizar historico"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 text-[12.5px] text-amber-700 bg-amber-50/60">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-gray-400">
          Carregando historico...
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-[13px] text-gray-400">
            Nenhuma conciliacao bancaria salva ainda.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item) => {
            const reconciled = countStatus(item, 'reconciled');
            const divergent = countStatus(item, 'divergent');
            const missingStatement = countStatus(item, 'missing_statement');

            return (
              <Link
                key={item.id}
                to="/conciliacao-bancaria/$id"
                params={{ id: item.id }}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/70 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                  <Banknote className="w-5 h-5 text-[#0d9488]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13.5px] font-semibold text-[#0a2520]">
                      Competencia {item.competence}
                    </p>
                    <span className="text-[11px] text-gray-400">
                      {fmtDateTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-400 truncate mt-0.5">
                    {item.fileNames.statements.join(', ')}
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-2 text-[11px] text-gray-500 shrink-0">
                  <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                    {reconciled} conciliada(s)
                  </span>
                  <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                    {divergent} divergente(s)
                  </span>
                  <span className="px-2 py-1 rounded-full bg-gray-50 text-gray-600">
                    {missingStatement} sem extrato
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#0d9488] transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
