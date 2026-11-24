import React, { useState, useMemo, useEffect } from "react";
import {
  Smartphone,
  Maximize2,
  Minimize2,
  DollarSign,
  Receipt,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  QrCode,
  Banknote,
  Clock,
  ChevronRight,
  RefreshCw,
  X,
  FileText,
  ShieldAlert,
  Flame,
} from "lucide-react";
import { usePosStore } from "../store/usePosStore";
import type { Sale, PaymentMethod } from "../types/pos";
import { formatCurrency, formatElapsedTime } from "../utils/format";

export const OwnerMobileView: React.FC = () => {
  const [deviceFrameMode, setDeviceFrameMode] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Sale | null>(null);
  const [, setClockTick] = useState(0);

  const completedSales = usePosStore((s) => s.completedSales);
  const queue = usePosStore((s) => s.queue);
  const invoices = usePosStore((s) => s.invoices);
  const isOffline = usePosStore((s) => s.isOffline);
  const businessId = usePosStore((s) => s.businessId);
  const branchId = usePosStore((s) => s.branchId);

  // Tick cada 5s para refrescar métricas de tiempo
  useEffect(() => {
    const timer = setInterval(() => setClockTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // Ventas de hoy con estado PAGADA
  const todaySales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    return completedSales.filter(
      (s) => s.status === "PAGADA" && s.createdAt >= todayISO
    );
  }, [completedSales]);

  // KPI 1: Total vendido hoy
  const totalRevenue = useMemo(
    () => todaySales.reduce((sum, s) => sum + s.total, 0),
    [todaySales]
  );

  // KPI 2: Cantidad de tickets cerrados
  const totalTickets = todaySales.length;

  // KPI 3: Ticket promedio
  const averageTicket = totalTickets > 0 ? totalRevenue / totalTickets : 0;

  // Desglose por Medio de Pago (Efectivo, QR, Tarjeta)
  const paymentBreakdown = useMemo(() => {
    const breakdown: Record<
      PaymentMethod,
      { total: number; count: number; percent: number }
    > = {
      EFECTIVO: { total: 0, count: 0, percent: 0 },
      QR: { total: 0, count: 0, percent: 0 },
      TARJETA: { total: 0, count: 0, percent: 0 },
    };

    todaySales.forEach((s) => {
      const method = s.paymentMethod || "EFECTIVO";
      if (breakdown[method]) {
        breakdown[method].total += s.total;
        breakdown[method].count += 1;
      }
    });

    if (totalRevenue > 0) {
      breakdown.EFECTIVO.percent = Math.round(
        (breakdown.EFECTIVO.total / totalRevenue) * 100
      );
      breakdown.QR.percent = Math.round(
        (breakdown.QR.total / totalRevenue) * 100
      );
      breakdown.TARJETA.percent = Math.round(
        (breakdown.TARJETA.total / totalRevenue) * 100
      );
    }

    return breakdown;
  }, [todaySales, totalRevenue]);

  // Alertas Operativas
  const pendingQueueCount = queue.filter(
    (s) => s.status === "PENDIENTE_PAGO"
  ).length;
  const rejectedQueueCount = queue.filter(
    (s) => s.status === "PAGO_RECHAZADO"
  ).length;
  const pendingFiscalSyncCount = invoices.filter(
    (i) => i.fiscalStatus === "PENDIENTE_ENVIO_ARCA"
  ).length;

  // Cierre de Turno / Arqueo rápido
  const cashInDrawer = paymentBreakdown.EFECTIVO.total;
  const digitalRevenue =
    paymentBreakdown.QR.total + paymentBreakdown.TARJETA.total;

  const firstTicketTime =
    todaySales.length > 0
      ? new Date(todaySales[todaySales.length - 1].createdAt).toLocaleTimeString(
          "es-AR",
          { hour: "2-digit", minute: "2-digit" }
        )
      : "--:--";

  const lastTicketTime =
    todaySales.length > 0
      ? new Date(todaySales[0].createdAt).toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";

  // Top productos vendidos hoy
  const topProducts = useMemo(() => {
    const counter: Record<string, { name: string; qty: number; total: number }> =
      {};
    todaySales.forEach((s) => {
      s.items.forEach((item) => {
        if (!counter[item.productId]) {
          counter[item.productId] = {
            name: item.name,
            qty: 0,
            total: 0,
          };
        }
        counter[item.productId].qty += item.qty;
        counter[item.productId].total += item.subtotal;
      });
    });

    return Object.values(counter)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);
  }, [todaySales]);

  // Render contenido del panel móvil
  const renderMobileContent = () => (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto select-none font-sans pb-6">
      {/* ── Barra Superior Móvil (Status Bar Smartphone) ── */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 sticky top-0 z-20 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              Panel Dueño / Encargado
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            {businessId} • {branchId}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold ${
              isOffline
                ? "bg-amber-950 text-amber-300 border-amber-800"
                : "bg-emerald-950 text-emerald-300 border-emerald-800"
            }`}
          >
            {isOffline ? "LAN Offline" : "En Vivo (LAN)"}
          </span>
        </div>
      </div>

      <div className="p-3.5 space-y-4">
        {/* ── KPI Cards Principales ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Total Vendido */}
          <div className="col-span-2 p-4 bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Total Vendido Hoy
            </span>
            <div className="text-3xl font-black font-mono text-white mt-1">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{totalTickets} tickets cerrados</span>
              <span className="text-emerald-400/90 font-mono">
                Prom: {formatCurrency(averageTicket)}
              </span>
            </div>
          </div>

          {/* Tickets Cerrados */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
              <Receipt className="w-3 h-3 text-cyan-400" />
              Tickets Hoy
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {totalTickets}
            </div>
          </div>

          {/* Ticket Promedio */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-purple-400" />
              Ticket Promedio
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(averageTicket)}
            </div>
          </div>
        </div>

        {/* ── Alertas Operativas en Vivo ── */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 block">
            Estado de Operación en Mostrador:
          </label>

          {rejectedQueueCount > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-600 flex items-center gap-2.5 animate-pulse">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-rose-200">
                  {rejectedQueueCount} Pago(s) Rechazado(s)
                </div>
                <div className="text-[10px] text-rose-300">
                  Requiere atención del cajero en mostrador para reintentar cobro.
                </div>
              </div>
            </div>
          )}

          {pendingQueueCount > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-600 flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-200">
                  {pendingQueueCount} Cliente(s) en espera de cobro
                </div>
                <div className="text-[10px] text-amber-300">
                  Escaneando QR o pasando tarjeta en terminal.
                </div>
              </div>
            </div>
          )}

          {pendingFiscalSyncCount > 0 && (
            <div className="p-2.5 rounded-xl bg-purple-950/50 border border-purple-700 flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-purple-300 shrink-0" />
              <div>
                <div className="text-xs font-bold text-purple-200">
                  {pendingFiscalSyncCount} Comprobante(s) Offline
                </div>
                <div className="text-[10px] text-purple-300">
                  Guardados en IndexedDB local pendientes de envío a ARCA.
                </div>
              </div>
            </div>
          )}

          {pendingQueueCount === 0 &&
            rejectedQueueCount === 0 &&
            pendingFiscalSyncCount === 0 && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80 flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-200">
                    Mostrador Ágil y al Día
                  </div>
                  <div className="text-[10px] text-emerald-300/80">
                    Sin filas trabadas ni pagos rechazados pendientes.
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* ── Desglose por Medio de Pago ── */}
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center justify-between">
            <span>Desglose por Medio de Pago</span>
            <span className="text-[10px] font-normal text-slate-400">
              100% de ventas cerradas
            </span>
          </h3>

          <div className="space-y-2.5">
            {/* Efectivo */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Banknote className="w-3.5 h-3.5" /> Efectivo
                </span>
                <span className="font-mono text-white">
                  {formatCurrency(paymentBreakdown.EFECTIVO.total)}{" "}
                  <span className="text-[10px] text-slate-400">
                    ({paymentBreakdown.EFECTIVO.percent}%)
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${paymentBreakdown.EFECTIVO.percent}%` }}
                />
              </div>
            </div>

            {/* QR Interoperable */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1">
                <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                  <QrCode className="w-3.5 h-3.5" /> QR Interoperable
                </span>
                <span className="font-mono text-white">
                  {formatCurrency(paymentBreakdown.QR.total)}{" "}
                  <span className="text-[10px] text-slate-400">
                    ({paymentBreakdown.QR.percent}%)
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-purple-400 transition-all duration-500 rounded-full"
                  style={{ width: `${paymentBreakdown.QR.percent}%` }}
                />
              </div>
            </div>

            {/* Tarjeta */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1">
                <span className="flex items-center gap-1.5 text-blue-400 font-bold">
                  <CreditCard className="w-3.5 h-3.5" /> Tarjeta / Posnet
                </span>
                <span className="font-mono text-white">
                  {formatCurrency(paymentBreakdown.TARJETA.total)}{" "}
                  <span className="text-[10px] text-slate-400">
                    ({paymentBreakdown.TARJETA.percent}%)
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-400 transition-all duration-500 rounded-full"
                  style={{ width: `${paymentBreakdown.TARJETA.percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Resumen de Cierre de Turno / Arqueo ── */}
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-bold text-white flex items-center justify-between">
            <span>Arqueo de Turno Rápido</span>
            <span className="text-[10px] font-mono text-slate-400">
              {firstTicketTime} - {lastTicketTime}
            </span>
          </h3>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[10px] font-sans text-slate-400 mb-0.5">
                Efectivo en Cajón:
              </div>
              <div className="text-sm font-bold text-emerald-400">
                {formatCurrency(cashInDrawer)}
              </div>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[10px] font-sans text-slate-400 mb-0.5">
                Dinero Digital (Banco/MP):
              </div>
              <div className="text-sm font-bold text-purple-300">
                {formatCurrency(digitalRevenue)}
              </div>
            </div>
          </div>

          {/* Top 3 Productos */}
          {topProducts.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1.5">
                <Flame className="w-3 h-3 text-amber-400" />
                Más Vendidos del Turno:
              </div>
              <div className="space-y-1">
                {topProducts.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-0.5"
                  >
                    <span className="text-slate-300 truncate max-w-[180px]">
                      {idx + 1}. {p.name}
                    </span>
                    <span className="font-mono text-slate-400 font-bold">
                      {p.qty} un.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Feed en Vivo de Últimos Tickets Cobrados ── */}
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-bold text-white flex items-center justify-between">
            <span>Últimos Tickets Emitidos</span>
            <span className="text-[10px] text-slate-400">Tiempo real</span>
          </h3>

          <div className="space-y-2">
            {todaySales.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                Aún no hay tickets cerrados en este turno.
              </p>
            ) : (
              todaySales.slice(0, 5).map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => setSelectedTicket(sale)}
                  className="p-2.5 bg-slate-950/80 hover:bg-slate-850 rounded-xl border border-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                        sale.paymentMethod === "QR"
                          ? "bg-purple-950 text-purple-400 border border-purple-800"
                          : sale.paymentMethod === "TARJETA"
                          ? "bg-blue-950 text-blue-400 border border-blue-800"
                          : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      }`}
                    >
                      {sale.paymentMethod === "QR" ? (
                        <QrCode className="w-3.5 h-3.5" />
                      ) : sale.paymentMethod === "TARJETA" ? (
                        <CreditCard className="w-3.5 h-3.5" />
                      ) : (
                        <Banknote className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{sale.invoiceNumber || `#${sale.id.slice(-6)}`}</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(sale.createdAt).toLocaleTimeString("es-AR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                        {sale.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      {formatCurrency(sale.total)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de Detalle de Ticket para el Dueño ── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="font-bold text-sm text-white">
                Ticket {selectedTicket.invoiceNumber || selectedTicket.id}
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Hora:</span>
                <span className="font-mono">
                  {new Date(selectedTicket.createdAt).toLocaleString("es-AR")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Medio:</span>
                <span className="font-mono font-bold">
                  {selectedTicket.paymentMethod}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cliente:</span>
                <span>
                  {selectedTicket.customer?.businessName || "Consumidor Final"}
                </span>
              </div>
              {selectedTicket.cae && (
                <div className="flex justify-between text-emerald-400">
                  <span>CAE ARCA:</span>
                  <span className="font-mono">{selectedTicket.cae}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 pt-2 space-y-1 text-xs">
              <div className="font-bold text-slate-400 mb-1">Ítems:</div>
              {selectedTicket.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-slate-200">
                  <span>
                    {item.qty}x {item.name}
                  </span>
                  <span className="font-mono">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-2 flex justify-between font-mono font-bold text-base text-white">
              <span>Total:</span>
              <span className="text-emerald-400">
                {formatCurrency(selectedTicket.total)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-950 overflow-hidden font-sans p-2 sm:p-4">
      {/* Controles de vista: Toggle Marco Móvil vs Pantalla Completa */}
      <div className="w-full max-w-md flex items-center justify-between pb-2 px-1 text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-200">
            Vista Celular Dueño
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            (Simula smartphone conectado a la Wi-Fi local)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setDeviceFrameMode(!deviceFrameMode)}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
        >
          {deviceFrameMode ? (
            <>
              <Maximize2 className="w-3 h-3" />
              <span>Pantalla Completa</span>
            </>
          ) : (
            <>
              <Minimize2 className="w-3 h-3" />
              <span>Marco Celular</span>
            </>
          )}
        </button>
      </div>

      {/* Contenedor del Celular */}
      {deviceFrameMode ? (
        <div className="w-full max-w-[390px] h-[92vh] max-h-[780px] bg-slate-900 border-[10px] border-slate-800 rounded-[44px] shadow-2xl flex flex-col overflow-hidden relative ring-1 ring-slate-700/50">
          {/* Dynamic Island / Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-slate-800 mr-2" />
            <span className="w-2.5 h-2.5 rounded-full bg-blue-900/60" />
          </div>

          {/* Status Bar */}
          <div className="h-7 bg-slate-900 text-[10px] text-slate-400 px-6 pt-1 flex items-center justify-between shrink-0 select-none font-mono">
            <span>
              {new Date().toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <div className="flex items-center gap-1.5 text-[9px]">
              <span>5G</span>
              <span>Wi-Fi</span>
              <span>98%</span>
            </div>
          </div>

          {/* Pantalla del Celular */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderMobileContent()}
          </div>

          {/* Home indicator bar (iPhone gesture line) */}
          <div className="h-4 bg-slate-950 flex items-center justify-center shrink-0">
            <div className="w-28 h-1 bg-slate-600 rounded-full" />
          </div>
        </div>
      ) : (
        <div className="w-full max-w-2xl h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden">
          {renderMobileContent()}
        </div>
      )}
    </div>
  );
};
