# NetScope 🌐⚡

[![CI Verification](https://github.com/Ahmed-Affes/NetScope/actions/workflows/ci.yml/badge.svg)](https://github.com/Ahmed-Affes/NetScope/actions/workflows/ci.yml)
[![Tauri 2](https://img.shields.io/badge/Tauri-v2.2-24C8D5?logo=tauri&logoColor=white)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7_Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8.7_WebGL-E72264?logo=pixijs&logoColor=white)](https://pixijs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

> **NetScope** is a high-performance Windows desktop application that visualizes everything your PC is communicating with in real time as an interactive, hardware-accelerated 60 FPS network topology graph. No terminal commands, no Task Manager, and no Windows network settings required.

---

## ⚡ What NetScope Does

- **Native Win32 Socket Telemetry:** Discovers all TCP/UDP connections, listening ports, states, PIDs, and process names directly using Windows native APIs (`GetExtendedTcpTable` / `GetExtendedUdpTable` via `netstat2`). Runs in a dedicated background thread streaming deltas via Tauri events.
- **Local-to-Local Traffic Correlation:** Loopback (`127.0.0.1`, `::1`) connections are never dropped. Client processes (like VSCode, browser, or custom apps) connect directly to their corresponding local listening service nodes (e.g. `Ollama (11434)`, `Neo4j (7474/7687)`, `Vite (5173)`).
- **Accurate Gateway & Node Classification:**
  - **Gateway:** Determined exclusively from the active Windows routing table (`GetAdaptersAddresses` / `default-net`), never `.1` heuristics. `127.0.0.1` and public `.1` addresses (such as `1.1.1.1` or `8.8.8.1`) are never misclassified as gateways.
  - **Tailscale:** Evaluated before other rules (`100.64.0.0/10` and `fd7a:115c:a1e0::/48`).
  - **Docker:** Detected via default bridge subnets (`172.17.0.0/16`) and virtual network adapters.
  - **LAN:** Discovered via RFC1918, IPv6 ULA, and link-local address spaces.
  - **Monitor:** Observability and metrics services (Prometheus 9090, Grafana 3000, Node Exporter 9100, Netdata 19999, Zabbix).
  - **Internet:** Public external servers and cloud providers.
- **LAN Discovery & Offline Vendor Lookup:** Light, rate-limited Win32 `SendARP` subnet scanning paired with bundled offline MAC OUI vendor resolution without sending device identifiers over the network.
- **Honest Traffic Metering (Tiered Visibility):**
  - **Tier A (Standard User):** Displays connection counts, TCP states, and interface status. Shows `—` for unmeasured per-connection bandwidth (no fake numbers).
  - **Tier B (Elevated Visibility):** One-click UAC prompt enables kernel ETW (`Microsoft-Windows-Kernel-Network`) tracking per-connection throughput in 1-second rolling buckets.
- **Clean Overview vs All Aggregation:**
  - **Overview Mode:** Collapses redundant cloud and CDN endpoints into neat organizational clusters (e.g. Cloudflare, Google, Amazon). Click any cluster to expand.
  - **All Mode:** Shows every individual socket and IP node without aggregation.
- **Level-of-Detail (LOD) Labels:** Labels are automatically optimized for clarity: visible for host, large, hovered, or selected nodes and when zoomed in; hidden for small nodes at default zoom to prevent canvas clutter.
- **Dynamic Legend & Port Pinning:** Legend builds dynamically from live PC traffic, shows active connection counts, dims zero-count services, and allows pinning custom ports persisted in localStorage.
- **Active Filter Recovery:** When a filter matches no traffic, NetScope displays currently active services with one-click alternatives instead of dead empty screens.
- **Inspector & Guardrails:** Plain-language summary of what each node is, where it connects, and listening ports. Critical system processes (`System`, `csrss`, `lsass`, `svchost`, `winlogon`) are shielded from accidental termination.
- **Hardened Security:** Zero `cmd.exe` shell execution, strict Content Security Policy (CSP), poison-safe Rust mutexes, and strict input validation for URLs and IP blocking.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NETSCOPE DESKTOP                               │
├────────────────────────────────────────┬────────────────────────────────────┤
│           TAURI 2 (RUST CORE)          │        REACT 19 + PIXIJS V8        │
│  - Native Win32 GetExtendedTcpTable    │  - PixiJS v8 60 FPS WebGL Canvas   │
│  - Native Win32 GetExtendedUdpTable    │  - Web Worker d3-force Simulation  │
│  - Routing Table Gateway Resolution    │  - Zustand State Store             │
│  - Rate-limited SendARP LAN Discovery  │  - Dynamic Legend & Pinning        │
│  - Kernel ETW Network Metering (Admin) │  - Plain-Language Node Inspector   │
│  - Guarded Process Management          │  - Active Ports & Socket Inspector │
│  - Win32 Firewall Isolation Commands   │  - Overview / All Clustered Views  │
└────────────────────────────────────────┴────────────────────────────────────┘
```

---

## 🚀 Building & Running Locally

### Prerequisites
- [Node.js](https://nodejs.org) (v20 or v22)
- [pnpm](https://pnpm.io) (`npm i -g pnpm`)
- [Rust](https://rustup.rs) (stable)
- Windows 10/11 (x64)

### Development

```bash
# Clone the repository
git clone https://github.com/Ahmed-Affes/NetScope.git
cd NetScope

# Install dependencies
pnpm install

# Run desktop app in development mode
pnpm tauri dev
```

### Running Tests & Verification

```bash
# Run frontend unit tests
pnpm test

# Build frontend production bundle
pnpm build

# Run Rust unit tests
cargo test --manifest-path src-tauri/Cargo.toml

# Run Rust linter
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

---

## 🔐 Security & Code Signing

- For threat modeling and security policies, see [SECURITY.md](SECURITY.md).
- For privacy principles and telemetry handling, see [PRIVACY.md](PRIVACY.md).
- For instructions on setting up Authenticode and Tauri updater code signing, see [docs/CODE_SIGNING.md](docs/CODE_SIGNING.md).

---

## 📄 License

NetScope is licensed under the [MIT License](LICENSE).
