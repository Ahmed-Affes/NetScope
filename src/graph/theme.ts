import { NodeKind } from "../types/graph";

export const NODE_COLORS: Record<NodeKind, number> = {
  host: 0x22d3ee,      // Cyan #22d3ee
  gateway: 0xfb923c,   // Orange #fb923c
  lan: 0x34d399,       // Emerald #34d399
  docker: 0xa78bfa,    // Purple #a78bfa
  internet: 0x60a5fa,  // Blue #60a5fa
  tailscale: 0x2dd4bf, // Teal #2dd4bf
  monitor: 0xfacc15,   // Yellow #facc15
  threat: 0xef4444,    // Red #ef4444
  process: 0xe879f9,   // Pink #e879f9
  port: 0xfbbf24,      // Amber #fbbf24 (Active Local Ports)
};

export const PORT_COLORS: Record<number, number> = {
  22: 0xf87171,    // SSH (red/salmon)
  80: 0x4ade80,    // HTTP (green)
  443: 0x38bdf8,   // HTTPS (sky blue)
  7474: 0xc084fc,  // Neo4j (purple)
  11434: 0x818cf8, // Ollama (indigo)
  8000: 0xfb923c,  // kruel (orange)
  53: 0xfbbf24,    // DNS (amber)
};

export const DEFAULT_TCP_COLOR = 0x64748b; // Slate
export const DEFAULT_UDP_COLOR = 0x94a3b8; // Grey

export function getLinkColor(port: number, proto: string): number {
  if (PORT_COLORS[port]) return PORT_COLORS[port];
  if (proto.toLowerCase() === "udp") return DEFAULT_UDP_COLOR;
  return DEFAULT_TCP_COLOR;
}

export function getNodeRadius(kind: NodeKind, connectionCount: number): number {
  if (kind === "host") return 22;
  if (kind === "port") return Math.min(6 + connectionCount * 0.8, 14);
  const base = kind === "process" || kind === "threat" ? 11 : 7;
  return Math.min(base + connectionCount * 1.4, 24);
}
