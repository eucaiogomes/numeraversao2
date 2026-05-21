import { useState, useRef, useEffect, type ReactNode } from "react";
import { Search, ChevronDown, Plus, Folder, FilePlus, FileText, Play } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

const SORT_OPTIONS = ["Nome A-Z", "Nome Z-A", "Mais recente", "Mais antigo"];
const VIEW_OPTIONS = ["Cartões", "Somente Capa", "Miniaturas", "Lista"];

type FolderItem = { label: string; to?: string };

export function DocumentsView({
  breadcrumb,
  folders,
}: {
  breadcrumb: ReactNode;
  folders: FolderItem[];
}) {
  const [sort, setSort] = useState("Nome A-Z");
  const [view, setView] = useState("Cartões");
  const [openSort, setOpenSort] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setOpenSort(false);
      if (viewRef.current && !viewRef.current.contains(e.target as Node)) setOpenView(false);
      if (addRef.current && !addRef.current.contains(e.target as Node)) setOpenAdd(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <AppLayout>
      <div className="text-sm text-[#2d2d2d] mb-6">{breadcrumb}</div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center border border-[#d0d0d0] rounded bg-white px-3 py-1.5 w-[220px]">
          <input
            type="text"
            placeholder="Pesquisar em ..."
            className="flex-1 text-sm placeholder:text-[#bdbdbd] focus:outline-none bg-transparent"
          />
          <Search className="w-4 h-4 text-[#6b6b6b]" />
        </div>

        <Dropdown
          refEl={sortRef}
          value={sort}
          open={openSort}
          setOpen={setOpenSort}
          options={SORT_OPTIONS}
          onSelect={setSort}
        />
        <Dropdown
          refEl={viewRef}
          value={view}
          open={openView}
          setOpen={setOpenView}
          options={VIEW_OPTIONS}
          onSelect={setView}
        />

        <button className="bg-[#0b1c33] text-white text-sm font-semibold rounded px-4 py-1.5">
          Busca avançada
        </button>

        <div className="relative" ref={addRef}>
          <button
            onClick={() => setOpenAdd((o) => !o)}
            className="w-9 h-9 rounded-full border-2 border-[#b89968] text-[#b89968] flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </button>
          {openAdd && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-[#e0e0e0] rounded shadow-md min-w-[200px] z-10">
              <AddItem icon={<Folder className="w-4 h-4 text-[#b89968]" />} label="Nova pasta" />
              <AddItem icon={<FileText className="w-4 h-4 text-[#b89968]" />} label="Novo arquivo" />
              <AddItem icon={<Play className="w-4 h-4 text-[#b89968]" />} label="Novo SCORM / IMSCC" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {folders.map((f) => {
          const Card = (
            <div className="w-[180px] h-[180px] bg-[#7a7a7a] rounded relative cursor-pointer overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <Folder className="w-28 h-28 text-[#5a5a5a]" strokeWidth={1} />
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2">
                <span className="text-white font-bold text-sm drop-shadow">{f.label}</span>
              </div>
            </div>
          );
          return f.to ? (
            <Link key={f.label} to={f.to}>
              {Card}
            </Link>
          ) : (
            <div key={f.label}>{Card}</div>
          );
        })}
      </div>
    </AppLayout>
  );
}

function Dropdown({
  refEl,
  value,
  open,
  setOpen,
  options,
  onSelect,
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  value: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  options: string[];
  onSelect: (v: string) => void;
}) {
  return (
    <div className="relative" ref={refEl}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between border border-[#d0d0d0] rounded bg-white px-3 py-1.5 text-sm text-[#2d2d2d] min-w-[160px]"
      >
        <span>{value}</span>
        <ChevronDown className="w-4 h-4 text-[#3b6fa0] ml-2" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#e0e0e0] rounded shadow-md min-w-[160px] z-10">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onSelect(opt);
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
  );
}

function AddItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#2d2d2d] hover:bg-[#f5f1e8]/60">
      {icon}
      {label}
    </button>
  );
}
