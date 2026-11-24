# DECISIONES_ETAPA_1 — POS Kiosco (Complejo Termal / Multi-negocio)

## 1. Stack y Persistencia
- Frontend: React + TypeScript + Vite + Zustand.
- Persistencia offline: IndexedDB (catálogo, ventas/cola) + localStorage (preferencias UI).
- Multi-negocio: Incluir `businessId` y `branchId` en el modelo desde el inicio, manteniendo simplicidad sin sobreingeniería.

## 2. Productos, Modificadores y Combos
- Soportar ~100–200 productos (elaborados sin código de barras, bebidas, varios y combos).
- Modificadores con impacto en precio (`priceDelta`), ej. sándwich base ($10.000) con JyQ (+$2.000), tomate/lechuga (+$3.000), completa (+$5.000 = $15.000), y combos (sándwich + cono chico de papas + gaseosa).
- Mostrar modificadores en barra contextual ágil sin bloquear el flujo de venta.

## 3. Carrito y Agrupación
- Agrupar ítems con igual `productId` y mismos modificadores incrementando `qty`.
- Mantener el carrito compacto y dinámico con control rápido de cantidad y subtotal por fila.

## 4. Atajos de Teclado
- `F2`: Enfocar buscador/lector (sin disparar atajos de cantidad al tipear).
- `+` / `-`: Ajustar cantidad del ítem activo/último agregado (fuera de inputs de texto).
- `F8`: Abrir cobro del carrito activo.
- `F9`: Cobro rápido en efectivo.
- `Esc`: Cerrar panel/modal de cobro preservando el borrador.

## 5. Cola Lateral (`PENDIENTE_PAGO`)
- Al pasar una venta a `PENDIENTE_PAGO`, vaciar el carrito activo inmediatamente.
- Acciones por tarjeta en cola: `Reintentar / Cambiar pago`, `Marcar pagado [sim]`, `Simular rechazo [sim]`, `Cancelar`.

## 6. Pruebas y Pagos (Posnet / Mercado Pago)
- Incluir panel de pruebas (ocultable) para simular aprobaciones/rechazos en segundo plano durante la demo.
- Relevar modelo exacto de posnet/Point en el local y verificar credenciales/webhooks de Mercado Pago para automatización en etapas posteriores.

