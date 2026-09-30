use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Host,
    Gateway,
    Lan,
    Docker,
    Internet,
    Tailscale,
    Monitor,
    Process,
    Threat,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Low,
    Med,
    High,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ThreatInfo {
    pub severity: Severity,
    pub reasons: Vec<String>,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub kind: NodeKind,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exe_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asn: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub org: Option<String>,
    pub first_seen: u64,
    pub last_seen: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub rate_in: f64,
    pub rate_out: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threat: Option<ThreatInfo>,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GraphLink {
    pub id: String,
    pub source: String,
    pub target: String,
    pub proto: String,
    pub port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub rate: f64,
    pub packets: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    pub first_seen: u64,
    pub last_seen: u64,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub id: String,
    pub timestamp: u64,
    pub severity: Severity,
    pub rule: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link_id: Option<String>,
    pub description: String,
    pub acked: bool,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NodeUpdate {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_in: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_out: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate_in: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate_out: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threat: Option<ThreatInfo>,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LinkUpdate {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_in: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_out: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub packets: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen: Option<u64>,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GraphDelta {
    pub t: u64,
    pub add_nodes: Vec<GraphNode>,
    pub update_nodes: Vec<NodeUpdate>,
    pub remove_node_ids: Vec<String>,
    pub add_links: Vec<GraphLink>,
    pub update_links: Vec<LinkUpdate>,
    pub remove_link_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alerts: Option<Vec<Alert>>,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub ram_usage_percent: f32,
    pub gpu_usage: Option<f32>,
    pub gpu_temp: Option<f32>,
    pub disk_free_bytes: u64,
    pub disk_total_bytes: u64,
    pub disk_usage_percent: f32,
    pub docker_containers: u32,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub name: String,
    pub mode: String,
    pub is_elevated: bool,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GraphSnapshot {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}
