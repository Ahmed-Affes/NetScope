# NetScope 🌐⚡

[![CI Verification](https://github.com/Ahmed-Affes/NetScope/actions/workflows/ci.yml/badge.svg)](https://github.com/Ahmed-Affes/NetScope/actions/workflows/ci.yml)
[![Tauri 2](https://img.shields.io/badge/Tauri-v2.2-24C8D5?logo=tauri&logoColor=white)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7_Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8.7_WebGL-E72264?logo=pixijs&logoColor=white)](https://pixijs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

> **NetScope** is a high-performance desktop cyber-ops dashboard that visualizes, in real-time, every active connection on your machine as an interactive glowing 60 FPS graph.

---

## ⚡ What You Can Do With NetScope

- **Live 60 FPS Force-Directed Graph:** High-performance WebGL rendering via PixiJS v8 outside the React render loop. Physics computed asynchronously in a Web Worker via `d3-force` streaming `Float32Array` buffers.
- **Process & Hub Attribution:** Groups connections by owning process (`PID`), Docker containers, Tailscale mesh, LAN endpoints, and Internet hosts.
- **Real-Time Threat Engine:** Detects Cobalt Strike C2 beaconing heartbeats, large-scale data exfiltration spikes, port scans, and Shannon domain entropy DGAs.
- **ATK-SIM (Attack Simulator):** Built-in cyber attack simulator with 7 real-world attack vectors (SSH Brute Force, Exfiltration, DDoS Syn Flood, Nmap Scan, C2 Callback, Rogue Device, and Full Assault).
- **Time Machine (Record & Replay):** In-memory 1-second rolling buckets flushed to cloud every 10 seconds. Scrub through past sessions, change speed (0.5x to 16x), and jump directly to traffic spikes.
- **Remote HUD Viewer:** Stream your desktop's live network topology in real-time to your phone or tablet via Supabase Realtime and instant QR code pairing.
- **Firewall Quarantine:** One-click endpoint quarantine via Windows Defender Firewall (`netsh`) or Linux `iptables`.
- **Zero-Local-DB Guarantee:** Absolutely zero plaintext logs or SQLite database files written to disk. Ephemeral RAM memory or encrypted Supabase cloud storage only.

---

## 🛰️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NETSCOPE DESKTOP                               │
├───────────────────────────────┬─────────────────────────────────────────────┤
│      TAURI 2 (RUST CORE)      │             REACT 19 + PIXIJS V8            │
│  - Socket Poller (netstat/ss) │  - PixiJS v8 High-Perf Canvas (60 FPS)      │
│  - Flow Aggregator (5-tuple)  │  - Web Worker d3-force Physics Simulation   │
│  - Process Attribution (PID)  │  - Zustand State Store & Rolling Sparklines │
│  - OS Firewall Rules (netsh)  │  - ATK-SIM Live Scenario Injector           │
│  - Npcap / pcap Driver Bridge │  - Mobile Remote Viewer Modal (QR Code)     │
└───────────────┬───────────────┴──────────────────────┬──────────────────────┘
                │ IPC (Commands & Specta Events)       │
                ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE CLOUD PERSISTENCE                         │
│  - User Auth & Device Inventory                                             │
│  - In-Memory 1s Aggregation Buckets -> 10s Batch Chunks RPC                 │
│  - Realtime Broadcast (Phone HUD Viewer)                                    │
│  - Zero Local DB Rule (Zero disk leakage)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart Guide: What To Do

### 1. Run in Web Simulator Mode (Immediate 60 FPS Demo)
You can run NetScope right away in your web browser without compiling any native Rust dependencies:

```bash
# Clone the repository
git clone https://github.com/Ahmed-Affes/NetScope.git
cd NetScope

# Install dependencies
pnpm install

# Start Vite dev server
pnpm dev
```
Open **[http://localhost:5173](http://localhost:5173)**. You will see the glowing cyber-ops dashboard, live traffic simulator, sparkline inspector, and ATK-SIM panel!

### 2. Run Native Desktop App (Tauri 2 Shell)
To run the full desktop shell with native OS socket table inspection:

```bash
pnpm tauri dev
```

### 3. Run Tests & Validation
```bash
# Run Vitest unit tests (Store, Deltas)
pnpm test

# Typecheck and build production bundle
pnpm build
```

---

## ⚙️ Optional Supabase Configuration

NetScope works **100% out of the box** without any configuration using an in-memory session buffer.

If you wish to connect your own Supabase project for persistent cloud recordings and device sync:
1. Create a project at [supabase.com](https://supabase.com).
2. Execute the migration in `supabase/migrations/20260929000000_netscope_schema.sql` via the Supabase SQL Editor.
3. Create a `.env` file in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Restart `pnpm dev`. Your recorded sessions will now sync to your cloud account!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| -------- | ------ |
| `Ctrl + K` or `/` | Open Cyber Command Palette |
| `1` | Switch to Force-Directed Layout |
| `2` | Switch to Radial Orbit Layout |
| `3` | Switch to Geographic Regional Layout |
| `4` | Switch to 3D Isometric Layered Mode |
| `Esc` | Deselect active node / link |

---

## 🛡️ License & Policies

- **License:** [MIT License](LICENSE)
- **Privacy Policy:** [PRIVACY.md](PRIVACY.md)
- **Security Policy:** [SECURITY.md](SECURITY.md)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Third-Party Licenses:** [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)
