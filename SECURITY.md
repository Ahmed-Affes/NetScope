# NetScope Security Policy & Architecture

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## 1. Threat Model & Security Controls

NetScope inspects live network telemetry while maintaining strict security controls:

### Least-Privilege Execution Model
1. **Tier A (Standard User):**
   - Operates without administrative privileges.
   - Reads active TCP and UDP socket tables via native Win32 APIs (`GetExtendedTcpTable`, `GetExtendedUdpTable`).
   - Resolves routing gateways via the Windows routing table.
   - Queries local subnet neighbors via rate-limited Win32 `SendARP`.
2. **Tier B (Elevated Visibility):**
   - Activated only when the user explicitly triggers "Enable full visibility" through Windows User Account Control (UAC).
   - Collects aggregated packet and throughput statistics via kernel Event Tracing for Windows (ETW `Microsoft-Windows-Kernel-Network`).

### Process Management Guardrails
- **Protected Critical Processes:** Built-in safeguards strictly refuse termination requests for critical Windows system processes:
  - `System Idle Process` (PID 0), `System` (PID 4)
  - `csrss.exe`, `smss.exe`, `wininit.exe`, `winlogon.exe`
  - `services.exe`, `lsass.exe`, `svchost.exe`, `explorer.exe`
- **PID Reuse Protection:** Before executing a termination command, NetScope re-verifies that the target PID still matches the exact process name and creation timestamp recorded during selection.

### Command Injection Prevention
- **Direct Windows API Execution:** External URLs and file paths are never passed to `cmd.exe` or `powershell.exe`. URLs are parsed and validated with the Rust `url` crate, restricted to `http:` and `https:` schemes, and launched via native Windows shell functions (`ShellExecuteW`).
- **Firewall Input Validation:** Remote IP blocking strictly validates inputs as `std::net::IpAddr`. CIDR notations, ranges, and loopback/multicast addresses are rejected.

### Webview Hardening
- **Strict Content Security Policy (CSP):** Configured in `tauri.conf.json` with `default-src 'self'; connect-src 'self' https://speed.cloudflare.com https://api.github.com`.
- **Disabled DevTools in Release:** Webview developer tools are stripped in production builds.

---

## 2. Reporting Security Vulnerabilities

If you discover a security vulnerability within NetScope, please report it responsibly:

- **GitHub Security Advisories:** Submit a report via [GitHub Security Advisories](https://github.com/Ahmed-Affes/NetScope/security/advisories/new).
- **Email:** security@netscope.dev

Please include:
- A clear description of the vulnerability.
- Proof of concept or reproduction steps.
- Assessed impact and potential mitigations.
