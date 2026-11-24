// ─── IndexedDB – Kiosco Termas (Dexie) ──────────────────────────────────────
// Catálogo de productos + ventas offline + comprobantes fiscales + settings.
// Resistencia offline completa: todo persiste en IndexedDB.

import Dexie, { type Table } from "dexie";
import type { Product, Sale, Invoice, InvoiceType, FiscalStatus } from "../types/pos";
import { seedProducts } from "../data/seedProducts";

/* ══════════════════════════════════════════════════════════════════════════════
   Schema
   ══════════════════════════════════════════════════════════════════════════════ */

export interface SettingRecord {
  key: string;
  value: string;
}

class PosDatabase extends Dexie {
  products!: Table<Product, string>;
  sales!: Table<Sale, string>;
  paymentHistory!: Table<Sale, string>;
  invoices!: Table<Invoice, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super("KioscoTermasPOS");

    this.version(1).stores({
      products: "id, [businessId+branchId], [businessId+branchId+category], category, barcode, isFavorite",
      sales: "id, [businessId+branchId], [businessId+branchId+status], status, createdAt",
    });

    this.version(2).stores({
      products: "id, [businessId+branchId], [businessId+branchId+category], category, barcode",
      sales: "id, [businessId+branchId], [businessId+branchId+status], status, createdAt",
    });

    this.version(3).stores({
      products: "id, [businessId+branchId], [businessId+branchId+category], category, barcode",
      sales: "id, [businessId+branchId], [businessId+branchId+status], status, createdAt",
      invoices: "id, saleId, invoiceType, invoiceNumber, [businessId+branchId], [businessId+branchId+fiscalStatus], fiscalStatus, createdAt",
      settings: "key",
    });

    this.version(4).stores({
      products: "id, [businessId+branchId], [businessId+branchId+category], category, barcode",
      sales: "id, [businessId+branchId], [businessId+branchId+status], status, createdAt",
      paymentHistory: "id, [businessId+branchId]",
      invoices: "id, saleId, invoiceType, invoiceNumber, [businessId+branchId], [businessId+branchId+fiscalStatus], fiscalStatus, createdAt",
      settings: "key",
    });
  }
}

/** Singleton — una sola instancia por pestaña */
export const db = new PosDatabase();

/* ══════════════════════════════════════════════════════════════════════════════
   Seed helpers
   ══════════════════════════════════════════════════════════════════════════════ */

export async function ensureSeedProducts(
  businessId: string,
  branchId: string,
): Promise<void> {
  const count = await db.products
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .count();

  if (count > 0) return; // ya sembrado

  const toInsert = seedProducts.filter(
    (p) => p.businessId === businessId && p.branchId === branchId,
  );

  if (toInsert.length === 0) {
    const remapped = seedProducts.map((p) => ({
      ...p,
      businessId,
      branchId,
    }));
    await db.products.bulkPut(remapped);
  } else {
    await db.products.bulkPut(toInsert);
  }
}

