import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNetScopeStore } from "../store/useNetScopeStore";
import {
  Activity,
  Gauge,
  Globe,
  Layers,
  Network,
  Router,
  Search,
  Server,
  Shield,
  Wifi,
} from "lucide-react";

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    openSpeedTest,
    openPortInspector,
    setActiveFilter,
    setLayoutMode,
    nodes,
    selectNode,
    searchQuery,
    setSearchQuery,
  } = useNetScopeStore();

  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setInputVal(searchQuery || "");
    }
  }, [isCommandPaletteOpen, searchQuery]);

  const setOpen = (val: boolean) => {
    if (val) openCommandPalette();
    else {
      closeCommandPalette();
      setInputVal("");
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement))
      ) {
        e.preventDefault();
        if (isCommandPaletteOpen) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
      } else if (e.key === "Escape" && isCommandPaletteOpen) {
        closeCommandPalette();
      }
    };

    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [isCommandPaletteOpen, openCommandPalette, closeCommandPalette]);

  if (!isCommandPaletteOpen) return null;

  const activeProcesses = Object.values(nodes).filter((n) => n.kind === "process");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onClick={closeCommandPalette}
    >
      <div
        className="w-full max-w-lg overflow-hidden cyber-panel shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-cyan-500/30"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="w-full text-slate-200">
          <div className="flex items-center px-3 border-b border-white/[0.08] bg-[#07090d]/60">
            <Search className="w-4 h-4 text-cyan-400 mr-2 shrink-0" />
            <Command.Input
              value={inputVal}
              onValueChange={setInputVal}
              placeholder="Search any app, port, protocol, or command..."
              className="w-full py-3 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
              autoFocus
            />
            <kbd className="px-1.5 py-0.5 text-[9px] bg-white/[0.06] rounded text-slate-400">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 text-xs space-y-1 custom-scrollbar">
            <Command.Empty className="py-6 text-center text-xs text-slate-500">
              No matching actions or processes found.
            </Command.Empty>

            {/* Direct Search query action */}
            {inputVal.trim() && (
              <Command.Group heading="Direct Filter" className="text-[10px] text-cyan-400 uppercase tracking-wider px-2 py-1 font-bold">
                <Command.Item
                  onSelect={() => {
                    setSearchQuery(inputVal.trim());
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold"
                >
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Search topology for "{inputVal.trim()}"</span>
                </Command.Item>
              </Command.Group>
            )}

            {/* Active Running Apps & Processes */}
            {activeProcesses.length > 0 && (
              <Command.Group heading="Active Applications & Processes" className="text-[10px] text-sky-400 uppercase tracking-wider px-2 py-1 font-bold">
                {activeProcesses.slice(0, 15).map((proc) => (
                  <Command.Item
                    key={proc.id}
                    value={`${proc.label} ${proc.exePath ?? ""} ${proc.pid ?? ""}`}
                    onSelect={() => {
                      selectNode(proc.id);
                      setSearchQuery(proc.label);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{proc.label}</span>
                    </div>
                    {proc.pid && (
                      <span className="text-[10px] text-slate-500 shrink-0">PID {proc.pid}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Tools & Diagnostics */}
            <Command.Group heading="Tools & Diagnostics" className="text-[10px] text-cyan-400 uppercase tracking-wider px-2 py-1 font-bold">
              <Command.Item
                onSelect={() => {
                  openPortInspector("table");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 font-semibold"
              >
                <Network className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open Active Ports & Sockets Inspector</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  openPortInspector("tree");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 font-semibold"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Explore Detailed Process & Port Tree</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  openSpeedTest();
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-sky-500/20 hover:text-sky-300 text-slate-300 font-semibold"
              >
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                <span>Run Network Throughput & Latency Diagnostics</span>
              </Command.Item>
            </Command.Group>

            {/* Traffic & Port Filters */}
            <Command.Group heading="Traffic & Port Filters" className="text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1 font-bold">
              <Command.Item
                onSelect={() => {
                  setActiveFilter("port:443");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>HTTPS Web Traffic (Port 443)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setActiveFilter("port:53");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>DNS Query Traffic (Port 53)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setActiveFilter("port:80");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>HTTP Web Traffic (Port 80)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setActiveFilter("port:22");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-red-400" />
                <span>SSH Connections (Port 22)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setActiveFilter("proto:udp");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-slate-400" />
                <span>UDP Datagrams (Voice, DNS, WebRTC)</span>
              </Command.Item>
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
                  setActiveFilter("gateway");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Router className="w-3.5 h-3.5 text-orange-400" />
                <span>Gateway Router Infrastructure</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setActiveFilter("lan");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Local LAN Devices on Wi-Fi</span>
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
                  setLayoutMode("3d");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>3D Isometric Layered Mode</span>
              </Command.Item>
            </Command.Group>

            {/* Actions */}
            <Command.Group heading="Controls" className="text-[10px] text-slate-400 uppercase tracking-wider px-2 py-1 font-bold">
              <Command.Item
                onSelect={() => {
                  window.dispatchEvent(new CustomEvent("netscope:check-update", { detail: { force: true } }));
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Check for NetScope Updates</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
