<p align="center">
  <img src="website/logo-origami.png" width="220" alt="Pulse Logo">
</p>

<h1 align="center">Pulse — Multi-Network Download Accelerator</h1>

<p align="center">
  <strong>Supercharge your downloads by combining all your internet connections in parallel.</strong><br>
  Pulse bonds Wi-Fi, Ethernet, 5G/LTE Mobile Hotspots, and USB Tethering simultaneously with zero VPN or proxy overhead.
</p>

<p align="center">
  <a href="https://github.com/Itachii0707/Pulse/actions/workflows/ci.yml"><img src="https://github.com/Itachii0707/Pulse/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://github.com/Itachii0707/Pulse/releases"><img src="https://img.shields.io/github/v/release/Itachii0707/Pulse?color=blue" alt="Latest Release"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/unit%20tests-70%20passing-brightgreen" alt="Tests"></a>
  <a href="ENHANCEMENT_ROADMAP.md"><img src="https://img.shields.io/badge/coverage-87.4%25-success" alt="Coverage"></a>
  <a href="tsconfig.json"><img src="https://img.shields.io/badge/TypeScript-5.9-blue.svg" alt="TypeScript"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Electron-44.4-47848F.svg" alt="Electron"></a>
  <a href="vercel.json"><img src="https://img.shields.io/badge/Vercel-Deploys%20Landing%20Site-000000.svg" alt="Vercel Ready"></a>
</p>

---
<img width="1000" height="1000" alt="image" src="https://github.com/user-attachments/assets/06bbc0f0-59b2-4d90-b092-f152ee269548" />

## Overview

Pulse is a high-performance, open-source download manager built on Electron, React, and TypeScript. Unlike traditional download tools that only route traffic through your default network interface, Pulse binds directly to operating system network sockets (`SO_BINDTODEVICE` / `IP_UNICAST_IF`) across all active physical and wireless adapters.

By slicing files into dynamic byte ranges and dispatching streams simultaneously over multiple internet connections, Pulse delivers aggregate speeds far exceeding single-connection limits.

---

## Key Features

### 🚀 Multi-Interface Network Bonding

- **Simultaneous Adapter Utilization**: Combines Wi-Fi, gigabit Ethernet, USB-tethered smartphones, and mobile hotspots into one aggregate pipe.
- **Dynamic Work Allocation**: Faster connections pull larger chunk queues; slower connections never throttle high-speed adapters.
- **Speculative Stream Hedging**: When remaining blocks are downloading, idle streams race slow or stalled blocks to prevent "tail latency" near completion.
- **Live Visual Throughput**: Real-time per-adapter throughput graphs, custom interface labeling, color coding, and granular bandwidth limits.

### 🧲 Direct & BitTorrent Downloads

- **HTTP/HTTPS Range Acceleration**: Multi-connection parallel chunk streaming with RFC 2047 / RFC 5987 content-disposition filename parsing.
- **BitTorrent Engine**: Distributed peer allocation across adapters for `.torrent` files and magnet URIs.
- **Selective File Extraction**: Select, prioritize, or exclude individual files inside multi-file torrent archives before and during transfer.
- **Sparse File Allocation**: Windows NTFS sparse file allocation (`FSCTL_SET_SPARSE`) eliminates disk zero-fill latency for multi-gigabyte files.

### 🌐 Browser Extension Integration

- **Chrome & Firefox Companion Add-ons**: Intercept browser downloads or hand over links via dedicated local loopback bridge.
- **Session Cookie Propagation**: Securely downloads from authenticated cloud drives and restricted member sites using browser session cookies.
- **Configurable Filters**: Whitelist or blacklist domains and set minimum file size thresholds.

### 🛡️ Enterprise-Grade Security & IPC Hardening

- **Path Traversal Shield**: Destination path canonicalization prevents malicious directory traversal or system file overwriting.
- **Malware & Executable Protection**: Real-time executable MIME and extension checks with optional Windows Defender scanning hook (`MpCmdRun.exe`).
- **Strict IPC Contracts & Rate Limiting**: All inter-process communication is validated with Zod schemas and protected against renderer burst flooding.
- **Redacted Audit Logging**: Structured JSONL audit logs at `%AppData%\Pulse\logs\` with automated cookie and token masking.

### 🎨 Neubrutalist Interface & Accessibility

- **Modern Neubrutalism Design**: Crisp high-contrast borders, bold typography, tactile feedback, and smooth spring animations.
- **Comprehensive Theme Support**: Seamless dark and light modes with system preference sync.
- **Reduced Motion Support**: Adheres to `prefers-reduced-motion` across UI transitions, 3D canvases, and charts.

---

## How It Works

```
                        ┌─── Wi-Fi (Home Fiber: 100 Mbps) ────┐
                        │                                     │
Download Target ───────┼─── Ethernet (Secondary ISP: 80 Mbps) ┼────► Fast Aggregate
 (HTTP / Torrent)       │                                     │       (230 Mbps)
                        └─── USB 5G (Mobile Hotspot: 50 Mbps) ─┘
```

1. **Probe Phase**: Pulse executes a lightweight byte probe to detect server range support, file size, MIME type, and caching headers (`ETag`, `Last-Modified`).
2. **Chunk Planning**: Files are partitioned into non-overlapping contiguous blocks sized dynamically according to total bytes.
3. **Interface Binding**: Individual sockets bind to adapter-specific IP addresses, bypassing OS default gateway bottlenecks.
4. **Adaptive Balancing**: Chunks stream to disk asynchronously; completed blocks trigger immediate work assignment to the fastest available interface.
5. **Auto-Reconnection**: If an adapter disconnects (e.g. mobile hotspot out of range), active streams transparently migrate to remaining interfaces without failing the download.

---

## Build from Source

### Prerequisites

- **Node.js**: `v22.13.0` or higher
- **npm**: `v9.0.0` or higher
- **OS**: Windows 10/11, macOS 12+, or Ubuntu 22.04+

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/Itachii0707/Pulse.git
cd Pulse

# Install dependencies and build tools
npm install

# Run in local development mode
npm run dev
```

