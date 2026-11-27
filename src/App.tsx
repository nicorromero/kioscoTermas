import React, { useEffect, useRef, useState, useCallback } from "react";
import { usePosStore } from "./store/usePosStore";
import { usePosShortcuts } from "./hooks/usePosShortcuts";
import type {
  Product,
  SelectedModifier,
  PaymentMethod,
  InvoiceType,
  FiscalCustomer,
} from "./types/pos";

import {
  Header,
  type PosColorTheme,
  type PosDemoView,
} from "./components/Header";
import { CatalogColumn } from "./components/CatalogColumn";
import { CartColumn } from "./components/CartColumn";
import { QueueColumn } from "./components/QueueColumn";
import { PaymentModal } from "./components/PaymentModal";
import { QuickCashModal } from "./components/QuickCashModal";
import { SimulationPanel } from "./components/SimulationPanel";
import { BillingOfflineView } from "./components/BillingOfflineView";
import { OwnerMobileView } from "./components/OwnerMobileView";
import { CashShiftManager } from "./components/CashShiftManager";

function readColorThemePreference(): PosColorTheme {
  try {
    return window.localStorage.getItem("kioscoTermas:theme") === "arena"
      ? "arena"
      : "dark";
  } catch (error) {
    console.error("No se pudo leer la preferencia de tema.", error);
    return "dark";
  }
}

