import { Banknote, Percent } from 'lucide-react';
import type { InvestmentStatementEntry, ViacrediInvestmentStatement } from '@/lib/banking/types';

function fmtCurrency(value: number | undefined) {
  if (value === undefined) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(value: string | undefined) {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function EntryList({
  title,
  entries,
}: {
  title: string;
  entries: InvestmentStatementEntry[];
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400 mb-2">
        {title}
      </p>
      {entries.length === 0 ? (
        <p className="text-[12.5px] text-gray-400">Nenhum movimento identificado.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {entries.map((entry) => (
            <div key={`${entry.sequence}-${entry.date}-${entry.description}`} className="py-2 flex gap-3">
              <span className="text-[12px] text-gray-400 w-20 shrink-0">
                {fmtDate(entry.date)}
              </span>
              <span className="text-[12.5px] text-gray-600 flex-1">
                {entry.description}
              </span>
              <span className="text-[12.5px] font-semibold text-[#0a2520]">
                {fmtCurrency(Math.abs(entry.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BankingInvestmentStatements({
  statements,
}: {
  statements: ViacrediInvestmentStatement[];
}) {
  if (statements.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm p-4 mb-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#0a2520]">
            Extratos de aplicacao lidos
          </h2>
          <p className="text-[12.5px] text-gray-400 mt-0.5">
            Dados extraidos dos PDFs de aplicacao programada
          </p>
        </div>
        <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-teal-50 text-[#0d9488] border border-teal-100">
          {statements.length} extrato(s)
        </span>
      </div>

      <div className="space-y-4">
        {statements.map((statement, index) => (
          <div
            key={`${statement.contractNumber ?? 'sem-contrato'}-${statement.periodStart}-${index}`}
            className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-[#0d9488] shrink-0">
                <Percent className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13.5px] font-semibold text-[#0a2520]">
                  Aplicacao Programada Viacredi
                </h3>
                <p className="text-[12.5px] text-gray-400 mt-0.5">
                  {fmtDate(statement.periodStart)} a {fmtDate(statement.periodEnd)}
                  {statement.contractNumber ? ` · Contrato ${statement.contractNumber}` : ''}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
                  Saldo anterior
                </p>
                <p className="text-[14px] font-semibold text-[#0a2520] mt-1">
                  {fmtCurrency(statement.openingBalance)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
                  Saldo final
                </p>
                <p className="text-[14px] font-semibold text-[#0a2520] mt-1">
                  {fmtCurrency(statement.finalBalance)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
                  Rendimento
                </p>
                <p className="text-[14px] font-semibold text-[#0a2520] mt-1">
                  {fmtCurrency(
                    statement.monthlyIncomeProvisions.reduce((sum, entry) => sum + entry.credit, 0),
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">
                  IR
                </p>
                <p className="text-[14px] font-semibold text-[#0a2520] mt-1">
                  {fmtCurrency(statement.incomeTaxDebits.reduce((sum, entry) => sum + entry.debit, 0))}
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <EntryList title="Aplicacoes" entries={statement.monthlyApplications} />
              <EntryList title="Provisoes / rendimentos" entries={statement.monthlyIncomeProvisions} />
              <EntryList title="IR sobre aplicacao" entries={statement.incomeTaxDebits} />
            </div>

            <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/70 px-3 py-3 flex items-center gap-2 text-[12.5px] text-[#0d9488]">
              <Banknote className="w-4 h-4 shrink-0" />
              Extrato lido. A comparacao com o Razao e a sugestao de lancamentos entram na fase 9.3.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
