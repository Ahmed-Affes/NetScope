use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub type ProcessMetricMap = Arc<Mutex<HashMap<u32, (u64, u64, f64, f64)>>>;

/// Holds per-PID throughput metrics captured from Tier B ETW tracing.
#[derive(Clone, Default)]
pub struct EtwTrafficTracker {
    /// pid -> (total_bytes_in, total_bytes_out, rate_in, rate_out)
    metrics: ProcessMetricMap,
    active: bool,
}

impl EtwTrafficTracker {
    pub fn new(is_elevated: bool) -> Self {
        let tracker = Self {
            metrics: Arc::new(Mutex::new(HashMap::new())),
            active: is_elevated,
        };

        if is_elevated {
            #[cfg(target_os = "windows")]
            tracker.start_trace();
        }

        tracker
    }

    #[cfg(target_os = "windows")]
    fn start_trace(&self) {
        // When running elevated on Windows, we can listen to ETW events.
        // For stability and safety across all Windows versions and MinGW,
        // we isolate ETW session startup in a background thread with panic catching.
        let metrics_clone = self.metrics.clone();
        std::thread::Builder::new()
            .name("netscope-etw-listener".into())
            .spawn(move || {
                let _ = std::panic::catch_unwind(move || {
                    tracing::info!("Initializing Tier B Kernel-Network ETW session...");
                    use ferrisetw::provider::Provider;
                    use ferrisetw::trace::UserTrace;

                    // Microsoft-Windows-Kernel-Network provider GUID: 7dd42a49-5329-4032-8e42-5e87d8727487
                    let kernel_net_guid = ferrisetw::GUID::from_u128(0x7dd42a49_5329_4032_8e42_5e87d8727487);

                    let provider = Provider::by_guid(kernel_net_guid)
                        .add_callback(move |record, schema_locator| {
                            let pid = record.process_id();
                            if pid == 0 {
                                return;
                            }
                            if let Ok(schema) = schema_locator.event_schema(record) {
                                let event_name = schema.task_name();
                                let parser = ferrisetw::parser::Parser::create(record, &schema);
                                let size: u64 = parser
                                    .try_parse::<u32>("size")
                                    .map(|s| s as u64)
                                    .unwrap_or(0);

                                let mut guard = metrics_clone.lock().unwrap_or_else(|e| e.into_inner());
                                let entry = guard.entry(pid).or_insert((0, 0, 0.0, 0.0));
                                if event_name.to_lowercase().contains("recv") {
                                    entry.0 += size;
                                    entry.2 += size as f64;
                                } else {
                                    entry.1 += size;
                                    entry.3 += size as f64;
                                }
                            }
                        })
                        .build();

                    let trace_res = UserTrace::new()
                        .named(format!("NetScopeETW_{}", std::process::id()))
                        .enable(provider)
                        .start();

                    if let Err(e) = trace_res {
                        tracing::warn!("Failed to start ETW user trace session: {:?}", e);
                    }
                });
            })
            .ok();
    }

    /// Fetches rates and resets delta rates for the 1s bucket.
    pub fn harvest_and_reset_rates(&self) -> HashMap<u32, (u64, u64, f64, f64)> {
        let mut guard = self.metrics.lock().unwrap_or_else(|e| e.into_inner());
        let snapshot = guard.clone();
        for val in guard.values_mut() {
            val.2 = 0.0;
            val.3 = 0.0;
        }
        snapshot
    }

    pub fn is_active(&self) -> bool {
        self.active
    }
}
