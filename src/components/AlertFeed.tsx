import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Check,
  Crosshair,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { Alert } from "../types/graph";

export const AlertFeed: React.FC = () => {
  const { alerts, selectNode, selectLink } = useNetScopeStore();
  const [muted, setMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set());

  const activeAlerts = alerts.filter((a) => !a.acked && !ackedIds.has(a.id));

  if (activeAlerts.length === 0) return null;

  const handleAcknowledge = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAckedIds((prev) => new Set(prev).add(id));
  };

  const handleFocus = (alert: Alert) => {
    if (alert.nodeId) selectNode(alert.nodeId);
    if (alert.linkId) selectLink(alert.linkId);
  };

  return (
    <div className="absolute top-14 right-6 z-40 w-80 flex flex-col gap-2 pointer-events-auto">
      {/* Alert Header / Audio Control */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e121a]/95 border border-rose-500/40 rounded-lg backdrop-blur-md shadow-[0_0_20px_rgba(244,63,94,0.2)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span className="text-xs font-bold text-rose-400 tracking-wider">
            SECURITY ALERTS ({activeAlerts.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMuted(!muted)}
            className="p-1 rounded text-slate-400 hover:text-slate-200"
            title={muted ? "Unmute Alerts" : "Mute Alerts"}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-200"
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Alert Cards */}
      {isExpanded && (
        <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
          {activeAlerts.slice(0, 5).map((alert) => {
            const isHigh = alert.severity === "high";
            const isMed = alert.severity === "med";

            return (
              <div
                key={alert.id}
                onClick={() => handleFocus(alert)}
                className={`p-3 rounded-lg border backdrop-blur-md transition-all cursor-pointer shadow-lg animate-in slide-in-from-right-4 duration-300 ${
                  isHigh
                    ? "bg-rose-950/80 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:border-rose-400"
                    : isMed
                    ? "bg-amber-950/80 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:border-amber-400"
                    : "bg-cyan-950/80 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:border-cyan-400"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isHigh ? (
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : isMed ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        isHigh
                          ? "text-rose-300"
                          : isMed
                          ? "text-amber-300"
                          : "text-cyan-300"
                      }`}
                    >
                      {alert.rule}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleAcknowledge(alert.id, e)}
                      className="p-1 rounded bg-black/40 hover:bg-black/60 text-slate-400 hover:text-emerald-400 transition-colors"
                      title="Acknowledge & Dismiss"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-sans">
                  {alert.description}
                </p>

                <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-cyan-400" />
                    <span>Click to inspect & focus</span>
                  </div>
                  <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
