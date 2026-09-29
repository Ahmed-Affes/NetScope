import {
  GraphDelta,
  GraphLink,
  GraphNode,
  TrafficSource,
} from "../types/graph";

export class SimulatorSource implements TrafficSource {
  public mode: "simulator" = "simulator";
  private intervalId: number | null = null;
  private listeners: Set<(d: GraphDelta) => void> = new Set();
  private nodesMap: Map<string, GraphNode> = new Map();
  private linksMap: Map<string, GraphLink> = new Map();

  constructor() {
    this.seedInitialTopology();
  }

  private seedInitialTopology() {
    const now = Date.now();

    // 1. Center Host Node
    const host: GraphNode = {
      id: "host:dark-spark",
      kind: "host",
      label: "Dark Spark",
      ip: "127.0.0.1",
      hostname: "dark-spark.local",
      firstSeen: now - 3600000,
      lastSeen: now,
      bytesIn: 45_200_000,
      bytesOut: 98_400_000,
      rateIn: 120_000,
      rateOut: 340_000,
    };
    this.nodesMap.set(host.id, host);

    // 2. Hub / Process / Container Nodes
    const hubs = [
      { id: "proc:embedding", label: "embedding-server-share...", kind: "docker", port: 8000 },
      { id: "proc:watchdog", label: "watchdog-server", kind: "docker", port: 8080 },
      { id: "proc:librarian", label: "librarian-server [8000]", kind: "docker", port: 8000 },
      { id: "proc:ollama", label: "ollama-kx [11434, 11...]", kind: "process", port: 11434 },
      { id: "proc:kruel", label: "kruel-server [6510, 8...]", kind: "docker", port: 6510 },
      { id: "proc:tailscale", label: "Tailscale (1 IPs)", kind: "tailscale", port: 41641 },
      { id: "proc:internet", label: "Internet (5 IPs)", kind: "internet", port: 443 },
      { id: "proc:homeassistant", label: "homeassistant", kind: "lan", port: 8123 },
    ];

    for (const h of hubs) {
      const node: GraphNode = {
        id: h.id,
        kind: h.kind as any,
        label: h.label,
        firstSeen: now - 1800000,
        lastSeen: now,
        bytesIn: Math.floor(Math.random() * 5_000_000),
        bytesOut: Math.floor(Math.random() * 12_000_000),
        rateIn: Math.floor(Math.random() * 45_000),
        rateOut: Math.floor(Math.random() * 95_000),
      };
      this.nodesMap.set(node.id, node);

      // Link hub to host
      const linkId = `link:${host.id}->${node.id}`;
      this.linksMap.set(linkId, {
        id: linkId,
        source: host.id,
        target: node.id,
        proto: "tcp",
        port: h.port,
        bytesIn: node.bytesIn,
        bytesOut: node.bytesOut,
        rate: node.rateIn + node.rateOut,
        packets: Math.floor((node.bytesIn + node.bytesOut) / 800),
        firstSeen: now - 1800000,
        lastSeen: now,
      });
    }

    // 3. Remote Endpoints (from user screenshot)
    const endpoints = [
      { id: "ip:192.168.50.197", label: "192.168.50.197%enP7s7", kind: "lan", parent: "proc:homeassistant", port: 80 },
      { id: "ip:192.168.50.122", label: "192.168.50.122", kind: "lan", parent: "proc:homeassistant", port: 80 },
      { id: "ip:192.168.50.95", label: "192.168.50.95", kind: "lan", parent: "proc:homeassistant", port: 443 },
      { id: "ip:192.168.50.51", label: "192.168.50.51", kind: "lan", parent: "proc:homeassistant", port: 443 },
      { id: "ip:192.168.50.100", label: "192.168.50.100", kind: "lan", parent: "proc:homeassistant", port: 80 },
      { id: "ip:192.168.50.64", label: "192.168.50.64", kind: "lan", parent: "proc:homeassistant", port: 80 },
      { id: "ip:gateway", label: "GT-AXT1000-18A0", kind: "gateway", parent: "proc:watchdog", port: 53 },
      { id: "ip:loopback1", label: "127.0.0.54", kind: "gateway", parent: "proc:watchdog", port: 53 },
      { id: "ip:loopback2", label: "127.0.0.53%lo", kind: "gateway", parent: "proc:watchdog", port: 53 },
      { id: "threat:infected", label: "infected-workstation", kind: "threat", parent: "proc:librarian", port: 22 },
      { id: "threat:c2", label: "c2-darkcomet.evil", kind: "threat", parent: "proc:librarian", port: 22 },
      { id: "ip:ec2-44", label: "ec2-44-239-154-206.us-...", kind: "internet", parent: "proc:internet", port: 443 },
      { id: "ip:ec2-18", label: "ec2-18-233-216-198.com...", kind: "internet", parent: "proc:internet", port: 443 },
      { id: "ip:ec2-34a", label: "ec2-34-210-64-215.us-w...", kind: "internet", parent: "proc:internet", port: 443 },
      { id: "ip:ec2-13", label: "ec2-13-57-83-45.us-wes...", kind: "internet", parent: "proc:internet", port: 443 },
      { id: "ip:ec2-34b", label: "ec2-34-232-215-237.com...", kind: "internet", parent: "proc:internet", port: 443 },
      { id: "ip:ec2-35", label: "ec2-35-160-188-67.comp...", kind: "internet", parent: "proc:internet", port: 443 },
      { id: "ip:google1", label: "93.243.107.34.bc.googl...", kind: "internet", parent: "proc:internet", port: 443 },
      { id: "ip:google2", label: "137.66.149.34.bc.googl...", kind: "internet", parent: "proc:internet", port: 443 },
      { id: "ip:fastly", label: "151.101.125.91", kind: "internet", parent: "proc:internet", port: 80 },
      { id: "ip:cloudflare", label: "160.79.104.10", kind: "internet", parent: "proc:internet", port: 443 },
      { id: "ip:sonos", label: "SonosZP", kind: "lan", parent: "proc:homeassistant", port: 1400 },
      { id: "ip:bcube", label: "Bcube", kind: "lan", parent: "proc:homeassistant", port: 80 },
      { id: "ip:ub01", label: "UB01", kind: "lan", parent: "proc:homeassistant", port: 80 },
      { id: "ip:esp1", label: "ESP_70EDED", kind: "lan", parent: "proc:homeassistant", port: 80 },
      { id: "ip:esp2", label: "ESP_2A18E7", kind: "lan", parent: "proc:homeassistant", port: 80 },
      { id: "ip:ring", label: "RingFloodlight", kind: "lan", parent: "proc:homeassistant", port: 443 },
      { id: "ip:mrecon", label: "SNet-MRECON", kind: "monitor", parent: "proc:tailscale", port: 53 },
      { id: "ip:desktop", label: "DESKTOP-PK11TU", kind: "lan", parent: "proc:tailscale", port: 443 },
    ];

    for (const ep of endpoints) {
      const isThreat = ep.kind === "threat";
      const node: GraphNode = {
        id: ep.id,
        kind: ep.kind as any,
        label: ep.label,
        ip: ep.id.startsWith("ip:") ? ep.id.slice(3) : undefined,
        firstSeen: now - 900000,
        lastSeen: now,
        bytesIn: Math.floor(Math.random() * 2_000_000),
        bytesOut: Math.floor(Math.random() * 8_000_000),
        rateIn: Math.floor(Math.random() * 15_000),
        rateOut: Math.floor(Math.random() * 65_000),
        threat: isThreat
          ? {
              severity: "high",
              reasons: [
                "Connection to known threat C2 server",
                "High beaconing frequency detected on port 22",
              ],
            }
          : undefined,
      };
      this.nodesMap.set(node.id, node);

      // Link endpoint to parent hub
      const linkId = `link:${ep.parent}->${ep.id}`;
      this.linksMap.set(linkId, {
        id: linkId,
        source: ep.parent,
        target: ep.id,
        proto: "tcp",
        port: ep.port,
        bytesIn: node.bytesIn,
        bytesOut: node.bytesOut,
        rate: node.rateIn + node.rateOut,
        packets: Math.floor((node.bytesIn + node.bytesOut) / 600),
        firstSeen: now - 900000,
        lastSeen: now,
      });
    }
  }

