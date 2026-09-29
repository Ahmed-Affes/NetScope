# NetScope 🌐⚡

> Real-time network topology visualizer and threat detection dashboard. Shows everything your computer communicates with on the network as a glowing, interactive force-directed graph.

---

## Features

- **Live Force-Directed Graph:** High-performance WebGL rendering via PixiJS v8 at 60 FPS, with particle flow on links, logarithmic node sizing, and smooth camera physics.
- **Process Attribution:** Maps socket connections directly to local processes, executable paths, and container names.
- **Threat Engine & Attack Simulator:** Real-time heuristic detection (beaconing, data exfiltration, port scanning, raw IP connections) and 7 built-in attack simulation scenarios.
- **Cloud-Only Storage:** Zero local databases or data files. Auth, session recordings, settings, and shared links are persisted strictly in Supabase via batched RPCs.
- **Time Machine (Record & Replay):** Record network sessions into RAM buffers, flush to cloud, and scrub through history with variable speeds and anomaly jumping.
- **Zero-Privilege Out of the Box:** Runs in socket-monitoring mode without administrator rights; full packet capture activates seamlessly when permissions are present.

---

## Tech Stack

- **Shell:** Tauri 2
- **Backend:** Rust 2021 (`tokio`, `serde`, `pcap`, `etherparse`, `netstat2`, `sysinfo`, `keyring`, `tauri-specta`)
- **Frontend:** React 19, TypeScript (strict), Vite, Tailwind CSS, shadcn/ui, Zustand
- **Renderer:** PixiJS v8 (imperative WebGL engine outside React)
- **Physics:** `d3-force` running in a dedicated Web Worker via `Float32Array` buffers
- **Storage:** Supabase (Auth, Postgres + RLS, Realtime Broadcast)

---

## Development Setup

### Prerequisites
- Node.js 20+ and `pnpm`
- Rust 1.78+ (`rustup`)
- C++ Build Tools (Visual Studio Build Tools on Windows, `build-essential` on Linux, Xcode Command Line Tools on macOS)
- Optional for packet capture: Npcap (Windows) or `libpcap` (Linux/macOS)

### Running Locally
```bash
# Install frontend dependencies
pnpm install

# Start development desktop app
pnpm tauri dev
```
