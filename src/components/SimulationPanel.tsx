import React, { useState } from "react";
import {
  Sparkles,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  QrCode,
  Terminal,
} from "lucide-react";
import type { Sale } from "../types/pos";
import { formatCurrency } from "../utils/format";

interface SimulationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Sale[];
  onMarkPaid: (saleId: string) => void;
  onMarkRejected: (saleId: string) => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  isOpen,
  onClose,
  queue,
  onMarkPaid,
  onMarkRejected,
}) => {
  const [logs, setLogs] = useState<string[]>([
    "Simulador activo. Listo para disparar webhooks de prueba.",
  ]);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("es-AR");
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 8)]);
  };

  const handleSimulateDelayedApproval = (sale: Sale) => {
    setSimulatingId(sale.id);
    addLog(`Webhook iniciado para venta #${sale.id.slice(-6)}: Procesando en gateway...`);

    setTimeout(() => {
      onMarkPaid(sale.id);
      addLog(`✓ Webhook Mercado Pago 200 OK: Venta #${sale.id.slice(-6)} Aprobada.`);
      setSimulatingId(null);
    }, 2500);
  };

  const handleQuickApprove = (sale: Sale) => {
    onMarkPaid(sale.id);
    addLog(`✓ Aprobación instantánea simulada para venta #${sale.id.slice(-6)}.`);
  };

  const handleQuickReject = (sale: Sale) => {
    onMarkRejected(sale.id);
    addLog(`✗ Rechazo de pago simulado para venta #${sale.id.slice(-6)} (Tarjeta rechazada / timeout).`);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 bg-slate-900/95 backdrop-blur-md border border-purple-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col select-none animate-in slide-in-from-bottom-4 duration-150">
      {/* Cabecera */}
      <div className="p-3 bg-purple-950/60 border-b border-purple-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
          <h3 className="font-bold text-xs text-purple-200 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-300" />
            Panel de Pruebas QR / Point
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-purple-300 hover:text-white p-1 rounded-md hover:bg-purple-900/50 transition-colors"
          title="Minimizar (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Explicación de valor de demo */}
      <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 leading-snug">
        Permite simular respuestas de webhooks en segundo plano para verificar que
        el cajero puede seguir cargando carritos sin interrupción.
      </div>

      {/* Lista de ventas en espera para simular */}
      <div className="p-3 max-h-56 overflow-y-auto space-y-2">
        {queue.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No hay ventas en la cola para simular. Creá una venta en el POS con
            Cobrar (F8).
          </p>
        ) : (
          queue.map((sale) => (
            <div
              key={sale.id}
              className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-purple-300 font-bold">
                  #{sale.id.slice(-6)} • {sale.paymentMethod}
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatCurrency(sale.total)}
                </span>
              </div>

              {/* Botones de simulación por venta */}
              <div className="grid grid-cols-3 gap-1 pt-1">
                <button
                  type="button"
                  disabled={simulatingId === sale.id}
                  onClick={() => handleQuickApprove(sale)}
                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Aprobar</span>
                </button>

                <button
                  type="button"
                  disabled={simulatingId === sale.id}
                  onClick={() => handleSimulateDelayedApproval(sale)}
                  className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  <Clock className="w-3 h-3" />
                  <span>{simulatingId === sale.id ? "2.5s..." : "Esperar 2.5s"}</span>
                </button>

                <button
                  type="button"
                  disabled={simulatingId === sale.id}
                  onClick={() => handleQuickReject(sale)}
                  className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  <XCircle className="w-3 h-3" />
                  <span>Rechazar</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Terminal / Log de eventos */}
      <div className="p-2 bg-slate-950 border-t border-slate-800 text-[10px] font-mono text-slate-400 space-y-0.5 max-h-24 overflow-y-auto">
        <div className="flex items-center gap-1 text-slate-500 font-semibold mb-1">
          <Terminal className="w-3 h-3" />
          <span>Registro de Webhooks:</span>
        </div>
        {logs.map((log, i) => (
          <p key={i} className="truncate">
            {log}
          </p>
        ))}
      </div>
    </div>
  );
};
