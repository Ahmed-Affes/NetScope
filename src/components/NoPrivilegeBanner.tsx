import React, { useState } from "react";
import { ShieldAlert, X, ChevronRight, Terminal } from "lucide-react";
import { useNetScopeStore } from "../store/useNetScopeStore";

export const NoPrivilegeBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const trafficMode = useNetScopeStore((s) => s.trafficMode);

  if (dismissed || trafficMode === "simulator") return null;

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 w-auto max-w-2xl px-4 py-2 bg-[#0c121e]/90 border border-amber-500/30 rounded-lg shadow-[0_4px_24px_rgba(245,158,11,0.15)] backdrop-blur-md text-xs font-mono text-slate-300 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3">
        <div className="p-1 rounded bg-amber-500/20 text-amber-400">
          <ShieldAlert className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1">
          <span className="font-semibold text-amber-400 mr-2 tracking-wider">
            SOCKET INSPECTION MODE:
          </span>
          <span className="text-slate-400">
            Attributing live sockets to processes via OS tables. Deep packet inspection requires elevated Npcap.
          </span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-0.5 px-2 py-1 rounded bg-cyan-950/40 border border-cyan-800/40 text-[11px]"
        >
          {showDetails ? "Hide" : "Setup Npcap"}
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-white/5"
          title="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {showDetails && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-start gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-slate-200">
                To capture raw packet rates, flow headers, and payload byte-deltas:
              </p>
              <div className="mt-1 bg-black/60 p-2 rounded border border-slate-800 font-mono text-[10px] text-amber-300">
                winget install Insecure.Npcap
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Ensure &quot;WinPcap API-compatible Mode&quot; is checked during installation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
