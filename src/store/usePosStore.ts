// ─── Zustand Store – POS Kiosco Termas ───────────────────────────────────────
// Maneja: catálogo, carrito (BORRADOR), cola de ventas (0 ms bloqueo),
// comprobantes fiscales (Factura B / A), estado offline y métricas para el dueño.

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type {
  Product,
  ProductFormData,
  CartItem,
  SelectedModifier,
  Sale,
  PaymentMethod,
  Invoice,
  InvoiceType,
  FiscalCustomer,
  FiscalStatus,
  CashCloseSummary,
  CashMovement,
  CashMovementType,
  CashShift,
  PosnetReconciliationItem,
  ShiftApprovalStatus,
  QrAccountConfig,
  PrintJob,
  BuzzerState,
} from "../types/pos";
import { seedProducts } from "../data/seedProducts";
import {
  ensureSeedProducts,
  ensureSeedInvoices,
  getProducts,
  getSale,
  putSale,
  getQueuedSales,
  getPaymentHistory,
  addPaymentHistory,
  updatePaymentHistory,
  getCompletedSales,
  getInvoices,
  putInvoice,
  updateInvoiceStatus,
  getNextInvoiceNumber,
  getSetting,
  setSetting,
  createCashShift,
  getCashShifts,
  getOpenCashShift,
  getCashShift,
  recordCashMovement,
  closeCashShift,
  relayCashShift,
  updateCashShiftReconciliation,
  updateCashShiftApproval,
  putPaidSale,
  toggleFavorite as dbToggleFavorite,
  putProduct,
  deleteProduct,
  getPrintJobs,
  putPrintJobs,
  putPrintJob,
  getActiveBuzzers,
  putActiveBuzzers,
  putActiveBuzzer,
  deleteActiveBuzzer,
  getQrAccounts,
  putQrAccounts,
} from "../db/indexedDb";
import { buildDispatchJobs } from "../utils/dispatchUtils";
import { sendPrintJob } from "../services/printerBridge";
import {
  cloneProductData,
  normalizeProductDraft,
  validateProductDraft,
} from "../utils/productUtils";

/* ══════════════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════════════ */

function buildLineKey(
  productId: string,
  modifiers: SelectedModifier[],
): string {
  const sorted = [...modifiers]
    .map((m) => m.modifierId)
    .sort()
    .join(",");
  return `${productId}::${sorted}`;
}

function calcUnitFinalPrice(
  basePrice: number,
  modifiers: SelectedModifier[],
): number {
  return basePrice + modifiers.reduce((sum, m) => sum + m.priceDelta, 0);
}

function generateSaleId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `sale-${ts}-${rnd}`;
}

function generateInvoiceId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `inv-${ts}-${rnd}`;
}

