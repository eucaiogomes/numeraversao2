import {
  Accessibility,
  Archive,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Folder,
  Languages,
  LogOut,
  PanelLeft,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { NumeraMark } from "@/components/NumeraMark";
import {
  fetchBankingReconciliations,
  type BankingReconciliationCase,
} from "@/lib/banking/banking-reconciliation-store";

type SidebarItem = {
  label: string;
  to: string;
  icon?: ReactNode;
  badge?: number;
  muted?: boolean;
};

type RecentItem = {
  label: string;
  to: string;
  kind: "Conversa" | "Tarefa" | "Relatório";
  createdAt?: string;
};

function isPathActive(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

function WorkspaceSection({
  icon,
  label,
  description,
  items,
  defaultOpen = true,
  collapsed = false,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  items: SidebarItem[];
  defaultOpen?: boolean;
  collapsed?: boolean;
}) {
  const location = useLocation();
  const hasActiveChild = items.some((item) => isPathActive(location.pathname, item.to));
  const [open, setOpen] = useState(defaultOpen || hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  if (collapsed) {
    const firstItem = items[0];
    return (
      <Link
        to={firstItem.to}
        title={label}
        className={`mx-2 flex h-10 items-center justify-center rounded-lg transition-colors ${
          hasActiveChild
            ? "bg-[#e6f7f2] text-[#0d9488]"
            : "text-[#9aa8a4] hover:bg-white hover:text-[#0d9488]"
        }`}
      >
        {icon}
      </Link>
    );
  }

  return (
    <section className="px-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
          hasActiveChild
            ? "bg-[#e6f7f2] text-[#0a2520]"
            : "text-[#5a6b66] hover:bg-white hover:text-[#0a2520]"
        }`}
      >
        <span className={hasActiveChild ? "text-[#0d9488]" : "text-[#9aa8a4]"}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold tracking-tight">{label}</span>
          {description && (
            <span className="block truncate text-[10.5px] font-normal text-[#8a9793]">
              {description}
            </span>
          )}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-[#9aa8a4]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[#9aa8a4]" />
        )}
      </button>

      {open && (
        <div className="mt-1 space-y-0.5 pl-4">
          {items.map((item) => {
            const active = isPathActive(location.pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                  active
                    ? "bg-white text-[#0a2520] shadow-sm ring-1 ring-gray-200/70"
                    : item.muted
                      ? "text-[#a0aaa7] hover:bg-white/70"
                      : "text-[#667570] hover:bg-white hover:text-[#0a2520]"
                }`}
              >
                {item.icon && (
                  <span className={active ? "text-[#0d9488]" : "text-[#9aa8a4]"}>
                    {item.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && <Badge n={item.badge} />}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="min-w-[22px] rounded-full bg-[#0d9488] px-2 py-0.5 text-center text-[10px] font-bold text-white">
      {n}
    </span>
  );
}

function formatMonth(competence: string) {
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const [year, month] = competence.split("-");
  const monthIndex = Number(month) - 1;
  return `${months[monthIndex] ?? month}/${year}`;
}

function buildCaseLabel(caseData: BankingReconciliationCase) {
  const divergent = caseData.results.filter((result) => result.status === "divergent").length;
  const open = caseData.reviewItems.filter((item) => item.status === "open").length;
  const account =
    caseData.results.find((result) => result.accountName.toLowerCase().includes("viacredi")) ??
    caseData.results[0];

  const name = account?.accountName
    ?.replace(/\s+/g, " ")
    .replace(/conta\s*corrente/i, "")
    .trim();

  const suffix = open > 0 ? `${open} pend.` : divergent > 0 ? `${divergent} div.` : "ok";
  return `${name || "Conciliação bancária"} · ${formatMonth(caseData.competence)} · ${suffix}`;
}

function RecentLink({ item }: { item: RecentItem }) {
  const location = useLocation();
  const active = isPathActive(location.pathname, item.to);
  const kindClass = {
    Conversa: "bg-[#e6f7f2] text-[#0d9488]",
    Tarefa: "bg-amber-50 text-amber-700",
    Relatório: "bg-blue-50 text-blue-700",
  }[item.kind];

  return (
    <Link
      to={item.to}
      title={item.label}
      className={`group block rounded-lg px-2.5 py-2 transition-colors ${
        active ? "bg-white shadow-sm ring-1 ring-gray-200/70" : "hover:bg-white"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${kindClass}`}>
          {item.kind}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#5f6d69] group-hover:text-[#0a2520]">
          {item.label}
        </span>
      </span>
    </Link>
  );
}

function SidebarLink({
  icon,
  label,
  to,
  collapsed = false,
}: {
  icon: ReactNode;
  label: string;
  to: string;
  collapsed?: boolean;
}) {
  const location = useLocation();
  const active = isPathActive(location.pathname, to);

  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={`mx-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
        collapsed ? 'justify-center' : ''
      } ${
        active
          ? 'bg-[#e6f7f2] text-[#0a2520]'
          : 'text-[#5a6b66] hover:bg-white hover:text-[#0a2520]'
      }`}
    >
      <span className={active ? 'text-[#0d9488]' : 'text-[#9aa8a4]'}>{icon}</span>
      {!collapsed && <span className="truncate text-[13px] font-semibold"> {label}</span>}
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bankingCases, setBankingCases] = useState<BankingReconciliationCase[]>([]);

  useEffect(() => {
    let active = true;
    fetchBankingReconciliations().then((cases) => {
      if (active) setBankingCases(cases);
    });
    return () => {
      active = false;
    };
  }, []);

  const recentItems = useMemo<RecentItem[]>(() => {
    const savedReports = bankingCases.slice(0, 5).map((caseData) => ({
      label: buildCaseLabel(caseData),
      to: `/conciliacao-bancaria/${caseData.id}`,
      kind: "Relatório" as const,
      createdAt: caseData.createdAt,
    }));

    const fallback: RecentItem[] = [
      { label: "Conciliação bancária · Itaú", to: "/conciliacao-bancaria", kind: "Conversa" },
      { label: "Pendências de extratos", to: "/conciliacao-bancaria", kind: "Tarefa" },
      { label: "SPED Contábil 2024", to: "/documentos", kind: "Relatório" },
      { label: "DRE · Janeiro/2024", to: "/documentos", kind: "Conversa" },
    ];

    return savedReports.length > 0 ? savedReports : fallback;
  }, [bankingCases]);

  return (
    <div className="flex min-h-screen flex-col bg-[#ececec]">
      <header className="relative z-20 flex h-14 items-center justify-between bg-gradient-to-r from-[#0a2520] via-[#0d3530] to-[#0a2520] px-4 text-white shadow-md md:h-16">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen((value) => !value)}
            className="flex h-8 w-8 items-center justify-center text-white/70 hover:text-white md:hidden"
            aria-label="Abrir menu"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          <Link to="/conciliacao-bancaria" className="flex items-center gap-2.5">
            <NumeraMark className="h-7 w-7 text-[#5fd9be]" />
            <span className="text-[20px] font-semibold tracking-tight text-white lowercase">
              numera
            </span>
          </Link>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-full py-1 pl-2 pr-2 transition-colors hover:bg-white/10 outline-none focus:ring-2 focus:ring-[#5fd9be]/40">
              <div className="text-right leading-tight">
                <div className="text-sm font-semibold">Caio</div>
                <div className="text-[10px] uppercase tracking-wide text-white/60">Contador</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-[#5fd9be] to-[#0d9488] text-sm font-semibold text-[#0a2520] shadow-sm shadow-black/30">
                C
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
              <span className="text-sm font-semibold text-[#0a2520]">Caio</span>
              <span className="text-[11px] font-normal text-[#6b7874]">Contador</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 cursor-pointer">
              <Download className="h-4 w-4 text-[#0d9488]" />
              Instalar app
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2.5">
                <Languages className="h-4 w-4 text-[#0d9488]" />
                <span className="flex-1">Idioma</span>
                <span className="text-[11px] text-[#6b7874]">Português</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                {["Português", "English", "Español"].map((lang) => (
                  <DropdownMenuItem key={lang} className="gap-2 cursor-pointer">
                    <Check
                      className={`h-3.5 w-3.5 ${lang === "Português" ? "text-[#0d9488]" : "opacity-0"}`}
                    />
                    {lang}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem className="gap-2.5 cursor-pointer">
              <Accessibility className="h-4 w-4 text-[#0d9488]" />
              Acessibilidade
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 cursor-pointer">
              <Settings className="h-4 w-4 text-[#0d9488]" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 cursor-pointer text-[#b91c1c] focus:text-[#b91c1c]">
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <aside
          style={{ width: collapsed ? 64 : 252, top: 56 }}
          className={`
            fixed bottom-0 left-0 z-40 flex flex-col justify-between overflow-hidden
            border-r border-gray-200/70 bg-[#fafafb]
            shadow-[1px_0_0_rgba(10,37,32,0.02),4px_0_24px_-12px_rgba(10,37,32,0.08)]
            transition-[width,transform] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]
            md:sticky md:top-0 md:h-[calc(100vh-56px)] md:self-start
            ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          `}
        >
          <nav className="min-h-0 flex-1 overflow-y-auto py-3">
            <div className="space-y-2">
              <SidebarLink
                icon={<Plus className="h-[18px] w-[18px]" />}
                label="Nova conciliação"
                to="/conciliacao-bancaria"
                collapsed={collapsed}
              />

              <WorkspaceSection
                icon={<Folder className="h-[18px] w-[18px]" />}
                label="Arquivos e relatórios"
                description="Fontes usadas pela IA"
                collapsed={collapsed}
                items={[
                  {
                    label: "Arquivos referenciados",
                    to: "/documentos",
                    icon: <Archive className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Relatórios completos",
                    to: "/documentos/jurisprudencia",
                    icon: <FileText className="h-3.5 w-3.5" />,
                    badge: 8,
                  },
                  {
                    label: "Transcrições",
                    to: "/documentos/transcricoes",
                    icon: <BadgeCheck className="h-3.5 w-3.5" />,
                    badge: 42,
                  },
                ]}
              />
            </div>

            {!collapsed && (
              <section className="mt-5 px-2">
                <div className="mb-1.5 flex items-center gap-2 px-2.5">
                  <Clock className="h-3 w-3 text-[#9aa8a4]" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9aa8a4]">
                    Recentes
                  </span>
                </div>
                <div className="space-y-0.5">
                  {recentItems.map((item, index) => (
                    <RecentLink key={`${item.kind}-${item.label}-${index}`} item={item} />
                  ))}
                </div>
              </section>
            )}

            {collapsed && (
              <div className="mt-4 flex justify-center">
                <Clock className="h-4 w-4 text-gray-400" />
              </div>
            )}
          </nav>

          <div
            className={`flex items-center gap-2 border-t border-gray-100 p-4 ${
              collapsed ? "justify-center" : "justify-between"
            }`}
          >
            {!collapsed && (
              <span className="truncate text-[10px] uppercase tracking-wider text-gray-400">
                Numera IA · v1.0.0
              </span>
            )}
            <button
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-400 transition-colors hover:border-[#0d9488]/40 hover:bg-gray-50 hover:text-[#0d9488]"
            >
              <PanelLeft
                className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
