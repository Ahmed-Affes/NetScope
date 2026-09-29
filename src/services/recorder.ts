import { cloudStorage, RecordedChunk } from "../lib/supabase";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { GraphDelta } from "../types/graph";

class SessionRecorder {
  private currentSessionId: string | null = null;
  private currentChunkIndex: number = 0;
  private chunkStartTime: number = 0;
  private chunkDeltas: GraphDelta[] = [];
  private flushTimer: number | null = null;

  public async startRecording(title?: string): Promise<string> {
    if (this.currentSessionId) {
      console.warn("Recording already in progress");
      return this.currentSessionId;
    }

    const mode = useNetScopeStore.getState().trafficMode;
    const sessionTitle =
      title || `Session ${new Date().toLocaleTimeString()} [${mode.toUpperCase()}]`;

    const sessionId = await cloudStorage.createSession(sessionTitle, mode);
    this.currentSessionId = sessionId;
    this.currentChunkIndex = 0;
    this.chunkStartTime = Date.now();
    this.chunkDeltas = [];

    useNetScopeStore.getState().setRecording(true);

    // 10-second batch upload interval
    this.flushTimer = window.setInterval(() => {
      this.flushChunk();
    }, 10_000);

    return sessionId;
  }

  public recordDelta(delta: GraphDelta) {
    if (!this.currentSessionId) return;
    this.chunkDeltas.push(delta);
  }

  private async flushChunk() {
    if (!this.currentSessionId || this.chunkDeltas.length === 0) return;

    const now = Date.now();
    const chunk: RecordedChunk = {
      chunkIndex: this.currentChunkIndex++,
      startTime: this.chunkStartTime,
      endTime: now,
      deltas: [...this.chunkDeltas],
    };

    // Reset buffer for next chunk
    this.chunkDeltas = [];
    this.chunkStartTime = now;

    await cloudStorage.uploadChunk(this.currentSessionId, chunk);
  }

  public async stopRecording(): Promise<string | null> {
    if (!this.currentSessionId) return null;

    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining deltas
    await this.flushChunk();

    const sessionId = this.currentSessionId;
    const state = useNetScopeStore.getState();
    const nodes = Object.values(state.nodes);
    const links = Object.values(state.links);
    const alerts = state.alerts;

    await cloudStorage.finishSession(sessionId, nodes, links, alerts);

    this.currentSessionId = null;
    this.chunkDeltas = [];
    this.currentChunkIndex = 0;

    useNetScopeStore.getState().setRecording(false);
    return sessionId;
  }

  public isRecordingActive(): boolean {
    return this.currentSessionId !== null;
  }
}

export const recorder = new SessionRecorder();
