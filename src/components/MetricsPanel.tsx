import React from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { ChevronDown, ChevronUp } from "lucide-react";

export const MetricsPanel: React.FC = () => {
  const { metrics, isMetricsOpen, toggleMetrics } = useNetScopeStore();

  const formatGb = (bytes: number) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1);
  };

  return (
    <div className="absolute top-14 left-4 z-40 w-64 cyber-panel text-xs transition-all duration-200">
      {/* Header */}
      <div
        onClick={toggleMetrics}
        className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.02]"
      >
        <span className="font-bold tracking-wider text-cyan-400 text-[11px]">
          SYSTEM METRICS
        </span>
        <button className="text-slate-400 hover:text-slate-200">
          {isMetricsOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Body */}
      {isMetricsOpen && (
        <div className="p-3.5 space-y-3">
          {/* CPU */}
          <div>
            <div className="flex justify-between items-center mb-1 text-[11px]">
              <span className="text-slate-400 font-medium">CPU</span>
              <span className="text-slate-200 font-mono">
                {metrics.cpuUsage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-[#161d2a] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                style={{ width: `${Math.min(100, Math.max(0, metrics.cpuUsage))}%` }}
              />
            </div>
          </div>

          {/* RAM */}
          <div>
            <div className="flex justify-between items-center mb-1 text-[11px]">
              <span className="text-slate-400 font-medium">RAM</span>
              <span className="text-slate-200 font-mono">
                {metrics.ramUsagePercent.toFixed(1)}% (
                {formatGb(metrics.ramUsedBytes)}/{formatGb(metrics.ramTotalBytes)} GB)
              </span>
            </div>
            <div className="w-full bg-[#161d2a] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                style={{
                  width: `${Math.min(100, Math.max(0, metrics.ramUsagePercent))}%`,
                }}
              />
            </div>
          </div>

          {/* GPU */}
          <div>
            <div className="flex justify-between items-center mb-1 text-[11px]">
              <span className="text-slate-400 font-medium">GPU</span>
              <span className="text-slate-200 font-mono">
                {metrics.gpuUsage !== null && metrics.gpuUsage !== undefined
                  ? `${metrics.gpuUsage}% | ${metrics.gpuTemp ?? 49}°C`
                  : "N/A"}
              </span>
            </div>
            <div className="w-full bg-[#161d2a] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                style={{
                  width: `${Math.min(100, Math.max(0, metrics.gpuUsage ?? 0))}%`,
                }}
              />
            </div>
          </div>

          {/* Disk */}
          <div>
            <div className="flex justify-between items-center mb-1 text-[11px]">
              <span className="text-slate-400 font-medium">Disk</span>
              <span className="text-slate-200 font-mono">
                {metrics.diskUsagePercent.toFixed(1)}% (
                {formatGb(metrics.diskFreeBytes)} GB free)
              </span>
            </div>
            <div className="w-full bg-[#161d2a] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                style={{
                  width: `${Math.min(100, Math.max(0, metrics.diskUsagePercent))}%`,
                }}
              />
            </div>
          </div>

          {/* Docker */}
          <div className="flex justify-between items-center pt-1 border-t border-white/[0.04] text-[11px]">
            <span className="text-slate-400 font-medium">Docker</span>
            <span className="text-purple-400 font-mono font-medium">
              {metrics.dockerContainers} containers
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
