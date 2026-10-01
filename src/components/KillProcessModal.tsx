import React, { useState, useEffect } from "react";
import { AlertTriangle, ShieldAlert, Trash2, X } from "lucide-react";
import { commands } from "../bindings";

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

const CRITICAL_PROCESS_NAMES = new Set([
  "system",
  "svchost.exe",
  "csrss.exe",
  "smss.exe",
  "wininit.exe",
  "winlogon.exe",
  "lsass.exe",
  "services.exe",
  "spoolsv.exe",
  "explorer.exe",
  "dwm.exe",
  "fontdrvhost.exe",
  "sihost.exe",
  "taskhostw.exe",
]);

const CRITICAL_PORTS = new Set([135, 137, 138, 139, 445, 53, 67, 68, 88, 389]);

export const KillProcessModal: React.FC<KillProcessModalProps> = ({
  isOpen,
  target,
  onClose,
  onSuccess,
}) => {
  const [confirmInput, setConfirmInput] = useState("");
  const [isKilling, setIsKilling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setConfirmInput("");
    setIsKilling(false);
    setErrorMsg(null);
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const isCritical =
    target.pid <= 4 ||
    CRITICAL_PROCESS_NAMES.has(target.name.toLowerCase()) ||
    (target.ports && target.ports.some((p) => CRITICAL_PORTS.has(p)));

  const isConfirmed = isCritical
    ? confirmInput.trim().toLowerCase() === "i am sure"
    : true;

  const handleTerminate = async () => {
    if (!isConfirmed) return;
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
                <span>POTENTIALLY DANGEROUS TERMINATION</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-200/90 font-sans">
                <strong>{target.name}</strong> is an essential Windows component or core system service.
                Killing it may crash Windows, cause a Blue Screen (BSOD), or disconnect network adapters.
              </p>
              <div className="pt-2 border-t border-rose-500/20 space-y-1.5">
                <label className="block text-[10px] uppercase font-bold text-rose-300 tracking-wider">
                  Type <span className="text-white underline font-mono">I am sure</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type 'I am sure' to unlock..."
                  className="w-full px-3 py-1.5 rounded bg-black/60 border border-rose-500/40 text-rose-100 placeholder-rose-400/40 font-mono text-xs focus:outline-none focus:border-rose-400 transition-colors"
                  autoFocus
                />
              </div>
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
            Cancel
          </button>

          <button
            onClick={handleTerminate}
            disabled={isKilling || (isCritical && !isConfirmed)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
              isCritical
                ? isConfirmed
                  ? "bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-950/50"
                  : "bg-rose-950/40 text-rose-400/40 border border-rose-500/20 cursor-not-allowed"
                : "bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isKilling ? "Terminating..." : isCritical ? "Force Kill Task" : "End Process"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
