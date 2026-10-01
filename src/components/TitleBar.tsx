import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetScopeStore } from "../store/useNetScopeStore";
import {
  Activity,
  Maximize2,
  Minus,
  Search,
  X,
} from "lucide-react";
import { CURRENT_VERSION } from "../services/updater";

export const TitleBar: React.FC = () => {
  const {
    layoutMode,
    setLayoutMode,
    openCommandPalette,
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
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-cyan-500 to-fuchsia-500 flex items-center justify-center p-[1px] shadow-[0_0_10px_rgba(34,211,238,0.4)]">
            <div className="w-full h-full bg-[#07090d] rounded-[5px] flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            </div>
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

      {/* Center: Search & Layout Switcher */}
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <button
          onClick={openCommandPalette}
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#0e121a]/80 border border-white/[0.06] text-slate-400 hover:text-slate-200 text-[11px] transition-colors"
        >
          <Search className="w-3 h-3 text-cyan-400/80" />
          <span>Search endpoints, processes...</span>
          <kbd className="px-1 py-0.2 bg-white/[0.06] text-[9px] rounded text-slate-400">
            Ctrl+K
          </kbd>
        </button>

        {/* Layout Modes */}
        <div className="flex items-center bg-[#0e121a] rounded p-0.5 border border-white/[0.06] text-[10px]">
          {(["force", "radial", "geo", "3d"] as const).map((mode) => (
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
