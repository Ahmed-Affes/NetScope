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

  // Central host anchor
  const hostNode = currentNodes.find((n) => n.kind === "host") || currentNodes[0];
  if (hostNode) {
    hostNode.targetX = cx;
    hostNode.targetY = cy;
    hostNode.fx = cx;
    hostNode.fy = cy;
  }

  // 1. Build adjacency / hierarchy
  const childrenMap = new Map<string, WorkerNode[]>();
  for (const n of currentNodes) {
    if (n !== hostNode) childrenMap.set(n.id, []);
  }

  const directHostChildren = new Set<string>();
  const parentOf = new Map<string, string>();

  for (const link of currentLinks) {
    const srcId = typeof link.source === "object" ? link.source.id : link.source;
    const tgtId = typeof link.target === "object" ? link.target.id : link.target;

    if (srcId === hostNode?.id) {
      directHostChildren.add(tgtId);
      parentOf.set(tgtId, srcId);
    } else if (tgtId === hostNode?.id) {
      directHostChildren.add(srcId);
      parentOf.set(srcId, tgtId);
    } else {
      if (nodeMap.has(srcId) && nodeMap.has(tgtId)) {
        const arr = childrenMap.get(srcId) || [];
        if (!arr.some((c) => c.id === tgtId)) {
          arr.push(nodeMap.get(tgtId)!);
        }
        childrenMap.set(srcId, arr);
        parentOf.set(tgtId, srcId);
      }
    }
  }

  if (mode === "radial") {
    // Collect all primary hubs connected to host or nodes that have children
    const hubs: WorkerNode[] = [];
    const directLeaves: WorkerNode[] = [];

    for (const node of currentNodes) {
      if (node === hostNode) continue;
      const children = childrenMap.get(node.id) || [];
      if (directHostChildren.has(node.id) || children.length > 0) {
        hubs.push(node);
      } else if (!parentOf.has(node.id)) {
        directLeaves.push(node);
      }
    }

    // Sort hubs logically: Internet on left, Microservices top, Threats top-right, LAN bottom
    hubs.sort((a, b) => {
      const order = (k: string) =>
        k === "internet" ? 1 : k === "docker" || k === "process" ? 2 : k === "threat" ? 3 : k === "gateway" ? 4 : 5;
      return order(a.kind) - order(b.kind);
    });

    // Compute angular sectors proportional to children count
    let totalWeight = directLeaves.length;
    for (const h of hubs) {
      const cCount = (childrenMap.get(h.id) || []).length;
      totalWeight += Math.max(cCount, 1) + 1;
    }

    let currentAngle = -Math.PI * 0.75;
    const rHub = minDim * 0.22;
    const rBaseLeaf = minDim * 0.41;

    for (const hub of hubs) {
      const children = childrenMap.get(hub.id) || [];
      const weight = Math.max(children.length, 1) + 1;
      const sectorSpan = (weight / totalWeight) * 2 * Math.PI;
      const hubAngle = currentAngle + sectorSpan / 2;

      hub.targetX = cx + Math.cos(hubAngle) * rHub;
      hub.targetY = cy + Math.sin(hubAngle) * rHub;
      hub.fx = undefined;
      hub.fy = undefined;

      // Position children strictly within this hub's angular sector!
      if (children.length > 0) {
        const step = sectorSpan / (children.length + 1);
        children.forEach((child, idx) => {
          const childAngle = currentAngle + step * (idx + 1);
          // If many children (like homeassistant), stagger radii to prevent label collisions
          const stagger = children.length > 6 ? (idx % 2 === 0 ? 0.91 : 1.07) : 1.0;
          const rChild = rBaseLeaf * stagger;

          child.targetX = cx + Math.cos(childAngle) * rChild;
          child.targetY = cy + Math.sin(childAngle) * rChild;
          child.fx = undefined;
          child.fy = undefined;
        });
      }

      currentAngle += sectorSpan;
    }

    // Direct leaves with no parent hub
    directLeaves.forEach((leaf, idx) => {
      const leafAngle = currentAngle + ((idx + 1) / (directLeaves.length + 1)) * 0.4;
      leaf.targetX = cx + Math.cos(leafAngle) * rBaseLeaf;
      leaf.targetY = cy + Math.sin(leafAngle) * rBaseLeaf;
      leaf.fx = undefined;
      leaf.fy = undefined;
    });
  } else if (mode === "geo") {
    // 4 distinct spacious geographic regional quadrants
    const spanX = Math.min(width * 0.33, 400);
    const spanY = Math.min(height * 0.29, 250);

    const q1Nodes: WorkerNode[] = []; // Top-Left: Cloud / Microservices / Containers
    const q2Nodes: WorkerNode[] = []; // Top-Right: Internet & Cloud CDNs
    const q3Nodes: WorkerNode[] = []; // Bottom-Left: LAN & Subnet Devices
    const q4Nodes: WorkerNode[] = []; // Bottom-Right: Threats & Quarantine

    for (const node of currentNodes) {
      if (node === hostNode) continue;
      if (node.kind === "threat") {
        q4Nodes.push(node);
      } else if (node.kind === "lan" || parentOf.get(node.id) === "proc:homeassistant") {
        q3Nodes.push(node);
      } else if (node.kind === "internet" || parentOf.get(node.id) === "proc:internet") {
        q2Nodes.push(node);
      } else {
        q1Nodes.push(node);
      }
    }

    // Helper to position a cluster with ample separation
    const layoutCluster = (nodes: WorkerNode[], anchorX: number, anchorY: number, outwardAngle: number) => {
      if (nodes.length === 0) return;
      if (nodes.length === 1) {
        nodes[0].targetX = anchorX;
        nodes[0].targetY = anchorY;
        nodes[0].fx = undefined;
        nodes[0].fy = undefined;
        return;
      }
      if (nodes.length === 2) {
        // Horizontal side by side with 140px spacing
        nodes[0].targetX = anchorX - 70;
        nodes[0].targetY = anchorY;
        nodes[1].targetX = anchorX + 70;
        nodes[1].targetY = anchorY;
        nodes[0].fx = undefined;
        nodes[0].fy = undefined;
        nodes[1].fx = undefined;
        nodes[1].fy = undefined;
        return;
      }

      // Identify hub in cluster
      const hub =
        nodes.find((n) => directHostChildren.has(n.id) || (childrenMap.get(n.id) || []).length > 0) || nodes[0];
      hub.targetX = anchorX;
      hub.targetY = anchorY;
      hub.fx = undefined;
      hub.fy = undefined;

      const leaves = nodes.filter((n) => n !== hub);
      const arcSpread = Math.PI * 0.95;
      const startAngle = outwardAngle - arcSpread / 2;

      leaves.forEach((leaf, i) => {
        const angle = startAngle + (i / Math.max(leaves.length - 1, 1)) * arcSpread;
        const radius = leaves.length > 6 ? (i % 2 === 0 ? 85 : 135) : 105;
        leaf.targetX = anchorX + Math.cos(angle) * radius;
        leaf.targetY = anchorY + Math.sin(angle) * radius;
        leaf.fx = undefined;
        leaf.fy = undefined;
      });
    };

    layoutCluster(q1Nodes, cx - spanX, cy - spanY, -Math.PI * 0.75); // Q1: Top-Left
    layoutCluster(q2Nodes, cx + spanX, cy - spanY, -Math.PI * 0.25); // Q2: Top-Right
    layoutCluster(q3Nodes, cx - spanX, cy + spanY, Math.PI * 0.75);  // Q3: Bottom-Left
    layoutCluster(q4Nodes, cx + spanX, cy + spanY, Math.PI * 0.25);  // Q4: Bottom-Right
  } else if (mode === "3d") {
    // 4 discrete elevation tiers with clean isometric layout
    const threats: WorkerNode[] = [];
    const internetCloud: WorkerNode[] = [];
    const hostServices: WorkerNode[] = [];
    const lanDevices: WorkerNode[] = [];

    for (const node of currentNodes) {
      if (node === hostNode) continue;
      if (node.kind === "threat") {
        threats.push(node);
      } else if (node.kind === "internet" || parentOf.get(node.id) === "proc:internet") {
        internetCloud.push(node);
      } else if (node.kind === "lan" || parentOf.get(node.id) === "proc:homeassistant" || node.kind === "gateway") {
        lanDevices.push(node);
      } else {
        hostServices.push(node);
      }
    }

    // Helper to position nodes across an isometric tier plane
    const layoutIsoTier = (nodes: WorkerNode[], yElevation: number, spacing: number) => {
      const cols = Math.min(Math.ceil(Math.sqrt(nodes.length * 1.6)), 5);
      nodes.forEach((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const isoX = (col - (cols - 1) / 2) * spacing;
        const isoY = (row - 0.5) * (spacing * 0.55);

        node.targetX = cx + isoX;
        node.targetY = cy + isoY + yElevation;
        node.fx = undefined;
        node.fy = undefined;
      });
    };

    // Tier 1 (Top Plane, -200px): Threats & Attack C2
    layoutIsoTier(threats, -200, 140);

    // Tier 2 (Upper-Mid, -70px): Global Internet & Cloud
    layoutIsoTier(internetCloud, -70, 100);

    // Tier 3 (Lower-Mid, +60px): Host & Local Microservices
    layoutIsoTier(hostServices, 60, 100);

    // Tier 4 (Bottom Plane, +190px): Local LAN & IoT Network
    layoutIsoTier(lanDevices, 190, 90);
  } else {
    // Organic Force mode: let host stay at center, others float freely
    currentNodes.forEach((n) => {
      if (n !== hostNode) {
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
          .strength(0.03) // Soft tension preserves geometric coordinates
      )
      .force(
        "collide",
        forceCollide<WorkerNode>()
          .radius((d) => (d.kind === "host" ? 50 : d.kind === "threat" ? 44 : 34))
          .strength(0.9)
      );
  } else {
    simulation.velocityDecay(0.42);
    simulation
      .force(
        "link",
        forceLink<WorkerNode, WorkerLink>(currentLinks)
          .id((d) => d.id)
          .distance((link) => {
            const src = typeof link.source === "object" ? link.source.kind : "";
            const tgt = typeof link.target === "object" ? link.target.kind : "";
            if (src === "host" || tgt === "host") return 240;
            if (src === "threat" || tgt === "threat") return 210;
            if (src === "port" || tgt === "port") return 85;
            return 170;
          })
          .strength(0.65)
      )
      .force(
        "charge",
        forceManyBody<WorkerNode>()
          .strength((d) =>
            d.kind === "host" ? -1200 : d.kind === "threat" ? -750 : d.kind === "process" || d.kind === "docker" ? -600 : d.kind === "port" ? -160 : -350
          )
          .distanceMin(40)
          .distanceMax(650)
      )
      .force("center", forceCenter(cx, cy).strength(0.04))
      .force(
        "collide",
        forceCollide<WorkerNode>()
          .radius((d) => (d.kind === "host" ? 65 : d.kind === "threat" ? 52 : d.kind === "process" || d.kind === "docker" ? 48 : d.kind === "port" ? 20 : 38))
          .strength(1.0)
          .iterations(2)
      );
  }
}

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === "INIT" || type === "UPDATE_GRAPH") {
    const { nodes, links, width, height, layoutMode, nodePositions } = payload;
    currentWidth = Math.max(width || 0, 1200);
    currentHeight = Math.max(height || 0, 800);
    const cx = currentWidth / 2;
    const cy = currentHeight / 2;

    const prevNodeCount = nodeMap.size;
    const prevLinkCount = currentLinks.length;
    const incomingNodeIds = new Set(nodes.map((n: { id: string }) => n.id));

    // Remove deleted nodes
    for (const [id] of nodeMap.entries()) {
      if (!incomingNodeIds.has(id)) {
        nodeMap.delete(id);
      }
    }

    // Add or update nodes with golden ratio spiral initial layout
    nodes.forEach((n: { id: string; kind: string; x?: number; y?: number }, i: number) => {
      const isHost = n.kind === "host";
      const radius = isHost ? 26 : n.kind === "process" ? 14 : n.kind === "threat" ? 14 : n.kind === "port" ? 8 : 10;

      let existing = nodeMap.get(n.id);
      if (!existing) {
        const angle = i * 2.39996 + 0.5 + (Math.random() - 0.5) * 0.2;
        const dist = isHost ? 0 : 160 + (i % 7) * 45 + (Math.random() - 0.5) * 20;
        const initX = (n.x && n.x > 10) ? n.x : (isHost ? cx : cx + Math.cos(angle) * dist);
        const initY = (n.y && n.y > 10) ? n.y : (isHost ? cy : cy + Math.sin(angle) * dist);

        existing = {
          id: n.id,
          kind: n.kind,
          radius,
          x: initX,
          y: initY,
          fx: isHost ? cx : (n.x && n.x > 10 ? n.x : undefined),
          fy: isHost ? cy : (n.y && n.y > 10 ? n.y : undefined),
        };
        nodeMap.set(n.id, existing);
      } else {
        existing.kind = n.kind;
        existing.radius = radius;
        if (isHost) {
          existing.fx = cx;
          existing.fy = cy;
        } else if (n.x !== undefined && n.y !== undefined && n.x > 10 && n.y > 10) {
          existing.x = n.x;
          existing.y = n.y;
        }
      }
    });

    // Apply any explicit recorded positions
    if (nodePositions) {
      for (const [id, pos] of Object.entries(nodePositions as Record<string, { x: number; y: number }>)) {
        const n = nodeMap.get(id);
        if (n && n.kind !== "host") {
          n.x = pos.x;
          n.y = pos.y;
          n.fx = pos.x;
          n.fy = pos.y;
        }
      }
    }

    currentNodes = Array.from(nodeMap.values());

    currentLinks = links
      .filter((l: { source: string; target: string }) =>
        nodeMap.has(l.source) && nodeMap.has(l.target)
      )
      .map((l: { source: string; target: string }) => ({
        source: l.source,
        target: l.target,
      }));

    const mode = layoutMode || currentLayoutMode;
    const modeChanged = mode !== currentLayoutMode;
    currentLayoutMode = mode;

    const structureChanged =
      nodeMap.size !== prevNodeCount ||
      currentLinks.length !== prevLinkCount ||
      modeChanged;

    if (!simulation) {
      simulation = forceSimulation<WorkerNode, WorkerLink>(currentNodes);

      let lastTickSent = 0;
      simulation.on("tick", () => {
        const now = Date.now();
        if (now - lastTickSent < 16 && simulation && simulation.alpha() > 0.03) {
          return;
        }
        lastTickSent = now;

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

    configureSimulationForces(mode, currentWidth, currentHeight);

    if (modeChanged) {
      simulation.alpha(0.85).alphaDecay(0.035).restart();
    } else if (structureChanged) {
      simulation.alpha(0.4).alphaDecay(0.04).restart();
    }
  } else if (type === "RESIZE") {
    const { width, height } = payload;
    currentWidth = Math.max(width || 0, 1200);
    currentHeight = Math.max(height || 0, 800);
    const hostNode = currentNodes.find((n) => n.kind === "host");
    if (hostNode) {
      hostNode.fx = currentWidth / 2;
      hostNode.fy = currentHeight / 2;
    }
    configureSimulationForces(currentLayoutMode, currentWidth, currentHeight);
    if (simulation) {
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