### Available Scripts

| Command                   | Description                                                   |
| :------------------------ | :------------------------------------------------------------ |
| `npm run dev`             | Starts Electron and Vite dev server with hot reload           |
| `npm run test:unit`       | Executes 70 native Node.js unit tests (~150ms)                |
| `npm run test:coverage`   | Generates unit test coverage report (87.4% line coverage)     |
| `npm run test:e2e:smoke`  | Runs Playwright end-to-end smoke tests                        |
| `npm run test:e2e`        | Runs complete 99+ test Playwright test suite                  |
| `npm run typecheck`       | Strict TypeScript check across node, web, e2e, and extension  |
| `npm run lint`            | ESLint check across all source files                          |
| `npm run format:check`    | Prettier code style validation                                |
| `npm run build:sbom`      | Generates CycloneDX v1.5 SBOM in `build/sbom.json`            |
| `npm run build:extension` | Compiles Chrome and Firefox extensions into `extension/dist/` |
| `npm run build`           | Compiles production bundles for main, preload, and renderer   |
| `npm run build:win`       | Compiles packaged Windows installer (`Pulse-Setup.exe`)       |

---

## Deployment & Hosting

Pulse follows a dual-deployment architecture:

```
┌────────────────────────────────────────────────────────┐
│                      Pulse Project                     │
├──────────────────────────┬─────────────────────────────┤
│  Marketing & Showcase    │     Desktop Application     │
│   Website (website/)     │    (Windows/macOS/Linux)    │
├──────────────────────────┼─────────────────────────────┤
│   Target Platform:       │      Target Platform:       │
│        VERCEL            │      GITHUB RELEASES        │
│   (Serverless Web App)   │   (Native Binary Hosting)   │
└──────────────────────────┴─────────────────────────────┘
```

### 1. Landing Website (Vercel)

The interactive showcase website (`website/`) is configured with root `vercel.json`:

- **Vercel Root**: `.`
- **Output Directory**: `website`
- Connect your GitHub repository to [Vercel](https://vercel.com) and click **Deploy**.
- Includes automatic security headers (`X-Frame-Options`, `X-Content-Type-Options`) and high-performance immutable asset caching.

### 2. Desktop Installers (GitHub Releases)

- Automated through [`.github/workflows/release.yml`](.github/workflows/release.yml).
- Pushing a version tag builds and publishes installers to GitHub Releases:
  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```
- Installers for Windows (`.exe`), macOS (`.dmg`, `.zip`), and Linux (`.AppImage`, `.deb`, `.rpm`) are generated and attached to the release automatically.

---

## Architecture & Developer Documentation

- **[Contributing Guide](CONTRIBUTING.md)**: Development workflow, atomic commits, PR guidelines
- **[Enhancement Roadmap](ENHANCEMENT_ROADMAP.md)**: Phased feature specifications (Phases P0–P4 completed)
- **Architecture Decision Records (ADRs)**:
  - [ADR-001: Multi-Network Connection Bonding](docs/architecture/ADR-001-multi-network-bonding.md)
  - [ADR-002: Modular Download Engine Decomposition](docs/architecture/ADR-002-modular-download-engine.md)
  - [ADR-003: IPC Security, Validation & Threat Mitigation](docs/architecture/ADR-003-ipc-security-and-validation.md)
- **[IPC Channels API Reference](docs/api/ipc-channels.md)**: Complete specification of all main/renderer IPC channels and schemas
- **[Code Signing Guide](CODE_SIGNING.md)**: EV Authenticode certificates, Azure Trusted Signing, and macOS notarization

---

## Troubleshooting FAQ

<details>
<summary><strong>Windows Defender or SmartScreen says "Windows protected your PC"</strong></summary>
<br>

Local developer builds are unsigned by default. Click **More info** › **Run anyway**. Production release builds are signed with Microsoft Authenticode EV certificates — see [CODE_SIGNING.md](CODE_SIGNING.md).
</details>

<details>
<summary><strong>A second network doesn't seem to make downloads faster</strong></summary>
<br>

Pulse adds speed only when each connection reaches the internet through a distinct physical upstream route (e.g. Home Wi-Fi + 5G Phone USB tethering). If both Wi-Fi and Ethernet are connected to the same home router, both adapters share the same upstream broadband pipe.
</details>

<details>
<summary><strong>Windows switches off Wi-Fi when Ethernet is plugged in</strong></summary>
<br>

Windows Connection Manager sometimes prioritizes wired Ethernet by disconnecting Wi-Fi. To allow concurrent connections:

1. Open Group Policy Editor (`gpedit.msc`).
2. Navigate to _Computer Configuration_ › _Administrative Templates_ › _Network_ › _Windows Connection Manager_.
3. Set **Minimize the number of simultaneous connections to the Internet or a Windows domain** to **Disabled**.

</details>

<details>
<summary><strong>Downloads to mechanical hard drives feel bottlenecked</strong></summary>
<br>

Leave **Streams** on **Auto** in the download settings dialog. Pulse monitors disk write queue backpressure and dynamically dials down concurrency if the drive's I/O queue fills up.
</details>

---

## License

Pulse is licensed under the [MIT License](LICENSE).
