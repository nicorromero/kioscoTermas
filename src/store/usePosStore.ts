// ─── Zustand Store – POS Kiosco Termas ───────────────────────────────────────
// Maneja: catálogo, carrito (BORRADOR), cola de ventas (0 ms bloqueo),
// comprobantes fiscales (Factura B / A), estado offline y métricas para el dueño.

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type {
  Product,
  CartItem,
  SelectedModifier,
  Sale,
  SaleStatus,
  PaymentMethod,
  Invoice,
  InvoiceType,
  FiscalCustomer,
  FiscalStatus,
} from "../types/pos";
import { seedProducts } from "../data/seedProducts";
import {
  ensureSeedProducts,
  ensureSeedInvoices,
  getProducts,
  getSale,
  putSale,
  getQueuedSales,
  getCompletedSales,
  getInvoices,
  putInvoice,
  updateInvoiceStatus,
  getNextInvoiceNumber,
  getSetting,
  setSetting,
  toggleFavorite as dbToggleFavorite,
} from "../db/indexedDb";

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
  catalogReady: boolean;

  // ── Carrito activo (BORRADOR) ──
  cart: CartItem[];
  cartTotal: number;
  cartDiscount: number;

  // ── Cola de ventas en mostrador ──
  queue: Sale[];

  // ── Ventas completadas & Comprobantes ──
  completedSales: Sale[];
  invoices: Invoice[];

  // ── Resiliencia Offline ──
  isOffline: boolean;

  // ── Acciones: inicialización ──
  hydrate: (businessId?: string, branchId?: string) => Promise<void>;

  // ── Acciones: carrito ──
  addToCart: (product: Product, modifiers?: SelectedModifier[]) => void;
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

  // ── Acciones: ventas / cola ──
  submitSale: (
    paymentMethod: PaymentMethod,
    notes?: string,
    invoiceType?: InvoiceType,
    customer?: FiscalCustomer,
    cashReceived?: number,
  ) => Promise<Sale>;
  markSalePaid: (saleId: string) => Promise<void>;
  markSaleRejected: (saleId: string) => Promise<void>;
  retrySale: (saleId: string, paymentMethod: PaymentMethod) => Promise<void>;
  changePaymentMethod: (
    saleId: string,
    paymentMethod: PaymentMethod,
  ) => Promise<void>;
  cancelSale: (saleId: string) => Promise<void>;
  recordCashPayment: (
    saleId: string,
    cashReceived: number,
    invoiceType?: InvoiceType,
    customer?: FiscalCustomer,
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
    catalogReady: true,
    cart: [],
    cartTotal: 0,
    cartDiscount: 0,
    queue: [],
    completedSales: [],
    invoices: [],
    isOffline: initialOfflineSetting,

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

        // 4. Cargar ventas completadas y comprobantes
        const completedSales = await getCompletedSales(biz, branch);
        const invoices = await getInvoices(biz, branch);

        // 5. Cargar estado de simulación offline persistido
        const isOffline = await getSetting("offlineMode", initialOfflineSetting);

        set({
          businessId: biz,
          branchId: branch,
          products: products.length > 0 ? products : seedProducts,
          productsMap: products.length > 0 ? productsMap : initialProductsMap,
          catalogReady: true,
          queue,
          completedSales,
          invoices,
          isOffline,
        });
      } catch (err) {
        console.warn("Aviso IndexedDB (operando en memoria):", err);
        set({
          businessId: biz,
          branchId: branch,
          products: seedProducts,
          productsMap: initialProductsMap,
          catalogReady: true,
        });
      }
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

        return { cart: newCart, cartTotal: recalcCartTotal(newCart) };
      });
    },

    removeFromCart: (lineKey) => {
      set((state) => {
        const newCart = state.cart.filter((i) => i.lineKey !== lineKey);
        return { cart: newCart, cartTotal: recalcCartTotal(newCart) };
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

        return { cart: newCart, cartTotal: recalcCartTotal(newCart) };
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
        return { cart: newCart, cartTotal: recalcCartTotal(newCart) };
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

        return { cart: newCart, cartTotal: recalcCartTotal(newCart) };
      });
    },

    setCartDiscount: (amount) => {
      set({ cartDiscount: Math.max(0, amount) });
    },

    clearCart: () => {
      set({ cart: [], cartTotal: 0, cartDiscount: 0 });
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
    ) => {
      const { cart, cartTotal, cartDiscount, businessId, branchId, isOffline } = get();
      if (cart.length === 0) throw new Error("El carrito está vacío");

      const timestamp = now();
      const total = Math.max(0, cartTotal - cartDiscount);

      const resolvedCustomer: FiscalCustomer =
        customer || (invoiceType === "FACTURA_B"
          ? { businessName: "Consumidor Final", taxCondition: "CONSUMIDOR_FINAL" }
          : { businessName: "Responsable Inscripto", taxCondition: "RESPONSABLE_INSCRIPTO" });

      const saleId = generateSaleId();

      const sale: Sale = {
        id: saleId,
        businessId,
        branchId,
        items: structuredClone(cart),
        status: "PENDIENTE_PAGO",
        paymentMethod,
        subtotal: cartTotal,
        discount: cartDiscount,
        total,
        notes,
        createdAt: timestamp,
        updatedAt: timestamp,
        invoiceType,
        customer: resolvedCustomer,
      };

      // 1. Vaciar carrito INMEDIATAMENTE (0 ms de bloqueo para el operador)
      set((state) => ({
        cart: [],
        cartTotal: 0,
        cartDiscount: 0,
        queue: [...state.queue, sale],
      }));

      // 2. Persistir en IndexedDB en segundo plano
      await putSale(sale);

      return sale;
    },

    markSalePaid: async (saleId) => {
      const timestamp = now();
      const { businessId, branchId, isOffline } = get();

      const existing = (await getSale(saleId)) || get().queue.find((s) => s.id === saleId);
      if (!existing) return;

      const invoiceType: InvoiceType = existing.invoiceType || "FACTURA_B";
      const invoiceNumber =
        existing.invoiceNumber ||
        (await getNextInvoiceNumber(businessId, branchId, invoiceType));

      const fiscalStatus: FiscalStatus = isOffline
        ? "PENDIENTE_ENVIO_ARCA"
        : "AUTORIZADO";
      const cae = fiscalStatus === "AUTORIZADO" ? generateCae() : undefined;
      const caeExpiresAt = fiscalStatus === "AUTORIZADO" ? calcCaeExpiresAt() : undefined;

      const customer: FiscalCustomer =
        existing.customer || (invoiceType === "FACTURA_B"
          ? { businessName: "Consumidor Final", taxCondition: "CONSUMIDOR_FINAL" }
          : { businessName: "Responsable Inscripto", taxCondition: "RESPONSABLE_INSCRIPTO" });

      const updatedSale: Sale = {
        ...existing,
        status: "PAGADA",
        invoiceType,
        invoiceNumber,
        fiscalStatus,
        cae,
        customer,
        updatedAt: timestamp,
        closedAt: timestamp,
      };

      // Crear comprobante fiscal
      const netAmount = invoiceType === "FACTURA_A" ? Number((updatedSale.total / 1.21).toFixed(2)) : updatedSale.total;
      const ivaAmount = invoiceType === "FACTURA_A" ? Number((updatedSale.total - netAmount).toFixed(2)) : 0;

      const invoice: Invoice = {
        id: generateInvoiceId(),
        saleId: updatedSale.id,
        invoiceType,
        invoiceNumber,
        businessId,
        branchId,
        items: structuredClone(updatedSale.items),
        subtotal: updatedSale.subtotal,
        discount: updatedSale.discount,
        total: updatedSale.total,
        netAmount,
        ivaAmount,
        paymentMethod: updatedSale.paymentMethod || "EFECTIVO",
        cashReceived: updatedSale.cashReceived,
        change: updatedSale.change,
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
        completedSales: [updatedSale, ...state.completedSales.filter((s) => s.id !== saleId)],
        invoices: [invoice, ...state.invoices.filter((i) => i.saleId !== saleId)],
      }));

      // Persistir en IndexedDB
      await putSale(updatedSale);
      await putInvoice(invoice);
    },

    markSaleRejected: async (saleId) => {
      const timestamp = now();
      set((state) => ({
        queue: state.queue.map((s) =>
          s.id === saleId
            ? { ...s, status: "PAGO_RECHAZADO" as SaleStatus, updatedAt: timestamp }
            : s,
        ),
      }));

      const existing = await getSale(saleId);
      if (existing) {
        await putSale({
          ...existing,
          status: "PAGO_RECHAZADO",
          updatedAt: timestamp,
        });
      }
    },

    retrySale: async (saleId, paymentMethod) => {
      const timestamp = now();
      set((state) => ({
        queue: state.queue.map((s) =>
          s.id === saleId
            ? {
                ...s,
                status: "PENDIENTE_PAGO" as SaleStatus,
                paymentMethod,
                updatedAt: timestamp,
              }
            : s,
        ),
      }));

      const existing = await getSale(saleId);
      if (existing) {
        await putSale({
          ...existing,
          status: "PENDIENTE_PAGO",
          paymentMethod,
          updatedAt: timestamp,
        });
      }
    },

    changePaymentMethod: async (saleId, paymentMethod) => {
      const timestamp = now();
      set((state) => ({
        queue: state.queue.map((s) =>
          s.id === saleId ? { ...s, paymentMethod, updatedAt: timestamp } : s,
        ),
      }));

      const existing = await getSale(saleId);
      if (existing) {
        await putSale({ ...existing, paymentMethod, updatedAt: timestamp });
      }
    },

    cancelSale: async (saleId) => {
      const timestamp = now();
      set((state) => ({
        queue: state.queue.filter((s) => s.id !== saleId),
      }));

      const existing = await getSale(saleId);
      if (existing) {
        await putSale({
          ...existing,
          status: "CANCELADA",
          updatedAt: timestamp,
          closedAt: timestamp,
        });
      }
    },

    recordCashPayment: async (
      saleId,
      cashReceived,
      invoiceType = "FACTURA_B",
      customer,
    ) => {
      const timestamp = now();
      const { businessId, branchId, isOffline } = get();

      const existing = (await getSale(saleId)) || get().queue.find((s) => s.id === saleId);
      if (!existing) return;

      const change = Math.max(0, cashReceived - existing.total);
      const invoiceNumber =
        existing.invoiceNumber ||
        (await getNextInvoiceNumber(businessId, branchId, invoiceType));

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

      const netAmount = invoiceType === "FACTURA_A" ? Number((updatedSale.total / 1.21).toFixed(2)) : updatedSale.total;
      const ivaAmount = invoiceType === "FACTURA_A" ? Number((updatedSale.total - netAmount).toFixed(2)) : 0;

      const invoice: Invoice = {
        id: generateInvoiceId(),
        saleId: updatedSale.id,
        invoiceType,
        invoiceNumber,
        businessId,
        branchId,
        items: structuredClone(updatedSale.items),
        subtotal: updatedSale.subtotal,
        discount: updatedSale.discount,
        total: updatedSale.total,
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
        completedSales: [updatedSale, ...state.completedSales.filter((s) => s.id !== saleId)],
        invoices: [invoice, ...state.invoices.filter((i) => i.saleId !== saleId)],
      }));

      await putSale(updatedSale);
      await putInvoice(invoice);
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
  })),
);

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
