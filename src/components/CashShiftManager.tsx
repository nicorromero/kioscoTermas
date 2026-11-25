import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  Check,
  ClipboardList,
  CreditCard,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  X,
} from "lucide-react";
import { usePosStore } from "../store/usePosStore";
import type {
  CashCloseSummary,
  CashMovementType,
  CashShift,
  PosnetReconciliationItem,
  ShiftApprovalStatus,
} from "../types/pos";
import { buildCashCloseSummary, calculateCashDifference, calculatePosnetDifference } from "../utils/cashShiftUtils";
import { formatCurrency } from "../utils/format";

type DialogType = "open" | "relay" | "movement" | "close" | "reconciliation" | "approval";
type CloseMode = "standard" | "quick";
type ApprovalChoice = "PENDING" | "APPROVED" | "OBSERVED";
type OperatingRole = "cashier" | "manager";

const CashCloseTicket = lazy(() =>
  import("./CashCloseTicket").then((module) => ({
    default: module.CashCloseTicket,
  })),
);

interface CashShiftManagerProps {
  onDialogChange: (isOpen: boolean) => void;
}

interface ReconciliationRow extends PosnetReconciliationItem {
  key: string;
}

const CASH_TOLERANCE = 1000;
const DENOMINATIONS = [100, 500, 1000, 2000, 10000, 20000, 50000] as const;
const MOVEMENT_LABELS: Record<CashMovementType, string> = {
  CASH_IN: "Ingreso",
  WITHDRAWAL: "Retiro",
  EXPENSE: "Gasto menor",
};

function createRowKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `posnet-${Date.now()}-${Math.random()}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado al guardar.";
}

function summarizeShift(shift: CashShift, sales: CashShiftManagerSale[]): CashCloseSummary {
  return buildCashCloseSummary(shift, sales, shift.movements, {
    id: `preview-${shift.id}`,
    closedBy: shift.openedBy,
    closedAt: shift.openedAt,
    declaredCash: 0,
  });
}

type CashShiftManagerSale = ReturnType<typeof usePosStore.getState>["completedSales"][number];

function makeRows(items: PosnetReconciliationItem[]): ReconciliationRow[] {
  return items.map((item) => ({ ...item, key: createRowKey() }));
}

function makeDefaultRows(summary: CashCloseSummary): ReconciliationRow[] {
  return makeRows([
    {
      id: createRowKey(),
      label: "QR",
      systemAmount: summary.totalsByPayment.QR,
      declaredAmount: summary.totalsByPayment.QR,
    },
    {
      id: createRowKey(),
      label: "Tarjeta / Posnet",
      systemAmount: summary.totalsByPayment.TARJETA,
      declaredAmount: summary.totalsByPayment.TARJETA,
    },
  ]);
}

function DialogFrame({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const stopEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm"
      onKeyDown={stopEscape}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">{title}</h2>
            {description && <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Cerrar sin descartar los datos"
            title="Cerrar (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50";

export function CashShiftManager({ onDialogChange }: CashShiftManagerProps) {
  const activeShift = usePosStore((state) => state.activeShift);
  const shifts = usePosStore((state) => state.shifts);
  const completedSales = usePosStore((state) => state.completedSales);
  const queue = usePosStore((state) => state.queue);
  const invoices = usePosStore((state) => state.invoices);
  const openShift = usePosStore((state) => state.openShift);
  const relayShift = usePosStore((state) => state.relayShift);
  const addCashMovement = usePosStore((state) => state.addCashMovement);
  const closeShift = usePosStore((state) => state.closeShift);
  const updateShiftReconciliation = usePosStore((state) => state.updateShiftReconciliation);
  const resolveShiftApproval = usePosStore((state) => state.resolveShiftApproval);

  const [dialog, setDialog] = useState<DialogType | null>(null);
  const [error, setError] = useState("");
  const [operatingRole, setOperatingRole] = useState<OperatingRole>("cashier");
  const [ticketDialogShiftId, setTicketDialogShiftId] = useState<string | null>(null);
  const [lastClosedTicketId, setLastClosedTicketId] = useState<string | null>(null);

  const [cashierName, setCashierName] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [closedBy, setClosedBy] = useState("");
  const [declaredCash, setDeclaredCash] = useState("");
  const [nextCashierName, setNextCashierName] = useState("");
  const [nextOpeningCash, setNextOpeningCash] = useState("");
  const [nextOpeningEdited, setNextOpeningEdited] = useState(false);

  const [movementType, setMovementType] = useState<CashMovementType>("WITHDRAWAL");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");

  const [closeMode, setCloseMode] = useState<CloseMode>("standard");
  const [denominationCount, setDenominationCount] = useState<Record<number, string>>({});
  const [useDenominations, setUseDenominations] = useState(false);
  const [posnetRows, setPosnetRows] = useState<ReconciliationRow[]>([]);
  const [notes, setNotes] = useState("");
  const [precheckConfirmed, setPrecheckConfirmed] = useState(false);
  const [approvalChoice, setApprovalChoice] = useState<ApprovalChoice>("PENDING");
  const [approver, setApprover] = useState("");
  const [approvalNote, setApprovalNote] = useState("");

  const [reconciliationShiftId, setReconciliationShiftId] = useState("");
  const [reconciliationPending, setReconciliationPending] = useState(true);
  const [approvalShiftId, setApprovalShiftId] = useState("");
  const [approvalResolver, setApprovalResolver] = useState("");
  const [approvalResolution, setApprovalResolution] = useState<Exclude<ShiftApprovalStatus, "NOT_REQUIRED" | "PENDING">>("APPROVED");
  const [approvalResolutionNote, setApprovalResolutionNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const sales = useMemo(() => {
    const byId = new Map<string, CashShiftManagerSale>();
    for (const sale of [...completedSales, ...queue]) byId.set(sale.id, sale);
    return [...byId.values()];
  }, [completedSales, queue]);

  useEffect(
    () => onDialogChange(dialog !== null || ticketDialogShiftId !== null),
    [dialog, onDialogChange, ticketDialogShiftId],
  );

  const closeSummary = useMemo(
    () => (activeShift ? summarizeShift(activeShift, sales) : null),
    [activeShift, sales],
  );

  const shiftSales = useMemo(
    () => sales.filter(
      (sale) => sale.shiftId === activeShift?.id || sale.settledInShiftId === activeShift?.id,
    ),
    [activeShift?.id, sales],
  );
  const pendingSalesCount = shiftSales.filter(
    (sale) => sale.status === "PENDIENTE_PAGO" || sale.status === "PAGO_RECHAZADO",
  ).length;
  const saleIds = new Set(shiftSales.map((sale) => sale.id));
  const pendingOfflineInvoices = invoices.filter(
    (invoice) => invoice.fiscalStatus === "PENDIENTE_ENVIO_ARCA" && saleIds.has(invoice.saleId),
  ).length;
  const hasPrecheckWarnings = pendingSalesCount > 0 || pendingOfflineInvoices > 0;

  const countedCash = DENOMINATIONS.reduce(
    (total, denomination) => total + denomination * (Number(denominationCount[denomination]) || 0),
    0,
  );
  const declaredAmount = useDenominations ? countedCash : Number(declaredCash) || 0;

  useEffect(() => {
    if (dialog === "relay" && !nextOpeningEdited) {
      setNextOpeningCash(declaredCash);
    }
  }, [declaredCash, dialog, nextOpeningEdited]);

  const latestReconciliationShift = shifts.find(
    (shift) => shift.status === "CLOSED" && shift.closeSummary?.reconciliationPending,
  );
  const latestApprovalShift = shifts.find(
    (shift) => shift.status === "CLOSED" && shift.closeSummary?.approvalStatus === "PENDING",
  );
  const closedShifts = useMemo(
    () => [...shifts]
      .filter((shift) => shift.status === "CLOSED" && shift.closeSummary)
      .sort((left, right) =>
        (right.closedAt ?? "").localeCompare(left.closedAt ?? ""),
      ),
    [shifts],
  );
  const ticketShift = ticketDialogShiftId
    ? closedShifts.find((shift) => shift.id === ticketDialogShiftId)
    : undefined;

  const openTicket = (shiftId: string) => {
    if (
      operatingRole === "cashier" &&
      shiftId !== lastClosedTicketId
    ) return;
    setTicketDialogShiftId(shiftId);
  };

  const begin = (nextDialog: DialogType) => {
    setError("");
    if (nextDialog === "relay" || nextDialog === "close") {
      setClosedBy((current) => current || activeShift?.openedBy || "");
      if (nextDialog === "close" && closeSummary && posnetRows.length === 0) {
        setPosnetRows(makeDefaultRows(closeSummary));
      }
    }
    if (nextDialog === "movement") {
      setCreatedBy((current) => current || activeShift?.openedBy || "");
    }
    setDialog(nextDialog);
  };

  const closeDialog = () => {
    setError("");
    setDialog(null);
  };

  const submitOpen = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await openShift({ cashierName, openingCash: Number(openingCash) });
      setCashierName("");
      setOpeningCash("");
      setDialog(null);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setIsSaving(false);
    }
  };

  const approvalForDifference = (difference: number): {
    approvalStatus?: ShiftApprovalStatus;
    approvedBy?: string;
    approvalNote?: string;
  } => {
    if (Math.abs(difference) <= CASH_TOLERANCE) return {};
    if (!approvalNote.trim()) throw new Error("Agregá una observación para la diferencia fuera de tolerancia.");
    if (approvalChoice !== "PENDING" && !approver.trim()) {
      throw new Error("Indicá quién aprueba u observa la diferencia.");
    }
    return {
      approvalStatus: approvalChoice,
      approvedBy: approvalChoice === "PENDING" ? undefined : approver.trim(),
      approvalNote: approvalNote.trim(),
    };
  };

  const submitRelay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeShift || !closeSummary) return;
    setError("");
    try {
      const difference = calculateCashDifference(declaredAmount, closeSummary.expectedCash);
      const approval = approvalForDifference(difference);
      setIsSaving(true);
      const closedShiftId = activeShift.id;
      await relayShift({
        closedBy,
        declaredCash: declaredAmount,
        nextCashierName,
        nextOpeningCash: Number(nextOpeningCash),
        notes: notes.trim() || undefined,
        ...approval,
      });
      setDialog(null);
      setLastClosedTicketId(closedShiftId);
      setTicketDialogShiftId(closedShiftId);
      setNotes("");
      setDeclaredCash("");
      setNextCashierName("");
      setNextOpeningCash("");
      setNextOpeningEdited(false);
      setUseDenominations(false);
      setDenominationCount({});
      setApprovalChoice("PENDING");
      setApprover("");
      setApprovalNote("");
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setIsSaving(false);
    }
  };

  const submitMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await addCashMovement({
        type: movementType,
        amount: Number(movementAmount),
        reason: movementReason,
        createdBy,
        authorizedBy: authorizedBy.trim() || undefined,
      });
      setDialog(null);
      setMovementAmount("");
      setMovementReason("");
      setAuthorizedBy("");
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setIsSaving(false);
    }
  };

  const submitClose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeShift || !closeSummary) return;
    setError("");
    try {
      if (hasPrecheckWarnings && (!precheckConfirmed || !notes.trim())) {
        throw new Error("Confirmá que revisaste las advertencias y dejá una nota antes de continuar.");
      }
      if (posnetRows.length === 0) {
        throw new Error("Agregá al menos un ítem para conciliar Posnet o QR.");
      }
      const cashDifference = calculateCashDifference(declaredAmount, closeSummary.expectedCash);
      const nonCashDifferences = posnetRows.map(calculatePosnetDifference);
      const approval = approvalForDifference(
        Math.max(Math.abs(cashDifference), ...nonCashDifferences.map(Math.abs)),
      );
      setIsSaving(true);
      const closedSummary = await closeShift({
        closedBy,
        declaredCash: declaredAmount,
        posnetItems: posnetRows.map(({ key: _key, ...item }) => item),
        reconciliationPending: closeMode === "quick",
        notes: notes.trim() || undefined,
        ...approval,
      });
      setDialog(null);
      setLastClosedTicketId(closedSummary.shiftId);
      setTicketDialogShiftId(closedSummary.shiftId);
      setNotes("");
      setDeclaredCash("");
      setPosnetRows([]);
      setUseDenominations(false);
      setDenominationCount({});
      setPrecheckConfirmed(false);
      setApprovalChoice("PENDING");
      setApprover("");
      setApprovalNote("");
      setCloseMode("standard");
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setIsSaving(false);
    }
  };

  const openReconciliation = (shift: CashShift) => {
    if (operatingRole !== "manager" || shift.status !== "CLOSED") return;
    if (reconciliationShiftId !== shift.id) {
      setPosnetRows(makeRows(shift.closeSummary?.posnetItems ?? []));
      setReconciliationPending(true);
    }
    setReconciliationShiftId(shift.id);
    begin("reconciliation");
  };

  const submitReconciliation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (operatingRole !== "manager") {
      setError("Sólo Encargado / Dueño puede actualizar conciliaciones.");
      return;
    }
    setIsSaving(true);
    try {
      await updateShiftReconciliation(
        reconciliationShiftId,
        posnetRows.map(({ key: _key, ...item }) => item),
        reconciliationPending,
      );
      setDialog(null);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setIsSaving(false);
    }
  };

  const openApprovalResolution = (shift: CashShift) => {
    if (operatingRole !== "manager" || shift.status !== "CLOSED") return;
    if (approvalShiftId !== shift.id) {
      setApprovalResolver("");
      setApprovalResolutionNote("");
      setApprovalResolution("APPROVED");
    }
    setApprovalShiftId(shift.id);
    begin("approval");
  };

  const submitApprovalResolution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (operatingRole !== "manager") {
      setError("Sólo Encargado / Dueño puede resolver aprobaciones.");
      return;
    }
    if (!approvalResolutionNote.trim()) {
      setError("La resolución requiere una nota.");
      return;
    }
    setIsSaving(true);
    try {
      await resolveShiftApproval(
        approvalShiftId,
        approvalResolution,
        approvalResolver,
        approvalResolutionNote.trim() || undefined,
      );
      setDialog(null);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setIsSaving(false);
    }
  };

  const updatePosnetRow = (key: string, patch: Partial<ReconciliationRow>) => {
    setPosnetRows((rows) => rows.map((row) => row.key === key ? { ...row, ...patch } : row));
  };

  const addPosnetRow = () => {
    setPosnetRows((rows) => [
      ...rows,
      { id: createRowKey(), key: createRowKey(), label: "", systemAmount: 0, declaredAmount: 0 },
    ]);
  };

  const expectedCash = closeSummary?.expectedCash ?? 0;
  const displayedTicketSummary = ticketShift?.closeSummary;
  const cashDifference = calculateCashDifference(declaredAmount, expectedCash);
  const posnetDifferences = posnetRows.map((row) => ({
    key: row.key,
    difference: calculatePosnetDifference(row),
  }));
  const differenceNeedsApproval =
    Math.abs(cashDifference) > CASH_TOLERANCE ||
    posnetDifferences.some((item) => Math.abs(item.difference) > CASH_TOLERANCE);

  return (
    <>
      <section
        aria-label="Estado del turno de caja"
        className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 py-1.5"
      >
        {activeShift && closeSummary ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-full border border-emerald-700/70 bg-emerald-950/60 px-2 py-1 text-[11px] font-bold text-emerald-300">
              Turno #{activeShift.shiftNumber}
            </span>
            <span className="truncate text-xs text-slate-300">{activeShift.openedBy}</span>
            <span className="whitespace-nowrap text-xs font-semibold text-emerald-300">
              Teórico: {formatCurrency(closeSummary.expectedCash)}
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>No hay un turno abierto</span>
            {latestReconciliationShift && (
              <span className="hidden text-[10px] text-amber-300/80 sm:inline">Hay conciliación pendiente</span>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          <label className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className="hidden sm:inline">Rol</span>
            <select
              value={operatingRole}
              onChange={(event) => setOperatingRole(event.target.value as OperatingRole)}
              className="max-w-28 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[10px] font-semibold text-slate-200"
              aria-label="Modo de rol operativo"
              title="Selector de visibilidad operativa"
            >
              <option value="cashier">Cajero</option>
              <option value="manager">Encargado / Dueño</option>
            </select>
          </label>
          {lastClosedTicketId && (
            <button
              type="button"
              onClick={() => openTicket(lastClosedTicketId)}
              className="rounded-lg border border-slate-700 px-2 py-1.5 text-[10px] font-semibold text-slate-200 hover:border-emerald-600"
            >
              <span className="hidden sm:inline">Último ticket</span>
              <span className="sm:hidden">Ticket</span>
            </button>
          )}
          {!activeShift ? (
            <button type="button" onClick={() => begin("open")} className="rounded-lg bg-emerald-400 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-300">
              Abrir turno
            </button>
          ) : (
            <>
              <button type="button" onClick={() => begin("movement")} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-[10px] font-semibold text-slate-200 hover:border-emerald-600 hover:text-white sm:text-[11px]">
              <Banknote className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Movimiento</span><span className="sm:hidden">Mov.</span>
              </button>
              <button type="button" onClick={() => begin("relay")} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-[10px] font-semibold text-slate-200 hover:border-amber-600 hover:text-white sm:text-[11px]">
              <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Relevar</span><span className="sm:hidden">Relevo</span>
              </button>
              <button type="button" onClick={() => begin("close")} className="flex items-center gap-1 rounded-lg bg-rose-700 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-rose-600 sm:text-[11px]">
                <ReceiptText className="h-3.5 w-3.5" /> Cerrar Caja
              </button>
            </>
          )}
        </div>
      </section>

      {operatingRole === "manager" && (latestReconciliationShift || latestApprovalShift) && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-slate-800 bg-slate-950/70 px-3 py-1">
          {latestReconciliationShift && (
            <button type="button" onClick={() => openReconciliation(latestReconciliationShift)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-slate-800">
              Conciliar turno #{latestReconciliationShift.shiftNumber}
            </button>
          )}
          {latestApprovalShift && (
            <button type="button" onClick={() => openApprovalResolution(latestApprovalShift)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-slate-800">
              Resolver aprobación #{latestApprovalShift.shiftNumber}
            </button>
          )}
        </div>
      )}

      {operatingRole === "manager" && (
        <details className="shrink-0 border-b border-slate-800 bg-slate-950/60 px-3 py-1.5">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-300">
            Historial de cierres ({closedShifts.length})
          </summary>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
            {closedShifts.length === 0 ? (
              <li className="py-2 text-[10px] text-slate-500">Todavía no hay cierres guardados.</li>
            ) : closedShifts.map((shift) => (
              <li key={shift.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5">
                <div className="min-w-0 text-[10px] text-slate-400">
                  <strong className="text-slate-200">Turno #{shift.shiftNumber}</strong>
                  {" · "}{shift.closedAt ? new Date(shift.closedAt).toLocaleString("es-AR") : "sin fecha"}
                  {" · "}{shift.closedBy ?? shift.closeSummary?.closedBy ?? "—"}
                  {shift.closeSummary?.reconciliationPending && <span className="ml-1 text-amber-300">· Conciliación pendiente</span>}
                  {shift.closeSummary?.approvalStatus === "PENDING" && <span className="ml-1 text-rose-300">· Aprobación pendiente</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => openTicket(shift.id)} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-emerald-600">Ver ticket</button>
                  {shift.closeSummary?.reconciliationPending && (
                    <button type="button" onClick={() => openReconciliation(shift)} className="rounded border border-amber-800 px-2 py-1 text-[10px] text-amber-200 hover:bg-amber-950/40">Conciliar</button>
                  )}
                  {shift.closeSummary?.approvalStatus === "PENDING" && (
                    <button type="button" onClick={() => openApprovalResolution(shift)} className="rounded border border-rose-800 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-950/40">Resolver aprobación</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {dialog === "open" && (
        <DialogFrame title="Abrir turno" description="Registrá el cajero y el fondo inicial de efectivo." onClose={closeDialog}>
          <form onSubmit={submitOpen} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cajero responsable">
                <input required autoFocus value={cashierName} onChange={(event) => setCashierName(event.target.value)} className={inputClass} placeholder="Nombre y apellido" />
              </Field>
              <Field label="Fondo inicial">
                <input required type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} className={inputClass} placeholder="0" />
              </Field>
            </div>
            <ErrorMessage message={error} />
            <DialogActions onCancel={closeDialog} saving={isSaving} submitLabel="Abrir turno" />
          </form>
        </DialogFrame>
      )}

      {dialog === "movement" && activeShift && (
        <DialogFrame title="Movimiento de caja" description={`Turno #${activeShift.shiftNumber} · efectivo teórico ${formatCurrency(expectedCash)}`} onClose={closeDialog}>
          <form onSubmit={submitMovement} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de movimiento">
                <select value={movementType} onChange={(event) => setMovementType(event.target.value as CashMovementType)} className={inputClass}>
                  <option value="WITHDRAWAL">Retiro</option>
                  <option value="CASH_IN">Ingreso de efectivo</option>
                  <option value="EXPENSE">Gasto menor</option>
                </select>
              </Field>
              <Field label="Importe">
                <input required type="number" min="0.01" step="0.01" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} className={inputClass} placeholder="0" />
              </Field>
              <Field label="Motivo obligatorio">
                <input required value={movementReason} onChange={(event) => setMovementReason(event.target.value)} className={inputClass} placeholder="Ej. compra de insumos" />
              </Field>
              <Field label="Registrado por">
                <input required value={createdBy} onChange={(event) => setCreatedBy(event.target.value)} className={inputClass} placeholder="Nombre del responsable" />
              </Field>
              <Field label="Autorizado por (opcional)">
                <input value={authorizedBy} onChange={(event) => setAuthorizedBy(event.target.value)} className={inputClass} placeholder="Nombre" />
              </Field>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
              Efectivo teórico después del movimiento: <strong className="text-emerald-300">{formatCurrency(expectedCash + (movementType === "CASH_IN" ? 1 : -1) * (Number(movementAmount) || 0))}</strong>
            </div>
            <ErrorMessage message={error} />
            <DialogActions onCancel={closeDialog} saving={isSaving} submitLabel="Registrar movimiento" />
          </form>
        </DialogFrame>
      )}

      {dialog === "relay" && activeShift && closeSummary && (
        <DialogFrame title="Relevar turno" description="Cerrá el turno actual y abrí el siguiente en una operación encadenada." onClose={closeDialog}>
          <form onSubmit={submitRelay} className="space-y-4">
            <CashExpectedCard expectedCash={expectedCash} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cajero saliente">
                <input required value={closedBy} onChange={(event) => setClosedBy(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Efectivo contado">
                <input required type="number" min="0" step="0.01" value={declaredCash} onChange={(event) => setDeclaredCash(event.target.value)} className={inputClass} placeholder="0" />
              </Field>
              <Field label="Cajero entrante">
                <input required value={nextCashierName} onChange={(event) => setNextCashierName(event.target.value)} className={inputClass} placeholder="Nombre y apellido" />
              </Field>
              <Field label="Fondo inicial sugerido para el entrante">
                <input required type="number" min="0" step="0.01" value={nextOpeningCash} onChange={(event) => { setNextOpeningCash(event.target.value); setNextOpeningEdited(true); }} className={inputClass} />
              </Field>
            </div>
            <DifferenceLine label="Diferencia de efectivo" difference={cashDifference} />
            {Math.abs(cashDifference) > CASH_TOLERANCE && <ApprovalFields choice={approvalChoice} onChoice={setApprovalChoice} approver={approver} onApprover={setApprover} note={approvalNote} onNote={setApprovalNote} />}
            <Field label="Nota del relevo (opcional)">
              <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="Observaciones del turno saliente" />
            </Field>
            <ErrorMessage message={error} />
            <DialogActions onCancel={closeDialog} saving={isSaving} submitLabel="Relevar y abrir siguiente" />
          </form>
        </DialogFrame>
      )}

      {dialog === "close" && activeShift && closeSummary && (
        <DialogFrame title="Arqueo y cierre de caja" description={`Turno #${activeShift.shiftNumber} · abierto por ${activeShift.openedBy}`} onClose={closeDialog}>
          <form onSubmit={submitClose} className="space-y-4">
            <CashSummaryPanel summary={closeSummary} movements={activeShift.movements} />

            {hasPrecheckWarnings && (
              <div role="alert" className="space-y-2 rounded-xl border border-amber-700/60 bg-amber-950/35 p-3 text-xs text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    <p className="font-bold">Revisá antes de cerrar</p>
                    {pendingSalesCount > 0 && <p>{pendingSalesCount} venta(s) en estado pendiente de pago o rechazado.</p>}
                    {pendingOfflineInvoices > 0 && <p>{pendingOfflineInvoices} comprobante(s) pendientes de envío offline.</p>}
                    <p className="mt-1 text-amber-200/80">Podés continuar después de confirmar y dejar una nota.</p>
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={precheckConfirmed} onChange={(event) => setPrecheckConfirmed(event.target.checked)} />
                  Revisé las advertencias y quiero continuar
                </label>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Responsable del cierre">
                <input required value={closedBy} onChange={(event) => setClosedBy(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Modalidad">
                <select value={closeMode} onChange={(event) => setCloseMode(event.target.value as CloseMode)} className={inputClass}>
                  <option value="standard">Cierre estándar</option>
                  <option value="quick">Cierre rápido · conciliación pendiente</option>
                </select>
              </Field>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-white">Conteo de efectivo declarado</label>
                <label className="flex items-center gap-2 text-[11px] text-slate-300">
                  <input type="checkbox" checked={useDenominations} onChange={(event) => setUseDenominations(event.target.checked)} />
                  Asistir con denominaciones
                </label>
              </div>
              {useDenominations ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DENOMINATIONS.map((denomination) => (
                    <label key={denomination} className="flex items-center gap-2 rounded-lg border border-slate-800 px-2 py-1.5 text-[10px] text-slate-300">
                      <span className="min-w-12">{formatCurrency(denomination)}</span>
                      <input type="number" min="0" step="1" value={denominationCount[denomination] ?? ""} onChange={(event) => setDenominationCount((counts) => ({ ...counts, [denomination]: event.target.value }))} className="w-full min-w-0 bg-transparent text-right text-xs text-white outline-none" aria-label={`Cantidad de billetes de ${denomination}`} />
                    </label>
                  ))}
                </div>
              ) : (
                <input required type="number" min="0" step="0.01" value={declaredCash} onChange={(event) => setDeclaredCash(event.target.value)} className={inputClass} placeholder="Efectivo contado" />
              )}
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <span className="text-slate-400">Declarado: <strong className="text-white">{formatCurrency(declaredAmount)}</strong></span>
                <span className={cashDifference === 0 ? "text-emerald-300" : "text-amber-300"}>
                  Diferencia: <strong>{cashDifference > 0 ? "+" : ""}{formatCurrency(cashDifference)}</strong>
                </span>
              </div>
            </div>

            <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-white">Conciliación de Posnet / QR</h3>
                  <p className="text-[10px] text-slate-400">Declarado contra ventas registradas por medio.</p>
                </div>
                <button type="button" onClick={addPosnetRow} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-emerald-600">
                  <Plus className="h-3 w-3" /> Agregar ítem
                </button>
              </div>
              <ReconciliationRows rows={posnetRows} onChange={updatePosnetRow} onRemove={(key) => setPosnetRows((rows) => rows.filter((row) => row.key !== key))} />
            </section>

            {differenceNeedsApproval && (
              <ApprovalFields choice={approvalChoice} onChoice={setApprovalChoice} approver={approver} onApprover={setApprover} note={approvalNote} onNote={setApprovalNote} />
            )}

            <Field label={hasPrecheckWarnings ? "Nota obligatoria para continuar" : "Notas u observaciones (opcional)"}>
              <textarea rows={2} required={hasPrecheckWarnings} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="Dejá una nota de cierre o aclaración" />
            </Field>
            {closeMode === "quick" && <p className="rounded-lg border border-sky-800/70 bg-sky-950/30 px-3 py-2 text-[11px] text-sky-200">El turno se cerrará ahora. La conciliación quedará pendiente y podrá completarse luego, sin reabrir el turno.</p>}
            <ErrorMessage message={error} />
            <DialogActions onCancel={closeDialog} saving={isSaving} submitLabel={closeMode === "quick" ? "Cerrar y conciliar luego" : "Confirmar cierre"} />
          </form>
        </DialogFrame>
      )}

      {dialog === "reconciliation" && (
        <DialogFrame title={`Conciliar turno #${shifts.find((shift) => shift.id === reconciliationShiftId)?.shiftNumber ?? ""}`} description="Actualizá el detalle del cierre guardado, sin reabrir el turno." onClose={closeDialog}>
          <form onSubmit={submitReconciliation} className="space-y-4">
            <ReconciliationRows rows={posnetRows} onChange={updatePosnetRow} onRemove={(key) => setPosnetRows((rows) => rows.filter((row) => row.key !== key))} />
            <button type="button" onClick={addPosnetRow} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-emerald-600">
              <Plus className="h-3.5 w-3.5" /> Agregar ítem
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={reconciliationPending} onChange={(event) => setReconciliationPending(event.target.checked)} />
              Mantener conciliación pendiente
            </label>
            <ErrorMessage message={error} />
            <DialogActions onCancel={closeDialog} saving={isSaving} submitLabel="Guardar conciliación" />
          </form>
        </DialogFrame>
      )}

      {dialog === "approval" && (
        <DialogFrame title={`Resolver aprobación · turno #${shifts.find((shift) => shift.id === approvalShiftId)?.shiftNumber ?? ""}`} description="Guardá la resolución del cierre observado o pendiente." onClose={closeDialog}>
          <form onSubmit={submitApprovalResolution} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Resolución">
                <select value={approvalResolution} onChange={(event) => setApprovalResolution(event.target.value as typeof approvalResolution)} className={inputClass}>
                  <option value="APPROVED">Aprobar</option>
                  <option value="OBSERVED">Observar</option>
                </select>
              </Field>
              <Field label="Responsable">
                <input required value={approvalResolver} onChange={(event) => setApprovalResolver(event.target.value)} className={inputClass} placeholder="Nombre y apellido" />
              </Field>
            </div>
            <Field label="Nota obligatoria">
            <textarea required rows={2} value={approvalResolutionNote} onChange={(event) => setApprovalResolutionNote(event.target.value)} className={inputClass} />
            </Field>
            <ErrorMessage message={error} />
            <DialogActions onCancel={closeDialog} saving={isSaving} submitLabel="Guardar resolución" />
          </form>
        </DialogFrame>
      )}

      {ticketShift && displayedTicketSummary && (
        <Suspense fallback={<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 text-sm text-slate-200">Preparando ticket...</div>}>
          <CashCloseTicket
            shift={ticketShift}
            summary={displayedTicketSummary}
            sales={sales}
            onClose={() => setTicketDialogShiftId(null)}
          />
        </Suspense>
      )}
    </>
  );
}

function CashExpectedCard({ expectedCash }: { expectedCash: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-800/70 bg-emerald-950/30 px-3 py-2.5">
      <span className="text-xs font-semibold text-emerald-100">Efectivo teórico</span>
      <strong className="font-mono text-lg text-emerald-300">{formatCurrency(expectedCash)}</strong>
    </div>
  );
}

function CashSummaryPanel({
  summary,
  movements,
}: {
  summary: CashCloseSummary;
  movements: CashShift["movements"];
}) {
  return (
    <section className="space-y-3">
      <CashExpectedCard expectedCash={summary.expectedCash} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile label="Pagadas" value={String(summary.salesCountPaid)} />
        <SummaryTile label="Anuladas" value={`${summary.salesCountCancelled} · ${formatCurrency(summary.totalCancelledAmount)}`} />
        <SummaryTile label="Pagos tardíos" value={`${summary.latePaymentsCount} · ${formatCurrency(summary.latePaymentsAmount)}`} />
        <SummaryTile label="Apertura" value={formatCurrency(summary.openingCash)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <PaymentTile icon={<Banknote className="h-3.5 w-3.5" />} label="Efectivo" value={summary.totalsByPayment.EFECTIVO} />
        <PaymentTile icon={<QrCode className="h-3.5 w-3.5" />} label="QR" value={summary.totalsByPayment.QR} />
        <PaymentTile icon={<CreditCard className="h-3.5 w-3.5" />} label="Tarjeta" value={summary.totalsByPayment.TARJETA} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["CASH_IN", "WITHDRAWAL", "EXPENSE"] as const).map((type) => {
          const amount = type === "CASH_IN" ? summary.cashInTotal : type === "WITHDRAWAL" ? summary.withdrawalsTotal : summary.expensesTotal;
          return <SummaryTile key={type} label={MOVEMENT_LABELS[type]} value={formatCurrency(amount)} />;
        })}
      </div>
      <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
        <p className="text-[10px] font-semibold text-slate-300">Movimientos registrados ({movements.length})</p>
        {movements.length === 0 ? (
          <p className="text-[10px] text-slate-500">Sin movimientos de caja en este turno.</p>
        ) : (
          <ul className="max-h-28 space-y-1 overflow-y-auto">
            {movements.map((movement) => (
              <li key={movement.id} className="flex items-start justify-between gap-2 text-[10px]">
                <span className="min-w-0 text-slate-400">
                  <strong className="text-slate-200">{MOVEMENT_LABELS[movement.type]}</strong>
                  {" · "}{movement.reason} · {movement.createdBy}
                </span>
                <strong className="shrink-0 font-mono text-white">{formatCurrency(movement.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2">
      <p className="truncate text-[10px] text-slate-400">{label}</p>
      <p className="truncate text-xs font-bold text-white">{value}</p>
    </div>
  );
}

function PaymentTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-xs">
      <span className="flex items-center gap-1.5 text-slate-300">{icon}{label}</span>
      <strong className="font-mono text-white">{formatCurrency(value)}</strong>
    </div>
  );
}

function DifferenceLine({ label, difference }: { label: string; difference: number }) {
  return (
    <div className={`flex justify-between rounded-lg border px-3 py-2 text-xs ${Math.abs(difference) > CASH_TOLERANCE ? "border-amber-700/70 bg-amber-950/30 text-amber-200" : "border-slate-800 bg-slate-950 text-slate-300"}`}>
      <span>{label} · tolerancia {formatCurrency(CASH_TOLERANCE)}</span>
      <strong>{difference > 0 ? "+" : ""}{formatCurrency(difference)}</strong>
    </div>
  );
}

function ApprovalFields({
  choice,
  onChoice,
  approver,
  onApprover,
  note,
  onNote,
}: {
  choice: ApprovalChoice;
  onChoice: (choice: ApprovalChoice) => void;
  approver: string;
  onApprover: (approver: string) => void;
  note: string;
  onNote: (note: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-amber-800/70 bg-amber-950/25 p-3 sm:grid-cols-2">
      <Field label="Estado de aprobación">
        <select value={choice} onChange={(event) => onChoice(event.target.value as ApprovalChoice)} className={inputClass}>
          <option value="PENDING">Pendiente de aprobación</option>
          <option value="APPROVED">Aprobada</option>
          <option value="OBSERVED">Observada</option>
        </select>
      </Field>
      <Field label={choice === "PENDING" ? "Responsable (opcional)" : "Aprobado / observado por"}>
        <input required={choice !== "PENDING"} value={approver} onChange={(event) => onApprover(event.target.value)} className={inputClass} placeholder="Nombre y apellido" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Observación obligatoria por diferencia">
          <textarea required rows={2} value={note} onChange={(event) => onNote(event.target.value)} className={inputClass} placeholder="Explicá el motivo o contexto de la diferencia" />
        </Field>
      </div>
    </div>
  );
}

function ReconciliationRows({
  rows,
  onChange,
  onRemove,
}: {
  rows: ReconciliationRow[];
  onChange: (key: string, patch: Partial<ReconciliationRow>) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <input required aria-label="Alias visible" value={row.label} onChange={(event) => onChange(row.key, { label: event.target.value })} className={`${inputClass} py-1.5 text-xs`} placeholder="Alias (QR, Posnet...)" />
          <input aria-label="Lote o referencia opcional" value={row.reference ?? ""} onChange={(event) => onChange(row.key, { reference: event.target.value || undefined })} className={`${inputClass} py-1.5 text-xs`} placeholder="Lote / referencia" />
          <input required aria-label="Monto del sistema" type="number" min="0" step="0.01" value={row.systemAmount} onChange={(event) => onChange(row.key, { systemAmount: Number(event.target.value) })} className={`${inputClass} py-1.5 text-xs`} placeholder="Sistema" />
          <input required aria-label="Monto declarado" type="number" min="0" step="0.01" value={row.declaredAmount} onChange={(event) => onChange(row.key, { declaredAmount: Number(event.target.value) })} className={`${inputClass} py-1.5 text-xs`} placeholder="Declarado" />
          <div className="flex items-center justify-between gap-2 sm:flex-col sm:justify-center">
            <span className="text-[10px] text-slate-400">Dif. {formatCurrency(calculatePosnetDifference(row))}</span>
            <button type="button" onClick={() => onRemove(row.key)} className="rounded p-1 text-slate-500 hover:bg-rose-950 hover:text-rose-300" aria-label="Quitar conciliación"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-[11px] text-slate-500">Agregá al menos un ítem de conciliación.</p>}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">{message}</p> : null;
}

function DialogActions({
  onCancel,
  saving,
  submitLabel,
}: {
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
      <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">Volver (Esc)</button>
      <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-50">
        {saving ? <ClipboardList className="h-3.5 w-3.5 animate-pulse" /> : <Check className="h-3.5 w-3.5" />}
        {saving ? "Guardando..." : submitLabel}
      </button>
    </div>
  );
}
