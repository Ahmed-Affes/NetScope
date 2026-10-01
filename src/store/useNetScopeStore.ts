import { create } from "zustand";
import { Alert, GraphDelta, GraphLink, GraphNode, SystemMetrics } from "../types/graph";

interface NetScopeState {
  nodes: Record<string, GraphNode>;
  links: Record<string, GraphLink>;
  metrics: SystemMetrics;
  alerts: Alert[];
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  isMetricsOpen: boolean;
  isLegendOpen: boolean;
  isCommandPaletteOpen: boolean;
  searchQuery: string;
  activeFilter: string | null;
  layoutMode: "force" | "radial" | "geo" | "3d";
  graphVersion: number;

  // Actions
  applyDelta: (delta: GraphDelta) => void;
  setMetrics: (metrics: SystemMetrics) => void;
  selectNode: (id: string | null) => void;
  selectLink: (id: string | null) => void;
  toggleMetrics: () => void;
  toggleLegend: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string | null) => void;
  setLayoutMode: (mode: "force" | "radial" | "geo" | "3d") => void;
  clearGraph: () => void;
}

const initialMetrics: SystemMetrics = {
  cpuUsage: 0,
  ramUsedBytes: 0,
  ramTotalBytes: 0,
  ramUsagePercent: 0,
  gpuUsage: null,
  gpuTemp: null,
  diskFreeBytes: 0,
  diskTotalBytes: 0,
  diskUsagePercent: 0,
  dockerContainers: 0,
};

export const useNetScopeStore = create<NetScopeState>((set) => ({
  nodes: {},
  links: {},
  metrics: initialMetrics,
  alerts: [],
  selectedNodeId: null,
  selectedLinkId: null,
  isMetricsOpen: true, // Visible by default
  isLegendOpen: true,  // Visible by default
  isCommandPaletteOpen: false,
  searchQuery: "",
  activeFilter: null,
  layoutMode: "force",
  graphVersion: 0,

  applyDelta: (delta) =>
    set((state) => {
      const nextNodes = { ...state.nodes };
      const nextLinks = { ...state.links };

      // Add nodes
      for (const node of delta.addNodes) {
        nextNodes[node.id] = node;
      }

      // Update nodes
      for (const update of delta.updateNodes) {
        if (nextNodes[update.id]) {
          nextNodes[update.id] = {
            ...nextNodes[update.id],
            ...update,
            threat: update.threat !== undefined ? update.threat : nextNodes[update.id].threat,
          };
        }
      }

      // Remove nodes
      for (const id of delta.removeNodeIds) {
        delete nextNodes[id];
      }

      // Add links
      for (const link of delta.addLinks) {
        nextLinks[link.id] = link;
      }

      // Update links
      for (const update of delta.updateLinks) {
        if (nextLinks[update.id]) {
          nextLinks[update.id] = {
            ...nextLinks[update.id],
            ...update,
          };
        }
      }

      // Remove links
      for (const id of delta.removeLinkIds) {
        delete nextLinks[id];
      }

      const nextAlerts = delta.alerts
        ? [...delta.alerts, ...state.alerts].slice(0, 100)
        : state.alerts;

      const hasStructureChange =
        delta.addNodes.length > 0 ||
        delta.removeNodeIds.length > 0 ||
        delta.addLinks.length > 0 ||
        delta.removeLinkIds.length > 0;

      return {
        nodes: nextNodes,
        links: nextLinks,
        alerts: nextAlerts,
        graphVersion: hasStructureChange ? state.graphVersion + 1 : state.graphVersion,
      };
    }),

  setMetrics: (metrics) => set({ metrics }),

  selectNode: (id) =>
    set({
      selectedNodeId: id,
      selectedLinkId: id ? null : undefined,
    }),

  selectLink: (id) =>
    set({
      selectedLinkId: id,
      selectedNodeId: id ? null : undefined,
    }),

  toggleMetrics: () => set((s) => ({ isMetricsOpen: !s.isMetricsOpen })),
  toggleLegend: () => set((s) => ({ isLegendOpen: !s.isLegendOpen })),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveFilter: (filter) =>
    set((s) => ({
      activeFilter: s.activeFilter === filter ? null : filter,
    })),

  setLayoutMode: (mode) => set({ layoutMode: mode }),

  clearGraph: () =>
    set((state) => ({
      nodes: {},
      links: {},
      selectedNodeId: null,
      selectedLinkId: null,
      alerts: [],
      graphVersion: state.graphVersion + 1,
    })),
}));
