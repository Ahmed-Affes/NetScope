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
      label: "PC: Workstation",
      ip: "192.168.1.50",
      hostname: "dark-spark.local",
      firstSeen: now - 3600000,
      lastSeen: now,
      bytesIn: 45_200_000,
      bytesOut: 98_400_000,
      rateIn: 120_000,
      rateOut: 340_000,
    };
    this.nodesMap.set(host.id, host);

    // 2. Default Gateway Node
    const gateway: GraphNode = {
      id: "ip:gateway",
      kind: "gateway",
      label: "GT-AXT1000 Gateway (192.168.1.1)",
      ip: "192.168.1.1",
      hostname: "router.asus.local",
      firstSeen: now - 7200000,
      lastSeen: now,
      bytesIn: 14_500_000,
      bytesOut: 32_800_000,
      rateIn: 24_000,
      rateOut: 65_000,
    };
    this.nodesMap.set(gateway.id, gateway);

    // Link Host -> Gateway (DNS/DHCP)
    const hostGwLink: GraphLink = {
      id: `link:${host.id}->${gateway.id}`,
      source: host.id,
      target: gateway.id,
      proto: "udp",
      port: 53,
      service: "dns",
      bytesIn: 14_500_000,
      bytesOut: 32_800_000,
      rate: 89_000,
      packets: 45_000,
      state: "CONNECTED",
      firstSeen: now - 7200000,
      lastSeen: now,
    };
    this.linksMap.set(hostGwLink.id, hostGwLink);

    // 3. Hub / Local Process Nodes on Host
    const hubs = [
      { id: "proc:sshd", label: "sshd.exe [Port 22]", kind: "process", port: 22, service: "ssh" },
      { id: "proc:chrome", label: "chrome.exe [HTTPS]", kind: "process", port: 443, service: "https" },
      { id: "proc:ollama", label: "ollama-kx [11434]", kind: "process", port: 11434, service: "ollama" },
      { id: "proc:docker", label: "docker-microservices", kind: "docker", port: 8000, service: "http" },
      { id: "proc:tailscale", label: "tailscale-mesh-vpn", kind: "tailscale", port: 41641, service: "tailscale" },
    ];

    for (const h of hubs) {
      const node: GraphNode = {
        id: h.id,
        kind: h.kind as any,
        label: h.label,
        firstSeen: now - 1800000,
        lastSeen: now,
        bytesIn: Math.floor(Math.random() * 5_000_000) + 500_000,
        bytesOut: Math.floor(Math.random() * 12_000_000) + 1_000_000,
        rateIn: Math.floor(Math.random() * 45_000) + 5_000,
        rateOut: Math.floor(Math.random() * 95_000) + 10_000,
      };
      this.nodesMap.set(node.id, node);

      const linkId = `link:${host.id}->${node.id}`;
      this.linksMap.set(linkId, {
        id: linkId,
        source: host.id,
        target: node.id,
        proto: "tcp",
        port: h.port,
        service: h.service,
        bytesIn: node.bytesIn,
        bytesOut: node.bytesOut,
        rate: node.rateIn + node.rateOut,
        packets: Math.floor((node.bytesIn + node.bytesOut) / 800),
        firstSeen: now - 1800000,
        lastSeen: now,
      });
    }

    // 4. LAN Subnet Devices (Attached to Gateway Router)
    const lanDevices = [
      { id: "lan:nas", label: "Synology-NAS (192.168.1.150)", ip: "192.168.1.150", port: 5000, service: "http" },
      { id: "lan:tv", label: "LG-OLED-TV (192.168.1.182)", ip: "192.168.1.182", port: 80, service: "http" },
      { id: "lan:homeassistant", label: "HomeAssistant-Hub (192.168.1.200)", ip: "192.168.1.200", port: 8123, service: "http" },
      { id: "lan:sonos", label: "Sonos-LivingRoom (192.168.1.115)", ip: "192.168.1.115", port: 1400, service: "upnp" },
      { id: "lan:camera", label: "Ring-Floodlight (192.168.1.104)", ip: "192.168.1.104", port: 443, service: "https" },
      { id: "lan:thermostat", label: "Smart-Thermostat (192.168.1.140)", ip: "192.168.1.140", port: 80, service: "http" },
    ];

    for (const d of lanDevices) {
      const node: GraphNode = {
        id: d.id,
        kind: "lan",
        label: d.label,
        ip: d.ip,
        firstSeen: now - 3600000,
        lastSeen: now,
        bytesIn: Math.floor(Math.random() * 3_000_000) + 200_000,
        bytesOut: Math.floor(Math.random() * 4_000_000) + 400_000,
        rateIn: Math.floor(Math.random() * 12_000) + 1_000,
        rateOut: Math.floor(Math.random() * 24_000) + 2_000,
      };
      this.nodesMap.set(node.id, node);

      const linkId = `link:${gateway.id}->${d.id}`;
      this.linksMap.set(linkId, {
        id: linkId,
        source: gateway.id,
        target: d.id,
        proto: "tcp",
        port: d.port,
        service: d.service,
        bytesIn: node.bytesIn,
        bytesOut: node.bytesOut,
        rate: node.rateIn + node.rateOut,
        packets: Math.floor((node.bytesIn + node.bytesOut) / 600),
        firstSeen: now - 3600000,
        lastSeen: now,
      });
    }

    // 5. Network Monitors & Infrastructure
    const monitors = [
      { id: "mon:mrecon", label: "SNet-MRECON Watchdog (192.168.1.5)", ip: "192.168.1.5", port: 9090 },
      { id: "mon:prometheus", label: "Prometheus Exporter (Port 9100)", ip: "127.0.0.1", port: 9100 },
    ];

    for (const m of monitors) {
      const node: GraphNode = {
        id: m.id,
        kind: "monitor",
        label: m.label,
        ip: m.ip,
        firstSeen: now - 1800000,
        lastSeen: now,
        bytesIn: 850_000,
        bytesOut: 1_200_000,
        rateIn: 8_500,
        rateOut: 14_000,
      };
      this.nodesMap.set(node.id, node);

      const linkId = `link:${host.id}->${m.id}`;
      this.linksMap.set(linkId, {
        id: linkId,
        source: host.id,
        target: m.id,
        proto: "tcp",
        port: m.port,
        service: "monitor",
        bytesIn: node.bytesIn,
        bytesOut: node.bytesOut,
        rate: node.rateIn + node.rateOut,
        packets: 1400,
        firstSeen: now - 1800000,
        lastSeen: now,
      });
    }

    // 6. Real Threat Nodes (SSH Brute Force, C2 DarkComet, Rogue Scanner)
    const threats = [
      {
        id: "threat:ssh-brute",
        label: "185.220.101.5 (SSH Brute Force)",
        ip: "185.220.101.5",
        target: "proc:sshd",
        port: 22,
        service: "ssh",
        reasons: ["Active dictionary attack probing SSH port 22", "60 failed root logins/sec"],
      },
      {
        id: "threat:c2",
        label: "c2-darkcomet.evil [C2 Beacon]",
        ip: "194.26.29.112",
        target: "proc:docker",
        port: 8443,
        service: "custom-ssl",
        reasons: ["Encrypted periodic beaconing to known Russian C2 host", "Heartbeat jitter detected"],
      },
      {
        id: "threat:scanner",
        label: "192.168.1.88 (Rogue Subnet Probe)",
        ip: "192.168.1.88",
        target: "host:dark-spark",
        port: 80,
        service: "http",
        reasons: ["Aggressive SYN scan probing 60+ internal ports", "Unknown MAC manufacturer"],
      },
    ];

    for (const t of threats) {
      const node: GraphNode = {
        id: t.id,
        kind: "threat",
        label: t.label,
        ip: t.ip,
        firstSeen: now - 300000,
        lastSeen: now,
        bytesIn: 240_000,
        bytesOut: 1_850_000,
        rateIn: 32_000,
        rateOut: 145_000,
        threat: {
          severity: "high",
          reasons: t.reasons,
        },
      };
      this.nodesMap.set(node.id, node);

      const linkId = `link:${t.id}->${t.target}`;
      this.linksMap.set(linkId, {
        id: linkId,
        source: t.id,
        target: t.target,
        proto: "tcp",
        port: t.port,
        service: t.service,
        bytesIn: node.bytesIn,
        bytesOut: node.bytesOut,
        rate: node.rateIn + node.rateOut,
        packets: 3200,
        state: "SYN_RECV",
        firstSeen: now - 300000,
        lastSeen: now,
      });
    }

    // 7. Internet Cloud Endpoints
    const internetNodes = [
      { id: "ip:github", label: "140.82.121.5 (GitHub HTTPS)", ip: "140.82.121.5", port: 443, parent: "proc:chrome" },
      { id: "ip:google-dns", label: "8.8.8.8 (Google DNS)", ip: "8.8.8.8", port: 53, parent: "proc:chrome" },
      { id: "ip:cloudflare", label: "1.1.1.1 (Cloudflare Anycast)", ip: "1.1.1.1", port: 443, parent: "proc:chrome" },
      { id: "ip:aws-ec2", label: "ec2-54-231-1-200.us-east.aws", ip: "54.231.1.200", port: 443, parent: "proc:docker" },
    ];

    for (const ep of internetNodes) {
      const node: GraphNode = {
        id: ep.id,
        kind: "internet",
        label: ep.label,
        ip: ep.ip,
        firstSeen: now - 1800000,
        lastSeen: now,
        bytesIn: 3_200_000,
        bytesOut: 6_800_000,
        rateIn: 28_000,
        rateOut: 62_000,
      };
      this.nodesMap.set(node.id, node);

      const linkId = `link:${ep.parent}->${ep.id}`;
      this.linksMap.set(linkId, {
        id: linkId,
        source: ep.parent,
        target: ep.id,
        proto: "tcp",
        port: ep.port,
        service: ep.port === 53 ? "dns" : "https",
        bytesIn: node.bytesIn,
        bytesOut: node.bytesOut,
        rate: node.rateIn + node.rateOut,
        packets: 5400,
        firstSeen: now - 1800000,
        lastSeen: now,
      });
    }
  }

  public async start(): Promise<void> {
    if (this.intervalId !== null) return;

    let tickCount = 0;
    // Emit 10 Hz deltas
    this.intervalId = window.setInterval(() => {
      tickCount++;
      this.emitTick(tickCount);
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

  private emitTick(tickCount: number = 0) {
    const now = Date.now();
    const updateLinks: any[] = [];
    const updateNodes: any[] = [];
    const alerts: any[] = [];

    // Randomly fluctuate throughput on links
    for (const link of this.linksMap.values()) {
      if (Math.random() < 0.25) {
        const isThreat = link.id.includes("threat");
        const deltaBytes = Math.floor(Math.random() * (isThreat ? 150_000 : 80_000));
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

    // Every 50 ticks (5 seconds), pulse SSH brute force threat traffic
    if (tickCount > 0 && tickCount % 50 === 0) {
      const sshLink = this.linksMap.get("link:threat:ssh-brute->proc:sshd");
      if (sshLink) {
        sshLink.rate = 145_000;
        sshLink.bytesIn += 250_000;
        updateLinks.push({
          id: sshLink.id,
          bytesIn: sshLink.bytesIn,
          rate: sshLink.rate,
          lastSeen: now,
        });
        alerts.push({
          id: `sim:alert:ssh:${now}`,
          timestamp: now,
          severity: "high",
          rule: "SSH Brute Force",
          nodeId: "threat:ssh-brute",
          description: "45 failed root authentications/sec probing SSH daemon on port 22",
          acked: false,
        });
      }
    }

    // Every 90 ticks (9 seconds), pulse C2 DarkComet Beacon traffic
    if (tickCount > 0 && tickCount % 90 === 0) {
      const c2Link = this.linksMap.get("link:threat:c2->proc:docker");
      if (c2Link) {
        c2Link.rate = 98_000;
        c2Link.bytesOut += 120_000;
        updateLinks.push({
          id: c2Link.id,
          bytesOut: c2Link.bytesOut,
          rate: c2Link.rate,
          lastSeen: now,
        });
        alerts.push({
          id: `sim:alert:c2:${now}`,
          timestamp: now,
          severity: "high",
          rule: "Malware C2 Callback",
          nodeId: "threat:c2",
          description: "Encrypted C2 heartbeat jitter detected to 194.26.29.112:8443",
          acked: false,
        });
      }
    }

    if (updateLinks.length > 0 || updateNodes.length > 0 || alerts.length > 0) {
      const delta: GraphDelta = {
        t: now,
        addNodes: [],
        updateNodes,
        removeNodeIds: [],
        addLinks: [],
        updateLinks,
        removeLinkIds: [],
        alerts: alerts.length > 0 ? alerts : undefined,
      };

      for (const cb of this.listeners) {
        cb(delta);
      }
    }
  }
}
