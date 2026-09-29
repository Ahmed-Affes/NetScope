import React, { useState, useEffect } from "react";
import {
  Activity,
  ShieldAlert,
  Cloud,
  Network,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";

export const OnboardingModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const onboarded = localStorage.getItem("netscope_onboarded");
    if (!onboarded) {
      setIsOpen(true);
    }

    const handleShowOnboarding = () => {
      setStep(0);
      setIsOpen(true);
    };

    window.addEventListener("netscope:show-onboarding", handleShowOnboarding);
    return () =>
      window.removeEventListener("netscope:show-onboarding", handleShowOnboarding);
  }, []);

  const handleFinish = () => {
    localStorage.setItem("netscope_onboarded", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const steps = [
    {
      title: "WELCOME TO NETSCOPE",
      subtitle: "Autonomous Network Intelligence & Threat Visualizer",
      icon: <Activity className="w-8 h-8 text-cyan-400 animate-pulse" />,
      content:
        "NetScope inspects, traces, and visualizes every active network connection on your machine in real-time as a high-performance WebGL graph.",
    },
    {
      title: "DYNAMIC LAYOUT TRANSITIONS",
      subtitle: "Force, Radial, Geo-Map & Isometric 3D",
      icon: <Network className="w-8 h-8 text-purple-400" />,
      content:
        "Switch between organic Force-directed physics, concentric Radial rings, geographic regional projection, and 3D layered mode using keys 1, 2, 3, and 4.",
    },
    {
      title: "THREAT ENGINE & ATK-SIM",
      subtitle: "Autonomous Detection & Live Attack Scenarios",
      icon: <ShieldAlert className="w-8 h-8 text-rose-400" />,
      content:
        "Detect C2 beaconing, exfiltration spikes, and port scans automatically. Use the ATK-SIM panel to test and demo 7 real-world attack vectors.",
    },
    {
      title: "CLOUD RECORDING & REPLAY",
      subtitle: "Zero Local DB • Supabase Cloud Sessions",
      icon: <Cloud className="w-8 h-8 text-emerald-400" />,
      content:
        "Hit the REC button anytime to record a live session to Supabase. Scrub back through time, change replay speed, and jump directly to traffic spikes.",
    },
  ];

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0a0e17] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] p-6 text-slate-200 flex flex-col gap-4 relative">
        <button
          onClick={handleFinish}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 p-1"
          title="Skip tutorial"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 mb-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-cyan-400" : "w-2 bg-slate-800"
              }`}
            />
          ))}
        </div>

        {/* Main Content */}
        <div className="flex items-start gap-4 py-2">
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 shrink-0">
            {current.icon}
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white tracking-wider font-mono">
              {current.title}
            </h2>
            <div className="text-xs font-semibold text-cyan-400">
              {current.subtitle}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-2 font-sans">
              {current.content}
            </p>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <button
            onClick={handleFinish}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Skip Briefing
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-semibold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-semibold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch NetScope</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
