#![allow(dead_code)]
use crate::model::{Alert, GraphDelta, GraphLink, GraphNode, NodeKind, Severity, ThreatInfo};
use crate::sockets::now_ms;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ThreatRuleResult {
    pub matched: bool,
    pub rule_id: String,
    pub severity: Severity,
    pub description: String,
    pub node_id: Option<String>,
    pub link_id: Option<String>,
}

pub struct ThreatEngine {
    // History of connection intervals per endpoint for beacon detection
    connection_intervals: std::collections::HashMap<String, Vec<u64>>,
}

impl Default for ThreatEngine {
    fn default() -> Self {
        Self {
            connection_intervals: std::collections::HashMap::new(),
        }
    }
}

impl ThreatEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Evaluates Shannon entropy of domain names to detect DGAs (Domain Generation Algorithms)
    pub fn shannon_entropy(s: &str) -> f64 {
        let mut char_counts = std::collections::HashMap::new();
        let mut total = 0.0;
        for c in s.chars() {
            if c.is_alphanumeric() {
                *char_counts.entry(c).or_insert(0.0) += 1.0;
                total += 1.0;
            }
        }
        if total == 0.0 {
            return 0.0;
        }

        let mut entropy = 0.0;
        for count in char_counts.values() {
            let p: f64 = count / total;
            entropy -= p * p.log2();
        }
        entropy
    }

    /// Analyzes a node for threat indicators
    pub fn analyze_node(&self, node: &GraphNode) -> Option<Alert> {
        let now = now_ms();

        // 1. High-entropy domain (DGA)
        if let Some(hostname) = &node.hostname {
            let parts: Vec<&str> = hostname.split('.').collect();
            if let Some(sub) = parts.first() {
                if sub.len() > 8 && Self::shannon_entropy(sub) > 3.8 {
                    return Some(Alert {
                        id: format!("alert:dga:{}", node.id),
                        timestamp: now,
                        severity: Severity::High,
                        rule: "DGA Domain Generation Algorithm".into(),
                        node_id: Some(node.id.clone()),
                        link_id: None,
                        description: format!(
                            "High domain name entropy ({:.2}) detected on {}",
                            Self::shannon_entropy(sub),
                            hostname
                        ),
                        acked: false,
                    });
                }
            }
        }

        // 2. Known malicious / threat kind
        if node.kind == NodeKind::Threat {
            return Some(Alert {
                id: format!("alert:threat:{}", node.id),
                timestamp: now,
                severity: Severity::High,
                rule: "Known Malicious Endpoint / C2".into(),
                node_id: Some(node.id.clone()),
                link_id: None,
                description: format!("Connection to flagged malicious node {}", node.label),
                acked: false,
            });
        }

        None
    }

    /// Analyzes a link for traffic anomalies
    pub fn analyze_link(&self, link: &GraphLink) -> Option<Alert> {
        let now = now_ms();

        // 1. Crypto Mining Pool Detection (Stratum ports)
        if link.port == 3333
            || link.port == 4444
            || link.port == 7777
            || link.port == 8888
            || link.port == 14433
            || link.port == 14444
        {
            return Some(Alert {
                id: format!("alert:miner:{}", link.id),
                timestamp: now,
                severity: Severity::Med,
                rule: "Cryptocurrency Mining (Stratum Protocol)".into(),
                node_id: Some(link.target.clone()),
                link_id: Some(link.id.clone()),
                description: format!(
                    "Active connection on known crypto mining port {}",
                    link.port
                ),
                acked: false,
            });
        }

        // 2. Data Exfiltration Spike (> 2 MB/s sustained out)
        if link.rate > 2_000_000.0 {
            return Some(Alert {
                id: format!("alert:exfil:{}", link.id),
                timestamp: now,
                severity: Severity::High,
                rule: "High-Volume Data Exfiltration Spike".into(),
                node_id: Some(link.target.clone()),
                link_id: Some(link.id.clone()),
                description: format!(
                    "Massive sustained throughput ({:.2} MB/s) to target",
                    link.rate / 1_000_000.0
                ),
                acked: false,
            });
        }

        // 3. DNS Tunneling (abnormally high volume on port 53)
        if link.port == 53 && link.rate > 80_000.0 {
            return Some(Alert {
                id: format!("alert:dns-tunnel:{}", link.id),
                timestamp: now,
                severity: Severity::High,
                rule: "DNS Tunneling / Data Leak".into(),
                node_id: Some(link.target.clone()),
                link_id: Some(link.id.clone()),
                description: "Anomalously high byte throughput observed on UDP/TCP port 53".into(),
                acked: false,
            });
        }

        None
    }
}
