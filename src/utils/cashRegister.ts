import type {
  CashAmountsByPaymentMethod,
  CashCloseSummary,
  CashMovement,
  CashShift,
  NonCashPaymentMethod,
  PaymentMethod,
  PosnetReconciliationItem,
  Sale,
  ShiftApprovalStatus,
} from "../types/pos";

export interface CashCloseDetails {
  id: string;
  closedBy: string;
  closedAt: string;
  declaredCash: number;
  declaredNonCash?: Partial<Record<NonCashPaymentMethod, number>>;
  reconciledNonCash?: Partial<Record<NonCashPaymentMethod, number>>;
  observations?: string;
  posnetItems?: PosnetReconciliationItem[];
  reconciliationPending?: boolean;
  approvalStatus?: ShiftApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  latePaymentsCount?: number;
  latePaymentsAmount?: number;
}

function toCents(amount: number, label: string): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`${label} debe ser un importe finito`);
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

function fromCents(amount: number): number {
  return amount / 100;
}

function nonNegativeCents(amount: number, label: string): number {
  const cents = toCents(amount, label);
  if (cents < 0) {
    throw new RangeError(`${label} no puede ser negativo`);
  }
  return cents;
}

function validateScope(
  businessId: string,
  branchId: string,
  record: { businessId: string; branchId: string },
  label: string,
): void {
  if (record.businessId !== businessId || record.branchId !== branchId) {
    throw new Error(`${label} no pertenece al negocio y sucursal del turno`);
  }
}

function zeroTotals(): Record<PaymentMethod, number> {
  return { EFECTIVO: 0, QR: 0, TARJETA: 0 };
}

