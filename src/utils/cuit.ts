// ─── Utilidad CUIT Argentino (ARCA / ex AFIP) ─────────────────────────────────
// Valida formato, tipo de persona y dígito verificador (Algoritmo Módulo 11).

/** Limpia cualquier caracter no numérico */
export function cleanCuit(cuit: string): string {
  return cuit.replace(/\D/g, "");
}

/** Formatea número a máscara XX-XXXXXXXX-X */
export function formatCuit(cuit: string): string {
  const clean = cleanCuit(cuit).slice(0, 11);
  if (clean.length <= 2) return clean;
  if (clean.length <= 10) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}

/**
 * Valida un CUIT/CUIL argentino mediante el algoritmo oficial de Módulo 11.
 * Retorna true si tiene 11 dígitos, prefijo válido y dígito verificador correcto.
 */
export function isValidCuit(cuit: string): boolean {
  const clean = cleanCuit(cuit);
  if (clean.length !== 11) return false;

  const validPrefixes = ["20", "23", "24", "27", "30", "33", "34"];
  const prefix = clean.slice(0, 2);
  if (!validPrefixes.includes(prefix)) return false;

  const digits = clean.split("").map(Number);
  const checkDigit = digits[10];
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * multipliers[i];
  }

  const mod = 11 - (sum % 11);
  const expectedCheckDigit = mod === 11 ? 0 : mod === 10 ? 9 : mod;

  return checkDigit === expectedCheckDigit;
}
