import React, { useEffect } from "react";
import { TitleBar } from "./components/TitleBar";
import { MetricsPanel } from "./components/MetricsPanel";
import { StatsPill } from "./components/StatsPill";
import { LegendPanel } from "./components/LegendPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { FilterBar } from "./components/FilterBar";
import { CommandPalette } from "./components/CommandPalette";
import { AlertFeed } from "./components/AlertFeed";
import { UpdateNotification } from "./components/UpdateNotification";
import { GraphCanvas } from "./components/GraphCanvas";
import { PortInspectorModal } from "./components/PortInspectorModal";
import { SpeedTestModal } from "./components/SpeedTestModal";
import { KillProcessModal } from "./components/KillProcessModal";

import { useNetScopeStore } from "./store/useNetScopeStore";
import { commands } from "./bindings";

export const App: React.FC = () => {
  const { setMetrics, setIsElevated, openCommandPalette, killTarget, closeKillProcess } = useNetScopeStore();

  // Load app info (elevation status) on startup
  useEffect(() => {
    commands.getAppInfo().then((info) => {
      setIsElevated(info.isElevated);
    }).catch((err) => {
      console.warn("Failed to get app info:", err);
    });
  }, [setIsElevated]);

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

  // Global keyboard shortcuts: F, Space, /, Esc, 1, 2, 3
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommandPalette();
      } else if (e.key === "Escape") {
        useNetScopeStore.getState().selectNode(null);
        useNetScopeStore.getState().selectLink(null);
        useNetScopeStore.getState().closeCommandPalette();
        useNetScopeStore.getState().closeSpeedTest();
        useNetScopeStore.getState().closePortInspector();
        useNetScopeStore.getState().closeKillProcess();
      } else if (e.key === "1") {
        useNetScopeStore.getState().setLayoutMode("force");
      } else if (e.key === "2") {
        useNetScopeStore.getState().setLayoutMode("radial");
      } else if (e.key === "3") {
        useNetScopeStore.getState().setLayoutMode("3d");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCommandPalette]);

  // Intercept all external hyperlinks in the desktop app and open via OS shell
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (target && target.href && (target.href.startsWith("http://") || target.href.startsWith("https://"))) {
        e.preventDefault();
        commands.openExternalUrl(target.href);
      }
    };
    window.addEventListener("click", handleAnchorClick);
    return () => window.removeEventListener("click", handleAnchorClick);
  }, []);

  return (
    <div className="relative h-screen w-screen flex flex-col bg-[#07090d] text-[#e6edf3] overflow-hidden select-none font-mono">
      {/* Custom Frameless Title Bar */}
      <TitleBar />

      {/* Main Workspace Area */}
      <div className="relative flex-1 w-full h-[calc(100vh-40px)] overflow-hidden">
        {/* Background Visual Effects: Subtle Scanlines & Vignette */}
        <div className="absolute inset-0 cyber-scanlines z-10 pointer-events-none" />
        <div className="absolute inset-0 cyber-vignette z-10 pointer-events-none" />

        {/* Ambient Radial Cyber Glow in Center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-950/15 rounded-full blur-[140px] pointer-events-none z-0" />

        {/* WebGL Canvas Graph Engine (PixiJS v8) */}
        <GraphCanvas />

        {/* Top Centered Status & Filters */}
        <FilterBar />

        {/* Left Cyber Dock (Real PC Metrics) */}
        <div className="absolute top-14 left-4 z-40 flex flex-col gap-2.5 max-h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar pointer-events-none pr-1">
          <MetricsPanel />
        </div>

        {/* Right Cyber Dock (Inspector & Security Alerts cleanly stacked, bounded width) */}
        <div className="absolute top-14 right-4 z-40 w-[360px] max-w-[calc(100vw-32px)] flex flex-col items-end gap-2.5 max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar pointer-events-none pr-1">
          <InspectorPanel />
          <AlertFeed />
        </div>

        {/* Bottom Bar: Center Stats & Right Legend */}
        <StatsPill />
        <LegendPanel />

        {/* Modals & Dialogs */}
        <UpdateNotification />
        <CommandPalette />
        <PortInspectorModal />
        <SpeedTestModal />
        <KillProcessModal
          isOpen={Boolean(killTarget)}
          target={killTarget}
          onClose={closeKillProcess}
        />
      </div>
    </div>
  );
};

export default App;
