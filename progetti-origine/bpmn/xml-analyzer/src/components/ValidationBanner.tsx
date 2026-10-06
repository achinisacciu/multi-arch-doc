import React from "react";
import { AlertCircle, CheckCircle, HelpCircle } from "lucide-react";
import { XMLValidationResult } from "../types";

interface ValidationBannerProps {
  validation: XMLValidationResult | null;
  onBeautify: () => void;
  canBeautify: boolean;
}

export const ValidationBanner: React.FC<ValidationBannerProps> = ({
  validation,
  onBeautify,
  canBeautify,
}) => {
  if (!validation) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-gray-400 shrink-0" />
          <span>Incolla o carica un file XML per convalidare la sua sintassi in tempo reale.</span>
        </div>
      </div>
    );
  }

  if (validation.isValid) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-emerald-800">
        <div className="flex items-center gap-2.5">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-semibold">Sintassi XML Valida</span>
            <span className="text-emerald-600/90 ml-1.5 hidden sm:inline">| Pronto per l'analisi e la documentazione.</span>
          </div>
        </div>
        {canBeautify && (
          <button
            onClick={onBeautify}
            className="px-3.5 py-1.5 bg-emerald-600 text-white font-medium rounded-lg text-xs hover:bg-emerald-700 transition-colors shrink-0"
          >
            Abbellisci XML (Format)
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-4 text-sm text-rose-800">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold">Errore di Sintassi XML rilevato</p>
          <p className="text-rose-700/90 mt-1 font-mono text-xs bg-white/65 p-2 rounded-lg border border-rose-100 overflow-x-auto whitespace-pre-wrap">
            {validation.error?.message}
          </p>
          {(validation.error?.line || validation.error?.column) && (
            <div className="flex gap-4 mt-2 text-xs font-medium text-rose-600">
              {validation.error.line && (
                <span>
                  Linea: <strong className="font-mono">{validation.error.line}</strong>
                </span>
              )}
              {validation.error.column && (
                <span>
                  Colonna: <strong className="font-mono">{validation.error.column}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
