import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { commands } from "../bindings";
import {
  Activity,
  Layers,
  Radio,
  Search,
  Shield,
  Smartphone,
  Trash2,
} from "lucide-react";

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const {
    setActiveFilter,
    setLayoutMode,
    toggleRecording,
    cleanSimulations,
  } = useNetScopeStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !(e.target instanceof HTMLInputElement))) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden cyber-panel shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-cyan-500/30"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="w-full text-slate-200">
          <div className="flex items-center px-3 border-b border-white/[0.08] bg-[#07090d]/60">
            <Search className="w-4 h-4 text-cyan-400 mr-2 shrink-0" />
            <Command.Input
              placeholder="Type a command or filter (e.g. 'threat', 'port 22', 'radial')..."
              className="w-full py-3 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
              autoFocus
            />
            <kbd className="px-1.5 py-0.5 text-[9px] bg-white/[0.06] rounded text-slate-400">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-2 text-xs space-y-1">
            <Command.Empty className="py-6 text-center text-xs text-slate-500">
              No matching actions found.
            </Command.Empty>

            {/* Quick Filters */}
            <Command.Group heading="Filters" className="text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1 font-bold">
              <Command.Item
                onSelect={() => {
                  setActiveFilter("threat");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Shield className="w-3.5 h-3.5 text-red-400" />
                <span>Focus Threats & Anomalies Only</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setActiveFilter("port:22");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>Isolate SSH Connections (Port 22)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setActiveFilter("docker");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Filter Docker Containers</span>
              </Command.Item>
            </Command.Group>

            {/* Layouts */}
            <Command.Group heading="Layout Modes" className="text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1 font-bold">
              <Command.Item
                onSelect={() => {
                  setLayoutMode("force");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Force-Directed Graph (Default)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setLayoutMode("radial");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Radial Orbit Mode (Host Centre)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setLayoutMode("geo");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                <span>Geographic Regional Layout</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setLayoutMode("3d");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>3D Isometric Layered Mode</span>
              </Command.Item>
            </Command.Group>

            {/* Attack Simulations */}
            <Command.Group heading="Simulations" className="text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1 font-bold">
              <Command.Item
                onSelect={async () => {
                  await commands.triggerSimulation("ssh-brute");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-red-500/20 hover:text-red-300 text-slate-300"
              >
                <Radio className="w-3.5 h-3.5 text-red-400" />
                <span>Run Scenario: SSH Brute Force</span>
              </Command.Item>
              <Command.Item
                onSelect={async () => {
                  await commands.triggerSimulation("ddos");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-red-500/20 hover:text-red-300 text-slate-300"
              >
                <Radio className="w-3.5 h-3.5 text-red-400" />
                <span>Run Scenario: DDoS Flood</span>
              </Command.Item>
              <Command.Item
                onSelect={async () => {
                  cleanSimulations();
                  await commands.cleanSimulations();
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-slate-700/50 text-slate-300"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Clean Up All Simulations</span>
              </Command.Item>
            </Command.Group>

            {/* Actions */}
            <Command.Group heading="Controls" className="text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1 font-bold">
              <Command.Item
                onSelect={() => {
                  toggleRecording();
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Radio className="w-3.5 h-3.5 text-red-400" />
                <span>Toggle Session Recording</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  window.dispatchEvent(new CustomEvent("netscope:show-onboarding"));
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Show Onboarding Briefing</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  window.dispatchEvent(new CustomEvent("netscope:open-remote-viewer"));
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Stream to Phone (Remote HUD Viewer)</span>
              </Command.Item>
            </Command.Group>


          </Command.List>
        </Command>
      </div>
    </div>
  );
};
