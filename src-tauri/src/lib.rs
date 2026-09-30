pub mod capture;
pub mod commands;
pub mod events;
pub mod model;
pub mod sockets;
pub mod threats;

use tauri_specta::{collect_commands, Builder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::get_app_info,
        commands::get_system_metrics,
        commands::trigger_simulation,
        commands::clean_simulations,
        commands::set_traffic_mode,
        commands::get_socket_delta,
        commands::get_socket_snapshot,
        commands::get_capture_status,
        commands::start_capture,
        commands::stop_capture,
        commands::block_remote_ip,
        commands::unblock_remote_ip,
    ]);

    #[cfg(debug_assertions)]
    let _ = builder.export(specta_typescript::Typescript::default(), "../src/bindings.ts");

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
