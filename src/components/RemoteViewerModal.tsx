import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Copy,
  Check,
  Radio,
  ExternalLink,
  X,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export const RemoteViewerModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);

  const sessionId = "live_" + Math.random().toString(36).substring(2, 7);
  const shareUrl = `${window.location.origin}/?viewer=${sessionId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    shareUrl
  )}&bgcolor=ffffff&color=07090d&margin=2`;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 font-mono">
      <div className="w-full max-w-md bg-[#0a0e17] border border-cyan-500/40 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.3)] p-6 text-slate-200 flex flex-col gap-4 relative">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wider">
              REMOTE HUD VIEWER
            </h2>
            <div className="text-[11px] text-cyan-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-Time Mobile Companion</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          Scan the QR code with your phone camera to stream your active desktop network topology on your phone screen in real time.
        </p>

        {/* Scannable QR Code Image */}
        <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-[#05070a] border border-cyan-500/30 gap-3">
          <div className="p-2 bg-white rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <img
              src={qrCodeUrl}
              alt="Scan QR code with phone camera"
              width={180}
              height={180}
              className="rounded-lg block"
            />
          </div>
          <span className="text-[10px] text-cyan-400 font-semibold tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            POINT PHONE CAMERA TO SCAN
          </span>
        </div>

        {/* Direct Link & Copy */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-slate-800 text-xs text-slate-300 focus:outline-none select-all font-mono"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-semibold transition-all shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Channel Status */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-slate-800 text-[11px]">
          <div className="flex items-center gap-2 text-slate-300">
            <Radio
              className={`w-3.5 h-3.5 ${
                isBroadcasting ? "text-emerald-400 animate-pulse" : "text-slate-500"
              }`}
            />
            <span>
              Broadcast: {isBroadcasting ? `Active (${viewerCount} connected)` : "Paused"}
            </span>
            <button
              onClick={() => setIsBroadcasting(!isBroadcasting)}
              className="text-[10px] text-cyan-400 hover:underline ml-1"
            >
              {isBroadcasting ? "Pause" : "Resume"}
            </button>
          </div>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-xs hover:underline"
          >
            <span>Open in Tab</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
