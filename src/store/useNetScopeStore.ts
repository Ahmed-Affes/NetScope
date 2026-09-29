import { create } from "zustand";
import { Alert, GraphDelta, GraphLink, GraphNode, SystemMetrics } from "../types/graph";

interface NetScopeState {
  nodes: Record<string, GraphNode>;
  links: Record<string, GraphLink>;
  metrics: SystemMetrics;
  alerts: Alert[];
  trafficMode: "simulator" | "live" | "replay";
  isRecording: boolean;
  recordingSeconds: number;
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  isSimPanelOpen: boolean;
  isMetricsOpen: boolean;
  isLegendOpen: boolean;
  searchQuery: string;
  activeFilter: string | null;
  layoutMode: "force" | "radial" | "geo" | "3d";

  // Actions
  applyDelta: (delta: GraphDelta) => void;
  setMetrics: (metrics: SystemMetrics) => void;
  selectNode: (id: string | null) => void;
  selectLink: (id: string | null) => void;
  toggleSimPanel: () => void;
  toggleMetrics: () => void;
  toggleLegend: () => void;
  setTrafficMode: (mode: "simulator" | "live" | "replay") => void;
  toggleRecording: () => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string | null) => void;
  setLayoutMode: (mode: "force" | "radial" | "geo" | "3d") => void;
  cleanSimulations: () => void;
}

const initialMetrics: SystemMetrics = {
  cpuUsage: 6.4,
  ramUsedBytes: 78_600_000_000,
  ramTotalBytes: 121_700_000_000,
  ramUsagePercent: 66.6,
  gpuUsage: 2.0,
  gpuTemp: 49.0,
  diskFreeBytes: 1_571_100_000_000,
  diskTotalBytes: 3_560_000_000_000,
  diskUsagePercent: 55.9,
  dockerContainers: 17,
};

export const useNetScopeStore = create<NetScopeState>((set) => ({
  nodes: {},
  links: {},
  metrics: initialMetrics,
  alerts: [],
  trafficMode: "simulator",
  isRecording: false,
  recordingSeconds: 0,
  selectedNodeId: null,
  selectedLinkId: null,
  isSimPanelOpen: true, // Visible by default as in user's target UI
  isMetricsOpen: true, // Visible by default
  isLegendOpen: true,  // Visible by default
  searchQuery: "",
  activeFilter: null,
  layoutMode: "force",

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

      return {
        nodes: nextNodes,
        links: nextLinks,
        alerts: nextAlerts,
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

  toggleSimPanel: () => set((s) => ({ isSimPanelOpen: !s.isSimPanelOpen })),
  toggleMetrics: () => set((s) => ({ isMetricsOpen: !s.isMetricsOpen })),
  toggleLegend: () => set((s) => ({ isLegendOpen: !s.isLegendOpen })),

  setTrafficMode: (mode) => set({ trafficMode: mode }),

  toggleRecording: () =>
    set((s) => ({
      isRecording: !s.isRecording,
      recordingSeconds: !s.isRecording ? 0 : s.recordingSeconds,
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveFilter: (filter) =>
    set((s) => ({
      activeFilter: s.activeFilter === filter ? null : filter,
    })),

  setLayoutMode: (mode) => set({ layoutMode: mode }),

  cleanSimulations: () =>
    set((state) => {
      const nextNodes: Record<string, GraphNode> = {};
      for (const [id, node] of Object.entries(state.nodes)) {
        if (node.kind !== "threat") {
          nextNodes[id] = node;
        }
      }

      const nextLinks: Record<string, GraphLink> = {};
      for (const [id, link] of Object.entries(state.links)) {
        if (nextNodes[link.source] && nextNodes[link.target]) {
          nextLinks[id] = link;
        }
      }

      return {
        nodes: nextNodes,
        links: nextLinks,
        alerts: state.alerts.filter((a) => !a.rule.toLowerCase().includes("simulated")),
      };
    }),
}));
