import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
} from "pixi.js";
import { GraphLink, GraphNode } from "../types/graph";
import { createGlowTexture } from "./glow";
import { ParticleSystem } from "./particles";
import { getLinkColor, NODE_COLORS, getNodeRadius } from "./theme";

export interface GraphEngineOptions {
  onSelectNode?: (nodeId: string | null) => void;
  onSelectLink?: (linkId: string | null) => void;
  onNodeDrag?: (nodeId: string, x: number, y: number) => void;
}

interface RenderNode {
  data: GraphNode;
  container: Container;
  glowSprite: Sprite;
  coreGraphics: Graphics;
  labelBg: Graphics;
  labelText: Text;
  x: number;
  y: number;
  radius: number;
  color: number;
}

export class GraphEngine {
  private app: Application;
  private containerElement: HTMLElement;
  private world: Container;
  private linksGraphics: Graphics;
  private particles: ParticleSystem;
  private nodesContainer: Container;
  private labelsContainer: Container;

  private nodesMap = new Map<string, RenderNode>();
  private linksMap = new Map<string, GraphLink>();
  private nodePositions = new Map<string, { x: number; y: number }>();

  private worker: Worker | null = null;
  private options: GraphEngineOptions;

  // Camera state
  private zoom = 1.0;
  private panX = 0;
  private panY = 0;
  private isDraggingCamera = false;
  private dragStartX = 0;
  private dragStartY = 0;

  // Interaction
  private hoveredNodeId: string | null = null;
  private selectedNodeId: string | null = null;
  private draggedNodeId: string | null = null;
  private isDestroyed = false;
  private isInitialized = false;

  public get ready(): boolean {
    return this.isInitialized && !this.isDestroyed;
  }

  public setSelectedNode(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
  }

  constructor(element: HTMLElement, options: GraphEngineOptions = {}) {
    this.containerElement = element;
    this.options = options;

    this.app = new Application();
    this.world = new Container();
    this.linksGraphics = new Graphics();
    this.particles = new ParticleSystem();
    this.nodesContainer = new Container();
    this.labelsContainer = new Container();
  }

  public async init(): Promise<void> {
    if (this.isDestroyed) return;
    const width = Math.max(this.containerElement.clientWidth || 0, window.innerWidth || 0, 1200);
    const height = Math.max(this.containerElement.clientHeight || 0, window.innerHeight || 0, 800);

    try {
      await this.app.init({
        width,
        height,
        backgroundColor: 0x07090d,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        preference: "webgl",
      });
    } catch (err) {
      console.warn("Pixi app init error:", err);
      return;
    }

    if (this.isDestroyed) {
      try {
        this.app.destroy(true, { children: true });
      } catch {
        // Ignore cleanup error if already destroyed
      }
      return;
    }

    this.isInitialized = true;

    if (this.app.canvas) {
      this.containerElement.appendChild(this.app.canvas as HTMLCanvasElement);
    }

    // Build scene hierarchy
    this.app.stage.addChild(this.world);
    this.world.addChild(this.linksGraphics);
    this.world.addChild(this.particles.container);
    this.world.addChild(this.nodesContainer);
    this.world.addChild(this.labelsContainer);

    // Enable stage events for camera panning
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    // Setup Layout Web Worker
    this.initLayoutWorker(width, height);

    // Bind event listeners
    this.setupInteractions();

    // Start render ticker
    this.app.ticker.add(this.onTick, this);
  }

