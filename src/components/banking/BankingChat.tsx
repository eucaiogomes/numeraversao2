import { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, Banknote, Loader2, X, FileText, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import {
  runFileClassifierAgent,
  type ClassificationSummary,
} from '@/lib/banking/file-classifier-agent';
import { runCompletenessAgent, mergeSummaries } from '@/lib/banking/completeness-agent';
import { runReconciliationAgent, type ReconciliationStep } from '@/lib/banking/reconciliation-agent';
import { saveBankingReconciliation } from '@/lib/banking/banking-reconciliation-store';
import type { BalanceReconciliationResult, BankingReviewItem } from '@/lib/banking/types';
import { ChatDashboard } from './ChatDashboard';

export type ChatMessageKind = 'system' | 'user' | 'thinking' | 'question' | 'dashboard';

export interface ChatAttachment {
  name: string;
  size: number;
  type: string;
}

export interface ChatMessage {
  id: string;
  kind: ChatMessageKind;
  text?: string;
  attachments?: ChatAttachment[];
  thinkingSteps?: ThinkingStep[];
  isReady?: boolean;
  canProceed?: boolean;
  proceedText?: string;
  reconciliationResults?: BalanceReconciliationResult[];
  reconciliationReviewItems?: BankingReviewItem[];
  reconciliationId?: string;
  competence?: string;
  createdAt: number;
}

export interface ThinkingStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

type ChatPhase = 'idle' | 'processing' | 'awaiting_files' | 'ready';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  kind: 'system',
  text: 'Olá! Envie o balancete Questor (XLS/XLSX), o razão Questor (XLS/XLSX) e os extratos bancários em PDF para iniciarmos a conciliação.',
  createdAt: Date.now(),
};

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileText className="w-3.5 h-3.5 text-[#0d9488]" />;
  return <FileSpreadsheet className="w-3.5 h-3.5 text-[#0d9488]" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SystemBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3 max-w-full md:max-w-[640px]">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0d9488] to-[#0a2520] flex items-center justify-center shrink-0 mt-0.5">
        <Banknote className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-gray-200/80 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-[13.5px] text-[#0a2520] leading-relaxed">
        {message.text}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="flex flex-col items-end gap-2 max-w-[85%] md:max-w-[560px]">
        {message.text && (
          <div className="bg-[#0d9488] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[13.5px] leading-relaxed">
            {message.text}
          </div>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {message.attachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 shadow-sm"
              >
                <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                  {fileIcon(file.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-[#0a2520] truncate">{file.name}</p>
                  <p className="text-[11px] text-gray-400">{formatBytes(file.size)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble({ message }: { message: ChatMessage }) {
  const steps = message.thinkingSteps ?? [];
  const hasRunning = steps.some((s) => s.status === 'running');

  return (
    <div className="flex items-start gap-3 max-w-full md:max-w-[640px]">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0d9488] to-[#0a2520] flex items-center justify-center shrink-0 mt-0.5">
        {hasRunning ? (
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        ) : (
          <Banknote className="w-4 h-4 text-white" />
        )}
      </div>
      <div className="bg-white border border-gray-200/80 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm space-y-2 min-w-[260px]">
        {message.text && (
          <p className="text-[13.5px] text-[#0a2520] font-medium mb-3">{message.text}</p>
        )}
        {steps.map((step) => (
          <div key={step.id} className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0">
              {step.status === 'running' && (
                <Loader2 className="w-3.5 h-3.5 text-[#0d9488] animate-spin" />
              )}
              {step.status === 'done' && (
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              )}
              {step.status === 'error' && (
                <div className="w-3.5 h-3.5 rounded-full bg-red-400 flex items-center justify-center">
                  <X className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              {step.status === 'pending' && (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />
              )}
            </div>
            <div className="min-w-0">
              <span
                className={`text-[12.5px] ${
                  step.status === 'running'
                    ? 'text-[#0d9488] font-medium'
                    : step.status === 'done'
                      ? 'text-gray-500'
                      : step.status === 'error'
                        ? 'text-red-600'
                        : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
              {step.detail && (
                <p className="text-[11.5px] text-gray-400 mt-0.5">{step.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionBubble({ message, onProceed }: { message: ChatMessage; onProceed?: () => void }) {
  return (
    <div className="flex items-start gap-3 max-w-full md:max-w-[640px]">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0d9488] to-[#0a2520] flex items-center justify-center shrink-0 mt-0.5">
        <Banknote className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-[13.5px] text-[#7c4a03] leading-relaxed">
          {message.text}
        </div>
        {onProceed && message.canProceed && (
          <div className="flex gap-2 pl-1">
            <button
              onClick={onProceed}
              className="px-3 py-1.5 rounded-lg bg-[#0d9488] text-white text-[12px] font-medium hover:bg-[#0b8276] transition-colors"
            >
              {message.proceedText ?? 'Prosseguir com os disponíveis'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReadyBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3 max-w-full md:max-w-[640px]">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
        <CheckCircle2 className="w-4 h-4 text-white" />
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-[13.5px] text-emerald-800 leading-relaxed">
        {message.text}
      </div>
    </div>
  );
}

function DashboardBubble({ message }: { message: ChatMessage }) {
  if (
    !message.reconciliationResults ||
    !message.reconciliationReviewItems ||
    !message.reconciliationId ||
    !message.competence
  ) return null;

  return (
    <ChatDashboard
      reconciliationId={message.reconciliationId}
      results={message.reconciliationResults}
      initialReviewItems={message.reconciliationReviewItems}
      competence={message.competence}
    />
  );
}

function ChatMessageRow({ message, onProceed }: { message: ChatMessage; onProceed?: () => void }) {
  if (message.kind === 'user') return <UserBubble message={message} />;
  if (message.kind === 'thinking') return <ThinkingBubble message={message} />;
  if (message.kind === 'question') return <QuestionBubble message={message} onProceed={onProceed} />;
  if (message.kind === 'dashboard') return <DashboardBubble message={message} />;
  if (message.isReady) return <ReadyBubble message={message} />;
  return <SystemBubble message={message} />;
}

function PendingFileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5 text-[12px]">
      {fileIcon(file.name)}
      <span className="text-[#0a2520] font-medium truncate max-w-[140px]">{file.name}</span>
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 transition-colors ml-0.5"
        aria-label="Remover arquivo"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function buildClassificationSummaryText(summary: ClassificationSummary): string {
  const parts: string[] = [];
  if (summary.trialBalance) parts.push('1 balancete');
  if (summary.ledger) parts.push('1 razão');
  const stmts = summary.checkingStatements.length + summary.investmentStatements.length;
  if (stmts > 0) parts.push(`${stmts} extrato(s)`);
  if (summary.unknown.length > 0) parts.push(`${summary.unknown.length} não reconhecido(s)`);
  return `Identificado: ${parts.join(', ')}.`;
}

export function BankingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [inputText, setInputText] = useState('');
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [accumulatedSummary, setAccumulatedSummary] = useState<ClassificationSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function addFiles(incoming: File[]) {
    setPendingFiles((current) => {
      const existingNames = new Set(current.map((f) => f.name));
      return [...current, ...incoming.filter((f) => !existingNames.has(f.name))];
    });
  }

  function removeFile(index: number) {
    setPendingFiles((current) => current.filter((_, i) => i !== index));
  }

  function addMessage(msg: ChatMessage) {
    setMessages((current) => [...current, msg]);
  }

  function updateThinkingStep(thinkingId: string, stepId: string, patch: Partial<ThinkingStep>) {
    setMessages((current) =>
      current.map((msg) => {
        if (msg.id !== thinkingId) return msg;
        return {
          ...msg,
          thinkingSteps: (msg.thinkingSteps ?? []).map((s) =>
            s.id === stepId ? { ...s, ...patch } : s,
          ),
        };
      }),
    );
  }

  function patchMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((current) =>
      current.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg)),
    );
  }

  async function runPhase2(files: File[]): Promise<ClassificationSummary> {
    const thinkingId = crypto.randomUUID();
    const stepIds: Record<string, string> = {};
    files.forEach((f) => { stepIds[f.name] = crypto.randomUUID(); });

    addMessage({
      id: thinkingId,
      kind: 'thinking',
      text: 'Identificando arquivos...',
      thinkingSteps: files.map((f) => ({
        id: stepIds[f.name],
        label: f.name,
        status: 'pending',
      })),
      createdAt: Date.now(),
    });

    const summary = await runFileClassifierAgent(files, (progress) => {
      const stepId = stepIds[progress.fileName];
      if (!stepId) return;
      if (progress.status === 'running') {
        updateThinkingStep(thinkingId, stepId, { status: 'running' });
      } else if (progress.status === 'done') {
        updateThinkingStep(thinkingId, stepId, { status: 'done', detail: progress.detail });
      } else {
        updateThinkingStep(thinkingId, stepId, { status: 'error', detail: progress.error });
      }
    });

    patchMessage(thinkingId, { text: 'Arquivos identificados' });

    addMessage({
      id: crypto.randomUUID(),
      kind: 'system',
      text: buildClassificationSummaryText(summary),
      createdAt: Date.now(),
    });

    return summary;
  }

  async function runPhase4(summary: ClassificationSummary) {
    const thinkingId = crypto.randomUUID();
    let messageCreated = false;

    const { results, reviewItems } = await runReconciliationAgent(
      summary,
      (steps: ReconciliationStep[]) => {
        const thinkingSteps = steps.map((s) => ({
          id: s.id,
          label: s.label,
          status: s.status,
          detail: s.detail,
        }));

        if (!messageCreated) {
          messageCreated = true;
          addMessage({
            id: thinkingId,
            kind: 'thinking',
            text: 'Conciliando...',
            thinkingSteps,
            createdAt: Date.now(),
          });
        } else {
          setMessages((current) =>
            current.map((msg) =>
              msg.id === thinkingId ? { ...msg, thinkingSteps } : msg,
            ),
          );
        }
      },
    );

    patchMessage(thinkingId, { text: 'Conciliação concluída' });

    // Derive competence from statement periods
    const allPeriods = [
      ...summary.checkingStatements.map((s) => s.result.periodEnd),
      ...summary.investmentStatements.map((s) => s.result.periodEnd),
    ].sort();
    const latestPeriod = allPeriods.at(-1);
    const competence = latestPeriod
      ? latestPeriod.slice(0, 7) // "YYYY-MM"
      : new Date().toISOString().slice(0, 7);

    const reconciliationId = crypto.randomUUID();

    // Save to store (fire and forget — non-blocking)
    saveBankingReconciliation({
      id: reconciliationId,
      competence,
      createdAt: new Date().toISOString(),
      fileNames: {
        trialBalance: summary.trialBalance?.file.name ?? 'Não enviado',
        ledger: summary.ledger?.file.name ?? '',
        statements: [
          ...summary.checkingStatements.map((s) => s.file.name),
          ...summary.investmentStatements.map((s) => s.file.name),
        ],
      },
      bankAccountsCount: summary.trialBalance?.result.bankLikeAccounts.length ?? results.length,
      ledgerAccountsCount: summary.ledger?.result.accounts.length ?? 0,
      statementsCount: summary.checkingStatements.length,
      investmentStatementsCount: summary.investmentStatements.length,
      investmentStatements: summary.investmentStatements.map((s) => s.result),
      results,
      reviewItems,
    }).catch(() => {});

    addMessage({
      id: crypto.randomUUID(),
      kind: 'dashboard',
      reconciliationId,
      competence,
      reconciliationResults: results,
      reconciliationReviewItems: reviewItems,
      createdAt: Date.now(),
    });

    setPhase('idle');
  }

  async function runPhase3(summary: ClassificationSummary, autoReconcile = true) {
    const checkingId = crypto.randomUUID();

    addMessage({
      id: checkingId,
      kind: 'thinking',
      text: 'Verificando completude...',
      thinkingSteps: [
        { id: 'tb', label: 'Balancete', status: summary.trialBalance ? 'done' : 'pending', detail: summary.trialBalance ? `${summary.trialBalance.result.bankLikeAccounts.length} conta(s) bancária(s)` : 'Opcional quando o Razão permite identificar a conta' },
        { id: 'lg', label: 'Razão', status: summary.ledger ? 'done' : 'error', detail: summary.ledger ? `${summary.ledger.result.accounts.length} conta(s)` : 'Não encontrado' },
        { id: 'st', label: 'Extratos', status: (summary.checkingStatements.length + summary.investmentStatements.length) > 0 ? 'done' : 'error', detail: `${summary.checkingStatements.length} corrente(s), ${summary.investmentStatements.length} aplicação(ões)` },
      ],
      createdAt: Date.now(),
    });

    // Small delay so the user sees the thinking steps render
    await new Promise((r) => setTimeout(r, 400));

    const result = runCompletenessAgent(summary);

    if (result.ready) {
      patchMessage(checkingId, { text: 'Tudo pronto para conciliar' });
      addMessage({
        id: crypto.randomUUID(),
        kind: 'system',
        isReady: true,
        text: result.warningText
          ? `Tudo certo! ${result.matchedAccounts} conta(s) com extrato. ${result.warningText} Iniciando conciliação...`
          : `Tudo certo! ${result.matchedAccounts} conta(s) com extrato. Iniciando conciliação...`,
        createdAt: Date.now(),
      });
      if (autoReconcile) {
        await runPhase4(summary);
      } else {
        setPhase('ready');
      }
    } else {
      patchMessage(checkingId, { text: 'Verificação concluída' });
      addMessage({
        id: crypto.randomUUID(),
        kind: 'question',
        text: result.questionText,
        canProceed: result.canProceed,
        proceedText: result.proceedText,
        createdAt: Date.now(),
      });
      setPhase('awaiting_files');
    }
  }

  async function handleSend() {
    const hasText = inputText.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if ((!hasText && !hasFiles) || phase === 'processing') return;

    const filesToProcess = [...pendingFiles];
    const text = inputText.trim();

    addMessage({
      id: crypto.randomUUID(),
      kind: 'user',
      text: hasText ? text : undefined,
      attachments: hasFiles
        ? filesToProcess.map((f) => ({ name: f.name, size: f.size, type: f.type }))
        : undefined,
      createdAt: Date.now(),
    });

    setInputText('');
    setPendingFiles([]);

    // Text-only reply while awaiting files: just acknowledge
    if (!hasFiles) {
      const lower = text.toLowerCase();
      const wantsToProceed =
        lower.includes('sim') ||
        lower.includes('yes') ||
        lower.includes('ok') ||
        lower.includes('prosseguir') ||
        lower.includes('continuar') ||
        lower.includes('sem') ||
        lower.includes('ignore') ||
        lower.includes('ignorar');

      const lastQuestion = [...messages].reverse().find((msg) => msg.kind === 'question');

      if (
        phase === 'awaiting_files' &&
        wantsToProceed &&
        accumulatedSummary &&
        lastQuestion?.canProceed
      ) {
        addMessage({
          id: crypto.randomUUID(),
          kind: 'system',
          text: 'Ok, prosseguindo com os documentos disponíveis.',
          createdAt: Date.now(),
        });
        setPhase('processing');
        try {
          await runPhase4(accumulatedSummary);
        } finally {
          setPhase('idle');
        }
      } else if (phase === 'awaiting_files' && wantsToProceed) {
        addMessage({
          id: crypto.randomUUID(),
          kind: 'system',
          text: 'Ainda não consigo prosseguir: preciso do Razão Questor e de pelo menos um extrato para comparar os saldos.',
          createdAt: Date.now(),
        });
      }
      return;
    }

    setPhase('processing');

    try {
      const incomingSummary = await runPhase2(filesToProcess);

      const mergedSummary =
        accumulatedSummary != null
          ? mergeSummaries(accumulatedSummary, incomingSummary)
          : incomingSummary;

      setAccumulatedSummary(mergedSummary);
      await runPhase3(mergedSummary);
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        kind: 'system',
        text: `Erro ao processar: ${err instanceof Error ? err.message : 'Falha desconhecida'}`,
        createdAt: Date.now(),
      });
      setPhase('idle');
    }
  }

  async function handleProceed() {
    if (phase !== 'awaiting_files' || !accumulatedSummary) return;
    const lastQuestion = [...messages].reverse().find((msg) => msg.kind === 'question');
    if (!lastQuestion?.canProceed) return;

    addMessage({
      id: crypto.randomUUID(),
      kind: 'user',
      text: lastQuestion.proceedText ?? 'Prosseguir com os disponíveis',
      createdAt: Date.now(),
    });
    addMessage({
      id: crypto.randomUUID(),
      kind: 'system',
      text: 'Ok, prosseguindo com os documentos disponíveis.',
      createdAt: Date.now(),
    });
    setPhase('processing');
    try {
      await runPhase4(accumulatedSummary);
    } finally {
      setPhase('idle');
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const isProcessing = phase === 'processing';
  const canSend = (inputText.trim().length > 0 || pendingFiles.length > 0) && !isProcessing;

  const inputPlaceholder =
    phase === 'awaiting_files'
      ? 'Envie os arquivos faltantes para continuar...'
      : isProcessing
        ? 'Processando...'
        : 'Envie arquivos ou escreva uma mensagem...';

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] md:h-[calc(100vh-7rem)] max-w-3xl mx-auto">
      <div className="mb-3 md:mb-4">
        <h1 className="text-lg md:text-xl font-semibold text-[#0a2520] tracking-tight">
          Conciliação bancária
        </h1>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Balancete Questor, Razão Questor e extratos digitais
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((message) => (
          <ChatMessageRow
            key={message.id}
            message={message}
            onProceed={message.kind === 'question' && phase === 'awaiting_files' ? handleProceed : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
        {pendingFiles.length > 0 && (
          <div className="px-3 md:px-4 pt-3 flex flex-wrap gap-2">
            {pendingFiles.map((file, i) => (
              <PendingFileChip
                key={`${file.name}-${i}`}
                file={file}
                onRemove={() => removeFile(i)}
              />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 px-3 py-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || phase === 'ready'}
            className="w-9 h-9 shrink-0 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#0d9488] hover:border-[#0d9488]/40 hover:bg-teal-50/50 disabled:opacity-40 transition-colors"
            aria-label="Anexar arquivos"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xls,.xlsx,.pdf"
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (files.length > 0) addFiles(files);
            }}
          />

          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            rows={1}
            disabled={isProcessing}
            className="flex-1 resize-none text-[13.5px] text-[#0a2520] placeholder:text-gray-400 outline-none bg-transparent leading-relaxed max-h-[120px] overflow-y-auto disabled:opacity-50"
            style={{ minHeight: 36 }}
          />

          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-9 h-9 shrink-0 rounded-xl bg-[#0d9488] text-white flex items-center justify-center hover:bg-[#0a7a70] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Enviar"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
