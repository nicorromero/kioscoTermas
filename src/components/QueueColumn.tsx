import React, { useState, useEffect } from "react";
import {
  Clock,
  QrCode,
  CreditCard,
  Banknote,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  History,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { Sale, PaymentMethod } from "../types/pos";
import { formatCurrency, formatElapsedTime } from "../utils/format";

interface QueueColumnProps {
  queue: Sale[];
  paymentHistory: Sale[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRecover: (saleId: string) => void;
  onMarkPaid: (saleId: string) => void;
  onMarkRejected: (saleId: string) => void;
  onRetry: (saleId: string, method: PaymentMethod) => void;
  onCancel: (saleId: string) => void;
}

export const QueueColumn: React.FC<QueueColumnProps> = ({
  queue,
  paymentHistory,
  isExpanded,
  onToggleExpanded,
  onRecover,
  onMarkPaid,
  onMarkRejected,
  onRetry,
  onCancel,
}) => {
  // Cronómetro en vivo: tick cada 1s para refrescar los tiempos relativos
  const [, setTick] = useState(0);
  const [retryDropdownId, setRetryDropdownId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getMethodIcon = (method?: PaymentMethod) => {
    switch (method) {
      case "QR":
        return <QrCode className="w-3.5 h-3.5 text-purple-400" />;
      case "TARJETA":
        return <CreditCard className="w-3.5 h-3.5 text-blue-400" />;
      case "EFECTIVO":
        return <Banknote className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <CreditCard className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Ordenar: primero los rechazados (alerta roja arriba), luego los pendientes por fecha descendente
  const sortedQueue = [...queue].sort((a, b) => {
    if (a.status === "PAGO_RECHAZADO" && b.status !== "PAGO_RECHAZADO") return -1;
    if (a.status !== "PAGO_RECHAZADO" && b.status === "PAGO_RECHAZADO") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (!isExpanded) {
    const rejectedCount = queue.filter(
      (sale) => sale.status === "PAGO_RECHAZADO",
    ).length;

    return (
      <aside className="w-12 flex flex-col h-full bg-slate-950 shrink-0 select-none border-l border-slate-800">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={`Abrir cola de pagos, ${queue.length} en espera, ${rejectedCount} rechazados`}
          title="Abrir cola de pagos"
          className="relative flex-1 flex flex-col items-center gap-3 pt-4 text-slate-300 hover:bg-slate-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-400" />
          <Clock className="w-5 h-5 text-purple-400" />
          <span className="text-[10px] font-mono [writing-mode:vertical-rl]">
            Cola de pagos
          </span>
          {queue.length > 0 && (
            <span className="absolute top-12 right-1 min-w-5 px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
              {queue.length}
            </span>
          )}
          {rejectedCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-72 lg:w-80 flex flex-col h-full bg-slate-950 shrink-0 select-none border-l border-slate-800">
      {/* ── Cabecera de la Cola ── */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <h2 className="font-bold text-sm text-white">Cola de Pagos</h2>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
              queue.length > 0
                ? "bg-amber-950 text-amber-300 border-amber-800 animate-pulse"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            {queue.length} en espera
          </span>
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label="Minimizar cola de pagos"
            title="Minimizar cola de pagos"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Lista de Tarjetas en Cola ── */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {queue.length === 0 ? (
          <div className="min-h-36 flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
            <CheckCircle2 className="w-9 h-9 text-slate-600 stroke-1" />
            <p className="text-xs font-medium text-slate-400">
              No hay pagos en espera
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Las ventas enviadas a QR o terminal quedan aquí con cronómetro en
              vivo mientras atendés al siguiente cliente.
            </p>
          </div>
        ) : (
          sortedQueue.map((sale) => {
            const isRejected = sale.status === "PAGO_RECHAZADO";
            const elapsedTime = formatElapsedTime(sale.createdAt);

            return (
              <div
                key={sale.id}
                className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                  isRejected
                    ? "bg-rose-950/40 border-rose-600 shadow-lg shadow-rose-950/40 animate-pulse"
                    : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Cabecera Tarjeta: Estado + Cronómetro */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1.5 ${
                      isRejected
                        ? "bg-rose-900 text-rose-200 border border-rose-700"
                        : "bg-amber-950 text-amber-400 border border-amber-800/80"
                    }`}
                  >
                    {isRejected ? (
                      <>
                        <AlertCircle className="w-3 h-3 text-rose-300" />
                        PAGO RECHAZADO
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        ESPERANDO PAGO
                      </>
                    )}
                  </span>

                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {elapsedTime}
                  </span>
                </div>

                {/* Importe y Método */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-lg font-black font-mono text-white">
                      {formatCurrency(sale.total)}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1.5">
                      ({sale.items.reduce((acc, i) => acc + i.qty, 0)} ítems)
                    </span>
                  </div>

                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
                    {getMethodIcon(sale.paymentMethod)}
                    <span>{sale.paymentMethod || "QR"}</span>
                  </div>
                </div>

                {/* Resumen Ítems */}
                <div className="text-[11px] text-slate-400 line-clamp-2 bg-slate-950/60 p-1.5 rounded border border-slate-800/60">
                  {sale.items
                    .map(
                      (i) =>
                        `${i.qty}x ${i.name}${
                          i.selectedModifiers.length > 0
                            ? ` (${i.selectedModifiers.map((m) => m.name).join(", ")})`
                            : ""
                        }`
                    )
                    .join(" • ")}
                </div>

                {sale.notes && (
                  <div className="text-[10px] text-amber-300/80 italic">
                    Nota: {sale.notes}
                  </div>
                )}

                {/* ── 4 Acciones de la Tarjeta ── */}
                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1.5 text-xs">
                  {/* Acción 1: Reintentar / Cambiar Pago */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setRetryDropdownId(
                          retryDropdownId === sale.id ? null : sale.id
                        )
                      }
                      className="w-full py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1 transition-colors"
                      title="Cambiar medio de cobro o reintentar"
                    >
                      <RefreshCw className="w-3 h-3 text-cyan-400" />
                      <span className="text-[11px] font-medium">Reintentar</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {retryDropdownId === sale.id && (
                      <div className="absolute left-0 bottom-full mb-1 w-36 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20">
                        <div className="p-1 text-[10px] text-slate-400 font-mono border-b border-slate-800">
                          Cobrar con:
                        </div>
                        {(["EFECTIVO", "QR", "TARJETA"] as PaymentMethod[]).map(
                          (m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                onRetry(sale.id, m);
                                setRetryDropdownId(null);
                              }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-[11px] text-slate-200 flex items-center gap-1.5"
                            >
                              {getMethodIcon(m)}
                              <span>{m}</span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* Acción 2: Marcar Pagado [sim] */}
                  <button
                    type="button"
                    onClick={() => onMarkPaid(sale.id)}
                    className="py-1.5 px-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-slate-950 font-bold border border-emerald-400 flex items-center justify-center gap-1 transition-colors shadow-sm"
                    title="Simular aprobación del pago (webhook / terminal OK)"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[11px]">Pagado [sim]</span>
                  </button>

                  {/* Acción 3: Simular Rechazo [sim] */}
                  {!isRejected && (
                    <button
                      type="button"
                      onClick={() => onMarkRejected(sale.id)}
                      className="py-1.5 px-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 flex items-center justify-center gap-1 transition-colors"
                      title="Simular rechazo de tarjeta o timeout de QR"
                    >
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span className="text-[11px]">Rechazo [sim]</span>
                    </button>
                  )}

                  {/* Acción 4: Cancelar Venta */}
                  <button
                    type="button"
                    onClick={() => onCancel(sale.id)}
                    className={`py-1.5 px-2 rounded-lg bg-slate-850 hover:bg-rose-950 hover:text-rose-300 text-slate-400 border border-slate-800 flex items-center justify-center gap-1 transition-colors ${
                      isRejected ? "col-span-2" : ""
                    }`}
                    title="Cancelar venta y liberar cola"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="text-[11px]">Cancelar</span>
                  </button>
                </div>
              </div>
            );
          })
        )}

        <section className="pt-3 border-t border-slate-800">
          <h3 className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-2">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            Últimos pedidos enviados
          </h3>
          {paymentHistory.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Los pedidos enviados a cobrar aparecerán acá.
            </p>
          ) : (
            <div className="space-y-2">
              {paymentHistory.map((sale) => (
                <article
                  key={sale.id}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      {new Date(sale.createdAt).toLocaleString()}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold ${
                        sale.status === "PAGO_RECHAZADO"
                          ? "text-rose-300"
                          : sale.status === "CANCELADA"
                            ? "text-slate-500"
                            : sale.status === "PAGADA"
                              ? "text-emerald-400"
                              : "text-amber-300"
                      }`}
                    >
                      {sale.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold text-white">
                      {formatCurrency(sale.total)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {sale.items.reduce((sum, item) => sum + item.qty, 0)} ítems
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400 line-clamp-1">
                    {sale.items.map((item) => item.name).join(" • ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRecover(sale.id)}
                    className="w-full mt-2 py-1.5 px-2 rounded-md bg-cyan-950/70 hover:bg-cyan-900 text-cyan-200 border border-cyan-800/70 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Recuperar al carrito
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
