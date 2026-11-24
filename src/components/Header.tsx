import React from "react";
import {
  Sparkles,
  Wifi,
  WifiOff,
  Keyboard,
  Store,
  FileText,
  Smartphone,
  Layers,
} from "lucide-react";
import { usePosStore } from "../store/usePosStore";

export type PosDemoView = "caja" | "facturacion" | "dueno";

interface HeaderProps {
  activeView: PosDemoView;
  onSelectView: (view: PosDemoView) => void;
  onToggleSimulation: () => void;
  simulationOpen: boolean;
  queuedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onSelectView,
  onToggleSimulation,
  simulationOpen,
  queuedCount,
}) => {
  const businessId = usePosStore((s) => s.businessId);
  const branchId = usePosStore((s) => s.branchId);
  const catalogReady = usePosStore((s) => s.catalogReady);
  const isOffline = usePosStore((s) => s.isOffline);
  const setOfflineMode = usePosStore((s) => s.setOfflineMode);
  const cartItemCount = usePosStore((s) =>
    s.cart.reduce((sum, item) => sum + item.qty, 0)
  );
  const pendingFiscalCount = usePosStore(
    (s) =>
      s.invoices.filter((i) => i.fiscalStatus === "PENDIENTE_ENVIO_ARCA").length
  );

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between shrink-0 select-none">
      {/* ── Marca & Info Negocio ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg shadow-sm">
          🌊
        </div>
        <div className="hidden sm:block">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm tracking-wide text-white">
              KIOSCO TERMAS
            </h1>
            <span
              onClick={() => setOfflineMode(!isOffline)}
              className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 cursor-pointer transition-colors ${
                isOffline
                  ? "bg-amber-950/90 text-amber-300 border-amber-800"
                  : "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
              }`}
              title="Click para alternar Online / Offline"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOffline ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                }`}
              />
              {isOffline ? "Offline" : "Online"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {businessId} • {branchId}
          </p>
        </div>
      </div>

      {/* ── Navegación Superior: Selector de las 3 Vistas ("Modo Demo") ── */}
      <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
        {/* Pestaña 1: Caja Kiosco */}
        <button
          type="button"
          onClick={() => onSelectView("caja")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === "caja"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950"
              : "text-slate-300 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Caja Kiosco</span>
          {cartItemCount > 0 && (
            <span
              className={`text-[10px] px-1.5 rounded-full font-mono font-bold ${
                activeView === "caja"
                  ? "bg-slate-950 text-emerald-300"
                  : "bg-emerald-950 text-emerald-400 border border-emerald-800"
              }`}
            >
              {cartItemCount}
            </span>
          )}
          {queuedCount > 0 && (
            <span className="text-[10px] px-1.5 rounded-full font-mono font-bold bg-amber-500 text-slate-950 animate-pulse">
              {queuedCount}
            </span>
          )}
        </button>

        {/* Pestaña 2: Facturación B/A + Offline */}
        <button
          type="button"
          onClick={() => onSelectView("facturacion")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === "facturacion"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950"
              : "text-slate-300 hover:text-white hover:bg-slate-900"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Facturación B/A + Offline</span>
          {pendingFiscalCount > 0 && (
            <span className="text-[10px] px-1.5 rounded-full font-mono font-bold bg-amber-500 text-slate-950 animate-pulse">
              {pendingFiscalCount}
            </span>
          )}
        </button>

        {/* Pestaña 3: Celular Dueño */}
        <button
          type="button"
          onClick={() => onSelectView("dueno")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === "dueno"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950"
              : "text-slate-300 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Celular Dueño</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </nav>

      {/* ── Atajos Rápidos & Simulador QR ── */}
      <div className="flex items-center gap-2">
        {/* Cheat sheet atajos (visible en pantallas grandes) */}
        <div className="hidden xl:flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-emerald-400">
            F2 <span className="text-slate-400 font-sans">Búsqueda</span>
          </span>
          <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-emerald-400">
            +/- <span className="text-slate-400 font-sans">Cant</span>
          </span>
          <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-emerald-400">
            F8 <span className="text-slate-400 font-sans">Cobrar</span>
          </span>
          <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-amber-400">
            F9 <span className="text-slate-400 font-sans">Efectivo</span>
          </span>
          <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-rose-400">
            Esc <span className="text-slate-400 font-sans">Cerrar</span>
          </span>
        </div>

        {/* Botón Simulador QR / Webhooks */}
        <button
          onClick={onToggleSimulation}
          className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all border ${
            simulationOpen
              ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/30 ring-2 ring-purple-500/30"
              : "bg-slate-800/90 text-purple-300 border-purple-800/60 hover:bg-slate-800 hover:text-purple-200"
          }`}
          title="Simular webhooks de aprobación o rechazo en segundo plano"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
          <span className="hidden sm:inline">Simulador QR</span>
          {queuedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
              {queuedCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
