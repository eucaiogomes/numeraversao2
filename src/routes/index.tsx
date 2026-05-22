import { createFileRoute, redirect } from '@tanstack/react-router';
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
  Loader2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { parseFile, SOURCE_COLORS } from '@/lib/universal-parser';
import type { ParsedSource } from '@/lib/universal-parser';
import { runMatchingMultiSource } from '@/lib/matching-engine';
import type { TransactionSource } from '@/lib/matching-engine';
import { saveReconciliation } from '@/lib/reconciliation-store';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/conciliacao-bancaria' });
  },
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

const FORMAT_LABEL: Record<string, string> = {
  ofx: 'OFX',
  csv: 'CSV',
  xlsx: 'XLSX',
  txt: 'TXT',
  pdf: 'PDF',
  unknown: '?',
};

function Index() {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const [parsedSources, setParsedSources] = useState<ParsedSource[]>([]);

  const [processing, setProcessing] = useState(false);
  const [stepLabel, setStepLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const current = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const readySources = parsedSources.filter((p) => !p.needsMapping && p.transactions.length > 0);
  const canSend = readySources.length >= 2 && !processing;

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

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setProcessing(true);
    setStepLabel(`Lendo ${files.length} arquivo(s)…`);
    setErrorMsg('');

    const newParsed: ParsedSource[] = [];
    for (const file of files) {
      try {
        const parsed = await parseFile(file);
        newParsed.push(parsed);
      } catch (err) {
        setErrorMsg(`Erro ao ler ${file.name}: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
        setProcessing(false);
        return;
      }
    }

    setParsedSources((prev) => {
      const updated = [...prev];
      for (const p of newParsed) {
        const idx = updated.findIndex((x) => x.fileName === p.fileName);
        if (idx >= 0) updated[idx] = p;
        else updated.push(p);
      }
      return updated;
    });

    setProcessing(false);
    setStepLabel('');

  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    addFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }

  function removeSource(tempId: string) {
    setParsedSources((prev) => prev.filter((p) => p.tempId !== tempId));
  }


  async function handleSend() {
    if (!canSend) return;
    setProcessing(true);
    setStepLabel('Executando motor de conciliação…');
    setErrorMsg('');

    try {
      const sources: TransactionSource[] = readySources.map((p, i) => ({
        id: p.tempId,
        fileName: p.fileName,
        label: p.fileName.replace(/\.[^.]+$/, ''),
        format: p.format,
        color: SOURCE_COLORS[i % SOURCE_COLORS.length],
        transactions: p.transactions,
      }));

      const { matches, divergences } = runMatchingMultiSource(sources);

      setStepLabel('Salvando resultados…');
      const id = crypto.randomUUID();
      saveReconciliation({
        id,
        prompt: value.trim(),
        status: 'reviewing',
        sources,
        matches,
        divergences,
        createdAt: new Date().toISOString(),
      });

      await navigate({ to: '/conciliacao/$id', params: { id } });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao processar arquivos.');
      setProcessing(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto pt-10 pb-24">
        <div
          className="flex flex-col items-center mb-8 juris-rise"
          style={{ animationDelay: '60ms' }}
        >
          <h1 className="text-3xl leading-none text-[#0a2520] font-normal tracking-tight">
            Caio, o que deseja consultar?
          </h1>
          {readySources.length < 2 ? (
            <p className="text-[13px] text-gray-400 mt-3 text-center">
              Anexe <strong>2 ou mais arquivos</strong> (.ofx, .csv, .xlsx) para iniciar a conciliação.
            </p>
          ) : (
            <p className="text-[13px] text-[#0d9488] mt-3">
              {readySources.length} fontes prontas — clique em Enviar para iniciar a conciliação.
            </p>
          )}
        </div>

        {/* Drag-and-drop zone */}
        <div
          ref={dropZoneRef}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-4 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-[#0d9488] bg-teal-50/60'
              : parsedSources.length > 0
                ? 'border-gray-200 bg-gray-50/40 hover:border-[#0d9488]/40'
                : 'border-gray-200 bg-gray-50/40 hover:border-[#0d9488]/40 hover:bg-teal-50/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.qfx,.csv,.xlsx,.xls,.txt,.pdf"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Upload className="w-5 h-5 mx-auto mb-2 text-gray-400" />
          <p className="text-[13px] text-gray-500 font-medium">
            {isDragging ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para selecionar'}
          </p>
          <p className="text-[11.5px] text-gray-400 mt-1">
            Suporta .ofx, .csv, .xlsx, .txt, .pdf · Qualquer quantidade de fontes
          </p>
        </div>

        {/* Attached file chips */}
        {parsedSources.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap juris-rise">
            {parsedSources.map((p, i) => {
              const color = SOURCE_COLORS[i % SOURCE_COLORS.length];
              const ready = !p.needsMapping && p.transactions.length > 0;
              return (
                <div
                  key={p.tempId}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] border"
                  style={{
                    backgroundColor: `${color}15`,
                    borderColor: `${color}40`,
                    color,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium truncate max-w-[160px]">{p.fileName}</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${color}25` }}
                  >
                    {FORMAT_LABEL[p.format]}
                  </span>
                  {ready && (
                    <span className="text-[10px] text-gray-500">
                      {p.transactions.length} lanç.
                    </span>
                  )}

                  {p.transactions.length === 0 && !p.needsMapping && (
                    <span className="text-[10px] opacity-70">vazio</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSource(p.tempId); }}
                    className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-2 mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
            <button onClick={() => setErrorMsg('')} className="ml-auto text-red-400 hover:text-red-700">
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
              disabled={isListening || processing}
              placeholder={
                isListening
                  ? 'Escutando…'
                  : processing
                    ? stepLabel
                    : canSend
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
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
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
              {!isListening && !processing && (
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
              {processing && (
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

        {/* Suggestions panel */}
        {showSuggestions && !processing && (
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
