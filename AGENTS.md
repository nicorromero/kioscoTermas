# Guía operativa para agentes

## Reglas de oro

- Hacé cambios quirúrgicos: entendé el flujo antes de editar, respetá el alcance pedido y evitá refactors o features no solicitados.
- Conservá TypeScript estricto. No desactives checks ni agregues casts inseguros para silenciar errores.
- Respetá las capas existentes: `src/types/` para modelos, `src/db/` para persistencia, `src/store/` para estado y operaciones, `src/hooks/` para lógica reutilizable de React, `src/utils/` para funciones puras y `src/components/` para UI. Mantené los datos de catálogo en `src/data/`.
- Si cambiás persistencia, protegé los datos locales existentes. No borres bases, stores, ventas, cola, facturas ni settings como parte de una mejora de UI.
- Preservá el comportamiento de teclado y foco de caja: F2, F8, F9, Esc, `+`/`-` y las combinaciones del navegador. Evitá interceptar atajos del sistema o disparar acciones mientras se escribe en campos.
- No afirmes que IndexedDB sincroniza dispositivos ni que la primera carga funciona sin conexión. Consultá las limitaciones documentadas en el README.
- No agregues dependencias, tooling o capas de abstracción salvo que el cambio lo requiera y quede justificado.

## Forma de trabajo

1. Inspeccioná los componentes, store, tipos y persistencia implicados; revisá también `DECISIONES_ETAPA_1.md` y el README.
2. Acordá un criterio de aceptación breve. Pedí análisis/propuesta antes de implementar si hay decisiones de pagos/facturación, datos, offline, migraciones o interacción de teclado sin definir. En cambios claros y acotados, implementá directamente.
3. Cambiá solo lo necesario y mantené consistentes los call sites dependientes.
4. Revisá el diff y ejecutá las verificaciones adecuadas: `npm run typecheck`, `npm test` cuando afecte lógica cubierta o IndexedDB, y `npm run build`.
5. Si el flujo es visible, hacé además la comprobación manual de navegador del playbook de UI/caja; para persistencia, usá el playbook de IndexedDB.

Procedimientos ampliados: [flujo de trabajo](docs/agent-workflow.md) y [playbooks](docs/playbooks/).