export function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Navegación "Modo Demo" (3 Vistas) ──
  const [activeView, setActiveView] = useState<PosDemoView>("caja");
  const [colorTheme, setColorTheme] =
    useState<PosColorTheme>(readColorThemePreference);

  // ── Store State & Actions ──
  const hydrate = usePosStore((s) => s.hydrate);
  const products = usePosStore((s) => s.products);
  const productsMap = usePosStore((s) => s.productsMap);
  const catalogReady = usePosStore((s) => s.catalogReady);
  const cart = usePosStore((s) => s.cart);
  const cartTotal = usePosStore((s) => s.cartTotal);
  const cartDiscount = usePosStore((s) => s.cartDiscount);
  const selectedLineKey = usePosStore((s) => s.selectedLineKey);
  const queue = usePosStore((s) => s.queue);
  const paymentHistory = usePosStore((s) => s.paymentHistory);

  const addToCartStore = usePosStore((s) => s.addToCart);
  const selectCartLine = usePosStore((s) => s.selectCartLine);
  const removeFromCart = usePosStore((s) => s.removeFromCart);
  const updateQty = usePosStore((s) => s.updateQty);
  const changeModifiers = usePosStore((s) => s.changeModifiers);
  const clearCart = usePosStore((s) => s.clearCart);
  const setCartDiscount = usePosStore((s) => s.setCartDiscount);
  const toggleFavorite = usePosStore((s) => s.toggleFavorite);

  const submitSaleStore = usePosStore((s) => s.submitSale);
  const markSalePaid = usePosStore((s) => s.markSalePaid);
  const markSaleRejected = usePosStore((s) => s.markSaleRejected);
  const retrySale = usePosStore((s) => s.retrySale);
  const cancelSale = usePosStore((s) => s.cancelSale);
  const recoverSaleToCart = usePosStore((s) => s.recoverSaleToCart);
  const recordCashPayment = usePosStore((s) => s.recordCashPayment);

  // ── Estado UI Local ──
  const [configuringProduct, setConfiguringProduct] = useState<Product | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isQuickCashModalOpen, setIsQuickCashModalOpen] = useState(false);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [isCashShiftDialogOpen, setIsCashShiftDialogOpen] = useState(false);
  const [drawerTargetProduct, setDrawerTargetProduct] = useState<Product | null>(null);
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);

  const rejectedCount = queue.filter(
    (sale) => sale.status === "PAGO_RECHAZADO",
  ).length;

  // Inicialización (IndexedDB hydrate)
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.dataset.theme = colorTheme;
    try {
      window.localStorage.setItem("kioscoTermas:theme", colorTheme);
    } catch (error) {
      console.error("No se pudo guardar la preferencia de tema.", error);
    }
  }, [colorTheme]);

  // Manejadores del Drawer de Productos
  const handleOpenNewProduct = useCallback(() => {
    setDrawerTargetProduct(null);
    setIsProductDrawerOpen(true);
  }, []);

  const handleEditProduct = useCallback((product: Product) => {
    setDrawerTargetProduct(product);
    setIsProductDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsProductDrawerOpen(false);
    setDrawerTargetProduct(null);
  }, []);

  // Wrapper simple: el store activa la línea añadida para los atajos +/-.
  const handleAddToCart = useCallback(
    (product: Product, modifiers: SelectedModifier[] = []) => {
      addToCartStore(product, modifiers);
    },
    [addToCartStore]
  );

  const handleUpdateQty = useCallback(
    (lineKey: string, delta: number) => {
      updateQty(lineKey, delta);
    },
    [updateQty]
  );

  const handleRecoverSale = useCallback(
    (saleId: string) => {
      const sale = paymentHistory.find((entry) => entry.id === saleId);
      if (!sale) return;

      if (
        cart.length > 0 &&
        !window.confirm(
          "El carrito actual tiene productos. ¿Querés reemplazarlo por este pedido recuperado?",
        )
      ) {
        return;
      }

      recoverSaleToCart(saleId);
    },
    [cart.length, paymentHistory, recoverSaleToCart]
  );

  const handleOpenRejectedQueue = useCallback(() => {
    setActiveView("caja");
    setIsQueueExpanded(true);
  }, []);

  const handleCashShiftDialogChange = useCallback((isOpen: boolean) => {
    setIsCashShiftDialogOpen(isOpen);
  }, []);

  // Atajos: +/- sobre la línea seleccionada (o la última como fallback).
  const handleIncrementLastItem = useCallback(() => {
    if (cart.length === 0 || isPaymentModalOpen || isQuickCashModalOpen || isProductDrawerOpen || configuringProduct !== null) return;
    const targetKey =
      selectedLineKey && cart.some((i) => i.lineKey === selectedLineKey)
        ? selectedLineKey
        : cart[cart.length - 1].lineKey;
    handleUpdateQty(targetKey, 1);
  }, [cart, selectedLineKey, handleUpdateQty, isPaymentModalOpen, isQuickCashModalOpen, isProductDrawerOpen, configuringProduct]);

  const handleDecrementLastItem = useCallback(() => {
    if (cart.length === 0 || isPaymentModalOpen || isQuickCashModalOpen || isProductDrawerOpen || configuringProduct !== null) return;
    const targetKey =
      selectedLineKey && cart.some((i) => i.lineKey === selectedLineKey)
        ? selectedLineKey
        : cart[cart.length - 1].lineKey;
    handleUpdateQty(targetKey, -1);
  }, [cart, selectedLineKey, handleUpdateQty, isPaymentModalOpen, isQuickCashModalOpen, isProductDrawerOpen, configuringProduct]);

  // Atajo Esc: Cierra modales/paneles sin tocar el carrito
  const handleEscape = useCallback(() => {
    if (isProductDrawerOpen) {
      setIsProductDrawerOpen(false);
      setDrawerTargetProduct(null);
      return;
    }
    if (isPaymentModalOpen) {
      setIsPaymentModalOpen(false);
      return;
    }
    if (isQuickCashModalOpen) {
      setIsQuickCashModalOpen(false);
      return;
    }
    if (configuringProduct) {
      setConfiguringProduct(null);
      return;
    }
    if (isSimulationOpen) {
      setIsSimulationOpen(false);
      return;
    }
  }, [isProductDrawerOpen, isPaymentModalOpen, isQuickCashModalOpen, configuringProduct, isSimulationOpen]);

  // Atajo F8: Abrir cobro normal (QR, Tarjeta, Efectivo)
  const handleOpenCheckout = useCallback(() => {
    if (cart.length === 0 || isPaymentModalOpen || isQuickCashModalOpen || isProductDrawerOpen || configuringProduct !== null) return;
    setIsPaymentModalOpen(true);
  }, [cart.length, isPaymentModalOpen, isQuickCashModalOpen, isProductDrawerOpen, configuringProduct]);

  // Atajo F9: Efectivo Rápido (Factura B + vuelto instantáneo)
  const handleQuickCash = useCallback(() => {
    if (cart.length === 0 || isPaymentModalOpen || isQuickCashModalOpen || isProductDrawerOpen || configuringProduct !== null) return;
    setIsQuickCashModalOpen(true);
  }, [cart.length, isPaymentModalOpen, isQuickCashModalOpen, isProductDrawerOpen, configuringProduct]);

  // Registro de atajos de teclado (deshabilitados fuera de la vista Caja o con Drawer abierto)
  usePosShortcuts({
    searchInputRef,
    onOpenCheckout: handleOpenCheckout,
    onQuickCash: handleQuickCash,
    onEscape: handleEscape,
    onIncrementLastItem: handleIncrementLastItem,
    onDecrementLastItem: handleDecrementLastItem,
    disabled: activeView !== "caja" || isProductDrawerOpen || isCashShiftDialogOpen,
  });

  // Finalizar cobro desde el modal general (F8)
  const handleSubmitSale = async (
    method: PaymentMethod,
    notes?: string,
    cashReceived?: number,
    invoiceType: InvoiceType = "FACTURA_B",
    customer?: FiscalCustomer
  ) => {
    const sale = await submitSaleStore(
      method,
      notes,
      invoiceType,
      customer,
      cashReceived
    );
    // Si fue en efectivo con dinero recibido, liquidar y emitir factura inmediatamente
    if (method === "EFECTIVO" && cashReceived !== undefined) {
      await recordCashPayment(sale.id, cashReceived, invoiceType, customer);
    }
  };

  // Confirmar cobro rápido en efectivo (F9)
  const handleConfirmQuickCash = async (
    cashReceived: number,
    invoiceType: InvoiceType = "FACTURA_B",
    customer?: FiscalCustomer
  ) => {
    const sale = await submitSaleStore(
      "EFECTIVO",
      "Cobro Rápido Mostrador",
      invoiceType,
      customer,
      cashReceived
    );
    await recordCashPayment(sale.id, cashReceived, invoiceType, customer);
  };

  if (!catalogReady) {
    return (
      <div
        data-theme={colorTheme}
        className="h-full flex items-center justify-center bg-slate-950 text-white font-mono gap-3"
      >
        <span className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        <span>Iniciando Catálogo e IndexedDB...</span>
      </div>
    );
  }

  return (
    <div
      data-theme={colorTheme}
      className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans"
    >
      {/* ── Barra Superior ("Modo Demo" con Selector de 3 Vistas) ── */}
      <Header
        activeView={activeView}
        onSelectView={setActiveView}
        onToggleSimulation={() => setIsSimulationOpen(!isSimulationOpen)}
        simulationOpen={isSimulationOpen}
        queuedCount={queue.length}
        colorTheme={colorTheme}
        onToggleColorTheme={() =>
          setColorTheme((currentTheme) =>
            currentTheme === "arena" ? "dark" : "arena"
          )
        }
      />

      {rejectedCount > 0 && (
        <div
          role="alert"
          className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-rose-950 border-b border-rose-800 text-rose-100"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
            <p className="text-xs sm:text-sm font-medium">
              {rejectedCount} {rejectedCount === 1 ? "pago rechazado" : "pagos rechazados"} necesita
              {rejectedCount === 1 ? "" : "n"} atención.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenRejectedQueue}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold transition-colors"
          >
            Abrir y resolver cola
          </button>
        </div>
      )}

      {activeView === "caja" && (
        <CashShiftManager onDialogChange={handleCashShiftDialogChange} />
      )}

      {/* ── Vista 1: Caja Kiosco (3 Columnas) ── */}
      {activeView === "caja" && (
        <main className="flex-1 flex overflow-hidden">
          {/* Columna 1: Catálogo (~55%) */}
          <CatalogColumn
            products={products}
            searchInputRef={searchInputRef}
            onAddToCart={handleAddToCart}
            onToggleFavorite={toggleFavorite}
            configuringProduct={configuringProduct}
            setConfiguringProduct={setConfiguringProduct}
            isProductDrawerOpen={isProductDrawerOpen}
            drawerTargetProduct={drawerTargetProduct}
            onOpenNewProduct={handleOpenNewProduct}
            onEditProduct={handleEditProduct}
            onCloseProductDrawer={handleCloseDrawer}
          />

          {/* Columna 2: Carrito Activo (~25%) */}
          <CartColumn
            cart={cart}
            cartTotal={cartTotal}
            cartDiscount={cartDiscount}
            selectedLineKey={selectedLineKey}
            productsMap={productsMap}
            onSelectLine={selectCartLine}
            onUpdateQty={handleUpdateQty}
            onRemoveItem={removeFromCart}
            onClearCart={clearCart}
            onSetDiscount={setCartDiscount}
            onOpenCheckout={handleOpenCheckout}
            onQuickCash={handleQuickCash}
            onChangeModifiers={changeModifiers}
          />

          {/* Columna 3: Cola Lateral (~20%) */}
          <QueueColumn
            queue={queue}
            paymentHistory={paymentHistory}
            isExpanded={isQueueExpanded}
            onToggleExpanded={() =>
              setIsQueueExpanded((expanded) => !expanded)
            }
            onRecover={handleRecoverSale}
            onMarkPaid={markSalePaid}
            onMarkRejected={markSaleRejected}
            onRetry={retrySale}
            onCancel={cancelSale}
          />
        </main>
      )}

      {/* ── Vista 2: Facturación B/A + Offline ── */}
      {activeView === "facturacion" && <BillingOfflineView />}

      {/* ── Vista 3: Celular Dueño ── */}
      {activeView === "dueno" && <OwnerMobileView />}

      {/* ── Modal de Cobro General (F8) ── */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        cartTotal={cartTotal}
        cartDiscount={cartDiscount}
        itemCount={cart.reduce((sum, i) => sum + i.qty, 0)}
        onSubmitSale={handleSubmitSale}
      />

      {/* ── Modal de Efectivo Rápido (F9) ── */}
      <QuickCashModal
        isOpen={isQuickCashModalOpen}
        onClose={() => setIsQuickCashModalOpen(false)}
        cartTotal={cartTotal}
        cartDiscount={cartDiscount}
        itemCount={cart.reduce((sum, i) => sum + i.qty, 0)}
        onConfirmQuickCash={handleConfirmQuickCash}
      />

      {/* ── Panel Flotante de Simulación QR / Webhooks ── */}
      <SimulationPanel
        isOpen={isSimulationOpen}
        onClose={() => setIsSimulationOpen(false)}
        queue={queue}
        onMarkPaid={markSalePaid}
        onMarkRejected={markSaleRejected}
      />
    </div>
  );
}

export default App;
