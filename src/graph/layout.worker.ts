import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";

interface WorkerNode extends SimulationNodeDatum {
  id: string;
  kind: string;
  radius: number;
  targetX?: number;
  targetY?: number;
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

function computeLayoutTargets(mode: string, width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);

  if (mode === "radial") {
    // 1. Group nodes into hierarchy rings
    const ring0: WorkerNode[] = []; // Host
    const ring1: WorkerNode[] = []; // Gateway, Docker, Tailscale
    const ring2: WorkerNode[] = []; // Processes
    const ring3: WorkerNode[] = []; // Endpoints, Internet, Threats

    for (const node of currentNodes) {
      if (node.kind === "host") {
        ring0.push(node);
      } else if (node.kind === "gateway" || node.kind === "docker" || node.kind === "tailscale") {
        ring1.push(node);
      } else if (node.kind === "process") {
        ring2.push(node);
      } else {
        ring3.push(node);
      }
    }

    // Assign central host
    ring0.forEach((n) => {
      n.targetX = cx;
      n.targetY = cy;
      n.fx = cx;
      n.fy = cy;
    });

    const maxR = minDim * 0.44;
    const r1 = maxR * 0.38;
    const r2 = maxR * 0.68;
    const r3 = maxR * 0.98;

    ring1.forEach((n, i) => {
      const angle = (i / Math.max(ring1.length, 1)) * 2 * Math.PI - Math.PI / 2;
      n.targetX = cx + Math.cos(angle) * r1;
      n.targetY = cy + Math.sin(angle) * r1;
      n.fx = undefined;
      n.fy = undefined;
    });

    ring2.forEach((n, i) => {
      const angle = (i / Math.max(ring2.length, 1)) * 2 * Math.PI - Math.PI / 3;
      n.targetX = cx + Math.cos(angle) * r2;
      n.targetY = cy + Math.sin(angle) * r2;
      n.fx = undefined;
      n.fy = undefined;
    });

    ring3.forEach((n, i) => {
      const angle = (i / Math.max(ring3.length, 1)) * 2 * Math.PI;
      n.targetX = cx + Math.cos(angle) * r3;
      n.targetY = cy + Math.sin(angle) * r3;
      n.fx = undefined;
      n.fy = undefined;
    });
  } else if (mode === "geo") {
    // 4 distinct geographic regional quadrants scaled to viewport
    const lanNodes: WorkerNode[] = [];
    const cloudNodes: WorkerNode[] = [];
    const internetNodes: WorkerNode[] = [];
    const threatNodes: WorkerNode[] = [];

    for (const node of currentNodes) {
      if (node.kind === "host") {
        node.targetX = cx;
        node.targetY = cy;
        node.fx = cx;
        node.fy = cy;
      } else if (node.kind === "lan") {
        lanNodes.push(node);
      } else if (node.kind === "docker" || node.kind === "process") {
        cloudNodes.push(node);
      } else if (node.kind === "threat") {
        threatNodes.push(node);
      } else {
        internetNodes.push(node);
      }
    }

    const spanX = Math.min(width * 0.28, 300);
    const spanY = Math.min(height * 0.25, 180);

    // Top-Left: Cloud / Local Services
    const q1X = cx - spanX;
    const q1Y = cy - spanY;
    cloudNodes.forEach((n, i) => {
      const angle = (i / Math.max(cloudNodes.length, 1)) * 2 * Math.PI;
      const r = 40 + (i % 3) * 28;
      n.targetX = q1X + Math.cos(angle) * r;
      n.targetY = q1Y + Math.sin(angle) * r;
      n.fx = undefined;
      n.fy = undefined;
    });

    // Top-Right: Internet & CDNs
    const q2X = cx + spanX;
    const q2Y = cy - spanY;
    internetNodes.forEach((n, i) => {
      const angle = (i / Math.max(internetNodes.length, 1)) * 2 * Math.PI;
      const r = 45 + (i % 3) * 28;
      n.targetX = q2X + Math.cos(angle) * r;
      n.targetY = q2Y + Math.sin(angle) * r;
      n.fx = undefined;
      n.fy = undefined;
    });

    // Bottom-Left: LAN & Gateway Devices
    const q3X = cx - spanX;
    const q3Y = cy + spanY;
    lanNodes.forEach((n, i) => {
      const angle = (i / Math.max(lanNodes.length, 1)) * 2 * Math.PI;
      const r = 40 + (i % 3) * 28;
      n.targetX = q3X + Math.cos(angle) * r;
      n.targetY = q3Y + Math.sin(angle) * r;
      n.fx = undefined;
      n.fy = undefined;
    });

    // Bottom-Right: Threat Quarantine Sector
    const q4X = cx + spanX;
    const q4Y = cy + spanY;
    threatNodes.forEach((n, i) => {
      const angle = (i / Math.max(threatNodes.length, 1)) * 2 * Math.PI;
      const r = 35 + (i % 3) * 28;
      n.targetX = q4X + Math.cos(angle) * r;
      n.targetY = q4Y + Math.sin(angle) * r;
      n.fx = undefined;
      n.fy = undefined;
    });
  } else if (mode === "3d") {
    // 3D Isometric Layered Hologram Projection
    currentNodes.forEach((node, i) => {
      if (node.kind === "host") {
        node.targetX = cx;
        node.targetY = cy;
        node.fx = cx;
        node.fy = cy;
        return;
      }

      // Elevation tiers: Threats = top (+1), Host/Proc = middle (0), LAN = bottom (-1)
      const tier = node.kind === "threat" ? 1 : node.kind === "lan" || node.kind === "gateway" ? -1 : 0;
      const spreadX = ((i % 7) - 3) * 65;
      const spreadY = (Math.floor(i / 7) - 1) * 45;

      // Isometric projection
      node.targetX = cx + spreadX * 0.866 + tier * 50;
      node.targetY = cy + spreadY * 0.5 - tier * 140;
      node.fx = undefined;
      node.fy = undefined;
    });
  } else {
    // Organic Force mode
    currentNodes.forEach((n) => {
      if (n.kind === "host") {
        n.targetX = cx;
        n.targetY = cy;
        n.fx = cx;
        n.fy = cy;
      } else {
        n.fx = undefined;
        n.fy = undefined;
      }
    });
  }
}

