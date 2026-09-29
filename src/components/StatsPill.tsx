import React from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";

export const StatsPill: React.FC = () => {
  const { nodes, links, alerts } = useNetScopeStore();

  const nodeCount = Object.keys(nodes).length || 98;
  const linkCount = Object.keys(links).length || 42;
  const threatCount = alerts.filter((a) => !a.acked).length;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-3 px-4 py-1.5 rounded-full cyber-panel text-xs text-slate-300 font-mono shadow-2xl border border-white/[0.08]">
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
      </div>
    </div>
  );
};
