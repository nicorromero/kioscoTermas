# POS Kiosco Termas

Sistema de Punto de Venta (POS) web de alto rendimiento y resiliencia offline para mostrador en complejos termales y multi-negocio.

Desarrollado con **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, **Zustand** e **IndexedDB (Dexie)**.

---

## 🚀 Arquitectura y Vistas Principales

1. **Caja Kiosco (3 Columnas)**
   - **Catálogo (~120 productos):** Sándwiches, milanesas, hamburguesas con modificadores de precio dinámicos, combos integrados, licuados con bases personalizables, bebidas y varios.
   - **Carrito Activo (`BORRADOR`):** Agrupación inteligente por producto y modificadores, edición rápida de cantidades y cálculo reactivo de subtotal/descuentos.
   - **Cola Lateral (`PENDIENTE_PAGO` / `PAGO_RECHAZADO`):** Minimizada por defecto; un aviso general con contador permite abrirla ante rechazos. Al enviar a cobro por QR o terminal, el carrito se libera de inmediato para atender al siguiente cliente mientras el pago se procesa en segundo plano.
   - **Recuperación de pedidos:** Historial persistido de los últimos 3 pedidos enviados a cobrar, incluidos rechazados y cancelados. Se pueden recuperar como un nuevo borrador editable, conservando cantidades y extras.

2. **Facturación B/A + Offline**
   - Emisión de **Factura B** (Consumidor Final) y **Factura A** (Responsable Inscripto con validación matemática de CUIT ARCA mediante Módulo 11).
   - Modo de contingencia offline con almacenamiento local de comprobantes en estado `PENDIENTE_ENVIO_ARCA` y sincronización en un clic con CAE oficial al restablecer internet.
   - Previsualización e impresión de ticket fiscal térmico (80mm) y formato A4.

3. **Celular Dueño**
   - Dashboard reactivo optimizado para vista móvil (con marco simulado de smartphone o expandido).
   - Métricas en tiempo real: recaudación del día, tickets cobrados, ticket promedio, desglose por medio de pago (Efectivo, QR, Tarjeta) y registro cronológico de operaciones.

---

## ⚡ Atajos de Teclado de Mostrador

| Atajo | Función | Comportamiento |
| :--- | :--- | :--- |
| **`F2`** | Enfocar Buscador | Enfoca y selecciona el texto del input de búsqueda / lector de barras. |
| **`+`** / **`-`** | Cantidad | Modifica la cantidad del último ítem añadido al carrito (solo activo fuera de inputs). |
| **`F8`** | Cobro General | Abre el modal de checkout para seleccionar método (QR, Tarjeta, Efectivo) y tipo de factura. |
| **`F9`** | Efectivo Rápido | Abre el modal de pago en efectivo con Factura B y cálculo automático de vuelto. |
| **`Esc`** | Cerrar / Cancelar | Cierra modales, paneles contextuales o simuladores sin vaciar el carrito borrador. |

> *Nota: Todas las combinaciones del sistema y del navegador (`Ctrl + +`, `Ctrl + -`, `Ctrl + R`, etc.) se respetan y no son bloqueadas.*

---

## 🛠️ Ejecución Local y Verificación

### 1. Requisitos
- **Node.js**: v18.0.0 o superior (recomendado Node 20 LTS o 22 LTS).
- **npm** o **pnpm**.

### 2. Instalación de dependencias
```bash
npm install
```

### 3. Servidor de desarrollo
```bash
npm run dev
```
Accedé localmente en `http://localhost:3000`.

### 4. Verificación de tipos y suite de pruebas
```bash
# Comprobación de TypeScript
npm run typecheck

# Tests unitarios y de integración de IndexedDB + ARCA
npm test
```

### 5. Compilación para producción
```bash
npm run build
```
Genera la carpeta `dist/` lista para ser servida por cualquier hosting estático o CDN.

