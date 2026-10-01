// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    netscope_lib::run();
}

#[cfg(test)]
mod tests {
    use netscope_lib::commands::*;

    #[test]
    fn test_critical_process_detection() {
        assert!(is_critical_process(0, "System Idle Process"));
        assert!(is_critical_process(4, "System"));
        assert!(is_critical_process(1234, "csrss.exe"));
        assert!(is_critical_process(1234, "CSRSS"));
        assert!(is_critical_process(1234, "svchost.exe"));
        assert!(is_critical_process(1234, "services.exe"));
        assert!(is_critical_process(1234, "lsass.exe"));
        assert!(is_critical_process(1234, "explorer.exe"));
        assert!(is_critical_process(1234, "winlogon.exe"));
        assert!(is_critical_process(1234, "smss.exe"));

        // Normal apps should not be critical
        assert!(!is_critical_process(5000, "chrome.exe"));
        assert!(!is_critical_process(5001, "node.exe"));
        assert!(!is_critical_process(5002, "ollama.exe"));
        assert!(!is_critical_process(5003, "neo4j"));
    }

    #[test]
    fn test_url_validation_rejection() {
        // Disallowed schemes
        assert!(open_external_url("javascript:alert(1)".into()).is_err());
        assert!(open_external_url("file:///C:/Windows/System32/calc.exe".into()).is_err());
        assert!(open_external_url("data:text/html,<script>alert(1)</script>".into()).is_err());
        assert!(open_external_url("cmd /c calc.exe".into()).is_err());
        assert!(open_external_url("not a url".into()).is_err());
    }

    #[test]
    fn test_ip_block_validation() {
        // CIDR ranges and keywords should be rejected
        assert!(block_remote_ip("192.168.1.0/24".into()).is_err());
        assert!(block_remote_ip("any".into()).is_err());
        assert!(block_remote_ip("10.0.0.1-10.0.0.50".into()).is_err());
        assert!(block_remote_ip("invalid-ip".into()).is_err());
        assert!(block_remote_ip("127.0.0.1".into()).is_err()); // loopback
        assert!(block_remote_ip("0.0.0.0".into()).is_err()); // unspecified
        assert!(block_remote_ip("224.0.0.1".into()).is_err()); // multicast
    }

    #[test]
    fn test_ip_classification_gateways_and_public() {
        use netscope_lib::model::NodeKind;
        use netscope_lib::sockets::classification::classify_ip_with_gateways;
        use std::collections::HashSet;
        use std::net::IpAddr;

        let mut gateways = HashSet::new();
        gateways.insert("192.168.1.1".parse::<IpAddr>().unwrap());

        // 1. Loopback / 0.0.0.0 are Host, never Gateway!
        assert_eq!(classify_ip_with_gateways("127.0.0.1", &gateways), NodeKind::Host);
        assert_eq!(classify_ip_with_gateways("::1", &gateways), NodeKind::Host);
        assert_eq!(classify_ip_with_gateways("0.0.0.0", &gateways), NodeKind::Host);

        // 2. Real gateway matches Gateway
        assert_eq!(classify_ip_with_gateways("192.168.1.1", &gateways), NodeKind::Gateway);

        // 3. Public IPs ending in .1 are NEVER Gateway (Acceptance Criteria 2)
        assert_eq!(classify_ip_with_gateways("1.1.1.1", &gateways), NodeKind::Internet);
        assert_eq!(classify_ip_with_gateways("8.8.8.1", &gateways), NodeKind::Internet);
        assert_eq!(classify_ip_with_gateways("142.250.190.1", &gateways), NodeKind::Internet);

        // 4. Tailscale (100.64.0.0/10 and fd7a:115c:a1e0::/48)
        assert_eq!(classify_ip_with_gateways("100.64.0.1", &gateways), NodeKind::Tailscale);
        assert_eq!(classify_ip_with_gateways("100.100.100.100", &gateways), NodeKind::Tailscale);
        assert_eq!(classify_ip_with_gateways("100.127.255.254", &gateways), NodeKind::Tailscale);
        assert_eq!(classify_ip_with_gateways("fd7a:115c:a1e0::1", &gateways), NodeKind::Tailscale);

        // 5. Private LAN (RFC1918)
        assert_eq!(classify_ip_with_gateways("192.168.1.50", &gateways), NodeKind::Lan);
        assert_eq!(classify_ip_with_gateways("10.0.5.20", &gateways), NodeKind::Lan);
        assert_eq!(classify_ip_with_gateways("172.16.1.1", &gateways), NodeKind::Lan);

        // 6. Docker default bridge (172.17.0.0/16)
        assert_eq!(classify_ip_with_gateways("172.17.0.2", &gateways), NodeKind::Docker);
    }

    #[test]
    fn test_service_classification_and_monitor() {
        use netscope_lib::sockets::classification::{classify_service, is_monitor_service};

        // Friendly service names
        assert_eq!(classify_service(11434), Some("Ollama LLM API".into()));
        assert_eq!(classify_service(7474), Some("Neo4j Browser HTTP".into()));
        assert_eq!(classify_service(7687), Some("Neo4j Bolt".into()));
        assert_eq!(classify_service(5173), Some("Vite Dev Server".into()));
        assert_eq!(classify_service(9090), Some("Prometheus".into()));

        // Monitor category
        assert!(is_monitor_service(9090)); // Prometheus
        assert!(is_monitor_service(3000)); // Grafana
        assert!(is_monitor_service(9100)); // Node Exporter
        assert!(is_monitor_service(19999)); // Netdata
        assert!(!is_monitor_service(80));
        assert!(!is_monitor_service(443));
        assert!(!is_monitor_service(22));
    }

    #[test]
    fn test_mac_oui_vendor_lookup() {
        use netscope_lib::sockets::discovery::lookup_mac_vendor;

        assert_eq!(lookup_mac_vendor("F4:D4:88:11:22:33"), Some("Apple".into()));
        assert_eq!(lookup_mac_vendor("B8-27-EB-AA-BB-CC"), Some("Raspberry Pi".into()));
        assert_eq!(lookup_mac_vendor("24:0A:C4:00:11:22"), Some("Espressif IoT".into()));
        assert_eq!(lookup_mac_vendor("00:15:5D:12:34:56"), Some("Microsoft Hyper-V".into()));
        assert_eq!(lookup_mac_vendor("FF:FF:FF:FF:FF:FF"), None);
    }
}
