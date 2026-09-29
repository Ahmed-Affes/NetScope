import React, { useEffect } from "react";
import { TitleBar } from "./components/TitleBar";
import { MetricsPanel } from "./components/MetricsPanel";
import { AtkSimPanel } from "./components/AtkSimPanel";
import { StatsPill } from "./components/StatsPill";
import { LegendPanel } from "./components/LegendPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { useNetScopeStore } from "./store/useNetScopeStore";
import { commands } from "./bindings";

export const App: React.FC = () => {
  const { setMetrics } = useNetScopeStore();

  // Load system metrics periodically
  useEffect(() => {
    let mounted = true;
    const fetchMetrics = async () => {
      try {
        const m = await commands.getSystemMetrics();
        if (mounted) {
          setMetrics(m);
        }
      } catch (err) {
        console.error("Failed to fetch metrics", err);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setMetrics]);

  // Global keyboard shortcuts: F, Space, /, Esc, 1, 2, 3, 4
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Toggle command palette or focus search
      } else if (e.key === "Escape") {
        useNetScopeStore.getState().selectNode(null);
        useNetScopeStore.getState().selectLink(null);
      } else if (e.key === "1") {
        useNetScopeStore.getState().setLayoutMode("force");
      } else if (e.key === "2") {
        useNetScopeStore.getState().setLayoutMode("radial");
      } else if (e.key === "3") {
        useNetScopeStore.getState().setLayoutMode("geo");
      } else if (e.key === "4") {
        useNetScopeStore.getState().setLayoutMode("3d");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative h-screen w-screen flex flex-col bg-[#07090d] text-[#e6edf3] overflow-hidden select-none font-mono">
      {/* Custom Frameless Title Bar */}
      <TitleBar />

      {/* Main Workspace Area */}
      <div className="relative flex-1 w-full h-[calc(100vh-40px)] overflow-hidden">
        {/* Background Visual Effects: Subtle Starfield, Scanlines & Vignette */}
        <div className="absolute inset-0 cyber-scanlines z-10 pointer-events-none" />
        <div className="absolute inset-0 cyber-vignette z-10 pointer-events-none" />

        {/* Ambient Radial Cyber Glow in Center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-950/15 rounded-full blur-[140px] pointer-events-none z-0" />

        {/* WebGL Canvas Graph Mount Placeholder for Phase 0/1 */}
        <div id="netscope-canvas-container" className="absolute inset-0 z-0 flex items-center justify-center">
          {/* Subtle Cyber Grid Guide for Phase 0 */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-25" />
        </div>

        {/* Floating Cyber Panels matching user screenshot */}
        <MetricsPanel />
        <AtkSimPanel />
        <StatsPill />
        <LegendPanel />
        <InspectorPanel />
      </div>
    </div>
  );
};

export default App;
