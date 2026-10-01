import { create } from "zustand";
import { Alert, GraphDelta, GraphLink, GraphNode, SystemMetrics } from "../types/graph";

export interface KillTarget {
  pid: number;
  name: string;
  ports?: number[];
  exePath?: string;
}

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
  isSpeedTestOpen: boolean;
  isPortInspectorOpen: boolean;
  portInspectorInitialTab: "table" | "tree";
  killTarget: KillTarget | null;
  searchQuery: string;
  activeFilter: string | null;
  layoutMode: "force" | "radial" | "geo" | "3d";
  viewMode: "overview" | "all";
  expandedClusters: Set<string>;
  graphVersion: number;
  isElevated: boolean;

  // Actions
  applyDelta: (delta: GraphDelta) => void;
  setMetrics: (metrics: SystemMetrics) => void;
  setIsElevated: (elevated: boolean) => void;
  selectNode: (id: string | null) => void;
  selectLink: (id: string | null) => void;
  toggleMetrics: () => void;
  toggleLegend: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openSpeedTest: () => void;
  closeSpeedTest: () => void;
  openPortInspector: (initialTab?: "table" | "tree") => void;
  closePortInspector: () => void;
  requestKillProcess: (target: KillTarget) => void;
  closeKillProcess: () => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string | null) => void;
  setLayoutMode: (mode: "force" | "radial" | "geo" | "3d") => void;
  setViewMode: (mode: "overview" | "all") => void;
  toggleCluster: (clusterId: string) => void;
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
  networkRxBytes: 0,
  networkTxBytes: 0,
  networkRxRate: 0,
  networkTxRate: 0,
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
  isSpeedTestOpen: false,
  isPortInspectorOpen: false,
  portInspectorInitialTab: "table",
  killTarget: null,
  searchQuery: "",
  activeFilter: null,
  layoutMode: "force",
  viewMode: "overview",
  expandedClusters: new Set<string>(),
  graphVersion: 0,
  isElevated: false,

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
  setIsElevated: (isElevated) => set({ isElevated }),

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
  openSpeedTest: () => set({ isSpeedTestOpen: true }),
  closeSpeedTest: () => set({ isSpeedTestOpen: false }),
  openPortInspector: (initialTab) => set({ isPortInspectorOpen: true, portInspectorInitialTab: initialTab ?? "table" }),
  closePortInspector: () => set({ isPortInspectorOpen: false }),
  requestKillProcess: (target) => set({ killTarget: target }),
  closeKillProcess: () => set({ killTarget: null }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveFilter: (filter) =>
    set((s) => ({
      activeFilter: s.activeFilter === filter ? null : filter,
    })),

  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setViewMode: (mode) => set((state) => ({ viewMode: mode, graphVersion: state.graphVersion + 1 })),
  toggleCluster: (clusterId) =>
    set((state) => {
      const next = new Set(state.expandedClusters);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return { expandedClusters: next, graphVersion: state.graphVersion + 1 };
    }),

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
