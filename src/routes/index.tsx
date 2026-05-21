import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Paperclip,
  Mic,
  Settings,
  SendHorizonal,
  Calculator,
  Scale,
  BarChart3,
  FileText,
  ArrowUpRight,
  Command,
  Sparkles,
  X,
  Square,
  Check,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { parseOFX } from '@/lib/ofx-parser';
import { parseCSVText, detectColumns, applyMapping } from '@/lib/csv-parser';
import { runMatching } from '@/lib/matching-engine';
import { saveReconciliation } from '@/lib/reconciliation-store';
import { CSVColumnMapper } from '@/components/reconciliation/CSVColumnMapper';
import type { CSVColumnMapping } from '@/lib/csv-parser';

export const Route = createFileRoute('/')({
  component: Index,
});

type Tab = {
  id: string;
  icon: typeof Calculator;
  label: string;
  suggestions: string[];
};

const TABS: Tab[] = [
  {
    id: 'conciliacao',
    icon: Calculator,
    label: 'Conciliação',
    suggestions: [
      'Conciliar extrato bancário com lançamentos contábeis',
      'Identificar lançamentos não conciliados',
      'Analisar diferenças de conciliação',
      'Gerar relatório de conciliação',
    ],
  },
  {
    id: 'juridico',
    icon: Scale,
    label: 'Jurídico',
    suggestions: [
      'Analisar obrigações fiscais acessórias',
      'Revisar contrato de prestação de serviços contábeis',
      'Avaliar riscos tributários em operação societária',
    ],
  },
  {
    id: 'contabil',
    icon: BarChart3,
    label: 'Contábil',
    suggestions: [
      'Elaborar DRE do período',
      'Montar Balanço Patrimonial',
      'Apurar resultado do exercício',
    ],
  },
  {
    id: 'tributario',
    icon: FileText,
    label: 'Tributário',
    suggestions: [
      'Calcular Simples Nacional do mês',
      'Apurar PIS, COFINS e ICMS',
      'Gerar guia de DARF e DAS',
    ],
  },
];

interface AttachedFile {
  file: File;
  type: 'ofx' | 'csv';
  text: string;
}

type ProcessStep =
  | 'idle'
  | 'reading'
  | 'csv_mapping'
  | 'matching'
  | 'saving'
  | 'done'
  | 'error';

