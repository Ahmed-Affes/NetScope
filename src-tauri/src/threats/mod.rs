use crate::model::{Alert, GraphLink, GraphNode, NodeKind, Severity};
use crate::sockets::now_ms;
use std::collections::HashSet;

#[derive(Default)]
pub struct ThreatEngine {
    known_listeners: HashSet<String>,
    evaluated_alerts: HashSet<String>,
    initial_baseline_done: bool,
    is_elevated: bool,
}

impl ThreatEngine {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_elevated(&mut self, elevated: bool) {
        self.is_elevated = elevated;
    }

    /// Evaluates all nodes, links, and listening sockets against active security rules.
    pub fn evaluate(
        &mut self,
        nodes: &[GraphNode],
        links: &[GraphLink],
        listening_sockets: &[(String, u16, Option<String>, Option<u32>)], // (local_ip, port, proc_name, pid)
    ) -> Vec<Alert> {
        let mut new_alerts = Vec::new();
        let now = now_ms();

        // 1. Sensitive Ports Exposed on 0.0.0.0 or [::]
        for (local_ip, port, proc_name_opt, _) in listening_sockets {
            let is_global = *local_ip == "0.0.0.0" || *local_ip == "::" || *local_ip == "*";
            if !is_global {
                continue;
            }

            let proc_name = proc_name_opt
                .as_deref()
                .unwrap_or("Unknown Process");

            let (service_name, severity, why_matters) = match *port {
                3389 => (
                    "RDP (Remote Desktop)",
                    Severity::High,
                    "Remote Desktop is reachable by any host on the network. Attackers can attempt credential stuffing or brute force.",
                ),
                445 => (
                    "SMB (File Sharing)",
                    Severity::High,
                    "SMB exposed globally allows any device on the network to attempt file access or exploit network sharing vulnerabilities.",
                ),
                23 => (
                    "Telnet",
                    Severity::High,
                    "Telnet transmits credentials and commands in unencrypted plaintext across the network.",
                ),
                5900 => (
                    "VNC Remote Access",
                    Severity::Med,
                    "VNC exposed globally allows network devices to reach screen sharing login.",
                ),
                3306 => (
                    "MySQL Database",
                    Severity::Med,
                    "Database port is exposed to the local network instead of restricted to localhost (127.0.0.1).",
                ),
                5432 => (
                    "PostgreSQL Database",
                    Severity::Med,
                    "Database port is exposed to the local network instead of restricted to localhost (127.0.0.1).",
                ),
                27017 => (
                    "MongoDB Database",
                    Severity::Med,
                    "Database port is exposed to the local network without local interface binding.",
                ),
                6379 => (
                    "Redis In-Memory Store",
                    Severity::High,
                    "Redis instances often lack authentication and if exposed globally can allow arbitrary remote code execution.",
                ),
                9200 => (
                    "Elasticsearch",
                    Severity::Med,
                    "Elasticsearch HTTP API exposed globally can lead to unauthenticated data indexing or exfiltration.",
                ),
                _ => continue,
            };

            let alert_id = format!("alert:exposed:{}:{}", port, proc_name);
            if !self.evaluated_alerts.contains(&alert_id) {
                self.evaluated_alerts.insert(alert_id.clone());
                new_alerts.push(Alert {
                    id: alert_id,
                    timestamp: now,
                    severity,
                    rule: "Sensitive Port Exposed Globally (0.0.0.0)".into(),
                    node_id: None,
                    link_id: None,
                    description: format!(
                        "Process '{}' is listening on port {} ({}) on all interfaces (0.0.0.0 / ::). Why it matters: {}",
                        proc_name, port, service_name, why_matters
                    ),
                    acked: false,
                });
            }
        }

        // 2. New Listening Service Appeared
        let mut current_listeners = HashSet::new();
        for (_, port, proc_name_opt, pid_opt) in listening_sockets {
            let key = format!("{}:{}:{}", port, proc_name_opt.as_deref().unwrap_or(""), pid_opt.unwrap_or(0));
            current_listeners.insert((key.clone(), *port, proc_name_opt.clone()));

            if self.initial_baseline_done && !self.known_listeners.contains(&key) {
                let proc_name = proc_name_opt.as_deref().unwrap_or("Unknown Process");
                let alert_id = format!("alert:newlistener:{}", key);
                if !self.evaluated_alerts.contains(&alert_id) {
                    self.evaluated_alerts.insert(alert_id.clone());
                    new_alerts.push(Alert {
                        id: alert_id,
                        timestamp: now,
                        severity: Severity::Low,
                        rule: "New Listening Service Detected".into(),
                        node_id: None,
                        link_id: None,
                        description: format!(
                            "Process '{}' opened new listening port {}. Why it matters: Newly opened listening ports expand incoming attack surface.",
                            proc_name, port
                        ),
                        acked: false,
                    });
                }
            }
        }

        for (k, _, _) in &current_listeners {
            self.known_listeners.insert(k.clone());
        }
        self.initial_baseline_done = true;

        // 3. Cryptomining Pool Detection (Stratum ports) - WITH DEV-PROCESS FILTER
        for link in links {
            let is_stratum = matches!(link.port, 3333 | 4444 | 7777 | 8888 | 14433 | 14444);
            if !is_stratum {
                continue;
            }

            // Inspect the source process
            let is_dev_proc = nodes.iter().any(|n| {
                if n.id == link.source {
                    let label = n.label.to_lowercase();
                    label.contains("node")
                        || label.contains("python")
                        || label.contains("cargo")
                        || label.contains("rustc")
                        || label.contains("code")
                        || label.contains("vite")
                        || label.contains("deno")
                        || label.contains("bun")
                        || label.contains("docker")
                        || label.contains("java")
                } else {
                    false
                }
            });

            // If it's a known developer runtime on common dev ports (3333, 4444, 7777, 8888), suppress false positive!
            if is_dev_proc && matches!(link.port, 3333 | 4444 | 7777 | 8888) {
                continue;
            }

            let alert_id = format!("alert:miner:{}", link.id);
            if !self.evaluated_alerts.contains(&alert_id) {
                self.evaluated_alerts.insert(alert_id.clone());
                new_alerts.push(Alert {
                    id: alert_id,
                    timestamp: now,
                    severity: Severity::Med,
                    rule: "Potential Cryptomining Pool Connection".into(),
                    node_id: Some(link.target.clone()),
                    link_id: Some(link.id.clone()),
                    description: format!(
                        "Outbound connection established on stratum mining port {}. Why it matters: Mining protocols utilize these ports to coordinate proof-of-work. Verify this is authorized.",
                        link.port
                    ),
                    acked: false,
                });
            }
        }

        // 4. Data Exfiltration Spike & DNS Tunneling (ONLY evaluated when Tier B ETW data is active!)
        if self.is_elevated {
            for link in links {
                // High rate data outflow (> 5 MB/s to external internet)
                if link.rate > 5_000_000.0 && link.target.starts_with("ip:") {
                    let alert_id = format!("alert:exfil:{}", link.id);
                    if !self.evaluated_alerts.contains(&alert_id) {
                        self.evaluated_alerts.insert(alert_id.clone());
                        new_alerts.push(Alert {
                            id: alert_id,
                            timestamp: now,
                            severity: Severity::High,
                            rule: "High-Volume Data Outflow".into(),
                            node_id: Some(link.target.clone()),
                            link_id: Some(link.id.clone()),
                            description: format!(
                                "High sustained byte outflow ({:.1} MB/s) to {}. Why it matters: Unusually large continuous upload bursts can indicate unexpected data exfiltration.",
                                link.rate / 1_000_000.0,
                                link.target
                            ),
                            acked: false,
                        });
                    }
                }

                // DNS Tunneling: Port 53 sustained throughput > 200 KB/s
                if link.port == 53 && link.rate > 200_000.0 {
                    let alert_id = format!("alert:dns-tunnel:{}", link.id);
                    if !self.evaluated_alerts.contains(&alert_id) {
                        self.evaluated_alerts.insert(alert_id.clone());
                        new_alerts.push(Alert {
                            id: alert_id,
                            timestamp: now,
                            severity: Severity::High,
                            rule: "Abnormal DNS Throughput (DNS Tunneling)".into(),
                            node_id: Some(link.target.clone()),
                            link_id: Some(link.id.clone()),
                            description: format!(
                                "High byte rate ({:.1} KB/s) on DNS port 53. Why it matters: Standard DNS requests are lightweight; sustained high rates indicate data tunneling over DNS.",
                                link.rate / 1024.0
                            ),
                            acked: false,
                        });
                    }
                }
            }
        }

        // 5. Flagged Threat Nodes
        for node in nodes {
            if node.kind == NodeKind::Threat {
                let alert_id = format!("alert:threat:{}", node.id);
                if !self.evaluated_alerts.contains(&alert_id) {
                    self.evaluated_alerts.insert(alert_id.clone());
                    new_alerts.push(Alert {
                        id: alert_id,
                        timestamp: now,
                        severity: Severity::High,
                        rule: "Active Connection to Classified Threat".into(),
                        node_id: Some(node.id.clone()),
                        link_id: None,
                        description: format!(
                            "Connection established to classified threat node '{}'. Why it matters: Communication with known hostile hosts or C2 infrastructure.",
                            node.label
                        ),
                        acked: false,
                    });
                }
            }
        }

        new_alerts
    }
}
