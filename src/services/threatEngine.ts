import { GraphLink, GraphNode } from "../types/graph";

/**
 * Display-only reference for threat rules.
 * All live security rules and anomaly detection are executed by the authoritative
 * Rust ThreatEngine in src-tauri/src/threats/mod.rs and pushed via socket deltas.
 */
export class ClientThreatEngine {
  public clearAlerts() {}
  public analyzeTopology(_nodes: GraphNode[], _links: GraphLink[]) {}
}

export const threatEngine = new ClientThreatEngine();
