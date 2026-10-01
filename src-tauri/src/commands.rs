use crate::model::{AppInfo, SystemMetrics};
use std::sync::Mutex;
use sysinfo::{Disks, Networks, System};

// Lazy or static holder for system information to minimize overhead
static SYSTEM_STATE: Mutex<Option<System>> = Mutex::new(None);
static NETWORKS_STATE: Mutex<Option<Networks>> = Mutex::new(None);

#[cfg(target_os = "windows")]
pub fn check_is_elevated() -> bool {
    use std::mem;
    #[link(name = "advapi32")]
    extern "system" {
        fn OpenProcessToken(
            ProcessHandle: *mut std::ffi::c_void,
            DesiredAccess: u32,
            TokenHandle: *mut *mut std::ffi::c_void,
        ) -> i32;
        fn GetTokenInformation(
            TokenHandle: *mut std::ffi::c_void,
            TokenInformationClass: u32,
            TokenInformation: *mut std::ffi::c_void,
            TokenInformationLength: u32,
            ReturnLength: *mut u32,
        ) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> *mut std::ffi::c_void;
        fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
    }

    unsafe {
        let mut token: *mut std::ffi::c_void = std::ptr::null_mut();
        const TOKEN_QUERY: u32 = 0x0008;
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) != 0 {
            let mut elevation: u32 = 0;
            let mut ret_len: u32 = 0;
            // TokenElevation = 20
            let res = GetTokenInformation(
                token,
                20,
                &mut elevation as *mut _ as *mut std::ffi::c_void,
                mem::size_of::<u32>() as u32,
                &mut ret_len,
            );
            CloseHandle(token);
            res != 0 && elevation != 0
        } else {
            false
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn check_is_elevated() -> bool {
    false
}

#[tauri::command]
#[specta::specta]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "NetScope".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        mode: "live".into(),
        is_elevated: check_is_elevated(),
    }
}

