import type {
  BuzzerState,
  CartItem,
  PrintJob,
  PrintTarget,
  Product,
  Sale,
} from "../types/pos";

export function requiresPreparation(
  product: Product,
): boolean {
  if (product.requiresPrep !== undefined) return product.requiresPrep;
  return ["Sandwiches", "Licuados", "Combos"].includes(product.category);
}

export function findNextAvailableBuzzer(
  activeBuzzers: BuzzerState[],
  from = 1,
  to = 50,
): string | null {
  const inUse = new Set(
    activeBuzzers
      .filter((buzzer) => !buzzer.releasedAt)
      .map((buzzer) => buzzer.number),
  );
  for (let number = from; number <= to; number += 1) {
    const formatted = String(number).padStart(2, "0");
    if (!inUse.has(formatted)) return formatted;
  }
  return null;
}

function ticketNumberForSale(sale: Sale): string {
  const digits = sale.id.replace(/\D/g, "");
  return digits.slice(-6).padStart(6, "0") || sale.id.slice(-6).toUpperCase();
}

function formatModifiers(item: CartItem): string {
  return item.selectedModifiers.map((modifier) => modifier.name).join(", ");
}

function ticketPayload(
  sale: Sale,
  ticketNumber: string,
  buzzerNumber?: string,
): string {
  const lines = [
    "================================",
    "       KIOSCO TERMAS",
    `TICKET #${ticketNumber}`,
    `FECHA ${new Date(sale.createdAt).toLocaleString("es-AR")}`,
    `OPERADOR ${sale.operatedBy ?? "Operador 1"}`,
    sale.qrAccountLabel ? `QR ${sale.qrAccountLabel}` : undefined,
    "================================",
    ...sale.items.map((item) => {
      const modifiers = formatModifiers(item);
      return `${item.qty}x ${item.name}${modifiers ? ` - ${modifiers}` : ""}`;
    }),
    "--------------------------------",
    `TOTAL ${sale.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
    buzzerNumber ? `LLAMADOR N° ${buzzerNumber}` : undefined,
    "================================",
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n");
}

function comandaPayload(
  sale: Sale,
  ticketNumber: string,
  buzzerNumber: string,
  items: CartItem[],
): string {
  return [
    "================================",
    `COMANDA #${ticketNumber}`,
    `LLAMADOR N° ${buzzerNumber}`,
    `OPERADOR ${sale.operatedBy ?? "Operador 1"}`,
    "================================",
    ...items.map((item) => {
      const modifiers = formatModifiers(item);
      return `${item.qty}x ${item.name}${modifiers ? ` | ${modifiers}` : ""}`;
    }),
    "================================",
  ].join("\n");
}

export interface DispatchBuildResult {
  sale: Sale;
  jobs: PrintJob[];
  buzzerNumber?: string;
}

export function buildDispatchJobs(
  sale: Sale,
  products: Product[],
  activeBuzzers: BuzzerState[] = [],
): DispatchBuildResult {
  const ticketNumber = ticketNumberForSale(sale);
  const now = new Date().toISOString();
  const productsMap = new Map(products.map((product) => [product.id, product]));
  const prepItems = sale.items.filter((item) => {
    const product = productsMap.get(item.productId);
    return product ? requiresPreparation(product) : false;
  });

  const requestedBuzzer =
    sale.buzzerNumber?.trim().padStart(2, "0");
  const buzzerInUse = requestedBuzzer
    ? activeBuzzers.some(
        (buzzer) => !buzzer.releasedAt && buzzer.number === requestedBuzzer,
      )
    : false;
  const buzzerNumber =
    prepItems.length > 0
      ? requestedBuzzer && !buzzerInUse
        ? requestedBuzzer
        : findNextAvailableBuzzer(activeBuzzers) ?? undefined
      : undefined;

  const targets: PrintTarget[] = [
    "TICKET_PRINTER_1",
    "TICKET_PRINTER_2",
  ];
  const jobs: PrintJob[] = targets.map((target) => ({
    id: `print-${sale.id}-${target}`,
    saleId: sale.id,
    ticketNumber,
    buzzerNumber,
    kind: "CUSTOMER_TICKET",
    target,
    status: "QUEUED",
    payload: ticketPayload(sale, ticketNumber, buzzerNumber),
    attempts: 0,
    createdAt: now,
  }));

  if (buzzerNumber && prepItems.length > 0) {
    jobs.push({
      id: `print-${sale.id}-KITCHEN_COMANDA`,
      saleId: sale.id,
      ticketNumber,
      buzzerNumber,
      kind: "KITCHEN_COMANDA",
      target: "KITCHEN_PRINTER",
      status: "QUEUED",
      payload: comandaPayload(sale, ticketNumber, buzzerNumber, prepItems),
      attempts: 0,
      createdAt: now,
    });
  }

  return {
    sale: {
      ...sale,
      buzzerNumber,
    },
    jobs,
    buzzerNumber,
  };
}
