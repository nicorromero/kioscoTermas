import type { PrintJob } from "../types/pos";

export type PrinterBridgeMode = "LOCAL_HTTP" | "SIMULATOR";

export interface PrinterBridgeStatus {
  mode: PrinterBridgeMode;
  daemonAvailable: boolean;
  endpoint: string;
}

const DEFAULT_ENDPOINT =
  (typeof window !== "undefined"
    ? window.localStorage.getItem("kioscoTermas:printerEndpoint")
    : null) || "http://localhost:9100/print";

export async function probePrinterBridge(
  endpoint = DEFAULT_ENDPOINT,
): Promise<PrinterBridgeStatus> {
  try {
    const base = endpoint.replace(/\/print\/?$/, "");
    const response = await fetch(`${base}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(800),
    });
    return {
      mode: "LOCAL_HTTP",
      daemonAvailable: response.ok,
      endpoint,
    };
  } catch {
    return {
      mode: "SIMULATOR",
      daemonAvailable: false,
      endpoint,
    };
  }
}

export async function sendPrintJob(
  job: PrintJob,
  endpoint = DEFAULT_ENDPOINT,
): Promise<void> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jobId: job.id,
        saleId: job.saleId,
        ticketNumber: job.ticketNumber,
        buzzerNumber: job.buzzerNumber,
        kind: job.kind,
        target: job.target,
        payload: job.payload,
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      throw new Error(`Daemon respondió ${response.status}`);
    }
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("No se pudo enviar el trabajo de impresión");
  }
}
