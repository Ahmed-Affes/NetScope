import React, { useEffect, useRef } from "react";
import { GraphEngine } from "../graph/GraphEngine";
import { SimulatorSource } from "../sources/simulator";
import { LiveSource } from "../sources/live";
import { ReplaySource } from "../sources/replay";
import { TrafficSource } from "../types/graph";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { recorder } from "../services/recorder";
import { threatEngine } from "../services/threatEngine";

export const GraphCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const sourceRef = useRef<TrafficSource | null>(null);

  const { selectNode, selectLink, applyDelta, layoutMode, trafficMode } = useNetScopeStore();

  // Initialize Engine & Source once or when trafficMode changes
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    const engine = new GraphEngine(containerRef.current, {
      onSelectNode: (id) => selectNode(id),
      onSelectLink: (id) => selectLink(id),
    });
    engineRef.current = engine;

    let source: TrafficSource;
    if (trafficMode === "live") {
      source = new LiveSource();
    } else if (trafficMode === "replay") {
      source = new ReplaySource("latest");
    } else {
      source = new SimulatorSource();
    }
    sourceRef.current = source;

    let lastThreatAnalysis = 0;

    engine.init().then(async () => {
      if (!mounted) return;

      // Seed initial snapshot
      const snapshot = await source.snapshot();
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

      // Subscribe to deltas
      source.onDelta((delta) => {
        if (!mounted) return;
        recorder.recordDelta(delta);
        applyDelta(delta);

        const currentStore = useNetScopeStore.getState();
        const nodesList = Object.values(currentStore.nodes);
        const linksList = Object.values(currentStore.links);

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

        engine.updateGraph(filteredNodes, filteredLinks, currentStore.layoutMode);

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
  }, [applyDelta, selectNode, selectLink, trafficMode]);

  const { activeFilter, searchQuery, graphVersion } = useNetScopeStore();

  // Handle smooth layout mode and filter transitions reactively
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

      engineRef.current.updateGraph(filteredNodes, filteredLinks, layoutMode);
    }
  }, [layoutMode, activeFilter, searchQuery, graphVersion]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 w-full h-full overflow-hidden"
    />
  );
};
