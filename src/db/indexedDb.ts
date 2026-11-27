// ─── IndexedDB – Kiosco Termas (Dexie) ──────────────────────────────────────
// Catálogo, ventas offline, comprobantes fiscales, caja y settings.
// Resistencia offline completa: todo persiste en IndexedDB.

import Dexie, { type Table } from "dexie";
import type {
  CashCloseSummary,
  CashMovement,
  CashShift,
  PosnetReconciliationItem,
  Product,
  Sale,
  Invoice,
  InvoiceType,
  FiscalStatus,
  ShiftApprovalStatus,
  PrintJob,
  BuzzerState,
  QrAccountConfig,
} from "../types/pos";
import { seedProducts } from "../data/seedProducts";
import {
  buildCashCloseSummary,
  type CashCloseDetails,
} from "../utils/cashShiftUtils";

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
  cashShifts!: Table<CashShift, string>;
  cashMovements!: Table<CashMovement, string>;
  cashCloseSummaries!: Table<CashCloseSummary, string>;
  printJobs!: Table<PrintJob, string>;
  activeBuzzers!: Table<BuzzerState, string>;
  qrAccounts!: Table<QrAccountConfig, string>;

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

    this.version(5).stores({
      products: "id, [businessId+branchId], [businessId+branchId+category], category, barcode",
      sales: "id, [businessId+branchId], [businessId+branchId+status], [businessId+branchId+shiftId], shiftId, status, createdAt",
      paymentHistory: "id, [businessId+branchId]",
      invoices: "id, saleId, invoiceType, invoiceNumber, [businessId+branchId], [businessId+branchId+fiscalStatus], fiscalStatus, createdAt",
      settings: "key",
      cashShifts: "id, &[businessId+branchId+shiftNumber], [businessId+branchId+status]",
      cashMovements: "id, shiftId, [businessId+branchId], [businessId+branchId+shiftId]",
      cashCloseSummaries: "id, &shiftId, [businessId+branchId], [businessId+branchId+closedAt]",
    });

    this.version(6)
      .stores({
        products: "id, [businessId+branchId], [businessId+branchId+category], category, barcode",
        sales: "id, [businessId+branchId], [businessId+branchId+status], [businessId+branchId+shiftId], [businessId+branchId+settledInShiftId], shiftId, settledInShiftId, status, createdAt",
        paymentHistory: "id, [businessId+branchId]",
        invoices: "id, saleId, invoiceType, invoiceNumber, [businessId+branchId], [businessId+branchId+fiscalStatus], fiscalStatus, createdAt",
        settings: "key",
        cashShifts: "id, &[businessId+branchId+shiftNumber], [businessId+branchId+status]",
        cashMovements: "id, shiftId, [businessId+branchId], [businessId+branchId+shiftId]",
        cashCloseSummaries: "id, &shiftId, [businessId+branchId], [businessId+branchId+closedAt]",
      })
      .upgrade(async (transaction) => {
        const shiftsTable = transaction.table("cashShifts");
        const movementsTable = transaction.table("cashMovements");
        const summariesTable = transaction.table("cashCloseSummaries");
        const [shifts, movements, summaries] = await Promise.all([
          shiftsTable.toArray(),
          movementsTable.toArray(),
          summariesTable.toArray(),
        ]);
        const normalizedMovements = movements.map((movement) => ({
          ...movement,
          createdBy: movement.createdBy ?? movement.performedBy ?? "",
        }));
        const movementsByShift = new Map<string, typeof movements>();
        const summariesByShift = new Map<string, (typeof summaries)[number]>();

        for (const movement of normalizedMovements) {
          const shiftMovements = movementsByShift.get(movement.shiftId) ?? [];
          shiftMovements.push(movement);
          movementsByShift.set(movement.shiftId, shiftMovements);
        }
        for (const summary of summaries) {
          summariesByShift.set(summary.shiftId, summary);
        }

        const normalizedSummaries = summaries.map((summary) => ({
          ...summary,
          salesCountPaid: summary.salesCountPaid ?? summary.paidSaleCount ?? 0,
          salesCountCancelled:
            summary.salesCountCancelled ?? summary.cancelledSaleCount ?? 0,
          totalCancelledAmount:
            summary.totalCancelledAmount ?? summary.cancelledGrossAmount ?? 0,
          totalsByPayment:
            summary.totalsByPayment ?? summary.collectedByPaymentMethod ?? {
              EFECTIVO: 0,
              QR: 0,
              TARJETA: 0,
            },
          cashInTotal: summary.cashInTotal ?? 0,
          withdrawalsTotal:
            summary.withdrawalsTotal ?? summary.withdrawalTotal ?? 0,
          expensesTotal: summary.expensesTotal ?? summary.expenseTotal ?? 0,
          posnetItems: summary.posnetItems ?? [],
          reconciliationPending: summary.reconciliationPending ?? false,
          approvalStatus: summary.approvalStatus ?? "NOT_REQUIRED",
          latePaymentsCount: summary.latePaymentsCount ?? 0,
          latePaymentsAmount: summary.latePaymentsAmount ?? 0,
        }));
        const normalizedSummariesByShift = new Map(
          normalizedSummaries.map((summary) => [summary.shiftId, summary]),
        );

        await Promise.all([
          shiftsTable.bulkPut(
            shifts.map((shift) => ({
              ...shift,
              movements: movementsByShift.get(shift.id) ?? [],
              closeSummary:
                shift.closeSummary ??
                normalizedSummariesByShift.get(shift.id) ??
                summariesByShift.get(shift.id),
            })),
          ),
          movementsTable.bulkPut(normalizedMovements),
          summariesTable.bulkPut(normalizedSummaries),
        ]);
      });

    this.version(7)
      .stores({
        products: "id, [businessId+branchId], [businessId+branchId+category], category, barcode",
        sales: "id, [businessId+branchId], [businessId+branchId+status], [businessId+branchId+shiftId], [businessId+branchId+settledInShiftId], shiftId, settledInShiftId, status, createdAt",
        paymentHistory: "id, [businessId+branchId]",
        invoices: "id, saleId, invoiceType, invoiceNumber, [businessId+branchId], [businessId+branchId+fiscalStatus], fiscalStatus, createdAt",
        settings: "key",
        cashShifts: "id, &[businessId+branchId+shiftNumber], [businessId+branchId+status]",
        cashMovements: "id, shiftId, [businessId+branchId], [businessId+branchId+shiftId]",
        cashCloseSummaries: "id, &shiftId, [businessId+branchId], [businessId+branchId+closedAt]",
        printJobs: "id, saleId, status, target, kind, createdAt",
        activeBuzzers: "number, saleId, assignedAt",
        qrAccounts: "id, [businessId+branchId], [businessId+branchId+enabled]",
      })
      .upgrade(async (transaction) => {
        const qrTable = transaction.table("qrAccounts");
        const existingCount = await qrTable.count();
        if (existingCount === 0) {
          await qrTable.bulkPut([
            {
              id: "QR_1",
              label: "QR 1 - Caja Principal",
              enabled: true,
              businessId: "grupo-termal",
              branchId: "termas-kiosco",
            },
            {
              id: "QR_2",
              label: "QR 2 - Barra / Auxiliar",
              enabled: true,
              businessId: "grupo-termal",
              branchId: "termas-kiosco",
            },
          ]);
        }
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
    .anyOf(
      [
        [businessId, branchId, "PAGADA"],
        [businessId, branchId, "CANCELADA"],
      ],
    )
    .toArray();
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
   Cash shifts, movements & close summaries
   ══════════════════════════════════════════════════════════════════════════════ */

export function getCashShift(id: string): Promise<CashShift | undefined> {
  return db.cashShifts.get(id);
}

export function getCashShifts(
  businessId: string,
  branchId: string,
): Promise<CashShift[]> {
  return db.cashShifts
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .toArray();
}

export function getOpenCashShift(
  businessId: string,
  branchId: string,
): Promise<CashShift | undefined> {
  return db.cashShifts
    .where("[businessId+branchId+status]")
    .equals([businessId, branchId, "OPEN"])
    .first();
}

function validateNewCashShift(shift: Omit<CashShift, "shiftNumber">): void {
  if (shift.status !== "OPEN") {
    throw new Error("Un turno nuevo debe comenzar abierto");
  }
  if (!shift.id.trim() || !shift.openedBy.trim()) {
    throw new Error("El turno requiere id y cajero");
  }
  if (!Number.isFinite(shift.openingCash) || shift.openingCash < 0) {
    throw new RangeError("El fondo inicial debe ser un importe no negativo");
  }
}

async function getNextShiftNumber(
  businessId: string,
  branchId: string,
): Promise<string> {
  const shifts = await getCashShifts(businessId, branchId);
  const maxNumber = shifts.reduce((max, shift) => {
    if (!/^\d+$/.test(shift.shiftNumber)) return max;
    return Math.max(max, Number(shift.shiftNumber));
  }, 0);
  return String(Math.max(maxNumber + 1, shifts.length + 1));
}

async function assignUnsettledPaymentsToShift(
  shift: CashShift,
): Promise<void> {
  const [sales, shifts, history] = await Promise.all([
    db.sales
      .where("[businessId+branchId]")
      .equals([shift.businessId, shift.branchId])
      .toArray(),
    getCashShifts(shift.businessId, shift.branchId),
    db.paymentHistory
      .where("[businessId+branchId]")
      .equals([shift.businessId, shift.branchId])
      .toArray(),
  ]);
  const shiftsById = new Map(shifts.map((item) => [item.id, item]));
  const updates = sales
    .filter((sale) => {
      if (
        sale.status !== "PAGADA" ||
        sale.settledInShiftId ||
        !sale.shiftId ||
        !sale.paidAt
      ) {
        return false;
      }
      const originShift = shiftsById.get(sale.shiftId);
      return (
        originShift?.status === "CLOSED" &&
        !!originShift.closedAt &&
        Date.parse(sale.paidAt) > Date.parse(originShift.closedAt)
      );
    })
    .map((sale) => ({ ...sale, settledInShiftId: shift.id }));

  if (updates.length === 0) return;
  await db.sales.bulkPut(updates);
  const historyIds = new Set(history.map((sale) => sale.id));
  await db.paymentHistory.bulkPut(
    updates.filter((sale) => historyIds.has(sale.id)),
  );
}

async function putOpenCashShiftInTransaction(
  shift: CashShift,
): Promise<CashShift> {
  if (!shift.shiftNumber.trim()) {
    throw new Error("El turno requiere número");
  }
  const openShift = await getOpenCashShift(shift.businessId, shift.branchId);
  if (openShift && openShift.id !== shift.id) {
    throw new Error("Ya existe un turno abierto para esta sucursal");
  }

  const existing = await db.cashShifts.get(shift.id);
  if (existing?.status === "CLOSED") {
    throw new Error("No se puede reabrir un turno cerrado");
  }
  const persistedShift = {
    ...shift,
    movements:
      shift.movements.length > 0
        ? shift.movements
        : existing?.movements ?? [],
  };
  await db.cashShifts.put(persistedShift);
  await assignUnsettledPaymentsToShift(persistedShift);
  return persistedShift;
}

export async function createCashShift(
  shift: Omit<CashShift, "shiftNumber">,
): Promise<CashShift> {
  validateNewCashShift(shift);
  return db.transaction(
    "rw",
    db.cashShifts,
    db.sales,
    db.paymentHistory,
    async () => {
      const shiftNumber = await getNextShiftNumber(
        shift.businessId,
        shift.branchId,
      );
      return putOpenCashShiftInTransaction({ ...shift, shiftNumber });
    },
  );
}

export async function openCashShift(shift: CashShift): Promise<string> {
  validateNewCashShift(shift);
  if (!shift.shiftNumber.trim()) throw new Error("El turno requiere número");

  return db.transaction(
    "rw",
    db.cashShifts,
    db.sales,
    db.paymentHistory,
    async () => (await putOpenCashShiftInTransaction(shift)).id,
  );
}

export function getCashMovements(
  businessId: string,
  branchId: string,
  shiftId: string,
): Promise<CashMovement[]> {
  return db.cashMovements
    .where("[businessId+branchId+shiftId]")
    .equals([businessId, branchId, shiftId])
    .toArray();
}

export async function recordCashMovement(
  movement: CashMovement,
): Promise<string> {
  if (!Number.isFinite(movement.amount) || movement.amount <= 0) {
    throw new RangeError("El importe del movimiento debe ser mayor que cero");
  }
  const createdBy = movement.createdBy || movement.performedBy || "";
  if (!movement.reason.trim() || !createdBy.trim()) {
    throw new Error("El movimiento requiere motivo y responsable");
  }
  const persistedMovement = { ...movement, createdBy };

  return db.transaction(
    "rw",
    db.cashShifts,
    db.cashMovements,
    db.sales,
    async () => {
      const shift = await db.cashShifts.get(movement.shiftId);
      if (!shift || shift.status !== "OPEN") {
        throw new Error("Sólo se pueden registrar movimientos en un turno abierto");
      }
      if (
        shift.businessId !== movement.businessId ||
        shift.branchId !== movement.branchId
      ) {
        throw new Error("El movimiento no pertenece al negocio y sucursal del turno");
      }

      if (movement.relatedSaleId) {
        if (movement.type !== "WITHDRAWAL") {
          throw new Error("Sólo un retiro puede estar vinculado a una venta");
        }
        const sale = await db.sales.get(movement.relatedSaleId);
        const wasPaid = sale?.status === "PAGADA" ||
          (sale?.status === "CANCELADA" && sale.paidAt !== undefined);
        if (
          !sale ||
          sale.shiftId !== shift.id ||
          sale.businessId !== shift.businessId ||
          sale.branchId !== shift.branchId ||
          sale.paymentMethod !== "EFECTIVO" ||
          !wasPaid
        ) {
          throw new Error("El reembolso debe referenciar una venta cobrada en efectivo del turno");
        }
      }

      const movementId = await db.cashMovements.add(persistedMovement);
      await db.cashShifts.put({
        ...shift,
        movements: [...(shift.movements ?? []), persistedMovement],
      });
      return movementId;
    },
  );
}

export function getCashCloseSummary(
  shiftId: string,
): Promise<CashCloseSummary | undefined> {
  return db.cashCloseSummaries.where("shiftId").equals(shiftId).first();
}

function validatePosnetItems(items: PosnetReconciliationItem[]): void {
  for (const item of items) {
    if (
      !item.id.trim() ||
      !item.label.trim() ||
      !Number.isFinite(item.systemAmount) ||
      item.systemAmount < 0 ||
      !Number.isFinite(item.declaredAmount) ||
      item.declaredAmount < 0
    ) {
      throw new Error("Los datos de conciliación POSNET/QR no son válidos");
    }
  }
}

export async function closeCashShift(
  shiftId: string,
  details: CashCloseDetails,
): Promise<CashCloseSummary> {
  validatePosnetItems(details.posnetItems ?? []);
  return db.transaction(
    "rw",
    db.cashShifts,
    db.cashMovements,
    db.cashCloseSummaries,
    db.sales,
    async () => {
      return closeCashShiftInTransaction(shiftId, details);
    },
  );
}

async function closeCashShiftInTransaction(
  shiftId: string,
  details: CashCloseDetails,
): Promise<CashCloseSummary> {
  const shift = await db.cashShifts.get(shiftId);
  if (!shift) throw new Error("No se encontró el turno");
  if (shift.status !== "OPEN") throw new Error("El turno ya está cerrado");

  const [shiftSales, lateSales, movements] = await Promise.all([
    db.sales
      .where("[businessId+branchId+shiftId]")
      .equals([shift.businessId, shift.branchId, shift.id])
      .toArray(),
    db.sales
      .where("[businessId+branchId+settledInShiftId]")
      .equals([shift.businessId, shift.branchId, shift.id])
      .toArray(),
    getCashMovements(shift.businessId, shift.branchId, shift.id),
  ]);
  const sales = [
    ...new Map(
      [...shiftSales, ...lateSales].map((sale) => [sale.id, sale]),
    ).values(),
  ];
  const summary = buildCashCloseSummary(shift, sales, movements, details);

  await db.cashCloseSummaries.add(summary);
  await db.cashShifts.put({
    ...shift,
    status: "CLOSED",
    closedAt: details.closedAt,
    closedBy: details.closedBy,
    closeSummaryId: details.id,
    closeSummary: summary,
  });
  return summary;
}

export async function relayCashShift(
  shiftId: string,
  details: CashCloseDetails,
  nextShift: Omit<CashShift, "shiftNumber">,
): Promise<{ closedShift: CashShift; openedShift: CashShift; summary: CashCloseSummary }> {
  validateNewCashShift(nextShift);
  validatePosnetItems(details.posnetItems ?? []);
  return db.transaction(
    "rw",
    db.cashShifts,
    db.cashMovements,
    db.cashCloseSummaries,
    db.sales,
    db.paymentHistory,
    async () => {
      const outgoingShift = await db.cashShifts.get(shiftId);
      if (!outgoingShift) throw new Error("No se encontró el turno");
      if (outgoingShift.status !== "OPEN") {
        throw new Error("El turno ya está cerrado");
      }
      if (
        outgoingShift.businessId !== nextShift.businessId ||
        outgoingShift.branchId !== nextShift.branchId
      ) {
        throw new Error("El relevo debe permanecer en el mismo negocio y sucursal");
      }

      const summary = await closeCashShiftInTransaction(shiftId, details);
      const shiftNumber = await getNextShiftNumber(
        nextShift.businessId,
        nextShift.branchId,
      );
      const openedShift = await putOpenCashShiftInTransaction({
        ...nextShift,
        shiftNumber,
      });
      const closedShift = {
        ...outgoingShift,
        status: "CLOSED" as const,
        closedAt: details.closedAt,
        closedBy: details.closedBy,
        closeSummaryId: details.id,
        closeSummary: summary,
      };
      return { closedShift, openedShift, summary };
    },
  );
}

export async function updateCashShiftReconciliation(
  shiftId: string,
  posnetItems: PosnetReconciliationItem[],
  reconciliationPending: boolean,
): Promise<CashShift> {
  validatePosnetItems(posnetItems);

  return db.transaction(
    "rw",
    db.cashShifts,
    db.cashCloseSummaries,
    async () => {
      const shift = await db.cashShifts.get(shiftId);
      if (!shift) throw new Error("No se encontró el turno");
      if (shift.status !== "CLOSED" || !shift.closeSummary) {
        throw new Error("La conciliación sólo se actualiza en turnos cerrados");
      }
      const summary: CashCloseSummary = {
        ...shift.closeSummary,
        posnetItems: structuredClone(posnetItems),
        reconciliationPending,
      };
      await db.cashCloseSummaries.put(summary);
      const updatedShift = { ...shift, closeSummary: summary };
      await db.cashShifts.put(updatedShift);
      return updatedShift;
    },
  );
}

export async function updateCashShiftApproval(
  shiftId: string,
  approvalStatus: Exclude<ShiftApprovalStatus, "NOT_REQUIRED">,
  resolvedBy: string,
  note?: string,
): Promise<CashShift> {
  if (!resolvedBy.trim()) throw new Error("La aprobación requiere responsable");
  if (!["APPROVED", "OBSERVED", "PENDING"].includes(approvalStatus)) {
    throw new Error("Estado de aprobación inválido");
  }

  return db.transaction(
    "rw",
    db.cashShifts,
    db.cashCloseSummaries,
    async () => {
      const shift = await db.cashShifts.get(shiftId);
      if (!shift) throw new Error("No se encontró el turno");
      if (shift.status !== "CLOSED" || !shift.closeSummary) {
        throw new Error("La aprobación sólo se actualiza en turnos cerrados");
      }
      const summary: CashCloseSummary = {
        ...shift.closeSummary,
        approvalStatus,
        approvedBy: resolvedBy.trim(),
        approvedAt: new Date().toISOString(),
        ...(note !== undefined
          ? { observations: note.trim() }
          : {}),
      };
      await db.cashCloseSummaries.put(summary);
      const updatedShift = { ...shift, closeSummary: summary };
      await db.cashShifts.put(updatedShift);
      return updatedShift;
    },
  );
}

export async function putPaidSale(sale: Sale): Promise<Sale> {
  return db.transaction("rw", db.sales, db.cashShifts, async () => {
    const activeShift = await getOpenCashShift(sale.businessId, sale.branchId);
    let attributedSale = sale;
    if (activeShift) {
      if (!sale.shiftId) {
        attributedSale = { ...sale, shiftId: activeShift.id };
      } else if (sale.shiftId !== activeShift.id) {
        const originShift = await db.cashShifts.get(sale.shiftId);
        if (originShift?.status === "CLOSED") {
          attributedSale = {
            ...sale,
            settledInShiftId: activeShift.id,
          };
        }
      }
    }
    await db.sales.put(attributedSale);
    return attributedSale;
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   Print jobs, buzzers y cuentas QR
   ══════════════════════════════════════════════════════════════════════════════ */

export function getPrintJobs(): Promise<PrintJob[]> {
  return db.printJobs.toCollection().reverse().sortBy("createdAt");
}

export function putPrintJobs(jobs: PrintJob[]): Promise<void> {
  return db.printJobs.bulkPut(jobs).then(() => undefined);
}

export function putPrintJob(job: PrintJob): Promise<string> {
  return db.printJobs.put(job);
}

export function getActiveBuzzers(): Promise<BuzzerState[]> {
  return db.activeBuzzers
    .filter((buzzer) => !buzzer.releasedAt)
    .sortBy("assignedAt");
}

export function putActiveBuzzers(buzzers: BuzzerState[]): Promise<void> {
  return db.activeBuzzers.bulkPut(buzzers).then(() => undefined);
}

export function putActiveBuzzer(buzzer: BuzzerState): Promise<string> {
  return db.activeBuzzers.put(buzzer);
}

export function deleteActiveBuzzer(number: string): Promise<void> {
  return db.activeBuzzers.delete(number);
}

export function getQrAccounts(
  businessId: string,
  branchId: string,
): Promise<QrAccountConfig[]> {
  return db.qrAccounts
    .where("[businessId+branchId]")
    .equals([businessId, branchId])
    .toArray();
}

export function putQrAccounts(accounts: QrAccountConfig[]): Promise<void> {
  return db.qrAccounts.bulkPut(accounts).then(() => undefined);
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
