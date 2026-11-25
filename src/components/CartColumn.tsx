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
import { ModifierBar } from "./ModifierBar";

const QUICK_DISCOUNT_PERCENTAGES = [5, 10, 15, 20];

interface CartColumnProps {
  cart: CartItem[];
  cartTotal: number;
  cartDiscount: number;
  selectedLineKey: string | null;
  productsMap: Map<string, Product>;
  onSelectLine: (lineKey: string | null) => void;
  onUpdateQty: (lineKey: string, delta: number) => void;
  onRemoveItem: (lineKey: string) => void;
  onClearCart: () => void;
  onSetDiscount: (amount: number) => void;
  onOpenCheckout: () => void;
  onQuickCash: () => void;
  onChangeModifiers: (
    lineKey: string,
    product: Product,
    modifiers: SelectedModifier[],
  ) => void;
}

export const CartColumn: React.FC<CartColumnProps> = ({
  cart,
  cartTotal,
  cartDiscount,
  selectedLineKey,
  productsMap,
  onSelectLine,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onSetDiscount,
  onOpenCheckout,
  onQuickCash,
  onChangeModifiers,
}) => {
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountVal, setDiscountVal] = useState("0");
  const [modifierEditorLineKey, setModifierEditorLineKey] = useState<string | null>(null);
  const [editingQtyLineKey, setEditingQtyLineKey] = useState<string | null>(null);
  const [qtyInputValue, setQtyInputValue] = useState("");

  const totalUnits = cart.reduce((sum, i) => sum + i.qty, 0);
  const finalTotal = Math.max(0, cartTotal - cartDiscount);
  const appliedDiscountPercent =
    cartTotal > 0 ? Number(((cartDiscount / cartTotal) * 100).toFixed(2)) : 0;

  const applyDiscountPercent = (percent: number) => {
    onSetDiscount(Math.round((cartTotal * percent) / 100));
    setDiscountVal(percent.toString());
    setShowDiscountInput(false);
  };

  const startQtyEdit = (lineKey: string, qty: number) => {
    setEditingQtyLineKey(lineKey);
    setQtyInputValue(String(qty));
  };

  const saveQtyEdit = (lineKey: string, currentQty: number) => {
    const newQty = Number(qtyInputValue);
    if (!Number.isSafeInteger(newQty) || newQty < 1) return;

    const delta = newQty - currentQty;
    if (delta !== 0) onUpdateQty(lineKey, delta);
    setEditingQtyLineKey(null);
  };

  const selectLine = (lineKey: string) => {
    if (lineKey !== selectedLineKey) {
      onSelectLine(lineKey);
    }
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
            const isSelected = item.lineKey === selectedLineKey;
            const originalProduct = productsMap.get(item.productId);
            const hasModifiers = Boolean(originalProduct?.modifiers?.length);

            return (
              <div
                key={item.lineKey}
                role="button"
                tabIndex={0}
                onClick={() => selectLine(item.lineKey)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  selectLine(item.lineKey);
                  startQtyEdit(item.lineKey, item.qty);
                }}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    selectLine(item.lineKey);
                  }
                }}
                aria-label={`${item.name}, cantidad ${item.qty}, subtotal ${formatCurrency(item.subtotal)}. Doble clic en la tarjeta para editar la cantidad; Enter para confirmar.`}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? "bg-slate-850 border-emerald-400 ring-1 ring-emerald-500/60 shadow-sm shadow-emerald-950/40"
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
                      {isSelected && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                          Seleccionado
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
                {(item.selectedModifiers.length > 0 ||
                  (hasModifiers && originalProduct)) && (
                  <div
                    className="mt-1.5 pt-1 border-t border-slate-800/60 flex flex-wrap items-center gap-1"
                  >
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
                    {hasModifiers && originalProduct && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setModifierEditorLineKey((current) =>
                            current === item.lineKey ? null : item.lineKey,
                          );
                        }}
                        onDoubleClick={(event) => event.stopPropagation()}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors text-[10px] flex items-center gap-1"
                        aria-expanded={modifierEditorLineKey === item.lineKey}
                        title="Modificar extras"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Extras</span>
                      </button>
                    )}
                  </div>
                )}

                <div
                  className="mt-2 grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2 border-t border-slate-800/40 pt-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item.lineKey, 1)}
                    onDoubleClick={(event) => event.stopPropagation()}
                    className="h-11 w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors"
                    aria-label="Sumar una unidad"
                    title="Sumar una unidad"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  {editingQtyLineKey === item.lineKey ? (
                    <input
                      autoFocus
                      type="number"
                      min="1"
                      max={Number.MAX_SAFE_INTEGER}
                      step="1"
                      required
                      value={qtyInputValue}
                      onChange={(event) => setQtyInputValue(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (event.currentTarget.reportValidity()) {
                            saveQtyEdit(item.lineKey, item.qty);
                          }
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          setEditingQtyLineKey(null);
                        }
                      }}
                      className="h-11 w-16 rounded-lg border border-emerald-500 bg-slate-950 px-1 text-center text-sm font-mono font-bold text-white focus:outline-none"
                      aria-label={`Editar cantidad de ${item.name}; Enter para guardar, Escape para cancelar`}
                      title="Enter para confirmar, Escape para cancelar"
                    />
                  ) : (
                    <span
                      className="flex h-11 min-w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-2 font-mono text-sm font-bold text-white"
                      aria-label={`Cantidad actual: ${item.qty}`}
                      title="Doble clic en la tarjeta para editar cantidad"
                    >
                      {item.qty}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item.lineKey, -1)}
                    onDoubleClick={(event) => event.stopPropagation()}
                    className="h-11 w-full rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center justify-center transition-colors"
                    aria-label="Restar una unidad"
                    title="Restar una unidad"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.lineKey)}
                    onDoubleClick={(event) => event.stopPropagation()}
                    className="h-11 w-full rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 flex items-center justify-center transition-colors"
                    aria-label="Eliminar ítem"
                    title="Eliminar ítem"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {modifierEditorLineKey === item.lineKey && hasModifiers && originalProduct && (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <ModifierBar
                      product={originalProduct}
                      mode="edit"
                      initialModifiers={item.selectedModifiers}
                      onClose={() => setModifierEditorLineKey(null)}
                      onChangeModifiers={(modifiers) =>
                        onChangeModifiers(item.lineKey, originalProduct, modifiers)
                      }
                    />
                  </div>
                )}
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
              onClick={() => {
                if (!showDiscountInput) {
                  setDiscountVal(
                    cartTotal > 0 ? appliedDiscountPercent.toString() : "0",
                  );
                }
                setShowDiscountInput((show) => !show);
              }}
              className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 underline underline-offset-2"
            >
              <Percent className="w-3 h-3" />
              <span>
                {cartDiscount > 0
                  ? `Descuento aplicado (${appliedDiscountPercent}%)`
                  : "Aplicar descuento"}
              </span>
            </button>
            <span className="font-mono text-rose-400">
              {cartDiscount > 0 ? `-${formatCurrency(cartDiscount)}` : "$0"}
            </span>
          </div>

          {showDiscountInput && (
            <form
              className="space-y-2 pt-1"
              onSubmit={(event) => {
                event.preventDefault();
                applyDiscountPercent(Number(discountVal));
              }}
            >
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="cart-discount-percent"
                  className="shrink-0 text-[11px] text-slate-400"
                >
                  Descuento:
                </label>
                <div className="flex min-w-0 flex-1 items-center rounded border border-slate-700 bg-slate-950 pr-2 focus-within:border-emerald-500">
                  <input
                    id="cart-discount-percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    required
                    value={discountVal}
                    onChange={(e) => setDiscountVal(e.target.value)}
                    placeholder="5"
                    className="w-full min-w-0 bg-transparent px-2 py-1 text-xs font-mono text-white focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded text-xs font-bold"
                >
                  Aplicar
                </button>
              </div>
              <div className="flex items-center gap-1">
                <span className="shrink-0 text-[10px] text-slate-500">
                  Rápidos:
                </span>
                {QUICK_DISCOUNT_PERCENTAGES.map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => applyDiscountPercent(percent)}
                    className="flex-1 rounded bg-slate-800 px-1.5 py-1 text-[10px] font-mono text-slate-200 hover:bg-slate-700 hover:text-emerald-400 transition-colors"
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </form>
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
