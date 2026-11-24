import React, { useState, useMemo } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Search,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  QrCode,
  CreditCard,
  Banknote,
  Copy,
  Check,
} from "lucide-react";
import { usePosStore } from "../store/usePosStore";
import type { Invoice, InvoiceType, FiscalCustomer, PaymentMethod } from "../types/pos";
import { formatCurrency } from "../utils/format";
import { formatCuit, isValidCuit, cleanCuit } from "../utils/cuit";

export const BillingOfflineView: React.FC = () => {
  const isOffline = usePosStore((s) => s.isOffline);
  const setOfflineMode = usePosStore((s) => s.setOfflineMode);
  const invoices = usePosStore((s) => s.invoices);
  const syncPendingInvoices = usePosStore((s) => s.syncPendingInvoices);
  const businessId = usePosStore((s) => s.businessId);
  const branchId = usePosStore((s) => s.branchId);

  // Estado local para selector y vista de tickets
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"TODOS" | "FACTURA_B" | "FACTURA_A" | "PENDIENTES">("TODOS");
  const [searchFilter, setSearchFilter] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Comprobante actualmente seleccionado para previsualización
  const activeInvoice = useMemo(() => {
    if (selectedInvoiceId) {
      const found = invoices.find((i) => i.id === selectedInvoiceId);
      if (found) return found;
    }
    return invoices.length > 0 ? invoices[0] : null;
  }, [invoices, selectedInvoiceId]);

  // Pendientes de sincronización ARCA
  const pendingInvoices = useMemo(
    () => invoices.filter((i) => i.fiscalStatus === "PENDIENTE_ENVIO_ARCA"),
    [invoices]
  );

  // Lista filtrada para la tabla
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Filtro pestaña
      if (filterType === "FACTURA_B" && inv.invoiceType !== "FACTURA_B") return false;
      if (filterType === "FACTURA_A" && inv.invoiceType !== "FACTURA_A") return false;
      if (filterType === "PENDIENTES" && inv.fiscalStatus !== "PENDIENTE_ENVIO_ARCA") return false;

      // Filtro texto
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      const numMatch = inv.invoiceNumber.toLowerCase().includes(q);
      const nameMatch = inv.customer.businessName?.toLowerCase().includes(q);
      const cuitMatch = inv.customer.cuit?.toLowerCase().includes(q);
      const caeMatch = inv.cae?.toLowerCase().includes(q);

      return numMatch || nameMatch || cuitMatch || caeMatch;
    });
  }, [invoices, filterType, searchFilter]);

  // Sincronizar pendientes con ARCA
  const handleSync = async () => {
    if (isOffline) {
      alert("Para sincronizar con ARCA primero debés restablecer la conexión (toggle Online).");
      return;
    }

    try {
      setIsSyncing(true);
      // Simular latencia de conexión con web service ARCA WSFE
      await new Promise((r) => setTimeout(r, 1200));
      const count = await syncPendingInvoices();
      setSyncFeedback(`✓ Se autorizaron ${count} comprobante(s) en ARCA con éxito.`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyTicket = () => {
    if (!activeInvoice) return;
    const text = `
========================================
             KIOSCO TERMAS
      COMPLEJO TERMAL DEL LITORAL
          CUIT: 30-71489234-8
         IVA RESP. INSCRIPTO
     Punto de Venta: 0001 - Kiosco Central
========================================
COMPROBANTE: ${activeInvoice.invoiceType} N° ${activeInvoice.invoiceNumber}
FECHA: ${new Date(activeInvoice.createdAt).toLocaleString("es-AR")}
CLIENTE: ${activeInvoice.customer.businessName} ${activeInvoice.customer.cuit ? `(CUIT: ${activeInvoice.customer.cuit})` : ""}
----------------------------------------
${activeInvoice.items.map((i) => `${i.qty}x ${i.name} - ${formatCurrency(i.subtotal)}`).join("\n")}
----------------------------------------
TOTAL: ${formatCurrency(activeInvoice.total)}
PAGO: ${activeInvoice.paymentMethod}
${activeInvoice.fiscalStatus === "AUTORIZADO" ? `CAE: ${activeInvoice.cae}\nVTO CAE: ${activeInvoice.caeExpiresAt ? new Date(activeInvoice.caeExpiresAt).toLocaleDateString("es-AR") : ""}` : "ESTADO: PENDIENTE DE ENVÍO ARCA (OFFLINE)"}
========================================
`.trim();

    navigator.clipboard.writeText(text);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden font-sans">
      {/* ── Barra de Control de Conectividad & Resiliencia Offline ── */}
      <section className="p-3.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isOffline
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              }`}
            >
              {isOffline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Control de Conectividad & Cola Offline
                </h2>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                    isOffline
                      ? "bg-amber-950 text-amber-300 border border-amber-700 animate-pulse"
                      : "bg-emerald-950 text-emerald-300 border border-emerald-700"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOffline ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                  />
                  {isOffline ? "Sin Internet (Simulando corte)" : "Online / ARCA Conectado"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isOffline
                  ? "Las ventas se cobran normalmente sin demoras y los tickets se guardan en IndexedDB como PENDIENTE_ENVIO_ARCA."
                  : "Conexión activa con el Web Service de ARCA (ex AFIP). Emisión de CAE en tiempo real."}
              </p>
            </div>
          </div>

          {/* Toggle de Conectividad */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setOfflineMode(!isOffline)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                isOffline
                  ? "bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400"
                  : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750 hover:border-slate-600"
              }`}
              title="Alternar entre Online y Sin Internet para probar la resiliencia offline"
            >
              {isOffline ? (
                <>
                  <Wifi className="w-4 h-4" />
                  <span>Restablecer Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-amber-400" />
                  <span>Simular Corte de Internet</span>
                </>
              )}
            </button>

            {/* Botón Sincronizar Pendientes */}
            <button
              type="button"
              disabled={isOffline || pendingInvoices.length === 0 || isSyncing}
              onClick={handleSync}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                pendingInvoices.length > 0 && !isOffline
                  ? "bg-emerald-500 text-slate-950 border-emerald-400 hover:bg-emerald-400 shadow-lg shadow-emerald-950 animate-pulse"
                  : "bg-slate-850 text-slate-500 border-slate-800 cursor-not-allowed opacity-60"
              }`}
              title="Enviar a ARCA los comprobantes emitidos durante la contingencia offline"
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
              />
              <span>
                {isSyncing
                  ? "Sincronizando con ARCA..."
                  : `Sincronizar pendientes (${pendingInvoices.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Feedback de sincronización */}
        {syncFeedback && (
          <div className="mt-2 p-2 bg-emerald-950/80 border border-emerald-600 rounded-lg text-xs font-medium text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{syncFeedback}</span>
          </div>
        )}
      </section>

      {/* ── Contenido Principal de Facturación: 2 Paneles ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel Izquierdo (~60%): Configuración Facturas B / A + Tabla de Comprobantes */}
        <section className="flex-1 flex flex-col border-r border-slate-800 overflow-y-auto p-4 space-y-4">
          {/* Tarjetas de Selección y Configuración B / A */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
            {/* Factura B */}
            <div className="p-3.5 bg-slate-900/90 border border-emerald-900/50 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    B
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Factura B</h3>
                    <p className="text-[10px] text-slate-400">Consumidor Final</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Por Defecto (F9)
                </span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 mb-2.5">
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> IVA incluido (no discriminado)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Selección directa al cobrar en efectivo
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> No requiere CUIT del cliente
                </li>
              </ul>
              <div className="text-[10px] font-mono text-slate-400 bg-slate-950/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                <span>Punto de Venta: 0001</span>
                <span>
                  Emitidos B:{" "}
                  <strong className="text-emerald-400">
                    {invoices.filter((i) => i.invoiceType === "FACTURA_B").length}
                  </strong>
                </span>
              </div>
            </div>

            {/* Factura A */}
            <div className="p-3.5 bg-slate-900/90 border border-blue-900/50 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                    A
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Factura A</h3>
                    <p className="text-[10px] text-slate-400">Responsable Inscripto</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                  Exige CUIT
                </span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 mb-2.5">
                <li className="flex items-center gap-1.5">
                  <span className="text-blue-400">✓</span> Discrimina Neto Gravado e IVA 21%
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-blue-400">✓</span> Validación de CUIT argentino (Módulo 11)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-blue-400">✓</span> Requiere Razón Social de la empresa
                </li>
              </ul>
              <div className="text-[10px] font-mono text-slate-400 bg-slate-950/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                <span>Punto de Venta: 0001</span>
                <span>
                  Emitidos A:{" "}
                  <strong className="text-blue-400">
                    {invoices.filter((i) => i.invoiceType === "FACTURA_A").length}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* ── Tabla de Comprobantes Emitidos e Historial ── */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden">
            {/* Cabecera & Filtros */}
            <div className="p-3 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: "TODOS", label: "Todos", count: invoices.length, badge: false },
                    {
                      id: "FACTURA_B",
                      label: "Factura B",
                      count: invoices.filter((i) => i.invoiceType === "FACTURA_B").length,
                      badge: false,
                    },
                    {
                      id: "FACTURA_A",
                      label: "Factura A",
                      count: invoices.filter((i) => i.invoiceType === "FACTURA_A").length,
                      badge: false,
                    },
                    {
                      id: "PENDIENTES",
                      label: "Pendientes ARCA",
                      count: pendingInvoices.length,
                      badge: pendingInvoices.length > 0,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      filterType === tab.id
                        ? "bg-slate-800 text-white border border-slate-700"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        tab.badge
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Buscador */}
              <div className="relative w-full sm:w-52">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar N°, CUIT o cliente..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Listado de Comprobantes */}
            <div className="flex-1 overflow-y-auto">
              {filteredInvoices.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No se encontraron comprobantes para este filtro.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 text-[11px] font-mono sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Comprobante</th>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Cliente / CUIT</th>
                      <th className="py-2.5 px-3">Medio</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3 text-center">Estado Fiscal</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredInvoices.map((inv) => {
                      const isSelected = activeInvoice?.id === inv.id;
                      const isPending = inv.fiscalStatus === "PENDIENTE_ENVIO_ARCA";

                      return (
                        <tr
                          key={inv.id}
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-slate-800/80 font-medium text-white"
                              : "hover:bg-slate-850 text-slate-300"
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  inv.invoiceType === "FACTURA_A"
                                    ? "bg-blue-950 text-blue-400 border border-blue-800"
                                    : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                }`}
                              >
                                {inv.invoiceType === "FACTURA_A" ? "A" : "B"}
                              </span>
                              <span className="font-bold">{inv.invoiceNumber}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                            {new Date(inv.createdAt).toLocaleTimeString("es-AR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="truncate max-w-[150px]">
                              {inv.customer.businessName}
                            </div>
                            {inv.customer.cuit && (
                              <div className="text-[10px] font-mono text-slate-400">
                                {inv.customer.cuit}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {inv.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {formatCurrency(inv.total)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                                <Clock className="w-3 h-3 text-amber-400" />
                                PENDIENTE ARCA
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                AUTORIZADO
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInvoiceId(inv.id);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono transition-colors"
                            >
                              Ver Ticket
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

        {/* Panel Derecho (~40%): Vista Previa Fotorrealista de Ticket Térmico */}
        <section className="w-80 lg:w-[420px] flex flex-col bg-slate-900 border-l border-slate-800 shrink-0 select-none overflow-hidden">
          {/* Cabecera del Panel */}
          <div className="p-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-xs text-white uppercase tracking-wider">
                Ticket Térmico (80mm)
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyTicket}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                title="Copiar texto del ticket"
              >
                {copiedTicket ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                title="Imprimir ticket en impresora térmica"
              >
                <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {/* Contenedor del Ticket Térmico con Papel Monocromo Realista */}
          <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-slate-950/70">
            {activeInvoice ? (
              <div
                id="thermal-ticket"
                className="w-full max-w-[340px] bg-[#fbfbf8] text-slate-900 p-4 rounded-sm shadow-2xl font-mono text-[11px] leading-tight flex flex-col border-t-4 border-b-4 border-slate-400 select-text"
              >
                {/* Encabezado Comercio */}
                <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-400">
                  <div className="font-black text-sm tracking-widest text-black">
                    🌊 KIOSCO TERMAS
                  </div>
                  <div className="text-[10px] text-slate-700 font-bold">
                    COMPLEJO TERMAL DEL LITORAL
                  </div>
                  <div className="text-[10px] text-slate-600">
                    CUIT: 30-71489234-8
                  </div>
                  <div className="text-[10px] text-slate-600">
                    IVA RESPONSABLE INSCRIPTO
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Av. de las Termas 1200 - Colón, Entre Ríos
                  </div>
                  <div className="text-[9px] text-slate-500">
                    P.V. 0001 • {businessId} • {branchId}
                  </div>
                </div>

                {/* Datos del Comprobante */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
                  <div className="flex items-center justify-between font-black text-xs text-black">
                    <span>
                      {activeInvoice.invoiceType === "FACTURA_A"
                        ? "FACTURA \"A\""
                        : "FACTURA \"B\""}
                    </span>
                    <span>N° {activeInvoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Fecha: {new Date(activeInvoice.createdAt).toLocaleDateString("es-AR")}</span>
                    <span>Hora: {new Date(activeInvoice.createdAt).toLocaleTimeString("es-AR")}</span>
                  </div>
                  <div className="pt-1 text-[10px]">
                    <div className="font-bold text-black">
                      CLIENTE: {activeInvoice.customer.businessName || "CONSUMIDOR FINAL"}
                    </div>
                    {activeInvoice.customer.cuit && (
                      <div className="text-slate-700">
                        CUIT: {activeInvoice.customer.cuit} ({activeInvoice.customer.taxCondition})
                      </div>
                    )}
                    {activeInvoice.customer.address && (
                      <div className="text-[9px] text-slate-500 truncate">
                        Dom: {activeInvoice.customer.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabla de Ítems */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
                  <div className="flex justify-between font-bold text-[10px] text-slate-700 border-b border-slate-300 pb-1">
                    <span className="w-8">CANT</span>
                    <span className="flex-1">DETALLE</span>
                    <span className="w-16 text-right">P.UNIT</span>
                    <span className="w-16 text-right">TOTAL</span>
                  </div>

                  {activeInvoice.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5 pt-1">
                      <div className="flex justify-between">
                        <span className="w-8 font-bold">{item.qty}</span>
                        <span className="flex-1 font-bold text-black truncate pr-1">
                          {item.name}
                        </span>
                        <span className="w-16 text-right text-slate-600">
                          {formatCurrency(item.unitFinalPrice)}
                        </span>
                        <span className="w-16 text-right font-bold text-black">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                      {/* Modificadores */}
                      {item.selectedModifiers.map((mod, mIdx) => (
                        <div
                          key={mIdx}
                          className="pl-8 text-[9px] text-slate-600 flex justify-between italic"
                        >
                          <span>+ {mod.name}</span>
                          <span>{formatCurrency(mod.priceDelta * item.qty)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Subtotales y Totales */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(activeInvoice.subtotal)}</span>
                  </div>
                  {activeInvoice.discount > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Descuento Aplicado:</span>
                      <span>-{formatCurrency(activeInvoice.discount)}</span>
                    </div>
                  )}

                  {/* Si es Factura A: Discrimina IVA */}
                  {activeInvoice.invoiceType === "FACTURA_A" && (
                    <>
                      <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                        <span>Neto Gravado (21%):</span>
                        <span>{formatCurrency(activeInvoice.netAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>IVA Débito Fiscal (21%):</span>
                        <span>{formatCurrency(activeInvoice.ivaAmount)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between font-black text-sm text-black pt-1 border-t border-slate-300">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(activeInvoice.total)}</span>
                  </div>
                </div>

                {/* Medio de Pago */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
                  <div className="flex justify-between font-bold">
                    <span>FORMA DE PAGO:</span>
                    <span>{activeInvoice.paymentMethod}</span>
                  </div>
                  {activeInvoice.cashReceived && activeInvoice.cashReceived > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>EFECTIVO RECIBIDO:</span>
                        <span>{formatCurrency(activeInvoice.cashReceived)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-800">
                        <span>VUELTO ENTREGADO:</span>
                        <span>{formatCurrency(activeInvoice.change || 0)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Pie Fiscal: CAE vs CONTINGENCIA */}
                <div className="pt-2 text-center space-y-1">
                  {activeInvoice.fiscalStatus === "AUTORIZADO" ? (
                    <div className="bg-emerald-50 border border-emerald-400 p-2 rounded text-[10px] space-y-1">
                      <div className="flex items-center justify-center gap-1 font-bold text-emerald-900">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                        <span>COMPROBANTE AUTORIZADO POR ARCA</span>
                      </div>
                      <div className="font-bold text-slate-900">
                        CAE N°: {activeInvoice.cae}
                      </div>
                      <div className="text-[9px] text-slate-600">
                        Fecha Vto. CAE:{" "}
                        {activeInvoice.caeExpiresAt
                          ? new Date(activeInvoice.caeExpiresAt).toLocaleDateString("es-AR")
                          : "10 días"}
                      </div>
                      {/* Simulación QR Fiscal */}
                      <div className="pt-1 flex flex-col items-center">
                        <div className="w-16 h-16 bg-white border border-slate-300 p-1 rounded flex items-center justify-center shadow-inner">
                          <QrCode className="w-14 h-14 text-slate-900" />
                        </div>
                        <span className="text-[8px] text-slate-500 pt-0.5">
                          QR Fiscal ARCA / AFIP
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border-2 border-dashed border-amber-500 p-2 rounded text-[10px] space-y-1 text-amber-950">
                      <div className="flex items-center justify-center gap-1 font-black text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>EMISIÓN EN CONTINGENCIA OFFLINE</span>
                      </div>
                      <div className="font-bold text-[9px]">
                        ESTADO: PENDIENTE_ENVIO_ARCA
                      </div>
                      <p className="text-[8px] text-slate-600 leading-tight">
                        Comprobante respaldado localmente en IndexedDB. Se autorizará y
                        obtendrá CAE al restablecerse la conectividad.
                      </p>
                    </div>
                  )}

                  <div className="text-[8px] text-slate-500 pt-1">
                    Gracias por su visita al Complejo Termal
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
                <Printer className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs">No hay comprobante seleccionado</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
