import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { recorder } from "../services/recorder";
import {
  Activity,
  Maximize2,
  Minus,
  Search,
  ShieldAlert,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";

export const TitleBar: React.FC = () => {
  const {
    trafficMode,
    setTrafficMode,
    isRecording,
    setRecording,
    recordingSeconds,
    isSimPanelOpen,
    toggleSimPanel,
    layoutMode,
    setLayoutMode,
    openCommandPalette,
  } = useNetScopeStore();

  const handleToggleRecord = async () => {
    if (isRecording) {
      await recorder.stopRecording();
      setRecording(false);
    } else {
      await recorder.startRecording();
      setRecording(true);
    }
  };


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

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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

        {/* Mode Selector Badges */}
        <div className="flex items-center bg-[#0e121a] rounded-md p-0.5 border border-white/[0.07] text-[10px]">
          <button
            onClick={() => setTrafficMode("live")}
            className={`px-2.5 py-0.5 rounded transition-colors flex items-center gap-1.5 ${
              trafficMode === "live"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold shadow-[0_0_8px_rgba(52,211,153,0.3)] border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${trafficMode === "live" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            <span>LIVE (PC)</span>
          </button>
          <button
            onClick={() => setTrafficMode("replay")}
            className={`px-2 py-0.5 rounded transition-colors ${
              trafficMode === "replay"
                ? "bg-purple-500/20 text-purple-300 font-semibold shadow-[0_0_8px_rgba(168,85,247,0.3)] border border-purple-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            REPLAY
          </button>
          <button
            onClick={() => setTrafficMode("simulator")}
            className={`px-2 py-0.5 rounded transition-colors ${
              trafficMode === "simulator"
                ? "bg-cyan-500/20 text-cyan-300 font-semibold shadow-[0_0_8px_rgba(34,211,238,0.3)] border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            SIM
          </button>
        </div>

        {/* Recording Toggle */}
        <button
          onClick={handleToggleRecord}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border transition-all ${
            isRecording
              ? "bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
              : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-slate-200"
          }`}
          title={isRecording ? "Stop Recording Session" : "Record Live PC Traffic"}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isRecording ? "bg-red-500 animate-rec-dot" : "bg-slate-500"
            }`}
          />
          <span>{isRecording ? `REC ${formatTime(recordingSeconds)}` : "REC"}</span>
        </button>

        {/* Remote Viewer Button */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("netscope:open-remote-viewer"))}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-all"
          title="Stream Live Topology to Phone / Tablet (Supabase Realtime)"
        >
          <Smartphone className="w-3 h-3 text-cyan-400" />
          <span>REMOTE</span>
        </button>

        {/* Desktop Releases & Interactive Update Checker */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("netscope:check-update", { detail: { force: true } }))}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 hover:border-cyan-400 transition-all shadow-[0_0_8px_rgba(34,211,238,0.2)]"
          title="Check for NetScope Desktop Updates or Preview Update Modal"
        >
          <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span className="font-semibold">v0.2.1</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping ml-0.5" />
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

      {/* Right: ATK-SIM & Window Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleSimPanel}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs border transition-colors ${
            isSimPanelOpen
              ? "bg-red-500/20 border-red-500/40 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
              : "bg-[#0e121a] border-white/[0.08] text-slate-300 hover:text-white"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          <span className="font-semibold text-[11px]">ATK-SIM</span>
        </button>

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
