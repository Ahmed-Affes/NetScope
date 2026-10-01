import React, { useState } from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { ChevronDown, ChevronUp, Pin, PinOff, Plus, X, RotateCcw, HelpCircle } from "lucide-react";
import { NodeKind } from "../types/graph";

interface NodeTypeConfig {
  label: string;
  kind: NodeKind;
  color: string;
  filter: string;
}

const BASE_NODE_TYPES: NodeTypeConfig[] = [
  { label: "Host PC", kind: "host", color: "#22d3ee", filter: "host" },
  { label: "Gateway", kind: "gateway", color: "#fb923c", filter: "gateway" },
  { label: "LAN Device", kind: "lan", color: "#34d399", filter: "lan" },
  { label: "Process", kind: "process", color: "#e879f9", filter: "process" },
  { label: "Service / Port", kind: "port", color: "#fbbf24", filter: "port" },
  { label: "Docker", kind: "docker", color: "#a78bfa", filter: "docker" },
  { label: "Internet", kind: "internet", color: "#60a5fa", filter: "internet" },
  { label: "Tailscale", kind: "tailscale", color: "#2dd4bf", filter: "tailscale" },
  { label: "Monitor", kind: "monitor", color: "#facc15", filter: "monitor" },
  { label: "Threat", kind: "threat", color: "#ef4444", filter: "threat" },
];

const DEFAULT_PINNED_PORTS = [443, 80, 53, 22];

const STANDARD_PORTS = [
  { port: 443, name: "HTTPS" },
  { port: 80, name: "HTTP" },
  { port: 53, name: "DNS" },
  { port: 22, name: "SSH" },
  { port: 3000, name: "Dev" },
  { port: 5173, name: "Vite" },
  { port: 8080, name: "Proxy" },
  { port: 11434, name: "Ollama" },
];

function getSavedPinnedPorts(): number[] {
  try {
    const raw = localStorage.getItem("netscope_pinned_ports");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to load pinned ports from localStorage:", err);
  }
  return DEFAULT_PINNED_PORTS;
}

function savePinnedPorts(ports: number[]): void {
  try {
    localStorage.setItem("netscope_pinned_ports", JSON.stringify(ports));
  } catch (err) {
    console.warn("Failed to save pinned ports to localStorage:", err);
  }
}

function getServiceLabel(port: number, serviceHint?: string): string {
  if (serviceHint && serviceHint.trim()) {
    return `${serviceHint.toUpperCase()} (${port})`;
  }
  switch (port) {
    case 443:
      return "HTTPS (443)";
    case 80:
      return "HTTP (80)";
    case 53:
      return "DNS (53)";
    case 22:
      return "SSH (22)";
    case 11434:
      return "Ollama (11434)";
    case 7474:
    case 7687:
      return `Neo4j (${port})`;
    case 3000:
      return "Dev/Grafana (3000)";
    case 5173:
      return "Vite (5173)";
    case 8080:
      return "Proxy/Web (8080)";
    case 9090:
      return "Prometheus (9090)";
    default:
      return `Port ${port}`;
  }
}

function getPortColor(port: number): string {
  switch (port) {
    case 443:
      return "#38bdf8"; // Sky blue
    case 80:
      return "#4ade80"; // Green
    case 53:
      return "#fbbf24"; // Amber
    case 22:
      return "#f87171"; // Red
    case 11434:
      return "#818cf8"; // Indigo
    case 7474:
    case 7687:
      return "#c084fc"; // Purple
    case 3000:
    case 9090:
      return "#facc15"; // Yellow
    default:
      return "#94a3b8"; // Slate
  }
}

