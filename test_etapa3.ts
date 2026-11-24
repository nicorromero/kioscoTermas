import "fake-indexeddb/auto";
import { usePosStore } from "./src/store/usePosStore";
import { db, getSetting, setSetting } from "./src/db/indexedDb";
import { isValidCuit, formatCuit, cleanCuit } from "./src/utils/cuit";
import type { SelectedModifier } from "./src/types/pos";

async function runEtapa3Tests() {
  console.log("=== INICIANDO VERIFICACIÓN SISTEMA POS + FACTURACIÓN B/A + OFFLINE + DUEÑO ===");

  // 1. Validar Algoritmo Oficial de CUIT (Módulo 11)
  console.log("\n1. Probando validación de CUIT argentino (ARCA)...");
  const validCuitEmpresa = "30-71123456-6"; // prefijo 30, dígito verificador 6
  const validCuitPersona = "20-34567890-6"; // prefijo 20, dígito verificador 6
  const invalidCuit = "30-71123456-9"; // dígito verificador erróneo

  if (!isValidCuit(validCuitEmpresa) || !isValidCuit(validCuitPersona)) {
    throw new Error(`CUIT válido rechazado incorrectamente`);
  }
  if (isValidCuit(invalidCuit)) {
    throw new Error(`CUIT inválido aceptado incorrectamente: ${invalidCuit}`);
  }
  console.log("✓ Validación de CUIT argentino 100% precisa.");

  // 2. Hidratación inicial desde IndexedDB
  console.log("\n2. Probando hidratación y carga de seed en IndexedDB...");
  await usePosStore.getState().hydrate("grupo-termal", "termas-kiosco");
  let state = usePosStore.getState();

  console.log(`- Catálogo listo: ${state.catalogReady}`);
  console.log(`- Productos: ${state.products.length}`);
  console.log(`- Comprobantes hidratados: ${state.invoices.length}`);
  console.log(`- Ventas cerradas hidratadas: ${state.completedSales.length}`);

  if (state.invoices.length === 0 || state.completedSales.length === 0) {
    throw new Error("No se hidrataron los comprobantes o ventas históricas de IndexedDB");
  }
  console.log("✓ Hidratación de catálogo, comprobantes y ventas verificada.");

  // 3. Probar persistencia del Modo Offline (F5 simulation)
  console.log("\n3. Probando persistencia del toggle Offline...");
  await usePosStore.getState().setOfflineMode(true);
  if (!usePosStore.getState().isOffline) {
    throw new Error("El estado en store no cambió a offline");
  }

  // Simular recarga (F5): re-hidratar
  await usePosStore.getState().hydrate("grupo-termal", "termas-kiosco");
  if (!usePosStore.getState().isOffline) {
    throw new Error("El estado offline no se conservó tras la re-hidratación (F5)");
  }
  console.log("✓ Modo offline persistido en IndexedDB tras recarga.");

  // 4. Emisión de venta durante corte de internet (Contingencia PENDIENTE_ENVIO_ARCA)
  console.log("\n4. Probando venta durante contingencia offline...");
  const mila = state.products.find((p) => p.id === "sand-milacarne")!;
  usePosStore.getState().addToCart(mila, []);

  // Enviar a cola con QR
  const offlineSale = await usePosStore.getState().submitSale("QR", "Mesa 12", "FACTURA_B");
  console.log(`- Venta creada en offline: ID=${offlineSale.id}, status=${offlineSale.status}`);

  // Simular cobro aprobado mientras sigue offline
  await usePosStore.getState().markSalePaid(offlineSale.id);

  // Verificar que el comprobante se haya generado como PENDIENTE_ENVIO_ARCA
  state = usePosStore.getState();
  const invoiceOffline = state.invoices.find((i) => i.saleId === offlineSale.id);
  console.log(`- Comprobante generado: N°=${invoiceOffline?.invoiceNumber}, fiscalStatus=${invoiceOffline?.fiscalStatus}`);
  if (!invoiceOffline || invoiceOffline.fiscalStatus !== "PENDIENTE_ENVIO_ARCA" || invoiceOffline.cae) {
    throw new Error("El comprobante en modo offline debió emitirse en contingencia (PENDIENTE_ENVIO_ARCA) sin CAE");
  }
  console.log("✓ Comprobante offline guardado en IndexedDB con estado PENDIENTE_ENVIO_ARCA.");

  // 5. Restablecer conexión y Sincronizar pendientes con ARCA
  console.log("\n5. Probando restablecimiento de conexión y sincronización con ARCA...");
  await usePosStore.getState().setOfflineMode(false);
  const syncedCount = await usePosStore.getState().syncPendingInvoices();
  console.log(`- Comprobantes sincronizados: ${syncedCount}`);
  if (syncedCount < 1) {
    throw new Error("No se sincronizó el comprobante pendiente");
  }

  state = usePosStore.getState();
  const syncedInvoice = state.invoices.find((i) => i.saleId === offlineSale.id)!;
  console.log(`- Comprobante post-sync: fiscalStatus=${syncedInvoice.fiscalStatus}, CAE=${syncedInvoice.cae}`);
  if (syncedInvoice.fiscalStatus !== "AUTORIZADO" || !syncedInvoice.cae || !syncedInvoice.syncedAt) {
    throw new Error("El comprobante no quedó debidamente autorizado con CAE tras la sincronización");
  }
  console.log("✓ Sincronización exitosa: Comprobante pasa a AUTORIZADO con CAE oficial.");

  // 6. Probar Efectivo Rápido (F9) con Factura B directa
  console.log("\n6. Probando Efectivo Rápido (F9) con Factura B y cálculo de vuelto...");
  usePosStore.getState().addToCart(mila, []);
  const quickSale = await usePosStore.getState().submitSale(
    "EFECTIVO",
    "Cobro Rápido",
    "FACTURA_B",
    { businessName: "Consumidor Final", taxCondition: "CONSUMIDOR_FINAL" },
    20000 // paga con 20.000 para total de 10.000
  );
  await usePosStore.getState().recordCashPayment(quickSale.id, 20000, "FACTURA_B");

  state = usePosStore.getState();
  const quickInvoice = state.invoices.find((i) => i.saleId === quickSale.id)!;
  console.log(`- Factura B emitida: N°=${quickInvoice.invoiceNumber}, total=${quickInvoice.total}, recibido=${quickInvoice.cashReceived}, vuelto=${quickInvoice.change}`);
  if (quickInvoice.change !== 10000 || quickInvoice.total !== 10000 || quickInvoice.paymentMethod !== "EFECTIVO") {
    throw new Error("Error en cálculo de vuelto o totales de Factura B en efectivo");
  }
  console.log("✓ Efectivo rápido F9 ejecutado con Factura B y vuelto exacto.");

  // 7. Probar Factura A con CUIT y discriminación de IVA 21%
  console.log("\n7. Probando Factura A con Responsable Inscripto...");
  usePosStore.getState().addToCart(mila, []);
  const facturaASale = await usePosStore.getState().submitSale(
    "TARJETA",
    "Pago Posnet",
    "FACTURA_A",
    {
      cuit: "30-71123456-6",
      businessName: "Termas del Litoral S.A.",
      taxCondition: "RESPONSABLE_INSCRIPTO",
    }
  );
  await usePosStore.getState().markSalePaid(facturaASale.id);

  state = usePosStore.getState();
  const facturaAInvoice = state.invoices.find((i) => i.saleId === facturaASale.id)!;
  console.log(`- Factura A emitida: N°=${facturaAInvoice.invoiceNumber}, total=${facturaAInvoice.total}`);
  console.log(`  Neto gravado=${facturaAInvoice.netAmount}, IVA 21%=${facturaAInvoice.ivaAmount}`);
  if (!facturaAInvoice.invoiceNumber.startsWith("A-") || !facturaAInvoice.ivaAmount || facturaAInvoice.ivaAmount <= 0) {
    throw new Error("Error en emisión de Factura A o discriminación de IVA");
  }
  console.log("✓ Factura A con IVA discriminado y CUIT verificada.");

  // 8. Verificación de Métricas en Vista Celular Dueño
  console.log("\n8. Probando cálculos de métricas para Celular Dueño...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySales = state.completedSales.filter((s) => s.status === "PAGADA" && s.createdAt >= today.toISOString());
  const totalRev = todaySales.reduce((sum, s) => sum + s.total, 0);
  console.log(`- Tickets cerrados hoy: ${todaySales.length}`);
  console.log(`- Recaudación total calculada: $${totalRev}`);
  if (todaySales.length < 3 || totalRev <= 0) {
    throw new Error("Métricas de ventas para el celular del dueño inconsistentes");
  }
  console.log("✓ Métricas para el dueño operando reactivamente.");

  console.log("\n=======================================================");
  console.log(" TODOS LOS REQUERIMIENTOS FUERON VERIFICADOS CON ÉXITO ");
  console.log("=======================================================\n");
}

runEtapa3Tests().catch((err) => {
  console.error("ERROR EN TEST:", err);
  process.exit(1);
});
