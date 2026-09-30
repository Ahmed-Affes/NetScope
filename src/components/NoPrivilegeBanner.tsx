import React, { useState } from "react";
import { ShieldCheck, X, ChevronRight, ExternalLink } from "lucide-react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { commands } from "../bindings";

export const NoPrivilegeBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const trafficMode = useNetScopeStore((s) => s.trafficMode);

  if (dismissed || trafficMode === "simulator") return null;

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 w-auto max-w-2xl px-4 py-2 bg-[#0c121e]/90 border border-emerald-500/30 rounded-lg shadow-[0_4px_24px_rgba(16,185,129,0.15)] backdrop-blur-md text-xs font-mono text-slate-300 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3">
        <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1">
          <span className="font-semibold text-emerald-400 mr-2 tracking-wider">
            SOCKET ATTRIBUTION ACTIVE:
          </span>
          <span className="text-slate-400">
            NetScope is monitoring active process sockets via OS tables with zero elevated privileges needed.
          </span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-0.5 px-2 py-1 rounded bg-cyan-950/40 border border-cyan-800/40 text-[11px]"
        >
          {showDetails ? "Hide" : "Optional Npcap"}
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
        <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
          <p className="text-slate-300">
            Socket mode works out of the box without any drivers. If you want raw promiscuous packet capture (payload byte deltas), install the official Npcap driver:
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => commands.openExternalUrl("https://npcap.com/#download")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <span>Download Npcap Installer (Official)</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <span className="text-[10px] text-slate-500">
              Only needed for raw promiscuous frame sniffing. Not required for standard NetScope monitoring.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
