import React, { useEffect, useState, useMemo } from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { commands, SocketInfo } from "../bindings";
import { isCriticalProcess, getCriticalProcessReason } from "../utils/processSafety";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Layers,
  List,
  Network,
  Radio,
  RefreshCw,
  Search,
  Server,
  Trash2,
  X,
  Zap,
} from "lucide-react";

type FilterTab = "all" | "listening" | "established" | "tcp" | "udp" | "local";
type ViewMode = "table" | "tree";
type TreeDepth = "less" | "standard" | "full";

interface PortTreeNode {
  portKey: string;
  proto: string;
  port: number;
  service: string | null;
  state: string;
  endpoints: SocketInfo[];
}

interface ProcessTreeNode {
  procKey: string;
  processName: string;
  pid: number | null;
  exePath: string | null;
  totalSockets: number;
  listeningCount: number;
  establishedCount: number;
  ports: PortTreeNode[];
}

export const PortInspectorModal: React.FC = () => {
  const {
    isPortInspectorOpen,
    portInspectorInitialTab,
    closePortInspector,
    setSearchQuery,
    setActiveFilter,
    selectNode,
    nodes,
    requestKillProcess,
  } = useNetScopeStore();

  const [sockets, setSockets] = useState<SocketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [activeView, setActiveView] = useState<ViewMode>("table");
  const [treeDepth, setTreeDepth] = useState<TreeDepth>("standard");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<string | number | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Expanded tree branches
  const [expandedProcs, setExpandedProcs] = useState<Set<string>>(new Set());
  const [expandedPorts, setExpandedPorts] = useState<Set<string>>(new Set());

  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isPortInspectorOpen && portInspectorInitialTab) {
      setActiveView(portInspectorInitialTab);
    }
  }, [isPortInspectorOpen, portInspectorInitialTab]);

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
    const interval = setInterval(fetchSockets, 3000);
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

  // Build hierarchical process & port tree from filtered sockets
  const processTree = useMemo((): ProcessTreeNode[] => {
    const procMap = new Map<string, ProcessTreeNode>();

    for (const s of filteredSockets) {
      const procName = s.processName || "System";
      const pid = s.pid;
      const procKey = `${procName}:${pid ?? 0}`;

      if (!procMap.has(procKey)) {
        procMap.set(procKey, {
          procKey,
          processName: procName,
          pid,
          exePath: s.exePath,
          totalSockets: 0,
          listeningCount: 0,
          establishedCount: 0,
          ports: [],
        });
      }

      const pNode = procMap.get(procKey)!;
      pNode.totalSockets++;
      if (s.state.toUpperCase() === "LISTENING") pNode.listeningCount++;
      if (s.state.toUpperCase() === "ESTABLISHED") pNode.establishedCount++;

      // Port node grouping
      const portKey = `${s.proto.toUpperCase()}:${s.localPort}`;
      let portNode = pNode.ports.find((p) => p.portKey === portKey);
      if (!portNode) {
        portNode = {
          portKey,
          proto: s.proto.toUpperCase(),
          port: s.localPort,
          service: s.service,
          state: s.state,
          endpoints: [],
        };
        pNode.ports.push(portNode);
      }
      portNode.endpoints.push(s);
    }

    // Sort processes by socket count descending
    return Array.from(procMap.values()).sort((a, b) => b.totalSockets - a.totalSockets);
  }, [filteredSockets]);

  // Handle tree depth changes (Less / Standard / Full Tree)
  useEffect(() => {
    if (treeDepth === "less") {
      setExpandedProcs(new Set());
      setExpandedPorts(new Set());
    } else if (treeDepth === "standard") {
      // Expand all processes to show ports
      setExpandedProcs(new Set(processTree.map((p) => p.procKey)));
      setExpandedPorts(new Set());
    } else if (treeDepth === "full") {
      // Expand all processes and all ports
      const allProcs = new Set<string>();
      const allPorts = new Set<string>();
      for (const p of processTree) {
        allProcs.add(p.procKey);
        for (const port of p.ports) {
          allPorts.add(`${p.procKey}:${port.portKey}`);
        }
      }
      setExpandedProcs(allProcs);
      setExpandedPorts(allPorts);
    }
  }, [treeDepth, processTree]);

  // Auto-expand tree when search query is entered
  useEffect(() => {
    if (search.trim()) {
      const procs = new Set<string>();
      const ports = new Set<string>();
      for (const p of processTree) {
        procs.add(p.procKey);
        for (const port of p.ports) {
          ports.add(`${p.procKey}:${port.portKey}`);
        }
      }
      setExpandedProcs(procs);
      setExpandedPorts(ports);
    }
  }, [search, processTree]);

  const toggleProcExpand = (procKey: string) => {
    setExpandedProcs((prev) => {
      const next = new Set(prev);
      if (next.has(procKey)) next.delete(procKey);
      else next.add(procKey);
      return next;
    });
  };

  const togglePortExpand = (portKeyId: string) => {
    setExpandedPorts((prev) => {
      const next = new Set(prev);
      if (next.has(portKeyId)) next.delete(portKeyId);
      else next.add(portKeyId);
      return next;
    });
  };

  const handleExpandAll = () => {
    const allProcs = new Set<string>();
    const allPorts = new Set<string>();
    for (const p of processTree) {
      allProcs.add(p.procKey);
      for (const port of p.ports) {
        allPorts.add(`${p.procKey}:${port.portKey}`);
      }
    }
    setExpandedProcs(allProcs);
    setExpandedPorts(allPorts);
    setTreeDepth("full");
  };

  const handleCollapseAll = () => {
    setExpandedProcs(new Set());
    setExpandedPorts(new Set());
    setTreeDepth("less");
  };

  // Focus on specific port and isolate in graph
  const handleFocusPort = (s: { localPort: number; processName?: string | null; pid?: number | null }) => {
    const filterKey = `port:${s.localPort}`;
    setActiveFilter(filterKey);
    setSearchQuery(filterKey);

    // If node exists matching pid, select it
    if (s.pid) {
      const matchedNode = Object.values(nodes).find((n) => n.pid === s.pid);
      if (matchedNode) {
        selectNode(matchedNode.id);
      }
    }

    closePortInspector();
  };

  const handleCopyEndpoint = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={closePortInspector}
    >
      <div
        className="w-full max-w-5xl h-[88vh] flex flex-col cyber-panel shadow-[0_0_60px_rgba(0,0,0,0.95)] border border-slate-700/60 rounded-xl overflow-hidden bg-[#090d14]/95 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] bg-[#0c1017]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
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
                Inspect local listening ports, active sockets, and terminate processes directly
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Table vs Tree */}
            <div className="flex items-center bg-[#111622] rounded p-0.5 border border-white/[0.08] text-[11px]">
              <button
                onClick={() => setActiveView("table")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                  activeView === "table"
                    ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Switch to flat Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>
              <button
                onClick={() => setActiveView("tree")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                  activeView === "tree"
                    ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Switch to detailed Process & Port Hierarchy Tree"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Detailed Tree</span>
              </button>
            </div>

            {/* Auto-Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border transition-all ${
                autoRefresh
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white"
              }`}
              title="Toggle auto-refresh every 3s"
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
              className="p-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
              title="Refresh now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>

            {/* Copy Table JSON */}
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] text-slate-300 hover:text-white transition-colors cursor-pointer"
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
              className="p-1.5 rounded bg-white/[0.05] hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/[0.08] transition-colors ml-1 cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Row - Clean, serious telemetry badges */}
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
            <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">UDP Endpoints</span>
            <span className="text-sm font-bold text-indigo-300 font-mono">{stats.udp}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Active Apps</span>
            <span className="text-sm font-bold text-amber-300 font-mono">{stats.uniqueProcs}</span>
          </div>
        </div>

        {/* Feedback / Toast banner */}
        {feedback && (
          <div
            className={`px-5 py-2 border-b text-xs font-mono flex items-center justify-between transition-all ${
              feedback.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/15 border-rose-500/30 text-rose-300"
            }`}
          >
            <span>{feedback.msg}</span>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter Bar & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#080b10] border-b border-white/[0.06]">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
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
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Toolbar: Tree Depth Options (if in Tree view) + Search Input */}
          <div className="flex items-center gap-3">
            {activeView === "tree" && (
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                <span className="text-[10px] uppercase font-semibold text-slate-500">Tree Depth:</span>
                {(
                  [
                    { id: "less", label: "Less" },
                    { id: "standard", label: "Ports" },
                    { id: "full", label: "Way More" },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setTreeDepth(d.id)}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                      treeDepth === d.id
                        ? "bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/40"
                        : "bg-white/[0.04] text-slate-400 hover:text-white"
                    }`}
                    title={`Detail level: ${d.label}`}
                  >
                    {d.label}
                  </button>
                ))}

                <div className="h-3 w-[1px] bg-white/[0.1] mx-1" />

                <button
                  onClick={handleExpandAll}
                  className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[10px] transition-colors cursor-pointer"
                  title="Expand all processes and ports"
                >
                  Expand All
                </button>
                <button
                  onClick={handleCollapseAll}
                  className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[10px] transition-colors cursor-pointer"
                  title="Collapse all branches"
                >
                  Collapse All
                </button>
              </div>
            )}

            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search port (137, 445), process (node), PID..."
                className="w-64 pl-8 pr-7 py-1 rounded bg-[#111622] border border-white/[0.08] focus:border-cyan-500 text-slate-200 placeholder-slate-500 text-[11px] font-mono focus:outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area: Table View OR Detailed Tree View */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeView === "table" ? (
            /* ================= FLAT TABLE VIEW ================= */
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#0c1017] z-10 border-b border-white/[0.08] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Process / App</th>
                  <th className="py-2.5 px-2">PID</th>
                  <th className="py-2.5 px-2">Proto</th>
                  <th className="py-2.5 px-3">Local Port / Address</th>
                  <th className="py-2.5 px-3">Service</th>
                  <th className="py-2.5 px-3">Remote Endpoint</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] font-mono text-[11px]">
                {filteredSockets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                      No active sockets match your filter or search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSockets.map((s, idx) => {
                    const isListening = s.state.toUpperCase() === "LISTENING";

                    return (
                      <tr
                        key={`${s.proto}-${s.localIp}-${s.localPort}-${s.remoteIp}-${s.remotePort}-${idx}`}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* Process Name */}
                        <td className="py-2 px-4 font-sans font-medium text-slate-200">
                          <div className="flex items-center gap-2">
                            <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate max-w-[170px]" title={s.exePath ?? s.processName ?? "Unknown"}>
                              {s.processName ?? "System"}
                            </span>
                          </div>
                        </td>

                        {/* PID */}
                        <td className="py-2 px-2 text-slate-400">{s.pid ?? "-"}</td>

                        {/* Proto */}
                        <td className="py-2 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              s.proto.toLowerCase() === "tcp"
                                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                            }`}
                          >
                            {s.proto}
                          </span>
                        </td>

                        {/* Local Port / Address */}
                        <td className="py-2 px-3">
                          <span className="text-slate-400">{s.localIp}:</span>
                          <span className="text-amber-300 font-bold font-mono ml-0.5">
                            {s.localPort}
                          </span>
                        </td>

                        {/* Service Name */}
                        <td className="py-2 px-3">
                          {s.service ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                              {s.service}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* Remote Endpoint */}
                        <td className="py-2 px-3 text-slate-300">
                          {isListening ? (
                            <span className="text-slate-500 italic font-sans text-[10px] flex items-center gap-1">
                              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                              Listening for connections
                            </span>
                          ) : (
                            <span>
                              {s.remoteIp}:{s.remotePort}
                            </span>
                          )}
                        </td>

                        {/* State */}
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isListening
                                ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                                : s.state.toUpperCase() === "ESTABLISHED"
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-700/30 text-slate-400 border border-slate-700/50"
                            }`}
                          >
                            {s.state}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Copy Endpoint */}
                            <button
                              onClick={() =>
                                handleCopyEndpoint(
                                  `${s.proto} ${s.localIp}:${s.localPort} -> ${s.remoteIp}:${s.remotePort} (${s.processName ?? "System"} PID ${s.pid ?? "-"})`,
                                  idx
                                )
                              }
                              className="p-1 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="Copy socket info to clipboard"
                            >
                              {copiedIndex === idx ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>

                            {/* Focus on Graph */}
                            <button
                              onClick={() => handleFocusPort(s)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-[10px] font-sans font-semibold transition-all cursor-pointer"
                              title={`Focus port :${s.localPort} and isolate on visual map`}
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span>Focus</span>
                            </button>

                            {/* End Task / Kill Process with Safeguard */}
                            {s.pid && (
                              <button
                                onClick={() =>
                                  requestKillProcess({
                                    pid: s.pid!,
                                    name: s.processName || "System",
                                    ports: [s.localPort],
                                    exePath: s.exePath ?? undefined,
                                  })
                                }
                                disabled={isCriticalProcess(s.pid, s.processName)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans transition-colors ${
                                  isCriticalProcess(s.pid, s.processName)
                                    ? "bg-slate-800/40 border border-slate-700/40 text-slate-500 cursor-not-allowed opacity-50"
                                    : "bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 cursor-pointer"
                                }`}
                                title={
                                  isCriticalProcess(s.pid, s.processName)
                                    ? getCriticalProcessReason(s.pid, s.processName)
                                    : `Terminate process ${s.processName ?? ""} (PID ${s.pid}) directly from app`
                                }
                              >
                                <Trash2 className="w-2.5 h-2.5 text-rose-400" />
                                <span>{isCriticalProcess(s.pid, s.processName) ? "Protected" : "Kill"}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ================= DETAILED SOCKET TREE VIEW ================= */
            <div className="p-4 space-y-2">
              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pb-1 border-b border-white/[0.04]">
                <span>
                  HOST: <strong className="text-cyan-400">This PC</strong> ({processTree.length} active network processes)
                </span>
                <span>Click arrows to expand / collapse individual process ports</span>
              </div>

              {processTree.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-sans text-xs">
                  No active processes match your filter or search query.
                </div>
              ) : (
                processTree.map((proc) => {
                  const isProcExpanded = expandedProcs.has(proc.procKey);

                  return (
                    <div
                      key={proc.procKey}
                      className="border border-white/[0.06] rounded-lg bg-[#0b0f17] overflow-hidden"
                    >
                      {/* Process Node Header */}
                      <div
                        onClick={() => toggleProcExpand(proc.procKey)}
                        className="flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.02] cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button className="text-slate-400 hover:text-white p-0.5">
                            {isProcExpanded ? (
                              <ChevronDown className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            )}
                          </button>

                          <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />

                          <span className="font-bold text-slate-100 text-xs font-mono">
                            {proc.processName}
                          </span>

                          <span className="px-1.5 py-0.2 rounded bg-white/[0.05] border border-white/[0.06] text-[10px] text-slate-400 font-mono">
                            PID {proc.pid ?? "-"}
                          </span>

                          <span className="px-2 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300 font-mono">
                            {proc.totalSockets} {proc.totalSockets === 1 ? "Socket" : "Sockets"}
                          </span>

                          {proc.listeningCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-300 font-mono">
                              {proc.listeningCount} Listening
                            </span>
                          )}

                          {proc.establishedCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-300 font-mono">
                              {proc.establishedCount} Connected
                            </span>
                          )}
                        </div>

                        {/* Process Actions */}
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Focus Process on Graph */}
                          <button
                            onClick={() => {
                              setSearchQuery(proc.processName);
                              if (proc.pid) {
                                const matched = Object.values(nodes).find((n) => n.pid === proc.pid);
                                if (matched) selectNode(matched.id);
                              }
                              closePortInspector();
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[10px] font-sans font-semibold transition-colors cursor-pointer"
                            title="Focus process in graph visualizer"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>Focus App</span>
                          </button>

                          {/* Terminate Task with Safeguard */}
                          {proc.pid && (
                            <button
                              onClick={() =>
                                requestKillProcess({
                                  pid: proc.pid!,
                                  name: proc.processName,
                                  ports: proc.ports.map((p) => p.port),
                                  exePath: proc.exePath ?? undefined,
                                })
                              }
                              disabled={isCriticalProcess(proc.pid, proc.processName)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold transition-colors ${
                                isCriticalProcess(proc.pid, proc.processName)
                                  ? "bg-slate-800/40 border border-slate-700/40 text-slate-500 cursor-not-allowed opacity-50"
                                  : "bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/35 text-rose-300 cursor-pointer"
                              }`}
                              title={
                                isCriticalProcess(proc.pid, proc.processName)
                                  ? getCriticalProcessReason(proc.pid, proc.processName)
                                  : `Terminate ${proc.processName} (PID ${proc.pid})`
                              }
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>{isCriticalProcess(proc.pid, proc.processName) ? "Protected" : "End Task"}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Ports Subtree (Level 2 & Level 3) */}
                      {isProcExpanded && (
                        <div className="px-4 py-2 border-t border-white/[0.04] bg-[#070a10] space-y-1.5 text-xs font-mono">
                          {proc.ports.map((port) => {
                            const portKeyId = `${proc.procKey}:${port.portKey}`;
                            const isPortExpanded = expandedPorts.has(portKeyId);

                            return (
                              <div
                                key={port.portKey}
                                className="pl-4 border-l-2 border-cyan-500/30 space-y-1 py-0.5"
                              >
                                {/* Port Row */}
                                <div className="flex items-center justify-between group">
                                  <div
                                    onClick={() => togglePortExpand(portKeyId)}
                                    className="flex items-center gap-2 cursor-pointer select-none"
                                  >
                                    <button className="text-slate-400 hover:text-white p-0.5">
                                      {isPortExpanded ? (
                                        <ChevronDown className="w-3 h-3 text-cyan-400" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 text-slate-500" />
                                      )}
                                    </button>

                                    <span
                                      className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase ${
                                        port.proto === "TCP"
                                          ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                          : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                                      }`}
                                    >
                                      {port.proto}
                                    </span>

                                    <span className="text-amber-300 font-bold text-xs">
                                      :{port.port}
                                    </span>

                                    {port.service && (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">
                                        {port.service}
                                      </span>
                                    )}

                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        port.state.toUpperCase() === "LISTENING"
                                          ? "bg-cyan-500/10 text-cyan-300"
                                          : "bg-emerald-500/15 text-emerald-300"
                                      }`}
                                    >
                                      {port.state}
                                    </span>

                                    <span className="text-[10px] text-slate-500 font-sans">
                                      ({port.endpoints.length} {port.endpoints.length === 1 ? "endpoint" : "endpoints"})
                                    </span>
                                  </div>

                                  {/* Port Actions */}
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() =>
                                        handleCopyEndpoint(
                                          `${port.proto} Port ${port.port} (${port.service ?? "unknown"}) [${proc.processName} PID ${proc.pid ?? "-"}]`,
                                          portKeyId
                                        )
                                      }
                                      className="p-1 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
                                      title="Copy port details"
                                    >
                                      {copiedIndex === portKeyId ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>

                                    {/* Focus Exact Port */}
                                    <button
                                      onClick={() =>
                                        handleFocusPort({
                                          localPort: port.port,
                                          processName: proc.processName,
                                          pid: proc.pid,
                                        })
                                      }
                                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 hover:text-amber-200 text-[10px] font-sans font-semibold transition-colors cursor-pointer"
                                      title={`Focus port :${port.port} on visual topology map`}
                                    >
                                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                                      <span>Focus Port</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Deep Endpoints Breakdown (Level 4) */}
                                {isPortExpanded && (
                                  <div className="pl-6 space-y-1 py-1 text-[11px] text-slate-300 border-l border-white/[0.05] ml-2">
                                    {port.endpoints.map((ep, epIdx) => (
                                      <div
                                        key={epIdx}
                                        className="flex items-center justify-between p-1 rounded bg-black/30 border border-white/[0.03] text-[10px]"
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <span className="text-slate-400">Binding:</span>
                                          <span className="text-slate-200">{ep.localIp}:{ep.localPort}</span>
                                          <span className="text-slate-500">➔</span>
                                          {ep.state.toUpperCase() === "LISTENING" ? (
                                            <span className="text-cyan-400 italic">0.0.0.0:* (Listening)</span>
                                          ) : (
                                            <span className="text-emerald-300 font-bold">
                                              {ep.remoteIp}:{ep.remotePort}
                                            </span>
                                          )}
                                        </div>

                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-slate-400 bg-white/[0.03]">
                                          {ep.state}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.08] bg-[#0c1017] text-[11px] font-mono text-slate-400">
          <div>
            Showing <strong className="text-slate-200">{filteredSockets.length}</strong> of{" "}
            <strong className="text-slate-200">{stats.total}</strong> active system sockets
            {search && <span className="text-cyan-400 ml-1">matching "{search}"</span>}
          </div>

          <div className="flex items-center gap-4 text-[10px]">
            <span>Tip: Click "Focus Port" to isolate any exact port on the 2D/3D map</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">Press Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
