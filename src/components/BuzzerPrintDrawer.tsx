import React from "react";
import { BellRing, Printer, RefreshCw, X } from "lucide-react";
import type { BuzzerState, PrintJob, Sale } from "../types/pos";

interface BuzzerPrintDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeBuzzers: BuzzerState[];
  printJobs: PrintJob[];
  sales: Sale[];
  onRelease: (number: string) => void;
  onRetry: (jobId: string) => void;
}

export const BuzzerPrintDrawer: React.FC<BuzzerPrintDrawerProps> = ({
  isOpen,
  onClose,
  activeBuzzers,
  printJobs,
  sales,
  onRelease,
  onRetry,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex justify-end" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BellRing className="w-5 h-5 text-amber-400" />
              Llamadores activos & cola de impresión
            </h2>
            <p className="text-xs text-slate-400">F10 · Enter libera o reintenta desde esta vista</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" title="Cerrar (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <section>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">
              Llamadores en curso ({activeBuzzers.length})
            </h3>
            <div className="space-y-2">
              {activeBuzzers.length === 0 ? (
                <p className="text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">Sin llamadores activos.</p>
              ) : activeBuzzers.map((buzzer) => {
                const sale = sales.find((entry) => entry.id === buzzer.saleId);
                const summary = sale?.items
                  .map((item) => {
                    const modifiers = item.selectedModifiers.map((modifier) => modifier.name).join(", ");
                    return `${item.qty}x ${item.name}${modifiers ? ` (${modifiers})` : ""}`;
                  })
                  .join(" · ");
                return (
                  <div key={buzzer.number} className="rounded-xl border border-amber-700/60 bg-amber-950/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-2xl font-black font-mono text-amber-300">#{buzzer.number}</div>
                        <div className="text-xs text-slate-300">
                          Ticket #{buzzer.ticketNumber}
                          {summary ? ` · ${summary}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRelease(buzzer.number)}
                        className="shrink-0 px-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black"
                      >
                        Entregado / Liberar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">
              Cola de impresión ({printJobs.length})
            </h3>
            <div className="space-y-2">
              {printJobs.length === 0 ? (
                <p className="text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">Sin trabajos pendientes.</p>
              ) : printJobs.slice(0, 20).map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Printer className="w-4 h-4 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">
                          {job.kind === "CUSTOMER_TICKET" ? "Ticket" : "Comanda Cocina"} · #{job.ticketNumber}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{job.target} · {job.status}</div>
                      </div>
                    </div>
                    {job.status === "FAILED" && (
                      <button
                        type="button"
                        onClick={() => onRetry(job.id)}
                        className="px-2.5 py-2 rounded-lg border border-amber-700 text-amber-300 hover:bg-amber-950/40"
                        title="Reintentar impresión"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {job.buzzerNumber && (
                    <div className="mt-2 text-xl font-black text-amber-300 font-mono">LLAMADOR #{job.buzzerNumber}</div>
                  )}
                  <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-slate-800 bg-black/40 p-2 text-[10px] leading-tight text-slate-300 whitespace-pre-wrap">
                    {job.payload}
                  </pre>
                  {job.lastError && (
                    <p className="mt-2 text-[10px] text-rose-400">{job.lastError}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
