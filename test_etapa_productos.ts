// ─── Test Suite: Fase 1+ (Alta, Edición y Duplicación de Productos) ───────────
import "fake-indexeddb/auto";
import { usePosStore } from "./src/store/usePosStore";
import { db, isBarcodeAvailable, putProduct, deleteProduct } from "./src/db/indexedDb";
import {
  generateProductId,
  generateShortName,
  normalizeBarcode,
  cloneProductData,
  PRESET_SANDWICH_EXTRAS,
  PRESET_LICUADOS,
  PRESET_COCCION,
  PRESET_CAFE_SIZE,
} from "./src/utils/productUtils";
import type { ProductFormData, SelectedModifier } from "./src/types/pos";

async function runProductTests() {
  console.log("=== INICIANDO VERIFICACIÓN FASE 1+: PRODUCTOS & DRAWER EXPRESS ===");

  const BIZ = "grupo-termal";
  const BRANCH = "termas-kiosco";

  // 0. Probar helpers puros (abreviación, slug, normalización de barcode)
  console.log("\n0. Probando helpers puros de productos...");
  const short1 = generateShortName("Sándwich de Milanesa Completa");
  console.log(`- generateShortName("Sándwich de Milanesa Completa") -> "${short1}"`);
  if (!short1.includes("Sand") || !short1.includes("Mila") || !short1.includes("Compl")) {
    throw new Error(`Abreviación térmica incorrecta: ${short1}`);
  }

  const short2 = generateShortName("Hamburguesa Doble con Gaseosa");
  console.log(`- generateShortName("Hamburguesa Doble con Gaseosa") -> "${short2}"`);
  if (!short2.includes("Hamb") || !short2.includes("Gas")) {
    throw new Error(`Abreviación térmica incorrecta: ${short2}`);
  }

  const slug = generateProductId("Sandwiches", "Milanesa Napolitana con Fritas");
  console.log(`- generateProductId("Sandwiches", "Milanesa Napolitana con Fritas") -> "${slug}"`);
  if (!slug.startsWith("sand-") || slug.includes(" ") || slug.includes("ñ")) {
    throw new Error(`Slug de producto incorrecto: ${slug}`);
  }

  const rawBarcode = "  \t7791234567890 \r\n ";
  const cleanedBarcode = normalizeBarcode(rawBarcode);
  console.log(`- normalizeBarcode("${rawBarcode.trim()}") -> "${cleanedBarcode}"`);
  if (cleanedBarcode !== "7791234567890") {
    throw new Error(`Normalización de código de barras falló: "${cleanedBarcode}"`);
  }
  console.log("✓ Helpers puros validados exitosamente.");

  // Hidratar store
  await usePosStore.getState().hydrate(BIZ, BRANCH);
  const initialProductsCount = usePosStore.getState().products.length;
  console.log(`- Catálogo hidratado con ${initialProductsCount} productos iniciales.`);

  // 1. Alta de un nuevo producto con modificadores y persistencia en IndexedDB
  console.log("\n1. Probando Alta de nuevo producto con modificadores y persistencia en Dexie...");
  const newProductData: ProductFormData = {
    name: "Sándwich de Matambre Especial",
    shortName: generateShortName("Sándwich de Matambre Especial"),
    category: "Sandwiches",
    basePrice: 14500,
    barcode: "7798888888888",
    modifiers: [...PRESET_SANDWICH_EXTRAS],
    isFavorite: true,
    colorTag: "#10B981",
  };

  const createdProduct = await usePosStore.getState().upsertProduct(newProductData);
  console.log(`- Producto creado: ID=${createdProduct.id}, Nombre="${createdProduct.name}", Precio=$${createdProduct.basePrice}`);

  // Verificar en store reactivo (memoria O(1))
  const stateAfterCreate = usePosStore.getState();
  if (stateAfterCreate.products.length !== initialProductsCount + 1) {
    throw new Error("El producto no fue agregado al arreglo products en memoria");
  }
  const inMap = stateAfterCreate.productsMap.get(createdProduct.id);
  if (!inMap || inMap.name !== newProductData.name || inMap.basePrice !== 14500) {
    throw new Error("El producto no se actualizó síncronamente en productsMap O(1)");
  }
  if (!inMap.modifiers || inMap.modifiers.length !== PRESET_SANDWICH_EXTRAS.length) {
    throw new Error("Los modificadores no fueron persistidos correctamente en memoria");
  }

  // Verificar en IndexedDB física
  const inDb = await db.products.get(createdProduct.id);
  if (!inDb || inDb.name !== newProductData.name || inDb.basePrice !== 14500) {
    throw new Error("El producto no fue persistido en IndexedDB (Dexie)");
  }
  console.log("✓ Alta de producto y persistencia en Dexie + Store validada.");

  // 2. Modificación de precio base y comprobación en memoria y Dexie
  console.log("\n2. Probando Modificación de precio base de un producto...");
  const updatedData: ProductFormData = {
    ...createdProduct,
    basePrice: 16500,
  };
  const updatedProduct = await usePosStore.getState().upsertProduct(updatedData, createdProduct.id);
  console.log(`- Producto modificado: ID=${updatedProduct.id}, Nuevo Precio=$${updatedProduct.basePrice}`);

  if (updatedProduct.basePrice !== 16500) {
    throw new Error("Precio retornado por upsertProduct no coincide");
  }
  if (usePosStore.getState().productsMap.get(createdProduct.id)?.basePrice !== 16500) {
    throw new Error("Precio en productsMap en memoria no se actualizó a 16500");
  }
  const dbUpdated = await db.products.get(createdProduct.id);
  if (dbUpdated?.basePrice !== 16500) {
    throw new Error("Precio en IndexedDB no se actualizó a 16500");
  }
  console.log("✓ Modificación de precio sincronizada en memoria y Dexie.");

  // 3. Clonación / duplicación de un producto
  console.log("\n3. Probando Duplicación / Clonación profunda de un producto...");
  const duplicatedProduct = await usePosStore.getState().duplicateProduct(createdProduct.id);
  console.log(`- Producto duplicado: ID=${duplicatedProduct.id}, Nombre="${duplicatedProduct.name}", Barcode=${duplicatedProduct.barcode}`);

  if (duplicatedProduct.id === createdProduct.id) {
    throw new Error("El ID del producto duplicado debe ser diferente al original");
  }
  if (!duplicatedProduct.name.includes("(Copia)")) {
    throw new Error(`El nombre duplicado debe incluir "(Copia)": "${duplicatedProduct.name}"`);
  }
  if (duplicatedProduct.barcode !== undefined) {
    throw new Error("El código de barras del clon debe ser reseteado a undefined para evitar colisiones");
  }
  if (duplicatedProduct.basePrice !== 16500) {
    throw new Error("El producto duplicado no conservó el precio del original");
  }
  if (duplicatedProduct.modifiers?.length !== createdProduct.modifiers?.length) {
    throw new Error("El producto duplicado no conservó la lista profunda de modificadores");
  }

  // Verificar en IndexedDB
  const dbDup = await db.products.get(duplicatedProduct.id);
  if (!dbDup) {
    throw new Error("El producto duplicado no fue guardado en IndexedDB");
  }
  console.log("✓ Duplicación de producto con reset de código de barras y preservación de extras validada.");

  // 4. Prevención de código de barras duplicado
  console.log("\n4. Probando Prevención de código de barras duplicado...");
  const isAvailableSelf = await isBarcodeAvailable(BIZ, BRANCH, "7798888888888", createdProduct.id);
  console.log(`- isBarcodeAvailable para el mismo producto ID: ${isAvailableSelf} (esperado true)`);
  if (!isAvailableSelf) {
    throw new Error("El producto no pudo reusar su propio código de barras durante edición");
  }

  const isAvailableCollision = await isBarcodeAvailable(BIZ, BRANCH, "7798888888888", duplicatedProduct.id);
  console.log(`- isBarcodeAvailable para otro producto ID: ${isAvailableCollision} (esperado false)`);
  if (isAvailableCollision) {
    throw new Error("isBarcodeAvailable debió detectar colisión con el código existente");
  }

  const isAvailableFree = await isBarcodeAvailable(BIZ, BRANCH, "7799999999999");
  console.log(`- isBarcodeAvailable para código libre: ${isAvailableFree} (esperado true)`);
  if (!isAvailableFree) {
    throw new Error("isBarcodeAvailable rechazó un código de barras que no existe");
  }
  console.log("✓ Validación de unicidad de código de barras verificada.");

  // 5. Garantía de Integridad: Ventas existentes en cola y carrito no se corrompen al editar/eliminar el producto
  console.log("\n5. Probando Garantía de Integridad: Carrito y Cola intactos ante edición y eliminación de catálogo...");

  // Añadir el producto actualizado (16.500) al carrito con modificador (+ Jamón y Queso: 16.500 + 2.000 = 18.500)
  const modJyQ: SelectedModifier = { modifierId: "mod-jyq", name: "+ Jamón y Queso", priceDelta: 2000 };
  usePosStore.getState().addToCart(updatedProduct, [modJyQ]);

  // Enviar a cola de cobro
  const saleInQueue = await usePosStore.getState().submitSale("QR", "Mesa 99");
  console.log(`- Venta enviada a cola: ID=${saleInQueue.id}, Total=$${saleInQueue.total}`);
  if (saleInQueue.total !== 18500) {
    throw new Error(`Total esperado 18.500, obtenido ${saleInQueue.total}`);
  }

  // Ahora agregar otro ítem al carrito BORRADOR activo
  usePosStore.getState().addToCart(updatedProduct, []);
  let cart = usePosStore.getState().cart;
  console.log(`- Carrito activo: ${cart.length} item, unitFinalPrice=$${cart[0].unitFinalPrice}`);
  if (cart[0].unitFinalPrice !== 16500) {
    throw new Error("Precio unitario en carrito incorrecto");
  }

  // Ahora MODIFICAR drásticamente el producto en el catálogo: precio a $80.000 y nombre "Matambre Hipercaro"
  await usePosStore.getState().upsertProduct(
    {
      ...createdProduct,
      name: "Matambre Hipercaro Modificado",
      basePrice: 80000,
    },
    createdProduct.id
  );
  console.log("- Producto modificado drásticamente a $80.000 en el catálogo.");

  // Comprobar que la venta en cola sigue teniendo 18.500
  const queueSaleAfterEdit = usePosStore.getState().queue.find((s) => s.id === saleInQueue.id);
  if (!queueSaleAfterEdit || queueSaleAfterEdit.total !== 18500) {
    throw new Error("¡CORRUPCIÓN DE INTEGRIDAD! La venta en cola cambió su total al editar el catálogo");
  }

  // Comprobar que el ítem en carrito conserva su snapshot original de 16.500
  cart = usePosStore.getState().cart;
  if (cart[0].unitFinalPrice !== 16500 || cart[0].subtotal !== 16500) {
    throw new Error("¡CORRUPCIÓN DE INTEGRIDAD! El carrito en curso cambió su precio al editar el catálogo");
  }

  // Ahora ELIMINAR el producto original del catálogo
  console.log("- Eliminando el producto del catálogo...");
  await usePosStore.getState().removeProduct(createdProduct.id);
  if (usePosStore.getState().productsMap.has(createdProduct.id)) {
    throw new Error("El producto no fue removido del catálogo");
  }
  const dbRemoved = await db.products.get(createdProduct.id);
  if (dbRemoved) {
    throw new Error("El producto eliminado sigue existiendo en Dexie");
  }

  // Comprobar que la venta en cola y el carrito SIGUEN VIVOS e inalterados
  const queueSaleAfterDelete = usePosStore.getState().queue.find((s) => s.id === saleInQueue.id);
  if (!queueSaleAfterDelete || queueSaleAfterDelete.total !== 18500) {
    throw new Error("¡CORRUPCIÓN DE INTEGRIDAD! La venta en cola se perdió o corrompió al eliminar el producto");
  }
  cart = usePosStore.getState().cart;
  if (cart.length !== 1 || cart[0].subtotal !== 16500) {
    throw new Error("¡CORRUPCIÓN DE INTEGRIDAD! El carrito se vació o alteró al eliminar el producto del catálogo");
  }

  // Liquidar la venta de la cola para verificar que se cierra perfectamente
  await usePosStore.getState().markSalePaid(saleInQueue.id);
  const completedSale = usePosStore.getState().completedSales.find((s) => s.id === saleInQueue.id);
  if (!completedSale || completedSale.status !== "PAGADA") {
    throw new Error("La venta en cola no pudo completarse normalmente");
  }

  console.log("✓ Garantía de integridad 100% verificada: Catálogo desacoplado de ventas y carritos activos.");

  console.log("\n=======================================================");
  console.log(" TODOS LOS TESTS DE FASE 1+ PASARON SATISFACTORIAMENTE ");
  console.log("=======================================================");
}

runProductTests().catch((err) => {
  console.error("FATAL ERROR EN TESTS DE PRODUCTOS:", err);
  process.exit(1);
});
