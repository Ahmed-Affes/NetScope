import React, { useState, useEffect } from "react";
import { AlertTriangle, ShieldAlert, Trash2, X } from "lucide-react";
import { commands } from "../bindings";
import { isCriticalProcess, getCriticalProcessReason } from "../utils/processSafety";

interface KillProcessModalProps {
  isOpen: boolean;
  target: {
    pid: number;
    name: string;
    ports?: number[];
    exePath?: string;
  } | null;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export const KillProcessModal: React.FC<KillProcessModalProps> = ({
  isOpen,
  target,
  onClose,
  onSuccess,
}) => {
  const [isKilling, setIsKilling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsKilling(false);
    setErrorMsg(null);
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const isCritical = isCriticalProcess(target.pid, target.name);

  const handleTerminate = async () => {
    if (isCritical) {
      setErrorMsg(getCriticalProcessReason(target.pid, target.name));
      return;
    }
    setIsKilling(true);
    setErrorMsg(null);

    try {
      const res = await commands.killProcess(target.pid);
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : "Failed to terminate process";
      setErrorMsg(msg);
    } finally {
      setIsKilling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md cyber-panel shadow-[0_0_60px_rgba(0,0,0,0.95)] border border-slate-700/80 rounded-xl overflow-hidden bg-[#0a0e17] text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isCritical
              ? "bg-rose-950/40 border-rose-500/30 text-rose-200"
              : "bg-[#0f1420] border-white/[0.08] text-slate-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isCritical ? (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            ) : (
              <Trash2 className="w-4 h-4 text-cyan-400 shrink-0" />
            )}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {isCritical ? "Critical Process Safeguard" : "End Process Confirmation"}
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">PID {target.pid}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Target App Info Box */}
          <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-[10px]">PROCESS / APP:</span>
              <span className="text-slate-100 font-bold">{target.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-[10px]">PROCESS ID (PID):</span>
              <span className="text-amber-300 font-bold">{target.pid}</span>
            </div>
            {target.ports && target.ports.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[10px]">BOUND PORTS:</span>
                <span className="text-cyan-300">
                  {target.ports.map((p) => `:${p}`).join(", ")}
                </span>
              </div>
            )}
          </div>

          {/* Warning Message */}
          {isCritical ? (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-2 text-rose-200">
              <div className="flex items-center gap-2 font-bold text-[11px] text-rose-400 uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>CRITICAL SYSTEM PROCESS (PROTECTED)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-200/90 font-sans">
                <strong>{target.name}</strong> (PID {target.pid}) is a core Windows system process.
                Terminating it is strictly prohibited to prevent system instability, memory corruption, or operating system crashes (BSOD).
              </p>
            </div>
          ) : (
            <div className="text-slate-300 text-xs leading-relaxed font-sans">
              Are you sure you want to stop <strong>{target.name}</strong>? This will terminate the process and disconnect any sockets or network connections it currently holds.
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-mono">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-white/[0.08] bg-[#0c1017]">
          <button
            onClick={onClose}
            disabled={isKilling}
            className="px-4 py-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-xs font-medium transition-colors"
          >
            {isCritical ? "Close" : "Cancel"}
          </button>

          {!isCritical && (
            <button
              onClick={handleTerminate}
              disabled={isKilling}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isKilling ? "Terminating..." : "End Process"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
