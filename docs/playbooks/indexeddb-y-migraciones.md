# Playbook: IndexedDB y migraciones

La base Dexie `KioscoTermasPOS` contiene datos operativos locales. Una actualización de código no debe convertir una mejora funcional en pérdida de ventas, cola, facturas o configuración.

## Clasificá el cambio

- Agregar una propiedad opcional y compatible al modelo no cambia por sí solo el esquema ni requiere una versión Dexie nueva.
- Agregar/quitar un store o índice, o transformar registros existentes, sí requiere una nueva versión en `src/db/indexedDb.ts` y una migración cuando corresponda.
- Antes de migrar, revisá cómo leen y escriben esos datos `src/store/` y los componentes; mantén compatibles los registros existentes durante el cambio.

## Implementá de forma segura

1. No reutilices ni edites versiones históricas; agregá un número de versión nuevo y explícito.
2. Usá las migraciones de Dexie para transformar datos dentro del upgrade, de manera idempotente cuando sea posible.
3. No elimines stores, registros ni campos con información de negocio por conveniencia. Una migración destructiva requiere requisito explícito, plan de recuperación y confirmación aparte.
4. Conservá el alcance por `businessId` y `branchId` cuando aplique.
5. No limpies el almacenamiento del navegador como parte de pruebas o instrucciones de actualización.

## Pruebas y recuperación

- Agregá o adapta una prueba aislada con `fake-indexeddb` que abra una base con datos de la versión anterior y compruebe el resultado tras actualizar.
- Comprueba datos existentes y nuevos, índices/consultas afectados y `npm test`; luego ejecuta `npm run typecheck` y `npm run build`.
- Antes de cambios de alto riesgo sobre un dispositivo con datos reales, define una forma de respaldo y recuperación verificable. No asumas que existe una función de exportación si el producto no la ofrece.
- Valida en un perfil de navegador de prueba. `localhost`, una IP, preview y producción son orígenes diferentes y pueden tener bases distintas.

Si el comportamiento esperado de registros antiguos no está definido, detené la implementación y pedí una decisión/análisis antes de migrar.
