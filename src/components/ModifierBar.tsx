import React, { useState, useEffect, useMemo } from "react";
import { Check, X, Plus, Sparkles, Utensils } from "lucide-react";
import type { Product, ModifierOption, SelectedModifier } from "../types/pos";
import { formatCurrency } from "../utils/format";

interface ModifierBarProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, modifiers: SelectedModifier[]) => void;
}

export const ModifierBar: React.FC<ModifierBarProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const [selectedMods, setSelectedMods] = useState<Record<string, ModifierOption>>({});

  // Al cambiar de producto, resetear selección con los defaults (ej: si tiene modificadores exclusivos obligatorios como Con Agua)
  useEffect(() => {
    if (!product || !product.modifiers || product.modifiers.length === 0) {
      setSelectedMods({});
      return;
    }

    const initial: Record<string, ModifierOption> = {};
    // Pre-seleccionar primera opción de cada grupo exclusivo (ej: "Con Agua" en licuados, "Chico" en café)
    const exclusiveGroups = new Set(
      product.modifiers.filter((m) => m.exclusive && m.group).map((m) => m.group!)
    );

    exclusiveGroups.forEach((group) => {
      const firstInGroup = product.modifiers?.find((m) => m.group === group);
      if (firstInGroup) {
        initial[firstInGroup.id] = firstInGroup;
      }
    });

    setSelectedMods(initial);
  }, [product]);

  if (!product) return null;

  const toggleModifier = (mod: ModifierOption) => {
    setSelectedMods((prev) => {
      const next = { ...prev };
      const isCurrentlySelected = !!next[mod.id];

      if (mod.exclusive && mod.group) {
        // Deseleccionar cualquier otro del mismo grupo
        Object.keys(next).forEach((id) => {
          if (next[id].group === mod.group) {
            delete next[id];
          }
        });
        if (!isCurrentlySelected) {
          next[mod.id] = mod;
        }
      } else {
        if (isCurrentlySelected) {
          delete next[mod.id];
        } else {
          next[mod.id] = mod;
        }
      }
      return next;
    });
  };

  const selectedArray: SelectedModifier[] = Object.values(selectedMods).map((m) => ({
    modifierId: m.id,
    name: m.name,
    priceDelta: m.priceDelta,
  }));

  const finalUnitPrice =
    product.basePrice +
    selectedArray.reduce((acc, m) => acc + m.priceDelta, 0);

  const handleConfirm = () => {
    onAddToCart(product, selectedArray);
    onClose();
  };

  return (
    <div className="bg-slate-900 border-t-2 border-emerald-500/80 p-3 shadow-2xl shrink-0 flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-150">
      {/* Cabecera del producto seleccionado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: product.colorTag || "#10B981" }}
          />
          <h3 className="font-bold text-sm text-white">
            {product.name}
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Base: {formatCurrency(product.basePrice)}
          </span>
          {product.isCombo && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
              COMBO
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors"
          title="Descartar (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Si es combo, mostrar detalle de inclusions */}
      {product.isCombo && product.comboIncludes && product.comboIncludes.length > 0 && (
        <div className="bg-purple-950/40 border border-purple-900/60 rounded-md p-2 flex items-center gap-2 text-xs text-purple-200">
          <Utensils className="w-3.5 h-3.5 shrink-0 text-purple-400" />
          <span className="font-semibold text-purple-300">Incluye:</span>
          <span className="text-purple-100">
            {product.comboIncludes.map((ci) => `${ci.qty}x ${ci.label}`).join(" + ")}
          </span>
        </div>
      )}

      {/* Opciones de Modificadores */}
      {product.modifiers && product.modifiers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
          {product.modifiers.map((mod) => {
            const isSelected = !!selectedMods[mod.id];
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => toggleModifier(mod)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-950"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600 hover:bg-slate-750"
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                    isSelected
                      ? "bg-emerald-400 text-slate-950 border-emerald-400"
                      : "border-slate-600 bg-slate-900"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>{mod.name}</span>
                <span
                  className={`font-mono text-[11px] ${
                    isSelected ? "text-emerald-100" : mod.priceDelta > 0 ? "text-emerald-400 font-bold" : "text-slate-400"
                  }`}
                >
                  {mod.priceDelta > 0
                    ? `+${formatCurrency(mod.priceDelta)}`
                    : mod.priceDelta === 0
                    ? "(+$0)"
                    : formatCurrency(mod.priceDelta)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Barra de acción y total final */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-slate-400">Total Ítem:</span>
          <span className="text-base font-bold font-mono text-emerald-400">
            {formatCurrency(finalUnitPrice)}
          </span>
          {selectedArray.length > 0 && (
            <span className="text-[11px] text-slate-400">
              ({selectedArray.length} modificador{selectedArray.length > 1 ? "es" : ""})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
          >
            Descartar (Esc)
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded-md text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 shadow-md shadow-emerald-950 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Agregar al Carrito
          </button>
        </div>
      </div>
    </div>
  );
};