  private initLayoutWorker(width: number, height: number): void {
    this.worker = new Worker(new URL("./layout.worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (event: MessageEvent) => {
      if (this.isDestroyed) return;
      const { type, positions, ids } = event.data;

      if (type === "TICK" && positions) {
        const floatArray = new Float32Array(positions);
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const x = floatArray[i * 2];
          const y = floatArray[i * 2 + 1];

          this.nodePositions.set(id, { x, y });

          const renderNode = this.nodesMap.get(id);
          if (renderNode) {
            renderNode.x = x;
            renderNode.y = y;
            renderNode.container.x = x;
            renderNode.container.y = y;
            renderNode.container.visible = true;
            renderNode.labelText.visible = true;
            renderNode.labelBg.visible = true;

            const cx = this.app.screen.width / 2;
            const cy = this.app.screen.height / 2;
            const isCenter = Math.abs(x - cx) < 32 && Math.abs(y - cy) < 32;
            const isLeft = x < cx - 15;

            let lx: number;
            let ly: number;

            if (isCenter) {
              lx = x - renderNode.labelText.width / 2;
              ly = y + renderNode.radius + 6;
            } else if (isLeft) {
              // Node is on left side -> flip label to the left so it points outwards
              lx = x - renderNode.radius - 8 - renderNode.labelText.width;
              ly = y - 7;
            } else {
              // Node is on right side -> label to the right
              lx = x + renderNode.radius + 8;
              ly = y - 7;
            }

            renderNode.labelText.x = lx;
            renderNode.labelText.y = ly;
            renderNode.labelBg.x = lx - 4;
            renderNode.labelBg.y = ly - 2;
          }
        }
      }
    };

    // Initial trigger
    this.worker.postMessage({
      type: "INIT",
      payload: {
        nodes: Array.from(this.nodesMap.values()).map((n) => ({
          id: n.data.id,
          kind: n.data.kind,
        })),
        links: Array.from(this.linksMap.values()).map((l) => ({
          source: l.source,
          target: l.target,
        })),
        width,
        height,
        layoutMode: "force",
      },
    });
  }

  public updateGraph(
    nodes: GraphNode[],
    links: GraphLink[],
    layoutMode = "force",
    nodePositions?: Record<string, { x: number; y: number }>
  ): void {
    if (this.isDestroyed || !this.isInitialized) return;

    // Update nodes
    const incomingNodeIds = new Set(nodes.map((n) => n.id));
    for (const [id, renderNode] of this.nodesMap.entries()) {
      if (!incomingNodeIds.has(id)) {
        this.nodesContainer.removeChild(renderNode.container);
        this.labelsContainer.removeChild(renderNode.labelText);
        this.labelsContainer.removeChild(renderNode.labelBg);
        try {
          renderNode.container.destroy({ children: true });
          renderNode.labelText.destroy();
          renderNode.labelBg.destroy();
        } catch {
          // Ignore if already cleaned
        }
        this.nodesMap.delete(id);
        this.nodePositions.delete(id);
      }
    }

    // Count connection degrees for node sizing
    const connectionCounts = new Map<string, number>();
    for (const l of links) {
      connectionCounts.set(l.source, (connectionCounts.get(l.source) || 0) + 1);
      connectionCounts.set(l.target, (connectionCounts.get(l.target) || 0) + 1);
    }

    for (const n of nodes) {
      const connCount = connectionCounts.get(n.id) || 1;
      if (!this.nodesMap.has(n.id)) {
        const renderNode = this.createNodeSprite(n, connCount);
        this.nodesMap.set(n.id, renderNode);
        this.nodesContainer.addChild(renderNode.container);
        this.labelsContainer.addChild(renderNode.labelBg);
        this.labelsContainer.addChild(renderNode.labelText);
      } else {
        const rn = this.nodesMap.get(n.id)!;
        rn.data = n;
        rn.radius = getNodeRadius(n.kind, connCount);
      }
    }

    // Update links
    this.linksMap.clear();
    for (const l of links) {
      this.linksMap.set(l.id, l);
      // Flow particles on active links
      if (l.rate > 0 && Math.random() < 0.2) {
        const color = getLinkColor(l.port, l.proto);
        this.particles.spawn(l.source, l.target, color);
      }
    }

    // Post to worker
    if (this.worker) {
      const width = Math.max(this.app.screen.width, 1200);
      const height = Math.max(this.app.screen.height, 800);
      this.worker.postMessage({
        type: "UPDATE_GRAPH",
        payload: {
          nodes: nodes.map((n) => ({ id: n.id, kind: n.kind, x: n.x, y: n.y })),
          links: links.map((l) => ({ source: l.source, target: l.target })),
          width,
          height,
          layoutMode,
          nodePositions,
        },
      });
    }
  }