export function calculateCashCloseSummary(
  shift: CashShift,
  sales: Sale[],
  movements: CashMovement[],
  details: CashCloseDetails,
): CashCloseSummary {
  if (!details.id.trim() || !details.closedBy.trim() || !details.closedAt.trim()) {
    throw new Error("El cierre requiere id, responsable y fecha");
  }

  const openingCashCents = nonNegativeCents(shift.openingCash, "Fondo inicial");
  const declaredCashCents = nonNegativeCents(
    details.declaredCash,
    "Efectivo declarado",
  );
  const collectedCents = zeroTotals();
  let paidSaleCount = 0;
  let cancelledSaleCount = 0;
  let cancelledPaidCount = 0;
  let cancelledUnpaidCount = 0;
  let cancelledGrossCents = 0;
  let cancelledPaidGrossCents = 0;
  let cancelledUnpaidGrossCents = 0;
  let latePaymentsCount = 0;
  let latePaymentsAmountCents = 0;
  const totalsByQrAccountCents = new Map<string, number>();

  for (const sale of sales) {
    const belongsToShift = sale.shiftId === shift.id;
    const isLatePayment =
      sale.settledInShiftId === shift.id && sale.shiftId !== shift.id;
    if (!belongsToShift && !isLatePayment) continue;
    validateScope(shift.businessId, shift.branchId, sale, "La venta");

    const totalCents = nonNegativeCents(sale.total, "Total de venta");
    const wasPaid = sale.status === "PAGADA" ||
      (sale.status === "CANCELADA" && sale.paidAt !== undefined);

    if (belongsToShift && sale.status === "CANCELADA") {
      cancelledSaleCount += 1;
      cancelledGrossCents += totalCents;
      if (wasPaid) {
        cancelledPaidCount += 1;
        cancelledPaidGrossCents += totalCents;
      } else {
        cancelledUnpaidCount += 1;
        cancelledUnpaidGrossCents += totalCents;
      }
    }

    if (!wasPaid) continue;
    if (!sale.paymentMethod) {
      throw new Error(`La venta cobrada ${sale.id} no tiene medio de pago`);
    }

    paidSaleCount += 1;
    collectedCents[sale.paymentMethod] += totalCents;
    if (sale.paymentMethod === "QR" && sale.qrAccountId) {
      totalsByQrAccountCents.set(
        sale.qrAccountId,
        (totalsByQrAccountCents.get(sale.qrAccountId) ?? 0) + totalCents,
      );
    }
    if (isLatePayment) {
      latePaymentsCount += 1;
      latePaymentsAmountCents += totalCents;
    }
  }

  let cashInCents = 0;
  let withdrawalCents = 0;
  let expenseCents = 0;
  const salesById = new Map(
    sales
      .filter(
        (sale) =>
          sale.shiftId === shift.id || sale.settledInShiftId === shift.id,
      )
      .map((sale) => [sale.id, sale]),
  );

  for (const movement of movements) {
    if (movement.shiftId !== shift.id) continue;
    validateScope(shift.businessId, shift.branchId, movement, "El movimiento");

    const amountCents = nonNegativeCents(movement.amount, "Importe del movimiento");
    if (amountCents === 0) {
      throw new RangeError("El importe del movimiento debe ser mayor que cero");
    }
    if (!movement.reason.trim()) {
      throw new Error("El movimiento requiere un motivo");
    }
    if (movement.relatedSaleId) {
      if (movement.type !== "WITHDRAWAL") {
        throw new Error("Sólo un retiro puede estar vinculado a una venta");
      }
      const relatedSale = salesById.get(movement.relatedSaleId);
      const relatedSaleWasPaid = relatedSale?.status === "PAGADA" ||
        (relatedSale?.status === "CANCELADA" && relatedSale.paidAt !== undefined);
      if (
        !relatedSale ||
        relatedSale.paymentMethod !== "EFECTIVO" ||
        !relatedSaleWasPaid
      ) {
        throw new Error("El retiro debe vincularse a una venta del turno cobrada en efectivo");
      }
    }

    switch (movement.type) {
      case "CASH_IN":
        cashInCents += amountCents;
        break;
      case "WITHDRAWAL":
        withdrawalCents += amountCents;
        break;
      case "EXPENSE":
        expenseCents += amountCents;
        break;
      default: {
        const exhaustiveCheck: never = movement.type;
        throw new Error(`Tipo de movimiento inválido: ${exhaustiveCheck}`);
      }
    }
  }

  const expectedCashCents =
    openingCashCents +
    collectedCents.EFECTIVO +
    cashInCents -
    withdrawalCents -
    expenseCents;
  const cashDifferenceCents = declaredCashCents - expectedCashCents;
  const collectedByPaymentMethod = {
    EFECTIVO: fromCents(collectedCents.EFECTIVO),
    QR: fromCents(collectedCents.QR),
    TARJETA: fromCents(collectedCents.TARJETA),
  } satisfies CashAmountsByPaymentMethod;
  const nonCashDifference: Partial<Record<NonCashPaymentMethod, number>> = {};

  for (const method of ["QR", "TARJETA"] as const) {
    const declaredAmount = details.declaredNonCash?.[method];
    if (declaredAmount !== undefined) {
      nonNegativeCents(declaredAmount, `Declaración ${method}`);
    }

    const reconciledAmount = details.reconciledNonCash?.[method];
    if (reconciledAmount !== undefined) {
      nonCashDifference[method] = fromCents(
        nonNegativeCents(reconciledAmount, `Conciliación ${method}`) -
          collectedCents[method],
      );
    }
  }

  return {
    id: details.id,
    shiftId: shift.id,
    businessId: shift.businessId,
    branchId: shift.branchId,
    closedAt: details.closedAt,
    closedBy: details.closedBy,
    salesCountPaid: paidSaleCount,
    salesCountCancelled: cancelledSaleCount,
    totalCancelledAmount: fromCents(cancelledGrossCents),
    totalsByPayment: collectedByPaymentMethod,
    totalsByQrAccount: Object.fromEntries(
      [...totalsByQrAccountCents.entries()].map(([id, cents]) => [
        id,
        fromCents(cents),
      ]),
    ),
    openingCash: fromCents(openingCashCents),
    cashInTotal: fromCents(cashInCents),
    withdrawalsTotal: fromCents(withdrawalCents),
    expensesTotal: fromCents(expenseCents),
    posnetItems: details.posnetItems ?? [],
    reconciliationPending: details.reconciliationPending ?? false,
    approvalStatus: details.approvalStatus ?? "NOT_REQUIRED",
    approvedBy: details.approvedBy,
    approvedAt: details.approvedAt,
    notes: details.notes ?? details.observations,
    latePaymentsCount: details.latePaymentsCount ?? latePaymentsCount,
    latePaymentsAmount: details.latePaymentsAmount ??
      fromCents(latePaymentsAmountCents),
    paidSaleCount,
    cancelledSaleCount,
    cancelledPaidCount,
    cancelledUnpaidCount,
    collectedByPaymentMethod,
    cancelledGrossAmount: fromCents(cancelledGrossCents),
    cancelledPaidGrossAmount: fromCents(cancelledPaidGrossCents),
    cancelledUnpaidGrossAmount: fromCents(cancelledUnpaidGrossCents),
    withdrawalTotal: fromCents(withdrawalCents),
    expenseTotal: fromCents(expenseCents),
    expectedCash: fromCents(expectedCashCents),
    declaredCash: fromCents(declaredCashCents),
    cashDifference: fromCents(cashDifferenceCents),
    cashDifferenceStatus:
      cashDifferenceCents > 0
        ? "SURPLUS"
        : cashDifferenceCents < 0
          ? "SHORTAGE"
          : "EXACT",
    declaredNonCash: details.declaredNonCash,
    reconciledNonCash: details.reconciledNonCash,
    nonCashDifference:
      Object.keys(nonCashDifference).length > 0 ? nonCashDifference : undefined,
    observations: details.observations,
  };
}
