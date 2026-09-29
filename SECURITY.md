# NetScope Security Policy & Threat Modeling

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

---

## 1. Threat Model & Architecture

NetScope is designed under the principle of **least-privilege execution**:

1. **Standard Unprivileged Mode (Socket Table Poller):**
   - By default, NetScope operates without root or administrator privileges.
   - It reads OS socket connection tables (`netstat` / `ss`) and queries the system process table to identify which applications own active connections.
2. **Packet Capture Privilege Escalation (Npcap / libpcap):**
   - Deep packet header inspection requires administrative elevation or driver access via Npcap (Windows) or `libpcap` (Linux/macOS).
   - If privileges or drivers are not available, NetScope gracefully runs in unprivileged socket mode with an informative banner.
3. **Firewall Isolation:**
   - Firewall commands invoke standard operating system tools (`netsh.exe` on Windows, `iptables` on Linux) only upon explicit user confirmation.

---

## 2. Reporting Vulnerabilities

If you discover a security vulnerability within NetScope, please report it responsibly:

- **Email:** security@netscope.dev
- **GitHub Security Advisory:** Submit a private advisory via [GitHub Security Advisories](https://github.com/Ahmed-Affes/NetScope/security/advisories/new).

Please allow up to 48 hours for an initial response before public disclosure. Include:
- A description of the vulnerability.
- Steps to reproduce or proof-of-concept code.
- Potential impact and suggested mitigations.