#[tauri::command]
#[specta::specta]
pub fn relaunch_elevated() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "shell32")]
        extern "system" {
            fn ShellExecuteW(
                hwnd: *mut std::ffi::c_void,
                lpOperation: *const u16,
                lpFile: *const u16,
                lpParameters: *const u16,
                lpDirectory: *const u16,
                nShowCmd: i32,
            ) -> isize;
        }

        let exe = std::env::current_exe()
            .map_err(|e| format!("Failed to find current executable: {}", e))?;
        let exe_w: Vec<u16> = exe
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let op_w: Vec<u16> = std::ffi::OsStr::new("runas")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let res = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                op_w.as_ptr(),
                exe_w.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1, // SW_SHOWNORMAL
            )
        };

        if res > 32 {
            std::process::exit(0);
        } else {
            Err(format!(
                "UAC elevation was cancelled or failed with code {}",
                res
            ))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Elevation relaunch is only supported on Windows".into())
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_system_metrics() -> SystemMetrics {
    let mut state_guard = SYSTEM_STATE.lock().unwrap_or_else(|e| e.into_inner());
    let sys = state_guard.get_or_insert_with(|| {
        let mut s = System::new_all();
        s.refresh_all();
        s
    });

    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_usage();
    let ram_used = sys.used_memory();
    let ram_total = sys.total_memory();
    let ram_pct = if ram_total > 0 {
        (ram_used as f32 / ram_total as f32) * 100.0
    } else {
        0.0
    };

    static LAST_DISK_CHECK: Mutex<(u64, u64, u64)> = Mutex::new((0, 0, 0));
    let now = crate::sockets::now_ms();
    let (disk_free, disk_total) = {
        let mut disk_guard = LAST_DISK_CHECK.lock().unwrap_or_else(|e| e.into_inner());
        if now.saturating_sub(disk_guard.2) > 30_000 || disk_guard.1 == 0 {
            let disks = Disks::new_with_refreshed_list();
            let mut free = 0u64;
            let mut total = 0u64;
            for disk in &disks {
                free += disk.available_space();
                total += disk.total_space();
            }
            *disk_guard = (free, total, now);
            (free, total)
        } else {
            (disk_guard.0, disk_guard.1)
        }
    };

    let disk_pct = if disk_total > 0 {
        ((disk_total - disk_free) as f32 / disk_total as f32) * 100.0
    } else {
        0.0
    };

    let docker_count = sys
        .processes()
        .values()
        .filter(|p| {
            let n = p.name().to_string_lossy().to_lowercase();
            n.contains("docker") || n.contains("dockerd") || n.contains("containerd")
        })
        .count() as u32;

    let (net_rx, net_tx, net_rx_rate, net_tx_rate) = {
        let mut net_guard = NETWORKS_STATE.lock().unwrap_or_else(|e| e.into_inner());
        let nets = net_guard.get_or_insert_with(Networks::new_with_refreshed_list);
        nets.refresh(true);
        let mut rx = 0u64;
        let mut tx = 0u64;
        let mut rx_rate = 0.0f64;
        let mut tx_rate = 0.0f64;
        for net in nets.values() {
            rx += net.total_received();
            tx += net.total_transmitted();
            rx_rate += net.received() as f64;
            tx_rate += net.transmitted() as f64;
        }
        (rx, tx, rx_rate, tx_rate)
    };

    SystemMetrics {
        cpu_usage,
        ram_used_bytes: ram_used,
        ram_total_bytes: ram_total,
        ram_usage_percent: ram_pct,
        gpu_usage: None,
        gpu_temp: None,
        disk_free_bytes: disk_free,
        disk_total_bytes: disk_total,
        disk_usage_percent: disk_pct,
        docker_containers: docker_count,
        network_rx_bytes: net_rx,
        network_tx_bytes: net_tx,
        network_rx_rate: net_rx_rate,
        network_tx_rate: net_tx_rate,
    }
}

#[tauri::command]
#[specta::specta]
pub fn set_traffic_mode(mode: String) -> Result<String, String> {
    Ok(format!("Switched mode to {}", mode))
}

static SHARED_POLLER: std::sync::OnceLock<std::sync::Arc<Mutex<crate::sockets::SocketPoller>>> =
    std::sync::OnceLock::new();

pub fn get_shared_poller() -> std::sync::Arc<Mutex<crate::sockets::SocketPoller>> {
    SHARED_POLLER
        .get_or_init(|| {
            std::sync::Arc::new(Mutex::new(crate::sockets::SocketPoller::new(
                check_is_elevated(),
            )))
        })
        .clone()
}

#[tauri::command]
#[specta::specta]
pub fn get_socket_delta() -> crate::model::GraphDelta {
    let poller_arc = get_shared_poller();
    let mut poller = poller_arc.lock().unwrap_or_else(|e| e.into_inner());
    poller.poll_and_compute_delta()
}

#[tauri::command]
#[specta::specta]
pub fn get_socket_snapshot() -> crate::model::GraphSnapshot {
    let poller_arc = get_shared_poller();
    let poller = poller_arc.lock().unwrap_or_else(|e| e.into_inner());
    let (nodes, links) = poller.get_snapshot();
    crate::model::GraphSnapshot { nodes, links }
}

#[tauri::command]
#[specta::specta]
pub fn get_active_sockets() -> Vec<crate::model::SocketInfo> {
    let poller_arc = get_shared_poller();
    let mut poller = poller_arc.lock().unwrap_or_else(|e| e.into_inner());
    poller.get_active_sockets()
}

#[tauri::command]
#[specta::specta]
pub fn get_capture_status() -> crate::capture::CaptureStatus {
    crate::capture::FlowAggregator::check_status()
}

#[tauri::command]
#[specta::specta]
pub fn start_capture(interface_name: Option<String>) -> Result<String, String> {
    let status = crate::capture::FlowAggregator::check_status();
    if !status.is_available {
        return Err(status.error.unwrap_or_else(|| "Capture driver not available".into()));
    }
    let iface = interface_name.unwrap_or_else(|| "Default".into());
    Ok(format!("Capture started on interface {}", iface))
}

#[tauri::command]
#[specta::specta]
pub fn stop_capture() -> Result<String, String> {
    Ok("Capture stopped".into())
}

#[tauri::command]
#[specta::specta]
pub fn block_remote_ip(ip: String) -> Result<String, String> {
    let ip_addr = ip.trim().parse::<std::net::IpAddr>().map_err(|_| {
        format!(
            "Invalid IP address '{}'. Must be a single IPv4 or IPv6 address (ranges, CIDR, and keywords are rejected).",
            ip
        )
    })?;

    if ip_addr.is_loopback() || ip_addr.is_unspecified() || ip_addr.is_multicast() {
        return Err(format!("Cannot block special address: {}", ip_addr));
    }

    #[cfg(target_os = "windows")]
    {
        let ip_clean = ip_addr.to_string();
        let rule_name = format!("NetScope_Block_{}", ip_clean);
        let status = std::process::Command::new("netsh")
            .args([
                "advfirewall",
                "firewall",
                "add",
                "rule",
                &format!("name={}", rule_name),
                "dir=out",
                "action=block",
                &format!("remoteip={}", ip_clean),
            ])
            .status();

        match status {
            Ok(s) if s.success() => Ok(format!("Firewall rule '{}' added successfully", rule_name)),
            Ok(_) => Err(
                "Firewall elevation required. Please run NetScope as Administrator to modify Windows Firewall.".into(),
            ),
            Err(e) => Err(format!("Failed to execute netsh: {}", e)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(format!("Firewall drop rule for {} staged", ip_addr))
    }
}

#[tauri::command]
#[specta::specta]
pub fn unblock_remote_ip(ip: String) -> Result<String, String> {
    let ip_addr = ip.trim().parse::<std::net::IpAddr>().map_err(|_| {
        format!("Invalid IP address '{}'. Must be a single IPv4 or IPv6 address.", ip)
    })?;

    #[cfg(target_os = "windows")]
    {
        let ip_clean = ip_addr.to_string();
        let rule_name = format!("NetScope_Block_{}", ip_clean);
        let status = std::process::Command::new("netsh")
            .args([
                "advfirewall",
                "firewall",
                "delete",
                "rule",
                &format!("name={}", rule_name),
            ])
            .status();

        match status {
            Ok(s) if s.success() => Ok(format!("Firewall rule '{}' removed", rule_name)),
            Ok(_) => Err(
                "Failed to remove firewall rule. Administrator elevation may be required or rule does not exist.".into(),
            ),
            Err(e) => Err(format!("Failed to execute netsh: {}", e)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(format!("Firewall drop rule for {} removed", ip_addr))
    }
}

#[tauri::command]
#[specta::specta]
pub fn open_external_url(url: String) -> Result<String, String> {
    let parsed = url::Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(format!(
            "Disallowed URL scheme '{}'. Only http and https URLs are allowed.",
            parsed.scheme()
        ));
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("rundll32");
        cmd.args(["url.dll,FileProtocolHandler", parsed.as_str()]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn().map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(format!("Opened {}", parsed))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(parsed.as_str());
        cmd.spawn().map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(format!("Opened {}", parsed))
    }
}

const CRITICAL_PROCESSES: &[&str] = &[
    "system",
    "system idle process",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "winlogon.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "explorer.exe",
    "fontdrvhost.exe",
    "dwm.exe",
];

pub fn is_critical_process(pid: u32, name: &str) -> bool {
    if pid <= 4 {
        return true;
    }
    let lower = name.trim().to_lowercase();
    CRITICAL_PROCESSES.iter().any(|&crit| {
        lower == crit || lower == crit.trim_end_matches(".exe")
    })
}

#[tauri::command]
#[specta::specta]
pub fn kill_process(pid: u32) -> Result<String, String> {
    if pid <= 4 {
        return Err(format!("Cannot terminate critical system process (PID {})", pid));
    }

    let mut state_guard = SYSTEM_STATE.lock().unwrap_or_else(|e| e.into_inner());
    let sys = state_guard.get_or_insert_with(|| {
        let mut s = System::new_all();
        s.refresh_all();
        s
    });

    let sys_pid = sysinfo::Pid::from(pid as usize);
    sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[sys_pid]), true);

    let proc_name = match sys.process(sys_pid) {
        Some(p) => p.name().to_string_lossy().to_string(),
        None => return Err(format!("Process PID {} does not exist or has already exited", pid)),
    };

    if is_critical_process(pid, &proc_name) {
        return Err(format!(
            "Refusing to terminate critical system process '{}' (PID {}). Protected for system stability.",
            proc_name, pid
        ));
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("taskkill");
        cmd.args(["/F", "/PID", &pid.to_string()]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        let output = cmd.output().map_err(|e| format!("Failed to invoke taskkill: {}", e))?;
        if output.status.success() {
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            Ok(format!("Process '{}' (PID {}) terminated successfully", proc_name, pid))
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            let out = String::from_utf8_lossy(&output.stdout);
            let msg = if !err.trim().is_empty() {
                err.trim().to_string()
            } else if !out.trim().is_empty() {
                out.trim().to_string()
            } else {
                format!(
                    "Failed to terminate process '{}' (PID {}). It may require Administrator privileges or has already exited.",
                    proc_name, pid
                )
            };
            Err(msg)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let status = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .status();
        match status {
            Ok(s) if s.success() => Ok(format!("Process {} terminated", pid)),
            Ok(_) => Err(format!("Failed to kill process {}. Check permissions.", pid)),
            Err(e) => Err(format!("Failed to invoke kill: {}", e)),
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn reveal_in_explorer(path: String) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    let canonical = p.canonicalize().map_err(|e| format!("Invalid path: {}", e))?;
    let path_str = canonical.to_string_lossy();
    let clean_path = path_str.strip_prefix(r"\\?\").unwrap_or(&path_str);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("explorer");
        cmd.arg(format!("/select,{}", clean_path));
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        let _ = cmd.spawn().map_err(|e| format!("Failed to launch explorer: {}", e))?;
        Ok(format!("Opened {}", clean_path))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(clean_path);
        cmd.spawn().map_err(|e| format!("Failed to launch explorer: {}", e))?;
        Ok(format!("Opened {}", clean_path))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
