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
}

interface RenderNode {
  data: GraphNode;
  container: Container;
  glowSprite: Sprite;
  coreGraphics: Graphics;
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

  // Node interaction
  private hoveredNodeId: string | null = null;
  private draggedNodeId: string | null = null;
  private isDestroyed = false;

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
    const width = this.containerElement.clientWidth || window.innerWidth;
    const height = this.containerElement.clientHeight || window.innerHeight;

    await this.app.init({
      width,
      height,
      backgroundColor: 0x07090d,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.containerElement.appendChild(this.app.canvas as HTMLCanvasElement);

    // Build scene hierarchy
    this.app.stage.addChild(this.world);
    this.world.addChild(this.linksGraphics);
    this.world.addChild(this.particles.container);
    this.world.addChild(this.nodesContainer);
    this.world.addChild(this.labelsContainer);

    // Setup Layout Web Worker
    this.initLayoutWorker(width, height);

    // Bind event listeners
    this.setupInteractions();

    // Start render ticker
    this.app.ticker.add(this.onTick, this);
  }

  private initLayoutWorker(width: number, height: number): void {
    this.worker = new Worker(
      new URL("./layout.worker.ts", import.meta.url),
      { type: "module" }
    );

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
            renderNode.labelText.x = x + renderNode.radius + 5;
            renderNode.labelText.y = y - 6;
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
    layoutMode = "force"
  ): void {
    if (this.isDestroyed) return;

    // Update nodes
    const incomingNodeIds = new Set(nodes.map((n) => n.id));
    for (const [id, renderNode] of this.nodesMap.entries()) {
      if (!incomingNodeIds.has(id)) {
        this.nodesContainer.removeChild(renderNode.container);
        this.labelsContainer.removeChild(renderNode.labelText);
        this.nodesMap.delete(id);
        this.nodePositions.delete(id);
      }
    }

    for (const n of nodes) {
      if (!this.nodesMap.has(n.id)) {
        const renderNode = this.createNodeSprite(n);
        this.nodesMap.set(n.id, renderNode);
        this.nodesContainer.addChild(renderNode.container);
        this.labelsContainer.addChild(renderNode.labelText);
      } else {
        // Update existing node data
        const rn = this.nodesMap.get(n.id)!;
        rn.data = n;
      }
    }

    // Update links
    this.linksMap.clear();
    for (const l of links) {
      this.linksMap.set(l.id, l);
      // Spawn flowing particles on active links
      if (l.rate > 0 && Math.random() < 0.25) {
        const color = getLinkColor(l.port, l.proto);
        this.particles.spawn(l.source, l.target, color);
      }
    }

    // Notify worker
    if (this.worker) {
      const width = this.app.screen.width;
      const height = this.app.screen.height;
      this.worker.postMessage({
        type: "UPDATE_GRAPH",
        payload: {
          nodes: nodes.map((n) => ({ id: n.id, kind: n.kind })),
          links: links.map((l) => ({ source: l.source, target: l.target })),
          width,
          height,
          layoutMode,
        },
      });
    }
  }

  private createNodeSprite(node: GraphNode): RenderNode {
    const container = new Container();
    const color = NODE_COLORS[node.kind] || 0x60a5fa;
    const radius = getNodeRadius(node.kind, node.bytesIn + node.bytesOut);

    // Additive glow halo
    const glowTex = createGlowTexture(color, radius * 3.5);
    const glowSprite = new Sprite(glowTex);
    glowSprite.anchor.set(0.5);
    glowSprite.blendMode = "add";
    glowSprite.alpha = node.kind === "host" ? 0.9 : 0.6;
    container.addChild(glowSprite);

    // Core circle
    const coreGraphics = new Graphics();
    coreGraphics.circle(0, 0, radius);
    coreGraphics.fill({ color, alpha: 0.95 });
    if (node.kind === "host") {
      coreGraphics.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
    }
    container.addChild(coreGraphics);

    // Label Text
    const labelStyle = new TextStyle({
      fontFamily: "'JetBrains Mono', monospace, Consolas",
      fontSize: 10,
      fill: "#94a3b8",
      letterSpacing: 0.5,
    });
    const labelText = new Text({ text: node.label, style: labelStyle });
    labelText.alpha = 0.75;

    // Node hit testing & drag
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

    return {
      data: node,
      container,
      glowSprite,
      coreGraphics,
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

    for (const link of this.linksMap.values()) {
      const src = this.nodePositions.get(link.source);
      const tgt = this.nodePositions.get(link.target);
      if (!src || !tgt) continue;

      const isConnected =
        !isHoverActive ||
        (link.source === this.hoveredNodeId || link.target === this.hoveredNodeId);

      const color = getLinkColor(link.port, link.proto);
      const alpha = isConnected ? (link.rate > 0 ? 0.7 : 0.35) : 0.08;

      this.linksGraphics.moveTo(src.x, src.y);
      this.linksGraphics.lineTo(tgt.x, tgt.y);
      this.linksGraphics.stroke({
        width: link.rate > 1000 ? 1.5 : 1,
        color,
        alpha,
      });
    }

    // 2. Dim/Brighten Nodes
    for (const [id, rn] of this.nodesMap.entries()) {
      const isConnected = !isHoverActive || connectedNodeIds.has(id);
      rn.container.alpha = isConnected ? 1.0 : 0.15;
      rn.labelText.alpha = isConnected ? (isHoverActive ? 1.0 : 0.75) : 0.1;

      // Pulse red threat nodes
      if (rn.data.kind === "threat") {
        const pulse = 0.6 + Math.sin(Date.now() * 0.005) * 0.4;
        rn.glowSprite.alpha = pulse;
      }
    }

    // 3. Update Particles
    this.particles.update(this.nodePositions);
  }

  private setupInteractions(): void {
    const canvas = this.app.canvas as HTMLCanvasElement;

    // Pan with mouse drag
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0 && !this.draggedNodeId) {
        this.isDraggingCamera = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (this.draggedNodeId && this.worker) {
        // Convert screen coordinates to world coordinates
        const rect = canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - this.panX) / this.zoom;
        const worldY = (e.clientY - rect.top - this.panY) / this.zoom;

        this.worker.postMessage({
          type: "DRAG_NODE",
          payload: { id: this.draggedNodeId, x: worldX, y: worldY, isFixed: true },
        });
      } else if (this.isDraggingCamera) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.applyTransform();
      }
    });

    window.addEventListener("mouseup", () => {
      if (this.draggedNodeId && this.worker) {
        this.worker.postMessage({
          type: "DRAG_NODE",
          payload: { id: this.draggedNodeId, x: 0, y: 0, isFixed: false },
        });
        this.draggedNodeId = null;
      }
      this.isDraggingCamera = false;
    });

    // Zoom to mouse cursor
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(Math.max(this.zoom * factor, 0.25), 3.5);

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.applyTransform();
    });

    // Resize handler
    window.addEventListener("resize", this.onResize);
  }

  private applyTransform(): void {
    this.world.scale.set(this.zoom);
    this.world.position.set(this.panX, this.panY);
  }

  private onResize = (): void => {
    if (!this.containerElement || this.isDestroyed) return;
    const width = this.containerElement.clientWidth;
    const height = this.containerElement.clientHeight;
    this.app.renderer.resize(width, height);
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
      this.worker.terminate();
      this.worker = null;
    }
    this.particles.clear();
    this.app.destroy(true, { children: true });
  }
}
