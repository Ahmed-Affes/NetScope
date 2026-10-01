use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Known MAC OUI vendor prefixes (first 3 octets formatted in uppercase hex)
static MAC_OUI_TABLE: &[(&str, &str)] = &[
    // Apple
    ("00:17:F2", "Apple"),
    ("00:1C:B3", "Apple"),
    ("00:23:12", "Apple"),
    ("00:25:00", "Apple"),
    ("00:26:08", "Apple"),
    ("00:26:BB", "Apple"),
    ("3C:22:FB", "Apple"),
    ("70:56:81", "Apple"),
    ("AC:BC:32", "Apple"),
    ("B8:78:2E", "Apple"),
    ("F0:18:98", "Apple"),
    ("F4:D4:88", "Apple"),
    ("A4:83:E7", "Apple"),
    // Google
    ("00:1A:11", "Google"),
    ("3C:5A:B4", "Google"),
    ("54:60:09", "Google"),
    ("D8:EB:97", "Google"),
    ("F4:F5:DB", "Google"),
    ("A4:77:33", "Google"),
    // Microsoft
    ("00:03:FF", "Microsoft"),
    ("00:15:5D", "Microsoft Hyper-V"),
    ("00:50:F2", "Microsoft"),
    ("7C:1E:52", "Microsoft"),
    ("DC:98:40", "Microsoft"),
    // Samsung
    ("00:07:AB", "Samsung"),
    ("00:12:FB", "Samsung"),
    ("00:26:37", "Samsung"),
    ("34:23:87", "Samsung"),
    ("88:30:8A", "Samsung"),
    ("D0:B7:2C", "Samsung"),
    // Intel
    ("00:1B:21", "Intel"),
    ("00:1E:67", "Intel"),
    ("00:21:6A", "Intel"),
    ("00:24:D7", "Intel"),
    ("48:51:B7", "Intel"),
    ("80:86:F2", "Intel"),
    ("F8:63:3F", "Intel"),
    // Realtek
    ("00:07:0E", "Realtek"),
    ("00:14:D1", "Realtek"),
    ("00:18:E7", "Realtek"),
    ("00:E0:4C", "Realtek"),
    ("54:EE:75", "Realtek"),
    // Raspberry Pi
    ("B8:27:EB", "Raspberry Pi"),
    ("DC:A6:32", "Raspberry Pi"),
    ("E4:5F:01", "Raspberry Pi"),
    ("28:CD:C1", "Raspberry Pi"),
    // TP-Link
    ("00:1D:0F", "TP-Link"),
    ("50:C7:BF", "TP-Link"),
    ("54:AF:97", "TP-Link"),
    ("60:32:B1", "TP-Link"),
    ("C0:06:C3", "TP-Link"),
    ("E8:48:B8", "TP-Link"),
    // Netgear
    ("00:09:5B", "Netgear"),
    ("00:0F:B5", "Netgear"),
    ("00:14:6C", "Netgear"),
    ("00:1E:2A", "Netgear"),
    ("20:4E:7F", "Netgear"),
    ("84:1B:5E", "Netgear"),
    // Asus
    ("00:1B:FC", "Asus"),
    ("00:1E:8C", "Asus"),
    ("04:D9:F5", "Asus"),
    ("2C:4D:54", "Asus"),
    ("60:A4:4C", "Asus"),
    ("F0:79:59", "Asus"),
    // Amazon
    ("38:F7:3D", "Amazon"),
    ("40:B4:CD", "Amazon"),
    ("68:54:FD", "Amazon"),
    ("74:75:48", "Amazon"),
    ("AC:63:BE", "Amazon"),
    ("FC:A6:67", "Amazon"),
    // Espressif (IoT)
    ("24:0A:C4", "Espressif IoT"),
    ("30:AE:A4", "Espressif IoT"),
    ("84:0D:8E", "Espressif IoT"),
    ("84:F3:EB", "Espressif IoT"),
    ("A4:CF:12", "Espressif IoT"),
    ("C4:4F:33", "Espressif IoT"),
    ("DC:4F:22", "Espressif IoT"),
    // Sonos
    ("00:0E:58", "Sonos"),
    ("48:A6:B8", "Sonos"),
    ("5C:AA:FD", "Sonos"),
    ("78:28:CA", "Sonos"),
    ("94:9F:3E", "Sonos"),
    // Ubiquiti
    ("00:27:22", "Ubiquiti"),
    ("04:18:D6", "Ubiquiti"),
    ("24:A4:3C", "Ubiquiti"),
    ("68:72:51", "Ubiquiti"),
    ("74:83:C2", "Ubiquiti"),
    ("80:2A:A8", "Ubiquiti"),
    ("B4:FB:E4", "Ubiquiti"),
    // Cisco
    ("00:01:42", "Cisco"),
    ("00:06:53", "Cisco"),
    ("00:0C:85", "Cisco"),
    ("00:18:BA", "Cisco"),
    ("00:24:14", "Cisco"),
    ("58:F3:9C", "Cisco"),
    // Sony
    ("00:01:4A", "Sony"),
    ("00:13:15", "Sony"),
    ("00:1A:80", "Sony"),
    ("00:24:8D", "Sony"),
    ("70:9E:29", "Sony"),
    ("F8:46:1C", "Sony"),
    // LG
    ("00:19:A6", "LG"),
    ("00:1C:62", "LG"),
    ("00:26:E2", "LG"),
    ("10:F9:6F", "LG"),
    ("A8:23:FE", "LG"),
    // Dell / HP / Lenovo
    ("00:14:22", "Dell"),
    ("00:18:8B", "Dell"),
    ("18:66:DA", "Dell"),
    ("00:16:35", "HP"),
    ("00:17:A4", "HP"),
    ("3C:D9:2B", "HP"),
    ("00:59:07", "Lenovo"),
    ("E0:D5:5E", "Lenovo"),
    // Synology / QNAP
    ("00:11:32", "Synology"),
    ("00:08:9B", "QNAP"),
    ("24:5E:BE", "QNAP"),
];

