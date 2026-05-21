import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";


export const Route = createFileRoute("/")({
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
    id: "conciliacao",
    icon: Calculator,
    label: "Conciliação",
    suggestions: [
      "Conciliar extrato bancário com lançamentos contábeis",
      "Identificar lançamentos não conciliados",
      "Analisar diferenças de conciliação",
      "Gerar relatório de conciliação",
    ],
  },
  {
    id: "juridico",
    icon: Scale,
    label: "Jurídico",
    suggestions: [
      "Analisar obrigações fiscais acessórias",
      "Revisar contrato de prestação de serviços contábeis",
      "Avaliar riscos tributários em operação societária",
    ],
  },
  {
    id: "contabil",
    icon: BarChart3,
    label: "Contábil",
    suggestions: [
      "Elaborar DRE do período",
      "Montar Balanço Patrimonial",
      "Apurar resultado do exercício",
    ],
  },
  {
    id: "tributario",
    icon: FileText,
    label: "Tributário",
    suggestions: [
      "Calcular Simples Nacional do mês",
      "Apurar PIS, COFINS e ICMS",
      "Gerar guia de DARF e DAS",
    ],
  },
];

function Index() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const current = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  const startListening = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setIsListening(true);
  };
  const stopListening = () => setIsListening(false);
  const confirmListening = () => {
    setIsListening(false);
    if (!value.trim()) {
      fill("Conciliar extrato bancário do Itaú com lançamentos de janeiro");
    }
  };


  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const fill = (text: string) => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setIsTyping(false);
    setValue(text);
    requestAnimationFrame(() => {
      autoResize();
      textareaRef.current?.focus();
    });
  };


  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto pt-10 pb-24">
        <div
          className="flex flex-col items-center mb-10 juris-rise"
          style={{ animationDelay: "60ms" }}
        >
          <h1 className="text-3xl leading-none text-[#0a2520] font-normal tracking-tight">
            Caio, o que deseja consultar?
          </h1>
        </div>

        <div
          className={`juris-rise juris-focus bg-white rounded-2xl shadow-[0_10px_30px_-12px_rgb(10,37,32,0.12)] border transition-all duration-300 ${
            isListening
              ? "border-[#0d9488]/60 shadow-[0_18px_40px_-16px_rgb(13,148,136,0.35)]"
              : "border-gray-200/80 focus-within:shadow-[0_18px_40px_-16px_rgb(13,148,136,0.25)] focus-within:border-[#0d9488]/40"
          }`}
          style={{ animationDelay: "160ms" }}
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
              disabled={isListening}
              placeholder={isListening ? "Escutando…" : "Descreva sua consulta contábil..."}
              className={`w-full resize-none text-[15px] text-gray-800 placeholder:text-gray-400 leading-relaxed focus:outline-none bg-transparent max-h-48 overflow-y-auto disabled:cursor-default ${
                isTyping ? "juris-caret" : ""
              } ${isListening ? "juris-caret placeholder:text-[#0d9488] placeholder:font-medium" : ""}`}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#0d9488] hover:bg-gray-50 transition-colors" aria-label="Anexar">
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
              {!isListening && (
                <>
                  <span className="hidden sm:flex items-center gap-1 text-[11px] text-gray-400 pr-2">
                    <Command className="w-3 h-3" /> + Enter
                  </span>
                  <button
                    onClick={startListening}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#0d9488] hover:bg-gray-50 transition-colors"
                    aria-label="Ditar"
                  >
                    <Mic className="w-[16px] h-[16px]" />
                  </button>
                  <button
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                      value.trim()
                        ? "bg-[#0a2520] text-white shadow-md scale-100"
                        : "bg-[#0a2520]/90 text-white"
                    } ${isTyping ? "ring-2 ring-[#0d9488]/30" : ""}`}
                    aria-label="Enviar"
                  >
                    <SendHorizonal className="w-[16px] h-[16px]" />
                  </button>
                </>
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
                    onClick={stopListening}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors active:scale-95"
                    aria-label="Cancelar gravação"
                  >
                    <Square className="w-[14px] h-[14px] fill-current" />
                  </button>
                  <button
                    onClick={confirmListening}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-[#0d9488] to-[#0a4540] text-white shadow-[0_6px_16px_-6px_rgba(13,148,136,0.6)] hover:shadow-[0_8px_20px_-6px_rgba(13,148,136,0.7)] transition-all active:scale-95"
                    aria-label="Confirmar"
                  >
                    <Check className="w-[16px] h-[16px]" strokeWidth={3} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>


        {showSuggestions && (
          <div
            className="mt-5 juris-rise rounded-2xl border border-gray-200/70 bg-gray-50/60 shadow-[0_1px_2px_rgba(10,37,32,0.04)] overflow-hidden"
            style={{ animationDelay: "260ms" }}
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
                        ? "bg-white text-[#0a2520] border-gray-300 shadow-[0_1px_2px_rgba(10,37,32,0.06)]"
                        : "bg-transparent text-gray-500 border-transparent hover:bg-white/70 hover:text-[#0a2520]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? "text-[#0d9488]" : ""}`} strokeWidth={1.8} />
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
                  style={{ animationDelay: `${i * 50}ms`, animationDuration: "0.35s" }}
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
