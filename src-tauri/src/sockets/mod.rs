pub mod classification;
pub mod discovery;
pub mod etw;

use crate::events::DeltaPayload;
use crate::model::{
    GraphDelta, GraphLink, GraphNode, LinkUpdate, NodeKind, NodeUpdate, SocketInfo,
};
use crate::threats::ThreatEngine;
use classification::{
    classify_ip_with_gateways, classify_service, discover_default_gateways, is_monitor_service,
};
use discovery::{sweep_local_subnet, DnsResolver, LanDevice};
use etw::EtwTrafficTracker;
use netstat2::{
    get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState,
};
use std::collections::{HashMap, HashSet};
use std::net::{IpAddr, Ipv4Addr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use sysinfo::{Pid, System};
use tauri::{AppHandle, Emitter};

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Clone, Debug)]
pub struct SocketEntry {
    pub proto: String,
    pub local_ip: String,
    pub local_port: u16,
    pub remote_ip: String,
    pub remote_port: u16,
    pub state: String,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub exe_path: Option<String>,
}

pub struct SocketPoller {
    system: System,
    proc_cache: HashMap<u32, (Option<String>, Option<String>)>,
    last_proc_refresh: u64,
    last_arp_refresh: u64,
    cached_gateways: HashSet<IpAddr>,
    cached_lan_devices: Arc<Mutex<Vec<LanDevice>>>,
    lan_sweep_in_progress: Arc<std::sync::atomic::AtomicBool>,
    dns_resolver: DnsResolver,
    threat_engine: ThreatEngine,
    etw_tracker: EtwTrafficTracker,
    previous_nodes: HashMap<String, GraphNode>,
    previous_links: HashMap<String, GraphLink>,
    is_elevated: bool,
    local_ipv4: Option<Ipv4Addr>,
}

impl SocketPoller {
    pub fn new(is_elevated: bool) -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        let cached_gateways = discover_default_gateways();
        let etw_tracker = EtwTrafficTracker::new(is_elevated);

        let mut threat_engine = ThreatEngine::new();
        threat_engine.set_elevated(is_elevated);

        // Find primary local IPv4
        let local_ipv4 = if let Ok(iface) = default_net::get_default_interface() {
            iface.ipv4.first().map(|ip| ip.addr)
        } else {
            None
        };

        let mut poller = Self {
            system,
            proc_cache: HashMap::new(),
            last_proc_refresh: now_ms(),
            last_arp_refresh: 0,
            cached_gateways,
            cached_lan_devices: Arc::new(Mutex::new(Vec::new())),
            lan_sweep_in_progress: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            dns_resolver: DnsResolver::new(),
            threat_engine,
            etw_tracker,
            previous_nodes: HashMap::new(),
            previous_links: HashMap::new(),
            is_elevated,
            local_ipv4,
        };

