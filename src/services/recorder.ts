import { cloudStorage, RecordedChunk } from "../lib/supabase";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { GraphDelta } from "../types/graph";

class SessionRecorder {
  private currentSessionId: string | null = null;
  private currentChunkIndex: number = 0;
  private chunkStartTime: number = 0;
  private chunkDeltas: GraphDelta[] = [];
  private flushTimer: number | null = null;
  private secondsTimer: number | null = null;
  private lastMoveRecord: number = 0;

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

    // 1-second UI clock timer
    if (this.secondsTimer !== null) clearInterval(this.secondsTimer);
    this.secondsTimer = window.setInterval(() => {
      useNetScopeStore.setState((s) => ({
        recordingSeconds: s.recordingSeconds + 1,
      }));
    }, 1000);

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

  public recordNodeMove(nodeId: string, x: number, y: number) {
    if (!this.currentSessionId) return;
    const now = Date.now();
    // Throttle movement records to 30 Hz (33ms) to keep recording compact
    if (now - this.lastMoveRecord < 33) return;
    this.lastMoveRecord = now;

    this.recordDelta({
      t: now,
      addNodes: [],
      updateNodes: [],
      removeNodeIds: [],
      addLinks: [],
      updateLinks: [],
      removeLinkIds: [],
      nodePositions: {
        [nodeId]: { x: Math.round(x), y: Math.round(y) },
      },
    });
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

    if (this.secondsTimer !== null) {
      clearInterval(this.secondsTimer);
      this.secondsTimer = null;
    }

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
