# NetScope Privacy Policy

**Last Updated:** October 2026

At NetScope, user privacy and data sovereignty are fundamental architectural requirements. This document outlines how NetScope handles network traffic data, system identifiers, and external network interactions.

---

## 1. Local-Only Processing & Zero Cloud Uploads

- **No Remote Telemetry:** NetScope does **not** collect, upload, or transmit your network traffic, socket tables, visited IP addresses, or process names to any remote servers, analytics platforms, or third parties.
- **Volatile In-Memory Operation:** Active sockets, LAN neighbor records, and traffic counters reside exclusively in volatile memory (RAM) while the application is open. When NetScope is closed, all cached session data immediately evaporates.
- **No Disk Database:** NetScope does not write your connection logs, browsing history, or packet data to local databases or log files.

---

## 2. External Network Queries & Third-Party Services

- **Offline Vendor Resolution:** Hardware MAC address vendor lookups for local LAN devices use a bundled, offline MAC OUI prefix table. Your local devices' MAC addresses are **never** transmitted over the internet.
- **Reverse-DNS Resolution:** Hostname lookups are performed through standard OS DNS resolver calls with a local 10-minute cache and strict timeouts.
- **Speed Test Diagnostics:** When you explicitly open the Speed Test modal and run a diagnostic, NetScope communicates with Cloudflare's public speed test endpoint (`speed.cloudflare.com`). If this request fails or is blocked, NetScope displays "Unknown" rather than guessing. No identifying network data is sent during normal topology inspection.
- **GitHub Update Checks:** NetScope checks GitHub Releases (`api.github.com`) solely to query whether a newer application release is available.

---

## 3. System Privileges & OS Modifications

- **Firewall Quarantine Rules:** NetScope never modifies your Windows Defender Firewall rules without direct user interaction. Clicking "Block Endpoint via OS Firewall" invokes native Windows `netsh.exe advfirewall` only after explicit confirmation.
- **Process Termination:** The "End Task" action terminates a process only upon explicit user confirmation, subject to strict safety guardrails preventing termination of critical Windows system processes.
- **Elevation (UAC):** When launched unprivileged, NetScope operates with read-only socket visibility (Tier A). Kernel ETW bandwidth metering (Tier B) is only activated if you choose to relaunch with Administrator privileges.

---

## 4. Open-Source Verification

NetScope is open-source under the MIT license. You can review the complete source code, native Win32 bindings, and network collection routines at:
[https://github.com/Ahmed-Affes/NetScope](https://github.com/Ahmed-Affes/NetScope)
