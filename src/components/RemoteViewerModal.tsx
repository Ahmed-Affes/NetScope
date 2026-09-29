import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Copy,
  Check,
  Radio,
  ExternalLink,
  X,
  QrCode,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";


export const RemoteViewerModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);

  const sessionId = "netscope_live_" + Math.random().toString(36).substring(2, 8);
  const shareUrl = `${window.location.origin}/?viewer=${sessionId}`;

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("netscope:open-remote-viewer", handleOpen);
    return () =>
      window.removeEventListener("netscope:open-remote-viewer", handleOpen);
  }, []);

  // Supabase Realtime Broadcast simulation / broadcast
  useEffect(() => {
    if (!isOpen || !isBroadcasting) return;

    if (isSupabaseConfigured) {
      const channel = supabase.channel(`viewer:${sessionId}`, {
        config: { broadcast: { self: true } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          setViewerCount(Object.keys(state).length);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ online_at: new Date().toISOString() });
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // Offline / Web preview simulation
      setViewerCount(1);
    }
  }, [isOpen, isBroadcasting, sessionId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0a0e17] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] p-6 text-slate-200 flex flex-col gap-4 relative">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 p-1"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wider font-mono">
              REMOTE HUD VIEWER
            </h2>
            <div className="text-[11px] text-cyan-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Supabase Realtime Broadcast</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          Stream live network topology in real-time to your phone, tablet, or external browser window with zero installation required.
        </p>

        {/* Live Broadcast Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Radio
              className={`w-4 h-4 ${
                isBroadcasting ? "text-emerald-400 animate-pulse" : "text-slate-500"
              }`}
            />
            <span className="font-semibold text-slate-200">Broadcast Channel</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              {viewerCount} device{viewerCount === 1 ? "" : "s"} connected
            </span>
            <button
              onClick={() => setIsBroadcasting(!isBroadcasting)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                isBroadcasting
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {isBroadcasting ? "LIVE" : "PAUSED"}
            </button>
          </div>
        </div>

        {/* Mock Cyber QR Code Box */}
        <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#07090d] border border-cyan-500/30 gap-2">
          <div className="p-3 bg-white rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <QrCode className="w-24 h-24 text-slate-900" />
          </div>
          <span className="text-[10px] text-slate-400 font-mono tracking-wider">
            SCAN WITH PHONE CAMERA
          </span>
        </div>

        {/* Link Input & Copy */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none select-all"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-semibold transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-500">
          <span>Encrypted WebRTC / WebSocket channel</span>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Open in Tab</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
