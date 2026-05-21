import { useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import type { CSVColumnMapping } from '@/lib/csv-parser';

interface CSVColumnMapperProps {
  headers: string[];
  detected: Partial<CSVColumnMapping>;
  onConfirm: (mapping: CSVColumnMapping) => void;
  onCancel: () => void;
}

export function CSVColumnMapper({ headers, detected, onConfirm, onCancel }: CSVColumnMapperProps) {
  const [mapping, setMapping] = useState<Partial<CSVColumnMapping>>({ ...detected });

  const isValid = !!mapping.dateColumn && !!mapping.amountColumn && !!mapping.descriptionColumn;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold text-[#0a2520]">Mapeamento de colunas CSV</h2>
          <p className="text-[12.5px] text-gray-400 mt-1">
            Identifique quais colunas do seu arquivo correspondem a cada campo.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {[
            { key: 'dateColumn' as const, label: 'Coluna de data', required: true },
            { key: 'amountColumn' as const, label: 'Coluna de valor', required: true },
            { key: 'descriptionColumn' as const, label: 'Coluna de descrição', required: true },
            { key: 'accountCodeColumn' as const, label: 'Coluna de conta contábil', required: false },
          ].map(({ key, label, required }) => (
            <div key={key}>
              <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">
                {label}
                {required && <span className="text-red-400 ml-1">*</span>}
                {detected[key] && (
                  <span className="ml-2 text-[11px] text-[#0d9488] font-normal">
                    (detectado automaticamente)
                  </span>
                )}
              </label>
              <select
                value={mapping[key] ?? ''}
                onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-700 outline-none focus:border-[#0d9488]/50 focus:ring-1 focus:ring-[#0d9488]/20"
              >
                <option value="">— selecionar —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {!isValid && (
            <div className="flex items-center gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Os campos marcados com * são obrigatórios.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => isValid && onConfirm(mapping as CSVColumnMapping)}
            disabled={!isValid}
            className="h-9 px-4 rounded-lg bg-[#0a2520] text-white text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0d3530] transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Confirmar mapeamento
          </button>
        </div>
      </div>
    </div>
  );
}
