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
  fixedCenter?: boolean;
}

interface WorkerLink extends SimulationLinkDatum<WorkerNode> {
  id?: string;
  source: string | WorkerNode;
  target: string | WorkerNode;
}

let simulation: Simulation<WorkerNode, WorkerLink> | null = null;
let currentNodes: WorkerNode[] = [];
let currentLinks: WorkerLink[] = [];
let nodeMap: Map<string, WorkerNode> = new Map();
let currentLayoutMode = "force";
let currentWidth = 1200;
let currentHeight = 800;

function setupForces(mode: string, width: number, height: number) {
  if (!simulation) return;

  currentLayoutMode = mode;
  currentWidth = width;
  currentHeight = height;

  const cx = width / 2;
  const cy = height / 2;

  // Clear existing mode-specific forces
  simulation.force("radial", null);
  simulation.force("center", null);

  if (mode === "radial") {
    // Concentric orbiting hierarchy
    simulation
      .force(
        "link",
        forceLink<WorkerNode, WorkerLink>(currentLinks)
          .id((d) => d.id)
          .distance((d) => {
            const src = typeof d.source === "object" ? d.source.kind : "";
            const tgt = typeof d.target === "object" ? d.target.kind : "";
            if (src === "host" || tgt === "host") return 180;
            return 120;
          })
          .strength(0.5)
      )
      .force(
        "charge",
        forceManyBody<WorkerNode>().strength((d) => (d.kind === "host" ? -600 : -250))
      )
      .force(
        "radial",
        forceRadial<WorkerNode>(
          (d) => {
            if (d.kind === "host") return 0;
            if (d.kind === "gateway" || d.kind === "docker") return 180;
            if (d.kind === "process" || d.kind === "lan") return 320;
            return 460; // internet / threats / tailscale
          },
          cx,
          cy
        ).strength(0.85)
      )
      .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 18).strength(0.85));

    // Release fixed positions except host
    currentNodes.forEach((n) => {
      if (n.kind === "host") {
        n.fx = cx;
        n.fy = cy;
      } else if (!n.fixedCenter) {
        n.fx = undefined;
        n.fy = undefined;
      }
    });
  } else if (mode === "geo") {
    // Geographic Regional Quadrants
    simulation
      .force(
        "link",
        forceLink<WorkerNode, WorkerLink>(currentLinks)
          .id((d) => d.id)
          .distance(110)
          .strength(0.4)
      )
      .force(
        "charge",
        forceManyBody<WorkerNode>().strength((d) => (d.kind === "host" ? -500 : -200))
      )
      .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 16).strength(0.85));

    // Position nodes into regional clusters
    currentNodes.forEach((node, i) => {
      if (node.kind === "host") {
        node.fx = cx;
        node.fy = cy;
      } else {
        const quadrantAngle =
          node.kind === "lan"
            ? Math.PI * 0.75 // Bottom-Left (Local LAN)
            : node.kind === "docker" || node.kind === "process"
            ? Math.PI * 1.25 // Top-Left (Local services)
            : node.kind === "threat"
            ? Math.PI * 0.25 // Bottom-Right (Threat sector)
            : Math.PI * 1.75; // Top-Right (Cloud/Internet)

        const dist = node.kind === "threat" ? 360 : 280;
        const spread = ((i % 5) - 2) * 45;
        node.x = cx + Math.cos(quadrantAngle) * dist + spread;
        node.y = cy + Math.sin(quadrantAngle) * (dist * 0.75) + spread;
      }
    });
  } else if (mode === "3d") {
    // Pseudo-3D Isometric Layered Projection
    simulation
      .force(
        "link",
        forceLink<WorkerNode, WorkerLink>(currentLinks)
          .id((d) => d.id)
          .distance(140)
          .strength(0.5)
      )
      .force("charge", forceManyBody<WorkerNode>().strength(-350))
      .force("center", forceCenter(cx, cy).strength(0.04))
      .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 18).strength(0.85));

    currentNodes.forEach((node, i) => {
      if (node.kind === "host") {
        node.fx = cx;
        node.fy = cy;
      } else if (node.kind === "threat") {
        // High plane for threats
        node.y = cy - 220 + ((i % 3) - 1) * 50;
      } else if (node.kind === "lan") {
        // Low plane for LAN
        node.y = cy + 200 + ((i % 3) - 1) * 50;
      }
    });
  } else {
    // Balanced Force-Directed Organic Graph
    simulation
      .force(
        "link",
        forceLink<WorkerNode, WorkerLink>(currentLinks)
          .id((d) => d.id)
          .distance((d) => {
            const src = typeof d.source === "object" ? d.source.kind : "";
            const tgt = typeof d.target === "object" ? d.target.kind : "";
            if (src === "host" || tgt === "host") return 220;
            if (src === "threat" || tgt === "threat") return 190;
            return 150;
          })
          .strength(0.65)
      )
      .force(
        "charge",
        forceManyBody<WorkerNode>().strength((d) =>
          d.kind === "host" ? -900 : d.kind === "process" || d.kind === "docker" ? -550 : -320
        )
      )
      .force("center", forceCenter(cx, cy).strength(0.035))
      .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 20).strength(0.9));

    // Anchor host in center
    currentNodes.forEach((n) => {
      if (n.kind === "host") {
        n.fx = cx;
        n.fy = cy;
      }
    });
  }

  simulation.alpha(0.6).alphaDecay(0.025).restart();
}

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === "INIT" || type === "UPDATE_GRAPH") {
    const { nodes, links, width, height, layoutMode } = payload;
    currentWidth = width || 1200;
    currentHeight = height || 800;
    const cx = currentWidth / 2;
    const cy = currentHeight / 2;

    const incomingNodeIds = new Set(nodes.map((n: { id: string }) => n.id));

    // Clean up removed nodes
    for (const [id] of nodeMap.entries()) {
      if (!incomingNodeIds.has(id)) {
        nodeMap.delete(id);
      }
    }

    // Update or add nodes while preserving existing positions
    nodes.forEach((n: { id: string; kind: string }, i: number) => {
      const isHost = n.kind === "host";
      const radius = isHost ? 28 : n.kind === "process" ? 14 : n.kind === "threat" ? 14 : 10;

      let existing = nodeMap.get(n.id);
      if (!existing) {
        // Initialize position nicely in an outward spiral
        const angle = i * 0.45;
        const dist = isHost ? 0 : 120 + (i % 6) * 45;
        existing = {
          id: n.id,
          kind: n.kind,
          radius,
          x: isHost ? cx : cx + Math.cos(angle) * dist,
          y: isHost ? cy : cy + Math.sin(angle) * dist,
          fx: isHost ? cx : undefined,
          fy: isHost ? cy : undefined,
        };
        nodeMap.set(n.id, existing);
      } else {
        // Keep position, update metadata
        existing.kind = n.kind;
        existing.radius = radius;
        if (isHost) {
          existing.fx = cx;
          existing.fy = cy;
        }
      }
    });

    currentNodes = Array.from(nodeMap.values());

    // Filter valid links
    currentLinks = links
      .filter((l: { source: string; target: string }) =>
        nodeMap.has(l.source) && nodeMap.has(l.target)
      )
      .map((l: { source: string; target: string }) => ({
        source: l.source,
        target: l.target,
      }));

    if (!simulation) {
      simulation = forceSimulation<WorkerNode, WorkerLink>(currentNodes);

      simulation.on("tick", () => {
        const positions = new Float32Array(currentNodes.length * 2);
        const ids: string[] = [];

        for (let i = 0; i < currentNodes.length; i++) {
          const node = currentNodes[i];
          positions[i * 2] = node.x ?? cx;
          positions[i * 2 + 1] = node.y ?? cy;
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
    } else {
      simulation.nodes(currentNodes);
    }

    const modeChanged = layoutMode && layoutMode !== currentLayoutMode;
    setupForces(layoutMode || currentLayoutMode, currentWidth, currentHeight);

    if (modeChanged) {
      simulation.alpha(0.8).restart();
    } else {
      simulation.alpha(0.3).restart();
    }
  } else if (type === "DRAG_NODE") {
    const { id, x, y, isFixed } = payload;
    const node = nodeMap.get(id);
    if (node) {
      if (isFixed) {
        node.fx = x;
        node.fy = y;
        node.fixedCenter = true;
        if (simulation) simulation.alphaTarget(0.3).restart();
      } else {
        node.fx = node.kind === "host" ? currentWidth / 2 : undefined;
        node.fy = node.kind === "host" ? currentHeight / 2 : undefined;
        node.fixedCenter = false;
        if (simulation) simulation.alphaTarget(0);
      }
    }
  }
};
