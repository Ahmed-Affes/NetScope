export type NodeKind =
  | 'host'
  | 'gateway'
  | 'lan'
  | 'docker'
  | 'internet'
  | 'tailscale'
  | 'monitor'
  | 'process'
  | 'threat';

export type Severity = 'low' | 'med' | 'high';

export interface ThreatInfo {
  severity: Severity;
  reasons: string[];
}

export interface GraphNode {
  id: string; // e.g. "host:local", "proc:chrome:1234", "ip:142.250.1.1"
  kind: NodeKind;
  label: string;
  pid?: number;
  exePath?: string;
  ip?: string;
  hostname?: string;
  country?: string;
  asn?: string;
  org?: string;
  firstSeen: number;
  lastSeen: number;
  bytesIn: number;
  bytesOut: number;
  rateIn: number; // Bytes/sec
  rateOut: number; // Bytes/sec
  threat?: ThreatInfo;
  // Canvas simulation coordinates (attached by engine/worker)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  proto: 'tcp' | 'udp' | 'icmp' | 'other' | string;
  port: number; // service or remote port
  service?: string; // ssh, http, https, dns, etc.
  bytesIn: number;
  bytesOut: number;
  rate: number; // throughput in B/s
  packets: number;
  state?: string; // ESTABLISHED, etc.
  firstSeen: number;
  lastSeen: number;
}

export interface Alert {
  id: string;
  timestamp: number;
  severity: Severity;
  rule: string;
  nodeId?: string;
  linkId?: string;
  description: string;
  acked: boolean;
}

export interface NodeUpdate {
  id: string;
  bytesIn?: number;
  bytesOut?: number;
  rateIn?: number;
  rateOut?: number;
  lastSeen?: number;
  threat?: ThreatInfo;
}

export interface LinkUpdate {
  id: string;
  bytesIn?: number;
  bytesOut?: number;
  rate?: number;
  packets?: number;
  state?: string;
  lastSeen?: number;
}

export interface GraphDelta {
  t: number;
  addNodes: GraphNode[];
  updateNodes: NodeUpdate[];
  removeNodeIds: string[];
  addLinks: GraphLink[];
  updateLinks: LinkUpdate[];
  removeLinkIds: string[];
  alerts?: Alert[];
  nodePositions?: Record<string, { x: number; y: number }>;
}

export interface SystemMetrics {
  cpuUsage: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  ramUsagePercent: number;
  gpuUsage?: number | null;
  gpuTemp?: number | null;
  diskFreeBytes: number;
  diskTotalBytes: number;
  diskUsagePercent: number;
  dockerContainers: number;
}

export interface TrafficSource {
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): Promise<{ nodes: GraphNode[]; links: GraphLink[] }>;
  onDelta(cb: (d: GraphDelta) => void): () => void;
  mode: 'live';
}
