import { describe, it, expect, beforeEach } from "vitest";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { GraphDelta, GraphNode, GraphLink } from "../types/graph";

describe("useNetScopeStore", () => {
  beforeEach(() => {
    useNetScopeStore.setState({
      nodes: {},
      links: {},
      alerts: [],
      selectedNodeId: null,
      selectedLinkId: null,
      activeFilter: null,
    });
  });

  it("applies GraphDelta correctly (add, update, remove)", () => {
    const node1: GraphNode = {
      id: "host:local",
      kind: "host",
      label: "Dark Spark",
      firstSeen: 1000,
      lastSeen: 1000,
      bytesIn: 500,
      bytesOut: 1000,
      rateIn: 50,
      rateOut: 100,
    };

    const node2: GraphNode = {
      id: "proc:chrome:1234",
      kind: "process",
      label: "chrome.exe",
      firstSeen: 1000,
      lastSeen: 1000,
      bytesIn: 200,
      bytesOut: 800,
      rateIn: 20,
      rateOut: 80,
    };

    const link1: GraphLink = {
      id: "link:1",
      source: "host:local",
      target: "proc:chrome:1234",
      proto: "tcp",
      port: 443,
      bytesIn: 200,
      bytesOut: 800,
      rate: 100,
      packets: 15,
      firstSeen: 1000,
      lastSeen: 1000,
    };

    const deltaAdd: GraphDelta = {
      t: 1000,
      addNodes: [node1, node2],
      updateNodes: [],
      removeNodeIds: [],
      addLinks: [link1],
      updateLinks: [],
      removeLinkIds: [],
    };

    useNetScopeStore.getState().applyDelta(deltaAdd);

    const state = useNetScopeStore.getState();
    expect(Object.keys(state.nodes)).toHaveLength(2);
    expect(state.nodes["host:local"]?.label).toBe("Dark Spark");
    expect(Object.keys(state.links)).toHaveLength(1);

    // Test update
    const deltaUpdate: GraphDelta = {
      t: 2000,
      addNodes: [],
      updateNodes: [
        {
          id: "host:local",
          bytesIn: 1500,
          rateIn: 150,
        },
      ],
      removeNodeIds: [],
      addLinks: [],
      updateLinks: [
        {
          id: "link:1",
          rate: 250,
        },
      ],
      removeLinkIds: [],
    };

    useNetScopeStore.getState().applyDelta(deltaUpdate);
    const updatedState = useNetScopeStore.getState();
    expect(updatedState.nodes["host:local"]?.bytesIn).toBe(1500);
    expect(updatedState.nodes["host:local"]?.rateIn).toBe(150);
    expect(updatedState.links["link:1"]?.rate).toBe(250);

    // Test remove
    const deltaRemove: GraphDelta = {
      t: 3000,
      addNodes: [],
      updateNodes: [],
      removeNodeIds: ["proc:chrome:1234"],
      addLinks: [],
      updateLinks: [],
      removeLinkIds: ["link:1"],
    };

    useNetScopeStore.getState().applyDelta(deltaRemove);
    const finalState = useNetScopeStore.getState();
    expect(Object.keys(finalState.nodes)).toHaveLength(1);
    expect(finalState.nodes["proc:chrome:1234"]).toBeUndefined();
    expect(Object.keys(finalState.links)).toHaveLength(0);
  });

  it("clears graph state properly", () => {
    const normalNode: GraphNode = {
      id: "host:local",
      kind: "host",
      label: "Host",
      firstSeen: 1000,
      lastSeen: 1000,
      bytesIn: 0,
      bytesOut: 0,
      rateIn: 0,
      rateOut: 0,
    };

    const threatNode: GraphNode = {
      id: "threat:detected1",
      kind: "threat",
      label: "c2-darkcomet.evil",
      firstSeen: 1000,
      lastSeen: 1000,
      bytesIn: 0,
      bytesOut: 0,
      rateIn: 0,
      rateOut: 0,
    };

    useNetScopeStore.setState({
      nodes: {
        "host:local": normalNode,
        "threat:detected1": threatNode,
      },
      alerts: [
        {
          id: "alert:1",
          timestamp: 1000,
          severity: "high",
          rule: "Detected C2 Callback",
          description: "Malware connection",
          acked: false,
        },
      ],
    });

    useNetScopeStore.getState().clearGraph();
    const state = useNetScopeStore.getState();
    expect(Object.keys(state.nodes)).toHaveLength(0);
    expect(state.alerts).toHaveLength(0);
  });
});
