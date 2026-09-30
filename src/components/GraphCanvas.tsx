import React, { useEffect, useRef, useState } from "react";
import { GraphEngine } from "../graph/GraphEngine";
import { LiveSource } from "../sources/live";
import { replayController } from "../sources/replay";
import { TrafficSource } from "../types/graph";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { recorder } from "../services/recorder";
import { threatEngine } from "../services/threatEngine";
import { Activity, Wifi, WifiOff } from "lucide-react";

type LoadState = "loading" | "ok" | "empty";

export const GraphCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const sourceRef = useRef<TrafficSource | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [nodeCount, setNodeCount] = useState(0);

  const { selectNode, selectLink, applyDelta, layoutMode, trafficMode } =
    useNetScopeStore();

  // Initialize Engine & Source once or when trafficMode changes
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    setLoadState("loading");

    const engine = new GraphEngine(containerRef.current, {
      onSelectNode: (id) => selectNode(id),
      onSelectLink: (id) => selectLink(id),
      onNodeDrag: (nodeId, x, y) => {
        if (useNetScopeStore.getState().isRecording) {
          recorder.recordNodeMove(nodeId, x, y);
        }
      },
    });
    engineRef.current = engine;

    const source: TrafficSource =
      trafficMode === "replay" ? replayController : new LiveSource();
    sourceRef.current = source;

    let lastThreatAnalysis = 0;

    engine.init().then(async () => {
      if (!mounted) return;

      // Seed initial snapshot
      const snapshot = await source.snapshot();
      const totalNodes = snapshot.nodes.length;

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

      const currentMode = useNetScopeStore.getState().layoutMode;
      engine.updateGraph(snapshot.nodes, snapshot.links, currentMode);

      setNodeCount(totalNodes);
      setLoadState(totalNodes === 0 ? "empty" : "ok");

      // Subscribe to deltas
      source.onDelta((delta) => {
        if (!mounted) return;
        recorder.recordDelta(delta);
        applyDelta(delta);

        const currentStore = useNetScopeStore.getState();
        const nodesList = Object.values(currentStore.nodes);
        const linksList = Object.values(currentStore.links);

        // If we get new nodes, clear empty state
        if (nodesList.length > 0 && loadState !== "ok") {
          setNodeCount(nodesList.length);
          setLoadState("ok");
        }

        // Filter if active filter is set
        let filteredNodes = nodesList;
        if (currentStore.activeFilter) {
          const filter = currentStore.activeFilter;
          filteredNodes = nodesList.filter((n) => {
            if (filter === "threat") return n.kind === "threat";
            return n.kind === filter;
          });
        }

        if (currentStore.searchQuery && currentStore.searchQuery.trim()) {
          const q = currentStore.searchQuery.toLowerCase().trim();
          filteredNodes = filteredNodes.filter(
            (n) =>
              n.label.toLowerCase().includes(q) ||
              (n.ip && n.ip.toLowerCase().includes(q)) ||
              n.kind.toLowerCase().includes(q)
          );
        }

        const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
        const filteredLinks = linksList.filter(
          (l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)
        );

        engine.updateGraph(
          filteredNodes,
          filteredLinks,
          currentStore.layoutMode,
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
  }, [applyDelta, selectNode, selectLink, trafficMode]);

  const { activeFilter, searchQuery, graphVersion } = useNetScopeStore();

  // Handle smooth layout mode, filter, and store delta transitions reactively
  useEffect(() => {
    if (engineRef.current) {
      const currentStore = useNetScopeStore.getState();
      const nodesList = Object.values(currentStore.nodes);
      const linksList = Object.values(currentStore.links);

      let filteredNodes = nodesList;
      if (activeFilter) {
        filteredNodes = nodesList.filter((n) => {
          if (activeFilter === "threat") return n.kind === "threat";
          return n.kind === activeFilter;
        });
      }

      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filteredNodes = filteredNodes.filter(
          (n) =>
            n.label.toLowerCase().includes(q) ||
            (n.ip && n.ip.toLowerCase().includes(q)) ||
            n.kind.toLowerCase().includes(q)
        );
      }

      const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
      const filteredLinks = linksList.filter(
        (l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)
      );

      // Show empty state for filters that return nothing
      if (activeFilter || (searchQuery && searchQuery.trim())) {
        setNodeCount(filteredNodes.length);
        setLoadState(filteredNodes.length === 0 ? "empty" : "ok");
      }

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
              {trafficMode === "replay"
                ? "LOADING SESSION..."
                : "SCANNING PC SOCKETS & ARP TABLE..."}
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
      {loadState === "empty" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 bg-[#0b1120]/90 backdrop-blur-sm border border-slate-700/50 rounded-xl px-10 py-8 shadow-lg max-w-md text-center">
            {trafficMode === "live" ? (
              <>
                <WifiOff className="w-10 h-10 text-amber-400 opacity-80" />
                <div>
                  <p className="text-amber-300 font-semibold text-sm tracking-wider mb-1">
                    NO LIVE DATA DETECTED
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    NetScope could not read active connections. This usually happens when:
                  </p>
                  <ul className="text-slate-500 text-xs mt-2 space-y-1 text-left list-disc list-inside">
                    <li>No active TCP/UDP sockets on this machine</li>
                    <li>
                      <span className="text-amber-400/80">Run as Administrator</span> for full
                      process attribution
                    </li>
                    <li>Firewall or AV blocking netstat output</li>
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
            ) : activeFilter || (searchQuery && searchQuery.trim()) ? (
              <>
                <Wifi className="w-10 h-10 text-slate-500 opacity-60" />
                <div>
                  <p className="text-slate-300 font-semibold text-sm tracking-wider mb-1">
                    NO NODES MATCH FILTER
                  </p>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {activeFilter
                      ? `No "${activeFilter}" type nodes in the current topology.`
                      : `No nodes match "${searchQuery}".`}
                    <br />
                    Try clearing the filter or switching modes.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Activity className="w-10 h-10 text-slate-500 opacity-60" />
                <p className="text-slate-400 text-sm">No topology data yet. Waiting for traffic…</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Live node count badge */}
      {loadState === "ok" && trafficMode === "live" && nodeCount > 0 && (
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