/** Siembra 2 comprobantes iniciales para que el panel del dueño y la facturación arranquen con actividad */
export async function ensureSeedInvoices(
  businessId: string,
  branchId: string,
): Promise<void> {
  const count = await db.invoices
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .count();

  if (count > 0) return;

  const now = new Date();
  const time1 = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
  const time2 = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  // Venta 1: Factura B pagada en Efectivo
  const sale1Id = `sale-seed-1`;
  const sale1: Sale = {
    id: sale1Id,
    businessId,
    branchId,
    items: [
      {
        lineKey: "sand-milacarne::",
        productId: "sand-milacarne",
        name: "Sándwich de Milanesa de Carne",
        unitBasePrice: 10000,
        selectedModifiers: [],
        unitFinalPrice: 10000,
        qty: 2,
        subtotal: 20000,
      },
      {
        lineKey: "beb-gaseosa500::",
        productId: "beb-gaseosa500",
        name: "Gaseosa 500 ml",
        unitBasePrice: 2800,
        selectedModifiers: [],
        unitFinalPrice: 2800,
        qty: 2,
        subtotal: 5600,
      },
    ],
    status: "PAGADA",
    paymentMethod: "EFECTIVO",
    subtotal: 25600,
    discount: 0,
    total: 25600,
    cashReceived: 30000,
    change: 4400,
    createdAt: time1,
    updatedAt: time1,
    closedAt: time1,
    invoiceType: "FACTURA_B",
    invoiceNumber: "B-0001-00000001",
    fiscalStatus: "AUTORIZADO",
    cae: "74281920391024",
    customer: { businessName: "Consumidor Final", taxCondition: "CONSUMIDOR_FINAL" },
  };

  const inv1: Invoice = {
    id: "inv-seed-1",
    saleId: sale1Id,
    invoiceType: "FACTURA_B",
    invoiceNumber: "B-0001-00000001",
    businessId,
    branchId,
    items: sale1.items,
    subtotal: 25600,
    discount: 0,
    total: 25600,
    netAmount: 21157,
    ivaAmount: 4443,
    paymentMethod: "EFECTIVO",
    cashReceived: 30000,
    change: 4400,
    customer: { businessName: "Consumidor Final", taxCondition: "CONSUMIDOR_FINAL" },
    fiscalStatus: "AUTORIZADO",
    cae: "74281920391024",
    caeExpiresAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
    createdAt: time1,
    syncedAt: time1,
  };

  // Venta 2: Factura A pagada con QR
  const sale2Id = `sale-seed-2`;
  const sale2: Sale = {
    id: sale2Id,
    businessId,
    branchId,
    items: [
      {
        lineKey: "combo-burger-doble::",
        productId: "combo-burger-doble",
        name: "Combo Hamburguesa Doble + Papas + Bebida",
        unitBasePrice: 16500,
        selectedModifiers: [],
        unitFinalPrice: 16500,
        qty: 1,
        subtotal: 16500,
      },
    ],
    status: "PAGADA",
    paymentMethod: "QR",
    subtotal: 16500,
    discount: 0,
    total: 16500,
    createdAt: time2,
    updatedAt: time2,
    closedAt: time2,
    invoiceType: "FACTURA_A",
    invoiceNumber: "A-0001-00000001",
    fiscalStatus: "AUTORIZADO",
    cae: "74281920391025",
    customer: {
      cuit: "30-71123456-6",
      businessName: "Termas del Litoral S.A.",
      taxCondition: "RESPONSABLE_INSCRIPTO",
      address: "Av. Costanera 450, Entre Ríos",
    },
  };

  const inv2: Invoice = {
    id: "inv-seed-2",
    saleId: sale2Id,
    invoiceType: "FACTURA_A",
    invoiceNumber: "A-0001-00000001",
    businessId,
    branchId,
    items: sale2.items,
    subtotal: 16500,
    discount: 0,
    total: 16500,
    netAmount: 13636.36,
    ivaAmount: 2863.64,
    paymentMethod: "QR",
    customer: sale2.customer!,
    fiscalStatus: "AUTORIZADO",
    cae: "74281920391025",
    caeExpiresAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
    createdAt: time2,
    syncedAt: time2,
  };

  await db.sales.bulkPut([sale1, sale2]);
  await db.invoices.bulkPut([inv1, inv2]);
}

/* ══════════════════════════════════════════════════════════════════════════════
   Products CRUD
   ══════════════════════════════════════════════════════════════════════════════ */

export function getProducts(
  businessId: string,
  branchId: string,
): Promise<Product[]> {
  return db.products
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .toArray();
}

export function getProductsByCategory(
  businessId: string,
  branchId: string,
  category: Product["category"],
): Promise<Product[]> {
  return db.products
    .where("[businessId+branchId+category]")
    .equals([businessId, branchId, category])
    .toArray();
}

export function getProductById(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}

export function getFavorites(
  businessId: string,
  branchId: string,
): Promise<Product[]> {
  return db.products
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .and((p) => !!p.isFavorite)
    .toArray();
}

export async function toggleFavorite(productId: string): Promise<void> {
  await db.products
    .where("id")
    .equals(productId)
    .modify((p) => {
      p.isFavorite = !p.isFavorite;
    });
}

export async function putProduct(product: Product): Promise<void> {
  await db.products.put(product);
}

export async function deleteProduct(id: string): Promise<void> {
  await db.products.delete(id);
}

