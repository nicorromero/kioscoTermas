# Flujo de trabajo con agentes

La meta es que una persona pueda avanzar con IA sin convertir cada cambio en un proceso pesado. Usá el ciclo completo para cambios de riesgo; para un ajuste pequeño, combiná los pasos y mantené el mismo criterio de cuidado.

## Ciclo de una tarea

1. **Inspeccionar:** ubicar el comportamiento, sus componentes, estado, tipos y persistencia; leer `DECISIONES_ETAPA_1.md` y el README cuando sean relevantes.
2. **Definir:** escribir el resultado observable, alcance y casos límite en pocas líneas. Señalar qué queda fuera.
3. **Implementar:** tocar la menor superficie posible; conservar patrones y contratos existentes.
4. **Revisar:** contrastar el diff con el pedido, buscar efectos sobre datos, foco/atajos, cola y consumidores de estado.
5. **Verificar:** ejecutar los comandos adecuados y, si cambia una interacción, probar la aplicación en navegador. Ver playbooks de [UI y caja](playbooks/feature-ui-y-caja.md), [IndexedDB](playbooks/indexeddb-y-migraciones.md) y [release](playbooks/release-y-despliegue.md).

## ¿Análisis primero o implementación?

Pedí **solo análisis/propuesta** antes de cambiar código cuando:

- el pedido deja sin definir una decisión visible de UX o una regla de cobro;
- afecta Factura A/B, estados fiscales, pagos reales o conciliación;
- requiere cambiar el esquema o transformar registros que ya existen;
- altera el comportamiento offline, la cola o la sincronización;
- cambia atajos, foco o una interacción cuyo riesgo operativo no está claro;
- hay varias opciones válidas con consecuencias distintas para datos o clientes.

Pedí **implementación** cuando el resultado esperado, alcance y comportamiento están definidos. Para un cambio rutinario, una descripción concreta con criterio de aceptación basta; no hace falta una fase formal de aprobación. Si el usuario pide únicamente investigar o proponer, no edites producción.

## Roles de trabajo

Son modos de atención, no puestos permanentes ni una obligación de usar agentes separados:

- **Arquitectura / planificación:** delimita el cambio, identifica dependencias y riesgos, y propone el menor diseño que resuelve el pedido.
- **Implementación frontend / estado:** realiza el cambio aprobado en las capas existentes y mantiene coherentes UI, store y tipos.
- **QA / revisión:** comprueba criterios de aceptación, diff y escenarios de regresión; puede ser una revisión separada para cambios de riesgo.
- **Ingeniería de prompts:** convierte pedidos ambiguos en contexto, límites, escenarios y resultado esperado. No es una etapa obligatoria para pedidos claros.

Dividí trabajo entre agentes solo cuando existan subtareas realmente independientes. Asigná una salida concreta y acotada; evitá que varios agentes editen los mismos archivos o que se delegue un único recorrido continuo del flujo.

## Verificación proporcional al riesgo

- Todo cambio TypeScript: `npm run typecheck` y `npm run build`.
- Lógica de producto, pagos simulados, cálculos o persistencia: sumar `npm test`.
- Interacción de caja o vistas: agregar verificación manual en navegador; los tests actuales no son una suite E2E.
- Esquema/migración: verificar registros anteriores y posteriores con pruebas de IndexedDB aisladas; no usar la base real del navegador como fixture.
- Release: seguir el playbook de [despliegue](playbooks/release-y-despliegue.md).

No declares una comprobación aprobada si no se ejecutó. Si el entorno impide una verificación, indicá cuál falta y qué riesgo deja pendiente.
