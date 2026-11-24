import type { Product, ProductCategory } from "../types/pos";
import { normalizeBarcode } from "./productUtils";

export type BarcodeLookupResult =
  | { kind: "local"; product: Product }
  | { kind: "external"; name: string; category: ProductCategory }
  | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

function mapCategory(productData: Record<string, unknown>, name: string): ProductCategory {
  const tags = Array.isArray(productData.categories_tags)
    ? productData.categories_tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const categories = typeof productData.categories === "string" ? productData.categories : "";
  const searchable = `${tags.join(" ")} ${categories} ${name}`.toLowerCase();

  if (/\bsandwich(?:es)?\b|\bburger\b/.test(searchable)) return "Sandwiches";
  if (/\bbeverages?\b|\bdrinks?\b|\bsoft[- ]drinks?\b|\bsodas?\b|\bjuices?\b/.test(searchable)) {
    return "Bebidas";
  }
  return "Varios";
}

export async function lookupBarcodeExternal(
  barcode: string,
  localProducts: readonly Product[],
): Promise<BarcodeLookupResult> {
  const cleanBarcode = normalizeBarcode(barcode);
  if (!cleanBarcode) return null;

  const localProduct = localProducts.find(
    (product) => normalizeBarcode(product.barcode) === cleanBarcode,
  );
  if (localProduct) return { kind: "local", product: localProduct };

  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  if (typeof fetch !== "function" || typeof AbortController === "undefined") return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (!isRecord(payload) || payload.status !== 1 || !isRecord(payload.product)) {
      return null;
    }

    const productData = payload.product;
    const name = firstString(
      productData.product_name_es,
      productData.product_name,
      productData.generic_name_es,
      productData.generic_name,
    );
    if (!name) return null;

    return { kind: "external", name, category: mapCategory(productData, name) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
