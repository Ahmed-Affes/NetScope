import React, { useEffect, useRef, useState } from "react";
import { GraphEngine } from "../graph/GraphEngine";
import { LiveSource } from "../sources/live";
import { TrafficSource, GraphNode, GraphLink } from "../types/graph";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { threatEngine } from "../services/threatEngine";
import { Activity, Wifi, WifiOff } from "lucide-react";

type LoadState = "loading" | "ok" | "empty";

function filterTopology(
  nodesList: GraphNode[],
  linksList: GraphLink[],
  activeFilter: string | null,
  searchQuery: string | null
): { filteredNodes: GraphNode[]; filteredLinks: GraphLink[] } {
  let matchedNodes = nodesList;
  let matchedLinks = linksList;

  // 1. Process activeFilter (Node kind or Traffic/Port/Proto)
  if (activeFilter) {
    if (activeFilter.startsWith("port:")) {
      const portNum = parseInt(activeFilter.replace("port:", ""), 10);
      matchedLinks = linksList.filter(
        (l) =>
          l.port === portNum ||
          (portNum === 22 && l.service?.toLowerCase() === "ssh") ||
          (portNum === 80 && l.service?.toLowerCase() === "http") ||
          (portNum === 443 && l.service?.toLowerCase() === "https") ||
          (portNum === 53 && l.service?.toLowerCase() === "dns") ||
          (portNum === 11434 && l.service?.toLowerCase() === "ollama") ||
          (portNum === 7474 && l.service?.toLowerCase() === "neo4j") ||
          (portNum === 8000 && l.service?.toLowerCase() === "kruel")
      );
      const connectedIds = new Set(matchedLinks.flatMap((l) => [l.source, l.target]));
      matchedNodes = nodesList.filter((n) => connectedIds.has(n.id));
    } else if (activeFilter.startsWith("proto:")) {
      const proto = activeFilter.replace("proto:", "").toLowerCase();
      matchedLinks = linksList.filter((l) => l.proto.toLowerCase() === proto);
      const connectedIds = new Set(matchedLinks.flatMap((l) => [l.source, l.target]));
      matchedNodes = nodesList.filter((n) => connectedIds.has(n.id));
    } else if (activeFilter === "threat") {
      matchedNodes = nodesList.filter((n) => n.kind === "threat" || Boolean(n.threat));
      const visibleIds = new Set(matchedNodes.map((n) => n.id));
      matchedLinks = linksList.filter(
        (l) => visibleIds.has(l.source) && visibleIds.has(l.target)
      );
    } else {
      // Node kind filter (e.g. "host", "gateway", "lan", "process", "docker", "internet", "tailscale", "monitor")
      matchedNodes = nodesList.filter((n) => n.kind === activeFilter);
      const visibleIds = new Set(matchedNodes.map((n) => n.id));
      matchedLinks = linksList.filter(
        (l) => visibleIds.has(l.source) && visibleIds.has(l.target)
      );
    }
  }

  // 2. Process searchQuery
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    if (q.startsWith("port:")) {
      const portNum = parseInt(q.replace("port:", ""), 10);
      if (!isNaN(portNum)) {
        matchedLinks = matchedLinks.filter((l) => l.port === portNum);
        const connectedIds = new Set(matchedLinks.flatMap((l) => [l.source, l.target]));
        matchedNodes = matchedNodes.filter((n) => connectedIds.has(n.id));
      }
    } else if (q.startsWith("proto:")) {
      const proto = q.replace("proto:", "").toLowerCase();
      matchedLinks = matchedLinks.filter((l) => l.proto.toLowerCase() === proto);
      const connectedIds = new Set(matchedLinks.flatMap((l) => [l.source, l.target]));
      matchedNodes = matchedNodes.filter((n) => connectedIds.has(n.id));
    } else {
      matchedNodes = matchedNodes.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          (n.ip && n.ip.toLowerCase().includes(q)) ||
          n.kind.toLowerCase().includes(q) ||
          (n.hostname && n.hostname.toLowerCase().includes(q))
      );
      const visibleIds = new Set(matchedNodes.map((n) => n.id));
      matchedLinks = matchedLinks.filter(
        (l) => visibleIds.has(l.source) && visibleIds.has(l.target)
      );
    }
  }

  return { filteredNodes: matchedNodes, filteredLinks: matchedLinks };
}

