import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceRadial,
  forceCollide,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";

interface WorkerNode extends SimulationNodeDatum {
  id: string;
  kind: string;
  radius: number;
}

interface WorkerLink extends SimulationLinkDatum<WorkerNode> {
  source: string | WorkerNode;
  target: string | WorkerNode;
}

let simulation: Simulation<WorkerNode, WorkerLink> | null = null;
let currentNodes: WorkerNode[] = [];
let currentLinks: WorkerLink[] = [];
let nodeIndexMap: Map<string, number> = new Map();

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === "INIT" || type === "UPDATE_GRAPH") {
    const { nodes, links, width, height, layoutMode } = payload;

    nodeIndexMap.clear();
    currentNodes = nodes.map((n: { id: string; kind: string }, idx: number) => {
      nodeIndexMap.set(n.id, idx);
      const isHost = n.kind === "host";
      return {
        id: n.id,
        kind: n.kind,
        radius: isHost ? 32 : n.kind === "process" ? 16 : 10,
        x: isHost ? width / 2 : width / 2 + (Math.random() - 0.5) * 300,
        y: isHost ? height / 2 : height / 2 + (Math.random() - 0.5) * 300,
        fx: isHost ? width / 2 : undefined,
        fy: isHost ? height / 2 : undefined,
      };
    });

    currentLinks = links
      .filter((l: { source: string; target: string }) =>
        nodeIndexMap.has(l.source) && nodeIndexMap.has(l.target)
      )
      .map((l: { source: string; target: string }) => ({
        source: l.source,
        target: l.target,
      }));

    if (simulation) simulation.stop();

    simulation = forceSimulation<WorkerNode, WorkerLink>(currentNodes);

    if (layoutMode === "radial") {
      // Concentric rings by hierarchy
      simulation
        .force(
          "link",
          forceLink<WorkerNode, WorkerLink>(currentLinks)
            .id((d) => d.id)
            .distance(120)
            .strength(0.6)
        )
        .force("charge", forceManyBody().strength(-140))
        .force(
          "radial",
          forceRadial<WorkerNode>(
            (d) => {
              if (d.kind === "host") return 0;
              if (d.kind === "gateway" || d.kind === "docker") return 140;
              if (d.kind === "process" || d.kind === "lan") return 260;
              return 390; // internet / tailscale / threat
            },
            width / 2,
            height / 2
          ).strength(0.9)
        )
        .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 8));
    } else if (layoutMode === "geo") {
      // Geographic quadrant layout (North America West/East, Europe, Asia, Local LAN)
      simulation
        .force(
          "link",
          forceLink<WorkerNode, WorkerLink>(currentLinks)
            .id((d) => d.id)
            .distance(80)
            .strength(0.4)
        )
        .force("charge", forceManyBody().strength(-90))
        .force(
          "radial",
          forceRadial<WorkerNode>((d) => (d.kind === "host" ? 0 : 250), width / 2, height / 2).strength(
            0.5
          )
        )
        .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 10));

      // Anchor quadrants
      currentNodes.forEach((node, i) => {
        if (node.kind !== "host") {
          const angle = (i / currentNodes.length) * Math.PI * 2;
          const dist = node.kind === "lan" ? 140 : 340;
          node.x = width / 2 + Math.cos(angle) * dist;
          node.y = height / 2 + Math.sin(angle) * (dist * 0.65);
        }
      });
    } else if (layoutMode === "3d") {
      // Pseudo-3D Isometric layered projection
      simulation
        .force(
          "link",
          forceLink<WorkerNode, WorkerLink>(currentLinks)
            .id((d) => d.id)
            .distance(90)
            .strength(0.5)
        )
        .force("charge", forceManyBody().strength(-120))
        .force("center", forceCenter(width / 2, height / 2).strength(0.3))
        .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 8));

      // Isometric tilt
      currentNodes.forEach((node, i) => {
        if (node.kind === "threat") {
          node.fy = height / 2 - 180 + (i % 3) * 40;
        }
      });
    } else {
      // Force directed organic default
      simulation
        .force(
          "link",
          forceLink<WorkerNode, WorkerLink>(currentLinks)
            .id((d) => d.id)
            .distance((d) => {
              const src = typeof d.source === "object" ? d.source.kind : "";
              const tgt = typeof d.target === "object" ? d.target.kind : "";
              if (src === "host" || tgt === "host") return 120;
              return 80;
            })
            .strength(0.7)
        )
        .force(
          "charge",
          forceManyBody<WorkerNode>().strength((d) =>
            d.kind === "host" ? -400 : d.kind === "process" ? -180 : -90
          )
        )
        .force("center", forceCenter(width / 2, height / 2).strength(0.2))
        .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 6));
    }

    simulation.alpha(1).alphaDecay(0.02).restart();

    simulation.on("tick", () => {
      // Pack positions into Float32Array
      const positions = new Float32Array(currentNodes.length * 2);
      const ids: string[] = [];

      for (let i = 0; i < currentNodes.length; i++) {
        const node = currentNodes[i];
        positions[i * 2] = node.x ?? 0;
        positions[i * 2 + 1] = node.y ?? 0;
        ids.push(node.id);
      }

      (self as any).postMessage(
        {
          type: "TICK",
          positions: positions.buffer,
          ids,
        },
        [positions.buffer]
      );
    });
  } else if (type === "DRAG_NODE") {
    const { id, x, y, isFixed } = payload;
    const idx = nodeIndexMap.get(id);
    if (idx !== undefined && currentNodes[idx]) {
      const node = currentNodes[idx];
      if (isFixed) {
        node.fx = x;
        node.fy = y;
        if (simulation) simulation.alphaTarget(0.3).restart();
      } else {
        node.fx = node.kind === "host" ? node.x : undefined;
        node.fy = node.kind === "host" ? node.y : undefined;
        if (simulation) simulation.alphaTarget(0);
      }
    }
  }
};
