import {
  Download,
  Accessibility,
  Languages,
  ChevronDown,
  ChevronRight,
  Video,
  Folder,
  FolderOpen,
  Circle,
  PanelLeft,
  Clock,
  Plus,
  Scale,
  LogOut,
  Settings,
  Check,
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoJuris8 from "@/assets/logo-juris8.png";

type SubItem = { label: string; to: string; badge?: number; indent?: number };

function SidebarGroup({
  icon,
  label,
  to,
  subItems,
  rootBadge,
  rootTo,
  defaultOpen = false,
  collapsed = false,
}: {
  icon: ReactNode;
  label: string;
  to?: string;
  subItems?: SubItem[];
  rootBadge?: number;
  rootTo?: string;
  defaultOpen?: boolean;
  collapsed?: boolean;
}) {
  const location = useLocation();
  const isActive =
    (to && location.pathname === to) ||
    (rootTo && location.pathname === rootTo) ||
    subItems?.some((s) => location.pathname === s.to);
  const [open, setOpen] = useState(defaultOpen || !!isActive);

  const hasToggle = !!(subItems || rootTo);
  const header = (
    <div
      onClick={() => !collapsed && hasToggle && setOpen((o) => !o)}
      title={collapsed ? label : undefined}
      className={`mx-2 flex items-center gap-2.5 px-2.5 py-2 rounded-md ${hasToggle && !collapsed ? "cursor-pointer" : ""} transition-all ${
        isActive
          ? "bg-[#f5efff] text-[#1a0a2e]"
          : "text-[#5a5a6b] hover:bg-gray-50 hover:text-[#1a0a2e]"
      }`}
    >
      <span className={`shrink-0 ${isActive ? "text-[#8c3cf0]" : "text-[#9a9aa8]"}`}>{icon}</span>
      {!collapsed && (
        <>
          <span className={`text-[13px] flex-1 whitespace-nowrap tracking-tight ${isActive ? "font-medium" : "font-normal"}`}>{label}</span>
          {hasToggle && (open ? (
            <ChevronDown className="w-3.5 h-3.5 opacity-40" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
          ))}
        </>
      )}
    </div>
  );


  return (
    <div>
      {to && !subItems ? <Link to={to}>{header}</Link> : header}
      {!collapsed && open && (rootTo || subItems) && (
        <div className="mx-2 mt-0.5">
          {rootTo && (
            <Link
              to={rootTo}
              className={`flex items-center gap-2 pl-9 pr-2.5 py-1.5 rounded-md text-[12.5px] transition-colors ${
              location.pathname === rootTo
                  ? "bg-[#f5efff] text-[#1a0a2e] font-medium"
                  : "text-[#6b6b78] hover:bg-gray-50"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#8c3cf0]" />
              <span className="flex-1">/</span>
              {rootBadge !== undefined && <Badge n={rootBadge} />}
            </Link>
          )}
          {subItems?.map((s) => {
            const active = location.pathname === s.to;
            const pl = 36 + (s.indent ?? 0) * 12;
            return (
              <Link
                key={s.to}
                to={s.to}
                style={{ paddingLeft: pl }}
                className={`flex items-center gap-2 pr-2.5 py-1.5 rounded-md text-[12.5px] transition-colors ${
                  active
                    ? "bg-[#f5efff] text-[#1a0a2e] font-medium"
                    : "text-[#6b6b78] hover:bg-gray-50"
                }`}
              >
                {s.badge !== undefined && (
                  <Circle className="w-1.5 h-1.5 fill-current text-[#8c3cf0]" />
                )}
                <span className="flex-1">{s.label}</span>
                {s.badge !== undefined && <Badge n={s.badge} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="bg-[#8c3cf0] text-white text-[10px] font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center">
      {n}
    </span>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#ececec] flex flex-col">
      <header className="bg-[#1a0a2e] text-white flex items-center justify-between px-4 h-16 relative z-20 shadow-md">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center">
            <img
              src={logoJuris8}
              alt="Juris8"
              className="h-14 w-auto object-contain"
            />
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 pl-2 pr-2 py-1 rounded-full hover:bg-white/10 transition-colors outline-none focus:ring-2 focus:ring-[#8c3cf0]/40">
                <div className="text-right leading-tight">
                  <div className="text-sm font-semibold">Caio</div>
                  <div className="text-[10px] uppercase tracking-wide text-white/60">Advogado</div>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 border-2 border-white/20 shadow-sm shadow-black/30" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
                <span className="text-sm font-semibold text-[#1a0a2e]">Caio</span>
                <span className="text-[11px] font-normal text-[#6b6b78]">Advogado</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5 cursor-pointer">
                <Download className="w-4 h-4 text-[#8c3cf0]" />
                Instalar app
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2.5">
                  <Languages className="w-4 h-4 text-[#8c3cf0]" />
                  <span className="flex-1">Idioma</span>
                  <span className="text-[11px] text-[#6b6b78]">Português</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  {["Português", "English", "Español"].map((lang) => (
                    <DropdownMenuItem key={lang} className="gap-2 cursor-pointer">
                      <Check
                        className={`w-3.5 h-3.5 ${lang === "Português" ? "text-[#8c3cf0]" : "opacity-0"}`}
                      />
                      {lang}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem className="gap-2.5 cursor-pointer">
                <Accessibility className="w-4 h-4 text-[#8c3cf0]" />
                Acessibilidade
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 cursor-pointer">
                <Settings className="w-4 h-4 text-[#8c3cf0]" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5 cursor-pointer text-[#b91c1c] focus:text-[#b91c1c]">
                <LogOut className="w-4 h-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>


      <div className="flex flex-1">
        <aside
          style={{ width: collapsed ? 64 : 232 }}
          className="bg-[#fafafb] border-r border-gray-200/70 shadow-[1px_0_0_rgba(26,10,46,0.02),4px_0_24px_-12px_rgba(26,10,46,0.08)] flex flex-col justify-between z-10 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]"
        >
          <nav className="py-3">
            <div className={`${collapsed ? "px-2" : "px-3"} pb-2`}>
              <Link
                to="/"
                title={collapsed ? "Novo" : undefined}
                className={`group flex items-center gap-2 ${collapsed ? "justify-center px-0" : "px-2.5"} py-2 rounded-md bg-white border border-gray-200/80 hover:border-[#8c3cf0]/40 shadow-sm hover:shadow-[0_4px_14px_-4px_rgba(140,60,240,0.25)] transition-all`}
              >
                <span className="w-5 h-5 rounded-md bg-gradient-to-br from-[#8c3cf0] to-[#6b1fd0] flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </span>
                {!collapsed && (
                  <span className="text-[13px] font-medium text-[#1a0a2e] tracking-tight">Novo</span>
                )}
              </Link>
            </div>

            <SidebarGroup
              icon={<Scale className="w-[18px] h-[18px]" />}
              label="Agente Jurídico"
              to="/"
              collapsed={collapsed}
            />
            <SidebarGroup
              icon={<Video className="w-[18px] h-[18px]" />}
              label="Webconferência"
              collapsed={collapsed}
              subItems={[
                { label: "Agendamentos", to: "/webconferencia/agendamentos" },
                { label: "Salas fixas", to: "/webconferencia/salas-fixas" },
              ]}
            />
            <SidebarGroup
              icon={<Folder className="w-[18px] h-[18px]" />}
              label="Documentos"
              rootTo="/documentos"
              rootBadge={2}
              collapsed={collapsed}
              subItems={[
                { label: "Jurisprudência", to: "/documentos/jurisprudencia", badge: 8, indent: 1 },
                { label: "Transcrições", to: "/documentos/transcricoes", badge: 42, indent: 1 },
              ]}
            />

            {!collapsed && (
              <>
                <div className="mt-5 px-5 pb-1.5 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-[#9a9aa8]" />
                  <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#9a9aa8]">
                    Recentes
                  </span>
                </div>
                <div className="flex flex-col px-2">
                  {[
                    { label: "Análise de contrato de locação", to: "/" },
                    { label: "Recurso de apelação cível", to: "/" },
                    { label: "Petição inicial trabalhista", to: "/" },
                    { label: "Parecer sobre LGPD", to: "/" },
                    { label: "Audiência - caso Silva", to: "/" },
                  ].map((item, i) => (
                    <Link
                      key={i}
                      to={item.to}
                      className="px-2.5 py-1.5 rounded-md text-[12.5px] text-[#6b6b78] hover:bg-white hover:text-[#1a0a2e] transition-colors truncate"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </>
            )}

            {collapsed && (
              <div className="mt-4 flex justify-center">
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </nav>


          <div className={`p-4 border-t border-gray-100 flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2`}>
            {!collapsed && (
              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                Lector Live © 2026 - v2.0
              </span>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              className="w-7 h-7 shrink-0 border border-gray-200 rounded flex items-center justify-center text-gray-400 hover:text-[#8c3cf0] hover:border-[#8c3cf0]/40 hover:bg-gray-50 transition-colors"
            >
              <PanelLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
        </aside>

        <main className="flex-1 px-8 py-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