function Index() {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // File attachment state
  const [attachedOFX, setAttachedOFX] = useState<AttachedFile | null>(null);
  const [attachedCSV, setAttachedCSV] = useState<AttachedFile | null>(null);

  // Processing state
  const [step, setStep] = useState<ProcessStep>('idle');
  const [stepLabel, setStepLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // CSV column mapping
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvDetected, setCsvDetected] = useState<Partial<CSVColumnMapping>>({});
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [pendingMapping, setPendingMapping] = useState(false);

  const current = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const canSend = !!(attachedOFX && attachedCSV) && step === 'idle';

  useEffect(() => {
    return () => {};
  }, []);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const fill = (text: string) => {
    setValue(text);
    requestAnimationFrame(() => {
      autoResize();
      textareaRef.current?.focus();
    });
  };

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (ext === 'ofx') {
          setAttachedOFX({ file, type: 'ofx', text });
        } else if (ext === 'csv') {
          setAttachedCSV({ file, type: 'csv', text });
        }
      };
      reader.readAsText(file, 'utf-8');
    }
  }

  async function handleSend() {
    if (!canSend) return;
    setStep('reading');
    setStepLabel('Lendo arquivos…');
    setErrorMsg('');

    try {
      // Parse OFX
      setStepLabel('Analisando extrato bancário (OFX)…');
      const txsA = parseOFX(attachedOFX!.text);
      if (txsA.length === 0) throw new Error('Nenhum lançamento encontrado no arquivo OFX.');

      // Parse CSV headers
      setStepLabel('Analisando razão contábil (CSV)…');
      const { headers, rows } = parseCSVText(attachedCSV!.text);
      if (headers.length === 0) throw new Error('Arquivo CSV inválido ou vazio.');

      const detected = detectColumns(headers);
      const autoMappingOk =
        !!detected.dateColumn && !!detected.amountColumn && !!detected.descriptionColumn;

      if (!autoMappingOk) {
        // Need user to map columns
        setCsvHeaders(headers);
        setCsvDetected(detected);
        setCsvRows(rows);
        setPendingMapping(true);
        setStep('csv_mapping');
        return;
      }

      await finishProcessing(txsA, rows, detected as CSVColumnMapping);
    } catch (err) {
      setStep('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao processar arquivos.');
    }
  }

  async function finishProcessing(
    txsA: ReturnType<typeof parseOFX>,
    rows: Record<string, string>[],
    mapping: CSVColumnMapping,
  ) {
    setStep('matching');
    setStepLabel('Executando motor de conciliação…');

    const txsB = applyMapping(rows, mapping);
    if (txsB.length === 0) throw new Error('Nenhum lançamento válido no arquivo CSV.');

    const { matches, divergences } = runMatching(txsA, txsB);

    setStep('saving');
    setStepLabel('Salvando resultados…');

    const totalA = txsA.reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalB = txsB.reduce((s, t) => s + Math.abs(t.amount), 0);

    // Extract period from transactions
    const datesA = txsA.map((t) => t.postedAt).sort();
    const datesB = txsB.map((t) => t.postedAt).sort();
    const allDates = [...datesA, ...datesB].sort();
    const periodStart = allDates[0] ?? '';
    const periodEnd = allDates[allDates.length - 1] ?? '';

    // Extract account label from prompt or file name
    const accountLabel =
      value.trim() ||
      attachedOFX!.file.name.replace(/\.ofx$/i, '') + ' × ' + attachedCSV!.file.name.replace(/\.csv$/i, '');

    const id = crypto.randomUUID();
    saveReconciliation({
      id,
      prompt: value.trim(),
      periodStart,
      periodEnd,
      accountLabel,
      status: 'reviewing',
      fileAName: attachedOFX!.file.name,
      fileBName: attachedCSV!.file.name,
      totalA,
      totalB,
      matchedCount: matches.length,
      divergenceCount: divergences.length,
      transactionsA: txsA,
      transactionsB: txsB,
      matches,
      divergences,
      createdAt: new Date().toISOString(),
    });

    setStep('done');
    await navigate({ to: '/conciliacao/$id', params: { id } });
  }

  function handleCSVMappingConfirm(mapping: CSVColumnMapping) {
    setPendingMapping(false);
    setStep('matching');

    const txsA = parseOFX(attachedOFX!.text);
    finishProcessing(txsA, csvRows, mapping).catch((err) => {
      setStep('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao processar arquivos.');
    });
  }

  const isProcessing = step === 'reading' || step === 'matching' || step === 'saving';

  return (
    <AppLayout>
      {pendingMapping && (
        <CSVColumnMapper
          headers={csvHeaders}
          detected={csvDetected}
          onConfirm={handleCSVMappingConfirm}
          onCancel={() => {
            setPendingMapping(false);
            setStep('idle');
          }}
        />
      )}

      <div className="max-w-2xl mx-auto pt-10 pb-24">
        <div
          className="flex flex-col items-center mb-10 juris-rise"
          style={{ animationDelay: '60ms' }}
        >
          <h1 className="text-3xl leading-none text-[#0a2520] font-normal tracking-tight">
            Caio, o que deseja consultar?
          </h1>
          {!attachedOFX || !attachedCSV ? (
            <p className="text-[13px] text-gray-400 mt-3 text-center">
              Para conciliação bancária, anexe o extrato <strong>.ofx</strong> e o razão{' '}
              <strong>.csv</strong> usando o clipe abaixo.
            </p>
          ) : (
            <p className="text-[13px] text-[#0d9488] mt-3">
              Arquivos prontos — clique em Enviar para iniciar a conciliação.
            </p>
          )}
        </div>

        {/* Attached files preview */}
        {(attachedOFX || attachedCSV) && (
          <div className="flex gap-2 mb-3 juris-rise flex-wrap">
            {attachedOFX && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-[12.5px] text-blue-700">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">Lado A:</span>
                <span className="truncate max-w-[140px]">{attachedOFX.file.name}</span>
                <button
                  onClick={() => setAttachedOFX(null)}
                  className="ml-1 text-blue-400 hover:text-blue-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {attachedCSV && (
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-[12.5px] text-purple-700">
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">Lado B:</span>
                <span className="truncate max-w-[140px]">{attachedCSV.file.name}</span>
                <button
                  onClick={() => setAttachedCSV(null)}
                  className="ml-1 text-purple-400 hover:text-purple-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {step === 'error' && (
          <div className="flex items-center gap-2 mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
            <button onClick={() => setStep('idle')} className="ml-auto text-red-400 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Chat box */}
        <div
          className={`juris-rise juris-focus bg-white rounded-2xl shadow-[0_10px_30px_-12px_rgb(10,37,32,0.12)] border transition-all duration-300 ${
            isListening
              ? 'border-[#0d9488]/60 shadow-[0_18px_40px_-16px_rgb(13,148,136,0.35)]'
              : 'border-gray-200/80 focus-within:shadow-[0_18px_40px_-16px_rgb(13,148,136,0.25)] focus-within:border-[#0d9488]/40'
          }`}
          style={{ animationDelay: '160ms' }}
        >
          <div className="px-5 pt-4 pb-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                autoResize();
              }}
              rows={1}
              disabled={isListening || isProcessing}
              placeholder={
                isListening
                  ? 'Escutando…'
                  : isProcessing
                    ? stepLabel
                    : attachedOFX && attachedCSV
                      ? 'Descreva o período ou conta (opcional)…'
                      : 'Descreva sua consulta contábil...'
              }
              className={`w-full resize-none text-[15px] text-gray-800 placeholder:text-gray-400 leading-relaxed focus:outline-none bg-transparent max-h-48 overflow-y-auto disabled:cursor-default ${
                isListening ? 'juris-caret placeholder:text-[#0d9488] placeholder:font-medium' : ''
              }`}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              {/* Hidden file input accepts both .ofx and .csv */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.csv"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#0d9488] hover:bg-gray-50 transition-colors disabled:opacity-40"
                aria-label="Anexar"
              >
                <Paperclip className="w-[16px] h-[16px]" />
              </button>
              <button className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-gray-200 text-[12.5px] text-gray-600 hover:border-[#0d9488]/40 hover:text-[#0a2520] transition-colors">
                <Sparkles className="w-3.5 h-3.5 text-[#0d9488]" />
                Consultar
              </button>
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#0d9488] hover:bg-gray-50 transition-colors" aria-label="Configurações">
                <Settings className="w-[16px] h-[16px]" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {!isListening && !isProcessing && (
                <>
                  <span className="hidden sm:flex items-center gap-1 text-[11px] text-gray-400 pr-2">
                    <Command className="w-3 h-3" /> + Enter
                  </span>
                  <button
                    onClick={() => setIsListening(true)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#0d9488] hover:bg-gray-50 transition-colors"
                    aria-label="Ditar"
                  >
                    <Mic className="w-[16px] h-[16px]" />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                      canSend
                        ? 'bg-[#0d9488] text-white shadow-md scale-100 hover:bg-[#0a7a70]'
                        : 'bg-[#0a2520]/90 text-white'
                    }`}
                    aria-label="Enviar"
                  >
                    <SendHorizonal className="w-[16px] h-[16px]" />
                  </button>
                </>
              )}
              {isProcessing && (
                <div className="flex items-center gap-2 pr-1">
                  <span className="text-[12px] text-[#0d9488]">{stepLabel}</span>
                  <Loader2 className="w-4 h-4 text-[#0d9488] animate-spin" />
                </div>
              )}
              {isListening && (
                <>
                  <div className="hidden sm:flex items-end gap-[3px] h-5 pr-2" aria-hidden>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="w-[3px] rounded-full bg-[#0d9488]/70 juris-wave"
                        style={{ animationDelay: `${i * 90}ms` }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setIsListening(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors active:scale-95"
                    aria-label="Cancelar gravação"
                  >
                    <Square className="w-[14px] h-[14px] fill-current" />
                  </button>
                  <button
                    onClick={() => setIsListening(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-[#0d9488] to-[#0a4540] text-white shadow-[0_6px_16px_-6px_rgba(13,148,136,0.6)] transition-all active:scale-95"
                    aria-label="Confirmar"
                  >
                    <Check className="w-[16px] h-[16px]" strokeWidth={3} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick attach hint */}
        {!attachedOFX && !attachedCSV && (
          <div className="mt-3 flex items-center justify-center gap-4 text-[12px] text-gray-400">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 hover:text-[#0d9488] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Anexar extrato .ofx (Lado A)
            </button>
            <span>·</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 hover:text-[#0d9488] transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Anexar razão .csv (Lado B)
            </button>
          </div>
        )}

        {/* Suggestions panel */}
        {showSuggestions && step === 'idle' && (
          <div
            className="mt-5 juris-rise rounded-2xl border border-gray-200/70 bg-gray-50/60 shadow-[0_1px_2px_rgba(10,37,32,0.04)] overflow-hidden"
            style={{ animationDelay: '260ms' }}
          >
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-[12.5px] text-gray-500">
                <Sparkles className="w-3.5 h-3.5 text-[#0d9488]" strokeWidth={1.8} />
                <span>Experimente a IA Contábil</span>
              </div>
              <button
                onClick={() => setShowSuggestions(false)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors"
                aria-label="Fechar sugestões"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>

            <div className="h-px bg-gray-200/70" />

            <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = t.id === activeTab;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-full border transition-all ${
                      active
                        ? 'bg-white text-[#0a2520] border-gray-300 shadow-[0_1px_2px_rgba(10,37,32,0.06)]'
                        : 'bg-transparent text-gray-500 border-transparent hover:bg-white/70 hover:text-[#0a2520]'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${active ? 'text-[#0d9488]' : ''}`}
                      strokeWidth={1.8}
                    />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="h-px bg-gray-200/70" />

            <div className="px-4 py-1 flex flex-col divide-y divide-gray-200/60">
              {current.suggestions.map((s, i) => (
                <button
                  key={s}
                  onClick={() => fill(s)}
                  className="group w-full text-left flex items-center justify-between gap-4 py-2.5 text-[13.5px] text-gray-600 hover:text-[#0a2520] transition-colors juris-rise"
                  style={{ animationDelay: `${i * 50}ms`, animationDuration: '0.35s' }}
                >
                  <span className="leading-snug">{s}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#0d9488] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
