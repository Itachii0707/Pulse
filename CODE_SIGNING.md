# Code Signing Guide — Pulse for Windows

> **Goal**: Eliminate the Windows Defender SmartScreen "Unrecognized app" warning so that
> enterprise users and corporate IT firewalls never block Pulse-Setup.exe.

---

## Why EV Code Signing?

| Cert type         | SmartScreen reputation  | Built in 1 release?  |
| ----------------- | ----------------------- | -------------------- |
| No cert           | ⛔ "Unrecognized app"   | —                    |
| OV (standard)     | ⚠️ Warning, still shown | Months of installs   |
| **EV (extended)** | ✅ No warning, instant  | **Yes — from day 1** |

Only an **Extended Validation (EV)** certificate gives instant SmartScreen trust.

---

## 1 · Purchase an EV Certificate

| Vendor                | Cloud HSM (CI-friendly)          | USB token |
| --------------------- | -------------------------------- | --------- |
| DigiCert              | ✅ KeyLocker                     | ✅        |
| SSL.com               | ✅ eSigner                       | ✅        |
| Sectigo               | ✅ DigiCert KeyLocker compatible | ✅        |
| Azure Trusted Signing | ✅ (Microsoft-hosted)            | ❌        |

> ⚡ **Recommended for CI**: DigiCert KeyLocker or Azure Trusted Signing — no USB dongle required, fully automatable.

---

## 2 · Configure Signing in CI

All configuration is via environment variables, **never committed to source control**.

| Variable                   | Required  | Description                                               |
| -------------------------- | --------- | --------------------------------------------------------- |
| `PULSE_SIGN_CERT_SHA1`     | Preferred | SHA1 thumbprint of the EV cert (from `certmgr.msc`)       |
| `PULSE_SIGN_CERT_NAME`     | Fallback  | Certificate subject name (e.g. `"Your Company LLC"`)      |
| `PULSE_SIGN_TIMESTAMP_URL` | Optional  | RFC 3161 server (default: DigiCert)                       |
| `PULSE_SIGN_DESCRIPTION`   | Optional  | Shown in UAC dialog (default: `"Pulse Download Manager"`) |
| `PULSE_SIGN_URL`           | Optional  | Shown in UAC dialog (default: `https://pulse.app`)        |
| `PULSE_SIGNTOOL_PATH`      | Optional  | Full path to `signtool.exe` if not auto-detected          |
| `PULSE_SKIP_SIGN`          | Optional  | Set to `1` to skip signing (PR / draft builds)            |

### GitHub Actions example

```yaml
# .github/workflows/release.yml
- name: Build and Sign Windows installer
  env:
    PULSE_SIGN_CERT_SHA1: ${{ secrets.EV_CERT_SHA1 }}
    PULSE_SIGN_TIMESTAMP_URL: http://timestamp.digicert.com
  run: npm run build:win
```

Store `EV_CERT_SHA1` (and HSM credentials) as **GitHub Actions Secrets** — never in `.env`.

### Local developer signing (USB token)

```powershell
$env:PULSE_SIGN_CERT_SHA1 = "AABBCCDDEEFF..."  # your cert thumbprint
npm run build:win
```

---

## 3 · Cloud HSM Setup

### DigiCert KeyLocker

```powershell
$env:SM_API_KEY                       = "<your-api-key>"
$env:SM_CLIENT_CERT_FILE              = "C:\certs\certificate.p12"
$env:SM_CLIENT_CERT_PASSWORD          = "<password>"
$env:SM_CODE_SIGNING_CERT_SHA1_HASH   = "<cert-thumbprint>"

npm run build:win
```

### Azure Trusted Signing

```yaml
- uses: azure/trusted-signing-action@v0
  with:
    azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
    azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
    endpoint: https://eus.codesigning.azure.net/
    trusted-signing-account-name: pulse-signing
    certificate-profile-name: pulse-ev
    files-folder: dist
    files-folder-filter: exe,dll,node
```

---

## 4 · How sign-windows.mjs Works

The hook is registered in `electron-builder.yml` as `afterSign`. electron-builder calls it after packaging and before NSIS creates the installer.

```
electron-builder build:win
  └── afterPack  → scripts/check-torrent-package.mjs
  └── afterSign  → scripts/sign-windows.mjs   (signs all .exe/.dll/.node)
  └── NSIS       → Pulse-Setup.exe
```

The script walks the unpacked app directory, collects every `.exe`, `.dll`, and `.node` binary, and calls `signtool.exe sign /fd SHA256 /tr <timestamp> /td SHA256` for each. It throws on the first failure so no unsigned release ships.

---

## 5 · Verify the Signature

```powershell
Get-AuthenticodeSignature .\dist\Pulse-Setup.exe | Format-List
```

Expected output:

```
SignerCertificate : [Your Company] EV Code Signing
TimeStamperCertificate : DigiCert Timestamp 2024
Status : Valid
```

---

## 6 · SmartScreen Reputation

EV certificates carry **immediate reputation** from day 1. OV certificates require months of clean downloads. EV is the only option for enterprise environments where users cannot override warnings.

---

## Troubleshooting

| Symptom                            | Fix                                                                |
| ---------------------------------- | ------------------------------------------------------------------ |
| `No certificates were found`       | Run `certmgr.msc`, copy exact thumbprint to `PULSE_SIGN_CERT_SHA1` |
| `The private key is not available` | Insert USB token and re-authenticate                               |
| `signtool.exe not found`           | Install Windows 10/11 SDK, or set `PULSE_SIGNTOOL_PATH`            |
| SmartScreen still shows warning    | Upgrade from OV to EV certificate                                  |