  private createNodeSprite(node: GraphNode, connectionCount: number): RenderNode {
    const container = new Container();
    const color = NODE_COLORS[node.kind] || 0x60a5fa;
    const radius = getNodeRadius(node.kind, connectionCount);

    // Crisp neon halo (subtle, clean, not overblown)
    const glowRadius = radius * 1.6;
    const glowTex = createGlowTexture(color, glowRadius);
    const glowSprite = new Sprite(glowTex);
    glowSprite.anchor.set(0.5);
    glowSprite.alpha = node.kind === "host" ? 0.65 : node.kind === "threat" ? 0.6 : 0.35;
    container.addChild(glowSprite);

    // Crisp core disc with border
    const coreGraphics = new Graphics();
    coreGraphics.circle(0, 0, radius);
    coreGraphics.fill({ color, alpha: 0.95 });
    coreGraphics.stroke({
      color: node.kind === "threat" ? 0xff4d4d : 0xffffff,
      width: node.kind === "host" ? 2 : 1,
      alpha: 0.8,
    });
    container.addChild(coreGraphics);

    // Label Text with sleek dark backing pill
    const labelStyle = new TextStyle({
      fontFamily: "'JetBrains Mono', Consolas, monospace",
      fontSize: node.kind === "port" ? 8.5 : 10,
      fill: node.kind === "threat" ? "#fca5a5" : node.kind === "port" ? "#fde68a" : "#cbd5e1",
      letterSpacing: 0.2,
      fontWeight: node.kind === "host" || node.kind === "threat" ? "bold" : "normal",
    });

    const labelText = new Text({ text: node.label, style: labelStyle });
    labelText.alpha = 0.9;

    // Dark pill background behind text for readability over links
    const textWidth = Math.max(labelText.width + 8, 30);
    const textHeight = node.kind === "port" ? 14 : 16;
    const labelBg = new Graphics();
    labelBg.roundRect(0, 0, textWidth, textHeight, 4);
    labelBg.fill({ color: 0x07090d, alpha: 0.75 });
    labelBg.stroke({
      color: node.kind === "threat" ? 0xef4444 : node.kind === "port" ? 0xf59e0b : 0x334155,
      width: 1,
      alpha: node.kind === "port" ? 0.35 : 0.4,
    });

    // Make node interactive
    container.eventMode = "static";
    container.cursor = "pointer";
    container.on("pointerover", () => this.setHoveredNode(node.id));
    container.on("pointerout", () => this.setHoveredNode(null));
    container.on("pointerdown", (e) => {
      e.stopPropagation();
      this.draggedNodeId = node.id;
      if (this.options.onSelectNode) {
        this.options.onSelectNode(node.id);
      }
    });

    // Initialize visibility and position
    const cachedPos = this.nodePositions.get(node.id);
    if (cachedPos) {
      container.x = cachedPos.x;
      container.y = cachedPos.y;
      container.visible = true;
      labelBg.visible = true;
      labelText.visible = true;
    } else {
      container.visible = false;
      labelBg.visible = false;
      labelText.visible = false;
    }

    return {
      data: node,
      container,
      glowSprite,
      coreGraphics,
      labelBg,
      labelText,
      x: container.x,
      y: container.y,
      radius,
      color,
    };
  }

  private setHoveredNode(nodeId: string | null): void {
    this.hoveredNodeId = nodeId;
  }

