// ─── Drawer Lateral Express – Alta, Edición y Duplicación de Productos ────────
// Panel deslizante sobre la columna de catálogo para ajustes ultrarrápidos (<10 seg)
// sin perder el carrito ni abandonar la vista de mostrador.

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Save,
  Copy,
  Trash2,
  Sparkles,
  Barcode,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Layers,
  Tag,
} from "lucide-react";
import type {
  Product,
  ProductCategory,
  ProductFormData,
  ModifierOption,
  ComboInclude,
} from "../types/pos";
import { usePosStore } from "../store/usePosStore";
import {
  generateShortName,
  normalizeBarcode,
  MODIFIER_PRESETS,
  applyProductPreset,
} from "../utils/productUtils";
import { lookupBarcodeExternal } from "../utils/barcodeLookup";
import { isBarcodeAvailable } from "../db/indexedDb";
import { formatCurrency } from "../utils/format";

interface ProductDrawerProps {
  isOpen: boolean;
  product: Product | null; // null = Nuevo Producto
  onClose: () => void;
  onSaved?: (savedProduct: Product) => void;
  onRequestEditProduct?: (product: Product) => void;
}

const CATEGORIES: ProductCategory[] = [
  "Sandwiches",
  "Licuados",
  "Bebidas",
  "Combos",
  "Varios",
];

