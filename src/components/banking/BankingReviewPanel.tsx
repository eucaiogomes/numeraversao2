import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  MinusCircle,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useState } from 'react';
import type {
  BankingReviewItem,
  BankingReviewItemKind,
  BankingReviewItemStatus,
} from '@/lib/banking/types';

const KIND_LABEL: Record<BankingReviewItemKind, string> = {
  missing_statement: 'Extrato pendente',
  missing_ledger: 'Razao pendente',
  divergence_check: 'Divergencia',
  suggested_entry: 'Lancamento sugerido',
  insufficient_data: 'Dados insuficientes',
};

const STATUS_LABEL: Record<BankingReviewItemStatus, string> = {
  open: 'Pendente',
  done: 'Resolvida',
  ignored: 'Ignorada',
};

function statusStyle(status: BankingReviewItemStatus): string {
  if (status === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'ignored') return 'bg-gray-50 text-gray-600 border-gray-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function kindIcon(kind: BankingReviewItemKind) {
  if (kind === 'missing_statement') return <FileWarning className="w-4 h-4" />;
  if (kind === 'divergence_check') return <AlertTriangle className="w-4 h-4" />;
  if (kind === 'suggested_entry') return <ClipboardCheck className="w-4 h-4" />;
  if (kind === 'missing_ledger') return <ClipboardCheck className="w-4 h-4" />;
  return <AlertTriangle className="w-4 h-4" />;
}

function fmtDateTime(value: string | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function ReviewItemCard({
  item,
  onUpdate,
}: {
  item: BankingReviewItem;
  onUpdate: (id: string, patch: Partial<Pick<BankingReviewItem, 'status' | 'note'>>) => void;
}) {
  const [note, setNote] = useState(item.note ?? '');

  return (
    <div className="border-t border-gray-100 first:border-t-0 py-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-[#0d9488] shrink-0">
          {kindIcon(item.kind)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13.5px] font-semibold text-[#0a2520]">{item.title}</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-teal-100 bg-teal-50 text-[#0d9488]">
              {KIND_LABEL[item.kind]}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusStyle(item.status)}`}>
              {STATUS_LABEL[item.status]}
            </span>
          </div>
          <p className="text-[12.5px] text-gray-500 mt-1">{item.detail}</p>
          {item.candidateDescription && (
            <p className="text-[12.5px] text-gray-500 mt-1">
              Candidato no extrato: {item.candidateDescription}
            </p>
          )}
          {item.suggestedEntryId && (
            <p className="text-[11.5px] text-gray-400 mt-1">
              Vinculo: {item.suggestedEntryId}
            </p>
          )}
          {item.updatedAt && (
            <p className="text-[11.5px] text-gray-400 mt-1">
              Atualizada em {fmtDateTime(item.updatedAt)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid lg:grid-cols-[1fr_auto] gap-3">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Observacao da equipe"
          className="min-h-[74px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12.5px] text-gray-600 outline-none focus:border-[#0d9488]/60 focus:ring-2 focus:ring-[#0d9488]/10 resize-y"
        />
        <div className="flex lg:flex-col gap-2">
          <button
            onClick={() => onUpdate(item.id, { note })}
            className="h-9 px-3 rounded-lg border border-gray-200 text-gray-600 text-[12px] font-medium flex items-center justify-center gap-1.5 hover:border-[#0d9488]/40 hover:text-[#0d9488] transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Salvar
          </button>
          {item.status === 'done' ? (
            <button
              onClick={() => onUpdate(item.id, { status: 'open', note })}
              className="h-9 px-3 rounded-lg bg-amber-50 text-amber-700 text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reabrir
            </button>
          ) : (
            <button
              onClick={() => onUpdate(item.id, { status: 'done', note })}
              className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Resolver
            </button>
          )}
          {item.status !== 'ignored' && (
            <button
              onClick={() => onUpdate(item.id, { status: 'ignored', note })}
              className="h-9 px-3 rounded-lg bg-gray-50 text-gray-600 text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors"
            >
              <MinusCircle className="w-3.5 h-3.5" />
              Ignorar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BankingReviewPanel({
  items,
  onUpdate,
}: {
  items: BankingReviewItem[];
  onUpdate: (id: string, patch: Partial<Pick<BankingReviewItem, 'status' | 'note'>>) => void;
}) {
  const open = items.filter((item) => item.status === 'open').length;
  const done = items.filter((item) => item.status === 'done').length;
  const ignored = items.filter((item) => item.status === 'ignored').length;

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm p-4 mb-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-[15px] font-semibold text-[#0a2520]">
            Revisao operacional
          </h2>
          <p className="text-[12.5px] text-gray-400 mt-0.5">
            Pendencias geradas a partir da conciliacao bancaria
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] shrink-0">
          <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
            {open} pendente(s)
          </span>
          <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
            {done} resolvida(s)
          </span>
          <span className="px-2 py-1 rounded-full bg-gray-50 text-gray-600">
            {ignored} ignorada(s)
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-[12.5px] text-emerald-700">
          Nenhuma pendencia operacional foi gerada para esta conciliacao.
        </div>
      ) : (
        <div className="mt-2">
          {items.map((item) => (
            <ReviewItemCard key={item.id} item={item} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
