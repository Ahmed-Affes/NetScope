import React, { useEffect, useState } from "react";
import {
  ArrowDownCircle,
  CheckCircle2,
  ExternalLink,
  X,
  ArrowRight,
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
        setUpdateInfo(
          info || {
            version: CURRENT_VERSION,
            tagName: `v${CURRENT_VERSION}`,
            name: `NetScope v${CURRENT_VERSION}`,
            notes: "You are currently running the latest version of NetScope.",
            publishedAt: new Date().toISOString(),
            downloadUrl: "https://github.com/Ahmed-Affes/NetScope/releases",
            hasUpdate: false,
          }
        );
        setIsOpen(true);
      }
    } catch (e) {
      console.warn("Failed to check for updates", e);
    }
  };

  useEffect(() => {
    // Only open when explicitly triggered by the user (TitleBar version badge or CommandPalette)

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

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={handleDismiss} />

      {/* Professional Dialog Window */}
      <div
        className="relative w-full max-w-md bg-[#12141a] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden pointer-events-auto text-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 flex items-start justify-between gap-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300 shrink-0">
              {updateInfo.hasUpdate ? (
                <ArrowDownCircle className="w-5 h-5 text-blue-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-white">
                {updateInfo.hasUpdate ? "Software Update Available" : "NetScope Is Up to Date"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {updateInfo.hasUpdate
                  ? `Version ${updateInfo.version} is now available.`
                  : `Version ${CURRENT_VERSION} is the latest release.`}
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/[0.06] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version Details */}
        <div className="px-4 py-2.5 bg-black/20 border-b border-white/[0.04] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Current:</span>
            <span className="text-slate-300 font-medium">v{CURRENT_VERSION}</span>

            {updateInfo.hasUpdate && (
              <>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-400">Available:</span>
                <span className="text-blue-400 font-semibold">v{updateInfo.version}</span>
              </>
            )}
          </div>

          {updateInfo.publishedAt && (
            <span className="text-[11px] text-slate-500 font-sans">
              {formatDate(updateInfo.publishedAt)}
            </span>
          )}
        </div>

        {/* Release Notes */}
        <div className="p-4 text-xs">
          {updateInfo.hasUpdate ? (
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-2 font-mono">
                Release Notes
              </span>
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.05] text-slate-300 leading-relaxed font-sans max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-line">
                {updateInfo.notes}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-slate-400">
              <p className="text-xs">
                You are currently running NetScope v{CURRENT_VERSION}.
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Zero configuration required — live PC telemetry is active.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-black/20 border-t border-white/[0.06] flex items-center justify-between gap-2">
          <button
            onClick={() =>
              updateService.openDownload("https://github.com/Ahmed-Affes/NetScope/releases")
            }
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/[0.04]"
          >
            <span>GitHub Releases</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white text-xs font-medium transition-colors border border-white/[0.06]"
            >
              {updateInfo.hasUpdate ? "Later" : "Close"}
            </button>

            {updateInfo.hasUpdate && (
              <button
                onClick={handleDownload}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Download Update</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
