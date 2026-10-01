# NetScope Code Signing Guide (Windows Release)

This document provides authentic, step-by-step instructions for code signing NetScope desktop releases on Windows. NetScope does not use self-signed certificates or fake signing bypasses in release builds.

---

## 1. Tauri Updater Keypair Signing

Tauri 2 includes built-in cryptographic signature verification for automatic updates using Minisign ed25519 keys.

### Step 1.1: Generate Signing Keypair
Run the Tauri signer generator on your secure workstation:

```bash
pnpm tauri signer generate -w ~/.tauri/netscope.key
```

This generates:
- A private key (`~/.tauri/netscope.key`)
- A public key printed to your console

### Step 1.2: Configure Public Key in `tauri.conf.json`
Embed the generated public key in `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_MINISIGN_ED25519_PUBLIC_KEY_HERE"
    }
  }
}
```

### Step 1.3: Set Private Key in Environment
For CI/CD or release builds:

```bash
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content ~/.tauri/netscope.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-optional-password"
```

---

## 2. Windows Authenticode Binary Signing

Windows SmartScreen requires an Authenticode code signing certificate (Standard or EV) to prevent "Unknown Publisher" warnings on download and execution.

### Options for Production Signing:

### Option A: Azure Trusted Signing (Recommended for Cloud CI)
Microsoft Azure Trusted Signing (formerly Microsoft Identity Verification) integrates directly with GitHub Actions without physical hardware security modules (HSMs).

1. Set up an Azure Trusted Signing account in Azure Portal.
2. Configure credentials in GitHub repository secrets:
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `AZURE_TENANT_ID`
   - `AZURE_CODE_SIGNING_ACCOUNT_NAME`
   - `AZURE_CERT_PROFILE_NAME`
3. Use the `azure/trusted-signing-action` in the GitHub release workflow to sign the generated installer and executable before distribution.

### Option B: Hardware Token / PFX with SignTool
If you hold a physical EV hardware token (e.g. YubiKey) or standard PFX certificate:

```powershell
# Using Windows SDK signtool.exe
signtool sign /f "C:\path\to\certificate.pfx" `
  /p "YourCertPassword" `
  /fd SHA256 `
  /tr http://timestamp.digicert.com `
  /td SHA256 `
  "src-tauri\target\release\netscope.exe"

signtool sign /f "C:\path\to\certificate.pfx" `
  /p "YourCertPassword" `
  /fd SHA256 `
  /tr http://timestamp.digicert.com `
  /td SHA256 `
  "src-tauri\target\release\bundle\nsis\NetScope_*_x64-setup.exe"
```

### Step 2.1: Verify Signed Executable
Verify that the signature is valid and includes a trusted timestamp:

```powershell
signtool verify /pa /v "src-tauri\target\release\netscope.exe"
```

---

## 3. GitHub Actions Release Workflow Integration

When building release tags (`v*`), configure the workflow to sign artifacts if secrets are present, or produce unsigned build artifacts with a clear disclaimer for development testing:

```yaml
- name: Sign Executable (if certificate secret is configured)
  if: env.CERT_BASE64 != ''
  run: |
    # Decrypt and sign executable with signtool
```