const COLOR_TAGS = [
  { label: "Esmeralda", value: "#10B981" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Naranja", value: "#F97316" },
  { label: "Púrpura", value: "#8B5CF6" },
  { label: "Ámbar", value: "#F59E0B" },
  { label: "Rojo", value: "#EF4444" },
];

export const ProductDrawer: React.FC<ProductDrawerProps> = ({
  isOpen,
  product,
  onClose,
  onSaved,
  onRequestEditProduct,
}) => {
  const isEditing = Boolean(product);
  const businessId = usePosStore((s) => s.businessId);
  const branchId = usePosStore((s) => s.branchId);
  const allProducts = usePosStore((s) => s.products);
  const lastProductId = usePosStore((s) => s.lastProductId);
  const upsertProduct = usePosStore((s) => s.upsertProduct);
  const duplicateProduct = usePosStore((s) => s.duplicateProduct);
  const duplicateLastProduct = usePosStore((s) => s.duplicateLastProduct);
  const removeProduct = usePosStore((s) => s.removeProduct);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const barcodeValidationRequest = useRef(0);

  // Estados del Formulario
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [isShortNameManuallyEdited, setIsShortNameManuallyEdited] = useState(false);
  const [category, setCategory] = useState<ProductCategory>("Sandwiches");
  const [basePrice, setBasePrice] = useState<number>(0);
  const [barcode, setBarcode] = useState("");
  const [isCombo, setIsCombo] = useState(false);
  const [comboIncludes, setComboIncludes] = useState<ComboInclude[]>([]);
  const [modifiers, setModifiers] = useState<ModifierOption[]>([]);
  const [colorTag, setColorTag] = useState<string>("#10B981");
  const [isFavorite, setIsFavorite] = useState(false);

  // Estado de validación
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [existingBarcodeProduct, setExistingBarcodeProduct] = useState<Product | null>(null);
  const [barcodeLookupMessage, setBarcodeLookupMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Nuevo modificador manual rápido
  const [showAddMod, setShowAddMod] = useState(false);
  const [newModName, setNewModName] = useState("");
  const [newModDelta, setNewModDelta] = useState<number>(0);
  const [newModGroup, setNewModGroup] = useState("extras");

  // Al abrir o cambiar de producto objetivo
  useEffect(() => {
    if (!isOpen) return;

    if (product) {
      setName(product.name);
      setShortName(product.shortName || "");
      setIsShortNameManuallyEdited(Boolean(product.shortName));
      setCategory(product.category);
      setBasePrice(product.basePrice);
      setBarcode(product.barcode || "");
      setIsCombo(Boolean(product.isCombo));
      setComboIncludes(product.comboIncludes ? [...product.comboIncludes] : []);
      setModifiers(product.modifiers ? [...product.modifiers] : []);
      setColorTag(product.colorTag || "#10B981");
      setIsFavorite(Boolean(product.isFavorite));
    } else {
      // Valores por defecto para nuevo ítem
      setName("");
      setShortName("");
      setIsShortNameManuallyEdited(false);
      setCategory("Sandwiches");
      setBasePrice(0);
      setBarcode("");
      setIsCombo(false);
      setComboIncludes([]);
      setModifiers([]);
      setColorTag("#10B981");
      setIsFavorite(false);
    }
    setBarcodeError(null);
    setExistingBarcodeProduct(null);
    setBarcodeLookupMessage(null);
    setErrorMsg(null);
    setShowAddMod(false);
    if (!product) {
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }, [isOpen, product]);

  // Manejar cambio de nombre con auto-sugerencia de nombre corto
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isShortNameManuallyEdited) {
      setShortName(generateShortName(val));
    }
  };

  // Manejar cambio de código de barras con validación asíncrona
  const handleBarcodeChange = async (val: string) => {
    const clean = normalizeBarcode(val);
    setBarcode(clean);
    setBarcodeLookupMessage(null);

    if (!clean) {
      barcodeValidationRequest.current += 1;
      setBarcodeError(null);
      setExistingBarcodeProduct(null);
      return;
    }

    const requestId = ++barcodeValidationRequest.current;
    const localMatch = allProducts.find(
      (item) => normalizeBarcode(item.barcode) === clean,
    ) ?? null;
    setExistingBarcodeProduct(localMatch);
    if (localMatch && localMatch.id !== product?.id) {
      setBarcodeError(`Código ya asignado a "${localMatch.name}".`);
      return;
    }

    const available = await isBarcodeAvailable(
      businessId,
      branchId,
      clean,
      product?.id
    );
    if (requestId !== barcodeValidationRequest.current) return;
    if (!available) {
      setBarcodeError("Código de barras ya asignado a otro producto");
    } else {
      setBarcodeError(null);
    }
  };

  const handleBarcodeLookup = async () => {
    if (!barcode) return;

    const requestId = barcodeValidationRequest.current;
    setBarcodeLookupMessage(null);
    const result = await lookupBarcodeExternal(barcode, allProducts);
    if (requestId !== barcodeValidationRequest.current) return;
    if (!result) {
      setBarcodeLookupMessage("Sin datos externos; podés completar el producto manualmente.");
      return;
    }
    if (result.kind === "local") {
      setExistingBarcodeProduct(result.product);
      setBarcodeError(
        result.product.id === product?.id
          ? null
          : `Código ya asignado a "${result.product.name}".`,
      );
      return;
    }

    if (!name.trim()) {
      setName(result.name);
      if (!isShortNameManuallyEdited) setShortName(generateShortName(result.name));
      setCategory(result.category);
    }
    setBarcodeLookupMessage(
      name.trim()
        ? `Encontrado: ${result.name}. No se reemplazaron los datos que ya ingresaste.`
        : `Nombre y categoría sugeridos desde Open Food Facts: ${result.name}.`,
    );
  };

  // Aplicar Preset de Modificadores en 1 Clic
  const handleApplyPreset = (presetKey: string) => {
    if (presetKey === "SANDWICH") {
      const preset = applyProductPreset("SANDWICH");
      if (preset.modifiers) setModifiers(preset.modifiers);
      return;
    }
    const preset = MODIFIER_PRESETS[presetKey];
    if (!preset) return;
    setModifiers([...preset.modifiers]);
  };

  const handleClearModifiers = () => {
    setModifiers([]);
  };

  const handleApplyComboPreset = () => {
    const preset = applyProductPreset("COMBO");
    if (!preset.isCombo) return;
    setCategory("Combos");
    setIsCombo(true);
    setComboIncludes(preset.comboIncludes);
    setModifiers([]);
  };

  const handleClearModifiersAndCombo = () => {
    setModifiers([]);
    setIsCombo(false);
    setComboIncludes([]);
  };

  const handleRemoveModifier = (id: string) => {
    setModifiers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddCustomModifier = () => {
    if (!newModName.trim()) return;
    const modId = `mod-${Date.now().toString(36).slice(-4)}`;
    const newMod: ModifierOption = {
      id: modId,
      name: newModName.trim(),
      priceDelta: Number(newModDelta) || 0,
      group: newModGroup.trim() || "extras",
    };
    setModifiers((prev) => [...prev, newMod]);
    setNewModName("");
    setNewModDelta(0);
    setShowAddMod(false);
  };

  // Manejo de Combo Items
  const handleAddComboItem = (productId: string) => {
    const targetProd = allProducts.find((p) => p.id === productId);
    if (!targetProd) return;

    setComboIncludes((prev) => {
      const exists = prev.find((item) => item.productId === productId);
      if (exists) {
        return prev.map((item) =>
          item.productId === productId ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId,
          qty: 1,
          label: targetProd.shortName || targetProd.name,
        },
      ];
    });
  };

  const handleUpdateComboQty = (productId: string, delta: number) => {
    setComboIncludes((prev) =>
      prev
        .map((item) =>
          item.productId === productId ? { ...item, qty: item.qty + delta } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  // Guardar Cambios / Crear
  const handleSave = async (e?: React.FormEvent, closeAfterSave = true) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("El nombre del producto es obligatorio.");
      return;
    }
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      setErrorMsg("El precio base debe ser mayor o igual a $0.");
      return;
    }

    if (barcode) {
      const available = await isBarcodeAvailable(
        businessId,
        branchId,
        barcode,
        product?.id
      );
      if (!available) {
        setBarcodeError("Código de barras ya asignado a otro producto.");
        return;
      }
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const formData: ProductFormData = {
        name: name.trim(),
        shortName: shortName.trim() || generateShortName(name),
        category,
        basePrice: Number(basePrice),
        barcode: barcode.trim() || undefined,
        isCombo,
        comboIncludes: isCombo && comboIncludes.length > 0 ? comboIncludes : undefined,
        modifiers: modifiers.length > 0 ? modifiers : undefined,
        isFavorite,
        colorTag,
      };

      const saved = await upsertProduct(formData, product?.id);
      onSaved?.(saved);
      if (closeAfterSave) {
        onClose();
      } else {
        setName("");
        setShortName("");
        setIsShortNameManuallyEdited(false);
        setBasePrice(0);
        setBarcode("");
        setBarcodeError(null);
        setExistingBarcodeProduct(null);
        setBarcodeLookupMessage(null);
        setIsCombo(false);
        setComboIncludes([]);
        setModifiers([]);
        setIsFavorite(false);
        setColorTag("#10B981");
        setShowAddMod(false);
        requestAnimationFrame(() => nameInputRef.current?.focus());
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar producto");
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicar Producto
  const handleDuplicate = async () => {
    if (!product) return;
    setIsSaving(true);
    try {
      const duplicated = await duplicateProduct(product.id);
      onSaved?.(duplicated);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al duplicar producto");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateLastProduct = async () => {
    setIsSaving(true);
    try {
      const duplicated = await duplicateLastProduct();
      onSaved?.(duplicated);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error al duplicar el último producto",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar Producto
  const handleDelete = async () => {
    if (!product) return;
    if (!confirm(`¿Eliminar definitivamente "${product.name}" del catálogo?`)) return;

    setIsSaving(true);
    try {
      await removeProduct(product.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al eliminar producto");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-30 flex bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fade-in">
      {/* Panel Slide-over */}
      <div
        className="w-full max-w-lg bg-slate-900 border-r border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden font-sans animate-slide-in-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Drawer */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colorTag }}
            />
            <h2 className="text-base font-bold text-white tracking-wide">
              {isEditing ? "Editar Producto" : "Nuevo Producto"}
            </h2>
            {isEditing && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {product?.id}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de error general si ocurre */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario con Scroll */}
        <form
          onSubmit={handleSave}
          className="flex-1 overflow-y-auto p-4 space-y-4 text-xs"
        >
          {/* Nombre y Nombre Corto */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Nombre de Mostrador <span className="text-emerald-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej. Sándwich de Milanesa Completa"
                autoFocus
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Nombre Corto</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShortName(generateShortName(name));
                      setIsShortNameManuallyEdited(false);
                    }}
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-2.5 h-2.5" /> Auto
                  </button>
                </div>
                <input
                  type="text"
                  value={shortName}
                  onChange={(e) => {
                    setShortName(e.target.value);
                    setIsShortNameManuallyEdited(true);
                  }}
                  placeholder="Ej. Sand Mila Compl"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProductCategory)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Precio Base y Código de Barras */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Precio Base ($) <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={basePrice === 0 && !isEditing ? "" : basePrice}
                  onChange={(e) => setBasePrice(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  required
                  className="w-full pl-7 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5 text-slate-400" />
                  Código de Barras
                </label>
                {barcode && (
                  <button
                    type="button"
                    onClick={() => void handleBarcodeChange("")}
                    className="text-[10px] text-slate-400 hover:text-white"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => void handleBarcodeChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleBarcodeLookup();
                    }
                  }}
                  placeholder="Escanee o tipee..."
                  className={`min-w-0 flex-1 px-3 py-1.5 bg-slate-950 border rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none ${
                    barcodeError
                      ? "border-rose-500 focus:border-rose-500"
                      : "border-slate-700 focus:border-emerald-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => barcodeInputRef.current?.focus()}
                  className="px-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500 hover:text-white"
                  title="Enfocar para leer con escáner USB"
                >
                  <Barcode className="w-4 h-4" />
                </button>
              </div>
              {barcodeError && (
                <p className="text-[10px] text-rose-400 mt-1 font-sans">{barcodeError}</p>
              )}
              {existingBarcodeProduct && existingBarcodeProduct.id !== product?.id && (
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-amber-300">
                  <span className="truncate">Ya existe: {existingBarcodeProduct.name}</span>
                  {onRequestEditProduct && (
                    <button
                      type="button"
                      onClick={() => onRequestEditProduct(existingBarcodeProduct)}
                      className="shrink-0 underline hover:text-amber-100"
                    >
                      Editar
                    </button>
                  )}
                </div>
              )}
              {barcodeLookupMessage && (
                <p className="mt-1 text-[10px] text-slate-400">{barcodeLookupMessage}</p>
              )}
            </div>
          </div>

          {/* Color Tag y Favorito */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                <Tag className="w-3 h-3" /> Color:
              </span>
              <div className="flex items-center gap-1.5">
                {COLOR_TAGS.map((tag) => (
                  <button
                    key={tag.value}
                    type="button"
                    onClick={() => setColorTag(tag.value)}
                    className={`w-5 h-5 rounded-full border transition-all ${
                      colorTag === tag.value
                        ? "ring-2 ring-white scale-110 border-transparent"
                        : "border-slate-700 opacity-60 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: tag.value }}
                    title={tag.label}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900"
              />
              <span className="text-slate-300 text-xs">Marcar Favorito</span>
            </label>
          </div>

          {/* ── Presets de Modificadores (1 Clic) ── */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block text-xs">
                  Modificadores y Extras
                </span>
                <span className="text-[10px] text-slate-400">
                  {modifiers.length} opciones configuradas
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearModifiersAndCombo}
                className="text-[10px] text-rose-400 hover:text-rose-300"
              >
                Limpiar modificadores/combo
              </button>
            </div>

            {/* Botones de Presets de 1 Clic */}
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">
                Presets Rápidos (1 clic):
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.values(MODIFIER_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-emerald-500/50 text-left transition-all"
                  >
                    <div className="font-semibold text-slate-200 text-[11px] truncate">
                      {preset.label}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleApplyComboPreset}
                className="mt-1.5 w-full p-1.5 rounded-lg border border-purple-800/80 bg-purple-950/40 hover:bg-purple-900/60 text-left transition-all"
              >
                <div className="font-semibold text-purple-200 text-[11px]">
                  Preset Combo base
                </div>
                <div className="text-[9px] text-purple-300/80">
                  Sándwich + cono chico de papas + gaseosa
                </div>
              </button>
            </div>

            {/* Lista actual de modificadores con su priceDelta */}
            {modifiers.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Opciones activas en este producto:
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {modifiers.map((mod) => (
                    <div
                      key={mod.id}
                      className="flex items-center justify-between px-2.5 py-1 rounded bg-slate-900 border border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-medium">
                          {mod.name}
                        </span>
                        {mod.exclusive && (
                          <span className="text-[9px] px-1 bg-amber-950/60 text-amber-400 border border-amber-800 rounded">
                            Excluyente
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          ({mod.group || "extras"})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400 text-xs font-bold">
                          {mod.priceDelta > 0
                            ? `+${formatCurrency(mod.priceDelta)}`
                            : mod.priceDelta === 0
                            ? "$0"
                            : formatCurrency(mod.priceDelta)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveModifier(mod.id)}
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                          title="Eliminar modificador"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón para añadir modificador manual */}
            {!showAddMod ? (
              <button
                type="button"
                onClick={() => setShowAddMod(true)}
                className="w-full py-1.5 rounded border border-dashed border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 flex items-center justify-center gap-1 transition-colors text-xs"
              >
                <Plus className="w-3 h-3" />
                <span>Agregar Modificador Personalizado</span>
              </button>
            ) : (
              <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newModName}
                    onChange={(e) => setNewModName(e.target.value)}
                    placeholder="Nombre (ej. + Palta)"
                    className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                  <input
                    type="number"
                    value={newModDelta || ""}
                    onChange={(e) => setNewModDelta(Number(e.target.value))}
                    placeholder="Precio Delta (+$)"
                    className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-emerald-400 font-mono"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={newModGroup}
                    onChange={(e) => setNewModGroup(e.target.value)}
                    placeholder="Grupo (ej: extras)"
                    className="px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-[11px] text-slate-300 w-32"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowAddMod(false)}
                      className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomModifier}
                      className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Switch de Combo & Componentes ── */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCombo}
                  onChange={(e) => setIsCombo(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-purple-600 focus:ring-purple-500 bg-slate-900"
                />
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">
                    Es un Combo
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Incluye múltiples productos con cantidades fijas
                  </span>
                </div>
              </label>
              {isCombo && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  COMBO ACTIVO
                </span>
              )}
            </div>

            {isCombo && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                {/* Selector rápido para añadir producto al combo */}
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddComboItem(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="">+ Vincular producto al combo...</option>
                    {allProducts
                      .filter((p) => p.id !== product?.id && !p.isCombo)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatCurrency(p.basePrice)})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Lista de productos incluidos en el combo */}
                {comboIncludes.length > 0 ? (
                  <div className="space-y-1">
                    {comboIncludes.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between px-2.5 py-1 rounded bg-slate-900 border border-slate-800"
                      >
                        <span className="text-white text-xs truncate max-w-[200px]">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateComboQty(item.productId, -1)}
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="font-mono text-xs font-bold text-emerald-400 w-4 text-center">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateComboQty(item.productId, 1)}
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Sin productos vinculados al combo aún.
                  </p>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Botones de Acción al Pie */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={handleDuplicate}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                  title="Clonar este producto con nuevo ID y barcode libre"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicar</span>
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-rose-950/60 hover:text-rose-400 text-slate-500 border border-slate-800 transition-colors"
                  title="Eliminar producto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            {!isEditing && (
              <button
                type="button"
                onClick={handleDuplicateLastProduct}
                disabled={isSaving || !lastProductId}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                title="Clona el último producto creado o editado y limpia el código de barras"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicar último</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            {!isEditing && (
              <button
                type="button"
                onClick={() => void handleSave(undefined, false)}
                disabled={isSaving || Boolean(barcodeError)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
              >
                Guardar y cargar otro
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving || Boolean(barcodeError)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-950 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isSaving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar y cerrar"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
