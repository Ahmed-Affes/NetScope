import { cloudStorage, RecordedChunk } from "../lib/supabase";
import { useNetScopeStore } from "../store/useNetScopeStore";
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

  constructor(sessionId: string = "latest") {
    this.sessionId = sessionId;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public async setSession(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.stop();
    this.currentIndex = 0;
    this.allDeltas = [];
    this.nodesMap.clear();
    this.linksMap.clear();
    await this.load();
    this.seekToIndex(0);
  }

  public async load(): Promise<void> {
    const data = await cloudStorage.getSessionData(this.sessionId);
    this.chunks = data.chunks;
    this.allDeltas = this.chunks.flatMap((c) => c.deltas);

    if (this.allDeltas.length > 0) {
      this.startTime = this.allDeltas[0].t;
      this.endTime = this.allDeltas[this.allDeltas.length - 1].t;
      // Pre-seed initial state
      this.seekToIndex(0);
    }
  }

  public setSpeed(speed: number) {
    this.speed = speed;
    useNetScopeStore.getState().setReplaySpeed(speed);
    if (this.timerId !== null) {
      this.stop();
      this.start();
    }
  }

  public getProgress(): number {
    if (this.allDeltas.length <= 1) return 0;
    return this.currentIndex / (this.allDeltas.length - 1);
  }

  public getTimeRange(): { start: number; end: number } {
    return { start: this.startTime, end: this.endTime };
  }

  public seek(progress: number) {
    if (this.allDeltas.length === 0) return;
    const targetIdx = Math.floor(progress * (this.allDeltas.length - 1));
    this.seekToIndex(targetIdx);
    useNetScopeStore.getState().setReplayProgress(progress);
  }

  public seekToIndex(targetIdx: number) {
    if (this.allDeltas.length === 0) return;
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

      if (delta.nodePositions) {
        for (const [id, pos] of Object.entries(delta.nodePositions)) {
          const n = this.nodesMap.get(id);
          if (n) {
            n.x = pos.x;
            n.y = pos.y;
          }
        }
      }
    }

    this.currentIndex = clamped;

    const currentPositions: Record<string, { x: number; y: number }> = {};
    for (const n of this.nodesMap.values()) {
      if (n.x !== undefined && n.y !== undefined) {
        currentPositions[n.id] = { x: n.x, y: n.y };
      }
    }

    // Emit whole snapshot as delta
    const currentDelta: GraphDelta = {
      t: this.allDeltas[clamped]?.t || Date.now(),
      addNodes: Array.from(this.nodesMap.values()),
      updateNodes: [],
      removeNodeIds: [],
      addLinks: Array.from(this.linksMap.values()),
      updateLinks: [],
      removeLinkIds: [],
      alerts: this.allDeltas[clamped]?.alerts,
      nodePositions: Object.keys(currentPositions).length > 0 ? currentPositions : undefined,
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

    // If at end, loop back to start
    if (this.currentIndex >= this.allDeltas.length - 1) {
      this.seekToIndex(0);
    }

    useNetScopeStore.getState().setReplayPlaying(true);

    const intervalMs = Math.max(30, Math.floor(1000 / this.speed));
    this.timerId = window.setInterval(() => {
      if (this.currentIndex >= this.allDeltas.length) {
        this.stop();
        return;
      }

      const delta = this.allDeltas[this.currentIndex++];
      if (delta.nodePositions) {
        for (const [id, pos] of Object.entries(delta.nodePositions)) {
          const n = this.nodesMap.get(id);
          if (n) {
            n.x = pos.x;
            n.y = pos.y;
          }
        }
      }
      for (const cb of this.listeners) {
        cb(delta);
      }

      const prog = this.getProgress();
      useNetScopeStore.getState().setReplayProgress(prog);
    }, intervalMs);
  }

  public async stop(): Promise<void> {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    useNetScopeStore.getState().setReplayPlaying(false);
  }

  public togglePlay(): void {
    if (this.timerId !== null) {
      this.stop();
    } else {
      this.start();
    }
  }

  public isPlaying(): boolean {
    return this.timerId !== null;
  }

  public async snapshot(): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
    if (this.allDeltas.length === 0) {
      await this.load();
    }
    if (this.nodesMap.size === 0 && this.allDeltas.length > 0) {
      this.seekToIndex(0);
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

// Shared singleton replay controller
export const replayController = new ReplaySource("latest");