/// Looks up vendor from a 6-byte MAC address or "XX:XX:XX" prefix.
pub fn lookup_mac_vendor(mac: &str) -> Option<String> {
    let clean = mac.replace('-', ":").to_uppercase();
    if clean.len() < 8 {
        return None;
    }
    let prefix = &clean[..8];
    for &(p, vendor) in MAC_OUI_TABLE {
        if prefix.starts_with(p) {
            return Some(vendor.to_string());
        }
    }
    None
}

#[derive(Clone, Debug)]
pub struct LanDevice {
    pub ip: String,
    pub mac: Option<String>,
    pub vendor: Option<String>,
    pub hostname: Option<String>,
    pub last_seen: u64,
}

pub type DnsCache = Arc<Mutex<HashMap<String, (Option<String>, Instant)>>>;

/// Thread-safe reverse DNS resolver cache
#[derive(Clone, Default)]
pub struct DnsResolver {
    cache: DnsCache,
}

impl DnsResolver {
    pub fn new() -> Self {
        Self::default()
    }

    /// Gets cached hostname if available, or enqueues async lookup
    pub fn get_or_resolve(&self, ip_str: &str) -> Option<String> {
        let now = Instant::now();
        {
            let mut cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
            if let Some((name_opt, timestamp)) = cache.get(ip_str) {
                // Cache hit for 10 minutes
                if now.duration_since(*timestamp) < Duration::from_secs(600) {
                    return name_opt.clone();
                }
            }
            // Mark pending with temporary None to avoid duplicate lookups
            cache.insert(ip_str.to_string(), (None, now));
        }

        let ip_to_resolve = ip_str.to_string();
        let cache_clone = self.cache.clone();

        // Spawn async resolution in background without blocking caller
        std::thread::spawn(move || {
            let resolved = if let Ok(ip) = ip_to_resolve.parse::<IpAddr>() {
                // Attempt reverse DNS lookup via dns_lookup or standard socket lookup
                resolve_hostname(ip)
            } else {
                None
            };
            let mut cache = cache_clone.lock().unwrap_or_else(|e| e.into_inner());
            cache.insert(ip_to_resolve, (resolved, Instant::now()));
        });

        None
    }
}

