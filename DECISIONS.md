# NetScope: Architectural & Implementation Decisions

This document records architectural decisions, conventions, tradeoffs, and any deviations or clarifications made during implementation.

---

## 1. Unified Event Stream (`TrafficSource`)
- **Decision:** The frontend consumes an identical stream contract (`GraphDelta` at ~10 Hz) whether data originates from `simulator`, `live`, or `replay`.
- **Rationale:** Keeps the PixiJS graph engine and UI decoupled from network capture details and guarantees zero regressions across modes.

## 2. Memory-Only Capture & Supabase Cloud Storage
- **Decision:** No local SQLite database or temporary raw `.pcap` files on disk. The only local persistence is the auth session token stored in the OS keychain via the `keyring` crate.
- **Rationale:** Complete adherence to the zero-local-data, cloud-only architecture. In-memory circular buffers buffer 1s sample buckets in RAM and flush 10s batched chunks to Supabase via RPC.

## 3. Graph Engine Separation from React
- **Decision:** The PixiJS v8 WebGL graph engine runs imperatively in a dedicated `GraphEngine` class outside the React component tree. React only owns the HUD overlays, inspector slide-in panels, and control buttons.
- **Rationale:** React reconciliation cannot keep up with 60fps WebGL rendering across 500+ glowing nodes, flowing particles, and layout physics updates.

## 4. Layout Physics in Web Worker
- **Decision:** `d3-force` runs in a dedicated Web Worker (`layout.worker.ts`), communicating node coordinates back to the PixiJS render loop via transferable `Float32Array` buffers.
- **Rationale:** Prevents simulation physics calculations from blocking the UI thread or stuttering canvas rendering.

## 5. Dual Privilege Model (Graceful Degradation)
- **Decision:** NetScope launches by default in **no-privilege socket mode** using OS socket tables (`netstat2` + `sysinfo`). Packet capture (`pcap` + `etherparse`) is optionally enabled if permissions (or Npcap on Windows) are available.
- **Rationale:** Ensures immediate out-of-the-box utility without scary UAC prompts or installation barriers, while providing full packet fidelity when permissions are granted.

## 6. Type Safety & Bindings via `tauri-specta`
- **Decision:** All commands and event payloads are typed in Rust and converted to TypeScript definitions via `tauri-specta` into `src/bindings.ts`.
- **Rationale:** Strict compile-time validation between backend and frontend contracts.

## 7. Package Management
- **Decision:** `pnpm` is used for all frontend dependencies.
- **Rationale:** Strict dependency resolution, fast symlinked node_modules, and requirement in project specification.
