// ─── Helpers y Utilidades de Productos – Kiosco Termas ──────────────────────
// Generación de slugs, abreviaciones térmicas, normalización de códigos de barras,
// clonación profunda y catálogo de presets de modificadores.

import type {
  Product,
  ProductCategory,
  ProductFormData,
  ModifierOption,
} from "../types/pos";

/* ══════════════════════════════════════════════════════════════════════════════
   1. Presets de Modificadores
   ══════════════════════════════════════════════════════════════════════════════ */

export const PRESET_SANDWICH_EXTRAS: ModifierOption[] = [
  { id: "mod-jyq", name: "+ Jamón y Queso", priceDelta: 2000, group: "extras" },
  { id: "mod-tyl", name: "+ Tomate y Lechuga", priceDelta: 3000, group: "extras" },
  { id: "mod-completa", name: "Completa", priceDelta: 5000, group: "extras" },
  { id: "mod-huevo", name: "+ Huevo Frito", priceDelta: 1500, group: "extras" },
  { id: "mod-bacon", name: "+ Bacon", priceDelta: 2500, group: "extras" },
  { id: "mod-cheddar", name: "+ Cheddar", priceDelta: 1500, group: "extras" },
];

export const PRESET_LICUADOS: ModifierOption[] = [
  { id: "mod-agua", name: "Base Agua", priceDelta: 0, group: "base-licuado", exclusive: true },
  { id: "mod-leche", name: "Base Leche", priceDelta: 500, group: "base-licuado", exclusive: true },
  { id: "mod-granola", name: "+ Granola", priceDelta: 800, group: "extras-licuado" },
  { id: "mod-miel", name: "+ Miel", priceDelta: 500, group: "extras-licuado" },
  { id: "mod-proteina", name: "+ Proteína", priceDelta: 1500, group: "extras-licuado" },
];

export const PRESET_COCCION: ModifierOption[] = [
  { id: "mod-horno", name: "Al Horno", priceDelta: 0, group: "coccion", exclusive: true },
  { id: "mod-frita", name: "Frita", priceDelta: 0, group: "coccion", exclusive: true },
];

export const PRESET_CAFE_SIZE: ModifierOption[] = [
  { id: "mod-cafe-chico", name: "Chico", priceDelta: 0, group: "tamano-cafe", exclusive: true },
  { id: "mod-cafe-grande", name: "Grande", priceDelta: 1000, group: "tamano-cafe", exclusive: true },
];

export interface ModifierPresetDef {
  id: string;
  label: string;
  description: string;
  modifiers: ModifierOption[];
}

export const MODIFIER_PRESETS: Record<string, ModifierPresetDef> = {
  SANDWICH: {
    id: "SANDWICH",
    label: "Sándwich / Burger Extras",
    description: "JyQ, TyL, Completa, Huevo, Bacon, Cheddar",
    modifiers: PRESET_SANDWICH_EXTRAS,
  },
  LICUADOS: {
    id: "LICUADOS",
    label: "Licuados (Base + Extras)",
    description: "Base Agua/Leche excluyentes + Granola, Miel, Proteína",
    modifiers: PRESET_LICUADOS,
  },
  COCCION: {
    id: "COCCION",
    label: "Punto de Cocción",
    description: "Horno o Frita excluyentes ($0)",
    modifiers: PRESET_COCCION,
  },
  CAFE_SIZE: {
    id: "CAFE_SIZE",
    label: "Tamaño Café / Infusión",
    description: "Chico ($0) o Grande (+$1.000) excluyentes",
    modifiers: PRESET_CAFE_SIZE,
  },
};

/* ══════════════════════════════════════════════════════════════════════════════
   2. Generación de IDs limpios
   ══════════════════════════════════════════════════════════════════════════════ */

const CATEGORY_PREFIXES: Record<ProductCategory, string> = {
  Sandwiches: "sand",
  Licuados: "lic",
  Bebidas: "beb",
  Combos: "combo",
  Varios: "var",
};

/**
 * Genera un slug alfanumérico limpio para un producto, prefijado según su categoría.
 * Ejemplo: "Sandwiches", "Milanesa de Carne" -> "sand-milanesa-de-carne"
 */
