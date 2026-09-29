use crate::model::{GraphDelta, GraphLink, GraphNode, LinkUpdate, NodeKind, NodeUpdate};
use std::collections::HashMap;
use std::net::IpAddr;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::{Pid, System};

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
    previous_nodes: HashMap<String, GraphNode>,
    previous_links: HashMap<String, GraphLink>,
}

impl Default for SocketPoller {
    fn default() -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        Self {
            system,
            previous_nodes: HashMap::new(),
            previous_links: HashMap::new(),
        }
    }
}

impl SocketPoller {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn refresh_processes(&mut self) {
        self.system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    }

    pub fn get_process_info(&self, pid: u32) -> (Option<String>, Option<String>) {
        if let Some(proc) = self.system.process(Pid::from(pid as usize)) {
            let name = proc.name().to_string_lossy().to_string();
            let path = proc.exe().map(|p| p.to_string_lossy().to_string());
            (Some(name), path)
        } else {
            (None, None)
        }
    }

    pub fn classify_ip(ip_str: &str) -> NodeKind {
        if ip_str == "0.0.0.0" || ip_str == "*" || ip_str == "::" {
            return NodeKind::Gateway;
        }

        if let Ok(ip) = ip_str.parse::<IpAddr>() {
            match ip {
                IpAddr::V4(ipv4) => {
                    if ipv4.is_loopback() {
                        return NodeKind::Gateway;
                    }
                    let octets = ipv4.octets();
                    if octets[3] == 1 {
                        return NodeKind::Gateway;
                    }
                    if octets[0] == 10
                        || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
                        || (octets[0] == 192 && octets[1] == 168)
                    {
                        return NodeKind::Lan;
                    }
                    if octets[0] == 100 && (octets[1] & 0xC0) == 64 {
                        return NodeKind::Tailscale;
                    }
                    NodeKind::Internet
                }
                IpAddr::V6(ipv6) => {
                    if ipv6.is_loopback() {
                        NodeKind::Gateway
                    } else {
                        NodeKind::Internet
                    }
                }
            }
        } else {
            NodeKind::Internet
        }
    }

