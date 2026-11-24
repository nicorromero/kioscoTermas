# POS Kiosco Termas

Sistema de Punto de Venta (POS) web de alto rendimiento y resiliencia offline para mostrador en complejos termales y multi-negocio.

Desarrollado con **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, **Zustand** e **IndexedDB (Dexie)**.

---

## 🚀 Arquitectura y Vistas Principales

1. **Caja Kiosco (3 Columnas)**
   - **Catálogo (~120 productos):** Sándwiches, milanesas, hamburguesas con modificadores de precio dinámicos, combos integrados, licuados con bases personalizables, bebidas y varios.
   - **Carrito Activo (`BORRADOR`):** Agrupación inteligente por producto y modificadores, edición rápida de cantidades y cálculo reactivo de subtotal/descuentos.
   - **Cola Lateral (`PENDIENTE_PAGO` / `PAGO_RECHAZADO`):** Despacho instantáneo (0 ms de bloqueo para el operador). Al enviar a cobro por QR o terminal, el carrito se libera de inmediato para atender al siguiente cliente mientras el pago se procesa en segundo plano.

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