export function generateProductId(category: ProductCategory, name: string): string {
  const prefix = CATEGORY_PREFIXES[category] || "prod";

  const cleanName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remover tildes y diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // reemplazar caracteres especiales y espacios por guión
    .replace(/^-+|-+$/g, ""); // recortar guiones al inicio o final

  if (!cleanName) {
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${prefix}-${randomSuffix}`;
  }

  return `${prefix}-${cleanName}`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. Abreviación inteligente de nombres
   ══════════════════════════════════════════════════════════════════════════════ */

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bs[aá]ndwiches\b/gi, "Sand"],
  [/\bs[aá]ndwich\b/gi, "Sand"],
  [/\bhamburguesas\b/gi, "Hamb"],
  [/\bhamburguesa\b/gi, "Hamb"],
  [/\bmilanesas\b/gi, "Mila"],
  [/\bmilanesa\b/gi, "Mila"],
  [/\bgaseosas\b/gi, "Gas"],
  [/\bgaseosa\b/gi, "Gas"],
  [/\bempanadas\b/gi, "Emp"],
  [/\bempanada\b/gi, "Emp"],
  [/\bmedialunas\b/gi, "Medial"],
  [/\bmedialuna\b/gi, "Medial"],
  [/\bporci[oó]n\b/gi, "Porc"],
  [/\bcompleta\b/gi, "Compl"],
  [/\bcompleto\b/gi, "Compl"],
  [/\bcervezas\b/gi, "Cerv"],
  [/\bcerveza\b/gi, "Cerv"],
  [/\blimonadas\b/gi, "Limon"],
  [/\blimonada\b/gi, "Limon"],
  [/\blicuados\b/gi, "Lic"],
  [/\blicuado\b/gi, "Lic"],
  [/\btostados\b/gi, "Tost"],
  [/\btostado\b/gi, "Tost"],
  [/\bpapas fritas\b/gi, "Papas"],
  [/\bagua mineral\b/gi, "Agua Min"],
];

/**
 * Abreviación inteligente para tickets térmicos y tarjetas de mostrador.
 * Ejemplos:
 * - "Milanesa de Carne" -> "Mila de Carne"
 * - "Hamburguesa Doble" -> "Hamb Doble"
 * - "Sándwich de Jamón" -> "Sand de Jamón"
 * - "Gaseosa Cola 500ml" -> "Gas Cola 500ml"
 */
export function generateShortName(name: string): string {
  let result = name.trim();
  for (const [pattern, replacement] of ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}

/* ══════════════════════════════════════════════════════════════════════════════
   4. Normalización de códigos de barra
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Limpia espacios, saltos de línea y caracteres de control de lectores láser/USB.
 */
export function normalizeBarcode(barcode?: string | null): string {
  if (!barcode) return "";
  // Remover caracteres de control ASCII (0-31 y 127) y espacios en blanco
  return barcode.replace(/[\x00-\x1F\x7F\s]+/g, "").trim();
}

/* ══════════════════════════════════════════════════════════════════════════════
   5. Clonación profunda de productos
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Realiza una clonación profunda de un producto reseteando el código de barras
 * para evitar colisiones en la sucursal y sugiriendo el nombre con sufijo "(Copia)".
 */
export function cloneProductData(
  sourceProduct: Product,
  newName?: string
): ProductFormData {
  const finalName = newName?.trim() ? newName.trim() : `${sourceProduct.name} (Copia)`;
  const finalShortName = sourceProduct.shortName
    ? `${sourceProduct.shortName} (Copia)`
    : generateShortName(finalName);

  return {
    name: finalName,
    shortName: finalShortName,
    category: sourceProduct.category,
    basePrice: sourceProduct.basePrice,
    barcode: undefined, // Reset explícito de código de barras para evitar colisión
    isCombo: sourceProduct.isCombo,
    comboIncludes: sourceProduct.comboIncludes
      ? JSON.parse(JSON.stringify(sourceProduct.comboIncludes))
      : undefined,
    modifiers: sourceProduct.modifiers
      ? JSON.parse(JSON.stringify(sourceProduct.modifiers))
      : undefined,
    isFavorite: false,
    colorTag: sourceProduct.colorTag,
  };
}
