// ─── Tipos POS – Kiosco Termas ───────────────────────────────────────────────
// Preparado para multi-negocio (businessId / branchId) sin sobreingeniería.
// Sin módulo de pulseras: Medios activos = EFECTIVO | QR | TARJETA.

/* ── Modificadores ─────────────────────────────────────────────────────────── */

export interface ModifierOption {
  /** Identificador único del modificador */
  id: string;
  /** Nombre visible (ej: "+ Jamón y Queso") */
  name: string;
  /** Diferencia de precio respecto al base. 0 = sin costo extra */
  priceDelta: number;
  /** Grupo lógico (ej: "extras", "base-licuado"). Permite agrupar en la UI */
  group?: string;
  /**
   * Si true, seleccionar este modificador deselecciona los demás del mismo
   * grupo (ej: "Con Agua" vs "Con Leche").
   */
  exclusive?: boolean;
}

/* ── Producto ──────────────────────────────────────────────────────────────── */

export type ProductCategory =
  | "Sandwiches"
  | "Licuados"
  | "Bebidas"
  | "Combos"
  | "Varios";

export interface ComboInclude {
  /** productId referenciado */
  productId: string;
  /** Cantidad incluida en el combo */
  qty: number;
  /** Etiqueta corta para la UI (ej: "Gaseosa 500 ml") */
  label: string;
}

export interface Product {
  id: string;
  businessId: string;
  branchId: string;
  name: string;
  /** Nombre corto para botones / tickets (ej: "Milanga") */
  shortName?: string;
  category: ProductCategory;
  /** Precio base en pesos (sin modificadores) */
  basePrice: number;
  /** Código de barras / EAN opcional */
  barcode?: string;
  /** ¿Es un combo? */
  isCombo?: boolean;
  /** Productos que incluye un combo */
  comboIncludes?: ComboInclude[];
  /** Modificadores disponibles para este producto */
  modifiers?: ModifierOption[];
  /** Marcado como favorito para acceso rápido */
  isFavorite?: boolean;
  /** Color de etiqueta para la UI (hex o nombre CSS) */
  colorTag?: string;
}

/* ── Carrito ───────────────────────────────────────────────────────────────── */

export interface SelectedModifier {
  modifierId: string;
  name: string;
  priceDelta: number;
}

export interface CartItem {
  /** Clave única de línea (productId + hash de modifiers para diferenciar) */
  lineKey: string;
  productId: string;
  name: string;
  /** Precio base unitario (sin modificadores) */
  unitBasePrice: number;
  /** Modificadores elegidos por el usuario */
  selectedModifiers: SelectedModifier[];
  /** Precio unitario final = base + Σ priceDelta */
  unitFinalPrice: number;
  qty: number;
  /** subtotal = unitFinalPrice × qty */
  subtotal: number;
}

/* ── Comprobantes Fiscales & Datos de Facturación ───────────────────────────── */

export type InvoiceType = "FACTURA_B" | "FACTURA_A";

export type FiscalStatus = "AUTORIZADO" | "PENDIENTE_ENVIO_ARCA";

export interface FiscalCustomer {
  cuit?: string;
  businessName?: string;
  taxCondition?: "RESPONSABLE_INSCRIPTO" | "CONSUMIDOR_FINAL" | "MONOTRIBUTO" | "EXENTO";
  address?: string;
}

export interface Invoice {
  id: string;
  saleId: string;
  invoiceType: InvoiceType;
  invoiceNumber: string; // ej: B-0001-00000042 o A-0001-00000015
  businessId: string;
  branchId: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  netAmount: number; // Para Factura A: total / 1.21
  ivaAmount: number; // Para Factura A: total - netAmount (21%)
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  customer: FiscalCustomer;
  fiscalStatus: FiscalStatus;
  cae?: string;
  caeExpiresAt?: string;
  createdAt: string; // ISO 8601
  syncedAt?: string; // ISO 8601
}

/* ── Venta ─────────────────────────────────────────────────────────────────── */

export type SaleStatus =
  | "BORRADOR"
  | "PENDIENTE_PAGO"
  | "PAGADA"
  | "PAGO_RECHAZADO"
  | "CANCELADA";

// Medios activos según especificación: Efectivo, QR y Tarjeta (SIN PULSERA)
export type PaymentMethod = "EFECTIVO" | "QR" | "TARJETA";

export interface Sale {
  id: string;
  businessId: string;
  branchId: string;
  items: CartItem[];
  status: SaleStatus;
  paymentMethod?: PaymentMethod;
  /** Suma de subtotales */
  subtotal: number;
  /** Descuento global aplicado (valor absoluto) */
  discount: number;
  /** Total a cobrar = subtotal − discount */
  total: number;
  /** Monto recibido (útil para efectivo) */
  cashReceived?: number;
  /** Vuelto calculado */
  change?: number;
  /** Notas libres del operador */
  notes?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  closedAt?: string; // ISO 8601

  // Datos fiscales asociados
  invoiceType?: InvoiceType;
  invoiceNumber?: string;
  fiscalStatus?: FiscalStatus;
  cae?: string;
  customer?: FiscalCustomer;
}