function configureSimulationForces(mode: string, width: number, height: number) {
  if (!simulation) return;

  const cx = width / 2;
  const cy = height / 2;

  // Clear mode forces
  simulation.force("forceX", null);
  simulation.force("forceY", null);
  simulation.force("center", null);
  simulation.force("charge", null);

  computeLayoutTargets(mode, width, height);

  if (mode === "radial" || mode === "geo" || mode === "3d") {
    simulation.velocityDecay(0.65);
    // Coordinate-directed target positioning
    simulation
      .force(
        "forceX",
        forceX<WorkerNode>((d) => d.targetX ?? cx).strength(0.85)
      )
      .force(
        "forceY",
        forceY<WorkerNode>((d) => d.targetY ?? cy).strength(0.85)
      )
      .force(
        "link",
        forceLink<WorkerNode, WorkerLink>(currentLinks)
          .id((d) => d.id)
          .strength(0.04) // Gentle link tension that doesn't disrupt geometric alignment
      )
      .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 16).strength(0.8));
  } else {
    simulation.velocityDecay(0.4);
    // Pure organic force-directed physics
    simulation
      .force(
        "link",
        forceLink<WorkerNode, WorkerLink>(currentLinks)
          .id((d) => d.id)
          .distance((d) => {
            const src = typeof d.source === "object" ? d.source.kind : "";
            const tgt = typeof d.target === "object" ? d.target.kind : "";
            if (src === "host" || tgt === "host") return 210;
            if (src === "threat" || tgt === "threat") return 180;
            return 140;
          })
          .strength(0.65)
      )
      .force(
        "charge",
        forceManyBody<WorkerNode>().strength((d) =>
          d.kind === "host" ? -800 : d.kind === "process" ? -450 : -250
        )
      )
      .force("center", forceCenter(cx, cy).strength(0.035))
      .force("collide", forceCollide<WorkerNode>().radius((d) => d.radius + 20).strength(0.85));
  }
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

    // Remove deleted nodes
    for (const [id] of nodeMap.entries()) {
      if (!incomingNodeIds.has(id)) {
        nodeMap.delete(id);
      }
    }

    // Add or update nodes while keeping previous positions
    nodes.forEach((n: { id: string; kind: string }, i: number) => {
      const isHost = n.kind === "host";
      const radius = isHost ? 26 : n.kind === "process" ? 14 : n.kind === "threat" ? 14 : 10;

      let existing = nodeMap.get(n.id);
      if (!existing) {
        const angle = i * 0.45;
        const dist = isHost ? 0 : 130 + (i % 6) * 45;
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
        existing.kind = n.kind;
        existing.radius = radius;
        if (isHost) {
          existing.fx = cx;
          existing.fy = cy;
        }
      }
    });

    currentNodes = Array.from(nodeMap.values());

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

    const mode = layoutMode || currentLayoutMode;
    const modeChanged = mode !== currentLayoutMode;
    currentLayoutMode = mode;

    configureSimulationForces(mode, currentWidth, currentHeight);

    if (modeChanged) {
      simulation.alpha(0.85).alphaDecay(0.02).restart();
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
        if (simulation) simulation.alphaTarget(0.3).restart();
      } else {
        node.fx = node.kind === "host" ? currentWidth / 2 : undefined;
        node.fy = node.kind === "host" ? currentHeight / 2 : undefined;
        if (simulation) simulation.alphaTarget(0);
      }
    }
  }
};
