import React, { useEffect, useRef } from "react";
import { GraphEngine } from "../graph/GraphEngine";
import { SimulatorSource } from "../sources/simulator";
import { LiveSource } from "../sources/live";
import { ReplaySource } from "../sources/replay";
import { TrafficSource } from "../types/graph";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { recorder } from "../services/recorder";

export const GraphCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const sourceRef = useRef<TrafficSource | null>(null);

  const { selectNode, selectLink, applyDelta, layoutMode, trafficMode } = useNetScopeStore();

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

      engine.updateGraph(snapshot.nodes, snapshot.links, layoutMode);

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

        engine.updateGraph(filteredNodes, linksList, currentStore.layoutMode);
      });


      source.start();
    });

    return () => {
      mounted = false;
      source.stop();
      engine.destroy();
    };
  }, [applyDelta, selectNode, selectLink, layoutMode, trafficMode]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 w-full h-full overflow-hidden"
    />
  );
};
