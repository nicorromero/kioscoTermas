import "fake-indexeddb/auto";
import { usePosStore } from "./src/store/usePosStore";
import { db } from "./src/db/indexedDb";
import { seedProducts } from "./src/data/seedProducts";
import type { SelectedModifier } from "./src/types/pos";

async function runTests() {
  console.log("=== INICIANDO VERIFICACIÓN EXPERTA ETAPA 2 ===");

  // 1. Hidratación & Seed
  console.log("\n1. Probando hidratación y seed en IndexedDB...");
  await usePosStore.getState().hydrate("grupo-termal", "termas-kiosco");
  const state = usePosStore.getState();
  console.log(`- Catálogo listo: ${state.catalogReady}`);
  console.log(`- Total productos cargados en store: ${state.products.length}`);
  if (state.products.length !== seedProducts.length) {
    throw new Error(`Mismatch en cantidad de productos: esperado ${seedProducts.length}, obtenido ${state.products.length}`);
  }
  console.log("✓ Catálogo hidratado correctamente desde IndexedDB.");

  // 2. Carrito (BORRADOR): Adición, modificadores y cálculo de precios
  console.log("\n2. Probando Carrito (BORRADOR)...");
  const mila = state.products.find(p => p.id === "sand-milacarne")!;
  const modJyQ: SelectedModifier = { modifierId: "mod-jyq", name: "+ Jamón y Queso", priceDelta: 2000 };
  const modTyL: SelectedModifier = { modifierId: "mod-tyl", name: "+ Tomate y Lechuga", priceDelta: 3000 };

  // Agregar mila base (10.000)
  usePosStore.getState().addToCart(mila, []);
  // Agregar mila con JyQ (10.000 + 2.000 = 12.000)
  usePosStore.getState().addToCart(mila, [modJyQ]);
  // Agregar de nuevo mila con JyQ para verificar incremento de qty en misma lineKey
  usePosStore.getState().addToCart(mila, [modJyQ]);

  let cart = usePosStore.getState().cart;
  console.log(`- Líneas en carrito: ${cart.length} (esperado 2)`);
  if (cart.length !== 2) throw new Error("Fallo en agrupación de items por lineKey");

  const itemBase = cart.find(i => i.selectedModifiers.length === 0)!;
  const itemJyQ = cart.find(i => i.selectedModifiers.length === 1)!;
  console.log(`- Item Base: qty=${itemBase.qty}, unitFinalPrice=${itemBase.unitFinalPrice}, subtotal=${itemBase.subtotal}`);
  console.log(`- Item JyQ: qty=${itemJyQ.qty}, unitFinalPrice=${itemJyQ.unitFinalPrice}, subtotal=${itemJyQ.subtotal}`);

  if (itemJyQ.qty !== 2 || itemJyQ.unitFinalPrice !== 12000 || itemJyQ.subtotal !== 24000) {
    throw new Error("Cálculo incorrecto de precio/subtotal con modificadores");
  }
  console.log(`- Total Carrito: ${usePosStore.getState().cartTotal} (esperado 34.000)`);
  if (usePosStore.getState().cartTotal !== 34000) throw new Error("Total incorrecto de carrito");

  // Probar updateQty (+ / -)
  usePosStore.getState().updateQty(itemBase.lineKey, 1); // pasa a 2
  console.log(`- Item Base tras +1 qty: ${usePosStore.getState().cart.find(i => i.lineKey === itemBase.lineKey)?.qty} (esperado 2)`);
  usePosStore.getState().updateQty(itemBase.lineKey, -2); // pasa a 0 -> se elimina
  cart = usePosStore.getState().cart;
  console.log(`- Carrito tras remover Item Base por qty <= 0: ${cart.length} líneas restantes`);
  if (cart.length !== 1) throw new Error("Fallo al eliminar item con qty <= 0");

  // Probar límite del descuento manual
  usePosStore.getState().setCartDiscount(999999);
  if (usePosStore.getState().cartDiscount !== usePosStore.getState().cartTotal) {
    throw new Error("El descuento debe quedar limitado al subtotal");
  }
  usePosStore.getState().setCartDiscount(0);

  // Probar changeModifiers (cambiar JyQ por TyL: 10.000 + 3.000 = 13.000)
  usePosStore.getState().changeModifiers(itemJyQ.lineKey, mila, [modTyL]);
  const itemModified = usePosStore.getState().cart[0];
  console.log(`- Item modificado: lineKey=${itemModified.lineKey}, unitFinalPrice=${itemModified.unitFinalPrice}, subtotal=${itemModified.subtotal}`);
  if (itemModified.unitFinalPrice !== 13000 || itemModified.subtotal !== 26000) {
    throw new Error("Fallo en changeModifiers");
  }
  usePosStore.getState().setQty(itemModified.lineKey, 20);
  console.log("✓ Carrito y modificadores funcionan al 100%.");

  // 3. Envío de Venta a PENDIENTE_PAGO (0 ms vaciado de carrito)
  console.log("\n3. Probando envío de venta y vaciado instantáneo del carrito...");
  let insufficientRejected = false;
  try {
    await usePosStore.getState().submitSale("EFECTIVO", "Monto insuficiente", "FACTURA_B", undefined, 1);
  } catch (err) {
    insufficientRejected = err instanceof Error &&
      err.message === "El monto recibido no cubre el total";
  }
  if (!insufficientRejected || usePosStore.getState().cart.length === 0) {
    throw new Error("El efectivo insuficiente debe rechazarse sin vaciar el carrito");
  }

  const salePromise = usePosStore.getState().submitSale("QR", "Mesa 4");
  
  // En el mismo tick síncrono, verificamos que el carrito esté inmediatamente vacío
  const immediateCart = usePosStore.getState().cart;
  const immediateQueue = usePosStore.getState().queue;
  console.log(`- Carrito síncrono post-submit: longitud=${immediateCart.length}`);
  console.log(`- Cola síncrona post-submit: longitud=${immediateQueue.length}`);
  if (immediateCart.length !== 0 || immediateQueue.length !== 1) {
    throw new Error("El carrito no se vació síncronamente al enviar a PENDIENTE_PAGO");
  }

  const sale = await salePromise;
  console.log(`- Venta creada: ID=${sale.id}, status=${sale.status}, total=${sale.total}`);
  console.log("✓ Submit de venta y vaciado 0ms validado.");

  // 4. Transiciones de Cola: PAGO_RECHAZADO -> RETRY -> PAGADA
  console.log("\n4. Probando transiciones en la cola...");
  
  // Simular rechazo
  await usePosStore.getState().markSaleRejected(sale.id);
  let saleInQueue = usePosStore.getState().queue.find(s => s.id === sale.id)!;
  console.log(`- Estado tras rechazo: ${saleInQueue.status} (esperado PAGO_RECHAZADO)`);
  if (saleInQueue.status !== "PAGO_RECHAZADO") throw new Error("Fallo al marcar rechazo");

  const rejectedHistoryEntry = usePosStore
    .getState()
    .paymentHistory.find((entry) => entry.id === sale.id);
  if (
    rejectedHistoryEntry?.status !== "PAGO_RECHAZADO" ||
    rejectedHistoryEntry.items[0]?.qty !== 20 ||
    rejectedHistoryEntry.items[0]?.selectedModifiers[0]?.modifierId !==
      modTyL.modifierId
  ) {
    throw new Error("El historial no conservó el pedido rechazado y sus extras");
  }

  // Simular F5: rehidratar el historial persistido y recuperar como otro borrador.
  await usePosStore.getState().hydrate("grupo-termal", "termas-kiosco");
  const persistedHistoryEntry = usePosStore
    .getState()
    .paymentHistory.find((entry) => entry.id === sale.id);
  if (persistedHistoryEntry?.status !== "PAGO_RECHAZADO") {
    throw new Error("El historial rechazado no persistió tras la re-hidratación");
  }

  const recoveredDraftId = usePosStore.getState().recoverSaleToCart(sale.id);
  const recoveredItem = usePosStore.getState().cart[0];
  if (
    !recoveredDraftId ||
    recoveredDraftId === sale.id ||
    recoveredItem?.qty !== 20 ||
    recoveredItem.selectedModifiers[0]?.modifierId !== modTyL.modifierId
  ) {
    throw new Error("La recuperación no creó un borrador independiente con extras");
  }
  usePosStore.getState().setQty(recoveredItem.lineKey, 15);
  if (usePosStore.getState().cart[0]?.qty !== 15) {
    throw new Error("El pedido recuperado no quedó editable");
  }

  const recoveredSale = await usePosStore.getState().submitSale("QR");
  if (recoveredSale.id !== recoveredDraftId || recoveredSale.id === sale.id) {
    throw new Error("El pedido recuperado sobrescribió su registro histórico");
  }
  await usePosStore.getState().cancelSale(recoveredSale.id);
  if (
    usePosStore.getState().paymentHistory.find(
      (entry) => entry.id === recoveredSale.id,
    )?.status !== "CANCELADA"
  ) {
    throw new Error("La cancelación eliminó el pedido del historial");
  }

  // Reintentar con otro método (TARJETA)
  await usePosStore.getState().retrySale(sale.id, "TARJETA");
  saleInQueue = usePosStore.getState().queue.find(s => s.id === sale.id)!;
  console.log(`- Estado tras reintento: ${saleInQueue.status}, método=${saleInQueue.paymentMethod}`);
  if (saleInQueue.status !== "PENDIENTE_PAGO" || saleInQueue.paymentMethod !== "TARJETA") {
    throw new Error("Fallo al reintentar venta");
  }

  // Marcar pagada
  await usePosStore.getState().markSalePaid(sale.id);
  const queueAfterPaid = usePosStore.getState().queue;
  console.log(`- Cola tras marcar pagada: longitud=${queueAfterPaid.length} (esperado 0)`);
  if (queueAfterPaid.length !== 0) throw new Error("La venta pagada no salió de la cola activa");

  // Verificar persistencia en DB
  const saleFromDb = await db.sales.get(sale.id);
  console.log(`- Venta persistida en DB: status=${saleFromDb?.status}, closedAt=${saleFromDb?.closedAt}`);
  if (saleFromDb?.status !== "PAGADA" || !saleFromDb.closedAt) {
    throw new Error("Fallo en persistencia de venta pagada en IndexedDB");
  }
  console.log("✓ Transiciones de cola y persistencia en DB validadas.");

  // 5. Cobro en efectivo con vuelto
  console.log("\n5. Probando cobro rápido en efectivo con cálculo de vuelto...");
  usePosStore.getState().addToCart(mila, []); // 10.000
  const cashSale = await usePosStore.getState().submitSale("EFECTIVO");
  let insufficientCashRejected = false;
  try {
    await usePosStore.getState().recordCashPayment(cashSale.id, 5000);
  } catch (err) {
    insufficientCashRejected = err instanceof Error &&
      err.message === "El monto recibido no cubre el total";
  }
  if (!insufficientCashRejected) {
    throw new Error("Cobro insuficiente debe rechazarse");
  }

  await usePosStore.getState().recordCashPayment(cashSale.id, 15000); // paga con 15.000
  
  const cashSaleDb = await db.sales.get(cashSale.id);
  console.log(`- Venta en efectivo DB: total=${cashSaleDb?.total}, cashReceived=${cashSaleDb?.cashReceived}, change=${cashSaleDb?.change}`);
  if (cashSaleDb?.change !== 5000 || cashSaleDb?.status !== "PAGADA") {
    throw new Error("Cálculo incorrecto de vuelto o estado");
  }
  console.log("✓ Cobro en efectivo verificado con éxito.");

  // El historial se mantiene acotado a los tres pedidos enviados más recientes.
  const recentSales: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    usePosStore.getState().addToCart(mila);
    const recentSale = await usePosStore.getState().submitSale("QR");
    recentSales.push(recentSale.id);
    await usePosStore.getState().cancelSale(recentSale.id);
  }
  const persistedHistory = await db.paymentHistory
    .where("[businessId+branchId]")
    .equals(["grupo-termal", "termas-kiosco"])
    .toArray();
  if (
    persistedHistory.length !== 3 ||
    persistedHistory.some((entry) => entry.status !== "CANCELADA") ||
    persistedHistory.some((entry) => entry.id === recentSales[0])
  ) {
    throw new Error("El historial persistido no está limitado a los últimos 3 pedidos");
  }

  console.log("\n=============================================");
  console.log(" TODOS LOS TESTS PASARON SATISFACTORIAMENTE ");
  console.log("=============================================");
}

runTests().catch(err => {
  console.error("ERROR EN TEST:", err);
  process.exit(1);
});