function generateRecordId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rnd}`;
}

function generateCae(): string {
  const part1 = "742";
  const part2 = Math.floor(10000000000 + Math.random() * 90000000000).toString();
  return (part1 + part2).slice(0, 14);
}

function calcCaeExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toISOString();
}

function now(): string {
  return new Date().toISOString();
}

function recalcCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.subtotal, 0);
}

function updateRecentPaymentHistory(history: Sale[], sale: Sale): Sale[] {
  return [sale, ...history.filter((entry) => entry.id !== sale.id)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
}

function replacePaymentHistoryEntry(history: Sale[], sale: Sale): Sale[] {
  return history.map((entry) => (entry.id === sale.id ? sale : entry));
}

type ShiftCloseInput = {
  closedBy: string;
  declaredCash: number;
  posnetItems?: PosnetReconciliationItem[];
  reconciliationPending?: boolean;
  notes?: string;
  approvalStatus?: ShiftApprovalStatus;
  approvedBy?: string;
  approvalNote?: string;
};

/* ══════════════════════════════════════════════════════════════════════════════
   State shape
   ══════════════════════════════════════════════════════════════════════════════ */

export interface PosState {
  // ── Contexto multi-negocio ──
  businessId: string;
  branchId: string;

  // ── Catálogo ──
  products: Product[];
  productsMap: Map<string, Product>;
  lastProductId: string | null;
  catalogReady: boolean;

  // ── Carrito activo (BORRADOR) ──
  cart: CartItem[];
  cartTotal: number;
  cartDiscount: number;
  selectedLineKey: string | null;
  draftId: string;

  // ── Cola de ventas en mostrador ──
  queue: Sale[];
  paymentHistory: Sale[];

  // ── Turnos de caja ──
  shifts: CashShift[];
  activeShift: CashShift | null;

  // ── Ventas completadas & Comprobantes ──
  completedSales: Sale[];
  invoices: Invoice[];

  // ── Resiliencia Offline ──
  isOffline: boolean;

  // ── Operadores, QR, llamadores e impresión ──
  activeOperator: string;
  qrAccounts: QrAccountConfig[];
  activeBuzzers: BuzzerState[];
  printJobs: PrintJob[];

  // ── Acciones: inicialización ──
  hydrate: (businessId?: string, branchId?: string) => Promise<void>;

  // ── Acciones: carrito ──
  addToCart: (product: Product, modifiers?: SelectedModifier[]) => void;
  selectCartLine: (lineKey: string | null) => void;
  removeFromCart: (lineKey: string) => void;
  updateQty: (lineKey: string, delta: number) => void;
  setQty: (lineKey: string, qty: number) => void;
  changeModifiers: (
    lineKey: string,
    product: Product,
    newModifiers: SelectedModifier[],
  ) => void;
  setCartDiscount: (amount: number) => void;
  clearCart: () => void;
  recoverSaleToCart: (saleId: string) => string | null;

  // ── Acciones: ventas / cola ──
  submitSale: (
    paymentMethod: PaymentMethod,
    notes?: string,
    invoiceType?: InvoiceType,
    customer?: FiscalCustomer,
    cashReceived?: number,
    qrAccountId?: string,
    buzzerNumber?: string,
  ) => Promise<Sale>;
  markSalePaid: (saleId: string) => Promise<void>;
  markSaleRejected: (saleId: string) => Promise<void>;
  retrySale: (saleId: string, paymentMethod: PaymentMethod) => Promise<void>;
  changePaymentMethod: (
    saleId: string,
    paymentMethod: PaymentMethod,
  ) => Promise<void>;
  cancelSale: (
    saleId: string,
    details?: { cancelledBy?: string; cancellationReason?: string },
  ) => Promise<void>;
  recordCashPayment: (
    saleId: string,
    cashReceived: number,
    invoiceType?: InvoiceType,
    customer?: FiscalCustomer,
  ) => Promise<void>;

  setActiveOperator: (operator: string) => void;
  assignNextBuzzer: (saleId: string, ticketNumber: string) => Promise<BuzzerState | null>;
  assignBuzzer: (number: string, saleId: string, ticketNumber: string) => Promise<BuzzerState | null>;
  releaseBuzzer: (buzzerNumber: string) => Promise<void>;
  enqueuePrintJobs: (jobs: PrintJob[]) => Promise<void>;
  markPrintJobSuccess: (jobId: string) => Promise<void>;
  markPrintJobFailed: (jobId: string, error: string) => Promise<void>;
  retryPrintJob: (jobId: string) => Promise<void>;
  reprintSaleTickets: (saleId: string) => Promise<void>;

  // ── Acciones: caja ──
  openShift: (input: {
    cashierName: string;
    openingCash: number;
  }) => Promise<CashShift>;
  relayShift: (
    input: ShiftCloseInput & {
      nextCashierName: string;
      nextOpeningCash: number;
    },
  ) => Promise<CashShift>;
  addCashMovement: (input: {
    type: CashMovementType;
    amount: number;
    reason: string;
    createdBy: string;
    authorizedBy?: string;
  }) => Promise<CashMovement>;
  closeShift: (input: ShiftCloseInput) => Promise<CashCloseSummary>;
  updateShiftReconciliation: (
    shiftId: string,
    posnetItems: PosnetReconciliationItem[],
    reconciliationPending: boolean,
  ) => Promise<void>;
  resolveShiftApproval: (
    shiftId: string,
    approvalStatus: Exclude<ShiftApprovalStatus, "NOT_REQUIRED">,
    resolvedBy: string,
    note?: string,
  ) => Promise<void>;

  // ── Acciones: comprobantes fiscales & offline ──
  setOfflineMode: (offline: boolean) => Promise<void>;
  syncPendingInvoices: () => Promise<number>;
  createDirectInvoice: (
    saleId: string,
    type: InvoiceType,
    customer?: FiscalCustomer,
  ) => Promise<Invoice>;

  // ── Acciones: catálogo ──
  toggleFavorite: (productId: string) => Promise<void>;
  upsertProduct: (formData: ProductFormData, productId?: string) => Promise<Product>;
  duplicateProduct: (sourceId: string, newName?: string) => Promise<Product>;
  duplicateLastProduct: () => Promise<Product>;
  removeProduct: (productId: string) => Promise<void>;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Store
   ══════════════════════════════════════════════════════════════════════════════ */

const DEFAULT_BIZ = "grupo-termal";
const DEFAULT_BRANCH = "termas-kiosco";
const initialProductsMap = new Map(seedProducts.map((p) => [p.id, p]));

// Lectura síncrona inicial de offline desde localStorage para evitar parpadeos en F5
const initialOfflineSetting = (() => {
  try {
    const val = localStorage.getItem("pos_setting_offlineMode");
    return val ? JSON.parse(val) === true : false;
  } catch {
    return false;
  }
})();

export const usePosStore = create<PosState>()(
  subscribeWithSelector((set, get) => ({
    businessId: DEFAULT_BIZ,
    branchId: DEFAULT_BRANCH,
    products: seedProducts,
    productsMap: initialProductsMap,
    lastProductId: null,
    catalogReady: true,
    cart: [],
    cartTotal: 0,
    cartDiscount: 0,
    selectedLineKey: null,
    draftId: generateSaleId(),
    queue: [],
    paymentHistory: [],
    shifts: [],
    activeShift: null,
    completedSales: [],
    invoices: [],
    isOffline: initialOfflineSetting,
    activeOperator: "Operador 1",
    qrAccounts: [],
    activeBuzzers: [],
    printJobs: [],

    /* ════════════════════════════════════════════════════════════════════════
       Hydrate: Carga completa desde IndexedDB (Catálogo + Ventas + Invoices + Settings)
       ════════════════════════════════════════════════════════════════════════ */
    hydrate: async (businessId?: string, branchId?: string) => {
      const biz = businessId ?? get().businessId;
      const branch = branchId ?? get().branchId;

      try {
        // 1. Asegurar catálogo y comprobantes iniciales
        await ensureSeedProducts(biz, branch);
        await ensureSeedInvoices(biz, branch);

        // 2. Cargar catálogo
        const products = await getProducts(biz, branch);
        const productsMap = new Map(products.map((p) => [p.id, p]));

        // 3. Cargar cola de ventas pendientes (PENDIENTE_PAGO / PAGO_RECHAZADO)
        const queue = await getQueuedSales(biz, branch);
        const paymentHistory = await getPaymentHistory(biz, branch);
        const shifts = await getCashShifts(biz, branch);
        const activeShift = shifts.find((shift) => shift.status === "OPEN") ?? null;

        // 4. Cargar ventas completadas y comprobantes
        const completedSales = await getCompletedSales(biz, branch);
        const invoices = await getInvoices(biz, branch);
        const printJobs = await getPrintJobs();
        const activeBuzzers = await getActiveBuzzers();
        let qrAccounts = await getQrAccounts(biz, branch);
        if (qrAccounts.length === 0) {
          qrAccounts = [
            { id: "QR_1", label: "QR 1 - Caja Principal", enabled: true, businessId: biz, branchId: branch },
            { id: "QR_2", label: "QR 2 - Barra / Auxiliar", enabled: true, businessId: biz, branchId: branch },
          ];
          await putQrAccounts(qrAccounts);
        }

        // 5. Cargar estado de simulación offline persistido
        const isOffline = await getSetting("offlineMode", initialOfflineSetting);
        const savedLastProductId = await getSetting<string | null>("lastProductId", null);

        set({
          businessId: biz,
          branchId: branch,
          products: products.length > 0 ? products : seedProducts,
          productsMap: products.length > 0 ? productsMap : initialProductsMap,
          lastProductId: products.some((product) => product.id === savedLastProductId)
            ? savedLastProductId
            : null,
          catalogReady: true,
          queue,
          paymentHistory,
          shifts,
          activeShift,
          completedSales,
          invoices,
          isOffline,
          qrAccounts,
          activeBuzzers,
          printJobs,
        });
      } catch (err) {
        console.warn("Aviso IndexedDB (operando en memoria):", err);
        set({
          businessId: biz,
          branchId: branch,
          products: seedProducts,
          productsMap: initialProductsMap,
          lastProductId: null,
          catalogReady: true,
          shifts: [],
          activeShift: null,
        });
      }
    },

    openShift: async ({ cashierName, openingCash }) => {
      const { businessId, branchId } = get();
      const openedBy = cashierName.trim();
      if (!openedBy) throw new Error("El turno requiere el nombre del cajero");
      if (!Number.isFinite(openingCash) || openingCash < 0) {
        throw new RangeError("El fondo inicial debe ser un importe no negativo");
      }

      const shift = await createCashShift({
        id: generateRecordId("shift"),
        businessId,
        branchId,
        openedBy,
        openedAt: now(),
        openingCash,
        movements: [],
        status: "OPEN",
      });
      const [shifts, paymentHistory, completedSales] = await Promise.all([
        getCashShifts(businessId, branchId),
        getPaymentHistory(businessId, branchId),
        getCompletedSales(businessId, branchId),
      ]);
      set({ shifts, activeShift: shift, paymentHistory, completedSales });
      return shift;
    },

    relayShift: async ({
      closedBy,
      declaredCash,
      nextCashierName,
      nextOpeningCash,
      posnetItems,
      reconciliationPending,
      approvalStatus,
      approvedBy,
      approvalNote,
      notes,
    }) => {
      const { businessId, branchId } = get();
      const outgoingShift = await getOpenCashShift(businessId, branchId);
      if (!outgoingShift) throw new Error("No hay un turno abierto para relevar");

      const timestamp = now();
      const result = await relayCashShift(
        outgoingShift.id,
        {
          id: generateRecordId("close"),
          closedBy: closedBy.trim(),
          closedAt: timestamp,
          declaredCash,
          posnetItems,
          reconciliationPending,
          approvalStatus,
          approvedBy: approvedBy?.trim(),
          approvedAt: approvedBy ? timestamp : undefined,
          notes: notes?.trim() || undefined,
          observations: approvalNote?.trim() || undefined,
        },
        {
          id: generateRecordId("shift"),
          businessId,
          branchId,
          openedBy: nextCashierName.trim(),
          openedAt: timestamp,
          openingCash: nextOpeningCash,
          movements: [],
          status: "OPEN",
        },
      );
      const [shifts, paymentHistory, completedSales] = await Promise.all([
        getCashShifts(businessId, branchId),
        getPaymentHistory(businessId, branchId),
        getCompletedSales(businessId, branchId),
      ]);
      set({
        shifts,
        activeShift: result.openedShift,
        paymentHistory,
        completedSales,
      });
      return result.openedShift;
    },

    addCashMovement: async ({
      type,
      amount,
      reason,
      createdBy,
      authorizedBy,
    }) => {
      const { businessId, branchId } = get();
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new RangeError("El importe del movimiento debe ser mayor que cero");
      }
      const cleanReason = reason.trim();
      const cleanCreatedBy = createdBy.trim();
      if (!cleanReason) throw new Error("El movimiento requiere un motivo");
      if (!cleanCreatedBy) throw new Error("El movimiento requiere responsable");
      if (!["WITHDRAWAL", "CASH_IN", "EXPENSE"].includes(type)) {
        throw new Error("Tipo de movimiento inválido");
      }

      const shift = await getOpenCashShift(businessId, branchId);
      if (!shift) throw new Error("No hay un turno abierto para registrar el movimiento");
      const movement: CashMovement = {
        id: generateRecordId("movement"),
        shiftId: shift.id,
        businessId,
        branchId,
        type,
        amount,
        reason: cleanReason,
        createdBy: cleanCreatedBy,
        performedBy: cleanCreatedBy,
        authorizedBy: authorizedBy?.trim() || undefined,
        createdAt: now(),
      };
      await recordCashMovement(movement);
      const [updatedShift, shifts] = await Promise.all([
        getCashShift(shift.id),
        getCashShifts(businessId, branchId),
      ]);
      if (!updatedShift) throw new Error("No se pudo recuperar el turno actualizado");
      set({ shifts, activeShift: updatedShift });
      return movement;
    },

    closeShift: async ({
      closedBy,
      declaredCash,
      posnetItems,
      reconciliationPending,
      approvalStatus,
      approvedBy,
      approvalNote,
      notes,
    }) => {
      const { businessId, branchId } = get();
      const activeShift = await getOpenCashShift(businessId, branchId);
      if (!activeShift) throw new Error("No hay un turno abierto para cerrar");
      const timestamp = now();
      const summary = await closeCashShift(activeShift.id, {
        id: generateRecordId("close"),
        closedBy: closedBy.trim(),
        closedAt: timestamp,
        declaredCash,
        posnetItems,
        reconciliationPending,
        approvalStatus,
        approvedBy: approvedBy?.trim(),
        approvedAt: approvedBy ? timestamp : undefined,
        notes: notes?.trim() || undefined,
        observations: approvalNote?.trim() || undefined,
      });
      const [closedShift, shifts] = await Promise.all([
        getCashShift(activeShift.id),
        getCashShifts(businessId, branchId),
      ]);
      if (!closedShift) throw new Error("No se pudo recuperar el turno cerrado");
      set({ shifts, activeShift: null });
      return summary;
    },

    updateShiftReconciliation: async (
      shiftId,
      posnetItems,
      reconciliationPending,
    ) => {
      const updatedShift = await updateCashShiftReconciliation(
        shiftId,
        posnetItems,
        reconciliationPending,
      );
      set((state) => ({
        shifts: state.shifts.map((shift) =>
          shift.id === shiftId ? updatedShift : shift,
        ),
      }));
    },

    resolveShiftApproval: async (
      shiftId,
      approvalStatus,
      resolvedBy,
      note,
    ) => {
      const updatedShift = await updateCashShiftApproval(
        shiftId,
        approvalStatus,
        resolvedBy,
        note,
      );
      set((state) => ({
        shifts: state.shifts.map((shift) =>
          shift.id === shiftId ? updatedShift : shift,
        ),
      }));
    },

    /* ════════════════════════════════════════════════════════════════════════
       Carrito – BORRADOR
       ════════════════════════════════════════════════════════════════════════ */

    addToCart: (product, modifiers = []) => {
      const lineKey = buildLineKey(product.id, modifiers);
      const unitFinalPrice = calcUnitFinalPrice(product.basePrice, modifiers);

      set((state) => {
        const existing = state.cart.find((i) => i.lineKey === lineKey);

        let newCart: CartItem[];
        if (existing) {
          newCart = state.cart.map((i) =>
            i.lineKey === lineKey
              ? {
                  ...i,
                  qty: i.qty + 1,
                  subtotal: (i.qty + 1) * i.unitFinalPrice,
                }
              : i,
          );
        } else {
          const item: CartItem = {
            lineKey,
            productId: product.id,
            name: product.name,
            unitBasePrice: product.basePrice,
            selectedModifiers: modifiers,
            unitFinalPrice,
            qty: 1,
            subtotal: unitFinalPrice,
          };
          newCart = [...state.cart, item];
        }

        return {
          cart: newCart,
          cartTotal: recalcCartTotal(newCart),
        };
      });
    },

    selectCartLine: (lineKey) => {
      set((state) => ({
        selectedLineKey:
          lineKey && state.cart.some((item) => item.lineKey === lineKey)
            ? lineKey
            : null,
      }));
    },

    removeFromCart: (lineKey) => {
      set((state) => {
        const newCart = state.cart.filter((i) => i.lineKey !== lineKey);
        return {
          cart: newCart,
          cartTotal: recalcCartTotal(newCart),
          selectedLineKey:
            state.selectedLineKey === lineKey ? null : state.selectedLineKey,
        };
      });
    },

    updateQty: (lineKey, delta) => {
      set((state) => {
        const newCart = state.cart
          .map((i) => {
            if (i.lineKey !== lineKey) return i;
            const newQty = i.qty + delta;
            if (newQty <= 0) return null;
            return {
              ...i,
              qty: newQty,
              subtotal: newQty * i.unitFinalPrice,
            };
          })
          .filter(Boolean) as CartItem[];

        return {
          cart: newCart,
          cartTotal: recalcCartTotal(newCart),
          selectedLineKey: newCart.some((item) => item.lineKey === lineKey)
            ? lineKey
            : null,
        };
      });
    },

    setQty: (lineKey, qty) => {
      if (qty <= 0) {
        get().removeFromCart(lineKey);
        return;
      }
      set((state) => {
        const newCart = state.cart.map((i) =>
          i.lineKey === lineKey
            ? { ...i, qty, subtotal: qty * i.unitFinalPrice }
            : i,
        );
        return {
          cart: newCart,
          cartTotal: recalcCartTotal(newCart),
          selectedLineKey: lineKey,
        };
      });
    },

    changeModifiers: (lineKey, product, newModifiers) => {
      const newLineKey = buildLineKey(product.id, newModifiers);
      const newUnitFinalPrice = calcUnitFinalPrice(
        product.basePrice,
        newModifiers,
      );

      set((state) => {
        const oldItem = state.cart.find((i) => i.lineKey === lineKey);
        if (!oldItem) return state;

        const existingTarget = state.cart.find(
          (i) => i.lineKey === newLineKey && i.lineKey !== lineKey,
        );

        let newCart: CartItem[];
        if (existingTarget) {
          const mergedQty = existingTarget.qty + oldItem.qty;
          newCart = state.cart
            .filter((i) => i.lineKey !== lineKey)
            .map((i) =>
              i.lineKey === newLineKey
                ? {
                    ...i,
                    qty: mergedQty,
                    subtotal: mergedQty * i.unitFinalPrice,
                  }
                : i,
            );
        } else {
          newCart = state.cart.map((i) =>
            i.lineKey === lineKey
              ? {
                  ...i,
                  lineKey: newLineKey,
                  selectedModifiers: newModifiers,
                  unitFinalPrice: newUnitFinalPrice,
                  subtotal: i.qty * newUnitFinalPrice,
                }
              : i,
          );
        }

        return {
          cart: newCart,
          cartTotal: recalcCartTotal(newCart),
          selectedLineKey: newCart.some((item) => item.lineKey === newLineKey)
            ? newLineKey
            : null,
        };
      });
    },

    setCartDiscount: (amount) => {
      set((state) => ({
        cartDiscount: Math.min(
          state.cartTotal,
          Math.max(0, Number.isFinite(amount) ? amount : 0),
        ),
      }));
    },

    clearCart: () => {
      set({
        cart: [],
        cartTotal: 0,
        cartDiscount: 0,
        selectedLineKey: null,
        draftId: generateSaleId(),
      });
    },

    recoverSaleToCart: (saleId) => {
      const sale = get().paymentHistory.find((entry) => entry.id === saleId);
      if (!sale) return null;

      const cart = structuredClone(sale.items);
      const cartTotal = recalcCartTotal(cart);
      const draftId = generateSaleId();
      set({
        cart,
        cartTotal,
        cartDiscount: Math.min(sale.discount, cartTotal),
        selectedLineKey: cart[0]?.lineKey ?? null,
        draftId,
      });
      return draftId;
    },

    /* ════════════════════════════════════════════════════════════════════════
       Ventas – Submit & Transiciones de Cola
       ════════════════════════════════════════════════════════════════════════ */

    submitSale: async (
      paymentMethod,
      notes,
      invoiceType = "FACTURA_B",
      customer,
      cashReceived,
      qrAccountId,
      buzzerNumber,
    ) => {
      const {
        cart,
        cartTotal,
        cartDiscount,
        draftId,
        businessId,
        branchId,
        activeShift,
        activeOperator,
        qrAccounts,
      } = get();
      if (cart.length === 0) throw new Error("El carrito está vacío");

      const timestamp = now();
      const total = Math.max(0, cartTotal - cartDiscount);

      if (!Number.isFinite(total) || cartDiscount > cartTotal) {
        throw new Error("El descuento no puede superar el subtotal");
      }

      if (
        paymentMethod === "EFECTIVO" &&
        cashReceived !== undefined &&
        (!Number.isFinite(cashReceived) || cashReceived < total)
      ) {
        throw new Error("El monto recibido no cubre el total");
      }

      const change =
        paymentMethod === "EFECTIVO" && cashReceived !== undefined
          ? Math.max(0, cashReceived - total)
          : undefined;

      const resolvedCustomer: FiscalCustomer =
        customer || (invoiceType === "FACTURA_B"
          ? { businessName: "Consumidor Final", taxCondition: "CONSUMIDOR_FINAL" }
          : { businessName: "Responsable Inscripto", taxCondition: "RESPONSABLE_INSCRIPTO" });

      const saleId = draftId;
      const qrAccount =
        qrAccountId && qrAccountId.length > 0
          ? qrAccounts.find((account) => account.id === qrAccountId)
          : paymentMethod === "QR"
            ? qrAccounts.find((account) => account.id === "QR_1")
            : undefined;

      const sale: Sale = {
        id: saleId,
        businessId,
        branchId,
        shiftId: activeShift?.id,
        items: structuredClone(cart),
        status: "PENDIENTE_PAGO",
        paymentMethod,
        subtotal: cartTotal,
        discount: cartDiscount,
        total,
        cashReceived:
          paymentMethod === "EFECTIVO" ? cashReceived : undefined,
        change,
        notes,
        createdAt: timestamp,
        updatedAt: timestamp,
        invoiceType,
        customer: resolvedCustomer,
        qrAccountId: qrAccount?.id,
        qrAccountLabel: qrAccount?.label,
        operatedBy: activeOperator,
        buzzerNumber: buzzerNumber?.trim() || undefined,
      };

      // 1. Vaciar carrito INMEDIATAMENTE (0 ms de bloqueo para el operador)
      set((state) => ({
        cart: [],
        cartTotal: 0,
        cartDiscount: 0,
        selectedLineKey: null,
        draftId: generateSaleId(),
        queue: [...state.queue, sale],
        paymentHistory: updateRecentPaymentHistory(state.paymentHistory, sale),
      }));

      // Resolve the IndexedDB shift after the synchronous UI update.
      const persistedOpenShift = await getOpenCashShift(businessId, branchId);
      const attributedSale: Sale = {
        ...sale,
        shiftId: persistedOpenShift?.id ?? sale.shiftId,
      };
      if (attributedSale.shiftId !== sale.shiftId) {
        set((state) => ({
          queue: state.queue.map((entry) =>
            entry.id === sale.id ? attributedSale : entry,
          ),
          paymentHistory: replacePaymentHistoryEntry(
            state.paymentHistory,
            attributedSale,
          ),
        }));
      }

      await Promise.all([
        putSale(attributedSale),
        addPaymentHistory(attributedSale),
      ]);

      return attributedSale;
    },

    markSalePaid: async (saleId) => {
      const timestamp = now();
      const { isOffline } = get();

      const existing = (await getSale(saleId)) || get().queue.find((s) => s.id === saleId);
      if (!existing || existing.status === "PAGADA") return;

      const invoiceType: InvoiceType = existing.invoiceType || "FACTURA_B";
      const invoiceNumber =
        existing.invoiceNumber ||
        (await getNextInvoiceNumber(
          existing.businessId,
          existing.branchId,
          invoiceType,
        ));

      const fiscalStatus: FiscalStatus = isOffline
        ? "PENDIENTE_ENVIO_ARCA"
        : "AUTORIZADO";
      const cae = fiscalStatus === "AUTORIZADO" ? generateCae() : undefined;
      const caeExpiresAt = fiscalStatus === "AUTORIZADO" ? calcCaeExpiresAt() : undefined;

      const customer: FiscalCustomer =
        existing.customer || (invoiceType === "FACTURA_B"
          ? { businessName: "Consumidor Final", taxCondition: "CONSUMIDOR_FINAL" }
          : { businessName: "Responsable Inscripto", taxCondition: "RESPONSABLE_INSCRIPTO" });

      const cashReceived =
        existing.paymentMethod === "EFECTIVO"
          ? existing.cashReceived ?? existing.total
          : undefined;
      const change =
        existing.paymentMethod === "EFECTIVO"
          ? Math.max(0, cashReceived! - existing.total)
          : undefined;

      const updatedSale: Sale = {
        ...existing,
        status: "PAGADA",
        paidAt: existing.paidAt ?? timestamp,
        invoiceType,
        invoiceNumber,
        fiscalStatus,
        cae,
        customer,
        cashReceived,
        change,
        updatedAt: timestamp,
        closedAt: timestamp,
      };
      const dispatch = buildDispatchJobs(updatedSale, get().products, get().activeBuzzers);
      const dispatchedSale = dispatch.sale;
      const persistedSale = await putPaidSale(dispatchedSale);
      await get().enqueuePrintJobs(dispatch.jobs);

      let nextActiveBuzzers = get().activeBuzzers;
      if (dispatch.buzzerNumber) {
        const buzzer: BuzzerState = {
          number: dispatch.buzzerNumber,
          saleId: persistedSale.id,
          ticketNumber: dispatch.jobs[0]?.ticketNumber ?? persistedSale.id,
          assignedAt: timestamp,
        };
        await putActiveBuzzer(buzzer);
        nextActiveBuzzers = [
          ...nextActiveBuzzers.filter((entry) => entry.number !== buzzer.number),
          buzzer,
        ];
      }

      // Crear comprobante fiscal
      const netAmount = invoiceType === "FACTURA_A" ? Number((persistedSale.total / 1.21).toFixed(2)) : persistedSale.total;
      const ivaAmount = invoiceType === "FACTURA_A" ? Number((persistedSale.total - netAmount).toFixed(2)) : 0;

      const invoice: Invoice = {
        id: generateInvoiceId(),
        saleId: persistedSale.id,
        invoiceType,
        invoiceNumber,
        businessId: persistedSale.businessId,
        branchId: persistedSale.branchId,
        items: structuredClone(persistedSale.items),
        subtotal: persistedSale.subtotal,
        discount: persistedSale.discount,
        total: persistedSale.total,
        netAmount,
        ivaAmount,
        paymentMethod: persistedSale.paymentMethod || "EFECTIVO",
        cashReceived: persistedSale.cashReceived,
        change: persistedSale.change,
        customer,
        fiscalStatus,
        cae,
        caeExpiresAt,
        createdAt: timestamp,
        syncedAt: fiscalStatus === "AUTORIZADO" ? timestamp : undefined,
      };

      // Actualizar estado en memoria reactivamente
      set((state) => ({
        queue: state.queue.filter((s) => s.id !== saleId),
        completedSales: [persistedSale, ...state.completedSales.filter((s) => s.id !== saleId)],
        invoices: [invoice, ...state.invoices.filter((i) => i.saleId !== saleId)],
        paymentHistory: replacePaymentHistoryEntry(
          state.paymentHistory,
          persistedSale,
        ),
        printJobs: [
          ...dispatch.jobs,
          ...state.printJobs.filter(
            (job) => !dispatch.jobs.some((entry) => entry.id === job.id),
          ),
        ],
        activeBuzzers: nextActiveBuzzers,
      }));

      await Promise.all([
        putInvoice(invoice),
        updatePaymentHistory(persistedSale),
      ]);
    },

    markSaleRejected: async (saleId) => {
      const timestamp = now();
      const existing =
        get().queue.find((sale) => sale.id === saleId) ||
        (await getSale(saleId));
      if (!existing) return;

      const updatedSale: Sale = {
        ...existing,
        status: "PAGO_RECHAZADO",
        updatedAt: timestamp,
      };
      set((state) => ({
        queue: state.queue.map((s) =>
          s.id === saleId ? updatedSale : s,
        ),
        paymentHistory: replacePaymentHistoryEntry(
          state.paymentHistory,
          updatedSale,
        ),
      }));

      await Promise.all([
        putSale(updatedSale),
        updatePaymentHistory(updatedSale),
      ]);
    },

    retrySale: async (saleId, paymentMethod) => {
      const timestamp = now();
      const existing =
        get().queue.find((sale) => sale.id === saleId) ||
        (await getSale(saleId));
      if (!existing) return;

      const activeShift = await getOpenCashShift(
        existing.businessId,
        existing.branchId,
      );
      const updatedSale: Sale = {
        ...existing,
        shiftId: existing.shiftId ?? activeShift?.id,
        status: "PENDIENTE_PAGO",
        paymentMethod,
        updatedAt: timestamp,
      };
      set((state) => ({
        queue: state.queue.map((s) =>
          s.id === saleId ? updatedSale : s,
        ),
        paymentHistory: replacePaymentHistoryEntry(
          state.paymentHistory,
          updatedSale,
        ),
      }));

      await Promise.all([
        putSale(updatedSale),
        updatePaymentHistory(updatedSale),
      ]);
    },

    changePaymentMethod: async (saleId, paymentMethod) => {
      const timestamp = now();
      const existing =
        get().queue.find((sale) => sale.id === saleId) ||
        (await getSale(saleId));
      if (!existing) return;

      const activeShift = await getOpenCashShift(
        existing.businessId,
        existing.branchId,
      );
      const updatedSale = {
        ...existing,
        shiftId: existing.shiftId ?? activeShift?.id,
        paymentMethod,
        updatedAt: timestamp,
      };
      set((state) => ({
        queue: state.queue.map((s) =>
          s.id === saleId ? updatedSale : s,
        ),
        paymentHistory: replacePaymentHistoryEntry(
          state.paymentHistory,
          updatedSale,
        ),
      }));

      await Promise.all([
        putSale(updatedSale),
        updatePaymentHistory(updatedSale),
      ]);
    },

    cancelSale: async (saleId, details) => {
      const timestamp = now();
      const existing =
        get().queue.find((sale) => sale.id === saleId) ||
        (await getSale(saleId));
      if (!existing) return;
      if (existing.status === "CANCELADA") return;

      const updatedSale: Sale = {
        ...existing,
        status: "CANCELADA",
        updatedAt: timestamp,
        closedAt: timestamp,
        paidAt:
          existing.paidAt ??
          (existing.status === "PAGADA" ? existing.closedAt ?? timestamp : undefined),
        cancelledAt: timestamp,
        cancelledBy: details?.cancelledBy,
        cancellationReason: details?.cancellationReason,
      };
      set((state) => ({
        queue: state.queue.filter((s) => s.id !== saleId),
        completedSales: [
          updatedSale,
          ...state.completedSales.filter((sale) => sale.id !== saleId),
        ],
        paymentHistory: replacePaymentHistoryEntry(
          state.paymentHistory,
          updatedSale,
        ),
      }));

      await Promise.all([
        putSale(updatedSale),
        updatePaymentHistory(updatedSale),
      ]);
    },

    recordCashPayment: async (
      saleId,
      cashReceived,
      invoiceType = "FACTURA_B",
      customer,
    ) => {
      const timestamp = now();
      const { isOffline } = get();

      const existing = (await getSale(saleId)) || get().queue.find((s) => s.id === saleId);
      if (!existing || existing.status === "PAGADA") return;

      if (!Number.isFinite(cashReceived) || cashReceived < existing.total) {
        throw new Error("El monto recibido no cubre el total");
      }

      const change = Math.max(0, cashReceived - existing.total);
      const invoiceNumber =
        existing.invoiceNumber ||
        (await getNextInvoiceNumber(
          existing.businessId,
          existing.branchId,
          invoiceType,
        ));

      const fiscalStatus: FiscalStatus = isOffline
        ? "PENDIENTE_ENVIO_ARCA"
        : "AUTORIZADO";
      const cae = fiscalStatus === "AUTORIZADO" ? generateCae() : undefined;
      const caeExpiresAt = fiscalStatus === "AUTORIZADO" ? calcCaeExpiresAt() : undefined;

      const resolvedCustomer: FiscalCustomer =
        customer || existing.customer || (invoiceType === "FACTURA_B"
          ? { businessName: "Consumidor Final", taxCondition: "CONSUMIDOR_FINAL" }
          : { businessName: "Responsable Inscripto", taxCondition: "RESPONSABLE_INSCRIPTO" });

      const updatedSale: Sale = {
        ...existing,
        status: "PAGADA",
        paidAt: existing.paidAt ?? timestamp,
        paymentMethod: "EFECTIVO",
        cashReceived,
        change,
        invoiceType,
        invoiceNumber,
        fiscalStatus,
        cae,
        customer: resolvedCustomer,
        updatedAt: timestamp,
        closedAt: timestamp,
      };
      const dispatch = buildDispatchJobs(updatedSale, get().products, get().activeBuzzers);
      const persistedSale = await putPaidSale(dispatch.sale);
      await get().enqueuePrintJobs(dispatch.jobs);

      let nextActiveBuzzers = get().activeBuzzers;
      if (dispatch.buzzerNumber) {
        const buzzer: BuzzerState = {
          number: dispatch.buzzerNumber,
          saleId: persistedSale.id,
          ticketNumber: dispatch.jobs[0]?.ticketNumber ?? persistedSale.id,
          assignedAt: timestamp,
        };
        await putActiveBuzzer(buzzer);
        nextActiveBuzzers = [
          ...nextActiveBuzzers.filter((entry) => entry.number !== buzzer.number),
          buzzer,
        ];
      }

      const netAmount = invoiceType === "FACTURA_A" ? Number((persistedSale.total / 1.21).toFixed(2)) : persistedSale.total;
      const ivaAmount = invoiceType === "FACTURA_A" ? Number((persistedSale.total - netAmount).toFixed(2)) : 0;

      const invoice: Invoice = {
        id: generateInvoiceId(),
        saleId: persistedSale.id,
        invoiceType,
        invoiceNumber,
        businessId: persistedSale.businessId,
        branchId: persistedSale.branchId,
        items: structuredClone(persistedSale.items),
        subtotal: persistedSale.subtotal,
        discount: persistedSale.discount,
        total: persistedSale.total,
        netAmount,
        ivaAmount,
        paymentMethod: "EFECTIVO",
        cashReceived,
        change,
        customer: resolvedCustomer,
        fiscalStatus,
        cae,
        caeExpiresAt,
        createdAt: timestamp,
        syncedAt: fiscalStatus === "AUTORIZADO" ? timestamp : undefined,
      };

      set((state) => ({
        queue: state.queue.filter((s) => s.id !== saleId),
        completedSales: [persistedSale, ...state.completedSales.filter((s) => s.id !== saleId)],
        invoices: [invoice, ...state.invoices.filter((i) => i.saleId !== saleId)],
        paymentHistory: replacePaymentHistoryEntry(
          state.paymentHistory,
          persistedSale,
        ),
        printJobs: [
          ...dispatch.jobs,
          ...state.printJobs.filter(
            (job) => !dispatch.jobs.some((entry) => entry.id === job.id),
          ),
        ],
        activeBuzzers: nextActiveBuzzers,
      }));

      await Promise.all([
        putInvoice(invoice),
        updatePaymentHistory(persistedSale),
      ]);
    },

    /* ════════════════════════════════════════════════════════════════════════
       Facturación & Modo Offline
       ════════════════════════════════════════════════════════════════════════ */

    setOfflineMode: async (offline: boolean) => {
      set({ isOffline: offline });
      await setSetting("offlineMode", offline);
    },

    syncPendingInvoices: async () => {
      const { invoices } = get();
      const pending = invoices.filter((i) => i.fiscalStatus === "PENDIENTE_ENVIO_ARCA");
      if (pending.length === 0) return 0;

      const timestamp = now();
      const expiresAt = calcCaeExpiresAt();

      const updatedInvoices = invoices.map((inv) => {
        if (inv.fiscalStatus === "PENDIENTE_ENVIO_ARCA") {
          return {
            ...inv,
            fiscalStatus: "AUTORIZADO" as FiscalStatus,
            cae: generateCae(),
            caeExpiresAt: expiresAt,
            syncedAt: timestamp,
          };
        }
        return inv;
      });

      // Persistir cada comprobante actualizado en IndexedDB
      for (const inv of updatedInvoices) {
        if (inv.syncedAt === timestamp) {
          await putInvoice(inv);
          // Actualizar venta correspondiente
          const sale = await getSale(inv.saleId);
          if (sale) {
            await putSale({
              ...sale,
              fiscalStatus: "AUTORIZADO",
              cae: inv.cae,
              updatedAt: timestamp,
            });
          }
        }
      }

      // Actualizar completedSales en store
      const updatedCompletedSales = get().completedSales.map((s) => {
        const matchingInv = updatedInvoices.find((i) => i.saleId === s.id);
        if (matchingInv && matchingInv.fiscalStatus === "AUTORIZADO") {
          return {
            ...s,
            fiscalStatus: "AUTORIZADO" as FiscalStatus,
            cae: matchingInv.cae,
            updatedAt: timestamp,
          };
        }
        return s;
      });

      set({
        invoices: updatedInvoices,
        completedSales: updatedCompletedSales,
      });

      return pending.length;
    },

    createDirectInvoice: async (saleId, type, customer) => {
      const { businessId, branchId, isOffline } = get();
      const sale = await getSale(saleId);
      if (!sale) throw new Error("Venta no encontrada");

      const timestamp = now();
      const invoiceNumber = await getNextInvoiceNumber(businessId, branchId, type);
      const fiscalStatus: FiscalStatus = isOffline ? "PENDIENTE_ENVIO_ARCA" : "AUTORIZADO";
      const cae = fiscalStatus === "AUTORIZADO" ? generateCae() : undefined;
      const caeExpiresAt = fiscalStatus === "AUTORIZADO" ? calcCaeExpiresAt() : undefined;

      const resolvedCustomer: FiscalCustomer =
        customer || (type === "FACTURA_B"
          ? { businessName: "Consumidor Final", taxCondition: "CONSUMIDOR_FINAL" }
          : { businessName: "Responsable Inscripto", taxCondition: "RESPONSABLE_INSCRIPTO" });

      const netAmount = type === "FACTURA_A" ? Number((sale.total / 1.21).toFixed(2)) : sale.total;
      const ivaAmount = type === "FACTURA_A" ? Number((sale.total - netAmount).toFixed(2)) : 0;

      const invoice: Invoice = {
        id: generateInvoiceId(),
        saleId: sale.id,
        invoiceType: type,
        invoiceNumber,
        businessId,
        branchId,
        items: structuredClone(sale.items),
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        netAmount,
        ivaAmount,
        paymentMethod: sale.paymentMethod || "EFECTIVO",
        cashReceived: sale.cashReceived,
        change: sale.change,
        customer: resolvedCustomer,
        fiscalStatus,
        cae,
        caeExpiresAt,
        createdAt: timestamp,
        syncedAt: fiscalStatus === "AUTORIZADO" ? timestamp : undefined,
      };

      set((state) => ({
        invoices: [invoice, ...state.invoices],
      }));

      await putInvoice(invoice);
      return invoice;
    },

    setActiveOperator: (operator) => {
      set({ activeOperator: operator.trim() || "Operador 1" });
    },

    assignNextBuzzer: async (saleId, ticketNumber) => {
      const { activeBuzzers } = get();
      const used = activeBuzzers.filter((buzzer) => !buzzer.releasedAt);
      let number: string | null = null;
      for (let index = 1; index <= 50; index += 1) {
        const candidate = String(index).padStart(2, "0");
        if (!used.some((buzzer) => buzzer.number === candidate)) {
          number = candidate;
          break;
        }
      }
      if (!number) return null;
      return get().assignBuzzer(number, saleId, ticketNumber);
    },

    assignBuzzer: async (number, saleId, ticketNumber) => {
      const normalized = number.trim().padStart(2, "0");
      const numeric = Number(normalized);
      if (!/^\d{1,2}$/.test(normalized) || numeric < 1 || numeric > 50) {
        throw new Error("El llamador debe estar entre 01 y 50");
      }
      const { activeBuzzers } = get();
      if (activeBuzzers.some((buzzer) => buzzer.number === normalized && !buzzer.releasedAt)) {
        throw new Error(`El llamador ${normalized} ya está en uso`);
      }
      const buzzer: BuzzerState = {
        number: normalized,
        saleId,
        ticketNumber,
        assignedAt: now(),
      };
      await putActiveBuzzer(buzzer);
      set((state) => ({
        activeBuzzers: [
          ...state.activeBuzzers.filter((entry) => entry.number !== normalized),
          buzzer,
        ],
      }));
      return buzzer;
    },

    releaseBuzzer: async (buzzerNumber) => {
      const normalized = buzzerNumber.trim();
      await deleteActiveBuzzer(normalized);
      set((state) => ({
        activeBuzzers: state.activeBuzzers.filter(
          (buzzer) => buzzer.number !== normalized,
        ),
      }));
    },

    enqueuePrintJobs: async (jobs) => {
      await putPrintJobs(jobs);
      set((state) => ({
        printJobs: [
          ...jobs,
          ...state.printJobs.filter(
            (job) => !jobs.some((entry) => entry.id === job.id),
          ),
        ],
      }));
      for (const job of jobs) {
        void sendPrintJob(job)
          .then(() => get().markPrintJobSuccess(job.id))
          .catch((error: unknown) =>
            get().markPrintJobFailed(
              job.id,
              error instanceof Error ? error.message : "Fallo de impresión",
            ),
          );
      }
    },

    markPrintJobSuccess: async (jobId) => {
      const existing = get().printJobs.find((job) => job.id === jobId);
      if (!existing) return;
      const updated: PrintJob = {
        ...existing,
        status: "PRINTED",
        updatedAt: now(),
      };
      await putPrintJob(updated);
      set((state) => ({
        printJobs: state.printJobs.map((job) =>
          job.id === jobId ? updated : job,
        ),
      }));
    },

    markPrintJobFailed: async (jobId, error) => {
      const existing = get().printJobs.find((job) => job.id === jobId);
      if (!existing) return;
      const updated: PrintJob = {
        ...existing,
        status: "FAILED",
        attempts: existing.attempts + 1,
        lastError: error,
        updatedAt: now(),
      };
      await putPrintJob(updated);
      set((state) => ({
        printJobs: state.printJobs.map((job) =>
          job.id === jobId ? updated : job,
        ),
      }));
    },

    retryPrintJob: async (jobId) => {
      const existing = get().printJobs.find((job) => job.id === jobId);
      if (!existing) return;
      const updated: PrintJob = {
        ...existing,
        status: "QUEUED",
        attempts: existing.attempts + 1,
        updatedAt: now(),
      };
      await putPrintJob(updated);
      set((state) => ({
        printJobs: state.printJobs.map((job) =>
          job.id === jobId ? updated : job,
        ),
      }));
      void sendPrintJob(updated)
        .then(() => get().markPrintJobSuccess(jobId))
        .catch((error: unknown) =>
          get().markPrintJobFailed(
            jobId,
            error instanceof Error ? error.message : "Fallo de impresión",
          ),
        );
    },

    reprintSaleTickets: async (saleId) => {
      const sale =
        get().completedSales.find((entry) => entry.id === saleId) ??
        (await getSale(saleId));
      if (!sale) return;
      const dispatch = buildDispatchJobs(sale, get().products, get().activeBuzzers);
      await get().enqueuePrintJobs(dispatch.jobs);
    },

    /* ════════════════════════════════════════════════════════════════════════
       Catálogo – Favoritos
       ════════════════════════════════════════════════════════════════════════ */

    toggleFavorite: async (productId) => {
      set((state) => {
        const newProducts = state.products.map((p) =>
          p.id === productId ? { ...p, isFavorite: !p.isFavorite } : p,
        );
        const newMap = new Map(newProducts.map((p) => [p.id, p]));
        return { products: newProducts, productsMap: newMap };
      });

      await dbToggleFavorite(productId);
    },

    upsertProduct: async (formData: ProductFormData, productId?: string) => {
      const { businessId, branchId, products } = get();
      const productToSave = normalizeProductDraft(
        { ...formData, id: productId ?? formData.id },
        { businessId, branchId, existingProducts: products },
      );
      const validationErrors = validateProductDraft(productToSave, products);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(" "));
      }

      // Persistir en IndexedDB
      await putProduct(productToSave);

      // Actualizar síncronamente en memoria (O(1) para el Map y reactividad inmediata)
      const currentState = get();
      const existingIndex = currentState.products.findIndex(
        (product) => product.id === productToSave.id,
      );
      let newProducts: Product[];
      if (existingIndex >= 0) {
        newProducts = [...currentState.products];
        newProducts[existingIndex] = productToSave;
      } else {
        newProducts = [productToSave, ...currentState.products];
      }

      const newMap = new Map(currentState.productsMap);
      newMap.set(productToSave.id, productToSave);

      set({
        products: newProducts,
        productsMap: newMap,
        lastProductId: productToSave.id,
      });
      await setSetting("lastProductId", productToSave.id);

      return productToSave;
    },

    duplicateProduct: async (sourceId: string, newName?: string) => {
      const { productsMap, products, upsertProduct } = get();
      const source = productsMap.get(sourceId) || products.find((p) => p.id === sourceId);
      if (!source) {
        throw new Error(`Producto con ID ${sourceId} no encontrado para duplicar`);
      }

      const clonedData = cloneProductData(source, newName);
      return upsertProduct(clonedData);
    },

    duplicateLastProduct: async () => {
      const lastProductId = get().lastProductId;
      if (!lastProductId) {
        throw new Error("Todavía no hay un producto creado o editado para duplicar.");
      }
      return get().duplicateProduct(lastProductId);
    },

    removeProduct: async (productId: string) => {
      await deleteProduct(productId);

      const { products, productsMap } = get();
      const newProducts = products.filter((p) => p.id !== productId);
      const newMap = new Map(productsMap);
      newMap.delete(productId);

      set({
        products: newProducts,
        productsMap: newMap,
        lastProductId:
          get().lastProductId === productId ? null : get().lastProductId,
      });
      if (get().lastProductId === null) {
        await setSetting("lastProductId", null);
      }
    },
  })),
);

if (typeof BroadcastChannel !== "undefined") {
  const syncChannel = new BroadcastChannel("kiosco-termas-sync");
  let applyingRemoteState = false;

  syncChannel.onmessage = (event: MessageEvent) => {
    const payload = event.data as {
      cart?: CartItem[];
      cartTotal?: number;
      cartDiscount?: number;
      selectedLineKey?: string | null;
      queue?: Sale[];
      completedSales?: Sale[];
      activeOperator?: string;
      activeBuzzers?: BuzzerState[];
      printJobs?: PrintJob[];
      qrAccounts?: QrAccountConfig[];
    };
    applyingRemoteState = true;
    usePosStore.setState({
      ...(payload.cart ? { cart: payload.cart } : {}),
      ...(payload.cartTotal !== undefined ? { cartTotal: payload.cartTotal } : {}),
      ...(payload.cartDiscount !== undefined ? { cartDiscount: payload.cartDiscount } : {}),
      ...(payload.selectedLineKey !== undefined
        ? { selectedLineKey: payload.selectedLineKey }
        : {}),
      ...(payload.queue ? { queue: payload.queue } : {}),
      ...(payload.completedSales ? { completedSales: payload.completedSales } : {}),
      ...(payload.activeOperator ? { activeOperator: payload.activeOperator } : {}),
      ...(payload.activeBuzzers ? { activeBuzzers: payload.activeBuzzers } : {}),
      ...(payload.printJobs ? { printJobs: payload.printJobs } : {}),
      ...(payload.qrAccounts ? { qrAccounts: payload.qrAccounts } : {}),
    });
    queueMicrotask(() => {
      applyingRemoteState = false;
    });
  };

  usePosStore.subscribe((state) => {
    if (applyingRemoteState) return;
    syncChannel.postMessage({
      cart: state.cart,
      cartTotal: state.cartTotal,
      cartDiscount: state.cartDiscount,
      selectedLineKey: state.selectedLineKey,
      queue: state.queue,
      completedSales: state.completedSales,
      activeOperator: state.activeOperator,
      activeBuzzers: state.activeBuzzers,
      printJobs: state.printJobs,
      qrAccounts: state.qrAccounts,
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   Selectores derivados optimizados
   ══════════════════════════════════════════════════════════════════════════════ */

export const useProductsByCategory = (category: Product["category"]) =>
  usePosStore(
    useShallow((state) =>
      state.products.filter((product) => product.category === category),
    ),
  );

export const useFavorites = () =>
  usePosStore(
    useShallow((state) => state.products.filter((product) => product.isFavorite)),
  );

export const useCartItemCount = () =>
  usePosStore((state) => state.cart.reduce((sum, item) => sum + item.qty, 0));

export const useCartFinalTotal = () =>
  usePosStore((state) => Math.max(0, state.cartTotal - state.cartDiscount));

export const usePendingSales = () =>
  usePosStore(
    useShallow((state) =>
      state.queue.filter((sale) => sale.status === "PENDIENTE_PAGO"),
    ),
  );

export const useRejectedSales = () =>
  usePosStore(
    useShallow((state) =>
      state.queue.filter((sale) => sale.status === "PAGO_RECHAZADO"),
    ),
  );

export const usePendingInvoicesCount = () =>
  usePosStore(
    (state) =>
      state.invoices.filter((i) => i.fiscalStatus === "PENDIENTE_ENVIO_ARCA").length,
  );
