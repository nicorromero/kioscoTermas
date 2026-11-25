# Playbook: cambios de UI y flujo de caja

Usalo para cambios en catálogo, carrito, modificadores, cobro, cola, facturación visible o vista móvil del dueño.

## Antes de editar

- Localizá la UI y las acciones del store relacionadas; revisá `src/types/pos.ts` si cambia el modelo.
- Definí el criterio observable: qué ve/hace el cajero y qué ocurre con carrito, venta, cola o factura.
- Confirmá si se trata de estado solo visual o de una operación que debe persistirse en IndexedDB.
- Conservá el flujo rápido para productos sin código de barras, modificadores con `priceDelta` y combos.

## Durante el cambio

- Preferí estado y acciones existentes; no dupliques reglas de negocio en componentes.
- Conservá la liberación del carrito al enviar una venta a la cola y la capacidad de continuar atendiendo mientras el pago queda pendiente.
- No cambies estados de venta, numeración ni facturación sin criterios de negocio explícitos.
- Mantené el foco útil para el mostrador y las guardas existentes de los atajos. No captures Ctrl/Cmd/Alt ni bloquees recarga, búsqueda o zoom del navegador.

## Verificación

1. Ejecutá `npm run typecheck` y `npm run build`; agregá `npm test` si se toca lógica o persistencia.
2. En navegador y con un perfil de prueba, comprobá según lo que afecte el cambio:
   - seleccionar/buscar productos y modificar cantidades, extras y subtotales;
   - F2, F8, F9, Esc y `+`/`-`, incluidos campos con foco y combinaciones del navegador;
   - enviar una venta a cobro: el carrito queda libre, la venta permanece visible en la cola y se puede simular aprobación/rechazo/cancelación si el flujo aplica;
   - recargar con F5 y confirmar que catálogo, cola y datos persistidos reaparecen sin duplicarse;
   - si cambia la contingencia: marcar offline, conservar comprobantes pendientes y comprobar el flujo de sincronización al volver online.
3. Informá qué escenarios probaste y cuáles no aplicaban. No uses datos operativos reales para simular casos destructivos.
