import React from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { ChevronDown, ChevronUp } from "lucide-react";

export const LegendPanel: React.FC = () => {
  const { isLegendOpen, toggleLegend, activeFilter, setActiveFilter } =
    useNetScopeStore();

  const nodeTypes = [
    { label: "Host", color: "#22d3ee", filter: "host" },
    { label: "Gateway", color: "#fb923c", filter: "gateway" },
    { label: "LAN Device", color: "#34d399", filter: "lan" },
    { label: "Docker", color: "#a78bfa", filter: "docker" },
    { label: "Internet", color: "#60a5fa", filter: "internet" },
    { label: "Tailscale", color: "#2dd4bf", filter: "tailscale" },
    { label: "Monitor", color: "#facc15", filter: "monitor" },
    { label: "Threat", color: "#ef4444", filter: "threat" },
  ];

  const linkTypes = [
    { label: "SSH (22)", color: "#f87171", filter: "port:22" },
    { label: "HTTP (80)", color: "#4ade80", filter: "port:80" },
    { label: "HTTPS (443)", color: "#38bdf8", filter: "port:443" },
    { label: "Neo4j (7474)", color: "#c084fc", filter: "port:7474" },
    { label: "Ollama (11434)", color: "#818cf8", filter: "port:11434" },
    { label: "kruel (8000)", color: "#fb923c", filter: "port:8000" },
    { label: "DNS (53)", color: "#fbbf24", filter: "port:53" },
    { label: "UDP", color: "#94a3b8", filter: "proto:udp" },
  ];

  return (
    <div className="absolute bottom-4 right-4 z-40 w-44 cyber-panel text-xs transition-all duration-200">
      {/* Header */}
      <div
        onClick={toggleLegend}
        className="flex items-center justify-between px-3 py-2 cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.02]"
      >
        <span className="font-bold tracking-wider text-slate-300 text-[11px]">
          Legend
        </span>
        <button className="text-slate-400 hover:text-slate-200">
          {isLegendOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Body */}
      {isLegendOpen && (
        <div className="p-2.5 space-y-3">
          {/* Nodes */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 uppercase">
              Nodes
            </div>
            <div className="space-y-1">
              {nodeTypes.map((t) => {
                const isFiltered = activeFilter === t.filter;
                return (
                  <div
                    key={t.label}
                    onClick={() => setActiveFilter(t.filter)}
                    className={`flex items-center gap-2 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      isFiltered
                        ? "bg-white/[0.1] text-white font-semibold"
                        : "text-slate-300 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shadow-[0_0_6px_var(--glow)]"
                      style={
                        {
                          backgroundColor: t.color,
                          "--glow": t.color,
                        } as React.CSSProperties
                      }
                    />
                    <span className="text-[11px]">{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connections */}
          <div className="pt-2 border-t border-white/[0.05]">
            <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 uppercase">
              Connections
            </div>
            <div className="space-y-1">
              {linkTypes.map((t) => {
                const isFiltered = activeFilter === t.filter;
                return (
                  <div
                    key={t.label}
                    onClick={() => setActiveFilter(t.filter)}
                    className={`flex items-center gap-2 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      isFiltered
                        ? "bg-white/[0.1] text-white font-semibold"
                        : "text-slate-300 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className="w-3 h-[2px] rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="text-[10px] font-mono">{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
