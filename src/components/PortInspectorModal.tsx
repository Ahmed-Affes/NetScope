import React, { useEffect, useState, useMemo } from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { commands, SocketInfo } from "../bindings";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Filter,
  Network,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  X,
} from "lucide-react";

type FilterTab = "all" | "listening" | "established" | "tcp" | "udp" | "local";

export const PortInspectorModal: React.FC = () => {
  const {
    isPortInspectorOpen,
    closePortInspector,
    setSearchQuery,
    selectNode,
    nodes,
  } = useNetScopeStore();

  const [sockets, setSockets] = useState<SocketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const fetchSockets = async () => {
    try {
      setLoading(true);
      const data = await commands.getActiveSockets();
      setSockets(data);
    } catch (err) {
      console.error("Failed to fetch sockets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPortInspectorOpen) {
      fetchSockets();
    }
  }, [isPortInspectorOpen]);

  // Auto-refresh interval
  useEffect(() => {
    if (!isPortInspectorOpen || !autoRefresh) return;
    const interval = setInterval(fetchSockets, 2500);
    return () => clearInterval(interval);
  }, [isPortInspectorOpen, autoRefresh]);

  // Keyboard shortcut to close (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPortInspectorOpen) {
        closePortInspector();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPortInspectorOpen, closePortInspector]);

  // Compute summary metrics
  const stats = useMemo(() => {
    let listening = 0;
    let established = 0;
    let tcp = 0;
    let udp = 0;
    const procSet = new Set<string>();

    for (const s of sockets) {
      if (s.state.toUpperCase() === "LISTENING") listening++;
      if (s.state.toUpperCase() === "ESTABLISHED") established++;
      if (s.proto.toLowerCase() === "tcp") tcp++;
      if (s.proto.toLowerCase() === "udp") udp++;
      if (s.processName) procSet.add(s.processName);
    }

    return {
      total: sockets.length,
      listening,
      established,
      tcp,
      udp,
      uniqueProcs: procSet.size,
    };
  }, [sockets]);

  // Filtered sockets
  const filteredSockets = useMemo(() => {
    const q = search.trim().toLowerCase();

    return sockets.filter((s) => {
      // Tab filter
      if (activeTab === "listening" && s.state.toUpperCase() !== "LISTENING") return false;
      if (activeTab === "established" && s.state.toUpperCase() !== "ESTABLISHED") return false;
      if (activeTab === "tcp" && s.proto.toLowerCase() !== "tcp") return false;
      if (activeTab === "udp" && s.proto.toLowerCase() !== "udp") return false;
      if (activeTab === "local") {
        const isLocal =
          s.localIp === "127.0.0.1" ||
          s.localIp === "localhost" ||
          s.localIp === "::1" ||
          s.remoteIp === "127.0.0.1" ||
          s.remoteIp === "localhost";
        if (!isLocal) return false;
      }

      // Search query filter
      if (!q) return true;

      const portMatch =
        s.localPort.toString().includes(q) ||
        s.remotePort.toString().includes(q);
      const procMatch =
        (s.processName?.toLowerCase().includes(q) ?? false) ||
        (s.exePath?.toLowerCase().includes(q) ?? false) ||
        (s.pid?.toString().includes(q) ?? false);
      const ipMatch =
        s.localIp.toLowerCase().includes(q) ||
        s.remoteIp.toLowerCase().includes(q);
      const serviceMatch = s.service?.toLowerCase().includes(q) ?? false;
      const protoMatch = s.proto.toLowerCase().includes(q);
      const stateMatch = s.state.toLowerCase().includes(q);

      return portMatch || procMatch || ipMatch || serviceMatch || protoMatch || stateMatch;
    });
  }, [sockets, activeTab, search]);

  const handleFocusOnGraph = (s: SocketInfo) => {
    // Attempt to match process or port in nodes
    const targetLabel = s.processName ?? `port:${s.localPort}`;
    setSearchQuery(targetLabel);

    // If node exists matching pid or process label, select it
    if (s.pid) {
      const matchedNode = Object.values(nodes).find((n) => n.pid === s.pid);
      if (matchedNode) {
        selectNode(matchedNode.id);
      }
    }

    closePortInspector();
  };

  const handleCopyEndpoint = (s: SocketInfo, idx: number) => {
    const text = `${s.proto.toUpperCase()} ${s.localIp}:${s.localPort} -> ${s.remoteIp}:${s.remotePort} (${s.state}) [${s.processName ?? "Unknown"} PID ${s.pid ?? "-"}]`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleCopyAll = () => {
    const jsonStr = JSON.stringify(filteredSockets, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  if (!isPortInspectorOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={closePortInspector}
    >
      <div
        className="w-full max-w-5xl h-[85vh] flex flex-col cyber-panel shadow-[0_0_60px_rgba(0,0,0,0.9)] border border-cyan-500/40 rounded-lg overflow-hidden bg-[#07090d]/95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#0c1017]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
                  Active Ports & Sockets Inspector
                </h2>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/20">
                  LIVE PC
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Real-time view of every listening port, active socket, process, and remote connection on this computer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border transition-all ${
                autoRefresh
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white"
              }`}
              title="Toggle auto-refresh every 2.5s"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
              <span>Auto-Refresh</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchSockets}
              disabled={loading}
              className="p-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-cyan-400 transition-colors"
              title="Refresh now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>

            {/* Copy Table JSON */}
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] text-slate-300 hover:text-white transition-colors"
              title="Copy filtered sockets as JSON"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-slate-400" />
                  <span>Export JSON</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={closePortInspector}
              className="p-1.5 rounded bg-white/[0.05] hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/[0.08] transition-colors ml-2"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 px-5 py-2.5 bg-[#0a0d14] border-b border-white/[0.06] text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Sockets</span>
            <span className="text-sm font-bold text-slate-100 font-mono">{stats.total}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">Listening (Servers)</span>
            <span className="text-sm font-bold text-cyan-300 font-mono">{stats.listening}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Established (Connected)</span>
            <span className="text-sm font-bold text-emerald-300 font-mono">{stats.established}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-sky-400 uppercase tracking-wider font-semibold">TCP Sockets</span>
            <span className="text-sm font-bold text-sky-300 font-mono">{stats.tcp}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-fuchsia-400 uppercase tracking-wider font-semibold">UDP Endpoints</span>
            <span className="text-sm font-bold text-fuchsia-300 font-mono">{stats.udp}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Active Apps</span>
            <span className="text-sm font-bold text-amber-300 font-mono">{stats.uniqueProcs}</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#080b10] border-b border-white/[0.06]">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-md border border-white/[0.06] text-[11px]">
            {(
              [
                { id: "all", label: `All (${stats.total})` },
                { id: "listening", label: `Listening (${stats.listening})` },
                { id: "established", label: `Connected (${stats.established})` },
                { id: "tcp", label: `TCP (${stats.tcp})` },
                { id: "udp", label: `UDP (${stats.udp})` },
                { id: "local", label: "Localhost / Dev" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTab === tab.id
                    ? "bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex items-center min-w-[280px]">
            <Search className="w-3.5 h-3.5 text-cyan-400/80 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search port (5173), app (node), PID, protocol, IP..."
              className="w-full pl-8 pr-7 py-1 rounded bg-[#0e121a] border border-white/[0.08] focus:border-cyan-500/50 text-slate-200 placeholder-slate-500 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 text-slate-400 hover:text-white p-0.5"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-[#07090d]">
          <table className="w-full text-left border-collapse text-[11px] font-mono">
            <thead className="sticky top-0 z-10 bg-[#0c1017] border-b border-white/[0.08] text-slate-400 uppercase text-[10px] tracking-wider select-none shadow-sm">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Process / App</th>
                <th className="py-2.5 px-3 font-semibold">PID</th>
                <th className="py-2.5 px-3 font-semibold">Proto</th>
                <th className="py-2.5 px-4 font-semibold">Local Port / Address</th>
                <th className="py-2.5 px-3 font-semibold">Service</th>
                <th className="py-2.5 px-4 font-semibold">Remote Endpoint</th>
                <th className="py-2.5 px-3 font-semibold">State</th>
                <th className="py-2.5 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredSockets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter className="w-6 h-6 text-slate-600" />
                      <span className="text-xs">No active sockets or ports match current filter.</span>
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          className="text-[11px] text-cyan-400 hover:underline mt-1"
                        >
                          Clear search filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSockets.map((s, idx) => {
                  const isListening = s.state.toUpperCase() === "LISTENING";
                  const isEstablished = s.state.toUpperCase() === "ESTABLISHED";
                  const isUdp = s.proto.toLowerCase() === "udp";

                  return (
                    <tr
                      key={`${s.proto}-${s.localIp}-${s.localPort}-${s.remoteIp}-${s.remotePort}-${s.pid}-${idx}`}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Process Name */}
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2" title={s.exePath ?? s.processName ?? "Unknown"}>
                          <div className="w-5 h-5 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                            {isListening ? (
                              <Server className="w-3 h-3 text-cyan-400" />
                            ) : (
                              <Activity className="w-3 h-3 text-fuchsia-400" />
                            )}
                          </div>
                          <span className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors truncate max-w-[180px]">
                            {s.processName || "System / Idle"}
                          </span>
                        </div>
                      </td>

                      {/* PID */}
                      <td className="py-2 px-3 text-slate-400">
                        {s.pid ? (
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px] border border-white/[0.06]">
                            {s.pid}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Protocol */}
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isUdp
                              ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30"
                              : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                          }`}
                        >
                          {s.proto}
                        </span>
                      </td>

                      {/* Local Port / Address */}
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">{s.localIp}:</span>
                          <span className="font-bold text-amber-300 bg-amber-500/10 px-1 rounded border border-amber-500/20">
                            {s.localPort}
                          </span>
                        </div>
                      </td>

                      {/* Classified Service */}
                      <td className="py-2 px-3">
                        {s.service ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px]">
                            {s.service}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>

                      {/* Remote Endpoint */}
                      <td className="py-2 px-4 text-slate-300">
                        {isListening || s.remoteIp === "*" || s.remoteIp === "0.0.0.0" || !s.remoteIp ? (
                          <span className="text-slate-500 italic text-[10px] flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5 text-cyan-400/60" />
                            Listening for connections
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px]">
                            <ArrowUpRight className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="text-slate-300">{s.remoteIp}</span>
                            <span className="text-slate-500">:</span>
                            <span className="text-slate-400">{s.remotePort}</span>
                          </div>
                        )}
                      </td>

                      {/* State */}
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isListening
                              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                              : isEstablished
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-700/30 text-slate-400 border border-slate-700/50"
                          }`}
                        >
                          {s.state}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copy Info */}
                          <button
                            onClick={() => handleCopyEndpoint(s, idx)}
                            className="p-1 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                            title="Copy socket details"
                          >
                            {copiedIndex === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Focus on Graph */}
                          <button
                            onClick={() => handleFocusOnGraph(s)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold transition-colors"
                            title="Focus & filter this process / port in Graph Canvas"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Focus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with hint */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#0a0d14] border-t border-white/[0.08] text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-200">{filteredSockets.length}</strong> of{" "}
              <strong className="text-slate-200">{sockets.length}</strong> active system sockets
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400/80">Tip: Click "Focus" to isolate that app or port on the visual 2D/3D map</span>
          </div>

          <div className="flex items-center gap-2">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