export const GraphCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const sourceRef = useRef<TrafficSource | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [nodeCount, setNodeCount] = useState(0);

  const { selectNode, selectLink, applyDelta, layoutMode } =
    useNetScopeStore();

  // Initialize Engine & Source once
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    setLoadState("loading");

    const engine = new GraphEngine(containerRef.current, {
      onSelectNode: (id) => selectNode(id),
      onSelectLink: (id) => selectLink(id),
    });
    engineRef.current = engine;

    const source: TrafficSource = new LiveSource();
    sourceRef.current = source;

    let lastThreatAnalysis = 0;

    engine.init().then(async () => {
      if (!mounted) return;

      // Seed initial snapshot
      const snapshot = await source.snapshot();
      if (!mounted) return;

      applyDelta({
        t: Date.now(),
        addNodes: snapshot.nodes,
        updateNodes: [],
        removeNodeIds: [],
        addLinks: snapshot.links,
        updateLinks: [],
        removeLinkIds: [],
      });

      const currentStore = useNetScopeStore.getState();
      const { filteredNodes, filteredLinks } = filterTopology(
        snapshot.nodes,
        snapshot.links,
        currentStore.activeFilter,
        currentStore.searchQuery
      );

      engine.updateGraph(filteredNodes, filteredLinks, currentStore.layoutMode);

      const hasConstraint = Boolean(
        currentStore.activeFilter ||
          (currentStore.searchQuery && currentStore.searchQuery.trim())
      );
      const activeCount = hasConstraint ? filteredNodes.length : snapshot.nodes.length;
      setNodeCount(activeCount);
      setLoadState(activeCount === 0 ? "empty" : "ok");

      // Subscribe to deltas
      source.onDelta((delta) => {
        if (!mounted) return;
        applyDelta(delta);

        const storeNow = useNetScopeStore.getState();
        const nodesList = Object.values(storeNow.nodes);
        const linksList = Object.values(storeNow.links);

        const { filteredNodes: nextNodes, filteredLinks: nextLinks } = filterTopology(
          nodesList,
          linksList,
          storeNow.activeFilter,
          storeNow.searchQuery
        );

        const constraintNow = Boolean(
          storeNow.activeFilter ||
            (storeNow.searchQuery && storeNow.searchQuery.trim())
        );
        const countNow = constraintNow ? nextNodes.length : nodesList.length;
        setNodeCount(countNow);
        setLoadState(countNow === 0 ? "empty" : "ok");

        engine.updateGraph(
          nextNodes,
          nextLinks,
          storeNow.layoutMode,
          delta.nodePositions
        );

        // Run threat engine once per 2 seconds to avoid UI alert flooding
        const now = Date.now();
        if (now - lastThreatAnalysis > 2000) {
          lastThreatAnalysis = now;
          threatEngine.analyzeTopology(nodesList, linksList);
        }
      });

      source.start();
    });

    return () => {
      mounted = false;
      source.stop();
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyDelta, selectNode, selectLink]);

  const { activeFilter, searchQuery, graphVersion } = useNetScopeStore();

  // Handle smooth layout mode, filter, and store delta transitions reactively
  useEffect(() => {
    if (engineRef.current) {
      const currentStore = useNetScopeStore.getState();
      const nodesList = Object.values(currentStore.nodes);
      const linksList = Object.values(currentStore.links);

      const { filteredNodes, filteredLinks } = filterTopology(
        nodesList,
        linksList,
        activeFilter,
        searchQuery
      );

      const hasConstraint = Boolean(
        activeFilter || (searchQuery && searchQuery.trim())
      );
      const activeCount = hasConstraint ? filteredNodes.length : nodesList.length;
      setNodeCount(activeCount);
      setLoadState(activeCount === 0 ? "empty" : "ok");

      engineRef.current.updateGraph(filteredNodes, filteredLinks, layoutMode);
    }
  }, [layoutMode, activeFilter, searchQuery, graphVersion]);

  return (
    <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
      {/* WebGL canvas layer */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Loading state */}
      {loadState === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 bg-[#0b1120]/80 backdrop-blur-sm border border-cyan-500/20 rounded-xl px-8 py-6 shadow-[0_0_40px_rgba(34,211,238,0.1)]">
            <Activity className="w-7 h-7 text-cyan-400 animate-pulse" />
            <p className="text-cyan-300 text-sm font-mono tracking-wider">
              SCANNING PC SOCKETS & ARP TABLE...
            </p>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {/* Empty / Error state */}
      {loadState === "empty" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 bg-[#0b1120]/90 backdrop-blur-sm border border-slate-700/50 rounded-xl px-10 py-8 shadow-lg max-w-md text-center pointer-events-auto">
            {activeFilter || (searchQuery && searchQuery.trim()) ? (
              <>
                <Wifi className="w-10 h-10 text-slate-500 opacity-60" />
                <div>
                  <p className="text-slate-300 font-semibold text-sm tracking-wider mb-1">
                    NO NODES MATCH FILTER
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {activeFilter
                      ? `No active "${activeFilter}" traffic or nodes currently in your PC topology.`
                      : `No nodes match "${searchQuery}".`}
                    <br />
                    <span className="text-slate-500 text-[11px]">
                      Try clearing the filter or search query.
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    useNetScopeStore.getState().setActiveFilter(null);
                    useNetScopeStore.getState().setSearchQuery("");
                  }}
                  className="px-3.5 py-1.5 text-xs rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition-colors cursor-pointer font-semibold shadow-sm"
                >
                  Clear Filter
                </button>
              </>
            ) : (
              <>
                <WifiOff className="w-10 h-10 text-amber-400 opacity-80" />
                <div>
                  <p className="text-amber-300 font-semibold text-sm tracking-wider mb-1">
                    NO LIVE DATA DETECTED
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    NetScope is scanning active network sockets and ARP cache.
                  </p>
                  <ul className="text-slate-500 text-xs mt-2 space-y-1 text-left list-disc list-inside">
                    <li>Open a browser tab or network application</li>
                    <li>
                      <span className="text-amber-400/80">Run as Administrator</span> for full
                      process attribution
                    </li>
                  </ul>
                </div>
                <div className="flex gap-2 pointer-events-auto mt-1">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 text-xs rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                  >
                    Rescan Sockets
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Live node count badge */}
      {loadState === "ok" && nodeCount > 0 && (
        <div className="absolute bottom-4 left-4 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {nodeCount} nodes · LIVE
          </div>
        </div>
      )}
    </div>
  );
};
