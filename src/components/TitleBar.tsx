import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetScopeStore } from "../store/useNetScopeStore";
import {
  Activity,
  Gauge,
  Maximize2,
  Minus,
  Network,
  Search,
  X,
} from "lucide-react";
import { CURRENT_VERSION } from "../services/updater";

export const TitleBar: React.FC = () => {
  const {
    layoutMode,
    setLayoutMode,
    openCommandPalette,
    openSpeedTest,
    openPortInspector,
    searchQuery,
    setSearchQuery,
  } = useNetScopeStore();

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (err) {
      console.warn("Minimize not available:", err);
    }
  };

  const handleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (err) {
      console.warn("Maximize not available:", err);
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (err) {
      console.warn("Close not available:", err);
    }
  };

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleMaximize}
      className="h-10 w-full bg-[#0a0e17]/90 border-b border-white/[0.06] flex items-center justify-between px-3 select-none z-50 backdrop-blur-md relative"
    >
      {/* Left: Branding & Mode */}
      <div className="flex items-center gap-3" data-tauri-drag-region>
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-xs font-bold tracking-wider text-slate-200">
            NET<span className="text-cyan-400">SCOPE</span>
          </span>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>LIVE PC</span>
        </div>

        {/* Desktop Releases & Update Checker */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("netscope:check-update", { detail: { force: true } }))}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white transition-colors"
          title="Check for Software Updates"
        >
          <span className="font-mono text-slate-400">v{CURRENT_VERSION}</span>
        </button>
      </div>

      {/* Center: Live Search Bar, Port Inspector, Speed Test & Layout Switcher */}
      <div className="flex items-center gap-2.5" data-tauri-drag-region>
        {/* Click-to-Search Bar */}
        <div
          onClick={openCommandPalette}
          className="relative flex items-center cursor-pointer group"
          title="Click to search anything or press Ctrl+K"
        >
          <Search className="w-3.5 h-3.5 text-cyan-400/80 group-hover:text-cyan-300 absolute left-2.5 pointer-events-none transition-colors" />
          <input
            type="text"
            readOnly
            value={searchQuery}
            onClick={(e) => {
              e.stopPropagation();
              openCommandPalette();
            }}
            placeholder="Search apps, ports, protocols, IPs... (Click or Ctrl+K)"
            className="w-72 pl-8 pr-16 py-1 rounded-md bg-[#0e121a]/95 border border-white/[0.08] hover:border-cyan-500/50 group-hover:border-cyan-500/50 text-slate-200 placeholder-slate-500 text-[11px] font-mono cursor-pointer transition-all shadow-inner"
          />
          {searchQuery ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery("");
              }}
              className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
              title="Clear search filter"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openCommandPalette();
              }}
              className="absolute right-1.5 px-1.5 py-0.5 bg-white/[0.06] hover:bg-white/[0.1] text-[9px] rounded text-slate-400 font-mono transition-colors cursor-pointer"
              title="Open Command Palette (Ctrl+K)"
            >
              Ctrl+K
            </button>
          )}
        </div>

        {/* Active Ports Inspector Button */}
        <button
          onClick={() => openPortInspector()}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-[10px] font-medium transition-all shadow-sm cursor-pointer"
          title="Inspect active ports, listening servers, sockets & detailed process tree"
        >
          <Network className="w-3 h-3 text-cyan-400" />
          <span>Active Ports</span>
        </button>

        {/* Speed Test Button */}
        <button
          onClick={openSpeedTest}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 hover:text-sky-200 text-[10px] font-medium transition-all shadow-sm cursor-pointer"
          title="Run real-time Network Throughput & Latency Diagnostics"
        >
          <Gauge className="w-3 h-3 text-sky-400" />
          <span>Speed Test</span>
        </button>

        {/* Layout Modes */}
        <div className="flex items-center bg-[#0e121a] rounded p-0.5 border border-white/[0.06] text-[10px]">
          {(["force", "radial", "3d"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setLayoutMode(mode)}
              className={`px-2 py-0.5 rounded uppercase tracking-wider transition-colors ${
                layoutMode === mode
                  ? "bg-cyan-500/20 text-cyan-400 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-1.5">

        {/* Window controls */}
        <div className="flex items-center ml-2 border-l border-white/[0.08] pl-2">
          <button
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
            title="Maximize"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/30 text-slate-400 hover:text-red-400 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
