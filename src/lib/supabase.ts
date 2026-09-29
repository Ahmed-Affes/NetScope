import { createClient } from "@supabase/supabase-js";
import { GraphDelta, GraphLink, GraphNode, Alert } from "../types/graph";

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";


export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    !supabaseUrl.includes("placeholder")
);

// Fallback dummy URL to prevent createClient crashes when env variables are empty
const validUrl = isSupabaseConfigured ? supabaseUrl : "https://dummy-netscope.supabase.co";
const validKey = isSupabaseConfigured ? supabaseAnonKey : "dummy-anon-key";

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface RecordedChunk {
  chunkIndex: number;
  startTime: number;
  endTime: number;
  deltas: GraphDelta[];
}

export interface SessionMetadata {
  id: string;
  title: string;
  mode: string;
  startedAt: number;
  endedAt?: number;
  totalBytesIn: number;
  totalBytesOut: number;
  peakNodes: number;
  peakLinks: number;
  sampleCount: number;
  alertsCount: number;
}

// In-Memory store for offline/demo/unconfigured modes
class MemorySessionStore {
  private sessions: Map<string, SessionMetadata> = new Map();
  private sessionChunks: Map<string, RecordedChunk[]> = new Map();
  private sessionNodes: Map<string, GraphNode[]> = new Map();
  private sessionLinks: Map<string, GraphLink[]> = new Map();
  private sessionAlerts: Map<string, Alert[]> = new Map();

  public createSession(title: string, mode: string = "simulator"): string {
    const id = "sess_" + Math.random().toString(36).substring(2, 11);
    const meta: SessionMetadata = {
      id,
      title,
      mode,
      startedAt: Date.now(),
      totalBytesIn: 0,
      totalBytesOut: 0,
      peakNodes: 0,
      peakLinks: 0,
      sampleCount: 0,
      alertsCount: 0,
    };
    this.sessions.set(id, meta);
    this.sessionChunks.set(id, []);
    this.sessionAlerts.set(id, []);
    return id;
  }

  public appendChunk(sessionId: string, chunk: RecordedChunk) {
    const list = this.sessionChunks.get(sessionId) || [];
    list.push(chunk);
    this.sessionChunks.set(sessionId, list);

    const meta = this.sessions.get(sessionId);
    if (meta) {
      meta.sampleCount = list.length;
      meta.endedAt = chunk.endTime;
    }
  }

  public endSession(
    sessionId: string,
    nodes: GraphNode[],
    links: GraphLink[],
    alerts: Alert[]
  ) {
    const meta = this.sessions.get(sessionId);
    if (meta) {
      meta.endedAt = Date.now();
      meta.peakNodes = nodes.length;
      meta.peakLinks = links.length;
      meta.alertsCount = alerts.length;
      meta.totalBytesIn = nodes.reduce((sum, n) => sum + n.bytesIn, 0);
      meta.totalBytesOut = nodes.reduce((sum, n) => sum + n.bytesOut, 0);
    }
    this.sessionNodes.set(sessionId, nodes);
    this.sessionLinks.set(sessionId, links);
    this.sessionAlerts.set(sessionId, alerts);
  }

  public listSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.startedAt - a.startedAt
    );
  }

  public getSession(sessionId: string): {
    meta?: SessionMetadata;
    chunks: RecordedChunk[];
    nodes: GraphNode[];
    links: GraphLink[];
    alerts: Alert[];
  } {
    return {
      meta: this.sessions.get(sessionId),
      chunks: this.sessionChunks.get(sessionId) || [],
      nodes: this.sessionNodes.get(sessionId) || [],
      links: this.sessionLinks.get(sessionId) || [],
      alerts: this.sessionAlerts.get(sessionId) || [],
    };
  }
}

export const memoryStore = new MemorySessionStore();

// High level cloud persistence functions
export const cloudStorage = {
  async createSession(title: string, mode: string): Promise<string> {
    if (!isSupabaseConfigured) {
      return memoryStore.createSession(title, mode);
    }

    try {
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          title,
          mode,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !data) throw error;
      return data.id;
    } catch (e) {
      console.warn("Supabase createSession failed, falling back to memory:", e);
      return memoryStore.createSession(title, mode);
    }
  },

  async uploadChunk(sessionId: string, chunk: RecordedChunk): Promise<void> {
    if (!isSupabaseConfigured) {
      memoryStore.appendChunk(sessionId, chunk);
      return;
    }

    try {
      const { error } = await supabase.rpc("insert_session_chunk", {
        p_session_id: sessionId,
        p_chunk_index: chunk.chunkIndex,
        p_start_time: new Date(chunk.startTime).toISOString(),
        p_end_time: new Date(chunk.endTime).toISOString(),
        p_data: chunk,
      });
      if (error) throw error;
    } catch (e) {
      console.warn("Supabase uploadChunk failed, storing in memory:", e);
      memoryStore.appendChunk(sessionId, chunk);
    }
  },

  async finishSession(
    sessionId: string,
    nodes: GraphNode[],
    links: GraphLink[],
    alerts: Alert[]
  ): Promise<void> {
    memoryStore.endSession(sessionId, nodes, links, alerts);

    if (!isSupabaseConfigured) return;

    try {
      await supabase
        .from("sessions")
        .update({
          ended_at: new Date().toISOString(),
          peak_nodes: nodes.length,
          peak_links: links.length,
          total_bytes_in: nodes.reduce((sum, n) => sum + n.bytesIn, 0),
          total_bytes_out: nodes.reduce((sum, n) => sum + n.bytesOut, 0),
        })
        .eq("id", sessionId);
    } catch (e) {
      console.warn("Supabase finishSession update error:", e);
    }
  },

  async listSessions(): Promise<SessionMetadata[]> {
    if (!isSupabaseConfigured) {
      return memoryStore.listSessions();
    }

    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("started_at", { ascending: false });

      if (error || !data) return memoryStore.listSessions();

      return data.map((d: any) => ({
        id: d.id,
        title: d.title,
        mode: d.mode,
        startedAt: new Date(d.started_at).getTime(),
        endedAt: d.ended_at ? new Date(d.ended_at).getTime() : undefined,
        totalBytesIn: Number(d.total_bytes_in || 0),
        totalBytesOut: Number(d.total_bytes_out || 0),
        peakNodes: d.peak_nodes || 0,
        peakLinks: d.peak_links || 0,
        sampleCount: d.sample_count || 0,
        alertsCount: 0,
      }));
    } catch {
      return memoryStore.listSessions();
    }
  },

  async getSessionData(sessionId: string) {
    if (!isSupabaseConfigured) {
      return memoryStore.getSession(sessionId);
    }

    try {
      const { data: chunks, error } = await supabase
        .from("sample_chunks")
        .select("*")
        .eq("session_id", sessionId)
        .order("chunk_index", { ascending: true });

      if (error || !chunks || chunks.length === 0) {
        return memoryStore.getSession(sessionId);
      }

      return {
        chunks: chunks.map((c: any) => c.data_json as RecordedChunk),
        nodes: [],
        links: [],
        alerts: [],
      };
    } catch {
      return memoryStore.getSession(sessionId);
    }
  },
};
