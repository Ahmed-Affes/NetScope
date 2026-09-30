use crate::model::{AppInfo, SystemMetrics};
use std::sync::Mutex;
use sysinfo::{Disks, System};

// Lazy or static holder for system information to minimize overhead
static SYSTEM_STATE: Mutex<Option<System>> = Mutex::new(None);

#[tauri::command]
#[specta::specta]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "NetScope".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        mode: "live".into(),
        is_elevated: false,
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_system_metrics() -> SystemMetrics {
    let mut state_guard = SYSTEM_STATE.lock().unwrap();
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
        let mut disk_guard = LAST_DISK_CHECK.lock().unwrap();
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
    }
}

#[tauri::command]
#[specta::specta]
pub fn trigger_simulation(scenario: String) -> Result<String, String> {
    Ok(format!("Simulation scenario '{}' triggered", scenario))
}

#[tauri::command]
#[specta::specta]
pub fn clean_simulations() -> Result<String, String> {
    Ok("All simulated nodes, links and alerts cleaned".into())
}

#[tauri::command]
#[specta::specta]
pub fn set_traffic_mode(mode: String) -> Result<String, String> {
    Ok(format!("Switched mode to {}", mode))
}

static SOCKET_POLLER: Mutex<Option<crate::sockets::SocketPoller>> = Mutex::new(None);

#[tauri::command]
#[specta::specta]
pub fn get_socket_delta() -> crate::model::GraphDelta {
    let mut poller_guard = SOCKET_POLLER.lock().unwrap();
    let poller = poller_guard.get_or_insert_with(crate::sockets::SocketPoller::new);
    poller.poll_and_compute_delta()
}

#[tauri::command]
#[specta::specta]
pub fn get_socket_snapshot() -> crate::model::GraphSnapshot {
    let mut poller_guard = SOCKET_POLLER.lock().unwrap();
    let poller = poller_guard.get_or_insert_with(crate::sockets::SocketPoller::new);
    let (nodes, links) = poller.get_snapshot();
    crate::model::GraphSnapshot { nodes, links }
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
    #[cfg(target_os = "windows")]
    {
        let rule_name = format!("NetScope_Block_{}", ip);
        let status = std::process::Command::new("netsh")
            .args([
                "advfirewall",
                "firewall",
                "add",
                "rule",
                &format!("name={}", rule_name),
                "dir=out",
                "action=block",
                &format!("remoteip={}", ip),
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
        Ok(format!("Firewall drop rule for {} staged", ip))
    }
}

#[tauri::command]
#[specta::specta]
pub fn unblock_remote_ip(ip: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let rule_name = format!("NetScope_Block_{}", ip);
        let _ = std::process::Command::new("netsh")
            .args([
                "advfirewall",
                "firewall",
                "delete",
                "rule",
                &format!("name={}", rule_name),
            ])
            .status();
        Ok(format!("Firewall rule '{}' removed", rule_name))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(format!("Firewall drop rule for {} removed", ip))
    }
}

#[tauri::command]
#[specta::specta]
pub fn open_external_url(url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/c", "start", "", &url]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn().map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(format!("Opened {}", url))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
        Ok(format!("Opened {}", url))
    }
}
