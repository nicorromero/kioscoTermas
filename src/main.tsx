import React, { Component, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary capturó un error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-950 text-white p-8 flex flex-col items-center justify-center font-mono">
          <div className="max-w-xl w-full bg-rose-950/40 border border-rose-800 p-6 rounded-2xl">
            <h1 className="text-xl font-bold text-rose-400 mb-2">
              ⚠️ Error al renderizar POS
            </h1>
            <p className="text-sm text-slate-300 mb-4">
              {this.state.error?.message || "Error desconocido"}
            </p>
            <pre className="text-xs bg-slate-950 p-3 rounded-lg overflow-x-auto text-slate-400">
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