  private onTick(): void {
    // 1. Draw Links
    this.linksGraphics.clear();

    const isHoverActive = this.hoveredNodeId !== null;
    const connectedNodeIds = new Set<string>();

    if (isHoverActive) {
      connectedNodeIds.add(this.hoveredNodeId!);
      for (const link of this.linksMap.values()) {
        if (link.source === this.hoveredNodeId) {
          connectedNodeIds.add(link.target);
        } else if (link.target === this.hoveredNodeId) {
          connectedNodeIds.add(link.source);
        }
      }
    }

    // Batch links into style buckets to eliminate individual stroke tessellation
    const buckets = new Map<string, { color: number; alpha: number; width: number; coords: number[] }>();

    for (const link of this.linksMap.values()) {
      const src = this.nodePositions.get(link.source);
      const tgt = this.nodePositions.get(link.target);
      if (!src || !tgt) continue;

      const isConnected =
        !isHoverActive ||
        (link.source === this.hoveredNodeId || link.target === this.hoveredNodeId);

      const color = getLinkColor(link.port, link.proto);
      const alpha = isConnected ? (link.rate > 0 ? 0.75 : 0.3) : 0.08;
      const width = link.rate > 1000 ? 1.5 : 1;

      const key = `${color}_${alpha}_${width}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { color, alpha, width, coords: [] };
        buckets.set(key, bucket);
      }
      bucket.coords.push(src.x, src.y, tgt.x, tgt.y);
    }

    for (const bucket of buckets.values()) {
      for (let i = 0; i < bucket.coords.length; i += 4) {
        this.linksGraphics.moveTo(bucket.coords[i], bucket.coords[i + 1]);
        this.linksGraphics.lineTo(bucket.coords[i + 2], bucket.coords[i + 3]);
      }
      this.linksGraphics.stroke({
        width: bucket.width,
        color: bucket.color,
        alpha: bucket.alpha,
      });
    }

    // 2. Dim/Brighten Nodes & Level of Detail (LOD) for Labels
    const isZoomedIn = this.zoom >= 1.35;
    for (const [id, rn] of this.nodesMap.entries()) {
      const isConnected = !isHoverActive || connectedNodeIds.has(id);
      rn.container.alpha = isConnected ? 1.0 : 0.15;

      const isLarge = rn.radius >= 14 || rn.data.kind === "host" || rn.data.kind === "threat";
      const isHovered = id === this.hoveredNodeId;
      const isSelected = id === this.selectedNodeId;
      const showLabel = isZoomedIn || isLarge || isHovered || isSelected;

      rn.labelText.visible = showLabel;
      rn.labelBg.visible = showLabel;

      if (showLabel) {
        rn.labelText.alpha = isConnected ? (isHoverActive ? 1.0 : 0.85) : 0.15;
        rn.labelBg.alpha = isConnected ? (isHoverActive ? 0.9 : 0.7) : 0.1;
      }

      // Pulse red threat nodes
      if (rn.data.kind === "threat") {
        const pulse = 0.5 + Math.sin(Date.now() * 0.006) * 0.3;
        rn.glowSprite.alpha = pulse;
      }
    }

    // 3. Update flowing particles
    this.particles.update(this.nodePositions);
  }

  private setupInteractions(): void {
    const canvas = this.app.canvas as HTMLCanvasElement;

    // PixiJS stage background click for camera dragging
    this.app.stage.on("pointerdown", (e) => {
      // Only drag camera if user clicked the background, not a node
      if (e.target === this.app.stage) {
        this.isDraggingCamera = true;
        this.dragStartX = e.global.x - this.panX;
        this.dragStartY = e.global.y - this.panY;
        if (this.options.onSelectNode) {
          this.options.onSelectNode(null);
        }
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (this.draggedNodeId && this.worker) {
        const rect = canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - this.panX) / this.zoom;
        const worldY = (e.clientY - rect.top - this.panY) / this.zoom;

        this.worker.postMessage({
          type: "DRAG_NODE",
          payload: { id: this.draggedNodeId, x: worldX, y: worldY, isFixed: true },
        });

        if (this.options.onNodeDrag) {
          this.options.onNodeDrag(this.draggedNodeId, worldX, worldY);
        }
      } else if (this.isDraggingCamera) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.applyTransform();
      }
    });

    window.addEventListener("pointerup", () => {
      if (this.draggedNodeId && this.worker) {
        this.worker.postMessage({
          type: "DRAG_NODE",
          payload: { id: this.draggedNodeId, x: 0, y: 0, isFixed: false },
        });
        this.draggedNodeId = null;
      }
      this.isDraggingCamera = false;
    });

    // Zoom on wheel towards mouse point
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(Math.max(this.zoom * factor, 0.25), 3.0);

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.applyTransform();
    });

    window.addEventListener("resize", this.onResize);
  }

  private applyTransform(): void {
    this.world.scale.set(this.zoom);
    this.world.position.set(this.panX, this.panY);
  }

  private onResize = (): void => {
    if (!this.containerElement || this.isDestroyed) return;
    const width = Math.max(this.containerElement.clientWidth, window.innerWidth, 1200);
    const height = Math.max(this.containerElement.clientHeight, window.innerHeight, 800);
    this.app.renderer.resize(width, height);
    if (this.worker) {
      this.worker.postMessage({
        type: "RESIZE",
        payload: { width, height },
      });
    }
  };

  public fitView(): void {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  public destroy(): void {
    this.isDestroyed = true;
    window.removeEventListener("resize", this.onResize);
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
    this.particles.clear();
    if (this.isInitialized) {
      try {
        this.app.destroy(true, { children: true });
      } catch (err) {
        console.warn("Pixi app destroy ignored:", err);
      }
    }
  }
}
