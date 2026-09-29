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
        mode: "simulator".into(),
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

    let disks = Disks::new_with_refreshed_list();
    let mut disk_free = 0u64;
    let mut disk_total = 0u64;
    for disk in &disks {
        disk_free += disk.available_space();
        disk_total += disk.total_space();
    }
    let disk_pct = if disk_total > 0 {
        ((disk_total - disk_free) as f32 / disk_total as f32) * 100.0
    } else {
        0.0
    };

    SystemMetrics {
        cpu_usage,
        ram_used_bytes: ram_used,
        ram_total_bytes: ram_total,
        ram_usage_percent: ram_pct,
        gpu_usage: Some(2.0),
        gpu_temp: Some(49.0),
        disk_free_bytes: disk_free,
        disk_total_bytes: disk_total,
        disk_usage_percent: disk_pct,
        docker_containers: 0,
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
