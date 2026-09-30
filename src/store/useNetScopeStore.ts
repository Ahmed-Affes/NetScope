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
  isCommandPaletteOpen: boolean;
  searchQuery: string;
  activeFilter: string | null;
  layoutMode: "force" | "radial" | "geo" | "3d";
  graphVersion: number;

  // Replay State
  replayProgress: number;
  replayPlaying: boolean;
  replaySpeed: number;

  // Actions
  applyDelta: (delta: GraphDelta) => void;
  setMetrics: (metrics: SystemMetrics) => void;
  selectNode: (id: string | null) => void;
  selectLink: (id: string | null) => void;
  toggleSimPanel: () => void;
  toggleMetrics: () => void;
  toggleLegend: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setTrafficMode: (mode: "simulator" | "live" | "replay") => void;
  toggleRecording: () => void;
  setRecording: (isRecording: boolean) => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string | null) => void;
  setLayoutMode: (mode: "force" | "radial" | "geo" | "3d") => void;
  cleanSimulations: () => void;
  clearGraph: () => void;
  setReplayProgress: (progress: number) => void;
  setReplayPlaying: (playing: boolean) => void;
  setReplaySpeed: (speed: number) => void;
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
  trafficMode: "live",
  isRecording: false,
  recordingSeconds: 0,
  selectedNodeId: null,
  selectedLinkId: null,
  isSimPanelOpen: true, // Visible by default as in user's target UI
  isMetricsOpen: true, // Visible by default
  isLegendOpen: true,  // Visible by default
  isCommandPaletteOpen: false,
  searchQuery: "",
  activeFilter: null,
  layoutMode: "force",
  graphVersion: 0,
  replayProgress: 0,
  replayPlaying: false,
  replaySpeed: 1,

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

  toggleSimPanel: () => set((s) => ({ isSimPanelOpen: !s.isSimPanelOpen })),
  toggleMetrics: () => set((s) => ({ isMetricsOpen: !s.isMetricsOpen })),
  toggleLegend: () => set((s) => ({ isLegendOpen: !s.isLegendOpen })),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

  setTrafficMode: (mode) =>
    set((s) => ({
      trafficMode: mode,
      nodes: {},
      links: {},
      selectedNodeId: null,
      selectedLinkId: null,
      graphVersion: s.graphVersion + 1,
    })),

  toggleRecording: () =>
    set((s) => ({
      isRecording: !s.isRecording,
      recordingSeconds: !s.isRecording ? 0 : s.recordingSeconds,
    })),
  setRecording: (isRecording) =>
    set({
      isRecording,
      recordingSeconds: 0,
    }),


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
        alerts: [], // Clean all alerts when purging simulations
        graphVersion: state.graphVersion + 1,
      };
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

  setReplayProgress: (progress) => set({ replayProgress: progress }),
  setReplayPlaying: (playing) => set({ replayPlaying: playing }),
  setReplaySpeed: (speed) => set({ replaySpeed: speed }),
}));
