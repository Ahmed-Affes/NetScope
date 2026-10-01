use crate::model::NodeKind;
use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

/// Classifies a port into a friendly service name.
pub fn classify_service(port: u16) -> Option<String> {
    match port {
        21 => Some("FTP".into()),
        22 => Some("SSH".into()),
        23 => Some("Telnet".into()),
        25 => Some("SMTP".into()),
        53 => Some("DNS".into()),
        80 => Some("HTTP".into()),
        110 => Some("POP3".into()),
        137 => Some("NetBIOS Name".into()),
        138 => Some("NetBIOS Datagram".into()),
        139 => Some("NetBIOS Session".into()),
        143 => Some("IMAP".into()),
        443 => Some("HTTPS".into()),
        445 => Some("SMB".into()),
        587 => Some("SMTP Submission".into()),
        993 => Some("IMAPS".into()),
        995 => Some("POP3S".into()),
        1433 => Some("MSSQL".into()),
        1521 => Some("Oracle DB".into()),
        3000 => Some("Grafana / Dev".into()),
        3306 => Some("MySQL".into()),
        3389 => Some("RDP (Remote Desktop)".into()),
        4000 => Some("GraphQL / Dev".into()),
        4317 => Some("OpenTelemetry gRPC".into()),
        4318 => Some("OpenTelemetry HTTP".into()),
        5000 => Some("Flask / Dev".into()),
        5173 => Some("Vite Dev Server".into()),
        5432 => Some("PostgreSQL".into()),
        5900 => Some("VNC".into()),
        6379 => Some("Redis".into()),
        7474 => Some("Neo4j Browser HTTP".into()),
        7687 => Some("Neo4j Bolt".into()),
        8000 => Some("Dev Server".into()),
        8080 => Some("HTTP Proxy / Dev".into()),
        8443 => Some("HTTPS Alt".into()),
        8086 => Some("InfluxDB".into()),
        9000 => Some("PHP-FPM / SonarQube".into()),
        9090 => Some("Prometheus".into()),
        9100 => Some("Node Exporter".into()),
        9200 => Some("Elasticsearch".into()),
        10050 => Some("Zabbix Agent".into()),
        10051 => Some("Zabbix Trapper".into()),
        11434 => Some("Ollama LLM API".into()),
        16686 => Some("Jaeger Tracing".into()),
        19999 => Some("Netdata Monitoring".into()),
        27017 => Some("MongoDB".into()),
        _ => None,
    }
}

/// Checks if a port belongs to the monitoring/observability category.
pub fn is_monitor_service(port: u16) -> bool {
    matches!(
        port,
        3000   // Grafana
        | 4317 // OTel
        | 4318 // OTel
        | 8086 // InfluxDB
        | 9090 // Prometheus
        | 9100 // Node Exporter
        | 9411 // Zipkin
        | 10050 // Zabbix
        | 10051 // Zabbix
        | 16686 // Jaeger
        | 19999 // Netdata
    )
}

/// Checks if an IPv4 address is in the CGNAT / Tailscale range (100.64.0.0/10: 100.64.0.0 - 100.127.255.255)
pub fn is_tailscale_ipv4(ipv4: &Ipv4Addr) -> bool {
    let octets = ipv4.octets();
    octets[0] == 100 && (octets[1] & 0xC0) == 64
}

/// Checks if an IPv6 address is in the Tailscale ULA range (fd7a:115c:a1e0::/48)
pub fn is_tailscale_ipv6(ipv6: &Ipv6Addr) -> bool {
    let segments = ipv6.segments();
    segments[0] == 0xfd7a && segments[1] == 0x115c && segments[2] == 0xa1e0
}

/// Checks if an IP is in RFC1918 private IPv4 space
pub fn is_private_ipv4(ipv4: &Ipv4Addr) -> bool {
    let octets = ipv4.octets();
    octets[0] == 10
        || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
        || (octets[0] == 192 && octets[1] == 168)
}

/// Checks if an IPv6 address is Unique Local Address (fc00::/7)
pub fn is_ula_ipv6(ipv6: &Ipv6Addr) -> bool {
    (ipv6.segments()[0] & 0xfe00) == 0xfc00
}

/// Checks if an IP is in Docker default subnet (172.17.0.0/16)
pub fn is_docker_ip(ipv4: &Ipv4Addr) -> bool {
    let octets = ipv4.octets();
    octets[0] == 172 && octets[1] == 17
}

/// Discovers the system's actual default gateway(s) via routing table / default-net.
pub fn discover_default_gateways() -> HashSet<IpAddr> {
    let mut gateways = HashSet::new();

    if let Ok(gw) = default_net::get_default_gateway() {
        gateways.insert(gw.ip_addr);
    }

    for iface in default_net::get_interfaces() {
        if let Some(gw) = iface.gateway {
            gateways.insert(gw.ip_addr);
        }
    }

    gateways
}

/// Classifies an IP address string into the appropriate `NodeKind`.
///
/// Rules:
/// 1. Loopback / 0.0.0.0 / :: -> Host (never Gateway)
/// 2. Tailscale (100.64.0.0/10, fd7a:115c:a1e0::/48) -> Tailscale (evaluated before other rules)
/// 3. Exact matching real gateway(s) -> Gateway
/// 4. Docker (172.17.0.0/16) -> Docker
/// 5. LAN (RFC1918, IPv6 ULA, link-local) -> Lan
/// 6. Everything else (including public .1 addresses like 1.1.1.1) -> Internet (never Gateway)
pub fn classify_ip_with_gateways(ip_str: &str, known_gateways: &HashSet<IpAddr>) -> NodeKind {
    if ip_str == "0.0.0.0"
        || ip_str == "127.0.0.1"
        || ip_str == "::1"
        || ip_str == "::"
        || ip_str == "*"
        || ip_str.is_empty()
    {
        return NodeKind::Host;
    }

    let parsed: IpAddr = match ip_str.parse() {
        Ok(ip) => ip,
        Err(_) => return NodeKind::Internet,
    };

    // Rule 1: Loopback is local host, NEVER gateway
    if parsed.is_loopback() {
        return NodeKind::Host;
    }

    // Rule 2: Tailscale evaluated BEFORE other rules
    match &parsed {
        IpAddr::V4(v4) if is_tailscale_ipv4(v4) => return NodeKind::Tailscale,
        IpAddr::V6(v6) if is_tailscale_ipv6(v6) => return NodeKind::Tailscale,
        _ => {}
    }

    // Rule 3: Gateway = only the REAL default gateway(s) from the routing table
    if known_gateways.contains(&parsed) {
        return NodeKind::Gateway;
    }

    // Rule 4: Docker default bridge (172.17.0.0/16)
    if let IpAddr::V4(v4) = &parsed {
        if is_docker_ip(v4) {
            return NodeKind::Docker;
        }
    }

    // Rule 5: LAN (RFC1918, IPv6 ULA, link-local)
    match &parsed {
        IpAddr::V4(v4) => {
            if is_private_ipv4(v4) || v4.is_link_local() {
                return NodeKind::Lan;
            }
        }
        IpAddr::V6(v6) => {
            if is_ula_ipv6(v6) || (v6.segments()[0] & 0xffc0) == 0xfe80 {
                return NodeKind::Lan;
            }
        }
    }

    // Rule 6: Public internet (1.1.1.1, 8.8.8.8, 8.8.8.1, etc. - NEVER Gateway!)
    NodeKind::Internet
}
