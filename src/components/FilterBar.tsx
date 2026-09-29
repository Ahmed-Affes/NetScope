import React from "react";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { Filter, X } from "lucide-react";

export const FilterBar: React.FC = () => {
  const { activeFilter, setActiveFilter, searchQuery, setSearchQuery } =
    useNetScopeStore();

  if (!activeFilter && !searchQuery) return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
      {activeFilter && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs shadow-[0_0_12px_rgba(34,211,238,0.25)] backdrop-blur-md">
          <Filter className="w-3 h-3 text-cyan-400" />
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            Filter: {activeFilter}
          </span>
          <button
            onClick={() => setActiveFilter(null)}
            className="p-0.5 rounded-full hover:bg-white/[0.1] text-cyan-300 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {searchQuery && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs shadow-[0_0_12px_rgba(168,85,247,0.25)] backdrop-blur-md">
          <span className="font-semibold text-[11px]">Query: "{searchQuery}"</span>
          <button
            onClick={() => setSearchQuery("")}
            className="p-0.5 rounded-full hover:bg-white/[0.1] text-purple-300 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
