# Playbook: release y despliegue

## Preflight

1. Revisá `git status` y el diff; confirmá que solo se publiquen cambios intencionales.
2. Ejecutá `npm run release:check` (typecheck y build). Ejecutá `npm test` cuando se haya tocado lógica cubierta o persistencia.
3. Confirmá que `dist/` se genera correctamente y que la configuración SPA del hosting sigue presente (`vercel.json` o `public/_redirects`, según el proveedor).
4. Revisá cambios en IndexedDB con el playbook de [migraciones](indexeddb-y-migraciones.md). No limpies ni recrees la base real para “probar” un release.
5. Publicá usando el flujo configurado para el proyecto. El preflight `npm run ship:demo` no crea commits, no hace push y no despliega.

## Datos locales y origen

- Un despliegue que conserva el mismo origen no borra IndexedDB por sí solo; un dominio, protocolo, host o puerto diferente usa otra base.
- Los datos están ligados al navegador/perfil y dispositivo. No se sincronizan entre equipos automáticamente.
- Preview y producción son orígenes distintos: no uses datos de uno como evidencia de persistencia del otro.
- Sin Service Worker, no se garantiza que la aplicación pueda abrirse por primera vez sin conexión. Un sitio web desplegado necesita HTTPS; en LAN usá una URL de servidor local estable.
- No pidas al usuario que borre datos del sitio como paso de actualización. Para pruebas con navegador limpio o datos de ejemplo, usá un perfil aislado.

## Comprobación posterior

- Abrí la URL canónica prevista y comprobá carga de la aplicación y navegación SPA, incluida una recarga F5.
- Confirmá que el catálogo aparece y que datos persistidos esperados siguen accesibles en el mismo origen/perfil.
- Si cambió caja, probá un recorrido corto de venta/cola; si cambió contingencia, revisá los pendientes online/offline.
- Observá errores visibles de carga o consola relevantes. Si falla algo, detené la promoción/avisá el bloqueo; no declares exitoso el despliegue por el solo hecho de que el build pasó.