### 6. Actualización rápida de la demo
```bash
npm run ship:demo
```
Este preflight ejecuta verificación de TypeScript y build; no crea commits, no hace push y no modifica Git. Si termina correctamente, revisá `git status`, prepará los cambios con `git add`/`git commit` y hacé `git push` según el flujo del repositorio. Con el proyecto conectado a Vercel o Netlify, el push a la rama configurada dispara el despliegue. También podés usar `npm run release:check` para el mismo preflight.

El HTML se revalida al abrir o refrescar, mientras que los archivos de `/assets/` generados por Vite tienen nombres con hash y pueden quedar cacheados de forma inmutable. No se registra ningún Service Worker, por lo que la aplicación no queda fijada a un shell offline viejo. El `F5` descarga/revalida la interfaz según el hosting y carga nuevamente los datos persistidos.

### Persistencia local y actualizaciones
- Productos, ventas en cola (`PENDIENTE_PAGO` / `PAGO_RECHAZADO`), ventas cerradas, historial reciente de pedidos, comprobantes y settings operativos se guardan en IndexedDB bajo la base `KioscoTermasPOS`. Actualizar el código o presionar `F5` no borra esa base.
- El carrito borrador está solo en memoria: si se recarga la página antes de enviarlo, se pierde. Las ventas ya enviadas quedan persistidas.
- Agregar propiedades opcionales a tipos no modifica por sí solo el esquema de IndexedDB. Si se agregan índices, tablas o transformaciones de registros, incrementá `db.version(n)` y definí una migración Dexie no destructiva; nunca borres stores o datos de producción como parte de una actualización de UI.
- IndexedDB pertenece al origen exacto (protocolo, host y puerto) y al perfil del navegador. `localhost`, una IP de LAN y un dominio publicado usan bases separadas. En una terminal compartida, mantené un origen estable y el mismo navegador/perfil para conservar los datos.
- El modo sin internet conserva los datos y la cola en el dispositivo donde se generaron; IndexedDB no sincroniza entre equipos. Además, sin Service Worker no se garantiza abrir la aplicación por primera vez sin conexión. En hosting web usá HTTPS; para LAN, publicá `dist/` en un servidor local estable y accedé siempre por la misma URL.

---

## 🌐 Despliegue en Vercel o Netlify

El proyecto cuenta con las directivas de reescritura SPA necesarias para evitar errores `404` al recargar rutas directas (`F5`).

### Opción A: Despliegue en Vercel (Recomendado)
1. Subí el código a un repositorio en GitHub.
2. Ingresá a [Vercel](https://vercel.com/) e importá el repositorio.
3. Vercel detectará automáticamente Vite:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. El archivo [`vercel.json`](file:///home/nicor/Escritorio/Codigo/kioscoTermas/vercel.json) en la raíz se encargará de las reescrituras SPA.
5. Hacé clic en **Deploy**.

### Opción B: Despliegue en Netlify
1. Conectá tu repositorio de GitHub en [Netlify](https://www.netlify.com/).
2. Configurá los parámetros de construcción:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. El archivo [`public/_redirects`](file:///home/nicor/Escritorio/Codigo/kioscoTermas/public/_redirects) se copiará automáticamente a `dist/_redirects` gestionando el enrutamiento SPA.
4. Hacé clic en **Deploy site**.

---

## 📦 Inicialización y Persistencia en Navegador Limpio

Al ingresar a la aplicación por primera vez (ej. en la terminal del jefe o nuevo cajero):
1. Se inicializa automáticamente el contexto:
   - `businessId: "grupo-termal"`
   - `branchId: "termas-kiosco"`
2. Se siembran automáticamente los **123 productos del catálogo** con sus modificadores y combos en IndexedDB sin duplicación en recargas sucesivas (`F5`).
3. Se cargan comprobantes históricos de referencia para que el panel de **Facturación** y **Celular Dueño** muestren métricas y estado en tiempo real de forma inmediata.
