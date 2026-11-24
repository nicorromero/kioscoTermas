// ─── Utilidades de formateo para POS ─────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Calcula tiempo relativo transcurrido en español (ej: "hace 14s", "hace 2m") */
export function formatElapsedTime(isoDateString: string): string {
  const diffMs = Date.now() - new Date(isoDateString).getTime();
  const seconds = Math.floor(Math.max(0, diffMs) / 1000);

  if (seconds < 60) {
    return `hace ${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (minutes < 60) {
    return `hace ${minutes}m ${remainingSecs}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h`;
}
