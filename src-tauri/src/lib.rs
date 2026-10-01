pub mod capture;
pub mod commands;
pub mod events;
pub mod model;
pub mod sockets;
pub mod threats;

#[cfg(not(test))]
use tauri_specta::{collect_commands, Builder};

#[cfg(test)]
pub fn run() {}

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::get_app_info,
        commands::get_system_metrics,
        commands::set_traffic_mode,
        commands::get_socket_delta,
        commands::get_socket_snapshot,
        commands::get_active_sockets,
        commands::get_capture_status,
        commands::start_capture,
        commands::stop_capture,
        commands::block_remote_ip,
        commands::unblock_remote_ip,
        commands::open_external_url,
        commands::kill_process,
        commands::reveal_in_explorer,
        commands::relaunch_elevated,
    ]);

    // bindings.ts is maintained manually in src/bindings.ts
    // The file uses dynamic import of @tauri-apps/api/core so it works in both
    // Tauri desktop mode and CI (no Tauri runtime) without regeneration.
    // #[cfg(debug_assertions)]
    // let _ = builder.export(specta_typescript::Typescript::default(), "../src/bindings.ts");

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            let app_handle = app.handle().clone();
            let poller = commands::get_shared_poller();
            sockets::start_poller_thread(app_handle, poller);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
