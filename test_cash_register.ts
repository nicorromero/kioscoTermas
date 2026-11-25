import "fake-indexeddb/auto";
import Dexie from "dexie";
import { calculateCashCloseSummary } from "./src/utils/cashRegister";
import {
  buildCashCloseTicketData,
  formatCashCloseTicketText,
} from "./src/components/CashCloseTicket";
import {
  calculateCashDifference,
  calculateExpectedCash,
  calculatePosnetDifference,
  calculatePosnetDifferences,
} from "./src/utils/cashShiftUtils";
import {
  closeCashShift,
  db,
  getCashCloseSummary,
  getCashShift,
  getOpenCashShift,
  openCashShift,
  getSale,
  getCompletedSales,
  putSale,
  recordCashMovement,
} from "./src/db/indexedDb";
import { usePosStore } from "./src/store/usePosStore";
import type {
  CashMovement,
  CashShift,
  Sale,
} from "./src/types/pos";

const shift: CashShift = {
  id: "shift-1",
  shiftNumber: "1",
  businessId: "biz-1",
  branchId: "branch-1",
  openedBy: "cashier-1",
  openedAt: "2026-11-25T10:00:00.000Z",
  openingCash: 10000,
  movements: [],
  status: "OPEN",
};

function sale(
  id: string,
  status: Sale["status"],
  total: number,
  paymentMethod: Sale["paymentMethod"],
  details: Partial<Sale> = {},
): Sale {
  return {
    id,
    businessId: shift.businessId,
    branchId: shift.branchId,
    shiftId: shift.id,
    items: [],
    status,
    paymentMethod,
    subtotal: total,
    discount: 0,
    total,
    createdAt: shift.openedAt,
    updatedAt: shift.openedAt,
    ...details,
  };
}