  public async start(): Promise<void> {
    if (this.intervalId !== null) return;

    // Emit 10 Hz deltas
    this.intervalId = window.setInterval(() => {
      this.emitTick();
    }, 100);
  }

  public async stop(): Promise<void> {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
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

  private emitTick() {
    const now = Date.now();
    const updateLinks: any[] = [];
    const updateNodes: any[] = [];

    // Randomly fluctuate throughput on links
    for (const link of this.linksMap.values()) {
      if (Math.random() < 0.2) {
        const deltaBytes = Math.floor(Math.random() * 80_000);
        link.bytesIn += deltaBytes;
        link.rate = deltaBytes * 10;
        link.lastSeen = now;

        updateLinks.push({
          id: link.id,
          bytesIn: link.bytesIn,
          rate: link.rate,
          lastSeen: now,
        });

        // Update target node
        const targetNode = this.nodesMap.get(link.target);
        if (targetNode) {
          targetNode.bytesIn += deltaBytes;
          targetNode.rateIn = deltaBytes * 10;
          targetNode.lastSeen = now;

          updateNodes.push({
            id: targetNode.id,
            bytesIn: targetNode.bytesIn,
            rateIn: targetNode.rateIn,
            lastSeen: now,
          });
        }
      }
    }

    if (updateLinks.length > 0 || updateNodes.length > 0) {
      const delta: GraphDelta = {
        t: now,
        addNodes: [],
        updateNodes,
        removeNodeIds: [],
        addLinks: [],
        updateLinks,
        removeLinkIds: [],
      };

      for (const cb of this.listeners) {
        cb(delta);
      }
    }
  }
}
