import { Alert, GraphLink, GraphNode } from "../types/graph";

import { useNetScopeStore } from "../store/useNetScopeStore";

export class ClientThreatEngine {
  private evaluatedAlerts: Set<string> = new Set();

  public analyzeTopology(nodes: GraphNode[], links: GraphLink[]) {
    const now = Date.now();
    const newAlerts: Alert[] = [];

    // Link analysis
    for (const link of links) {
      // 1. Data Exfiltration Spike (> 2 MB/s)
      if (link.rate > 2_000_000) {
        const alertId = `alert:exfil:${link.id}`;
        if (!this.evaluatedAlerts.has(alertId)) {
          this.evaluatedAlerts.add(alertId);
          newAlerts.push({
            id: alertId,
            timestamp: now,
            severity: "high",
            rule: "Data Exfiltration Anomaly",
            linkId: link.id,
            nodeId: link.target,
            description: `Exfiltration spike: ${(link.rate / 1_000_000).toFixed(2)} MB/s to ${link.target}`,
            acked: false,
          });
        }
      }

      // 2. Crypto Miner (Stratum Ports)
      if ([3333, 4444, 7777, 8888, 14433, 14444].includes(link.port)) {
        const alertId = `alert:miner:${link.id}`;
        if (!this.evaluatedAlerts.has(alertId)) {
          this.evaluatedAlerts.add(alertId);
          newAlerts.push({
            id: alertId,
            timestamp: now,
            severity: "med",
            rule: "Cryptomining Pool Connection",
            linkId: link.id,
            nodeId: link.target,
            description: `Active connection to Stratum mining port ${link.port}`,
            acked: false,
          });
        }
      }

      // 3. DNS Tunneling (Port 53 high throughput)
      if (link.port === 53 && link.rate > 60_000) {
        const alertId = `alert:dns-tunnel:${link.id}`;
        if (!this.evaluatedAlerts.has(alertId)) {
          this.evaluatedAlerts.add(alertId);
          newAlerts.push({
            id: alertId,
            timestamp: now,
            severity: "high",
            rule: "DNS Tunneling Detected",
            linkId: link.id,
            nodeId: link.target,
            description: `Anomalously high byte throughput on DNS port 53 (${(link.rate / 1024).toFixed(1)} KB/s)`,
            acked: false,
          });
        }
      }
    }

    // Node analysis
    for (const node of nodes) {
      if (node.kind === "threat") {
        const alertId = `alert:threat:${node.id}`;
        if (!this.evaluatedAlerts.has(alertId)) {
          this.evaluatedAlerts.add(alertId);
          newAlerts.push({
            id: alertId,
            timestamp: now,
            severity: "high",
            rule: "Malicious Endpoint / C2",
            nodeId: node.id,
            description: `Active link established to classified threat: ${node.label}`,
            acked: false,
          });
        }
      }
    }

    if (newAlerts.length > 0) {
      const currentStore = useNetScopeStore.getState();
      currentStore.applyDelta({
        t: now,
        addNodes: [],
        updateNodes: [],
        removeNodeIds: [],
        addLinks: [],
        updateLinks: [],
        removeLinkIds: [],
        alerts: newAlerts,
      });
    }
  }

  public clear() {
    this.evaluatedAlerts.clear();
  }
}

export const threatEngine = new ClientThreatEngine();
