import React, { useEffect, useState } from "react";
import {
  DownloadCloud,
  Sparkles,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { updateService, UpdateInfo, CURRENT_VERSION } from "../services/updater";

export const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const check = async (force: boolean = false, showFeedback: boolean = false) => {
    try {
      const info = await updateService.checkForUpdates(force);
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
        if (force || !updateService.isDismissed(info.version)) {
          setIsOpen(true);
        }
      } else if (showFeedback) {
        // When user explicitly clicks check and there is no newer release on GitHub yet:
        // Offer them the choice or display status
        setUpdateInfo(info || {
          version: CURRENT_VERSION,
          tagName: `v${CURRENT_VERSION}`,
          name: `NetScope v${CURRENT_VERSION}`,
          notes: "You are currently running the latest desktop version.",
          publishedAt: new Date().toISOString(),
          downloadUrl: "https://github.com/Ahmed-Affes/NetScope/releases",
          hasUpdate: false,
        });
        setIsOpen(true);
      }
    } catch (e) {
      console.warn("Failed to check for updates", e);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check automatically on startup
    check(false, false);

    // Check every 3 minutes
    const interval = setInterval(() => {
      if (mounted) check(false, false);
    }, 3 * 60 * 1000);

    // Event listener for manual update triggers from TitleBar or CommandPalette
    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<{ force?: boolean; mock?: boolean }>;
      if (customEvent.detail?.mock) {
        const mock = updateService.getMockUpdate();
        setUpdateInfo(mock);
        setIsOpen(true);
      } else {
        check(true, true);
      }
    };

    window.addEventListener("netscope:check-update", handleTrigger);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("netscope:check-update", handleTrigger);
    };
  }, []);

  if (!isOpen || !updateInfo) return null;

  const handleDownload = () => {
    updateService.openDownload(updateInfo.downloadUrl);
  };

  const handleDismiss = () => {
    if (updateInfo.hasUpdate) {
      updateService.dismissUpdate(updateInfo.version);
    }
    setIsOpen(false);
  };

  const handleSimulate = () => {
    const mock = updateService.getMockUpdate();
    setUpdateInfo(mock);
    setIsOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={handleDismiss} />

      {/* Cyber Modal Window */}
      <div
        className="relative w-full max-w-lg bg-[#0a0f1d] border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.35)] overflow-hidden pointer-events-auto font-mono text-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Holographic Glowing Header Top Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]" />

        {/* Modal Header */}
        <div className="p-5 pb-3 flex items-start justify-between gap-4 border-b border-white/[0.08]">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-400 shrink-0 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              {updateInfo.hasUpdate ? (
                <DownloadCloud className="w-6 h-6 animate-bounce text-cyan-400" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {updateInfo.hasUpdate ? "System Update Detected" : "NetScope Is Up To Date"}
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                {updateInfo.name}
              </h2>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.08] transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Version Differential Badge Banner */}
        <div className="px-5 py-3 bg-[#0d1426] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Current:</span>
            <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-slate-300 font-semibold">
              v{CURRENT_VERSION}
            </span>

            {updateInfo.hasUpdate && (
              <>
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-cyan-300 font-bold">New:</span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                  v{updateInfo.version}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Zap className="w-3 h-3 text-fuchsia-400" />
            <span>Windows Desktop x64</span>
          </div>
        </div>

        {/* Release Notes / Highlights */}
        <div className="p-5 max-h-60 overflow-y-auto custom-scrollbar text-xs text-slate-300 space-y-2.5 font-sans leading-relaxed">
          {updateInfo.hasUpdate ? (
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Release Highlights & Stability Notes</span>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] text-slate-300 text-xs whitespace-pre-line font-mono">
                {updateInfo.notes}
              </div>
            </div>
          ) : (
            <div className="py-2 text-center text-slate-400 font-mono">
              <p>You are currently running NetScope v{CURRENT_VERSION}.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                All live PC telemetry, ARP devices, and threat simulations are active.
              </p>
              <button
                onClick={handleSimulate}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/60 text-xs transition-colors"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Preview Update Modal with Demo v0.3.0</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-[#070b14] border-t border-white/[0.08] flex items-center justify-between gap-3">
          <button
            onClick={handleDismiss}
            className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors border border-white/[0.06]"
          >
            {updateInfo.hasUpdate ? "Remind Me Later" : "Close"}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => updateService.openDownload("https://github.com/Ahmed-Affes/NetScope/releases")}
              className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold transition-colors border border-white/[0.08] flex items-center gap-1.5"
            >
              <span>GitHub Releases</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>

            {updateInfo.hasUpdate && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black text-xs font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 active:scale-[0.98]"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>DOWNLOAD & UPDATE (.EXE)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
