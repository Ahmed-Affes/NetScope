# NetScope Privacy Policy & Zero-Local-DB Guarantee

**Last Updated:** September 2026

At NetScope, privacy is a non-negotiable core architectural constraint. This document provides a transparent breakdown of how NetScope handles network traffic data, authentication, and cloud synchronization.

---

## 1. Zero-Local-DB Guarantee

- **No Local Databases:** NetScope does **not** install or write to any local SQLite, DuckDB, RocksDB, or plaintext data files on your machine.
- **No PCAP Dumps on Disk:** Raw network packets and PCAP dumps are analyzed strictly in volatile memory (RAM) and are never written to disk.
- **RAM-Only Aggregation:** Sockets and flow records are aggregated into 1-second rolling buckets in RAM. If the application is closed without recording, all telemetry evaporates immediately.

---

## 2. Cloud Persistence (Supabase Only)

- **Optional Cloud Recording:** Telemetry is only persisted when you explicitly hit the **REC** button.
- **End-to-End User Isolation (RLS):** All data stored in Supabase is protected by strict **Row Level Security (RLS)**. Only your authenticated user ID (`auth.uid()`) can query, insert, or inspect your devices, sessions, and alerts.
- **Anonymized Aggregations:** Recorded sessions store 10-second batched summaries of node and link counts, bytes transferred, and threat alerts. Raw packet payloads (such as passwords, credit card numbers, or HTTP body contents) are **never** captured or uploaded.

---

## 3. Remote Viewer & Realtime Broadcast

- When using the **Remote HUD Viewer** feature to view topology on your phone or tablet, data is transmitted over an encrypted WebSockets / WebRTC broadcast channel in Supabase Realtime.
- Broadcast sessions expire automatically and are ephemeral.

---

## 4. Firewall Rule Transparency

- NetScope will **never** alter your operating system firewall (`netsh advfirewall` or `iptables`) without explicit user interaction.
- Clicking **"Block Endpoint via OS Firewall"** requires administrative elevation and prompts for confirmation before applying any quarantine rule.

---

## 5. Contact & Auditing

NetScope is fully open-source. You can inspect every line of network polling, data ingestion, and cloud transmission logic directly in the repository:
[https://github.com/Ahmed-Affes/NetScope](https://github.com/Ahmed-Affes/NetScope)
