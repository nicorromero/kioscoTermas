import type {
  CashCloseSummary,
  CashMovement,
  CashShift,
  PosnetReconciliationItem,
  Sale,
} from "../types/pos";
import {
  calculateCashCloseSummary,
  type CashCloseDetails,
} from "./cashRegister";

export type PosnetReconciliationDifference = Pick<
  PosnetReconciliationItem,
  "id" | "label"
> & {
  difference: number;
};

function toCents(amount: number, label: string): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`${label} debe ser un importe finito`);
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

function fromCents(amount: number): number {
  return amount / 100;
}

export function calculateExpectedCash(
  openingCash: number,
  cashSalesTotal: number,
  cashInTotal: number,
  withdrawalsTotal: number,
  expensesTotal: number,
): number {
  const expectedCashCents =
    toCents(openingCash, "Fondo inicial") +
    toCents(cashSalesTotal, "Ventas en efectivo") +
    toCents(cashInTotal, "Ingresos de efectivo") -
    toCents(withdrawalsTotal, "Retiros") -
    toCents(expensesTotal, "Gastos");

  return fromCents(expectedCashCents);
}

export function calculateCashDifference(
  declaredCash: number,
  expectedCash: number,
): number {
  return fromCents(
    toCents(declaredCash, "Efectivo declarado") -
      toCents(expectedCash, "Efectivo esperado"),
  );
}

export function calculatePosnetDifference(
  item: PosnetReconciliationItem,
): number {
  return fromCents(
    toCents(item.declaredAmount, `Declaración ${item.label}`) -
      toCents(item.systemAmount, `Total del sistema ${item.label}`),
  );
}

export function calculatePosnetDifferences(
  items: PosnetReconciliationItem[],
): PosnetReconciliationDifference[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    difference: calculatePosnetDifference(item),
  }));
}

export function buildCashCloseSummary(
  shift: CashShift,
  sales: Sale[],
  movements: CashMovement[],
  details: CashCloseDetails,
): CashCloseSummary {
  return calculateCashCloseSummary(shift, sales, movements, details);
}

export type { CashCloseDetails };
