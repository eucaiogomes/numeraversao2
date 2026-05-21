import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Plus, User } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/webconferencia/salas-fixas")({
  component: SalasFixasPage,
});

const VIEW_OPTIONS = ["Cartões", "Somente Capa", "Miniaturas", "Lista"];

function SalasFixasPage() {
  const [viewMode, setViewMode] = useState("Cartões");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <AppLayout>
      <div className="text-sm text-[#2d2d2d] mb-6">
        <span className="font-semibold">Webconferência</span>
        <span className="mx-2 text-[#b89968]">/</span>
        <span className="font-semibold">Salas Fixas</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex items-center border border-[#d0d0d0] rounded bg-white px-3 py-1.5 w-[220px]">
          <input
            type="text"
            placeholder="Nome"
            className="flex-1 text-sm text-[#2d2d2d] placeholder:text-[#bdbdbd] focus:outline-none bg-transparent"
          />
          <Search className="w-4 h-4 text-[#6b6b6b]" />
        </div>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center justify-between border border-[#d0d0d0] rounded bg-white px-3 py-1.5 text-sm text-[#2d2d2d] min-w-[170px]"
          >
            <span>{viewMode}</span>
            <ChevronDown className="w-4 h-4 text-[#3b6fa0] ml-2" />
          </button>
          {open && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-[#e0e0e0] rounded shadow-md min-w-[170px] z-10">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setViewMode(opt);
                    setOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f5f1e8]/60"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="w-9 h-9 rounded-full border-2 border-[#b89968] text-[#b89968] flex items-center justify-center">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-wrap gap-4">
        <div className="w-[180px] h-[180px] bg-[#7a7a7a] rounded relative cursor-pointer overflow-hidden group">
          <div className="absolute inset-0 flex items-center justify-center">
            <User className="w-24 h-24 text-[#5a5a5a]" strokeWidth={1} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/30 px-3 py-2">
            <span className="text-white font-bold text-sm">Sala de reuniões</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
