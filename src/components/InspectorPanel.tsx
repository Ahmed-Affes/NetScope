import React, { useState, useEffect } from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import {
  Activity,
  Ban,
  Check,
  Copy,
  FolderOpen,
  Network,
  Shield,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Sparkline } from "./Sparkline";
import { commands, SocketInfo } from "../bindings";
import { isCriticalProcess, getCriticalProcessReason } from "../utils/processSafety";

export const InspectorPanel: React.FC = () => {
  const {
    selectedNodeId,
    selectedLinkId,
    nodes,
    links,
    selectNode,
    selectLink,
    setActiveFilter,
    setSearchQuery,
    requestKillProcess,
  } = useNetScopeStore();

  const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");
  const [copiedPath, setCopiedPath] = useState(false);
  const [procSockets, setProcSockets] = useState<SocketInfo[]>([]);

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null;
  const selectedLink = selectedLinkId ? links[selectedLinkId] : null;

  // Reset states and fetch process sockets on selection change
  useEffect(() => {
    setFeedback(null);
    setProcSockets([]);

    if (selectedNode?.pid) {
      commands.getActiveSockets()
        .then((allSockets) => {
          const matched = allSockets.filter(
            (s) => s.pid === selectedNode.pid || (s.processName && s.processName.toLowerCase() === selectedNode.label.toLowerCase())
          );
          setProcSockets(matched);
        })
        .catch(() => setProcSockets([]));
    }
  }, [selectedNodeId, selectedNode?.pid, selectedNode?.label]);

  if (!selectedNode && !selectedLink) return null;

  const handleClose = () => {
    selectNode(null);
    selectLink(null);
    setFeedback(null);
  };

  const handleCopyPath = () => {
    if (!selectedNode?.exePath) return;
    navigator.clipboard.writeText(selectedNode.exePath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 1500);
  };

  const handleRevealInExplorer = async () => {
    if (!selectedNode?.exePath) return;
    try {
      await commands.revealInExplorer(selectedNode.exePath);
      setFeedback("Opened folder location in Windows Explorer");
      setFeedbackType("success");
    } catch (e) {
      setFeedback(`Could not open folder: ${e}`);
      setFeedbackType("error");
    }
  };

  const handleFocusPort = (port: number) => {
    setActiveFilter(`port:${port}`);
    setSearchQuery(`port:${port}`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="w-[360px] max-w-[calc(100vw-32px)] cyber-panel shadow-[0_0_50px_rgba(0,0,0,0.9)] transition-all duration-200 border border-slate-700/60 bg-[#090d14]/95 backdrop-blur-xl pointer-events-auto max-h-[75vh] overflow-y-auto overflow-x-hidden custom-scrollbar shrink-0 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-[#0c1018] sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200 text-xs tracking-wider">
            {selectedNode ? "NODE INSPECTOR" : "LINK INSPECTOR"}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-slate-200 p-0.5 rounded hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Node Details */}
      {selectedNode && (
        <div className="p-3.5 space-y-3 text-xs">
          {/* Label / Process Name */}
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 font-medium">
              Label / Process
            </div>
            <div className="text-sm font-bold text-slate-100 font-mono break-all leading-tight">
              {selectedNode.label}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-slate-400 block text-[9px] uppercase font-medium">Kind</span>
              <span className="font-semibold text-cyan-400 uppercase tracking-wider text-[10px]">
                {selectedNode.kind}
              </span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-slate-400 block text-[9px] uppercase font-medium">PID</span>
              <span className="font-mono text-slate-200 font-bold">
                {selectedNode.pid ?? "N/A"}
              </span>
            </div>
          </div>

          {/* Executable Path - Compact, bounded, non-breaking layout */}
          {selectedNode.exePath && (
            <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.05] space-y-1.5">
              <div className="flex items-center justify-between text-[9px] text-slate-400 uppercase font-medium">
                <span>Executable Path</span>
                <span className="font-mono text-[9px] text-slate-500">Local Disk</span>
              </div>
              
              {/* Path display box - wrapped and bounded */}
              <div className="p-1.5 rounded bg-black/40 border border-white/[0.05] font-mono text-[10px] text-slate-300 break-all select-all max-h-18 overflow-y-auto custom-scrollbar leading-relaxed">
                {selectedNode.exePath}
              </div>

              {/* Action Buttons for Path */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={handleCopyPath}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06] text-[10px] font-mono transition-colors"
                  title="Copy full executable path to clipboard"
                >
                  {copiedPath ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy Path</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleRevealInExplorer}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06] text-[10px] font-mono transition-colors"
                  title="Reveal executable file in Windows Explorer"
                >
                  <FolderOpen className="w-3 h-3 text-cyan-400" />
                  <span>Open Folder</span>
                </button>
              </div>
            </div>
          )}

          {/* Integrated Task Manager Action: End / Kill Process */}
          {selectedNode.pid && (
            <div className="p-2.5 rounded bg-rose-500/5 border border-rose-500/20 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-rose-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>Process Control</span>
                </span>
                <span className="font-mono text-[9px] text-slate-400">PID {selectedNode.pid}</span>
              </div>

              <button
                onClick={() =>
                  requestKillProcess({
                    pid: selectedNode.pid!,
                    name: selectedNode.label,
                    ports: procSockets.map((s) => s.localPort),
                    exePath: selectedNode.exePath,
                  })
                }
                disabled={isCriticalProcess(selectedNode.pid, selectedNode.label)}
                className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded font-semibold text-[11px] transition-all shadow-sm ${
                  isCriticalProcess(selectedNode.pid, selectedNode.label)
                    ? "bg-slate-800/40 border border-slate-700/40 text-slate-500 cursor-not-allowed opacity-60"
                    : "bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 hover:text-rose-200 cursor-pointer"
                }`}
                title={
                  isCriticalProcess(selectedNode.pid, selectedNode.label)
                    ? getCriticalProcessReason(selectedNode.pid, selectedNode.label)
                    : "Terminate process directly from NetScope with safety verification"
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isCriticalProcess(selectedNode.pid, selectedNode.label)
                    ? "Protected System Process"
                    : "End Process (Kill Task)"}
                </span>
              </button>
            </div>
          )}

          {/* Active Sockets & Ports Tree for this Process */}
          {procSockets.length > 0 && (
            <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.04] space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-cyan-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Network className="w-3 h-3 text-cyan-400" />
                  <span>Bound Sockets ({procSockets.length})</span>
                </span>
                <span className="text-[9px] text-slate-500">Click Focus to isolate</span>
              </div>

              <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar pr-0.5">
                {procSockets.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/[0.04] text-[10px] font-mono hover:border-cyan-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      <span className="px-1 py-0.2 rounded text-[8px] font-bold uppercase bg-white/[0.06] text-slate-300">
                        {s.proto}
                      </span>
                      <span className="text-cyan-300 font-bold">:{s.localPort}</span>
                      {s.service && (
                        <span className="text-slate-400 text-[9px]">({s.service})</span>
                      )}
                      <span className="text-[9px] text-slate-500 truncate">
                        {s.state}
                      </span>
                    </div>

                    <button
                      onClick={() => handleFocusPort(s.localPort)}
                      className="px-1.5 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[9px] font-sans font-semibold shrink-0 transition-colors cursor-pointer"
                      title={`Focus port :${s.localPort} on topology`}
                    >
                      Focus
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IP Address Details */}
          {selectedNode.ip && (
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 uppercase font-medium">IP Address</span>
                <span className="font-mono text-slate-200">{selectedNode.ip}</span>
              </div>
              {selectedNode.hostname && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 uppercase font-medium">Host</span>
                  <span className="font-mono text-slate-300 truncate max-w-[150px]">
                    {selectedNode.hostname}
                  </span>
                </div>
              )}
              {selectedNode.country && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 uppercase font-medium">Location</span>
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
              <span className="font-mono text-cyan-400 font-semibold">
                {formatBytes(selectedNode.rateIn + selectedNode.rateOut)}/s
              </span>
            </div>
            <div className="pt-1">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1 font-medium">
                Throughput Activity (Last 60s)
              </span>
              <Sparkline
                data={[12, 18, 14, 25, 30, 48, 42, 60, 55, 75, 68, 92, selectedNode.rateIn + selectedNode.rateOut]}
                width={320}
                height={38}
                color="#22d3ee"
                fillColor="rgba(34, 211, 238, 0.12)"
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
                      setFeedbackType("success");
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
                      setFeedbackType("success");
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-semibold text-[11px] transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block Endpoint via OS Firewall</span>
                </button>
              )}
            </div>
          )}

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`text-[10px] p-2 rounded border font-mono text-center break-words ${
                feedbackType === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {feedback}
            </div>
          )}
        </div>
      )}

      {/* Link Details */}
      {selectedLink && (
        <div className="p-3.5 space-y-3 text-xs">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 font-medium">
              Connection
            </div>
            <div className="text-sm font-bold text-slate-100 font-mono">
              Port {selectedLink.port} ({selectedLink.service ?? selectedLink.proto.toUpperCase()})
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-slate-400 block text-[9px] uppercase font-medium">Protocol</span>
              <span className="font-semibold text-cyan-400 uppercase text-[10px]">
                {selectedLink.proto}
              </span>
            </div>
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-slate-400 block text-[9px] uppercase font-medium">Packets</span>
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
              <span className="font-mono text-cyan-400 font-semibold">
                {formatBytes(selectedLink.rate)}/s
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