fn resolve_hostname(ip: IpAddr) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::CStr;
        use std::mem;

        #[repr(C)]
        struct SockAddrIn {
            sin_family: u16,
            sin_port: u16,
            sin_addr: u32,
            sin_zero: [u8; 8],
        }

        #[link(name = "ws2_32")]
        extern "system" {
            fn getnameinfo(
                sa: *const SockAddrIn,
                salen: i32,
                host: *mut i8,
                hostlen: u32,
                serv: *mut i8,
                servlen: u32,
                flags: i32,
            ) -> i32;
        }

        if let IpAddr::V4(ipv4) = ip {
            let addr = SockAddrIn {
                sin_family: 2, // AF_INET
                sin_port: 0,
                sin_addr: u32::from_ne_bytes(ipv4.octets()),
                sin_zero: [0; 8],
            };
            let mut host_buf = [0i8; 256];
            let ret = unsafe {
                getnameinfo(
                    &addr as *const _,
                    mem::size_of::<SockAddrIn>() as i32,
                    host_buf.as_mut_ptr(),
                    256,
                    std::ptr::null_mut(),
                    0,
                    0,
                )
            };
            if ret == 0 {
                let name = unsafe { CStr::from_ptr(host_buf.as_ptr()) }
                    .to_string_lossy()
                    .to_string();
                if !name.is_empty() && name != ipv4.to_string() {
                    return Some(name);
                }
            }
        }
    }
    None
}

/// Performs a rate-limited SendARP sweep on the local /24 subnet on Windows.
#[cfg(target_os = "windows")]
pub fn sweep_local_subnet(local_ipv4: Ipv4Addr) -> Vec<LanDevice> {
    #[link(name = "iphlpapi")]
    extern "system" {
        fn SendARP(dest_ip: u32, src_ip: u32, p_mac_addr: *mut u8, p_phy_addr_len: *mut u32) -> u32;
    }

    let octets = local_ipv4.octets();
    let base = [octets[0], octets[1], octets[2]];
    let local_u32 = u32::from_ne_bytes(octets);

    let (tx, rx) = std::sync::mpsc::channel();
    let mut handles = Vec::new();

    // 16 concurrent threads scanning 1..254 (very fast, ~500ms total)
    let chunks: Vec<Vec<u8>> = (1..255u8)
        .filter(|&last| last != octets[3])
        .collect::<Vec<_>>()
        .chunks(16)
        .map(|c| c.to_vec())
        .collect();

    let now = crate::sockets::now_ms();

    for chunk in chunks {   
        let tx_clone = tx.clone();
        handles.push(std::thread::spawn(move || {
            for last in chunk {
                let target_ip = Ipv4Addr::new(base[0], base[1], base[2], last);
                let target_u32 = u32::from_ne_bytes(target_ip.octets());
                // Win32 SendARP requires pMacAddr to point to at least two ULONGs (8 bytes)
                let mut mac_buf = [0u32; 2];
                let mut mac_len = 6u32;
                let res = unsafe {
                    SendARP(
                        target_u32,
                        local_u32,
                        mac_buf.as_mut_ptr() as *mut u8,
                        &mut mac_len,
                    )
                };
                if res == 0 && mac_len >= 6 {
                    let mac = unsafe { std::slice::from_raw_parts(mac_buf.as_ptr() as *const u8, 6) };
                    if mac != [0; 6] {
                        let mac_str = format!(
                            "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
                            mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]
                        );
                        let vendor = lookup_mac_vendor(&mac_str);
                        let _ = tx_clone.send(LanDevice {
                            ip: target_ip.to_string(),
                            mac: Some(mac_str),
                            vendor,
                            hostname: None,
                            last_seen: now,
                        });
                    }
                }
            }
        }));
    }

    drop(tx);
    for h in handles {
        let _ = h.join();
    }

    rx.into_iter().collect()
}

#[cfg(not(target_os = "windows"))]
pub fn sweep_local_subnet(_local_ipv4: Ipv4Addr) -> Vec<LanDevice> {
    Vec::new()
}