    pub fn scan_sockets(&mut self) -> Vec<SocketEntry> {
        self.refresh_processes();
        let mut entries = Vec::new();

        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("netstat").args(["-ano", "-p", "tcp"]).output() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    for line in text.lines() {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 5 && (parts[0] == "TCP" || parts[0] == "tcp") {
                            let local_addr = parts[1];
                            let foreign_addr = parts[2];
                            let state = parts[3].to_string();
                            let pid_val = parts[4].parse::<u32>().ok();

                            let (l_ip, l_port) = parse_endpoint(local_addr);
                            let (r_ip, r_port) = parse_endpoint(foreign_addr);

                            let (p_name, exe) = if let Some(pid) = pid_val {
                                self.get_process_info(pid)
                            } else {
                                (None, None)
                            };

                            entries.push(SocketEntry {
                                proto: "tcp".into(),
                                local_ip: l_ip,
                                local_port: l_port,
                                remote_ip: r_ip,
                                remote_port: r_port,
                                state,
                                pid: pid_val,
                                process_name: p_name,
                                exe_path: exe,
                            });
                        }
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(output) = Command::new("ss").args(["-ntup"]).output() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    for line in text.lines().skip(1) {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 5 {
                            let state = parts[0].to_string();
                            let local_addr = parts[3];
                            let foreign_addr = parts[4];
                            let (l_ip, l_port) = parse_endpoint(local_addr);
                            let (r_ip, r_port) = parse_endpoint(foreign_addr);

                            entries.push(SocketEntry {
                                proto: "tcp".into(),
                                local_ip: l_ip,
                                local_port: l_port,
                                remote_ip: r_ip,
                                remote_port: r_port,
                                state,
                                pid: None,
                                process_name: None,
                                exe_path: None,
                            });
                        }
                    }
                }
            }
        }

        entries
    }

    pub fn poll_and_compute_delta(&mut self) -> GraphDelta {
        let entries = self.scan_sockets();
        let now = now_ms();

        let mut current_nodes: HashMap<String, GraphNode> = HashMap::new();
        let mut current_links: HashMap<String, GraphLink> = HashMap::new();

        // 1. Center Host node
        let host_id = "host:local".to_string();
        current_nodes.insert(
            host_id.clone(),
            GraphNode {
                id: host_id.clone(),
                kind: NodeKind::Host,
                label: "Local Workstation".into(),
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

        for entry in &entries {
            // Process node
            let proc_label = entry
                .process_name
                .clone()
                .unwrap_or_else(|| format!("PID:{}", entry.pid.unwrap_or(0)));
            let proc_id = format!("proc:{}", proc_label);

            let proc_kind = if proc_label.to_lowercase().contains("docker") {
                NodeKind::Docker
            } else if proc_label.to_lowercase().contains("tailscale") {
                NodeKind::Tailscale
            } else {
                NodeKind::Process
            };

            current_nodes.entry(proc_id.clone()).or_insert_with(|| GraphNode {
                id: proc_id.clone(),
                kind: proc_kind,
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
                bytes_in: 1024,
                bytes_out: 1024,
                rate_in: 100.0,
                rate_out: 100.0,
                threat: None,
            });

            // Link host -> process
            let host_proc_link_id = format!("link:{}->{}", host_id, proc_id);
            current_links.entry(host_proc_link_id.clone()).or_insert_with(|| GraphLink {
                id: host_proc_link_id,
                source: host_id.clone(),
                target: proc_id.clone(),
                proto: entry.proto.clone(),
                port: entry.local_port,
                service: None,
                bytes_in: 1024,
                bytes_out: 1024,
                rate: 200.0,
                packets: 2,
                state: Some(entry.state.clone()),
                first_seen: now,
                last_seen: now,
            });

            // Remote endpoint node if remote IP is not empty or 0.0.0.0
            if !entry.remote_ip.is_empty()
                && entry.remote_ip != "0.0.0.0"
                && entry.remote_ip != "*"
                && entry.remote_ip != "127.0.0.1"
            {
                let remote_id = format!("ip:{}", entry.remote_ip);
                let remote_kind = Self::classify_ip(&entry.remote_ip);

                current_nodes.entry(remote_id.clone()).or_insert_with(|| GraphNode {
                    id: remote_id.clone(),
                    kind: remote_kind,
                    label: entry.remote_ip.clone(),
                    pid: None,
                    exe_path: None,
                    ip: Some(entry.remote_ip.clone()),
                    hostname: None,
                    country: None,
                    asn: None,
                    org: None,
                    first_seen: now,
                    last_seen: now,
                    bytes_in: 2048,
                    bytes_out: 4096,
                    rate_in: 250.0,
                    rate_out: 500.0,
                    threat: None,
                });

                // Link proc -> remote endpoint
                let proc_remote_link_id = format!("link:{}->{}:{}", proc_id, entry.remote_ip, entry.remote_port);
                current_links.entry(proc_remote_link_id.clone()).or_insert_with(|| GraphLink {
                    id: proc_remote_link_id,
                    source: proc_id.clone(),
                    target: remote_id.clone(),
                    proto: entry.proto.clone(),
                    port: entry.remote_port,
                    service: None,
                    bytes_in: 2048,
                    bytes_out: 4096,
                    rate: 750.0,
                    packets: 6,
                    state: Some(entry.state.clone()),
                    first_seen: now,
                    last_seen: now,
                });
            }
        }

        // Diff against previous state
        let mut add_nodes = Vec::new();
        let mut update_nodes = Vec::new();
        let mut remove_node_ids = Vec::new();

        for (id, node) in &current_nodes {
            if !self.previous_nodes.contains_key(id) {
                add_nodes.push(node.clone());
            } else {
                update_nodes.push(NodeUpdate {
                    id: id.clone(),
                    bytes_in: Some(node.bytes_in),
                    bytes_out: Some(node.bytes_out),
                    rate_in: Some(node.rate_in),
                    rate_out: Some(node.rate_out),
                    last_seen: Some(now),
                    threat: None,
                });
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
            if !self.previous_links.contains_key(id) {
                add_links.push(link.clone());
            } else {
                update_links.push(LinkUpdate {
                    id: id.clone(),
                    bytes_in: Some(link.bytes_in),
                    bytes_out: Some(link.bytes_out),
                    rate: Some(link.rate),
                    packets: Some(link.packets),
                    state: link.state.clone(),
                    last_seen: Some(now),
                });
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
            alerts: None,
        }
    }

    pub fn get_snapshot(&self) -> (Vec<GraphNode>, Vec<GraphLink>) {
        (
            self.previous_nodes.values().cloned().collect(),
            self.previous_links.values().cloned().collect(),
        )
    }
}

fn parse_endpoint(addr: &str) -> (String, u16) {
    if let Some(idx) = addr.rfind(':') {
        let ip = addr[..idx].trim_matches('[').trim_matches(']').to_string();
        let port = addr[idx + 1..].parse::<u16>().unwrap_or(0);
        (ip, port)
    } else {
        (addr.to_string(), 0)
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
