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

function createSeedIncidentSession(): {
  meta: SessionMetadata;
  chunks: RecordedChunk[];
} {
  const baseTime = Date.now() - 300_000;
  const meta: SessionMetadata = {
    id: "sess_incident_trace_01",
    title: "Incident Replay: Suspicious C2 Beacon & Port Sweep on PC",
    mode: "live",
    startedAt: baseTime,
    endedAt: baseTime + 60_000,
    totalBytesIn: 1_450_000,
    totalBytesOut: 8_200_000,
    peakNodes: 6,
    peakLinks: 4,
    sampleCount: 4,
    alertsCount: 2,
  };

  const chunks: RecordedChunk[] = [
    {
      chunkIndex: 0,
      startTime: baseTime,
      endTime: baseTime + 15_000,
      deltas: [
        {
          t: baseTime,
          addNodes: [
            {
              id: "host:local",
              kind: "host",
              label: "PC: Workstation",
              ip: "127.0.0.1",
              firstSeen: baseTime,
              lastSeen: baseTime,
              bytesIn: 1024,
              bytesOut: 1024,
              rateIn: 100,
              rateOut: 100,
            },
            {
              id: "proc:chrome.exe",
              kind: "process",
              label: "chrome.exe",
              pid: 1420,
              ip: "127.0.0.1",
              firstSeen: baseTime,
              lastSeen: baseTime,
              bytesIn: 54000,
              bytesOut: 12000,
              rateIn: 2500,
              rateOut: 800,
            },
            {
              id: "proc:discord.exe",
              kind: "process",
              label: "discord.exe",
              pid: 8840,
              ip: "127.0.0.1",
              firstSeen: baseTime,
              lastSeen: baseTime,
              bytesIn: 12000,
              bytesOut: 8000,
              rateIn: 800,
              rateOut: 400,
            },
            {
              id: "ip:142.250.190.46",
              kind: "internet",
              label: "142.250.190.46 (Google HTTPS)",
              ip: "142.250.190.46",
              firstSeen: baseTime,
              lastSeen: baseTime,
              bytesIn: 54000,
              bytesOut: 12000,
              rateIn: 2500,
              rateOut: 800,
            },
          ],
          updateNodes: [],
          removeNodeIds: [],
          addLinks: [
            {
              id: "link:host->chrome",
              source: "host:local",
              target: "proc:chrome.exe",
              proto: "tcp",
              port: 443,
              bytesIn: 54000,
              bytesOut: 12000,
              rate: 3300,
              packets: 120,
              firstSeen: baseTime,
              lastSeen: baseTime,
            },
            {
              id: "link:chrome->google",
              source: "proc:chrome.exe",
              target: "ip:142.250.190.46",
              proto: "tcp",
              port: 443,
              bytesIn: 54000,
              bytesOut: 12000,
              rate: 3300,
              packets: 120,
              firstSeen: baseTime,
              lastSeen: baseTime,
            },
          ],
          updateLinks: [],
          removeLinkIds: [],
        },
      ],
    },
    {
      chunkIndex: 1,
      startTime: baseTime + 15_000,
      endTime: baseTime + 30_000,
      deltas: [
        {
          t: baseTime + 15_000,
          addNodes: [
            {
              id: "proc:powershell.exe",
              kind: "process",
              label: "powershell.exe",
              pid: 19842,
              ip: "127.0.0.1",
              firstSeen: baseTime + 15_000,
              lastSeen: baseTime + 15_000,
              bytesIn: 4096,
              bytesOut: 8192,
              rateIn: 400,
              rateOut: 800,
            },
          ],
          updateNodes: [],
          removeNodeIds: [],
          addLinks: [
            {
              id: "link:host->powershell",
              source: "host:local",
              target: "proc:powershell.exe",
              proto: "tcp",
              port: 8443,
              bytesIn: 4096,
              bytesOut: 8192,
              rate: 1200,
              packets: 18,
              firstSeen: baseTime + 15_000,
              lastSeen: baseTime + 15_000,
            },
          ],
          updateLinks: [],
          removeLinkIds: [],
        },
      ],
    },
    {
      chunkIndex: 2,
      startTime: baseTime + 30_000,
      endTime: baseTime + 45_000,
      deltas: [
        {
          t: baseTime + 30_000,
          addNodes: [
            {
              id: "threat:c2-cobalt",
              kind: "threat",
              label: "c2-darkcomet-beacon.evil",
              ip: "194.26.29.112",
              country: "RU",
              firstSeen: baseTime + 30_000,
              lastSeen: baseTime + 30_000,
              bytesIn: 32000,
              bytesOut: 48000,
              rateIn: 1800,
              rateOut: 2400,
              threat: {
                severity: "high",
                reasons: ["Cobalt Strike C2 Beacon outbound callback on port 8443"],
              },
            },
          ],
          updateNodes: [],
          removeNodeIds: [],
          addLinks: [
            {
              id: "link:powershell->c2",
              source: "proc:powershell.exe",
              target: "threat:c2-cobalt",
              proto: "tcp",
              port: 8443,
              bytesIn: 32000,
              bytesOut: 48000,
              rate: 4200,
              packets: 240,
              state: "ESTABLISHED",
              firstSeen: baseTime + 30_000,
              lastSeen: baseTime + 30_000,
            },
          ],
          updateLinks: [],
          removeLinkIds: [],
          alerts: [
            {
              id: "alert:c2:replay",
              timestamp: baseTime + 30_000,
              severity: "high",
              rule: "Malware C2 Callback",
              nodeId: "threat:c2-cobalt",
              description: "Suspicious outbound TLS beacon originating from powershell.exe to 194.26.29.112:8443",
              acked: false,
            },
          ],
        },
      ],
    },
    {
      chunkIndex: 3,
      startTime: baseTime + 45_000,
      endTime: baseTime + 60_000,
      deltas: [
        {
          t: baseTime + 45_000,
          addNodes: [
            {
              id: "threat:scanner",
              kind: "threat",
              label: "185.220.101.5 (Port Probe)",
              ip: "185.220.101.5",
              firstSeen: baseTime + 45_000,
              lastSeen: baseTime + 45_000,
              bytesIn: 8000,
              bytesOut: 95000,
              rateIn: 1200,
              rateOut: 18000,
              threat: {
                severity: "high",
                reasons: ["Aggressive SYN sweep across PC internal ports"],
              },
            },
          ],
          updateNodes: [
            {
              id: "threat:c2-cobalt",
              bytesOut: 520000,
              rateOut: 85000,
              lastSeen: baseTime + 45_000,
            },
          ],
          removeNodeIds: [],
          addLinks: [
            {
              id: "link:scanner->host",
              source: "threat:scanner",
              target: "host:local",
              proto: "tcp",
              port: 22,
              bytesIn: 8000,
              bytesOut: 95000,
              rate: 19200,
              packets: 840,
              firstSeen: baseTime + 45_000,
              lastSeen: baseTime + 45_000,
            },
          ],
          updateLinks: [
            {
              id: "link:powershell->c2",
              bytesOut: 520000,
              rate: 88000,
              packets: 1200,
            },
          ],
          removeLinkIds: [],
          alerts: [
            {
              id: "alert:scan:replay",
              timestamp: baseTime + 45_000,
              severity: "high",
              rule: "Port Scan & Exfiltration Spike",
              nodeId: "threat:scanner",
              description: "Simultaneous external port probe and data exfiltration spike detected on host",
              acked: false,
            },
          ],
        },
      ],
    },
  ];

  return { meta, chunks };
}

