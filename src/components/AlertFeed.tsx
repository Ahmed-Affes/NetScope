import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Check,
  Crosshair,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { Alert } from "../types/graph";

export const AlertFeed: React.FC = () => {
  const { alerts, nodes, selectNode, selectLink, setActiveFilter, setSearchQuery } =
    useNetScopeStore();
  const [muted, setMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set());

  const activeAlerts = alerts.filter((a) => !a.acked && !ackedIds.has(a.id));

  if (activeAlerts.length === 0) return null;

  const handleAcknowledge = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAckedIds((prev) => new Set(prev).add(id));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allIds = new Set(ackedIds);
    activeAlerts.forEach((a) => allIds.add(a.id));
    setAckedIds(allIds);
  };

  const handleFocus = (alert: Alert) => {
    // 1. Clear any active filter/search so the alerted node is guaranteed visible
    setActiveFilter(null);
    setSearchQuery("");

    // 2. Direct node selection if alert.nodeId exists in current nodes
    if (alert.nodeId && nodes[alert.nodeId]) {
      selectNode(alert.nodeId);
      if (alert.linkId) selectLink(alert.linkId);
      return;
    }

    // 3. Extract port, PID, or process name from alert
    const portMatch =
      alert.description.match(/port\s+(\d+)/i) ||
      alert.rule.match(/port\s+(\d+)/i);
    const portNum = portMatch ? parseInt(portMatch[1], 10) : undefined;

    const pidMatch = alert.description.match(/PID\s+(\d+)/i);
    const pidNum = pidMatch ? parseInt(pidMatch[1], 10) : undefined;

    const procMatch = alert.description.match(/Process\s+'([^']+)'/i);
    const procName = procMatch ? procMatch[1] : undefined;

    // 4. Locate matching node on canvas: first port node, then parent process node
    const allNodes = Object.values(nodes);
    const matchedPortNode = portNum
      ? allNodes.find(
          (n) =>
            n.id.includes(`:${portNum}`) ||
            (n.kind === "port" && n.label.includes(String(portNum)))
        )
      : null;

    const matchedProcNode =
      (pidNum ? allNodes.find((n) => n.pid === pidNum) : null) ||
      (procName
        ? allNodes.find(
            (n) =>
              n.label.toLowerCase() === procName.toLowerCase() ||
              (n.exePath && n.exePath.toLowerCase().endsWith(procName.toLowerCase()))
          )
        : null);

    if (matchedPortNode) {
      selectNode(matchedPortNode.id);
    } else if (matchedProcNode) {
      selectNode(matchedProcNode.id);
    } else if (alert.nodeId) {
      selectNode(alert.nodeId);
    }

    if (alert.linkId) selectLink(alert.linkId);
  };

  return (
    <div className="w-84 flex flex-col gap-2 pointer-events-auto transition-all duration-300 shrink-0">
      {/* Alert Header / Controls */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e121a]/95 border border-rose-500/40 rounded-lg backdrop-blur-md shadow-[0_0_20px_rgba(244,63,94,0.2)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span className="text-xs font-bold text-rose-400 tracking-wider">
            SECURITY ALERTS ({activeAlerts.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClearAll}
            className="p-1 rounded text-slate-400 hover:text-rose-300 transition-colors"
            title="Dismiss All Alerts"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
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
        <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
          {activeAlerts.map((alert) => {
            const isHigh = alert.severity === "high";
            const borderCol = isHigh
              ? "border-rose-500/40 hover:border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
              : "border-amber-500/40 hover:border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.15)]";

            return (
              <div
                key={alert.id}
                onClick={() => handleFocus(alert)}
                className={`group p-2.5 bg-[#0b0f17]/95 border ${borderCol} rounded-lg backdrop-blur-md cursor-pointer transition-all duration-150 relative overflow-hidden`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    {isHigh ? (
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider truncate ${
                          isHigh ? "text-rose-400" : "text-amber-400"
                        }`}
                      >
                        {alert.rule}
                      </span>
                      <button
                        onClick={(e) => handleAcknowledge(alert.id, e)}
                        className="text-slate-500 hover:text-emerald-400 transition-colors p-0.5"
                        title="Acknowledge alert"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>

                    {(() => {
                      const hasRec = alert.description.includes("Recommendation:");
                      const hasWhy = alert.description.includes("Why it matters:");

                      if (hasRec) {
                        const parts = alert.description.split("Recommendation:");
                        const main = parts[0].trim();
                        const rec = parts[1].trim();
                        return (
                          <div className="mt-1 space-y-1">
                            <p className="text-[11px] text-slate-200 font-sans leading-relaxed">
                              {main}
                            </p>
                            <div className="text-[10px] text-amber-300 font-sans bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1 leading-snug">
                              <span className="font-semibold text-amber-200">What to do:</span> {rec}
                            </div>
                          </div>
                        );
                      }

                      if (hasWhy) {
                        const parts = alert.description.split("Why it matters:");
                        const main = parts[0].trim();
                        const why = parts[1].trim();
                        return (
                          <div className="mt-1 space-y-1">
                            <p className="text-[11px] text-slate-200 font-sans leading-relaxed">
                              {main}
                            </p>
                            <p className="text-[10px] text-slate-400 font-sans leading-snug">
                              <span className="font-semibold text-slate-300">Why:</span> {why}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <p className="text-[11px] text-slate-300 font-sans mt-0.5 leading-relaxed">
                          {alert.description}
                        </p>
                      );
                    })()}

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/[0.04] text-[9px] font-mono text-slate-500">
                      <span className="flex items-center gap-1 text-cyan-400/90 group-hover:text-cyan-300">
                        <Crosshair className="w-2.5 h-2.5" />
                        <span>Click to inspect & focus</span>
                      </span>
                      <span>
                        {new Date(alert.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
