import { AlertTriangle, Download, FileCheck2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BankingReconciliationCase } from '@/lib/banking/banking-reconciliation-store';
import { buildApprovedQuestorImportFile } from '@/lib/banking/questor-import-export';

function fmtCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function QuestorImportExportPanel({
  reconciliation,
}: {
  reconciliation: BankingReconciliationCase;
}) {
  const [incomeCreditAccountCode, setIncomeCreditAccountCode] = useState('');
  const [incomeTaxDebitAccountCode, setIncomeTaxDebitAccountCode] = useState('');
  const [historyCode, setHistoryCode] = useState('');
  const importFile = useMemo(
    () =>
      buildApprovedQuestorImportFile(reconciliation, {
        investmentIncomeCreditAccountCode: incomeCreditAccountCode.trim() || undefined,
        investmentIncomeTaxDebitAccountCode: incomeTaxDebitAccountCode.trim() || undefined,
        historyCode: historyCode.trim() || undefined,
      }),
    [historyCode, incomeCreditAccountCode, incomeTaxDebitAccountCode, reconciliation],
  );
  const hasRows = importFile.rows.length > 0;

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm p-4 mb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-[#0d9488] shrink-0">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#0a2520]">
              Arquivo Questor
            </h2>
            <p className="text-[12.5px] text-gray-400 mt-0.5">
              Layout padrao: data; debito; credito; valor; historico; complemento
            </p>
          </div>
        </div>
        <button
          onClick={() => downloadTextFile(importFile.fileName, importFile.content)}
          disabled={!hasRows}
          className="h-9 px-3 rounded-lg bg-[#0a2520] text-white text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-[#0d3530] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Baixar
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
            Aprovadas
          </p>
          <p className="text-lg font-semibold text-[#0a2520]">{importFile.approvedCount}</p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700">
            Exportaveis
          </p>
          <p className="text-lg font-semibold text-emerald-700">{importFile.rows.length}</p>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-amber-700">
            Para revisar
          </p>
          <p className="text-lg font-semibold text-amber-700">
            {importFile.blockedEntries.length}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-4">
        <label className="block">
          <span className="text-[12px] font-medium text-gray-500">
            Conta credito receita financeira
          </span>
          <input
            value={incomeCreditAccountCode}
            onChange={(event) => setIncomeCreditAccountCode(event.target.value)}
            placeholder="Ex.: 1234"
            className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-[12.5px] text-gray-600 outline-none focus:border-[#0d9488]/60 focus:ring-2 focus:ring-[#0d9488]/10"
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-gray-500">
            Conta debito IR aplicacao
          </span>
          <input
            value={incomeTaxDebitAccountCode}
            onChange={(event) => setIncomeTaxDebitAccountCode(event.target.value)}
            placeholder="Ex.: 5678"
            className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-[12.5px] text-gray-600 outline-none focus:border-[#0d9488]/60 focus:ring-2 focus:ring-[#0d9488]/10"
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-gray-500">
            Codigo historico
          </span>
          <input
            value={historyCode}
            onChange={(event) => setHistoryCode(event.target.value)}
            placeholder="Opcional"
            className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-[12.5px] text-gray-600 outline-none focus:border-[#0d9488]/60 focus:ring-2 focus:ring-[#0d9488]/10"
          />
        </label>
      </div>

      {!hasRows && importFile.approvedCount === 0 && (
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-[12.5px] text-gray-500">
          Aprove um lancamento sugerido na revisao operacional para liberar o arquivo de importacao.
        </div>
      )}

      {hasRows && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400">
                <th className="py-2 pr-3 text-left font-medium">Data</th>
                <th className="py-2 px-3 text-left font-medium">Debito</th>
                <th className="py-2 px-3 text-left font-medium">Credito</th>
                <th className="py-2 px-3 text-right font-medium">Valor</th>
                <th className="py-2 pl-3 text-left font-medium">Complemento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {importFile.rows.map((row) => (
                <tr key={row.suggestedEntryId}>
                  <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{fmtDate(row.date)}</td>
                  <td className="py-2 px-3 text-gray-600">{row.debitAccountCode}</td>
                  <td className="py-2 px-3 text-gray-600">{row.creditAccountCode}</td>
                  <td className="py-2 px-3 text-right font-semibold text-[#0a2520]">
                    {fmtCurrency(row.amount)}
                  </td>
                  <td className="py-2 pl-3 text-gray-500 min-w-[240px]">
                    {row.historyComplement}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importFile.blockedEntries.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-3">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            <p className="text-[12.5px] font-semibold">Sugestoes aprovadas ainda nao exportadas</p>
          </div>
          <ul className="mt-2 space-y-1">
            {importFile.blockedEntries.map((entry) => (
              <li key={entry.suggestedEntryId} className="text-[12.5px] text-amber-800">
                {entry.history}: {entry.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
