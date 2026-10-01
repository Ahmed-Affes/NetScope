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
}
