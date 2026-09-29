import React, { useState } from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { Activity, Ban, Shield, ShieldCheck, X } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { commands } from "../bindings";

export const InspectorPanel: React.FC = () => {
  const {
    selectedNodeId,
    selectedLinkId,
    nodes,
    links,
    selectNode,
    selectLink,
  } = useNetScopeStore();

  const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null;
  const selectedLink = selectedLinkId ? links[selectedLinkId] : null;

  if (!selectedNode && !selectedLink) return null;

  const handleClose = () => {
    selectNode(null);
    selectLink(null);
    setFeedback(null);
  };


  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="w-84 cyber-panel shadow-[0_0_50px_rgba(0,0,0,0.9)] transition-all duration-200 border border-cyan-500/40 bg-[#070a12]/95 backdrop-blur-xl pointer-events-auto max-h-[52vh] overflow-y-auto shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200 text-xs tracking-wider">
            {selectedNode ? "NODE INSPECTOR" : "LINK INSPECTOR"}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-slate-200 p-0.5 rounded hover:bg-white/[0.06]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Node Details */}
      {selectedNode && (
        <div className="p-3.5 space-y-3 text-xs">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
              Label / Process
            </div>
            <div className="text-sm font-bold text-slate-100 font-mono break-all">
              {selectedNode.label}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-slate-400 block text-[9px] uppercase">Kind</span>
              <span className="font-semibold text-cyan-400 uppercase">
                {selectedNode.kind}
              </span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-slate-400 block text-[9px] uppercase">PID</span>
              <span className="font-mono text-slate-200">
                {selectedNode.pid ?? "N/A"}
              </span>
            </div>
          </div>

          {selectedNode.exePath && (
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-slate-400 block text-[9px] uppercase mb-0.5">
                Executable Path
              </span>
              <div className="font-mono text-[10px] text-slate-300 break-all">
                {selectedNode.exePath}
              </div>
            </div>
          )}

          {selectedNode.ip && (
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 uppercase">IP Address</span>
                <span className="font-mono text-slate-200">{selectedNode.ip}</span>
              </div>
              {selectedNode.hostname && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 uppercase">Host</span>
                  <span className="font-mono text-slate-300 truncate max-w-[150px]">
                    {selectedNode.hostname}
                  </span>
                </div>
              )}
              {selectedNode.country && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 uppercase">Location</span>
                  <span className="text-slate-300">
                    {selectedNode.country} {selectedNode.asn ? `(${selectedNode.asn})` : ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Traffic stats with Sparkline */}
          <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Total In / Out:</span>
              <span className="font-mono text-slate-200">
                {formatBytes(selectedNode.bytesIn)} / {formatBytes(selectedNode.bytesOut)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Live Rate:</span>
              <span className="font-mono text-cyan-400">
                {formatBytes(selectedNode.rateIn + selectedNode.rateOut)}/s
              </span>
            </div>
            <div className="pt-1">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">
                Throughput Activity (Last 60s)
              </span>
              <Sparkline
                data={[12, 18, 14, 25, 30, 48, 42, 60, 55, 75, 68, 92, selectedNode.rateIn + selectedNode.rateOut]}
                width={272}
                height={38}
                color="#22d3ee"
                fillColor="rgba(34, 211, 238, 0.15)"
              />
            </div>
          </div>

          {/* Threat info */}
          {selectedNode.threat && (
            <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 space-y-1">
              <div className="flex items-center gap-1.5 text-red-400 font-bold text-[11px]">
                <Shield className="w-3.5 h-3.5" />
                <span>THREAT DETECTED ({selectedNode.threat.severity.toUpperCase()})</span>
              </div>
              <ul className="text-[10px] text-red-300 list-disc list-inside">
                {selectedNode.threat.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Block / Unblock Endpoint Button */}
          {selectedNode.ip && (
            <div className="space-y-1.5">
              {blockedIps.has(selectedNode.ip) ? (
                <button
                  onClick={async () => {
                    if (selectedNode.ip) {
                      const res = await commands.unblockRemoteIp(selectedNode.ip);
                      setBlockedIps((prev) => {
                        const next = new Set(prev);
                        next.delete(selectedNode.ip!);
                        return next;
                      });
                      setFeedback(res);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-[11px] transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Unblock via OS Firewall</span>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    if (selectedNode.ip) {
                      const res = await commands.blockRemoteIp(selectedNode.ip);
                      setBlockedIps((prev) => new Set(prev).add(selectedNode.ip!));
                      setFeedback(res);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-semibold text-[11px] transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block Endpoint via OS Firewall</span>
                </button>
              )}

              {feedback && (
                <div className="text-[10px] p-1.5 rounded bg-black/50 border border-white/10 text-cyan-300 text-center font-mono">
                  {feedback}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Link Details */}
      {selectedLink && (
        <div className="p-3.5 space-y-3 text-xs">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
              Connection
            </div>
            <div className="text-sm font-bold text-slate-100 font-mono">
              Port {selectedLink.port} ({selectedLink.service ?? selectedLink.proto.toUpperCase()})
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-slate-400 block text-[9px] uppercase">Protocol</span>
              <span className="font-semibold text-cyan-400 uppercase">
                {selectedLink.proto}
              </span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-slate-400 block text-[9px] uppercase">Packets</span>
              <span className="font-mono text-slate-200">{selectedLink.packets}</span>
            </div>
          </div>

          <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Total Volume:</span>
              <span className="font-mono text-slate-200">
                {formatBytes(selectedLink.bytesIn + selectedLink.bytesOut)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Throughput Rate:</span>
              <span className="font-mono text-cyan-400">
                {formatBytes(selectedLink.rate)}/s
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