// Persistent Store with localStorage fallback and seeded incident trace
class MemorySessionStore {
  private sessions: Map<string, SessionMetadata> = new Map();
  private sessionChunks: Map<string, RecordedChunk[]> = new Map();
  private sessionNodes: Map<string, GraphNode[]> = new Map();
  private sessionLinks: Map<string, GraphLink[]> = new Map();
  private sessionAlerts: Map<string, Alert[]> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem("netscope_sessions_store_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sessions && parsed.chunks) {
          for (const s of parsed.sessions) {
            this.sessions.set(s.id, s);
          }
          for (const [id, chunks] of Object.entries(parsed.chunks)) {
            this.sessionChunks.set(id, chunks as RecordedChunk[]);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load sessions from localStorage:", e);
    }

    // If no sessions exist, seed default incident trace
    if (this.sessions.size === 0) {
      const seed = createSeedIncidentSession();
      this.sessions.set(seed.meta.id, seed.meta);
      this.sessionChunks.set(seed.meta.id, seed.chunks);
      this.saveToStorage();
    }
  }

  private saveToStorage() {
    try {
      const serialized = {
        sessions: Array.from(this.sessions.values()),
        chunks: Object.fromEntries(this.sessionChunks.entries()),
      };
      localStorage.setItem("netscope_sessions_store_v1", JSON.stringify(serialized));
    } catch (e) {
      console.warn("Failed to save sessions to localStorage:", e);
    }
  }

  public createSession(title: string, mode: string = "live"): string {
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
    this.saveToStorage();
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
    this.saveToStorage();
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
      meta.totalBytesIn = nodes.reduce((sum, n) => sum + (n.bytesIn || 0), 0);
      meta.totalBytesOut = nodes.reduce((sum, n) => sum + (n.bytesOut || 0), 0);
    }
    this.sessionNodes.set(sessionId, nodes);
    this.sessionLinks.set(sessionId, links);
    this.sessionAlerts.set(sessionId, alerts);
    this.saveToStorage();
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
    // If sessionId is "latest", resolve to most recent session
    let targetId = sessionId;
    if (targetId === "latest" || !this.sessions.has(targetId)) {
      const list = this.listSessions();
      targetId = list[0]?.id || "sess_incident_trace_01";
    }

    return {
      meta: this.sessions.get(targetId),
      chunks: this.sessionChunks.get(targetId) || [],
      nodes: this.sessionNodes.get(targetId) || [],
      links: this.sessionLinks.get(targetId) || [],
      alerts: this.sessionAlerts.get(targetId) || [],
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
