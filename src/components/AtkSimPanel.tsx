import React, { useState } from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { commands } from "../bindings";
import {
  Bot,
  Database,
  Key,
  Radar,
  Radio,
  Skull,
  Target,
  Trash2,
  X,
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  desc: string;
  badge: "CRITICAL" | "WARNING";
  icon: React.ReactNode;
}

export const AtkSimPanel: React.FC = () => {
  const { isSimPanelOpen, toggleSimPanel, cleanSimulations } = useNetScopeStore();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  if (!isSimPanelOpen) return null;

  const scenarios: Scenario[] = [
    {
      id: "ssh-brute",
      name: "SSH Brute Force",
      desc: "Rapid SSH login attempts from compromised host",
      badge: "CRITICAL",
      icon: <Key className="w-4 h-4 text-amber-400" />,
    },
    {
      id: "exfil",
      name: "Data Exfiltration",
      desc: "Unusual large data transfer to external host",
      badge: "WARNING",
      icon: <Database className="w-4 h-4 text-cyan-400" />,
    },
    {
      id: "ddos",
      name: "DDoS Flood",
      desc: "Connection flood overwhelming the network interface",
      badge: "CRITICAL",
      icon: <Radio className="w-4 h-4 text-sky-400" />,
    },
    {
      id: "assault",
      name: "Full Assault",
      desc: "Combined multi-vector attack: scan + brute force + flood",
      badge: "CRITICAL",
      icon: <Target className="w-4 h-4 text-rose-500" />,
    },
    {
      id: "c2",
      name: "Malware C2 Callback",
      desc: "Suspicious outbound connection to known C2 server",
      badge: "CRITICAL",
      icon: <Skull className="w-4 h-4 text-red-400" />,
    },
    {
      id: "port-scan",
      name: "Port Scan",
      desc: "Aggressive port scan from external IP probing 50+ ports",
      badge: "WARNING",
      icon: <Radar className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: "rogue-device",
      name: "Rogue Device",
      desc: "Unknown device appeared on the network performing recon",
      badge: "WARNING",
      icon: <Bot className="w-4 h-4 text-purple-400" />,
    },
  ];

  const handleRunScenario = async (s: Scenario) => {
    setActiveScenario(s.id);
    const now = Date.now();

    try {
      await commands.triggerSimulation(s.id);
    } catch {
      // Handled
    }

    const store = useNetScopeStore.getState();
    const hostNodeId = Object.keys(store.nodes)[0] || "host:dark-spark";

    if (s.id === "ssh-brute") {
      store.applyDelta({
        t: now,
        addNodes: [
          {
            id: "threat:ssh-brute",
            kind: "threat",
            label: "185.220.101.5 (Brute Force)",
            ip: "185.220.101.5",
            country: "NL",
            firstSeen: now,
            lastSeen: now,
            bytesIn: 450_000,
            bytesOut: 12_000,
            rateIn: 45_000,
            rateOut: 2_000,
            threat: {
              severity: "high",
              reasons: ["SSH dictionary brute-force attack (50 req/sec)"],
            },
          },
        ],
        updateNodes: [],
        removeNodeIds: [],
        addLinks: [
          {
            id: `link:threat:ssh-brute->${hostNodeId}`,
            source: "threat:ssh-brute",
            target: hostNodeId,
            proto: "tcp",
            port: 22,
            service: "ssh",
            bytesIn: 450_000,
            bytesOut: 12_000,
            rate: 47_000,
            packets: 2800,
            state: "SYN_SENT",
            firstSeen: now,
            lastSeen: now,
          },
        ],
        updateLinks: [],
        removeLinkIds: [],
        alerts: [
          {
            id: `alert:ssh:${now}`,
            timestamp: now,
            severity: "high",
            rule: "SSH Brute Force",
            nodeId: "threat:ssh-brute",
            description: "50 SSH login failures per second originating from 185.220.101.5",
            acked: false,
          },
        ],
      });
    } else if (s.id === "exfil") {
      store.applyDelta({
        t: now,
        addNodes: [
          {
            id: "threat:s3-exfil",
            kind: "threat",
            label: "s3-shadow-backup.aws",
            ip: "54.231.1.200",
            country: "US",
            firstSeen: now,
            lastSeen: now,
            bytesIn: 24_000,
            bytesOut: 45_000_000,
            rateIn: 5_000,
            rateOut: 8_500_000,
            threat: {
              severity: "high",
              reasons: ["Massive outbound data exfiltration spike"],
            },
          },
        ],
        updateNodes: [],
        removeNodeIds: [],
        addLinks: [
          {
            id: `link:${hostNodeId}->threat:s3-exfil`,
            source: hostNodeId,
            target: "threat:s3-exfil",
            proto: "tcp",
            port: 443,
            service: "https",
            bytesIn: 24_000,
            bytesOut: 45_000_000,
            rate: 8_505_000,
            packets: 32_000,
            state: "ESTABLISHED",
            firstSeen: now,
            lastSeen: now,
          },
        ],
        updateLinks: [],
        removeLinkIds: [],
        alerts: [
          {
            id: `alert:exfil:${now}`,
            timestamp: now,
            severity: "high",
            rule: "Data Exfiltration Spike",
            nodeId: "threat:s3-exfil",
            description: "8.5 MB/s continuous outbound data exfiltration to s3-shadow-backup.aws",
            acked: false,
          },
        ],
      });
    } else if (s.id === "c2") {
      store.applyDelta({
        t: now,
        addNodes: [
          {
            id: "threat:c2-cobalt",
            kind: "threat",
            label: "c2-darkcomet-beacon.evil",
            ip: "194.26.29.112",
            country: "RU",
            firstSeen: now,
            lastSeen: now,
            bytesIn: 28_000,
            bytesOut: 34_000,
            rateIn: 1_200,
            rateOut: 1_400,
            threat: {
              severity: "high",
              reasons: [
                "Cobalt Strike Malleable C2 Beacon",
                "Periodic jittered heartbeat on port 8443",
              ],
            },
          },
        ],
        updateNodes: [],
        removeNodeIds: [],
        addLinks: [
          {
            id: `link:${hostNodeId}->threat:c2-cobalt`,
            source: hostNodeId,
            target: "threat:c2-cobalt",
            proto: "tcp",
            port: 8443,
            service: "custom-ssl",
            bytesIn: 28_000,
            bytesOut: 34_000,
            rate: 2_600,
            packets: 450,
            state: "ESTABLISHED",
            firstSeen: now,
            lastSeen: now,
          },
        ],
        updateLinks: [],
        removeLinkIds: [],
        alerts: [
          {
            id: `alert:c2:${now}`,
            timestamp: now,
            severity: "high",
            rule: "Malware C2 Callback",
            nodeId: "threat:c2-cobalt",
            description: "Periodic beaconing detected to known C2 server c2-darkcomet-beacon.evil",
            acked: false,
          },
        ],
      });
    } else if (s.id === "port-scan") {
      store.applyDelta({
        t: now,
        addNodes: [
          {
            id: "threat:scanner",
            kind: "threat",
            label: "192.168.50.88 (Nmap Probe)",
            ip: "192.168.50.88",
            firstSeen: now,
            lastSeen: now,
            bytesIn: 8_000,
            bytesOut: 120_000,
            rateIn: 1_000,
            rateOut: 24_000,
            threat: {
              severity: "med",
              reasons: ["Nmap SYN stealth sweep across 24 local ports"],
            },
          },
        ],
        updateNodes: [],
        removeNodeIds: [],
        addLinks: [
          {
            id: `link:threat:scanner->${hostNodeId}`,
            source: "threat:scanner",
            target: hostNodeId,
            proto: "tcp",
            port: 80,
            service: "http",
            bytesIn: 8_000,
            bytesOut: 120_000,
            rate: 25_000,
            packets: 5200,
            state: "SYN_RECV",
            firstSeen: now,
            lastSeen: now,
          },
        ],
        updateLinks: [],
        removeLinkIds: [],
        alerts: [
          {
            id: `alert:scan:${now}`,
            timestamp: now,
            severity: "med",
            rule: "Port Scan Sweep",
            nodeId: "threat:scanner",
            description: "Port probe sweep detected against 24 internal ports from 192.168.50.88",
            acked: false,
          },
        ],
      });
    } else {
      // General threat scenario (ddos, assault, rogue-device)
      store.applyDelta({
        t: now,
        addNodes: [
          {
            id: `threat:${s.id}`,
            kind: "threat",
            label: `${s.name} Node`,
            ip: "198.51.100.42",
            firstSeen: now,
            lastSeen: now,
            bytesIn: 120_000,
            bytesOut: 850_000,
            rateIn: 14_000,
            rateOut: 120_000,
            threat: {
              severity: s.badge === "CRITICAL" ? "high" : "med",
              reasons: [s.desc],
            },
          },
        ],
        updateNodes: [],
        removeNodeIds: [],
        addLinks: [
          {
            id: `link:threat:${s.id}->${hostNodeId}`,
            source: `threat:${s.id}`,
            target: hostNodeId,
            proto: "tcp",
            port: 443,
            bytesIn: 120_000,
            bytesOut: 850_000,
            rate: 134_000,
            packets: 1800,
            firstSeen: now,
            lastSeen: now,
          },
        ],
        updateLinks: [],
        removeLinkIds: [],
        alerts: [
          {
            id: `alert:${s.id}:${now}`,
            timestamp: now,
            severity: s.badge === "CRITICAL" ? "high" : "med",
            rule: s.name,
            nodeId: `threat:${s.id}`,
            description: s.desc,
            acked: false,
          },
        ],
      });
    }
  };

  const handleClean = async () => {
    setActiveScenario(null);
    cleanSimulations();
    try {
      await commands.cleanSimulations();
    } catch {
      // Handled
    }
  };


  return (
    <div className="absolute top-72 left-4 z-40 w-72 cyber-panel transition-all duration-200 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wider text-red-400 text-xs">
            ATK-SIM
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-500/20 text-red-300 border border-red-500/30">
            SIMULATED
          </span>
        </div>
        <button
          onClick={toggleSimPanel}
          className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded hover:bg-white/[0.06]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scenarios List */}
      <div className="p-2 space-y-1.5 max-h-[380px] overflow-y-auto">
        {scenarios.map((s) => {
          const isActive = activeScenario === s.id;
          return (
            <div
              key={s.id}
              onClick={() => handleRunScenario(s)}
              className={`p-2 rounded-lg cursor-pointer transition-all border ${
                isActive
                  ? "bg-red-500/15 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                  : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.08]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-[#07090d]/80 border border-white/[0.05]">
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-200">
                      {s.name}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider ${
                    s.badge === "CRITICAL"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {s.badge}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 pl-7 leading-tight">
                {s.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Clean Up Button */}
      <div className="p-2.5 pt-1.5 border-t border-white/[0.06]">
        <button
          onClick={handleClean}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/[0.1] text-slate-200 text-xs font-semibold transition-all hover:shadow-[0_0_12px_rgba(255,255,255,0.1)] active:scale-[0.98]"
        >
          <Trash2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Clean Up Simulations</span>
        </button>
      </div>
    </div>
  );
};
