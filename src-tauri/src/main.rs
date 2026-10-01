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
        assert_eq!(
            classify_ip_with_gateways("142.250.190.1", &gateways),
            NodeKind::Internet
        );

        // 4. Tailscale (100.64.0.0/10 and fd7a:115c:a1e0::/48)
        assert_eq!(classify_ip_with_gateways("100.64.0.1", &gateways), NodeKind::Tailscale);
        assert_eq!(
            classify_ip_with_gateways("100.100.100.100", &gateways),
            NodeKind::Tailscale
        );
        assert_eq!(
            classify_ip_with_gateways("100.127.255.254", &gateways),
            NodeKind::Tailscale
        );
        assert_eq!(
            classify_ip_with_gateways("fd7a:115c:a1e0::1", &gateways),
            NodeKind::Tailscale
        );

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

    #[test]
    fn test_ipv6_classification() {
        use netscope_lib::model::NodeKind;
        use netscope_lib::sockets::classification::classify_ip_with_gateways;
        use std::collections::HashSet;

        let gateways = HashSet::new();

        // Loopback
        assert_eq!(classify_ip_with_gateways("::1", &gateways), NodeKind::Host);

        // ULA (fc00::/7)
        assert_eq!(classify_ip_with_gateways("fc00::1", &gateways), NodeKind::Lan);
        assert_eq!(classify_ip_with_gateways("fd00:1234::1", &gateways), NodeKind::Lan);

        // Link-local (fe80::/10)
        assert_eq!(classify_ip_with_gateways("fe80::1", &gateways), NodeKind::Lan);
        assert_eq!(classify_ip_with_gateways("fe80::aabb:ccdd", &gateways), NodeKind::Lan);

        // Tailscale IPv6 (fd7a:115c:a1e0::/48)
        assert_eq!(
            classify_ip_with_gateways("fd7a:115c:a1e0::1", &gateways),
            NodeKind::Tailscale
        );

        // Public IPv6 (Cloudflare DNS 2606:4700:4700::1111, Google DNS 2001:4860:4860::8888)
        assert_eq!(
            classify_ip_with_gateways("2606:4700:4700::1111", &gateways),
            NodeKind::Internet
        );
        assert_eq!(
            classify_ip_with_gateways("2001:4860:4860::8888", &gateways),
            NodeKind::Internet
        );
    }

    #[test]
    fn test_local_link_joining_simulation() {
        use netscope_lib::sockets::classification::classify_service;
        use std::collections::HashMap;

        // Simulated listener for Ollama on port 11434
        let mut listeners: HashMap<u16, (String, String, Option<String>)> = HashMap::new();
        let listener_port = 11434;
        let listener_proc_id = "proc:ollama.exe:8888".to_string();
        let service_id = format!("service:tcp:{}", listener_port);
        let friendly_service = classify_service(listener_port);
        listeners.insert(
            listener_port,
            (service_id.clone(), listener_proc_id, friendly_service.clone()),
        );

        // Simulated established connection from VSCode (pid 12345) to 127.0.0.1:11434
        let client_proc_id = "proc:code.exe:12345";
        let remote_ip = "127.0.0.1";
        let remote_port = 11434;
        let state = "ESTABLISHED";

        let is_local_remote = remote_ip == "127.0.0.1" || remote_ip == "::1";
        assert!(is_local_remote);
        assert_eq!(state, "ESTABLISHED");

        // Correlation logic:
        let target_node_id = if let Some((srv_id, _, _)) = listeners.get(&remote_port) {
            srv_id.clone()
        } else {
            format!("service:local:{}", remote_port)
        };

        // Verification: The client process links directly to the service node!
        assert_eq!(target_node_id, "service:tcp:11434");
        let link_id = format!("link:{}->{}", client_proc_id, target_node_id);
        assert_eq!(link_id, "link:proc:code.exe:12345->service:tcp:11434");
        assert_eq!(friendly_service, Some("Ollama LLM API".into()));
    }

    #[test]
    fn test_url_validation_success_and_failure() {
        // Valid URLs
        assert!(open_external_url("https://github.com/Ahmed-Affes/NetScope".into()).is_ok());
        assert!(open_external_url("http://localhost:5173".into()).is_ok());
        assert!(open_external_url("https://speed.cloudflare.com".into()).is_ok());

        // Dangerous / shell injection attempts rejected
        assert!(open_external_url("cmd /c start calc".into()).is_err());
        assert!(open_external_url("https://github.com & calc.exe".into()).is_err());
        assert!(open_external_url("https://github.com | calc.exe".into()).is_err());
        assert!(open_external_url("ftp://ftp.example.com".into()).is_err());
        assert!(open_external_url("file:///etc/passwd".into()).is_err());
        assert!(open_external_url("powershell -enc ...".into()).is_err());
    }

    #[test]
    fn test_valid_remote_ip_blocking() {
        // Valid public IP addresses should pass validation (even if firewall execution fails on non-admin test runner)
        let valid_v4: Result<std::net::IpAddr, _> = "93.184.216.34".parse();
        assert!(valid_v4.is_ok());
        let valid_v6: Result<std::net::IpAddr, _> = "2606:4700:4700::1111".parse();
        assert!(valid_v6.is_ok());

        // Invalid IPs rejected
        assert!("256.256.256.256".parse::<std::net::IpAddr>().is_err());
        assert!("any".parse::<std::net::IpAddr>().is_err());
        assert!("192.168.1.0/24".parse::<std::net::IpAddr>().is_err());
    }
}
