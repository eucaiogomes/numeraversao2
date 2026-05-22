import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  FileWarning,
  Search,
} from 'lucide-react';
import type { BalanceReconciliationResult } from '@/lib/banking/types';

const STATUS_LABEL: Record<BalanceReconciliationResult['status'], string> = {
  reconciled: 'Conciliada',
  divergent: 'Divergente',
  missing_statement: 'Sem extrato',
  missing_ledger: 'Sem razão',
  insufficient_data: 'Dados insuficientes',
};

const STATUS_STYLE: Record<BalanceReconciliationResult['status'], string> = {
  reconciled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  divergent: 'bg-amber-50 text-amber-700 border-amber-200',
  missing_statement: 'bg-gray-50 text-gray-600 border-gray-200',
  missing_ledger: 'bg-red-50 text-red-700 border-red-200',
  insufficient_data: 'bg-gray-50 text-gray-600 border-gray-200',
};

function fmtCurrency(value: number | undefined) {
  if (value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(value: string | undefined) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function StatusIcon({ status }: { status: BalanceReconciliationResult['status'] }) {
  if (status === 'reconciled') return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
  if (status === 'divergent') return <AlertTriangle className="w-5 h-5 text-amber-600" />;
  if (status === 'missing_statement') return <FileWarning className="w-5 h-5 text-gray-500" />;
  return <Search className="w-5 h-5 text-red-600" />;
}

function BalanceRow({
  label,
  date,
  statementBalance,
  ledgerBalance,
  difference,
}: {
  label: string;
  date?: string;
  statementBalance?: number;
  ledgerBalance?: number;
  difference?: number;
}) {
  return (
    <div className="grid md:grid-cols-4 gap-3 py-3 border-t border-gray-100">
      <div>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">{label}</p>
        <p className="text-[13px] text-[#0a2520] mt-0.5">{fmtDate(date)}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
          Extrato
        </p>
        <p className="text-[13px] text-[#0a2520] mt-0.5">{fmtCurrency(statementBalance)}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Razão</p>
        <p className="text-[13px] text-[#0a2520] mt-0.5">{fmtCurrency(ledgerBalance)}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
          Diferença
        </p>
        <p className="text-[13px] font-semibold text-[#0a2520] mt-0.5">
          {fmtCurrency(difference)}
        </p>
      </div>
    </div>
  );
}

export function BankAccountResults({ results }: { results: BalanceReconciliationResult[] }) {
  return (
    <div className="space-y-4">
      {results.map((result, index) => (
        <div
          key={`${result.accountCode}-${result.periodStart ?? 'none'}-${index}`}
          className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden"
        >
          <div className="p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
              <StatusIcon status={result.status} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-semibold text-[#0a2520]">
                  {result.accountCode} - {result.accountName}
                </h2>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[result.status]}`}
                >
                  {STATUS_LABEL[result.status]}
                </span>
              </div>
              <p className="text-[12.5px] text-gray-400 mt-1">{result.message}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
                Diferença
              </p>
              <p className="text-[15px] font-bold text-[#0a2520] mt-0.5">
                {fmtCurrency(result.difference)}
              </p>
            </div>
          </div>

          <div className="px-4 pb-4">
            {result.finalCheckpoint && (
              <BalanceRow
                label="Saldo final"
                date={result.finalCheckpoint.date}
                statementBalance={result.finalCheckpoint.statementBalance}
                ledgerBalance={result.finalCheckpoint.ledgerBalance}
                difference={result.finalCheckpoint.difference}
              />
            )}
            {result.lastMatchedCheckpoint && result.status === 'divergent' && (
              <BalanceRow
                label="Último dia conciliado"
                date={result.lastMatchedCheckpoint.date}
                statementBalance={result.lastMatchedCheckpoint.statementBalance}
                ledgerBalance={result.lastMatchedCheckpoint.ledgerBalance}
                difference={result.lastMatchedCheckpoint.difference}
              />
            )}
            {result.firstDivergentCheckpoint && (
              <BalanceRow
                label="Primeira divergência"
                date={result.firstDivergentCheckpoint.date}
                statementBalance={result.firstDivergentCheckpoint.statementBalance}
                ledgerBalance={result.firstDivergentCheckpoint.ledgerBalance}
                difference={result.firstDivergentCheckpoint.difference}
              />
            )}

            {result.statementEntriesOnDivergenceDate.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Banknote className="w-3.5 h-3.5 text-[#0d9488]" />
                  <p className="text-[12px] font-semibold text-[#0a2520]">
                    Lançamentos candidatos no extrato
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {result.statementEntriesOnDivergenceDate.map((entry) => (
                    <div key={`${entry.sequence}-${entry.description}`} className="py-2 flex gap-3">
                      <span className="text-[12px] text-gray-400 w-20 shrink-0">
                        {fmtDate(entry.date)}
                      </span>
                      <span className="text-[12.5px] text-gray-600 flex-1">
                        {entry.description}
                      </span>
                      <span className="text-[12.5px] font-semibold text-[#0a2520]">
                        {fmtCurrency(entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.ledgerEntriesOnDivergenceDate.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Search className="w-3.5 h-3.5 text-[#0d9488]" />
                  <p className="text-[12px] font-semibold text-[#0a2520]">
                    Lançamentos do Razão na data divergente
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="py-2 pr-3 text-left font-medium">Histórico</th>
                        <th className="py-2 px-3 text-right font-medium">Débito</th>
                        <th className="py-2 px-3 text-right font-medium">Crédito</th>
                        <th className="py-2 pl-3 text-right font-medium">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {result.ledgerEntriesOnDivergenceDate.map((entry) => (
                        <tr key={`${entry.rowNumber}-${entry.history}`}>
                          <td className="py-2 pr-3 text-gray-600 min-w-[260px]">
                            {entry.history}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-600">
                            {fmtCurrency(entry.debit)}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-600">
                            {fmtCurrency(entry.credit)}
                          </td>
                          <td className="py-2 pl-3 text-right font-semibold text-[#0a2520]">
                            {fmtCurrency(entry.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
