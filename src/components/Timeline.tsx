import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Square,
  History,
  AlertTriangle,
} from "lucide-react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { recorder } from "../services/recorder";
import { cloudStorage, SessionMetadata } from "../lib/supabase";
import { replayController } from "../sources/replay";

export const Timeline: React.FC = () => {
  const {
    isRecording,
    setRecording,
    setTrafficMode,
    trafficMode,
    replayProgress,
    replayPlaying,
    replaySpeed,
  } = useNetScopeStore();

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionMetadata | null>(null);

  // Recording timer
  useEffect(() => {
    let timer: number;
    if (isRecording) {
      timer = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleToggleRecord = async () => {
    if (isRecording) {
      await recorder.stopRecording();
      setRecording(false);
      // Refresh sessions
      const list = await cloudStorage.listSessions();
      setSessions(list);
    } else {
      await recorder.startRecording();
      setRecording(true);
    }
  };

  const handleOpenSessions = async () => {
    const list = await cloudStorage.listSessions();
    setSessions(list);
    setShowSessionModal(true);
  };

  const handleSelectSession = async (sess: SessionMetadata) => {
    setActiveSession(sess);
    setShowSessionModal(false);
    await replayController.setSession(sess.id);
    setTrafficMode("replay");
    replayController.start();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // If in live or simulator mode and not recording, only render the Sessions history button
  if (trafficMode !== "replay" && !isRecording) {
    return (
      <div className="absolute bottom-4 right-52 z-30 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={handleOpenSessions}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e121a]/90 hover:bg-[#141a26] border border-white/[0.08] hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs font-mono backdrop-blur-md shadow-xl transition-all"
          title="Past Recorded Sessions"
        >
          <History className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-[11px] tracking-wider uppercase">SESSIONS</span>
        </button>

        {showSessionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto">
            <div className="w-full max-w-md bg-[#0a0e17] border border-cyan-500/40 rounded-xl shadow-[0_0_40px_rgba(6,182,212,0.25)] p-5 text-slate-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-sm tracking-wide text-cyan-400">
                    NETWORK REPLAY SESSIONS
                  </span>
                </div>
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="text-slate-500 hover:text-slate-300 text-sm font-mono"
                >
                  [ESC]
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No sessions recorded yet. Hit the REC button to capture live topology.
                  </div>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s)}
                      className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/20 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-300">
                          {s.title}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{new Date(s.startedAt).toLocaleTimeString()}</span>
                          <span>•</span>
                          <span>{s.sampleCount} chunks</span>
                          <span>•</span>
                          <span>{s.peakNodes} nodes</span>
                        </div>
                      </div>
                      <Play className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const sliderPercent = Math.round((replayProgress || 0) * 100);

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-[620px] max-w-[90vw] px-4 py-2.5 bg-[#0a0e17]/95 border border-cyan-500/40 rounded-xl backdrop-blur-md shadow-[0_4px_30px_rgba(6,182,212,0.2)] flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto">
      <div className="flex items-center justify-between text-xs">
        {/* Status / Session Name */}
        <div className="flex items-center gap-2">
          {isRecording ? (
            <div className="flex items-center gap-2 text-rose-400 font-semibold tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span>RECORDING LIVE PC</span>
              <span className="text-slate-400 font-normal">
                ({formatTime(recordingSeconds)})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-cyan-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="truncate max-w-[240px] font-semibold text-[11px]">
                {activeSession?.title || "Incident Replay (PC)"}
              </span>
            </div>
          )}
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-slate-800 text-[10px]">
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => replayController.setSpeed(s)}
              className={`px-1.5 py-0.5 rounded transition-all ${
                replaySpeed === s
                  ? "bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isRecording ? (
            <button
              onClick={handleToggleRecord}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/60 border border-rose-600/50 text-rose-300 hover:bg-rose-900/60 text-xs transition-all"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop REC</span>
            </button>
          ) : (
            <button
              onClick={() => {
                replayController.stop();
                setTrafficMode("live");
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold"
            >
              Back to Live PC
            </button>
          )}
        </div>
      </div>

      {/* Scrubber Track */}
      <div className="relative flex items-center gap-3">
        <button
          onClick={() => replayController.togglePlay()}
          disabled={isRecording}
          className={`p-1.5 rounded-lg border transition-all ${
            isRecording
              ? "opacity-40 cursor-not-allowed border-slate-800 text-slate-600"
              : "border-cyan-500/40 bg-cyan-950/40 text-cyan-400 hover:bg-cyan-900/50"
          }`}
          title={replayPlaying ? "Pause Replay" : "Play Replay"}
        >
          {replayPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
        </button>

        <div className="relative flex-1 h-3 flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPercent}
            disabled={isRecording}
            onChange={(e) => {
              const val = Number(e.target.value);
              replayController.seek(val / 100);
            }}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300"
          />
        </div>

        <button
          onClick={() => replayController.seek(0)}
          disabled={isRecording}
          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          title="Restart Replay"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            const nextP = Math.min(1, (replayProgress || 0) + 0.25);
            replayController.seek(nextP);
          }}
          disabled={isRecording}
          className="p-1 text-amber-400 hover:text-amber-300 transition-colors"
          title="Jump Ahead 25%"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
