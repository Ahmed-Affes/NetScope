import React, { useEffect, useState } from "react";
import { DownloadCloud, Sparkles, X, ExternalLink } from "lucide-react";
import { updateService, UpdateInfo } from "../services/updater";

export const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const info = await updateService.checkForUpdates();
      if (!mounted) return;
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
        if (!updateService.isDismissed(info.version)) {
          setIsOpen(true);
        }
      }
    };

    // Check on startup
    check();

    // Check every 15 minutes
    const interval = setInterval(check, 15 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!isOpen || !updateInfo || !updateInfo.hasUpdate) return null;

  const handleDownload = () => {
    updateService.openDownload(updateInfo.downloadUrl);
  };

  const handleDismiss = () => {
    updateService.dismissUpdate(updateInfo.version);
    setIsOpen(false);
  };

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-[520px] max-w-[92vw] pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="relative p-3.5 bg-[#0b101c]/95 border border-cyan-500/50 rounded-xl backdrop-blur-xl shadow-[0_8px_40px_rgba(6,182,212,0.3)] text-slate-200 font-mono">
        {/* Glowing top line */}
        <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.8)]" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <DownloadCloud className="w-5 h-5 animate-bounce" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-300 tracking-wider uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  NetScope Update Available
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  v{updateInfo.version}
                </span>
              </div>

              <div className="text-[11px] text-slate-300 font-sans mt-1 leading-snug line-clamp-2">
                {updateInfo.name || "A new desktop build is ready with live PC improvements and bug fixes."}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-[0.98]"
                >
                  <DownloadCloud className="w-3.5 h-3.5" />
                  <span>Download .exe Update</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                </button>

                <button
                  onClick={handleDismiss}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 text-xs transition-colors border border-white/[0.06]"
                >
                  Remind Me Later
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
