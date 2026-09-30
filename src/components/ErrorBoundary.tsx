import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("NetScope Uncaught Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07090d] text-white p-6 font-mono select-none">
          <div className="max-w-md w-full bg-[#0d131f] border border-red-500/30 rounded-xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.15)] flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-red-400 uppercase tracking-widest">
                Render Error Intercepted
              </h2>
              <p className="text-xs text-slate-400 mt-2 line-clamp-3">
                {this.state.error?.message || "An unexpected error occurred during rendering."}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 hover:border-cyan-400/50 rounded-lg text-xs font-mono text-cyan-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