export const LegendPanel: React.FC = () => {
  const { isLegendOpen, toggleLegend, activeFilter, setActiveFilter, nodes, links } =
    useNetScopeStore();

  const [pinnedPorts, setPinnedPorts] = useState<number[]>(getSavedPinnedPorts);
  const [showAddPort, setShowAddPort] = useState(false);
  const [customPortInput, setCustomPortInput] = useState("");

  const missingDefaults = DEFAULT_PINNED_PORTS.filter(
    (p) => !pinnedPorts.includes(p)
  );

  const handleResetDefaultPorts = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedPorts(DEFAULT_PINNED_PORTS);
    savePinnedPorts(DEFAULT_PINNED_PORTS);
  };

  const nodesList = Object.values(nodes);
  const linksList = Object.values(links);

  // Compute live node counts per kind
  const nodeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodesList) {
      counts[n.kind] = (counts[n.kind] || 0) + 1;
    }
    return counts;
  }, [nodesList]);

  // Compute live traffic / port counts
  const { trafficRows, otherCount } = React.useMemo(() => {
    const portMap = new Map<number, { count: number; serviceHint?: string }>();
    let udpCount = 0;

    for (const l of linksList) {
      if (l.proto.toLowerCase() === "udp") {
        udpCount++;
      }
      if (l.port && l.port > 0) {
        const cur = portMap.get(l.port) || { count: 0 };
        portMap.set(l.port, {
          count: cur.count + 1,
          serviceHint: cur.serviceHint || l.service,
        });
      }
    }

    // Build list of ports: pinned ports + top active ports
    const allPortEntries = Array.from(portMap.entries()).sort(
      (a, b) => b[1].count - a[1].count
    );

    const shownPortSet = new Set<number>(pinnedPorts);
    // Add top 5 active ports even if not pinned
    for (const [p] of allPortEntries) {
      if (shownPortSet.size >= 8) break;
      shownPortSet.add(p);
    }

    const rows: {
      port: number;
      label: string;
      color: string;
      count: number;
      filter: string;
      isPinned: boolean;
    }[] = [];

    // Add port rows
    for (const port of shownPortSet) {
      const info = portMap.get(port);
      const count = info ? info.count : 0;
      rows.push({
        port,
        label: getServiceLabel(port, info?.serviceHint),
        color: getPortColor(port),
        count,
        filter: `port:${port}`,
        isPinned: pinnedPorts.includes(port),
      });
    }

    // Sort: pinned/active first, then count desc
    rows.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.port - b.port;
    });

    // Compute "other" count for ports not shown
    let unshownTrafficCount = 0;
    for (const [port, info] of allPortEntries) {
      if (!shownPortSet.has(port)) {
        unshownTrafficCount += info.count;
      }
    }

    // Add UDP row
    rows.push({
      port: 0,
      label: "UDP Datagrams",
      color: "#94a3b8",
      count: udpCount,
      filter: "proto:udp",
      isPinned: false,
    });

    return { trafficRows: rows, otherCount: unshownTrafficCount };
  }, [linksList, pinnedPorts]);

  const handleTogglePin = (e: React.MouseEvent, port: number) => {
    e.stopPropagation();
    let next: number[];
    if (pinnedPorts.includes(port)) {
      next = pinnedPorts.filter((p) => p !== port);
    } else {
      next = [...pinnedPorts, port];
    }
    setPinnedPorts(next);
    savePinnedPorts(next);
  };

  const handleAddCustomPort = (e: React.FormEvent) => {
    e.preventDefault();
    const port = parseInt(customPortInput.trim(), 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      if (!pinnedPorts.includes(port)) {
        const next = [...pinnedPorts, port];
        setPinnedPorts(next);
        savePinnedPorts(next);
      }
      setCustomPortInput("");
      setShowAddPort(false);
    }
  };

  if (!isLegendOpen) {
    return (
      <div className="absolute bottom-4 right-4 z-40">
        <button
          onClick={toggleLegend}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e121a]/95 hover:bg-[#141a26] border border-white/[0.08] hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs font-mono backdrop-blur-md shadow-xl transition-all cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="font-semibold text-[11px] tracking-wider uppercase">LEGEND</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-30 w-64 cyber-panel text-xs transition-all duration-200 shadow-2xl flex flex-col max-h-[440px] overflow-hidden pointer-events-auto border border-slate-700/60 bg-[#090d14]/95 backdrop-blur-xl rounded-xl">
      {/* Header */}
      <div
        onClick={toggleLegend}
        className="flex items-center justify-between px-3 py-2 cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.02] bg-[#0c1018] shrink-0"
      >
        <span className="font-bold tracking-wider text-slate-300 text-[11px] uppercase">
          Topology Legend
        </span>
        <button className="text-slate-400 hover:text-slate-200 cursor-pointer">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-2.5 space-y-3 overflow-y-auto custom-scrollbar flex-1">
        {/* Node Categories */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 uppercase flex justify-between items-center">
            <span>Nodes</span>
            <span className="text-[9px] font-mono text-slate-500">Live Count</span>
          </div>
          <div className="space-y-1">
            {BASE_NODE_TYPES.map((t) => {
              const isFiltered = activeFilter === t.filter;
              const count = nodeCounts[t.kind] || 0;
              const isDimmed = count === 0;

              return (
                <div
                  key={t.label}
                  onClick={() =>
                    setActiveFilter(activeFilter === t.filter ? null : t.filter)
                  }
                  className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                    isFiltered
                      ? "bg-white/[0.08]"
                      : isDimmed
                      ? "hover:bg-white/[0.02] opacity-40"
                      : "hover:bg-white/[0.04]"
                  }`}
                  title={`${t.label}: ${count} active node${count === 1 ? "" : "s"}`}
                >
                  <div className="flex items-center gap-2 truncate pr-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span
                      className={`text-[11px] truncate ${
                        isFiltered
                          ? "text-white font-semibold"
                          : isDimmed
                          ? "text-slate-500"
                          : "text-slate-300"
                      }`}
                    >
                      {t.label}
                    </span>
                  </div>

                  <span
                    className={`font-mono text-[10px] px-1 rounded ${
                      count > 0 && t.kind === "threat"
                        ? "bg-rose-500/20 text-rose-300 font-bold"
                        : count > 0
                        ? "text-slate-300"
                        : "text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Traffic & Port Quick Filters */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 uppercase flex justify-between items-center">
            <div className="flex items-center gap-1">
              <span>Traffic & Protocols</span>
              <span
                className="text-slate-500 hover:text-slate-300 cursor-help"
                title="Click any protocol to filter the graph. Pinned ports stay in this list for quick access even when idle."
              >
                <HelpCircle className="w-2.5 h-2.5" />
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {missingDefaults.length > 0 && (
                <button
                  onClick={handleResetDefaultPorts}
                  className="text-[9px] text-amber-400/90 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                  title="Restore default pinned ports (HTTPS, HTTP, DNS, SSH)"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Reset</span>
                </button>
              )}
              <button
                onClick={() => setShowAddPort(!showAddPort)}
                className="text-[9px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer"
                title="Pin a custom port"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Pin Port</span>
              </button>
            </div>
          </div>

          {showAddPort && (
            <div className="p-2 mb-2 rounded-lg bg-black/60 border border-slate-700/60 space-y-1.5">
              <form onSubmit={handleAddCustomPort} className="flex gap-1">
                <input
                  type="number"
                  value={customPortInput}
                  onChange={(e) => setCustomPortInput(e.target.value)}
                  placeholder="Port (e.g. 8080)"
                  className="w-full px-2 py-0.5 rounded bg-black/60 border border-white/[0.1] text-[10px] text-white font-mono focus:border-cyan-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-semibold cursor-pointer hover:bg-cyan-500/30"
                >
                  Pin
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPort(false)}
                  className="px-1 py-0.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
              <div className="flex flex-wrap gap-1">
                {STANDARD_PORTS.filter((s) => !pinnedPorts.includes(s.port)).map((s) => (
                  <button
                    key={s.port}
                    type="button"
                    onClick={(e) => handleTogglePin(e, s.port)}
                    className="px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/[0.06] hover:border-cyan-500/40 text-[9px] font-mono transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-2 h-2" />
                    <span>{s.name} ({s.port})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {trafficRows.map((t) => {
              const isFiltered = activeFilter === t.filter;
              const isDimmed = t.count === 0;

              return (
                <div
                  key={t.filter}
                  onClick={() =>
                    setActiveFilter(activeFilter === t.filter ? null : t.filter)
                  }
                  className={`group flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                    isFiltered
                      ? "bg-white/[0.08]"
                      : isDimmed
                      ? "hover:bg-white/[0.02] opacity-40"
                      : "hover:bg-white/[0.04]"
                  }`}
                  title={`${t.label}: ${t.count} active connection${t.count === 1 ? "" : "s"} (click to filter)`}
                >
                  <div className="flex items-center gap-1.5 truncate pr-1">
                    <span
                      className="w-2.5 h-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span
                      className={`text-[11px] truncate ${
                        isFiltered
                          ? "text-white font-semibold"
                          : isDimmed
                          ? "text-slate-500"
                          : "text-slate-300"
                      }`}
                    >
                      {t.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`font-mono text-[10px] ${
                        t.count > 0 ? "text-cyan-300 font-semibold" : "text-slate-600"
                      }`}
                    >
                      {t.count}
                    </span>
                    {t.port > 0 && (
                      <button
                        onClick={(e) => handleTogglePin(e, t.port)}
                        className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                          t.isPinned
                            ? "text-amber-400 opacity-100"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                        title={
                          t.isPinned
                            ? "Pinned: Stays in quick list even with 0 active connections. Click to unpin."
                            : "Unpinned: Pin to keep in quick list even when idle."
                        }
                      >
                        {t.isPinned ? (
                          <Pin className="w-2.5 h-2.5 fill-amber-400/40" />
                        ) : (
                          <PinOff className="w-2.5 h-2.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {otherCount > 0 && (
              <div
                className="flex items-center justify-between p-1 rounded text-slate-500 text-[10px] italic"
                title="Other ports active on your PC"
              >
                <span>Other Ports</span>
                <span className="font-mono text-[10px]">{otherCount}</span>
              </div>
            )}
          </div>

          {/* Quick-restore bar if any standard default port was unpinned */}
          {missingDefaults.length > 0 && (
            <div className="mt-2.5 pt-1.5 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1">
                <span>Restore standard ports:</span>
                <button
                  onClick={handleResetDefaultPorts}
                  className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                >
                  Reset all
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {missingDefaults.map((port) => (
                  <button
                    key={port}
                    onClick={(e) => handleTogglePin(e, port)}
                    className="px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/[0.06] hover:border-cyan-500/40 text-[9px] font-mono transition-colors flex items-center gap-1 cursor-pointer"
                    title={`Pin ${getServiceLabel(port)} back to list`}
                  >
                    <Plus className="w-2 h-2" />
                    <span>{getServiceLabel(port).split(" ")[0]} ({port})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
