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
    try {
      await commands.triggerSimulation(s.id);
    } catch {
      // Handled
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
