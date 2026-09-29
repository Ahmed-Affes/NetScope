# NetScope: Full Build Plan & Progress Tracking

NetScope is a desktop application that displays everything your computer communicates with on the network in real time as an interactive, glowing force-directed cyber-ops graph.

---

## 1. System Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   React 19 Frontend                    │
│  ┌────────────────────┐    ┌─────────────────────────┐ │
│  │   Zustand Stores   │    │      UI Components      │ │
│  │ (nodes, links, etc)│    │ (Panels, Inspector, etc)│ │
│  └─────────┬──────────┘    └────────────┬────────────┘ │
│            │                            │              │
│  ┌─────────▼────────────────────────────▼────────────┐ │
│  │             PixiJS v8 Graph Engine                │ │
│  │       (Outside React, Canvas WebGL 60fps)         │ │
│  └───────────────────────┬───────────────────────────┘ │
│                          │ Float32Array                │
│  ┌───────────────────────▼───────────────────────────┐ │
│  │        d3-force Web Worker (Layout Physics)       │ │
│  └───────────────────────────────────────────────────┘ │
└──────────────────────────▲─────────────────────────────┘
                           │ 10 Hz Batched Deltas (Tauri Events)
┌──────────────────────────▼─────────────────────────────┐
│                    Tauri 2 / Rust                      │
│  ┌───────────────────────────────────────────────────┐ │
│  │         Unified TrafficSource Event Stream        │ │
│  │    (Simulator / Live Capture / Replay Source)     │ │
│  └─────────▲────────────────────▲──────────────────▲─┘ │
│            │                    │                  │   │
│     ┌──────┴──────┐      ┌──────┴──────┐    ┌──────┴──┐│
│     │  Simulator  │      │Live Capture │    │ Replay  ││
│     │  Engine     │      │(Sockets/Pcap│    │(Supabase││
│     └─────────────┘      └─────────────┘    └─────────┘│
│                                  │                     │
│                        ┌─────────▼─────────┐           │
│                        │  Threat Engine &  │           │
│                        │    Aggregator     │           │
│                        └───────────────────┘           │
└────────────────────────────────────────────────────────┘
```

---

## 2. Phase Breakdown and Status

- [x] **Phase 0: Scaffold**
  - [x] Git repository initialization & remote origin configured
  - [x] Toolchain setup (Rust stable, pnpm 12, Tauri 2 CLI)
  - [x] Frontend setup: React 19 + TypeScript strict + Vite + Tailwind CSS + shadcn/ui + Zustand
  - [x] Backend setup: Tauri 2 + tauri-specta + serde + tokio
  - [x] Custom dark frameless window with custom title bar
  - [x] GitHub Actions CI workflow for test/build
  - [x] Acceptance check: typed commands, strict ts, vitest unit tests passing

- [x] **Phase 1: Graph Engine + Simulator**
  - [x] PixiJS v8 WebGL canvas rendering engine with glow sprites, gradient links, and particles
  - [x] d3-force layout running in Web Worker transferring Float32Array
  - [x] Unified TrafficSource contract
  - [x] Realistic 10 Hz batched simulator topology matching target cyber-ops dashboard
  - [x] Acceptance check: 60fps WebGL rendering, smooth camera pan/zoom/drag, hover-dim

- [x] **Phase 2: Panels and Interaction**
  - [x] Collapsible System Metrics panel (CPU, RAM, GPU, Disk, Docker)
  - [x] Collapsible Legend panel with click-to-filter
  - [x] Bottom stats pill (Nodes: 98 | Links: 42 | Threats: 0)
  - [x] Slide-in Inspector for selected Node or Link with custom SVG sparkline
  - [x] ATK-SIM panel with all 7 scenarios (SSH Brute Force, Exfil, DDoS, Full Assault, C2, Port Scan, Rogue Device)
  - [x] Filter chips bar with dismissible filters
  - [x] Command Palette (Cmd/Ctrl+K or /) with keyboard navigation
  - [x] Acceptance check: all panels interactive and live-updated from event stream

- [ ] **Phase 3: Real Sockets (No-Privilege Mode)**
  - [ ] Socket poller (`netstat2` + `sysinfo`) polling at ~500ms
  - [ ] Socket-to-process attribution: `(proto, local_port) -> (pid, name, path)`
  - [ ] Remote IP classification (LAN, Internet, Gateway, Docker)
  - [ ] Titlebar mode switcher: `SIM / LIVE`
  - [ ] Guided no-privilege banner with option to enable full capture
  - [ ] Acceptance check: shows running processes and remote connections within ~1s without admin rights.

- [ ] **Phase 4: Packet Capture (Full Fidelity)**
  - [ ] `pcap` capture thread + `etherparse` decoding
  - [ ] Flow aggregator keyed by `(proto, src, dst, sport, dport)` joined with socket table
  - [ ] Precise byte/packet counters & throughput rates driving link particles
  - [ ] Npcap/libpcap detection and permission guidance
  - [ ] Acceptance check: download traffic accurately spikes process link within 10% OS counters.

- [ ] **Phase 5: Supabase Auth, Recording & Replay**
  - [ ] Supabase migrations (profiles, sessions, session_nodes, session_links, sample_chunks, alerts, blocked_ips, ip_intel, shared_sessions)
  - [ ] RLS policies and validation
  - [ ] Auth (email + GitHub OAuth deep-link), session token stored in OS keychain via `keyring` crate
  - [ ] RAM buffer for 1s buckets uploaded every 10s via batch RPC
  - [ ] Replay engine with prefetch cache + timeline scrubber (speed, step, spike-jump)
  - [ ] Acceptance check: record 5m, replay with prefetch, diff mode, zero disk writes.

- [ ] **Phase 6: Enrichment & Threat Engine**
  - [ ] Cached reverse DNS, GeoIP/ASN (offline MaxMind / Edge Function fallback), TLS SNI parser
  - [ ] Threat engine (beaconing, exfiltration, port scanning, raw IP connections, DGA entropy)
  - [ ] ATK-SIM 7 synthetic scenarios (SSH brute, exfil, DDoS, full assault, C2 callback, port scan, rogue device)
  - [ ] Alert feed, red pulsing threat nodes, OS notifications
  - [ ] Acceptance check: all 7 ATK-SIM scenarios trigger correct rules, clean-up removes all artifacts.

- [ ] **Phase 7: Layouts, Firewall Actions, Polish**
  - [ ] Radial, Geo-map, and 3D layout modes with smooth transitions
  - [ ] Process-centric hub mode
  - [ ] Command palette (`Cmd/Ctrl+K`)
  - [ ] OS firewall block/unblock actions with explicit confirmation dialogs
  - [ ] Graph screenshot export (PNG) & first-run onboarding
  - [ ] Acceptance check: layout switches seamlessly, firewall block verified.

- [ ] **Phase 8: Cloud Remote Viewer, Release & Landing Page**
  - [ ] Supabase Realtime Broadcast for mobile remote viewer (throttled, masked)
  - [ ] Public read-only share link web viewer
  - [ ] Astro/static landing page with live interactive simulator demo
  - [ ] GitHub Actions release pipeline with multi-platform installers
  - [ ] Acceptance check: end-to-end cloud share and phone viewer flow.

- [ ] **Phase 9: Public Release Hardening**
  - [ ] Quotas and rate limiting enforcement
  - [ ] Zero bundling of Npcap; guided installation
  - [ ] Code signing setup and auto-updater configuration
  - [ ] Privacy controls: IP masking, opt-in crash reporting, data deletion
  - [ ] Third-party license attribution and audit