export async function isBarcodeAvailable(
  businessId: string,
  branchId: string,
  barcode: string,
  excludeId?: string,
): Promise<boolean> {
  const clean = barcode.trim();
  if (!clean) return true;
  const match = await db.products
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .and((p) => p.barcode === clean && p.id !== excludeId)
    .first();
  return !match;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Sales CRUD
   ══════════════════════════════════════════════════════════════════════════════ */

export function putSale(sale: Sale): Promise<string> {
  return db.sales.put(sale);
}

export function getSale(id: string): Promise<Sale | undefined> {
  return db.sales.get(id);
}

export function getSalesByStatus(
  businessId: string,
  branchId: string,
  status: Sale["status"],
): Promise<Sale[]> {
  return db.sales
    .where("[businessId+branchId+status]")
    .equals([businessId, branchId, status])
    .toArray();
}

export async function getTodaySales(
  businessId: string,
  branchId: string,
): Promise<Sale[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  return db.sales
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .and((s) => s.createdAt >= todayISO)
    .toArray();
}

export function getCompletedSales(
  businessId: string,
  branchId: string,
): Promise<Sale[]> {
  return db.sales
    .where("[businessId+branchId+status]")
    .equals([businessId, branchId, "PAGADA"])
    .reverse()
    .sortBy("closedAt");
}

export function getQueuedSales(
  businessId: string,
  branchId: string,
): Promise<Sale[]> {
  return db.sales
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .and((s) => s.status === "PENDIENTE_PAGO" || s.status === "PAGO_RECHAZADO")
    .toArray();
}

export async function getPaymentHistory(
  businessId: string,
  branchId: string,
): Promise<Sale[]> {
  const history = await db.paymentHistory
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .toArray();

  return history
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
}

export async function addPaymentHistory(sale: Sale): Promise<void> {
  await db.transaction("rw", db.paymentHistory, async () => {
    await db.paymentHistory.put(sale);
    const history = await db.paymentHistory
      .where("[businessId+branchId]")
      .equals([sale.businessId, sale.branchId])
      .toArray();
    history.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    await db.paymentHistory.bulkDelete(
      history.slice(3).map((entry) => entry.id),
    );
  });
}

export async function updatePaymentHistory(sale: Sale): Promise<void> {
  if (await db.paymentHistory.get(sale.id)) {
    await db.paymentHistory.put(sale);
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   Invoices CRUD
   ══════════════════════════════════════════════════════════════════════════════ */

export function putInvoice(invoice: Invoice): Promise<string> {
  return db.invoices.put(invoice);
}

export function getInvoice(id: string): Promise<Invoice | undefined> {
  return db.invoices.get(id);
}

export function getInvoices(
  businessId: string,
  branchId: string,
): Promise<Invoice[]> {
  return db.invoices
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .reverse()
    .sortBy("createdAt");
}

export function getPendingInvoices(
  businessId: string,
  branchId: string,
): Promise<Invoice[]> {
  return db.invoices
    .where("[businessId+branchId+fiscalStatus]")
    .equals([businessId, branchId, "PENDIENTE_ENVIO_ARCA"])
    .toArray();
}

export async function updateInvoiceStatus(
  id: string,
  fiscalStatus: FiscalStatus,
  cae?: string,
  caeExpiresAt?: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.invoices.where("id").equals(id).modify((inv) => {
    inv.fiscalStatus = fiscalStatus;
    if (cae) inv.cae = cae;
    if (caeExpiresAt) inv.caeExpiresAt = caeExpiresAt;
    if (fiscalStatus === "AUTORIZADO") inv.syncedAt = timestamp;
  });
}

/** Calcula el próximo número correlativo según tipo (Factura B o A) */
export async function getNextInvoiceNumber(
  businessId: string,
  branchId: string,
  type: InvoiceType,
): Promise<string> {
  const prefix = type === "FACTURA_A" ? "A" : "B";
  const count = await db.invoices
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .and((inv) => inv.invoiceType === type)
    .count();
  const nextSeq = (count + 1).toString().padStart(8, "0");
  return `${prefix}-0001-${nextSeq}`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Settings (Persistencia offline / F5)
   ══════════════════════════════════════════════════════════════════════════════ */

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const item = await db.settings.get(key);
    if (!item) {
      // Fallback a localStorage
      const local = localStorage.getItem(`pos_setting_${key}`);
      return local ? JSON.parse(local) : defaultValue;
    }
    return JSON.parse(item.value);
  } catch {
    return defaultValue;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  try {
    await db.settings.put({ key, value: serialized });
  } catch (err) {
    console.warn("Error guardando setting en Dexie:", err);
  }
  try {
    localStorage.setItem(`pos_setting_${key}`, serialized);
  } catch {}
}