function movement(
  id: string,
  type: CashMovement["type"],
  amount: number,
  relatedSaleId?: string,
): CashMovement {
  return {
    id,
    shiftId: shift.id,
    businessId: shift.businessId,
    branchId: shift.branchId,
    type,
    amount,
    reason: "Movimiento de prueba",
    createdBy: "cashier-1",
    performedBy: "cashier-1",
    createdAt: shift.openedAt,
    relatedSaleId,
  };
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${String(expected)}, recibido ${String(actual)}`);
  }
}

function assertThrows(action: () => unknown, label: string): void {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(`${label}: se esperaba un error`);
}

async function assertRejects(
  action: () => Promise<unknown>,
  label: string,
): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(`${label}: se esperaba un error`);
}

const sales = [
  sale("cash-paid", "PAGADA", 5000, "EFECTIVO", {
    cashReceived: 6000,
    change: 1000,
  }),
  sale("qr-paid-offline", "PAGADA", 3000, "QR", {
    paidAt: "2026-11-25T10:30:00.000Z",
    fiscalStatus: "PENDIENTE_ENVIO_ARCA",
  }),
  sale("cash-cancelled-paid", "CANCELADA", 2000, "EFECTIVO", {
    paidAt: "2026-11-25T10:40:00.000Z",
  }),
  sale("cancelled-unpaid", "CANCELADA", 700, "QR"),
  sale("pending", "PENDIENTE_PAGO", 800, "EFECTIVO"),
  sale("rejected", "PAGO_RECHAZADO", 400, "EFECTIVO"),
  sale("other-shift", "PAGADA", 900, "EFECTIVO", { shiftId: "shift-2" }),
];
const movements = [
  movement("cash-in", "CASH_IN", 500),
  movement("cash-refund", "WITHDRAWAL", 2000, "cash-cancelled-paid"),
  movement("withdrawal", "WITHDRAWAL", 300),
  movement("expense", "EXPENSE", 200),
];

const summary = calculateCashCloseSummary(shift, sales, movements, {
  id: "close-1",
  closedBy: "cashier-1",
  closedAt: "2026-11-25T18:00:00.000Z",
  declaredCash: 14900,
  declaredNonCash: { QR: 3000 },
  reconciledNonCash: { QR: 2900 },
});

assertEqual(summary.paidSaleCount, 3, "Cantidad de cobros exitosos");
assertEqual(summary.cancelledSaleCount, 2, "Cantidad de anulaciones");
assertEqual(summary.cancelledPaidCount, 1, "Anulaciones cobradas");
assertEqual(summary.cancelledUnpaidCount, 1, "Anulaciones no cobradas");
assertEqual(summary.cancelledGrossAmount, 2700, "Importe bruto anulado");
assertEqual(summary.cancelledPaidGrossAmount, 2000, "Importe anulado cobrado");
assertEqual(summary.cancelledUnpaidGrossAmount, 700, "Importe anulado no cobrado");
assertEqual(summary.collectedByPaymentMethod.EFECTIVO, 7000, "Cobros en efectivo");
assertEqual(summary.collectedByPaymentMethod.QR, 3000, "Cobros por QR offline");
assertEqual(summary.expectedCash, 15000, "Efectivo teórico sin doble contar vuelto");
assertEqual(summary.cashDifference, -100, "Diferencia de efectivo");
assertEqual(summary.cashDifferenceStatus, "SHORTAGE", "Estado de diferencia");
assertEqual(summary.nonCashDifference?.QR, -100, "Diferencia informativa QR");
assertEqual(
  calculateExpectedCash(100, 50.15, 5, 10, 3.15),
  142,
  "Cálculo de efectivo esperado en centavos",
);
assertEqual(calculateCashDifference(140, 142), -2, "Diferencia declarada");
const posnetItem = {
  id: "posnet-1",
  label: "Posnet Mostrador",
  systemAmount: 1250,
  declaredAmount: 1200,
};
assertEqual(calculatePosnetDifference(posnetItem), -50, "Diferencia POSNET");
assertEqual(
  calculatePosnetDifferences([posnetItem])[0]?.difference,
  -50,
  "Diferencias por POSNET",
);

assertEqual(
  calculateCashCloseSummary(shift, sales, movements, {
    id: "close-exact",
    closedBy: "cashier-1",
    closedAt: "2026-11-25T18:00:00.000Z",
    declaredCash: 15000,
  }).cashDifferenceStatus,
  "EXACT",
  "Arqueo exacto",
);

assertEqual(
  calculateCashCloseSummary(shift, sales, movements, {
    id: "close-surplus",
    closedBy: "cashier-1",
    closedAt: "2026-11-25T18:00:00.000Z",
    declaredCash: 16000,
  }).cashDifferenceStatus,
  "SURPLUS",
  "Arqueo con sobrante",
);

const latePayment = sale("late-payment", "PAGADA", 1200, "EFECTIVO", {
  shiftId: "shift-closed",
  settledInShiftId: shift.id,
  paidAt: "2026-11-25T11:00:00.000Z",
});
const latePaymentSummary = calculateCashCloseSummary(
  shift,
  [...sales, latePayment],
  movements,
  {
    id: "close-with-late-payment",
    closedBy: "cashier-1",
    closedAt: "2026-11-25T18:00:00.000Z",
    declaredCash: 16200,
  },
);
assertEqual(latePaymentSummary.latePaymentsCount, 1, "Cantidad de pagos tardíos");
assertEqual(latePaymentSummary.latePaymentsAmount, 1200, "Importe de pagos tardíos");
assertEqual(latePaymentSummary.expectedCash, 16200, "Efectivo esperado con pago tardío");
const ticketData = buildCashCloseTicketData(
  {
    ...shift,
    status: "CLOSED",
    closedAt: latePaymentSummary.closedAt,
    closedBy: latePaymentSummary.closedBy,
    movements,
  },
  {
    ...latePaymentSummary,
    posnetItems: [posnetItem],
    reconciliationPending: true,
    approvalStatus: "PENDING",
    notes: "Nota de cierre",
    observations: "Aprobación pendiente",
  },
  [...sales, latePayment],
);
assertEqual(ticketData.expectedCash, 16200, "Ticket conserva efectivo teórico");
assertEqual(ticketData.movementTotals.CASH_IN, 500, "Ticket totaliza ingresos de caja");
assertEqual(
  ticketData.sales.find((entry) => entry.id === "cancelled-unpaid")?.statusLabel,
  "Anulada (sin cobro)",
  "Ticket detalla ventas anuladas sin cobro",
);
assertEqual(
  ticketData.sales.find((entry) => entry.id === "late-payment")?.isLatePayment,
  true,
  "Ticket identifica pagos tardíos",
);
const ticketText = formatCashCloseTicketText(ticketData);
assertEqual(ticketText.includes("CONCILIACIÓN PENDIENTE"), true, "Texto indica conciliación pendiente");
assertEqual(ticketText.includes("Posnet Mostrador"), true, "Texto incluye detalle Posnet");
assertEqual(ticketText.includes("Aprobación pendiente"), true, "Texto incluye nota de aprobación");

assertThrows(
  () =>
    calculateCashCloseSummary(shift, sales, [movement("bad", "EXPENSE", 0)], {
      id: "close-invalid",
      closedBy: "cashier-1",
      closedAt: "2026-11-25T18:00:00.000Z",
      declaredCash: 0,
    }),
  "Movimiento con importe cero",
);

async function testIndexedDbCashFlow(): Promise<void> {
  const persistedShift: CashShift = {
    ...shift,
    id: "shift-persist",
    shiftNumber: "persist-1",
    openingCash: 1000,
  };
  await openCashShift(persistedShift);
  assertEqual(
    (await getOpenCashShift(shift.businessId, shift.branchId))?.id,
    persistedShift.id,
    "Turno abierto persistido",
  );

  let duplicateOpenRejected = false;
  try {
    await openCashShift({
      ...persistedShift,
      id: "shift-persist-duplicate",
      shiftNumber: "persist-2",
    });
  } catch {
    duplicateOpenRejected = true;
  }
  assertEqual(duplicateOpenRejected, true, "Un turno abierto por sucursal");

  await putSale(
    sale("persisted-paid", "PAGADA", 250, "EFECTIVO", {
      shiftId: persistedShift.id,
      paidAt: "2026-11-25T10:30:00.000Z",
    }),
  );
  await putSale(
    sale("persisted-cancelled", "CANCELADA", 100, "QR", {
      shiftId: persistedShift.id,
      cancelledAt: "2026-11-25T10:45:00.000Z",
    }),
  );
  assertEqual(
    (await getCompletedSales(shift.businessId, shift.branchId)).some(
      (entry) => entry.id === "persisted-cancelled",
    ),
    true,
    "Hidratación de ventas anuladas para ticket histórico",
  );
  await recordCashMovement({
    ...movement("persisted-cashin", "CASH_IN", 100),
    shiftId: persistedShift.id,
  });

  const persistedSummary = await closeCashShift(persistedShift.id, {
    id: "persisted-close",
    closedBy: "cashier-1",
    closedAt: "2026-11-25T18:00:00.000Z",
    declaredCash: 1350,
  });
  assertEqual(persistedSummary.expectedCash, 1350, "Cierre transaccional");
  assertEqual(
    (await getCashCloseSummary(persistedShift.id))?.id,
    "persisted-close",
    "Resumen persistido",
  );
  assertEqual(
    (await getCashShift(persistedShift.id))?.status,
    "CLOSED",
    "Turno cerrado",
  );
  assertEqual(
    (await getCashShift(persistedShift.id))?.movements.length,
    1,
    "Movimientos integrados al turno",
  );
  db.close();
  await db.open();
  assertEqual(
    (await getCashShift(persistedShift.id))?.closeSummary?.id,
    "persisted-close",
    "Turno y cierre conservados al reabrir IndexedDB",
  );
  assertEqual(
    (await getCompletedSales(shift.businessId, shift.branchId)).some(
      (entry) => entry.id === "persisted-cancelled",
    ),
    true,
    "Venta anulada recuperada después de reabrir IndexedDB",
  );

  let closedMovementRejected = false;
  try {
    await recordCashMovement({
      ...movement("movement-after-close", "CASH_IN", 1),
      shiftId: persistedShift.id,
    });
  } catch {
    closedMovementRejected = true;
  }
  assertEqual(closedMovementRejected, true, "No permitir movimientos post cierre");
}

async function testIndexedDbUpgrade(): Promise<void> {
  const legacyDb = new Dexie("KioscoTermasPOS");
  legacyDb.version(5).stores({
    sales: "id, [businessId+branchId], [businessId+branchId+status], [businessId+branchId+shiftId], shiftId, status, createdAt",
    cashShifts: "id, &[businessId+branchId+shiftNumber], [businessId+branchId+status]",
    cashMovements: "id, shiftId, [businessId+branchId], [businessId+branchId+shiftId]",
    cashCloseSummaries: "id, &shiftId, [businessId+branchId], [businessId+branchId+closedAt]",
  });
  await legacyDb.open();
  await legacyDb.table("cashShifts").put({
    id: "legacy-shift",
    shiftNumber: "legacy-1",
    businessId: "legacy-biz",
    branchId: "legacy-branch",
    openedBy: "legacy-cashier",
    openedAt: shift.openedAt,
    openingCash: 100,
    status: "CLOSED",
    closedBy: "legacy-cashier",
    closedAt: shift.openedAt,
    closeSummaryId: "legacy-summary",
  });
  await legacyDb.table("cashMovements").put({
    id: "legacy-movement",
    shiftId: "legacy-shift",
    businessId: "legacy-biz",
    branchId: "legacy-branch",
    type: "CASH_IN",
    amount: 25,
    reason: "Ingreso preexistente",
    performedBy: "legacy-cashier",
    createdAt: shift.openedAt,
  });
  await legacyDb.table("cashCloseSummaries").put({
    id: "legacy-summary",
    shiftId: "legacy-shift",
    businessId: "legacy-biz",
    branchId: "legacy-branch",
    closedAt: shift.openedAt,
    closedBy: "legacy-cashier",
    paidSaleCount: 2,
    cancelledSaleCount: 0,
    cancelledPaidCount: 0,
    cancelledUnpaidCount: 0,
    collectedByPaymentMethod: { EFECTIVO: 100, QR: 0, TARJETA: 0 },
    cancelledGrossAmount: 0,
    cancelledPaidGrossAmount: 0,
    cancelledUnpaidGrossAmount: 0,
    openingCash: 100,
    cashInTotal: 25,
    withdrawalTotal: 0,
    expenseTotal: 0,
    expectedCash: 225,
    declaredCash: 225,
    cashDifference: 0,
    cashDifferenceStatus: "EXACT",
  });
  legacyDb.close();

  await db.open();
  const migratedShift = await getCashShift("legacy-shift");
  assertEqual(migratedShift?.movements.length, 1, "Migrar movimientos del turno");
  assertEqual(
    migratedShift?.movements[0]?.createdBy,
    "legacy-cashier",
    "Migrar responsable de movimiento",
  );
  assertEqual(
    migratedShift?.closeSummary?.salesCountPaid,
    2,
    "Migrar resumen de cierre",
  );
  assertEqual(
    migratedShift?.closeSummary?.expectedCash,
    225,
    "Conservar importes del resumen previo",
  );
}

async function testStoreShiftFlow(): Promise<void> {
  const businessId = "store-shift-business";
  const branchId = "store-shift-branch";
  await usePosStore.getState().hydrate(businessId, branchId);

  const firstShift = await usePosStore.getState().openShift({
    cashierName: "Cajero A",
    openingCash: 500,
  });
  assertEqual(firstShift.shiftNumber, "1", "Primer número correlativo de turno");

  const product = usePosStore.getState().products[0];
  if (!product) throw new Error("No hay producto de prueba disponible");
  usePosStore.getState().addToCart(product);
  const pendingSale = await usePosStore.getState().submitSale("QR");
  assertEqual(pendingSale.shiftId, firstShift.id, "Venta asociada al turno abierto");
  await usePosStore.getState().markSaleRejected(pendingSale.id);

  const firstSummary = await usePosStore.getState().closeShift({
    closedBy: "Cajero A",
    declaredCash: 500,
  });
  assertEqual(firstSummary.expectedCash, 500, "Arqueo sin cobro pendiente");
  await usePosStore.getState().markSalePaid(pendingSale.id);
  const paidWithoutShift = await getSale(pendingSale.id);
  assertEqual(
    paidWithoutShift?.settledInShiftId,
    undefined,
    "Pago tardío conserva origen mientras caja está cerrada",
  );
  assertEqual(
    paidWithoutShift?.shiftId,
    firstShift.id,
    "Pago tardío conserva el turno de origen",
  );

  const secondShift = await usePosStore.getState().openShift({
    cashierName: "Cajero B",
    openingCash: 300,
  });
  assertEqual(secondShift.shiftNumber, "2", "Segundo número correlativo de turno");
  const attributedLateSale = await getSale(pendingSale.id);
  assertEqual(
    attributedLateSale?.settledInShiftId,
    secondShift.id,
    "Pago tardío asignado al próximo turno",
  );
  await usePosStore.getState().addCashMovement({
    type: "CASH_IN",
    amount: 75,
    reason: "  Reposición  ",
    createdBy: "Cajero B",
  });
  const secondSummary = await usePosStore.getState().closeShift({
    closedBy: "Cajero B",
    declaredCash: 375,
    posnetItems: [
      {
        id: "qr-batch",
        label: "QR",
        systemAmount: pendingSale.total,
        declaredAmount: pendingSale.total,
      },
    ],
    reconciliationPending: true,
    notes: "Cierre normal",
  });
  assertEqual(secondSummary.expectedCash, 375, "Efectivo esperado del segundo turno");
  assertEqual(secondSummary.latePaymentsCount, 1, "Pago tardío incluido en el resumen");
  assertEqual(
    secondSummary.totalsByPayment.QR,
    pendingSale.total,
    "Pago tardío contado en el medio de pago correcto",
  );

  await usePosStore.getState().updateShiftReconciliation(
    secondShift.id,
    [
      {
        id: "qr-batch",
        label: "QR",
        systemAmount: pendingSale.total,
        declaredAmount: pendingSale.total,
      },
    ],
    false,
  );
  await usePosStore.getState().resolveShiftApproval(
    secondShift.id,
    "OBSERVED",
    "Encargado",
    "Revisar comprobante QR",
  );
  const reconciledShift = await getCashShift(secondShift.id);
  assertEqual(
    reconciledShift?.closeSummary?.expectedCash,
    375,
    "Conciliación y aprobación preservan el arqueo",
  );
  assertEqual(
    reconciledShift?.closeSummary?.reconciliationPending,
    false,
    "Conciliación posterior completada",
  );
  assertEqual(
    reconciledShift?.closeSummary?.approvalStatus,
    "OBSERVED",
    "Aprobación posterior actualizada",
  );
  assertEqual(
    reconciledShift?.closeSummary?.notes,
    "Cierre normal",
    "Aprobación conserva las notas base del cierre",
  );
  assertEqual(
    reconciledShift?.closeSummary?.observations,
    "Revisar comprobante QR",
    "Observación de aprobación almacenada aparte",
  );
  assertEqual(
    (await getCashShift(firstShift.id))?.closeSummary?.expectedCash,
    500,
    "Pago tardío no modifica el turno cerrado de origen",
  );

  const thirdShift = await usePosStore.getState().openShift({
    cashierName: "Cajero C",
    openingCash: 50,
  });
  await assertRejects(
    () =>
      usePosStore.getState().relayShift({
        closedBy: "Cajero C",
        declaredCash: -1,
        nextCashierName: "Cajero D",
        nextOpeningCash: 25,
      }),
    "Relevo inválido debe fallar",
  );
  assertEqual(
    (await getCashShift(thirdShift.id))?.status,
    "OPEN",
    "Fallo del relevo no cierra el turno saliente",
  );

  const fourthShift = await usePosStore.getState().relayShift({
    closedBy: "Cajero C",
    declaredCash: 50,
    nextCashierName: "Cajero D",
    nextOpeningCash: 25,
  });
  assertEqual(fourthShift.shiftNumber, "4", "Relevo mantiene correlativo");
  assertEqual(
    (await getCashShift(thirdShift.id))?.status,
    "CLOSED",
    "Relevo cierra el turno saliente",
  );
  assertEqual(
    (await getOpenCashShift(businessId, branchId))?.id,
    fourthShift.id,
    "Relevo abre el siguiente turno",
  );

  await usePosStore.getState().hydrate(businessId, branchId);
  assertEqual(
    usePosStore.getState().activeShift?.id,
    fourthShift.id,
    "Hidratación recupera el turno abierto tras recarga",
  );
  assertEqual(
    usePosStore.getState().shifts.length,
    4,
    "Hidratación recupera turnos abiertos y cerrados",
  );
  assertEqual(
    usePosStore
      .getState()
      .shifts.find((shift) => shift.id === secondShift.id)
      ?.closeSummary?.expectedCash,
    375,
    "Hidratación conserva resúmenes de cierre",
  );
  assertEqual(
    usePosStore
      .getState()
      .completedSales.find((sale) => sale.id === pendingSale.id)
      ?.settledInShiftId,
    secondShift.id,
    "Hidratación conserva la atribución del pago tardío",
  );
}

testIndexedDbUpgrade()
  .then(testIndexedDbCashFlow)
  .then(testStoreShiftFlow)
  .then(() => console.log("Cash register model and calculation tests passed."))
  .catch((error: unknown) => {
    console.error(error);
    throw error;
  });
