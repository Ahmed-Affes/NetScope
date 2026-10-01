import React, { useEffect, useRef, useState, useMemo } from "react";
import { GraphEngine } from "../graph/GraphEngine";
import { LiveSource } from "../sources/live";
import { TrafficSource, GraphNode, GraphLink } from "../types/graph";
import { useNetScopeStore } from "../store/useNetScopeStore";
import { Activity, Wifi, WifiOff } from "lucide-react";

type LoadState = "loading" | "ok" | "empty";

function extractDomain(hostname?: string): string | null {
  if (!hostname) return null;
  const parts = hostname.toLowerCase().split(".");
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }
  return hostname;
}

function applyOverviewAggregation(
  nodesList: GraphNode[],
  linksList: GraphLink[],
  viewMode: "overview" | "all",
  expandedClusters: Set<string>
): { nodes: GraphNode[]; links: GraphLink[] } {
  if (viewMode === "all") {
    return { nodes: nodesList, links: linksList };
  }

  // In overview mode:
  // 1. Collapse idle listening port nodes so the graph stays calm and clean, highlighting active traffic.
  // Keep port nodes if they have active throughput, security threats, or active/established connections.
  const activePortIds = new Set<string>();
  for (const l of linksList) {
    if (l.state === "ESTABLISHED" || (l.rate && l.rate > 0) || (l.bytesIn && l.bytesIn > 0) || (l.bytesOut && l.bytesOut > 0)) {
      activePortIds.add(l.source);
      activePortIds.add(l.target);
    }
  }

  const nodesToProcess = nodesList.filter((n) => {
    if (n.kind === "port") {
      if (n.threat || activePortIds.has(n.id)) return true;
      const rate = (n.rateIn || 0) + (n.rateOut || 0);
      return rate > 0;
    }
    return true;
  });

  const validNodeIds = new Set(nodesToProcess.map((n) => n.id));
  const candidateLinks = linksList.filter(
    (l) => validNodeIds.has(l.source) && validNodeIds.has(l.target)
  );

  // 2. In overview mode: aggregate remote internet endpoints
  const internetNodes = nodesToProcess.filter((n) => n.kind === "internet");
  const nonInternetNodes = nodesToProcess.filter((n) => n.kind !== "internet");

  // Group internet nodes by org, root domain, or /24 subnet
  const groups = new Map<string, { title: string; nodes: GraphNode[] }>();

  for (const n of internetNodes) {
    let key: string;
    let title: string;

    if (n.org && n.org.trim()) {
      key = `cluster:org:${n.org.trim().toLowerCase()}`;
      title = n.org.trim();
    } else {
      const dom = extractDomain(n.hostname);
      if (dom) {
        key = `cluster:domain:${dom}`;
        title = dom;
      } else if (n.ip) {
        const octets = n.ip.split(".");
        if (octets.length === 4) {
          const subnet = `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
          key = `cluster:subnet:${subnet}`;
          title = `Subnet ${subnet}`;
        } else {
          key = `cluster:ip:${n.ip}`;
          title = n.ip;
        }
      } else {
        key = `cluster:other`;
        title = "External Cloud";
      }
    }

    const cur = groups.get(key) || { title, nodes: [] };
    cur.nodes.push(n);
    groups.set(key, cur);
  }

  const finalNodes: GraphNode[] = [...nonInternetNodes];
  const remappedNodeId = new Map<string, string>(); // oldId -> clusterId
  const singletons: GraphNode[] = [];

  for (const [key, grp] of groups.entries()) {
    // If user expanded this cluster, keep them individual
    if (expandedClusters.has(key)) {
      finalNodes.push(...grp.nodes);
    } else if (grp.nodes.length >= 2) {
      // Create aggregated cluster node
      const members = grp.nodes;
      for (const m of members) {
        remappedNodeId.set(m.id, key);
      }

      const totalBytesIn = members.reduce((sum, m) => sum + (m.bytesIn || 0), 0);
      const totalBytesOut = members.reduce((sum, m) => sum + (m.bytesOut || 0), 0);
      const totalRateIn = members.reduce((sum, m) => sum + (m.rateIn || 0), 0);
      const totalRateOut = members.reduce((sum, m) => sum + (m.rateOut || 0), 0);
      const minFirstSeen = Math.min(...members.map((m) => m.firstSeen || Date.now()));
      const maxLastSeen = Math.max(...members.map((m) => m.lastSeen || Date.now()));

      finalNodes.push({
        id: key,
        kind: "internet",
        label: `${grp.title} (${members.length})`,
        org: grp.title,
        bytesIn: totalBytesIn,
        bytesOut: totalBytesOut,
        rateIn: totalRateIn,
        rateOut: totalRateOut,
        firstSeen: minFirstSeen,
        lastSeen: maxLastSeen,
      });
    } else {
      singletons.push(...grp.nodes);
    }
  }

  // If there are 2 or more solitary external endpoints, cluster them as "External Services"
  const miscKey = "cluster:external:misc";
  if (singletons.length >= 2 && !expandedClusters.has(miscKey)) {
    for (const m of singletons) {
      remappedNodeId.set(m.id, miscKey);
    }
    const totalBytesIn = singletons.reduce((sum, m) => sum + (m.bytesIn || 0), 0);
    const totalBytesOut = singletons.reduce((sum, m) => sum + (m.bytesOut || 0), 0);
    const totalRateIn = singletons.reduce((sum, m) => sum + (m.rateIn || 0), 0);
    const totalRateOut = singletons.reduce((sum, m) => sum + (m.rateOut || 0), 0);
    const minFirstSeen = Math.min(...singletons.map((m) => m.firstSeen || Date.now()));
    const maxLastSeen = Math.max(...singletons.map((m) => m.lastSeen || Date.now()));

    finalNodes.push({
      id: miscKey,
      kind: "internet",
      label: `External Services (${singletons.length})`,
      org: "Various Endpoints",
      bytesIn: totalBytesIn,
      bytesOut: totalBytesOut,
      rateIn: totalRateIn,
      rateOut: totalRateOut,
      firstSeen: minFirstSeen,
      lastSeen: maxLastSeen,
    });
  } else {
    finalNodes.push(...singletons);
  }

  // Rewire and deduplicate links
  const linkKeyMap = new Map<string, GraphLink>();
  for (const l of candidateLinks) {
    const src = remappedNodeId.get(l.source) || l.source;
    const tgt = remappedNodeId.get(l.target) || l.target;

    // Skip self-loops within cluster
    if (src === tgt) continue;

    const dedupeKey = `${src}->${tgt}:${l.port}:${l.proto}`;
    const existing = linkKeyMap.get(dedupeKey);
    if (existing) {
      existing.packets += l.packets;
      existing.bytesIn += l.bytesIn;
      existing.bytesOut += l.bytesOut;
      existing.rate += l.rate;
    } else {
      linkKeyMap.set(dedupeKey, {
        ...l,
        id: `link:${dedupeKey}`,
        source: src,
        target: tgt,
      });
    }
  }

  return { nodes: finalNodes, links: Array.from(linkKeyMap.values()) };
}

function filterTopology(
  nodesList: GraphNode[],
  linksList: GraphLink[],
  activeFilter: string | null,
  searchQuery: string | null
): { filteredNodes: GraphNode[]; filteredLinks: GraphLink[] } {
  let matchedNodes = nodesList;
  let matchedLinks = linksList;

  // 1. Process activeFilter (Node kind or Traffic/Port/Proto)
  if (activeFilter) {
    if (activeFilter.startsWith("port:")) {
      const portNum = parseInt(activeFilter.replace("port:", ""), 10);
      matchedLinks = linksList.filter(
        (l) =>
          l.port === portNum ||
          (portNum === 22 && l.service?.toLowerCase() === "ssh") ||
          (portNum === 80 && l.service?.toLowerCase() === "http") ||
          (portNum === 443 && l.service?.toLowerCase() === "https") ||
          (portNum === 53 && l.service?.toLowerCase() === "dns") ||
          (portNum === 11434 && l.service?.toLowerCase() === "ollama") ||
          (portNum === 7474 && l.service?.toLowerCase() === "neo4j")
      );
      const connectedIds = new Set(matchedLinks.flatMap((l) => [l.source, l.target]));
      matchedNodes = nodesList.filter((n) => connectedIds.has(n.id));
    } else if (activeFilter.startsWith("proto:")) {
      const proto = activeFilter.replace("proto:", "").toLowerCase();
      matchedLinks = linksList.filter((l) => l.proto.toLowerCase() === proto);
      const connectedIds = new Set(matchedLinks.flatMap((l) => [l.source, l.target]));
      matchedNodes = nodesList.filter((n) => connectedIds.has(n.id));
    } else if (activeFilter === "threat") {
      matchedNodes = nodesList.filter((n) => n.kind === "threat" || Boolean(n.threat));
      const visibleIds = new Set(matchedNodes.map((n) => n.id));
      matchedLinks = linksList.filter(
        (l) => visibleIds.has(l.source) && visibleIds.has(l.target)
      );
    } else {
      // Node kind filter (e.g. "host", "gateway", "lan", "process", "docker", "internet", "tailscale", "monitor")
      matchedNodes = nodesList.filter((n) => n.kind === activeFilter);
      const visibleIds = new Set(matchedNodes.map((n) => n.id));
      matchedLinks = linksList.filter(
        (l) => visibleIds.has(l.source) && visibleIds.has(l.target)
      );
    }
  }

  // 2. Process searchQuery (Universal intelligent search for apps, ports, protocols, IPs)
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    const isPortExact = /^\d+$/.test(q) && parseInt(q, 10) > 0 && parseInt(q, 10) <= 65535;
    const queryPort = isPortExact ? parseInt(q, 10) : q.startsWith("port:") ? parseInt(q.replace("port:", ""), 10) : null;
    const queryProto = q.startsWith("proto:") ? q.replace("proto:", "").toLowerCase() : (q === "udp" || q === "tcp" || q === "icmp") ? q : null;

    // Service aliases
    const SERVICE_ALIASES: Record<string, number[]> = {
      https: [443, 8443],
      ssl: [443, 8443],
      tls: [443, 8443, 853],
      http: [80, 8080, 8000, 3000, 5000, 5173],
      web: [80, 443, 8080, 3000, 5173],
      dns: [53, 853],
      ssh: [22],
      ftp: [20, 21],
      rdp: [3389],
      smb: [445, 139],
      webrtc: [3478, 19302],
      stun: [3478, 19302],
      voice: [3478, 19302, 5060, 5061],
      steam: [27015, 27016, 27017, 27018, 27019, 27020, 27036],
      minecraft: [25565],
      mysql: [3306],
      postgres: [5432],
      redis: [6379],
      wireguard: [51820],
      tailscale: [41641],
      ollama: [11434],
      ai: [11434],
      neo4j: [7474, 7687],
      mdns: [5353],
      dhcp: [67, 68],
      ntp: [123],
    };

    const targetServicePorts = SERVICE_ALIASES[q] || [];

    // Find links that directly match the query (port, service, protocol)
    const directlyMatchedLinks = matchedLinks.filter((l) => {
      if (queryPort !== null && l.port === queryPort) return true;
      if (queryProto !== null && l.proto.toLowerCase() === queryProto) return true;
      if (targetServicePorts.includes(l.port)) return true;
      if (l.service && l.service.toLowerCase().includes(q)) return true;
      return false;
    });

    // Find nodes that directly match the query
    const directlyMatchedNodes = matchedNodes.filter((n) => {
      if (queryPort !== null && (n.label.includes(`:${queryPort}`) || n.id.endsWith(`:${queryPort}`) || (n.kind === "port" && n.label.includes(String(queryPort))))) return true;
      if (n.label.toLowerCase().includes(q)) return true;
      if (n.id.toLowerCase().includes(q)) return true;
      if (n.exePath && n.exePath.toLowerCase().includes(q)) return true;
      if (n.ip && n.ip.toLowerCase().includes(q)) return true;
      if (n.hostname && n.hostname.toLowerCase().includes(q)) return true;
      if (n.country && n.country.toLowerCase().includes(q)) return true;
      if (n.asn && n.asn.toLowerCase().includes(q)) return true;
      if (n.org && n.org.toLowerCase().includes(q)) return true;
      if (n.pid !== undefined && String(n.pid).includes(q)) return true;

      if ((q === "port" || q === "ports" || q === "socket" || q === "sockets" || q === "listen" || q === "listening") && n.kind === "port") return true;
      if ((q === "router" || q === "gateway" || q === "modem") && n.kind === "gateway") return true;
      if ((q === "pc" || q === "host" || q === "computer" || q === "laptop" || q === "desktop" || q === "me") && n.kind === "host") return true;
      if ((q === "lan" || q === "device" || q === "devices" || q === "wifi") && n.kind === "lan") return true;
      if ((q === "process" || q === "app" || q === "apps" || q === "program" || q === "exe") && n.kind === "process") return true;
      if (q === "docker" && n.kind === "docker") return true;
      if ((q === "internet" || q === "remote" || q === "external" || q === "wan") && n.kind === "internet") return true;
      if ((q === "threat" || q === "threats" || q === "anomaly" || q === "suspicious" || q === "danger" || q === "warning") && (n.kind === "threat" || Boolean(n.threat))) return true;

      return false;
    });

    const matchedNodeIdSet = new Set(directlyMatchedNodes.map((n) => n.id));
    const finalLinkSet = new Set<GraphLink>(directlyMatchedLinks);
    const finalNodeIdSet = new Set<string>(matchedNodeIdSet);

    // Include endpoints of directly matched links
    for (const link of directlyMatchedLinks) {
      finalNodeIdSet.add(link.source);
      finalNodeIdSet.add(link.target);
    }

    // 2-hop connected graph expansion so the complete chain (Host -> App -> Port -> Remote IP) is rendered
    for (let hop = 0; hop < 2; hop++) {
      const currentNodes = new Set(finalNodeIdSet);
      for (const link of matchedLinks) {
        if (currentNodes.has(link.source) || currentNodes.has(link.target)) {
          finalLinkSet.add(link);
          finalNodeIdSet.add(link.source);
          finalNodeIdSet.add(link.target);
        }
      }
    }

    // If any process, port, or LAN device matched, also keep host:local for topological context
    if (finalNodeIdSet.size > 0 && matchedNodes.some((n) => n.id === "host:local")) {
      finalNodeIdSet.add("host:local");
    }

    const finalNodes = matchedNodes.filter((n) => finalNodeIdSet.has(n.id));
    const visibleIds = new Set(finalNodes.map((n) => n.id));
    const finalLinks = Array.from(finalLinkSet).filter(
      (l) => visibleIds.has(l.source) && visibleIds.has(l.target)
    );

    return { filteredNodes: finalNodes, filteredLinks: finalLinks };
  }

  return { filteredNodes: matchedNodes, filteredLinks: matchedLinks };
}

export const GraphCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const sourceRef = useRef<TrafficSource | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("loading");

  const {
    selectNode,
    selectLink,
    selectedNodeId,
    applyDelta,
    layoutMode,
    viewMode,
    expandedClusters,
    toggleCluster,
    activeFilter,
    searchQuery,
    graphVersion,
    links,
  } = useNetScopeStore();

  // Compute top active services from all unfiltered links for quick recovery in empty state
  const activeServiceSuggestions = useMemo(() => {
    const allLinks = Object.values(links);
    const serviceCounts = new Map<string, { label: string; filter: string; count: number }>();
    for (const l of allLinks) {
      if (l.port && l.port > 0) {
        const label = l.service ? `${l.service.toUpperCase()} (${l.port})` : `Port ${l.port}`;
        const filter = `port:${l.port}`;
        const cur = serviceCounts.get(filter) || { label, filter, count: 0 };
        cur.count += 1;
        serviceCounts.set(filter, cur);
      }
    }
    return Array.from(serviceCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [links]);

  // Sync selectedNodeId with engine for LOD highlighting
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSelectedNode(selectedNodeId);
    }
  }, [selectedNodeId]);

  // Initialize Engine & Source once
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    setLoadState("loading");

    const engine = new GraphEngine(containerRef.current, {
      onSelectNode: (id) => {
        if (id && id.startsWith("cluster:")) {
          toggleCluster(id);
        }
        selectNode(id);
      },
      onSelectLink: (id) => selectLink(id),
    });
    engineRef.current = engine;

    const source: TrafficSource = new LiveSource();
    sourceRef.current = source;

    engine.init().then(async () => {
      if (!mounted) return;

      // Seed initial snapshot
      const snapshot = await source.snapshot();
      if (!mounted) return;

      applyDelta({
        t: Date.now(),
        addNodes: snapshot.nodes,
        updateNodes: [],
        removeNodeIds: [],
        addLinks: snapshot.links,
        updateLinks: [],
        removeLinkIds: [],
      });

      const currentStore = useNetScopeStore.getState();
      const { filteredNodes, filteredLinks } = filterTopology(
        snapshot.nodes,
        snapshot.links,
        currentStore.activeFilter,
        currentStore.searchQuery
      );

      const aggregated = applyOverviewAggregation(
        filteredNodes,
        filteredLinks,
        currentStore.viewMode,
        currentStore.expandedClusters
      );

      engine.updateGraph(aggregated.nodes, aggregated.links, currentStore.layoutMode);

      const hasConstraint = Boolean(
        currentStore.activeFilter ||
          (currentStore.searchQuery && currentStore.searchQuery.trim())
      );
      const activeCount = hasConstraint ? aggregated.nodes.length : snapshot.nodes.length;
      setLoadState(activeCount === 0 ? "empty" : "ok");

      // Subscribe to deltas
      source.onDelta((delta) => {
        if (!mounted) return;
        applyDelta(delta);

        const storeNow = useNetScopeStore.getState();
        const nodesList = Object.values(storeNow.nodes);
        const linksList = Object.values(storeNow.links);

        const { filteredNodes: nextNodes, filteredLinks: nextLinks } = filterTopology(
          nodesList,
          linksList,
          storeNow.activeFilter,
          storeNow.searchQuery
        );

        const nextAggregated = applyOverviewAggregation(
          nextNodes,
          nextLinks,
          storeNow.viewMode,
          storeNow.expandedClusters
        );

        const constraintNow = Boolean(
          storeNow.activeFilter ||
            (storeNow.searchQuery && storeNow.searchQuery.trim())
        );
        const countNow = constraintNow ? nextAggregated.nodes.length : nodesList.length;
        setLoadState(countNow === 0 ? "empty" : "ok");

        engine.updateGraph(
          nextAggregated.nodes,
          nextAggregated.links,
          storeNow.layoutMode,
          delta.nodePositions
        );
      });

      source.start();
    });

    return () => {
      mounted = false;
      source.stop();
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyDelta, selectNode, selectLink, toggleCluster]);

  // Handle smooth layout mode, filter, and store delta transitions reactively
  useEffect(() => {
    if (engineRef.current) {
      const currentStore = useNetScopeStore.getState();
      const nodesList = Object.values(currentStore.nodes);
      const linksList = Object.values(currentStore.links);

      const { filteredNodes, filteredLinks } = filterTopology(
        nodesList,
        linksList,
        activeFilter,
        searchQuery
      );

      const aggregated = applyOverviewAggregation(
        filteredNodes,
        filteredLinks,
        viewMode,
        expandedClusters
      );

      const hasConstraint = Boolean(
        activeFilter || (searchQuery && searchQuery.trim())
      );
      const activeCount = hasConstraint ? aggregated.nodes.length : nodesList.length;
      setLoadState(activeCount === 0 ? "empty" : "ok");

      engineRef.current.updateGraph(aggregated.nodes, aggregated.links, layoutMode);
    }
  }, [layoutMode, viewMode, expandedClusters, activeFilter, searchQuery, graphVersion]);

  return (
    <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
      {/* WebGL canvas layer */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Loading state */}
      {loadState === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 bg-[#0b1120]/80 backdrop-blur-sm border border-cyan-500/20 rounded-xl px-8 py-6 shadow-[0_0_40px_rgba(34,211,238,0.1)]">
            <Activity className="w-7 h-7 text-cyan-400 animate-pulse" />
            <p className="text-cyan-300 text-sm font-mono tracking-wider">
              SCANNING PC SOCKETS & ARP TABLE...
            </p>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty / Zero-filter recovery state */}
      {loadState === "empty" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 bg-[#0b1120]/95 backdrop-blur-md border border-slate-700/60 rounded-xl px-8 py-7 shadow-2xl max-w-md text-center pointer-events-auto">
            {activeFilter || (searchQuery && searchQuery.trim()) ? (
              <>
                <Wifi className="w-9 h-9 text-cyan-500/70" />
                <div className="space-y-1.5">
                  <p className="text-slate-200 font-bold text-sm tracking-wider uppercase">
                    No Nodes Match Filter
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
                    {activeFilter?.startsWith("port:")
                      ? `No traffic matching ${activeFilter} is active on your PC right now.`
                      : activeFilter
                      ? `No active "${activeFilter}" nodes in your topology.`
                      : `No nodes match "${searchQuery}".`}
                  </p>

                  {activeServiceSuggestions.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] text-slate-400 mb-2 font-mono">
                        {activeServiceSuggestions.length} services active right now:
                      </p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {activeServiceSuggestions.map((s) => (
                          <button
                            key={s.filter}
                            onClick={() => {
                              useNetScopeStore.getState().setActiveFilter(s.filter);
                              useNetScopeStore.getState().setSearchQuery("");
                            }}
                            className="px-2.5 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <span>{s.label}</span>
                            <span className="text-[10px] text-cyan-400/80 font-bold">
                              ({s.count})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      useNetScopeStore.getState().setActiveFilter(null);
                      useNetScopeStore.getState().setSearchQuery("");
                    }}
                    className="px-4 py-1.5 text-xs rounded bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-slate-300 hover:text-white transition-colors cursor-pointer font-semibold shadow-sm"
                  >
                    Clear Filter
                  </button>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="w-10 h-10 text-amber-400 opacity-80" />
                <div>
                  <p className="text-amber-300 font-semibold text-sm tracking-wider mb-1">
                    NO LIVE DATA DETECTED
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    NetScope is scanning active network sockets and ARP cache.
                  </p>
                  <ul className="text-slate-500 text-xs mt-2 space-y-1 text-left list-disc list-inside">
                    <li>Open a browser tab or network application</li>
                    <li>
                      <span className="text-amber-400/80">Run as Administrator</span> for full
                      process attribution
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