        // Populate initial baseline
        let _ = poller.poll_and_compute_delta();
        poller
    }

    pub fn refresh_processes_if_needed(&mut self) {
        let now = now_ms();
        if now.saturating_sub(self.last_proc_refresh) > 5_000 {
            self.system
                .refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            self.last_proc_refresh = now;
        }
    }

    pub fn get_process_info(&mut self, pid: u32) -> (Option<String>, Option<String>) {
        if let Some(cached) = self.proc_cache.get(&pid) {
            return cached.clone();
        }

        if let Some(proc) = self.system.process(Pid::from(pid as usize)) {
            let name = proc.name().to_string_lossy().to_string();
            let path = proc.exe().map(|p| p.to_string_lossy().to_string());
            let info = (Some(name), path);
            self.proc_cache.insert(pid, info.clone());
            info
        } else {
            (None, None)
        }
    }

    /// Native Windows socket scan using GetExtendedTcpTable / GetExtendedUdpTable via netstat2
    pub fn scan_sockets(&mut self) -> Vec<SocketEntry> {
        self.refresh_processes_if_needed();
        let mut entries = Vec::new();

        let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
        let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;

        if let Ok(sockets) = get_sockets_info(af_flags, proto_flags) {
            for s in sockets {
                match s.protocol_socket_info {
                    ProtocolSocketInfo::Tcp(tcp) => {
                        let state_str = match tcp.state {
                            TcpState::Listen => "LISTENING",
                            TcpState::Established => "ESTABLISHED",
                            TcpState::SynSent => "SYN_SENT",
                            TcpState::SynReceived => "SYN_RCVD",
                            TcpState::FinWait1 => "FIN_WAIT_1",
                            TcpState::FinWait2 => "FIN_WAIT_2",
                            TcpState::TimeWait => "TIME_WAIT",
                            TcpState::Closed => "CLOSED",
                            TcpState::CloseWait => "CLOSE_WAIT",
                            TcpState::LastAck => "LAST_ACK",
                            TcpState::Closing => "CLOSING",
                            _ => "UNKNOWN",
                        };

                        if s.associated_pids.is_empty() {
                            entries.push(SocketEntry {
                                proto: "tcp".into(),
                                local_ip: tcp.local_addr.to_string(),
                                local_port: tcp.local_port,
                                remote_ip: tcp.remote_addr.to_string(),
                                remote_port: tcp.remote_port,
                                state: state_str.to_string(),
                                pid: None,
                                process_name: None,
                                exe_path: None,
                            });
                        } else {
                            for &pid in &s.associated_pids {
                                let (name, exe) = self.get_process_info(pid);
                                entries.push(SocketEntry {
                                    proto: "tcp".into(),
                                    local_ip: tcp.local_addr.to_string(),
                                    local_port: tcp.local_port,
                                    remote_ip: tcp.remote_addr.to_string(),
                                    remote_port: tcp.remote_port,
                                    state: state_str.to_string(),
                                    pid: Some(pid),
                                    process_name: name,
                                    exe_path: exe,
                                });
                            }
                        }
                    }
                    ProtocolSocketInfo::Udp(udp) => {
                        if s.associated_pids.is_empty() {
                            entries.push(SocketEntry {
                                proto: "udp".into(),
                                local_ip: udp.local_addr.to_string(),
                                local_port: udp.local_port,
                                remote_ip: "*".into(),
                                remote_port: 0,
                                state: "LISTENING".into(),
                                pid: None,
                                process_name: None,
                                exe_path: None,
                            });
                        } else {
                            for &pid in &s.associated_pids {
                                let (name, exe) = self.get_process_info(pid);
                                entries.push(SocketEntry {
                                    proto: "udp".into(),
                                    local_ip: udp.local_addr.to_string(),
                                    local_port: udp.local_port,
                                    remote_ip: "*".into(),
                                    remote_port: 0,
                                    state: "LISTENING".into(),
                                    pid: Some(pid),
                                    process_name: name,
                                    exe_path: exe,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Sort: LISTENING first, then ESTABLISHED, then by local port
        entries.sort_by(|a, b| {
            let order_a = match a.state.as_str() {
                "LISTENING" => 0,
                "ESTABLISHED" => 1,
                _ => 2,
            };
            let order_b = match b.state.as_str() {
                "LISTENING" => 0,
                "ESTABLISHED" => 1,
                _ => 2,
            };
            order_a
                .cmp(&order_b)
                .then_with(|| a.local_port.cmp(&b.local_port))
        });

        entries
    }

    /// Discovers active LAN devices using light SendARP sweep + reverse DNS.
    /// Runs asynchronously in a background thread so the 1 Hz poller never stalls.
    pub fn scan_lan_neighbors(&mut self) -> Vec<LanDevice> {
        let now = now_ms();
        let should_sweep = now.saturating_sub(self.last_arp_refresh) >= 180_000
            || self.last_arp_refresh == 0;

        if should_sweep && !self.lan_sweep_in_progress.load(std::sync::atomic::Ordering::Relaxed) {
            if let Some(local_ip) = self.local_ipv4 {
                self.last_arp_refresh = now;
                self.lan_sweep_in_progress.store(true, std::sync::atomic::Ordering::Relaxed);
                let flag = self.lan_sweep_in_progress.clone();
                let cache_arc = self.cached_lan_devices.clone();
                let dns = self.dns_resolver.clone();
                std::thread::Builder::new()
                    .name("netscope-lan-sweep".into())
                    .spawn(move || {
                        let mut discovered = sweep_local_subnet(local_ip);
                        for dev in &mut discovered {
                            if let Some(name) = dns.get_or_resolve(&dev.ip) {
                                dev.hostname = Some(name);
                            }
                        }
                        if let Ok(mut guard) = cache_arc.lock() {
                            *guard = discovered;
                        }
                        flag.store(false, std::sync::atomic::Ordering::Relaxed);
                    })
                    .ok();
            }
        }

        self.cached_lan_devices.lock().map(|g| g.clone()).unwrap_or_default()
    }

    pub fn poll_and_compute_delta(&mut self) -> GraphDelta {
        let entries = self.scan_sockets();
        let now = now_ms();

        // Refresh gateways periodically (every 60s)
        if self.cached_gateways.is_empty() {
            self.cached_gateways = discover_default_gateways();
        }

        let mut current_nodes: HashMap<String, GraphNode> = HashMap::new();
        let mut current_links: HashMap<String, GraphLink> = HashMap::new();

        // 1. Host Node ("This PC")
        let host_id = "host:local".to_string();
        let host_name = System::host_name().unwrap_or_else(|| "This PC".into());

        current_nodes.insert(
            host_id.clone(),
            GraphNode {
                id: host_id.clone(),
                kind: NodeKind::Host,
                label: host_name,
                pid: None,
                exe_path: None,
                ip: Some("127.0.0.1".into()),
                hostname: Some("localhost".into()),
                country: None,
                asn: None,
                org: None,
                first_seen: now,
                last_seen: now,
                bytes_in: 0,
                bytes_out: 0,
                rate_in: 0.0,
                rate_out: 0.0,
                threat: None,
            },
        );

        // 2. Discover Real Default Gateway(s)
        for gw_ip in &self.cached_gateways {
            let gw_id = format!("gateway:{}", gw_ip);
            current_nodes.entry(gw_id.clone()).or_insert_with(|| {
                GraphNode {
                    id: gw_id.clone(),
                    kind: NodeKind::Gateway,
                    label: format!("Gateway ({})", gw_ip),
                    pid: None,
                    exe_path: None,
                    ip: Some(gw_ip.to_string()),
                    hostname: Some("Default Gateway".into()),
                    country: None,
                    asn: None,
                    org: None,
                    first_seen: now,
                    last_seen: now,
                    bytes_in: 0,
                    bytes_out: 0,
                    rate_in: 0.0,
                    rate_out: 0.0,
                    threat: None,
                }
            });

            let gw_link_id = format!("link:{}->{}", host_id, gw_id);
            current_links.entry(gw_link_id.clone()).or_insert_with(|| {
                GraphLink {
                    id: gw_link_id,
                    source: host_id.clone(),
                    target: gw_id,
                    proto: "ip".into(),
                    port: 0,
                    service: Some("Routing Gateway".into()),
                    bytes_in: 0,
                    bytes_out: 0,
                    rate: 0.0,
                    packets: 0,
                    state: Some("CONNECTED".into()),
                    first_seen: now,
                    last_seen: now,
                }
            });
        }

        // 3. Add Discovered LAN Devices
        let lan_devs = self.scan_lan_neighbors();
        for dev in lan_devs {
            let dev_id = format!("lan:{}", dev.ip);
            let dev_label = dev
                .hostname
                .as_deref()
                .or(dev.vendor.as_deref())
                .map(|s| format!("{} ({})", s, dev.ip))
                .unwrap_or_else(|| dev.ip.clone());

            current_nodes.entry(dev_id.clone()).or_insert_with(|| {
                GraphNode {
                    id: dev_id.clone(),
                    kind: NodeKind::Lan,
                    label: dev_label,
                    pid: None,
                    exe_path: None,
                    ip: Some(dev.ip.clone()),
                    hostname: dev.hostname.clone(),
                    country: None,
                    asn: None,
                    org: dev.vendor.clone(),
                    first_seen: dev.last_seen,
                    last_seen: now,
                    bytes_in: 0,
                    bytes_out: 0,
                    rate_in: 0.0,
                    rate_out: 0.0,
                    threat: None,
                }
            });

            let lan_link_id = format!("link:{}->{}", host_id, dev_id);
            current_links.entry(lan_link_id.clone()).or_insert_with(|| {
                GraphLink {
                    id: lan_link_id,
                    source: host_id.clone(),
                    target: dev_id,
                    proto: "arp".into(),
                    port: 0,
                    service: dev.vendor.clone().or_else(|| Some("LAN Host".into())),
                    bytes_in: 0,
                    bytes_out: 0,
                    rate: 0.0,
                    packets: 1,
                    state: Some("REACHABLE".into()),
                    first_seen: now,
                    last_seen: now,
                }
            });
        }

        // 4. Map of Listening Services: port -> (service_node_id, proc_id, friendly_name)
        // This is crucial for Phase 1.2: correlating local clients to local listeners!
        let mut listeners: HashMap<u16, (String, String, Option<String>)> = HashMap::new();
        let mut listening_tuples = Vec::new();

        for entry in &entries {
            if entry.state == "LISTENING" && entry.local_port > 0 {
                let proc_label = entry
                    .process_name
                    .clone()
                    .unwrap_or_else(|| format!("PID:{}", entry.pid.unwrap_or(0)));
                let proc_id = format!("proc:{}:{}", proc_label, entry.pid.unwrap_or(0));
                let s_name = classify_service(entry.local_port);

                listening_tuples.push((
                    entry.local_ip.clone(),
                    entry.local_port,
                    entry.process_name.clone(),
                    entry.pid,
                ));

                let service_id = format!("service:{}:{}", entry.proto.to_lowercase(), entry.local_port);
                listeners.insert(entry.local_port, (service_id, proc_id, s_name));
            }
        }

        // Harvest Tier B ETW metrics if active
        let etw_metrics = if self.is_elevated {
            self.etw_tracker.harvest_and_reset_rates()
        } else {
            HashMap::new()
        };

        // 5. Process entries: build Process Nodes, Listening Services, and Links
        for entry in &entries {
            let proc_label = entry
                .process_name
                .clone()
                .unwrap_or_else(|| format!("PID:{}", entry.pid.unwrap_or(0)));
            let proc_id = format!("proc:{}:{}", proc_label, entry.pid.unwrap_or(0));

            let (bytes_in, bytes_out, rate_in, rate_out) = if let Some(pid) = entry.pid {
                if let Some(&(bi, bo, ri, ro)) = etw_metrics.get(&pid) {
                    (bi, bo, ri, ro)
                } else {
                    (0, 0, 0.0, 0.0)
                }
            } else {
                (0, 0, 0.0, 0.0)
            };

            // Process node
            current_nodes.entry(proc_id.clone()).or_insert_with(|| {
                GraphNode {
                    id: proc_id.clone(),
                    kind: NodeKind::Process,
                    label: proc_label.clone(),
                    pid: entry.pid,
                    exe_path: entry.exe_path.clone(),
                    ip: Some(entry.local_ip.clone()),
                    hostname: None,
                    country: None,
                    asn: None,
                    org: None,
                    first_seen: now,
                    last_seen: now,
                    bytes_in,
                    bytes_out,
                    rate_in,
                    rate_out,
                    threat: None,
                }
            });

            // Link host -> process
            let host_proc_link_id = format!("link:{}->{}", host_id, proc_id);
            let s_local = classify_service(entry.local_port);
            current_links
                .entry(host_proc_link_id.clone())
                .or_insert_with(|| GraphLink {
                    id: host_proc_link_id,
                    source: host_id.clone(),
                    target: proc_id.clone(),
                    proto: entry.proto.clone(),
                    port: entry.local_port,
                    service: s_local.clone(),
                    bytes_in,
                    bytes_out,
                    rate: rate_in + rate_out,
                    packets: 0,
                    state: Some(entry.state.clone()),
                    first_seen: now,
                    last_seen: now,
                });

            // 6. First-class Service node for LISTENING sockets
            if entry.state == "LISTENING" && entry.local_port > 0 {
                let service_id = format!("service:{}:{}", entry.proto.to_lowercase(), entry.local_port);
                let friendly_service = classify_service(entry.local_port);
                let service_label = if let Some(ref s) = friendly_service {
                    format!("{} (: {})", s, entry.local_port)
                } else {
                    format!(":{}", entry.local_port)
                };

                // Classify as Monitor if it's an observability service, otherwise Port
                let node_kind = if is_monitor_service(entry.local_port) {
                    NodeKind::Monitor
                } else {
                    NodeKind::Port
                };

                current_nodes.entry(service_id.clone()).or_insert_with(|| {
                    GraphNode {
                        id: service_id.clone(),
                        kind: node_kind,
                        label: service_label,
                        pid: entry.pid,
                        exe_path: entry.exe_path.clone(),
                        ip: Some(entry.local_ip.clone()),
                        hostname: None,
                        country: None,
                        asn: None,
                        org: None,
                        first_seen: now,
                        last_seen: now,
                        bytes_in: 0,
                        bytes_out: 0,
                        rate_in: 0.0,
                        rate_out: 0.0,
                        threat: None,
                    }
                });

                // Link process -> service node
                let proc_service_link = format!("link:{}->{}", proc_id, service_id);
                current_links
                    .entry(proc_service_link.clone())
                    .or_insert_with(|| GraphLink {
                        id: proc_service_link,
                        source: proc_id.clone(),
                        target: service_id,
                        proto: entry.proto.clone(),
                        port: entry.local_port,
                        service: friendly_service,
                        bytes_in: 0,
                        bytes_out: 0,
                        rate: 0.0,
                        packets: 0,
                        state: Some("LISTENING".into()),
                        first_seen: now,
                        last_seen: now,
                    });
            }

            // 7. Local-to-Local Traffic Correlation (Phase 1.2: NEVER drop loopback/local!)
            let is_local_remote = entry.remote_ip == "127.0.0.1"
                || entry.remote_ip == "::1"
                || entry.remote_ip == "localhost"
                || (self.local_ipv4.is_some() && entry.remote_ip == self.local_ipv4.unwrap().to_string());

            if is_local_remote && entry.state == "ESTABLISHED" && entry.remote_port > 0 {
                // If destination port has a listening service, link client process -> service node!
                let target_node_id = if let Some((srv_id, _, _)) = listeners.get(&entry.remote_port) {
                    srv_id.clone()
                } else {
                    // Create standalone local service target
                    let fallback_id = format!("service:{}:{}", entry.proto.to_lowercase(), entry.remote_port);
                    let s_name = classify_service(entry.remote_port);
                    let s_label = s_name
                        .as_deref()
                        .map(|s| format!("{} (: {})", s, entry.remote_port))
                        .unwrap_or_else(|| format!(":{}", entry.remote_port));

                    current_nodes.entry(fallback_id.clone()).or_insert_with(|| {
                        GraphNode {
                            id: fallback_id.clone(),
                            kind: NodeKind::Port,
                            label: s_label,
                            pid: None,
                            exe_path: None,
                            ip: Some(entry.remote_ip.clone()),
                            hostname: Some("localhost".into()),
                            country: None,
                            asn: None,
                            org: None,
                            first_seen: now,
                            last_seen: now,
                            bytes_in: 0,
                            bytes_out: 0,
                            rate_in: 0.0,
                            rate_out: 0.0,
                            threat: None,
                        }
                    });
                    fallback_id
                };

                let local_link_id = format!("link:{}->{}", proc_id, target_node_id);
                let s_remote = classify_service(entry.remote_port);
                current_links
                    .entry(local_link_id.clone())
                    .or_insert_with(|| GraphLink {
                        id: local_link_id,
                        source: proc_id.clone(),
                        target: target_node_id,
                        proto: entry.proto.clone(),
                        port: entry.remote_port,
                        service: s_remote,
                        bytes_in,
                        bytes_out,
                        rate: rate_in + rate_out,
                        packets: 0,
                        state: Some(entry.state.clone()),
                        first_seen: now,
                        last_seen: now,
                    });
            }

            // 8. Remote Endpoint Nodes for External / Public / Tailscale Traffic
            if !entry.remote_ip.is_empty()
                && entry.remote_ip != "0.0.0.0"
                && entry.remote_ip != "*"
                && !is_local_remote
                && entry.remote_ip != "::"
            {
                let remote_id = format!("ip:{}", entry.remote_ip);
                let remote_kind =
                    classify_ip_with_gateways(&entry.remote_ip, &self.cached_gateways);

                // Async reverse DNS for remote endpoint
                let resolved_hostname = self.dns_resolver.get_or_resolve(&entry.remote_ip);
                let remote_label = resolved_hostname
                    .as_deref()
                    .unwrap_or(&entry.remote_ip)
                    .to_string();

                current_nodes.entry(remote_id.clone()).or_insert_with(|| {
                    GraphNode {
                        id: remote_id.clone(),
                        kind: remote_kind,
                        label: remote_label,
                        pid: None,
                        exe_path: None,
                        ip: Some(entry.remote_ip.clone()),
                        hostname: resolved_hostname,
                        country: None,
                        asn: None,
                        org: None,
                        first_seen: now,
                        last_seen: now,
                        bytes_in,
                        bytes_out,
                        rate_in,
                        rate_out,
                        threat: None,
                    }
                });

                let endpoint_link_id = format!("link:{}->{}", proc_id, remote_id);
                let s_remote = classify_service(entry.remote_port);
                current_links
                    .entry(endpoint_link_id.clone())
                    .or_insert_with(|| GraphLink {
                        id: endpoint_link_id,
                        source: proc_id.clone(),
                        target: remote_id.clone(),
                        proto: entry.proto.clone(),
                        port: entry.remote_port,
                        service: s_remote,
                        bytes_in,
                        bytes_out,
                        rate: rate_in + rate_out,
                        packets: 0,
                        state: Some(entry.state.clone()),
                        first_seen: now,
                        last_seen: now,
                    });
            }
        }

        // 9. Run ThreatEngine
        let all_nodes_vec: Vec<GraphNode> = current_nodes.values().cloned().collect();
        let all_links_vec: Vec<GraphLink> = current_links.values().cloned().collect();
        let alerts = self.threat_engine.evaluate(&all_nodes_vec, &all_links_vec, &listening_tuples);

        // 10. Compute Delta
        let mut add_nodes = Vec::new();
        let mut update_nodes = Vec::new();
        let mut remove_node_ids = Vec::new();

        for (id, node) in &current_nodes {
            if let Some(prev) = self.previous_nodes.get(id) {
                if prev.last_seen != node.last_seen
                    || prev.bytes_in != node.bytes_in
                    || prev.bytes_out != node.bytes_out
                    || prev.rate_in != node.rate_in
                    || prev.rate_out != node.rate_out
                    || prev.hostname != node.hostname
                {
                    update_nodes.push(NodeUpdate {
                        id: id.clone(),
                        bytes_in: Some(node.bytes_in),
                        bytes_out: Some(node.bytes_out),
                        rate_in: Some(node.rate_in),
                        rate_out: Some(node.rate_out),
                        last_seen: Some(node.last_seen),
                        threat: node.threat.clone(),
                    });
                }
            } else {
                add_nodes.push(node.clone());
            }
        }

        for id in self.previous_nodes.keys() {
            if !current_nodes.contains_key(id) {
                remove_node_ids.push(id.clone());
            }
        }

        let mut add_links = Vec::new();
        let mut update_links = Vec::new();
        let mut remove_link_ids = Vec::new();

        for (id, link) in &current_links {
            if let Some(prev) = self.previous_links.get(id) {
                if prev.last_seen != link.last_seen
                    || prev.bytes_in != link.bytes_in
                    || prev.bytes_out != link.bytes_out
                    || prev.rate != link.rate
                    || prev.state != link.state
                {
                    update_links.push(LinkUpdate {
                        id: id.clone(),
                        bytes_in: Some(link.bytes_in),
                        bytes_out: Some(link.bytes_out),
                        rate: Some(link.rate),
                        packets: Some(link.packets),
                        state: link.state.clone(),
                        last_seen: Some(link.last_seen),
                    });
                }
            } else {
                add_links.push(link.clone());
            }
        }

        for id in self.previous_links.keys() {
            if !current_links.contains_key(id) {
                remove_link_ids.push(id.clone());
            }
        }

        self.previous_nodes = current_nodes;
        self.previous_links = current_links;

        GraphDelta {
            t: now,
            add_nodes,
            update_nodes,
            remove_node_ids,
            add_links,
            update_links,
            remove_link_ids,
            alerts: if alerts.is_empty() { None } else { Some(alerts) },
            node_positions: None,
        }
    }

    pub fn get_snapshot(&self) -> (Vec<GraphNode>, Vec<GraphLink>) {
        (
            self.previous_nodes.values().cloned().collect(),
            self.previous_links.values().cloned().collect(),
        )
    }

    pub fn get_active_sockets(&mut self) -> Vec<SocketInfo> {
        let entries = self.scan_sockets();
        entries
            .into_iter()
            .map(|e| {
                let service = classify_service(e.local_port);
                SocketInfo {
                    proto: e.proto,
                    local_ip: e.local_ip,
                    local_port: e.local_port,
                    remote_ip: e.remote_ip,
                    remote_port: e.remote_port,
                    state: e.state,
                    pid: e.pid,
                    process_name: e.process_name,
                    exe_path: e.exe_path,
                    service,
                }
            })
            .collect()
    }
}

/// Spawns the background poller thread pushing 1 Hz deltas via Tauri events.
pub fn start_poller_thread(
    app: AppHandle,
    poller_mutex: Arc<Mutex<SocketPoller>>,
) {
    std::thread::Builder::new()
        .name("netscope-poller".into())
        .spawn(move || {
            tracing::info!("NetScope background socket poller started (target: 1 Hz)");
            loop {
                let start_time = Instant::now();

                // Poll and emit delta
                let delta_opt = {
                    let mut guard = poller_mutex.lock().unwrap_or_else(|e| e.into_inner());
                    let delta = guard.poll_and_compute_delta();
                    let has_changes = !delta.add_nodes.is_empty()
                        || !delta.update_nodes.is_empty()
                        || !delta.remove_node_ids.is_empty()
                        || !delta.add_links.is_empty()
                        || !delta.update_links.is_empty()
                        || !delta.remove_link_ids.is_empty()
                        || delta.alerts.as_ref().is_some_and(|a| !a.is_empty());

                    if has_changes {
                        Some(delta)
                    } else {
                        None
                    }
                };

                if let Some(delta) = delta_opt {
                    let _ = app.emit("delta", DeltaPayload { delta });
                }

                // Adaptive sleep: target 1000ms period
                let elapsed = start_time.elapsed();
                let sleep_duration = if elapsed < Duration::from_millis(1000) {
                    Duration::from_millis(1000) - elapsed
                } else {
                    Duration::from_millis(50) // If poll was slow, yield briefly
                };

                std::thread::sleep(sleep_duration);
            }
        })
        .expect("Failed to spawn netscope-poller thread");
}
