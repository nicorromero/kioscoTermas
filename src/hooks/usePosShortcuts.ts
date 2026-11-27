// ─── Hook de Atajos de Teclado POS – Kiosco Termas ────────────────────────────
// Centraliza los atajos de teclado para operaciones ágiles de mostrador.
// Maneja F2, F8, F9, Esc y +/- de cantidad respetando los inputs de texto.

import { useEffect, type RefObject } from "react";

export interface PosShortcutsOptions {
  /** Ref al input del buscador para enfocar con F2 */
  searchInputRef?: RefObject<HTMLInputElement | null>;
  /** Callback para abrir modal de cobro (F8) */
  onOpenCheckout?: () => void;
  /** Callback para cobro rápido en efectivo (F9) */
  onQuickCash?: () => void;
  /** Callback para cerrar modal/paneles con Esc sin perder el carrito */
  onEscape?: () => void;
  /** Callback al presionar '+' (ajusta cantidad del último ítem en carrito) */
  onIncrementLastItem?: () => void;
  /** Callback al presionar '-' (ajusta cantidad del último ítem en carrito) */
  onDecrementLastItem?: () => void;
  onToggleOperator?: () => void;
  onSendToQr1?: () => void;
  onSendToQr2?: () => void;
  onOpenBuzzerPanel?: () => void;
  onNavigateCatalog?: (direction: "UP" | "DOWN") => void;
  onEnterCatalogSelection?: () => void;
  /** Si true, deshabilita temporalmente los atajos */
  disabled?: boolean;
}

/**
 * Escucha atajos globales de mostrador:
 * - F2: Enfoca buscador/lector.
 * - F8: Abre modal de cobro del carrito.
 * - F9: Dispara cobro rápido en efectivo.
 * - Esc: Cierra modales / paneles activos.
 * - '+' / '-': Ajusta cantidad del último ítem (fuera de inputs/textareas).
 */
export function usePosShortcuts({
  searchInputRef,
  onOpenCheckout,
  onQuickCash,
  onEscape,
  onIncrementLastItem,
  onDecrementLastItem,
  onToggleOperator,
  onSendToQr1,
  onSendToQr2,
  onOpenBuzzerPanel,
  onNavigateCatalog,
  onEnterCatalogSelection,
  disabled = false,
}: PosShortcutsOptions): void {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. No intervenir ante combinaciones del sistema o navegador (Ctrl, Cmd/Meta, Alt)
      // Preserva Ctrl++ / Ctrl+- (zoom del navegador), Ctrl+R (recargar), Ctrl+F, etc.
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        Boolean(target?.isContentEditable);

      // ── F2: Enfocar buscador/lector ──
      if (event.key === "F2") {
        event.preventDefault();
        searchInputRef?.current?.focus();
        searchInputRef?.current?.select();
        return;
      }

      // ── Esc: Cerrar modal / panel ──
      // Esc opera globalmente para poder cerrar modales o deseleccionar sin tocar el carrito
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape?.();
        return;
      }

      // ── Si el foco está dentro de un campo de texto o formulario, no disparar atajos de mostrador ──
      if (isInput) {
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        onToggleOperator?.();
        return;
      }

      if (event.key === "F6") {
        event.preventDefault();
        onSendToQr1?.();
        return;
      }

      if (event.key === "F7") {
        event.preventDefault();
        onSendToQr2?.();
        return;
      }

      if (event.key === "F10") {
        event.preventDefault();
        onOpenBuzzerPanel?.();
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        onNavigateCatalog?.(event.key === "ArrowUp" ? "UP" : "DOWN");
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        onEnterCatalogSelection?.();
        return;
      }

      // ── F8: Abrir cobro ──
      if (event.key === "F8") {
        event.preventDefault();
        onOpenCheckout?.();
        return;
      }

      // ── F9: Cobro rápido en efectivo ──
      if (event.key === "F9") {
        event.preventDefault();
        onQuickCash?.();
        return;
      }

      // ── '+' y '-': Ajustar cantidad del último ítem (SOLO FUERA DE INPUTS) ──
      if (
        event.key === "+" ||
        event.code === "NumpadAdd" ||
        (event.key === "=" && event.shiftKey)
      ) {
        event.preventDefault();
        onIncrementLastItem?.();
        return;
      }

      if (
        event.key === "-" ||
        event.code === "NumpadSubtract" ||
        event.code === "Minus"
      ) {
        event.preventDefault();
        onDecrementLastItem?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    searchInputRef,
    onOpenCheckout,
    onQuickCash,
    onEscape,
    onIncrementLastItem,
    onDecrementLastItem,
    onToggleOperator,
    onSendToQr1,
    onSendToQr2,
    onOpenBuzzerPanel,
    onNavigateCatalog,
    onEnterCatalogSelection,
    disabled,
  ]);
}
