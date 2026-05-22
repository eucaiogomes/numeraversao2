import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { parseQuestorTrialBalance } from '@/lib/banking/questor-balancete-parser';
import { parseQuestorLedger } from '@/lib/banking/questor-razao-parser';
import { parseViacrediDocumentPdf } from '@/lib/banking/viacredi-document-parser';
import { matchBankAccountsToStatements } from '@/lib/banking/account-statement-matcher';
import { reconcileMatchedBankAccounts } from '@/lib/banking/balance-reconciliation-engine';
import { buildBankingReviewItems } from '@/lib/banking/banking-review-items';
import { saveBankingReconciliation } from '@/lib/banking/banking-reconciliation-store';
import type { BalanceReconciliationResult } from '@/lib/banking/types';

type FileRole = 'trialBalance' | 'ledger' | 'statements';

interface ProcessingSummary {
  availableAccounts: number;
  ledgerAccounts: number;
  checkingStatements: number;
  investmentStatements: number;
  results: BalanceReconciliationResult[];
}

function fmtCurrency(value: number | undefined) {
  if (value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function FileSlot({
  title,
  description,
  file,
  files,
  accept,
  multiple,
  icon,
  onSelect,
  onRemove,
}: {
  title: string;
  description: string;
  file?: File | null;
  files?: File[];
  accept: string;
  multiple?: boolean;
  icon: React.ReactNode;
  onSelect: (files: File[]) => void;
  onRemove: (index?: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedFiles = file ? [file] : files ?? [];

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-[#0d9488] shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-[#0a2520]">{title}</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="h-8 px-3 rounded-lg bg-[#0a2520] text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-[#0d3530] transition-colors"
        >
          {selectedFiles.length > 0 && !multiple ? (
            <RefreshCw className="w-3.5 h-3.5" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {selectedFiles.length > 0 && !multiple ? 'Substituir' : 'Enviar'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const incoming = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (incoming.length > 0) onSelect(incoming);
        }}
      />

      <div className="mt-4 space-y-2">
        {selectedFiles.length === 0 ? (
          <div className="h-10 rounded-lg border border-dashed border-gray-200 bg-gray-50/70 flex items-center px-3 text-[12.5px] text-gray-400">
            Nenhum arquivo selecionado
          </div>
        ) : (
          selectedFiles.map((selectedFile, index) => (
            <div
              key={`${selectedFile.name}-${selectedFile.lastModified}-${index}`}
              className="h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center gap-2 px-3"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-[12.5px] text-gray-600 truncate flex-1">
                {selectedFile.name}
              </span>
              <button
                onClick={() => onRemove(multiple ? index : undefined)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                aria-label="Remover arquivo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ResultLine({ result }: { result: BalanceReconciliationResult }) {
  const statusLabel: Record<BalanceReconciliationResult['status'], string> = {
    reconciled: 'Conciliada',
    divergent: 'Divergente',
    missing_statement: 'Sem extrato',
    missing_ledger: 'Sem razão',
    insufficient_data: 'Dados insuficientes',
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
        <Banknote className="w-4 h-4 text-[#0d9488]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-semibold text-[#0a2520]">
            {result.accountCode} - {result.accountName}
          </span>
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
              result.status === 'reconciled'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : result.status === 'divergent'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            {statusLabel[result.status]}
          </span>
        </div>
        <p className="text-[12px] text-gray-400 mt-0.5">
          {result.periodStart && result.periodEnd
            ? `${result.periodStart} a ${result.periodEnd}`
            : result.message}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12px] text-gray-400">Diferença</p>
        <p className="text-[13px] font-semibold text-[#0a2520]">
          {fmtCurrency(result.difference)}
        </p>
      </div>
    </div>
  );
}

export function BankingUploadForm() {
  const navigate = useNavigate();
  const [competence, setCompetence] = useState('2025-11');
  const [trialBalanceFile, setTrialBalanceFile] = useState<File | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [statementFiles, setStatementFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ProcessingSummary | null>(null);

  const canProcess = !!trialBalanceFile && !!ledgerFile && statementFiles.length > 0 && !processing;

  async function processFiles() {
    if (!trialBalanceFile || !ledgerFile || statementFiles.length === 0) return;

    setProcessing(true);
    setError('');
    setSummary(null);

    try {
      const [trialBalance, ledger] = await Promise.all([
        trialBalanceFile.arrayBuffer().then(parseQuestorTrialBalance),
        ledgerFile.arrayBuffer().then(parseQuestorLedger),
      ]);
      const parsedDocuments = await Promise.all(
        statementFiles.map((file) => parseViacrediDocumentPdf(file)),
      );
      const statements = parsedDocuments
        .filter((document) => document.type === 'checking_statement')
        .map((document) => document.statement);
      const investmentStatements = parsedDocuments
        .filter((document) => document.type === 'investment_statement')
        .map((document) => document.statement);
      const matches = matchBankAccountsToStatements(
        trialBalance.bankLikeAccounts,
        ledger,
        statements,
      );
      const results = reconcileMatchedBankAccounts(matches);
      const id = crypto.randomUUID();

      const processedSummary = {
        availableAccounts: trialBalance.bankLikeAccounts.length,
        ledgerAccounts: ledger.accounts.length,
        checkingStatements: statements.length,
        investmentStatements: investmentStatements.length,
        results,
      };

      await saveBankingReconciliation({
        id,
        competence,
        createdAt: new Date().toISOString(),
        fileNames: {
          trialBalance: trialBalanceFile.name,
          ledger: ledgerFile.name,
          statements: statementFiles.map((file) => file.name),
        },
        bankAccountsCount: processedSummary.availableAccounts,
        ledgerAccountsCount: processedSummary.ledgerAccounts,
        statementsCount: processedSummary.checkingStatements,
        investmentStatementsCount: processedSummary.investmentStatements,
        investmentStatements,
        results,
        reviewItems: buildBankingReviewItems(results),
      });

      setSummary(processedSummary);
      await navigate({ to: '/conciliacao-bancaria/$id', params: { id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível processar os arquivos.');
    } finally {
      setProcessing(false);
    }
  }

  function removeStatement(index?: number) {
    if (index === undefined) return;
    setStatementFiles((files) => files.filter((_, fileIndex) => fileIndex !== index));
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#0a2520] tracking-tight">
            Nova conciliação bancária
          </h1>
          <p className="text-[13px] text-gray-400 mt-1">
            Balancete Questor, Razão Questor e extratos digitais
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm px-3 py-2">
          <label className="block text-[11px] font-medium text-gray-400 mb-1">Competência</label>
          <input
            type="month"
            value={competence}
            onChange={(event) => setCompetence(event.target.value)}
            className="text-[13px] text-[#0a2520] font-medium outline-none bg-transparent"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <FileSlot
          title="Balancete Questor"
          description="Arquivo único em XLS ou XLSX"
          file={trialBalanceFile}
          accept=".xls,.xlsx"
          icon={<FileSpreadsheet className="w-4 h-4" />}
          onSelect={(files) => setTrialBalanceFile(files[0] ?? null)}
          onRemove={() => setTrialBalanceFile(null)}
        />
        <FileSlot
          title="Razão Questor"
          description="Arquivo único em XLS ou XLSX"
          file={ledgerFile}
          accept=".xls,.xlsx"
          icon={<FileSpreadsheet className="w-4 h-4" />}
          onSelect={(files) => setLedgerFile(files[0] ?? null)}
          onRemove={() => setLedgerFile(null)}
        />
        <FileSlot
          title="Extratos digitais"
          description="Conta corrente e aplicacao"
          files={statementFiles}
          accept=".pdf"
          multiple
          icon={<FileText className="w-4 h-4" />}
          onSelect={(files) => setStatementFiles((current) => [...current, ...files])}
          onRemove={removeStatement}
        />
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-[13px] text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-3">
        <span className="text-[12px] text-gray-400">
          {statementFiles.length} extrato(s) anexado(s)
        </span>
        <button
          onClick={processFiles}
          disabled={!canProcess}
          className="h-10 px-5 rounded-lg bg-[#0d9488] text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[#0a7a70] disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          {processing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Banknote className="w-4 h-4" />
          )}
          Processar conciliação
        </button>
      </div>

      {summary && (
        <div className="mt-6 bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-[#0a2520]">
                Prévia do processamento
              </h2>
              <p className="text-[12px] text-gray-400 mt-0.5">
                {summary.availableAccounts} conta(s) de disponivel, {summary.ledgerAccounts} conta(s) no Razão, {summary.checkingStatements} conta corrente, {summary.investmentStatements} aplicacao
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="px-4">
            {summary.results.map((result, index) => (
              <ResultLine
                key={`${result.accountCode}-${result.periodStart ?? 'none'}-${index}`}
                result={result}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
