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
  /** Si true, el producto se prepara antes de entregar al cliente. */
  requiresPrep?: boolean;
  /** Estación donde se prepara el producto elaborado. */
  prepStation?: "COCINA" | "BARRA";
}

/** Datos del formulario para alta y edición rápida de productos */
export interface ProductFormData {
  id?: string;
  name: string;
  shortName?: string;
  category: ProductCategory;
  basePrice: number;
  barcode?: string;
  isCombo?: boolean;
  comboIncludes?: ComboInclude[];
  modifiers?: ModifierOption[];
  isFavorite?: boolean;
  colorTag?: string;
  requiresPrep?: boolean;
  prepStation?: "COCINA" | "BARRA";
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
  /** Turno al que se atribuye la venta; opcional para registros previos a caja. */
  shiftId?: string;
  /** Turno donde finalmente se confirmó un pago pendiente de un turno cerrado. */
  settledInShiftId?: string;
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
  /** Momento del cobro exitoso; se conserva aunque luego se anule la venta. */
  paidAt?: string; // ISO 8601
  cancelledAt?: string; // ISO 8601
  cancelledBy?: string;
  cancellationReason?: string;

  // Datos fiscales asociados
  invoiceType?: InvoiceType;
  invoiceNumber?: string;
  fiscalStatus?: FiscalStatus;
  cae?: string;
  customer?: FiscalCustomer;
  /** Cuenta QR concreta que recibió el cobro pendiente o confirmado. */
  qrAccountId?: string;
  qrAccountLabel?: string;
  /** Operador que realizó el cobro. */
  operatedBy?: string;
  /** Llamador asignado cuando la venta contiene preparación. */
  buzzerNumber?: string;
}

export interface QrAccountConfig {
  id: string;
  label: string;
  enabled: boolean;
  businessId: string;
  branchId: string;
}

export type PrintTarget =
  | "TICKET_PRINTER_1"
  | "TICKET_PRINTER_2"
  | "KITCHEN_PRINTER";

export type PrintJobKind = "CUSTOMER_TICKET" | "KITCHEN_COMANDA";
export type PrintJobStatus = "QUEUED" | "PRINTING" | "PRINTED" | "FAILED";

export interface PrintJob {
  id: string;
  saleId: string;
  ticketNumber: string;
  buzzerNumber?: string;
  kind: PrintJobKind;
  target: PrintTarget;
  status: PrintJobStatus;
  payload: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BuzzerState {
  number: string;
  saleId: string;
  ticketNumber: string;
  assignedAt: string;
  releasedAt?: string;
}

/* ── Caja ──────────────────────────────────────────────────────────────────── */

export type CashShiftStatus = "OPEN" | "CLOSED";

export interface CashShift {
  id: string;
  /** Correlativo único por negocio y sucursal. */
  shiftNumber: string;
  businessId: string;
  branchId: string;
  openedBy: string;
  openedAt: string; // ISO 8601
  openingCash: number;
  movements: CashMovement[];
  status: CashShiftStatus;
  closedAt?: string; // ISO 8601
  closedBy?: string;
  closeSummary?: CashCloseSummary;
  /** Identificador mantenido para compatibilidad con cierres previos. */
  closeSummaryId?: string;
}

export type CashMovementType = "WITHDRAWAL" | "CASH_IN" | "EXPENSE";

export interface CashMovement {
  id: string;
  shiftId: string;
  businessId: string;
  branchId: string;
  type: CashMovementType;
  /** Importe positivo; el signo se deriva de `type`. */
  amount: number;
  reason: string;
  createdBy: string;
  /** Nombre previo conservado para registros y clientes existentes. */
  performedBy?: string;
  authorizedBy?: string;
  createdAt: string; // ISO 8601
  /** Se informa para retiros que devuelven efectivo de una venta cobrada. */
  relatedSaleId?: string;
}

export type CashAmountsByPaymentMethod = Record<PaymentMethod, number>;
export type NonCashPaymentMethod = Exclude<PaymentMethod, "EFECTIVO">;
export type CashDifferenceStatus = "SURPLUS" | "SHORTAGE" | "EXACT";
export type ShiftApprovalStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "OBSERVED";

export interface PosnetReconciliationItem {
  id: string;
  /** Alias visible (ej. "Posnet Mostrador" o "QR"). */
  label: string;
  /** Lote o comprobante, si está disponible. */
  reference?: string;
  systemAmount: number;
  declaredAmount: number;
}

export interface CashCloseSummary {
  id: string;
  shiftId: string;
  businessId: string;
  branchId: string;
  closedAt: string; // ISO 8601
  closedBy: string;
  salesCountPaid: number;
  salesCountCancelled: number;
  totalCancelledAmount: number;
  totalsByPayment: CashAmountsByPaymentMethod;
  /** Desglose conciliable de cobros QR por cuenta. */
  totalsByQrAccount?: Record<string, number>;
  openingCash: number;
  cashInTotal: number;
  withdrawalsTotal: number;
  expensesTotal: number;
  expectedCash: number;
  declaredCash: number;
  cashDifference: number;
  posnetItems: PosnetReconciliationItem[];
  reconciliationPending: boolean;
  approvalStatus: ShiftApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  latePaymentsCount: number;
  latePaymentsAmount: number;

  /** Alias históricos conservados para consumidores existentes. */
  paidSaleCount: number;
  cancelledSaleCount: number;
  cancelledPaidCount: number;
  cancelledUnpaidCount: number;
  collectedByPaymentMethod: CashAmountsByPaymentMethod;
  cancelledGrossAmount: number;
  cancelledPaidGrossAmount: number;
  cancelledUnpaidGrossAmount: number;
  withdrawalTotal: number;
  expenseTotal: number;
  cashDifferenceStatus: CashDifferenceStatus;
  declaredNonCash?: Partial<Record<NonCashPaymentMethod, number>>;
  reconciledNonCash?: Partial<Record<NonCashPaymentMethod, number>>;
  nonCashDifference?: Partial<Record<NonCashPaymentMethod, number>>;
  observations?: string;
}
