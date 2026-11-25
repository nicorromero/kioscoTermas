import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { ClipboardCopy, Download, Printer, X } from "lucide-react";
import type {
  CashAmountsByPaymentMethod,
  CashCloseSummary,
  CashMovement,
  CashMovementType,
  CashShift,
  PosnetReconciliationItem,
  Sale,
} from "../types/pos";
import { calculatePosnetDifference } from "../utils/cashShiftUtils";
import { formatCurrency } from "../utils/format";

type PaperWidth = "58" | "80";
type ExportFormat = "txt" | "json";

interface TicketMovement {
  type: CashMovementType;
  typeLabel: string;
  reason: string;
  createdBy: string;
  authorizedBy: string | null;
  amount: number;
  createdAt: string;
}

interface TicketSale {
  id: string;
  statusLabel: string;
  paymentMethod: string;
  amount: number;
  timestamp: string;
  isLatePayment: boolean;
}

interface TicketReconciliationItem extends PosnetReconciliationItem {
  difference: number;
}

export interface CashCloseTicketData {
  businessId: string;
  branchId: string;
  shiftNumber: string;
  openedAt: string;
  closedAt: string;
  openedBy: string;
  closedBy: string;
  openingCash: number;
  movementTotals: Record<CashMovementType, number>;
  movements: TicketMovement[];
  paidSalesCount: number;
  cancelledSalesCount: number;
  cancelledPaidCount: number;
  cancelledUnpaidCount: number;
  cancelledTotal: number;
  latePaymentsCount: number;
  latePaymentsAmount: number;
  sales: TicketSale[];
  totalsByPayment: CashAmountsByPaymentMethod;
  expectedCash: number;
  declaredCash: number;
  cashDifference: number;
  cashDifferenceStatus: CashCloseSummary["cashDifferenceStatus"];
  reconciliationPending: boolean;
  posnetItems: TicketReconciliationItem[];
  approvalStatus: CashCloseSummary["approvalStatus"];
  approvedBy: string | null;
  approvedAt: string | null;
  closeNotes: string | null;
  approvalNote: string | null;
}

const MOVEMENT_LABELS: Record<CashMovementType, string> = {
  CASH_IN: "Ingreso",
  WITHDRAWAL: "Retiro",
  EXPENSE: "Gasto menor",
};

const APPROVAL_LABELS: Record<CashCloseSummary["approvalStatus"], string> = {
  NOT_REQUIRED: "No requerida",
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  OBSERVED: "Observada",
};

const DIFFERENCE_LABELS: Record<CashCloseSummary["cashDifferenceStatus"], string> = {
  SURPLUS: "Sobrante",
  SHORTAGE: "Faltante",
  EXACT: "Exacto",
};

