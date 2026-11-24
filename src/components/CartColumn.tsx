import React, { useState } from "react";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Banknote,
  CreditCard,
  Edit2,
  Percent,
  CheckCircle,
} from "lucide-react";
import type { CartItem, Product, SelectedModifier } from "../types/pos";
import { formatCurrency } from "../utils/format";

interface CartColumnProps {
  cart: CartItem[];
  cartTotal: number;
  cartDiscount: number;
  lastActiveLineKey: string | null;
  productsMap: Map<string, Product>;
  onUpdateQty: (lineKey: string, delta: number) => void;
  onRemoveItem: (lineKey: string) => void;
  onClearCart: () => void;
  onSetDiscount: (amount: number) => void;
  onOpenCheckout: () => void;
  onQuickCash: () => void;
  onEditModifiers: (product: Product, currentModifiers: SelectedModifier[]) => void;
}

export const CartColumn: React.FC<CartColumnProps> = ({
  cart,
  cartTotal,
  cartDiscount,
  lastActiveLineKey,
  productsMap,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onSetDiscount,
  onOpenCheckout,
  onQuickCash,
  onEditModifiers,
}) => {
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountVal, setDiscountVal] = useState(cartDiscount.toString());

  const totalUnits = cart.reduce((sum, i) => sum + i.qty, 0);
  const finalTotal = Math.max(0, cartTotal - cartDiscount);

  const handleApplyDiscount = () => {
    const num = parseFloat(discountVal) || 0;
    onSetDiscount(num);
    setShowDiscountInput(false);
  };

  return (
    <section className="w-80 lg:w-96 flex flex-col h-full bg-slate-900 border-r border-slate-800 shrink-0 select-none">
      {/* ── Cabecera del Carrito ── */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-400" />
          <h2 className="font-bold text-sm text-white">Carrito Activo</h2>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
            BORRADOR
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">
            {totalUnits} ítem{totalUnits !== 1 ? "s" : ""}
          </span>
          {cart.length > 0 && (
            <button
              onClick={onClearCart}
              className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
              title="Vaciar carrito"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Lista de Ítems del Carrito ── */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
            <ShoppingCart className="w-10 h-10 opacity-30 stroke-1" />
            <p className="text-sm font-medium text-slate-400">Carrito vacío</p>
            <p className="text-xs text-slate-500">
              Elegí productos del catálogo o presioná <span className="font-mono text-emerald-400 bg-slate-800 px-1 py-0.5 rounded">F2</span> para buscar.
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const isLastActive = item.lineKey === lastActiveLineKey;
            const originalProduct = productsMap.get(item.productId);

            return (
              <div
                key={item.lineKey}
                className={`p-2.5 rounded-lg border transition-all ${
                  isLastActive
                    ? "bg-slate-850 border-emerald-500/70 shadow-sm shadow-emerald-950/40"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Fila Superior: Nombre, Badge activo, Subtotal */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-xs text-white truncate">
                        {item.name}
                      </p>
                      {isLastActive && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                          Activo [+/-]
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-400">
                      {formatCurrency(item.unitFinalPrice)} c/u
                    </p>
                  </div>

                  <span className="font-mono font-bold text-xs text-emerald-400 shrink-0">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>

                {/* Modificadores Seleccionados */}
                {item.selectedModifiers.length > 0 && (
                  <div className="mt-1.5 pt-1 border-t border-slate-800/60 flex flex-wrap gap-1">
                    {item.selectedModifiers.map((mod) => (
                      <span
                        key={mod.modifierId}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                      >
                        {mod.name}{" "}
                        {mod.priceDelta > 0 && (
                          <span className="text-emerald-400 font-mono">
                            (+{formatCurrency(mod.priceDelta)})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {/* Controles de Cantidad y Acciones */}
                <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-800/40">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateQty(item.lineKey, -1)}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                      title="Disminuir (-)"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-xs text-white px-2 min-w-6 text-center">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => onUpdateQty(item.lineKey, 1)}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                      title="Aumentar (+)"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {originalProduct && originalProduct.modifiers && originalProduct.modifiers.length > 0 && (
                      <button
                        onClick={() => onEditModifiers(originalProduct, item.selectedModifiers)}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors text-[10px] flex items-center gap-1"
                        title="Modificar extras"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                    )}
                    <button
                      onClick={() => onRemoveItem(item.lineKey)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                      title="Eliminar ítem"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Resumen y Totales ── */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0 space-y-2.5">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal:</span>
            <span className="font-mono text-slate-200">
              {formatCurrency(cartTotal)}
            </span>
          </div>

          {/* Descuento manual */}
          <div className="flex justify-between items-center text-slate-400">
            <button
              type="button"
              onClick={() => setShowDiscountInput(!showDiscountInput)}
              className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 underline underline-offset-2"
            >
              <Percent className="w-3 h-3" />
              <span>{cartDiscount > 0 ? "Descuento aplicado" : "Aplicar descuento"}</span>
            </button>
            <span className="font-mono text-rose-400">
              {cartDiscount > 0 ? `-${formatCurrency(cartDiscount)}` : "$0"}
            </span>
          </div>

          {showDiscountInput && (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="number"
                min="0"
                step="500"
                value={discountVal}
                onChange={(e) => setDiscountVal(e.target.value)}
                placeholder="Monto en $"
                className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleApplyDiscount}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded text-xs font-bold"
              >
                OK
              </button>
            </div>
          )}
        </div>

        {/* Total Gigante */}
        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total a Pagar
          </span>
          <span className="text-xl lg:text-2xl font-black font-mono text-emerald-400">
            {formatCurrency(finalTotal)}
          </span>
        </div>

        {/* ── Botones de Acción de Cobro ── */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={onQuickCash}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 shadow-md shadow-amber-950/40 transition-all"
            title="Cobro rápido en efectivo (F9)"
          >
            <Banknote className="w-4 h-4 stroke-[2.5]" />
            <span>Efectivo (F9)</span>
          </button>

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={onOpenCheckout}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 shadow-md shadow-emerald-950/40 transition-all"
            title="Abrir cobro completo (F8)"
          >
            <CreditCard className="w-4 h-4 stroke-[2.5]" />
            <span>Cobrar (F8)</span>
          </button>
        </div>
      </div>
    </section>
  );
};
