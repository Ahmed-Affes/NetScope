import { cloudStorage, RecordedChunk } from "../lib/supabase";
import { GraphDelta, GraphLink, GraphNode, TrafficSource } from "../types/graph";

export class ReplaySource implements TrafficSource {
  public mode: "replay" = "replay";
  private sessionId: string;
  private chunks: RecordedChunk[] = [];
  private allDeltas: GraphDelta[] = [];
  private currentIndex: number = 0;
  private timerId: number | null = null;
  private speed: number = 1.0;
  private listeners: Set<(d: GraphDelta) => void> = new Set();
  private nodesMap: Map<string, GraphNode> = new Map();
  private linksMap: Map<string, GraphLink> = new Map();
  private startTime: number = 0;
  private endTime: number = 0;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  public async load(): Promise<void> {
    const data = await cloudStorage.getSessionData(this.sessionId);
    this.chunks = data.chunks;
    this.allDeltas = this.chunks.flatMap((c) => c.deltas);

    if (this.allDeltas.length > 0) {
      this.startTime = this.allDeltas[0].t;
      this.endTime = this.allDeltas[this.allDeltas.length - 1].t;
    }
  }

  public setSpeed(speed: number) {
    this.speed = speed;
    if (this.timerId !== null) {
      this.stop();
      this.start();
    }
  }

  public getProgress(): number {
    if (this.allDeltas.length === 0) return 0;
    return this.currentIndex / this.allDeltas.length;
  }

  public getTimeRange(): { start: number; end: number } {
    return { start: this.startTime, end: this.endTime };
  }


  public seek(progress: number) {
    const targetIdx = Math.floor(progress * (this.allDeltas.length - 1));
    this.seekToIndex(targetIdx);
  }

  public seekToIndex(targetIdx: number) {
    const clamped = Math.max(0, Math.min(this.allDeltas.length - 1, targetIdx));
    this.nodesMap.clear();
    this.linksMap.clear();

    for (let i = 0; i <= clamped; i++) {
      const delta = this.allDeltas[i];
      for (const n of delta.addNodes) this.nodesMap.set(n.id, { ...n });
      for (const id of delta.removeNodeIds) this.nodesMap.delete(id);
      for (const l of delta.addLinks) this.linksMap.set(l.id, { ...l });
      for (const id of delta.removeLinkIds) this.linksMap.delete(id);

      for (const u of delta.updateNodes) {
        const n = this.nodesMap.get(u.id);
        if (n) {
          if (u.bytesIn !== undefined) n.bytesIn = u.bytesIn;
          if (u.bytesOut !== undefined) n.bytesOut = u.bytesOut;
          if (u.rateIn !== undefined) n.rateIn = u.rateIn;
          if (u.rateOut !== undefined) n.rateOut = u.rateOut;
          if (u.lastSeen !== undefined) n.lastSeen = u.lastSeen;
        }
      }

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
    }

    this.currentIndex = clamped;

    // Emit whole snapshot as delta
    const currentDelta: GraphDelta = {
      t: this.allDeltas[clamped]?.t || Date.now(),
      addNodes: Array.from(this.nodesMap.values()),
      updateNodes: [],
      removeNodeIds: [],
      addLinks: Array.from(this.linksMap.values()),
      updateLinks: [],
      removeLinkIds: [],
    };

    for (const cb of this.listeners) {
      cb(currentDelta);
    }
  }

  public async start(): Promise<void> {
    if (this.allDeltas.length === 0) {
      await this.load();
    }
    if (this.timerId !== null) return;

    const intervalMs = Math.max(16, Math.floor(100 / this.speed));
    this.timerId = window.setInterval(() => {
      if (this.currentIndex >= this.allDeltas.length) {
        this.stop();
        return;
      }

      const delta = this.allDeltas[this.currentIndex++];
      for (const cb of this.listeners) {
        cb(delta);
      }
    }, intervalMs);
  }

  public async stop(): Promise<void> {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public async snapshot(): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
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