function isPaid(sale: Sale): boolean {
  return sale.status === "PAGADA" ||
    (sale.status === "CANCELADA" && sale.paidAt !== undefined);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function buildCashCloseTicketData(
  shift: CashShift,
  summary: CashCloseSummary,
  allSales: Sale[],
): CashCloseTicketData {
  const relevantSales = allSales.filter(
    (sale) => sale.shiftId === shift.id || sale.settledInShiftId === shift.id,
  );
  const ticketSales = relevantSales.filter(
    (sale) => sale.status === "PAGADA" || sale.status === "CANCELADA",
  );

  const movementTotals: Record<CashMovementType, number> = {
    CASH_IN: 0,
    WITHDRAWAL: 0,
    EXPENSE: 0,
  };
  for (const movement of shift.movements) {
    movementTotals[movement.type] += movement.amount;
  }

  const sales: TicketSale[] = ticketSales.map((sale) => {
    const paid = isPaid(sale);
    const isLatePayment =
      sale.settledInShiftId === shift.id && sale.shiftId !== shift.id && paid;
    const statusLabel = isLatePayment
      ? "Pago tardío imputado"
      : sale.status === "CANCELADA"
        ? paid ? "Anulada (cobrada)" : "Anulada (sin cobro)"
        : "Pagada";
    return {
      id: sale.id,
      statusLabel,
      paymentMethod: sale.paymentMethod ?? "—",
      amount: sale.total,
      timestamp: sale.paidAt ?? sale.cancelledAt ?? sale.updatedAt ?? sale.createdAt,
      isLatePayment,
    };
  });

  const posnetItems = summary.posnetItems.map((item) => ({
    ...item,
    difference: calculatePosnetDifference(item),
  }));

  return {
    businessId: shift.businessId,
    branchId: shift.branchId,
    shiftNumber: shift.shiftNumber,
    openedAt: shift.openedAt,
    closedAt: summary.closedAt || shift.closedAt || "",
    openedBy: shift.openedBy,
    closedBy: summary.closedBy || shift.closedBy || "",
    openingCash: summary.openingCash,
    movementTotals,
    movements: shift.movements.map((movement: CashMovement) => ({
      type: movement.type,
      typeLabel: MOVEMENT_LABELS[movement.type],
      reason: movement.reason,
      createdBy: movement.createdBy,
      authorizedBy: movement.authorizedBy ?? null,
      amount: movement.amount,
      createdAt: movement.createdAt,
    })),
    paidSalesCount: summary.salesCountPaid,
    cancelledSalesCount: summary.salesCountCancelled,
    cancelledPaidCount: summary.cancelledPaidCount,
    cancelledUnpaidCount: summary.cancelledUnpaidCount,
    cancelledTotal: summary.totalCancelledAmount,
    latePaymentsCount: summary.latePaymentsCount,
    latePaymentsAmount: summary.latePaymentsAmount,
    sales,
    totalsByPayment: { ...summary.totalsByPayment },
    expectedCash: summary.expectedCash,
    declaredCash: summary.declaredCash,
    cashDifference: summary.cashDifference,
    cashDifferenceStatus: summary.cashDifferenceStatus,
    reconciliationPending: summary.reconciliationPending,
    posnetItems,
    approvalStatus: summary.approvalStatus,
    approvedBy: summary.approvedBy ?? null,
    approvedAt: summary.approvedAt ?? null,
    closeNotes: summary.notes ?? null,
    approvalNote: summary.observations ?? null,
  };
}

export function formatCashCloseTicketText(data: CashCloseTicketData): string {
  const lines = [
    "KIOSCO TERMAS — CIERRE DE CAJA",
    `Negocio: ${data.businessId}`,
    `Sucursal: ${data.branchId}`,
    `Turno: #${data.shiftNumber}`,
    `Apertura: ${formatDateTime(data.openedAt)} · Cajero: ${data.openedBy}`,
    `Cierre: ${formatDateTime(data.closedAt)} · Cajero: ${data.closedBy}`,
    "",
    `FONDO INICIAL: ${formatCurrency(data.openingCash)}`,
    "MOVIMIENTOS",
    ...data.movements.map(
      (movement) =>
        `- ${movement.typeLabel}: ${formatCurrency(movement.amount)} · ${movement.reason} · ${movement.createdBy}${movement.authorizedBy ? ` · Aut.: ${movement.authorizedBy}` : ""} · ${formatDateTime(movement.createdAt)}`,
    ),
    `Totales: Ingresos ${formatCurrency(data.movementTotals.CASH_IN)} | Retiros ${formatCurrency(data.movementTotals.WITHDRAWAL)} | Gastos ${formatCurrency(data.movementTotals.EXPENSE)}`,
    "",
    `VENTAS PAGADAS: ${data.paidSalesCount}`,
    `ANULADAS: ${data.cancelledSalesCount} (${data.cancelledPaidCount} cobradas, ${data.cancelledUnpaidCount} sin cobro) · ${formatCurrency(data.cancelledTotal)}`,
    `PAGOS TARDÍOS: ${data.latePaymentsCount} · ${formatCurrency(data.latePaymentsAmount)}`,
    ...data.sales.map(
      (sale) =>
        `- ${sale.statusLabel} · ${sale.id} · ${sale.paymentMethod} · ${formatCurrency(sale.amount)} · ${formatDateTime(sale.timestamp)}`,
    ),
    "",
    `TOTALES POR MEDIO: Efectivo ${formatCurrency(data.totalsByPayment.EFECTIVO)} | QR ${formatCurrency(data.totalsByPayment.QR)} | Tarjeta ${formatCurrency(data.totalsByPayment.TARJETA)}`,
    "",
    "CONTROL FÍSICO Y POSNET / QR",
    `Efectivo teórico: ${formatCurrency(data.expectedCash)}`,
    `Efectivo contado: ${formatCurrency(data.declaredCash)}`,
    `Diferencia: ${DIFFERENCE_LABELS[data.cashDifferenceStatus]} · ${formatCurrency(data.cashDifference)}`,
    data.reconciliationPending
      ? "CONCILIACIÓN PENDIENTE"
      : data.posnetItems.length > 0
        ? "Conciliación completada"
        : "Sin datos de conciliación",
    ...data.posnetItems.map(
      (item) =>
        `- ${item.label}${item.reference ? ` · Ref: ${item.reference}` : ""} · Sistema ${formatCurrency(item.systemAmount)} · Declarado ${formatCurrency(item.declaredAmount)} · Dif. ${formatCurrency(item.difference)}`,
    ),
    "",
    `APROBACIÓN: ${APPROVAL_LABELS[data.approvalStatus]}`,
    `Resuelto por: ${data.approvedBy ?? "—"} · Fecha: ${data.approvedAt ? formatDateTime(data.approvedAt) : "—"}`,
    `Nota de aprobación: ${data.approvalNote ?? "—"}`,
    `Notas de cierre: ${data.closeNotes ?? "—"}`,
    "",
    "Firma cajero: ______________________________",
    "Firma encargado / dueño: ___________________",
  ];

  return lines.join("\n");
}

export function CashCloseTicket({
  shift,
  summary,
  sales,
  onClose,
}: {
  shift: CashShift;
  summary: CashCloseSummary;
  sales: Sale[];
  onClose: () => void;
}) {
  const [paperWidth, setPaperWidth] = useState<PaperWidth>("80");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("txt");
  const [feedback, setFeedback] = useState("");

  const ticket = useMemo(
    () => buildCashCloseTicketData(shift, summary, sales),
    [shift, summary, sales],
  );
  const ticketText = useMemo(() => formatCashCloseTicketText(ticket), [ticket]);

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  const copySummary = async () => {
    setFeedback("");
    try {
      await navigator.clipboard.writeText(ticketText);
      setFeedback("Resumen copiado al portapapeles.");
    } catch (error) {
      setFeedback(error instanceof Error
        ? `No se pudo copiar: ${error.message}`
        : "No se pudo copiar el resumen al portapapeles.");
    }
  };

  const exportTicket = () => {
    setFeedback("");
    try {
      const content = exportFormat === "json"
        ? JSON.stringify(ticket, null, 2)
        : ticketText;
      const blob = new Blob([content], {
        type: exportFormat === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cierre-turno-${ticket.shiftNumber}.${exportFormat}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback(`Ticket exportado en formato .${exportFormat}.`);
    } catch (error) {
      setFeedback(error instanceof Error
        ? `No se pudo exportar: ${error.message}`
        : "No se pudo exportar el ticket.");
    }
  };

  return (
    <div
      className="close-ticket-overlay fixed inset-0 z-[80] flex flex-col items-center overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-sm"
      onKeyDown={closeOnEscape}
    >
      <div className="ticket-no-print mb-3 flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3">
        <div>
          <h2 className="text-sm font-bold text-white">Ticket de cierre · turno #{ticket.shiftNumber}</h2>
          <p className="text-[11px] text-slate-400">Vista para Cajero y Encargado / Dueño.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
            Papel
            <select value={paperWidth} onChange={(event) => setPaperWidth(event.target.value as PaperWidth)} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-white">
              <option value="80">80 mm</option>
              <option value="58">58 mm</option>
            </select>
          </label>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-emerald-400 px-2.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-300">
            <Printer className="h-3.5 w-3.5" /> Imprimir ticket
          </button>
          <button type="button" onClick={copySummary} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 hover:border-emerald-600">
            <ClipboardCopy className="h-3.5 w-3.5" /> Copiar resumen
          </button>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-white" aria-label="Formato de exportación">
              <option value="txt">.txt</option>
              <option value="json">.json</option>
            </select>
            <button type="button" onClick={exportTicket} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-100 hover:border-emerald-600">
              <Download className="h-3.5 w-3.5" /> Exportar archivo
            </button>
          </label>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Cerrar ticket (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
        {feedback && <p role="status" className="w-full text-xs text-emerald-300">{feedback}</p>}
      </div>

      <article
        id="close-ticket-print"
        className={`ticket-paper paper-${paperWidth} w-full max-w-3xl space-y-3 border border-slate-300 bg-white p-5 font-mono text-[11px] leading-snug text-slate-950 shadow-xl`}
      >
        <header className="ticket-row border-b border-dashed border-slate-500 pb-2 text-center">
          <h1 className="text-sm font-black uppercase">Kiosco Termas</h1>
          <p>REPORTE / TICKET DE CIERRE</p>
          <p>Negocio: {ticket.businessId}</p>
          <p>Sucursal: {ticket.branchId}</p>
          <p>Turno #{ticket.shiftNumber}</p>
        </header>

        <section className="ticket-row grid grid-cols-2 gap-x-3">
          <p>Abierto: {formatDateTime(ticket.openedAt)}</p>
          <p>Cerrado: {formatDateTime(ticket.closedAt)}</p>
          <p>Cajero apertura: {ticket.openedBy}</p>
          <p>Cajero cierre: {ticket.closedBy}</p>
        </section>

        <section className="ticket-row border-y border-dashed border-slate-500 py-2">
          <TicketHeading>Fondo inicial y movimientos</TicketHeading>
          <TicketLine label="Fondo inicial" value={formatCurrency(ticket.openingCash)} />
          {ticket.movements.length === 0 ? (
            <p>Sin movimientos de caja.</p>
          ) : ticket.movements.map((movement, index) => (
            <div className="ticket-row flex justify-between gap-2" key={`${movement.type}-${index}`}>
              <span className="min-w-0 break-words">
                {movement.typeLabel}: {movement.reason} · {movement.createdBy}
                {movement.authorizedBy ? ` (aut.: ${movement.authorizedBy})` : ""}
                {" · "}{formatDateTime(movement.createdAt)}
              </span>
              <span className="shrink-0">{formatCurrency(movement.amount)}</span>
            </div>
          ))}
          <TicketLine label="Ingresos" value={formatCurrency(ticket.movementTotals.CASH_IN)} />
          <TicketLine label="Retiros" value={formatCurrency(ticket.movementTotals.WITHDRAWAL)} />
          <TicketLine label="Gastos" value={formatCurrency(ticket.movementTotals.EXPENSE)} />
        </section>

        <section className="ticket-sales">
          <TicketHeading>Ventas pagadas, anuladas y pagos tardíos</TicketHeading>
          <p>Pagadas: {ticket.paidSalesCount}</p>
          <p>Anuladas: {ticket.cancelledSalesCount} ({ticket.cancelledPaidCount} cobradas / {ticket.cancelledUnpaidCount} sin cobro) · {formatCurrency(ticket.cancelledTotal)}</p>
          <p>Pagos tardíos: {ticket.latePaymentsCount} · {formatCurrency(ticket.latePaymentsAmount)}</p>
          {ticket.sales.length === 0 ? (
            <p>Sin ventas pagadas o anuladas asociadas.</p>
          ) : ticket.sales.map((sale) => (
            <div className="ticket-row flex justify-between gap-2" key={sale.id}>
              <span className="min-w-0 break-words">{sale.statusLabel} · {sale.id} · {sale.paymentMethod} · {formatDateTime(sale.timestamp)}</span>
              <span className="shrink-0">{formatCurrency(sale.amount)}</span>
            </div>
          ))}
        </section>

        <section className="ticket-row border-y border-dashed border-slate-500 py-2">
          <TicketHeading>Totales por medio de pago</TicketHeading>
          <TicketLine label="Efectivo" value={formatCurrency(ticket.totalsByPayment.EFECTIVO)} />
          <TicketLine label="QR" value={formatCurrency(ticket.totalsByPayment.QR)} />
          <TicketLine label="Tarjeta" value={formatCurrency(ticket.totalsByPayment.TARJETA)} />
        </section>

        <section className="ticket-row space-y-1">
          <TicketHeading>Control físico y Posnet / QR</TicketHeading>
          <TicketLine label="Efectivo teórico" value={formatCurrency(ticket.expectedCash)} strong />
          <TicketLine label="Efectivo contado" value={formatCurrency(ticket.declaredCash)} />
          <TicketLine
            label={`Diferencia · ${DIFFERENCE_LABELS[ticket.cashDifferenceStatus]}`}
            value={formatCurrency(ticket.cashDifference)}
            strong
          />
          {ticket.reconciliationPending ? (
            <p className="ticket-row border border-dashed border-slate-700 py-1 text-center font-bold">CONCILIACIÓN POSNET / QR PENDIENTE</p>
          ) : (
            <p>{ticket.posnetItems.length > 0 ? "Conciliación Posnet / QR: completada" : "Sin datos de conciliación Posnet / QR."}</p>
          )}
          {ticket.posnetItems.length === 0 ? (
            <p>Sin ítems de conciliación.</p>
          ) : ticket.posnetItems.map((item) => (
            <div className="ticket-row border-t border-dotted border-slate-300 pt-1" key={item.id}>
              <p className="font-bold">{item.label}{item.reference ? ` · Ref/Lote: ${item.reference}` : ""}</p>
              <TicketLine label="Sistema" value={formatCurrency(item.systemAmount)} />
              <TicketLine label="Declarado" value={formatCurrency(item.declaredAmount)} />
              <TicketLine label="Diferencia" value={formatCurrency(item.difference)} />
            </div>
          ))}
        </section>

        <section className="ticket-row border-t border-dashed border-slate-500 pt-2">
          <TicketHeading>Estado de aprobación</TicketHeading>
          <p>{APPROVAL_LABELS[ticket.approvalStatus]}</p>
          <p>Resuelto por: {ticket.approvedBy ?? "—"}</p>
          <p>Fecha: {ticket.approvedAt ? formatDateTime(ticket.approvedAt) : "—"}</p>
          {ticket.approvalNote && <p>Nota de aprobación: {ticket.approvalNote}</p>}
          {ticket.closeNotes && <p>Nota de cierre: {ticket.closeNotes}</p>}
        </section>

        <footer className="ticket-row grid grid-cols-2 gap-6 border-t border-dashed border-slate-500 pt-8 text-center">
          <p className="border-t border-slate-700 pt-1">Firma cajero</p>
          <p className="border-t border-slate-700 pt-1">Firma encargado / dueño</p>
        </footer>
        <p className="text-center text-[9px]">Comprobante interno · {ticket.shiftNumber}</p>
      </article>
    </div>
  );
}

function TicketHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-1 font-bold uppercase">{children}</h2>;
}

function TicketLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <p className={`flex justify-between gap-2 ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="shrink-0">{value}</span>
    </p>
  );
}
