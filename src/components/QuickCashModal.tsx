import React, { useState, useEffect } from "react";
import { X, Banknote, FileText, Building2, Check, ArrowRight } from "lucide-react";
import type { InvoiceType, FiscalCustomer } from "../types/pos";
import { formatCurrency } from "../utils/format";
import { formatCuit, isValidCuit, cleanCuit } from "../utils/cuit";

interface QuickCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartTotal: number;
  cartDiscount: number;
  itemCount: number;
  onConfirmQuickCash: (
    cashReceived: number,
    invoiceType: InvoiceType,
    customer?: FiscalCustomer,
  ) => Promise<void>;
}

export const QuickCashModal: React.FC<QuickCashModalProps> = ({
  isOpen,
  onClose,
  cartTotal,
  cartDiscount,
  itemCount,
  onConfirmQuickCash,
}) => {
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("FACTURA_B");
  const [cuitInput, setCuitInput] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finalTotal = Math.max(0, cartTotal - cartDiscount);

  useEffect(() => {
    if (isOpen) {
      setCashReceivedInput(finalTotal.toString());
      setInvoiceType("FACTURA_B");
      setCuitInput("");
      setBusinessName("");
    }
  }, [isOpen, finalTotal]);

  if (!isOpen) return null;

  const cashNum = parseFloat(cashReceivedInput) || 0;
  const change = Math.max(0, cashNum - finalTotal);
  const coversTotal = cashNum >= finalTotal;

  // Billetes sugeridos
  const quickBills = [
    finalTotal,
    Math.ceil(finalTotal / 5000) * 5000,
    Math.ceil(finalTotal / 10000) * 10000,
    Math.ceil(finalTotal / 20000) * 20000,
  ].filter((v, i, a) => v >= finalTotal && a.indexOf(v) === i);

  const cuitClean = cleanCuit(cuitInput);
  const cuitValid = isValidCuit(cuitInput);
  const canConfirm =
    coversTotal &&
    (invoiceType !== "FACTURA_A" || (cuitValid && businessName.trim().length >= 3));

  const handleConfirm = async () => {
    if (!canConfirm) return;
    try {
      setIsSubmitting(true);
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

      await onConfirmQuickCash(cashNum, invoiceType, customer);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canConfirm) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Cabecera */}
        <div className="p-4 bg-emerald-950/40 border-b border-emerald-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Efectivo Rápido</span>
                <span className="font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800 text-[10px]">
                  F9
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Cobro y emisión de Factura B en un solo paso
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total destacado */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase text-slate-400 font-medium">
              Total a Pagar ({itemCount} ítems)
            </span>
          </div>
          <span className="text-3xl font-black font-mono text-emerald-400">
            {formatCurrency(finalTotal)}
          </span>
        </div>

        <div className="p-4 space-y-4">
          {/* Selector de Comprobante Rápido */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
              Comprobante a Emitir:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInvoiceType("FACTURA_B")}
                className={`py-2 px-3 rounded-lg border text-left flex items-center gap-2 transition-all ${
                  invoiceType === "FACTURA_B"
                    ? "bg-emerald-950/50 border-emerald-500 text-white font-bold ring-1 ring-emerald-500"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850"
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs">Factura B (Consumidor Final)</span>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType("FACTURA_A")}
                className={`py-2 px-3 rounded-lg border text-left flex items-center gap-2 transition-all ${
                  invoiceType === "FACTURA_A"
                    ? "bg-blue-950/50 border-blue-500 text-white font-bold ring-1 ring-blue-500"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850"
                }`}
              >
                <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs">Factura A (CUIT)</span>
              </button>
            </div>
          </div>

          {/* Form Factura A si se seleccionó */}
          {invoiceType === "FACTURA_A" && (
            <div className="p-3 bg-blue-950/30 border border-blue-900/60 rounded-xl space-y-2">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  CUIT:
                </label>
                <input
                  type="text"
                  value={cuitInput}
                  onChange={(e) => setCuitInput(formatCuit(e.target.value))}
                  placeholder="30-71123456-6"
                  maxLength={13}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Razón Social:
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Empresa S.A."
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Monto Recibido */}
          <div>
            <label className="text-xs font-semibold text-slate-200 block mb-1">
              Dinero Recibido:
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">
                $
              </span>
              <input
                type="number"
                step="500"
                autoFocus
                value={cashReceivedInput}
                onChange={(e) => setCashReceivedInput(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-emerald-500/80 rounded-lg text-xl font-mono font-black text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Billetes rápidos */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-slate-400 mr-1">Rápido:</span>
            {quickBills.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setCashReceivedInput(b.toString())}
                className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 hover:border-emerald-500 text-xs font-mono text-emerald-300 transition-colors"
              >
                {formatCurrency(b)}
              </button>
            ))}
          </div>

          {/* Vuelto a Entregar */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between font-mono ${
              coversTotal
                ? "bg-emerald-950/60 border-emerald-600 text-emerald-300"
                : "bg-rose-950/60 border-rose-600 text-rose-300"
            }`}
          >
            <span className="text-xs font-sans font-bold">
              {coversTotal ? "Vuelto a Entregar:" : "Monto Insuficiente:"}
            </span>
            <span className="text-2xl font-black">
              {coversTotal
                ? formatCurrency(change)
                : formatCurrency(finalTotal - cashNum)}
            </span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Cancelar (Esc)
          </button>

          <button
            type="button"
            disabled={!canConfirm || isSubmitting}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-950 flex items-center gap-2 transition-all"
          >
            <span>Cobrar e Imprimir Comprobante</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
