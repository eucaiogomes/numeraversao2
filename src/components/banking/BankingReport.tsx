import { AlertTriangle, CheckCircle2, ClipboardList, FileWarning } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BankingReconciliationCase } from '@/lib/banking/banking-reconciliation-store';
import type { BalanceReconciliationResult } from '@/lib/banking/types';

function fmtCurrency(value: number | undefined) {
  if (value === undefined) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(value: string | undefined) {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function accountLabel(result: BalanceReconciliationResult) {
  return `${result.accountCode} - ${result.accountName}`;
}

function buildPendingItems(results: BalanceReconciliationResult[]): string[] {
  const items: string[] = [];

  for (const result of results) {
    if (result.status === 'missing_statement') {
      items.push(`Solicitar extrato bancario da conta ${accountLabel(result)}.`);
    }

    if (result.status === 'missing_ledger') {
      items.push(`Verificar por que a conta ${accountLabel(result)} nao foi localizada no Razao.`);
    }

    if (result.status === 'divergent') {
      const candidate = result.statementEntriesOnDivergenceDate[0];
      const date = fmtDate(result.firstDivergentCheckpoint?.date);
      const amount = fmtCurrency(result.difference);
      const candidateText = candidate
        ? ` Lancamento candidato no extrato: ${candidate.description}, ${fmtCurrency(candidate.amount)}.`
        : '';
      items.push(
        `Conferir diferenca de ${amount} na conta ${accountLabel(result)} em ${date}.${candidateText}`,
      );
    }
  }

  return items;
}

function ReportSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-[#0d9488]">
          {icon}
        </span>
        <h3 className="text-[13px] font-semibold text-[#0a2520]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function BankingReport({ reconciliation }: { reconciliation: BankingReconciliationCase }) {
  const reconciled = reconciliation.results.filter((result) => result.status === 'reconciled');
  const divergent = reconciliation.results.filter((result) => result.status === 'divergent');
  const missingStatement = reconciliation.results.filter(
    (result) => result.status === 'missing_statement',
  );
  const pendingItems = buildPendingItems(reconciliation.results);

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm p-4 mb-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#0a2520]">
            Relatorio operacional
          </h2>
          <p className="text-[12.5px] text-gray-400 mt-0.5">
            Resumo para revisao da equipe contabil
          </p>
        </div>
        <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-teal-50 text-[#0d9488] border border-teal-100">
          {reconciliation.results.length} resultado(s)
        </span>
      </div>

      <div className="space-y-4">
        <ReportSection title="Contas conciliadas" icon={<CheckCircle2 className="w-4 h-4" />}>
          {reconciled.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">Nenhuma conta conciliada.</p>
          ) : (
            <ul className="space-y-2">
              {reconciled.map((result) => (
                <li
                  key={`${result.accountCode}-${result.periodStart}`}
                  className="text-[12.5px] text-gray-600"
                >
                  {accountLabel(result)}: saldo final conferido em {fmtDate(result.finalCheckpoint?.date)}.
                </li>
              ))}
            </ul>
          )}
        </ReportSection>

        <ReportSection title="Contas com divergencia" icon={<AlertTriangle className="w-4 h-4" />}>
          {divergent.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">Nenhuma divergencia encontrada.</p>
          ) : (
            <ul className="space-y-2">
              {divergent.map((result) => (
                <li
                  key={`${result.accountCode}-${result.periodStart}`}
                  className="text-[12.5px] text-gray-600"
                >
                  {accountLabel(result)}: diferenca de {fmtCurrency(result.difference)}.
                  Ultimo dia conciliado: {fmtDate(result.lastMatchedCheckpoint?.date)}.
                  Primeira divergencia: {fmtDate(result.firstDivergentCheckpoint?.date)}.
                </li>
              ))}
            </ul>
          )}
        </ReportSection>

        <ReportSection title="Contas sem documentacao" icon={<FileWarning className="w-4 h-4" />}>
          {missingStatement.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">Nenhuma conta de disponivel sem extrato.</p>
          ) : (
            <ul className="space-y-2">
              {missingStatement.map((result) => (
                <li key={result.accountCode} className="text-[12.5px] text-gray-600">
                  {accountLabel(result)}: conta de disponivel encontrada no balancete, sem extrato correspondente.
                </li>
              ))}
            </ul>
          )}
        </ReportSection>

        <ReportSection title="Pendencias" icon={<ClipboardList className="w-4 h-4" />}>
          {pendingItems.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">Nenhuma pendencia operacional.</p>
          ) : (
            <ol className="space-y-2 list-decimal list-inside">
              {pendingItems.map((item) => (
                <li key={item} className="text-[12.5px] text-gray-600">
                  {item}
                </li>
              ))}
            </ol>
          )}
        </ReportSection>
      </div>
    </div>
  );
}
