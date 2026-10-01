import { commands } from "../bindings";
import { GraphDelta, GraphLink, GraphNode, TrafficSource } from "../types/graph";

export class LiveSource implements TrafficSource {
  public mode: "live" = "live";
  private intervalId: number | null = null;
  private unlistenFn: (() => void) | null = null;
  private listeners: Set<(d: GraphDelta) => void> = new Set();
  private nodesMap: Map<string, GraphNode> = new Map();
  private linksMap: Map<string, GraphLink> = new Map();

  public async start(): Promise<void> {
    if (this.unlistenFn !== null || this.intervalId !== null) return;

    await commands.setTrafficMode("live");

    // Initial snapshot fetch
    try {
      const snap = await commands.getSocketSnapshot();
      for (const n of snap.nodes) this.nodesMap.set(n.id, n);
      for (const l of snap.links) this.linksMap.set(l.id, l);
    } catch (e) {
      console.warn("Failed to load initial socket snapshot:", e);
    }

    // Connect to Tauri 1 Hz pushed event stream
    try {
      const { listen } = await import("@tauri-apps/api/event");
      this.unlistenFn = await listen<{ delta: GraphDelta }>("delta", (event) => {
        if (event.payload?.delta) {
          this.applyDelta(event.payload.delta);
        }
      });
    } catch {
      // Non-tauri fallback (browser mock / CI testing)
      this.intervalId = window.setInterval(async () => {
        try {
          const delta = await commands.getSocketDelta();
          this.applyDelta(delta);
        } catch {}
      }, 1000);
    }
  }

  public async stop(): Promise<void> {
    if (this.unlistenFn !== null) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private applyDelta(delta: GraphDelta): void {
    // Apply additions and removals
    for (const n of delta.addNodes) this.nodesMap.set(n.id, n);
    for (const id of delta.removeNodeIds) this.nodesMap.delete(id);
    for (const l of delta.addLinks) this.linksMap.set(l.id, l);
    for (const id of delta.removeLinkIds) this.linksMap.delete(id);

    // Apply node updates
    for (const u of delta.updateNodes) {
      const n = this.nodesMap.get(u.id);
      if (n) {
        if (u.bytesIn !== undefined) n.bytesIn = u.bytesIn;
        if (u.bytesOut !== undefined) n.bytesOut = u.bytesOut;
        if (u.rateIn !== undefined) n.rateIn = u.rateIn;
        if (u.rateOut !== undefined) n.rateOut = u.rateOut;
        if (u.lastSeen !== undefined) n.lastSeen = u.lastSeen;
        if (u.threat !== undefined) n.threat = u.threat;
      }
    }

    // Apply link updates
    for (const u of delta.updateLinks) {
      const l = this.linksMap.get(u.id);
      if (l) {
        if (u.bytesIn !== undefined) l.bytesIn = u.bytesIn;
        if (u.bytesOut !== undefined) l.bytesOut = u.bytesOut;
        if (u.rate !== undefined) l.rate = u.rate;
        if (u.packets !== undefined) l.packets = u.packets;
        if (u.state !== undefined) l.state = u.state;
        if (u.lastSeen !== undefined) l.lastSeen = u.lastSeen;
      }
    }

    if (
      delta.addNodes.length > 0 ||
      delta.updateNodes.length > 0 ||
      delta.removeNodeIds.length > 0 ||
      delta.addLinks.length > 0 ||
      delta.updateLinks.length > 0 ||
      delta.removeLinkIds.length > 0 ||
      (delta.alerts && delta.alerts.length > 0)
    ) {
      for (const cb of this.listeners) {
        cb(delta);
      }
    }
  }

  public async snapshot(): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
    if (this.nodesMap.size === 0) {
      try {
        const snap = await commands.getSocketSnapshot();
        for (const n of snap.nodes) this.nodesMap.set(n.id, n);
        for (const l of snap.links) this.linksMap.set(l.id, l);
      } catch (e) {
        console.warn("Failed to load initial socket snapshot:", e);
      }
    }
    return {
      nodes: Array.from(this.nodesMap.values()),
      links: Array.from(this.linksMap.values()),
    };
  }

  public onDelta(cb: (d: GraphDelta) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
