import React, { useState, useEffect } from "react";
import { Activity, ArrowRight, Check, Layers, Shield, X } from "lucide-react";

interface Step {
  title: string;
  badge: string;
  icon: React.ReactNode;
  summary: string;
  details: string[];
}

const ONBOARDING_STEPS: Step[] = [
  {
    title: "Total Network Transparency",
    badge: "01 / Live PC State",
    icon: <Activity className="w-8 h-8 text-cyan-400" />,
    summary:
      "NetScope maps every active TCP/UDP socket, listening service, and process communicating on your PC in real-time.",
    details: [
      "Zero terminal commands or netstat scripts needed",
      "Native Win32 kernel API inspection at 1 Hz",
      "Local traffic correlated directly (VSCode → Ollama:11434, etc.)",
    ],
  },
  {
    title: "Intelligent Topology & Aggregation",
    badge: "02 / Calm UI",
    icon: <Layers className="w-8 h-8 text-sky-400" />,
    summary:
      "A clean overview collapses redundant cloud and CDN connections into neat organizational clusters.",
    details: [
      "Switch between Overview (clustered) and All (raw) in one click",
      "Click on any cluster to expand its individual endpoints",
      "Dynamic legend with live connection counts and port pinning",
    ],
  },
  {
    title: "Safe Control & Kernel Elevation",
    badge: "03 / Protection",
    icon: <Shield className="w-8 h-8 text-emerald-400" />,
    summary:
      "Inspect what any application is talking to, focus traffic, and manage runaway processes with safety guardrails.",
    details: [
      "Protected system processes (System, csrss, lsass) are shielded from accidental termination",
      "Block or unblock remote endpoints via native Windows Firewall",
      "Relaunch elevated for kernel ETW per-connection bandwidth metering",
    ],
  },
];

export const OnboardingModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    try {
      const onboarded = localStorage.getItem("netscope_onboarded");
      if (!onboarded) {
        setIsOpen(true);
      }
    } catch {
      // Ignore localStorage restrictions
    }
  }, []);

  const handleComplete = () => {
    try {
      localStorage.setItem("netscope_onboarded", "true");
    } catch {}
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleComplete();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
          setCurrentStep((prev) => prev + 1);
        } else {
          handleComplete();
        }
      } else if (e.key === "ArrowLeft") {
        if (currentStep > 0) {
          setCurrentStep((prev) => prev - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const isLast = currentStep === ONBOARDING_STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-lg cyber-panel shadow-[0_0_60px_rgba(0,0,0,0.9)] border border-cyan-500/40 bg-[#090d14]/95 p-6 rounded-2xl relative text-left">
        {/* Skip button */}
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Skip Tour (Esc)"
          aria-label="Skip onboarding"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
            {step.badge}
          </span>
        </div>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shrink-0 shadow-inner">
            {step.icon}
          </div>
          <h2
            id="onboarding-title"
            className="text-base font-bold text-slate-100 font-mono tracking-tight"
          >
            {step.title}
          </h2>
        </div>

        {/* Summary */}
        <p className="text-slate-300 text-xs leading-relaxed mb-4">
          {step.summary}
        </p>

        {/* Bullets */}
        <div className="p-3 rounded-lg bg-black/40 border border-white/[0.05] space-y-2 mb-6">
          {step.details.map((detail, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <span>{detail}</span>
            </div>
          ))}
        </div>

        {/* Step Dots & Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {ONBOARDING_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  i === currentStep
                    ? "w-6 bg-cyan-400"
                    : "bg-slate-700 hover:bg-slate-600"
                }`}
                title={`Go to slide ${i + 1}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleComplete}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors cursor-pointer"
            >
              Skip
            </button>
            <button
              onClick={() => {
                if (isLast) {
                  handleComplete();
                } else {
                  setCurrentStep((prev) => prev + 1);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 font-bold text-xs font-mono transition-all shadow-sm cursor-pointer"
            >
              <span>{isLast ? "Get Started" : "Next"}</span>
              {isLast ? (
                <Check className="w-3.5 h-3.5 text-cyan-300" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5 text-cyan-300" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
