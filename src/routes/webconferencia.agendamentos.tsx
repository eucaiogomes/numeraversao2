import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/webconferencia/agendamentos")({
  component: AgendamentosPage,
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type View = "mes" | "semana" | "dia";

function AgendamentosPage() {
  const [view, setView] = useState<View>("mes");
  const [current, setCurrent] = useState(new Date(2026, 4, 20)); // May 2026

  const year = current.getFullYear();
  const month = current.getMonth();

  // Build 6-week grid starting from previous Sunday
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  const today = new Date();
  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const goPrev = () => setCurrent(new Date(year, month - 1, 1));
  const goNext = () => setCurrent(new Date(year, month + 1, 1));
  const goToday = () => setCurrent(new Date());

  return (
    <AppLayout>
      <div className="text-sm text-[#2d2d2d] mb-6">
        <span className="font-semibold">Webconferência</span>
        <span className="mx-2 text-[#b89968]">/</span>
        <span className="font-semibold">Agendamentos</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(["mes", "semana", "dia"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full text-sm border ${
                view === v
                  ? "bg-[#0b1c33] text-white border-[#0b1c33]"
                  : "bg-white text-[#2d2d2d] border-[#d0d0d0]"
              }`}
            >
              {v === "mes" ? "Mês" : v === "semana" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-[#2d2d2d]">
          {MONTHS[month]} {year}
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-4 py-1.5 rounded-full text-sm border border-[#d0d0d0] text-[#6b6b6b] bg-white"
          >
            Hoje
          </button>
          <button
            onClick={goPrev}
            className="w-9 h-9 rounded-full bg-[#0b1c33] text-white flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goNext}
            className="w-9 h-9 rounded-full bg-[#0b1c33] text-white flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white border border-[#e0e0e0]">
        <div className="grid grid-cols-7 border-b border-[#e0e0e0]">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-xs text-[#b89968] py-2 font-medium"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const inMonth = d.getMonth() === month;
            return (
              <div
                key={i}
                className={`min-h-[110px] border-r border-b border-[#e0e0e0] p-1 ${
                  !inMonth ? "bg-[#ececec]" : isToday(d) ? "bg-[#eef3fb]" : "bg-white"
                }`}
              >
                <div
                  className={`text-xs text-right pr-1 ${
                    inMonth ? "text-[#3b6fa0]" : "text-[#b89968]"
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
