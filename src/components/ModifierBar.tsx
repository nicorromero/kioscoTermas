import React, { useState, useEffect } from "react";
import { Check, X, Plus, Utensils } from "lucide-react";
import type { Product, ModifierOption, SelectedModifier } from "../types/pos";
import { formatCurrency } from "../utils/format";

interface ModifierBarProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart?: (product: Product, modifiers: SelectedModifier[]) => void;
  mode?: "add" | "edit";
  initialModifiers?: SelectedModifier[];
  onChangeModifiers?: (modifiers: SelectedModifier[]) => void;
}

export const ModifierBar: React.FC<ModifierBarProps> = ({
  product,
  onClose,
  onAddToCart,
  mode = "add",
  initialModifiers,
  onChangeModifiers,
}) => {
  const [selectedMods, setSelectedMods] = useState<Record<string, ModifierOption>>({});

  // En el carrito, la selección es controlada por la línea para recalcular al instante.
  const selectedModsForView: Record<string, ModifierOption> =
    mode === "edit" && product
      ? Object.fromEntries(
          (initialModifiers ?? [])
            .map((selected) => {
              const option = product.modifiers?.find(
                (modifier) => modifier.id === selected.modifierId,
              );
              return option ? [option.id, option] : null;
            })
            .filter(
              (option): option is [string, ModifierOption] => option !== null,
            ),
        )
      : selectedMods;

  useEffect(() => {
    const initial: Record<string, ModifierOption> = {};
    if (product?.modifiers) {
      const exclusiveGroups = new Set(
        product.modifiers
          .filter((modifier) => modifier.exclusive && modifier.group)
          .map((modifier) => modifier.group!),
      );

      exclusiveGroups.forEach((group) => {
        const firstInGroup = product.modifiers?.find(
          (modifier) => modifier.group === group,
        );
        if (firstInGroup) initial[firstInGroup.id] = firstInGroup;
      });
    }

    setSelectedMods(initial);
  }, [product?.id, mode]);

  if (!product) return null;

  const toggleModifier = (mod: ModifierOption) => {
    const next = { ...selectedModsForView };
    const isCurrentlySelected = !!next[mod.id];

    if (mod.exclusive && mod.group) {
      Object.keys(next).forEach((id) => {
        if (next[id].group === mod.group) delete next[id];
      });
      if (!isCurrentlySelected) next[mod.id] = mod;
    } else if (isCurrentlySelected) {
      delete next[mod.id];
    } else {
      next[mod.id] = mod;
    }

    if (mode === "edit") {
      onChangeModifiers?.(
        Object.values(next).map((modifier) => ({
          modifierId: modifier.id,
          name: modifier.name,
          priceDelta: modifier.priceDelta,
        })),
      );
    } else {
      setSelectedMods(next);
    }
  };

  const selectedArray: SelectedModifier[] = Object.values(selectedModsForView).map((m) => ({
    modifierId: m.id,
    name: m.name,
    priceDelta: m.priceDelta,
  }));

  const finalUnitPrice =
    product.basePrice +
    selectedArray.reduce((acc, m) => acc + m.priceDelta, 0);

  const handleConfirm = () => {
    onAddToCart?.(product, selectedArray);
    onClose();
  };

  if (mode === "edit") {
    return (
      <div
        className="mt-2 rounded-md border border-slate-700 bg-slate-950/80 p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Extras · {formatCurrency(finalUnitPrice)} c/u
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Listo
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {product.modifiers?.map((mod) => {
            const isSelected = !!selectedModsForView[mod.id];
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => toggleModifier(mod)}
                aria-pressed={isSelected}
                className={`rounded border px-1.5 py-1 text-[10px] transition-colors ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                {isSelected ? "✓ " : ""}
                {mod.name}
                {mod.priceDelta > 0
                  ? ` +${formatCurrency(mod.priceDelta)}`
                  : ""}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
