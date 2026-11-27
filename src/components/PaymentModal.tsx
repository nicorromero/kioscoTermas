import React, { useState } from "react";
import {
  X,
  QrCode,
  CreditCard,
  Banknote,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import type { PaymentMethod, InvoiceType, FiscalCustomer } from "../types/pos";
import { formatCurrency } from "../utils/format";
import { formatCuit, isValidCuit, cleanCuit } from "../utils/cuit";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartTotal: number;
  cartDiscount: number;
  itemCount: number;
  onSubmitSale: (
    method: PaymentMethod,
    notes?: string,
    cashReceived?: number,
    invoiceType?: InvoiceType,
    customer?: FiscalCustomer,
    qrAccountId?: "QR_1" | "QR_2",
    buzzerNumber?: string,
  ) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  cartTotal,
  cartDiscount,
  itemCount,
  onSubmitSale,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("QR");
  const [qrAccountId, setQrAccountId] = useState<"QR_1" | "QR_2">("QR_1");
  const [buzzerNumber, setBuzzerNumber] = useState("");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("FACTURA_B");
  const [cuitInput, setCuitInput] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [notes, setNotes] = useState("");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const finalTotal = Math.max(0, cartTotal - cartDiscount);
  const cashNum = parseFloat(cashReceivedInput) || 0;
  const change = Math.max(0, cashNum - finalTotal);
  const coversTotal = cashNum >= finalTotal;

  // Validación de CUIT para Factura A
  const cuitClean = cleanCuit(cuitInput);
  const cuitValid = isValidCuit(cuitInput);
  const canConfirmFacturaA =
    invoiceType !== "FACTURA_A" ||
    (cuitValid && businessName.trim().length >= 3);

  // Montos sugeridos de billetes
  const quickBills = [
    finalTotal,
    Math.ceil(finalTotal / 5000) * 5000,
    Math.ceil(finalTotal / 10000) * 10000,
    Math.ceil(finalTotal / 20000) * 20000,
  ].filter((v, i, a) => v >= finalTotal && a.indexOf(v) === i);

  const handleCuitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCuit(e.target.value);
    setCuitInput(formatted);
  };

  const handleConfirm = async () => {
    if (!canConfirmFacturaA) return;

    try {
      setIsSubmitting(true);
      const cash = selectedMethod === "EFECTIVO" ? (cashNum > 0 ? cashNum : finalTotal) : undefined;

      const customer: FiscalCustomer =
        invoiceType === "FACTURA_A"
          ? {
              cuit: cuitInput,
              businessName: businessName.trim(),
              taxCondition: "RESPONSABLE_INSCRIPTO",
            }
          : {
              businessName: "Consumidor Final",
              taxCondition: "CONSUMIDOR_FINAL",
            };

      await onSubmitSale(
        selectedMethod,
        notes.trim() || undefined,
        cash,
        invoiceType,
        customer,
        selectedMethod === "QR" ? qrAccountId : undefined,
        buzzerNumber.trim() || undefined,
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* ── Cabecera ── */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Finalizar Venta</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                ({itemCount} ítems)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Elegí el medio de pago y comprobante. El carrito se libera en 0 ms.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Total Destacado ── */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Total a Cobrar
          </span>
          <span className="text-3xl font-black font-mono text-emerald-400">
            {formatCurrency(finalTotal)}
          </span>
        </div>

        <div className="p-4 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* ── Métodos de Pago Activos: EFECTIVO | QR | TARJETA (Sin Pulsera) ── */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Medio de Pago:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: "QR",
                  label: "QR Interoperable",
                  icon: QrCode,
                  color: "text-purple-400",
                  border: "hover:border-purple-500",
                },
                {
                  id: "EFECTIVO",
                  label: "Efectivo",
                  icon: Banknote,
                  color: "text-emerald-400",
                  border: "hover:border-emerald-500",
                },
                {
                  id: "TARJETA",
                  label: "Tarjeta / Posnet",
                  icon: CreditCard,
                  color: "text-blue-400",
                  border: "hover:border-blue-500",
                },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethod(m.id as PaymentMethod)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md"
                        : `bg-slate-900 border-slate-800 ${m.border} hover:bg-slate-850`
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1 ${m.color}`} />
                    <span className="text-xs font-bold text-white">
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedMethod === "QR" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {([
                  ["QR_1", "QR 1 - Caja Principal"],
                  ["QR_2", "QR 2 - Barra / Auxiliar"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setQrAccountId(id)}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold ${
                      qrAccountId === id
                        ? "border-purple-400 bg-purple-950/50 text-purple-200"
                        : "border-slate-800 bg-slate-950 text-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[11px] text-slate-400">Llamador manual (01-50):</label>
              <input
                value={buzzerNumber}
                onChange={(event) =>
                  setBuzzerNumber(event.target.value.replace(/\D/g, "").slice(0, 2))
                }
                inputMode="numeric"
                className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-center font-mono text-sm text-amber-300"
                placeholder="Auto"
              />
            </div>
          </div>

          {/* ── Tipo de Comprobante Fiscal: Factura B vs Factura A ── */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2 flex items-center justify-between">
              <span>Tipo de Comprobante Fiscal:</span>
              <span className="text-[11px] text-slate-400 font-normal">
                ARCA (ex AFIP)
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInvoiceType("FACTURA_B")}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                  invoiceType === "FACTURA_B"
                    ? "bg-emerald-950/40 border-emerald-500/80 ring-2 ring-emerald-500/30"
                    : "bg-slate-950/60 border-slate-800 hover:bg-slate-850"
                }`}
              >
                <FileText
                  className={`w-4 h-4 ${
                    invoiceType === "FACTURA_B" ? "text-emerald-400" : "text-slate-400"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-white">Factura B</div>
                  <div className="text-[10px] text-slate-400">
                    Consumidor Final (IVA incl.)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType("FACTURA_A")}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                  invoiceType === "FACTURA_A"
                    ? "bg-blue-950/40 border-blue-500/80 ring-2 ring-blue-500/30"
                    : "bg-slate-950/60 border-slate-800 hover:bg-slate-850"
                }`}
              >
                <Building2
                  className={`w-4 h-4 ${
                    invoiceType === "FACTURA_A" ? "text-blue-400" : "text-slate-400"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-white">Factura A</div>
                  <div className="text-[10px] text-slate-400">
                    Resp. Inscripto (discrimina IVA)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* ── Formulario Factura A (si aplica) ── */}
          {invoiceType === "FACTURA_A" && (
            <div className="p-3 bg-blue-950/20 border border-blue-900/50 rounded-xl space-y-2.5 animate-in fade-in duration-150">
              <div className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Datos Fiscales del Cliente (Factura A)</span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  CUIT del Cliente:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cuitInput}
                    onChange={handleCuitChange}
                    placeholder="30-71123456-6"
                    maxLength={13}
                    className={`w-full px-3 py-1.5 bg-slate-900 border rounded-lg text-xs font-mono text-white placeholder-slate-600 focus:outline-none ${
                      cuitClean.length === 11
                        ? cuitValid
                          ? "border-emerald-500 ring-1 ring-emerald-500"
                          : "border-rose-500 ring-1 ring-rose-500"
                        : "border-slate-700 focus:border-blue-500"
                    }`}
                  />
                  {cuitClean.length === 11 && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      {cuitValid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </span>
                  )}
                </div>
                {cuitClean.length > 0 && cuitClean.length === 11 && !cuitValid && (
                  <p className="text-[10px] text-rose-400 mt-1">
                    CUIT inválido según dígito verificador oficial ARCA.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Razón Social / Empresa:
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej: Termas del Litoral S.A."
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between border-t border-blue-900/40 pt-1.5">
                <span>Neto: {formatCurrency(finalTotal / 1.21)}</span>
                <span>IVA 21%: {formatCurrency(finalTotal - finalTotal / 1.21)}</span>
              </div>
            </div>
          )}

          {/* ── Sección Dinámica según Medio ── */}
          {selectedMethod === "EFECTIVO" ? (
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Monto Recibido en Efectivo:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="500"
                    autoFocus
                    value={cashReceivedInput}
                    onChange={(e) => setCashReceivedInput(e.target.value)}
                    placeholder={finalTotal.toString()}
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Billetes sugeridos rápidos */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-slate-400 mr-1">Billetes:</span>
                {quickBills.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setCashReceivedInput(b.toString())}
                    className="px-2.5 py-1 rounded bg-slate-850 border border-slate-700 hover:border-emerald-500 hover:bg-slate-800 text-xs font-mono text-emerald-400 transition-colors"
                  >
                    {formatCurrency(b)}
                  </button>
                ))}
              </div>

              {/* Vuelto calculado */}
              {cashNum > 0 && (
                <div
                  className={`p-2.5 rounded-lg border flex items-center justify-between font-mono ${
                    coversTotal
                      ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-300"
                      : "bg-rose-950/40 border-rose-800/80 text-rose-300"
                  }`}
                >
                  <span className="text-xs font-sans font-medium">
                    {coversTotal ? "Vuelto a Entregar:" : "Faltante para cubrir:"}
                  </span>
                  <span className="text-lg font-black">
                    {coversTotal
                      ? formatCurrency(change)
                      : formatCurrency(finalTotal - cashNum)}
                  </span>
                </div>
              )}
            </div>
          ) : selectedMethod === "QR" ? (
            <div className="p-3 bg-purple-950/30 border border-purple-900/60 rounded-xl flex items-center gap-3">
              <QrCode className="w-8 h-8 text-purple-400 shrink-0" />
              <div className="text-xs text-purple-200">
                <p className="font-semibold text-white">QR Dinámico / Interoperable</p>
                <p className="text-[11px] text-purple-300/80">
                  La orden pasará a la cola lateral con cronómetro. El cajero queda libre en 0 ms para atender al siguiente cliente.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-950/30 border border-blue-900/60 rounded-xl flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-blue-400 shrink-0" />
              <div className="text-xs text-blue-200">
                <p className="font-semibold text-white">Terminal Posnet / Point</p>
                <p className="text-[11px] text-blue-300/80">
                  Esperando pase o chip en la terminal. El cobro corre en la cola sin bloquear el mostrador.
                </p>
              </div>
            </div>
          )}

          {/* ── Nota opcional ── */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Nota / Referencia (opcional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Mesa 4, Lleva a reposera, etc."
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* ── Pie de Botones ── */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Volver al Carrito (Esc)
          </button>

          <button
            type="button"
            disabled={
              isSubmitting ||
              (selectedMethod === "EFECTIVO" && cashNum > 0 && !coversTotal) ||
              !canConfirmFacturaA
            }
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-950 flex items-center gap-2 transition-all"
          >
            <span>Confirmar e Iniciar Cobro</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
