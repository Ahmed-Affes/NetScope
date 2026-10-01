import React from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";

export const StatsPill: React.FC = () => {
  const { nodes, links, alerts, metrics } = useNetScopeStore();

  const nodeCount = Object.keys(nodes).length;
  const linkCount = Object.keys(links).length;
  const threatCount = alerts.filter((a) => !a.acked).length;

  const formatRate = (bytesSec: number = 0) => {
    if (bytesSec < 1024) return `${bytesSec.toFixed(0)} B/s`;
    if (bytesSec < 1024 * 1024) return `${(bytesSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesSec / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <div className="flex items-center gap-3 px-4 py-1.5 rounded-full cyber-panel text-xs text-slate-300 font-mono shadow-2xl border border-white/[0.08] backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-bold text-[10px] tracking-wider uppercase text-slate-400">
            LIVE PC
          </span>
        </div>
        <span className="text-white/20">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Nodes:</span>
          <span className="font-bold text-cyan-400">{nodeCount}</span>
        </div>
        <span className="text-white/20">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Links:</span>
          <span className="font-bold text-purple-400">{linkCount}</span>
        </div>
        <span className="text-white/20">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Threats:</span>
          <span
            className={`font-bold ${
              threatCount > 0 ? "text-red-400 animate-pulse" : "text-emerald-400"
            }`}
          >
            {threatCount}
          </span>
        </div>
        {((metrics.networkRxRate ?? 0) > 0 || (metrics.networkTxRate ?? 0) > 0) && (
          <>
            <span className="text-white/20">|</span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-emerald-400 font-mono">↓ {formatRate(metrics.networkRxRate)}</span>
              <span className="text-cyan-400 font-mono">↑ {formatRate(metrics.networkTxRate)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
