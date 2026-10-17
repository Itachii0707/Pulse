# Pulse IPC Channel Reference

This document provides the canonical API reference for Inter-Process Communication (IPC) channels between the Electron Main process and Renderer window in Pulse.

All channels use `ipcRenderer.invoke` (bidirectional asynchronous request/response) or `ipcRenderer.on` (main-to-renderer push streams), except for the synchronous `getInitialState` bootstrap channel.

---

## Protocol & Standards

- **Protocol Version:** `IPC_PROTOCOL_VERSION = 1`
- **Validation Engine:** Zod (`src/shared/ipc-validation.ts`)
- **Error Handling:** Standardized `withIpcErrorBoundary` returning structured errors
- **Rate Limiting:** Managed by `src/main/ipc/rateLimiter.ts`

---

## Channel Catalog

### 1. Download Operations

#### `startDownload`

Starts an HTTP or BitTorrent download.

- **Channel:** `startDownload`
- **Request Payload:** `StartDownloadRequest`
  - `kind`: `'http' | 'torrent'`
  - `url`: Valid HTTP/HTTPS, magnet link, or path to `.torrent`
  - `destinationDir`: Absolute target directory path (must pass `isSafeDestinationPath`)
  - `suggestedFileName`: Sanitized target filename
  - `totalBytes`: Expected size in bytes (`0` if unknown)
  - `supportsRanges`: Boolean indicating server Range support
  - `interfaceIds`: Array of network interface IDs to use
  - `browser?`: Optional browser session context (cookies, referer, user-agent)
- **Response:** `Promise<string>` (UUID of the created download)
- **Rate Limit:** 15 req/sec
- **Audit Logged:** Yes (`download_started`)

#### `listDownloads`

Returns live states of all active, paused, queued, and error downloads.

- **Channel:** `listDownloads`
- **Response:** `Promise<DownloadState[]>`

#### `pauseDownload`

Pauses an active download.

- **Channel:** `pauseDownload`
- **Arguments:** `id: string`
- **Response:** `Promise<void>`

#### `resumeDownload`

Resumes a paused or stopped download.

- **Channel:** `resumeDownload`
- **Arguments:** `id: string`
- **Response:** `Promise<void>`

#### `cancelDownload`

Cancels an in-flight download and cleans up staging partial files.

- **Channel:** `cancelDownload`
- **Arguments:** `id: string`
- **Response:** `Promise<void>`

#### `removeDownload`

Removes a download from state and optionally trashes the published file.

- **Channel:** `removeDownload`
- **Arguments:** `id: string, options?: { trashFile?: boolean }`
- **Response:** `Promise<void>`
- **Audit Logged:** Yes (`download_removed`)

#### `relinkDownload`

Updates the remote URL for an expired or redirected download link.

- **Channel:** `relinkDownload`
- **Arguments:** `id: string, url: string`
- **Response:** `Promise<void>`

#### `setDownloadNetwork`

Enables or disables a specific physical network interface for a download.

- **Channel:** `setDownloadNetwork`
- **Arguments:** `id: string, networkId: string, enabled: boolean`
- **Response:** `Promise<void>`

---

### 2. History & Analysis

#### `listHistory`

Retrieves all completed downloads recorded in persistent history.

- **Channel:** `listHistory`
- **Response:** `Promise<FinishedDownload[]>`

#### `exportHistory`

Exports download transfer history to a user-chosen file.

- **Channel:** `exportHistory`
- **Arguments:** `format?: 'csv' | 'json'` (default `'csv'`)
- **Response:** `Promise<{ success: boolean; canceled?: boolean; filePath?: string }>`
- **Rate Limit:** 5 req/sec
- **Audit Logged:** Yes (`history_exported`)

#### `clearHistory`

Clears all records in history.

- **Channel:** `clearHistory`
- **Response:** `Promise<void>`
- **Rate Limit:** 5 req/sec
- **Audit Logged:** Yes (`history_cleared`)

---

### 3. System & Configuration

#### `getInitialState` (Synchronous)

Provides preload bootstrap state before first paint.

- **Channel:** `getInitialState`
- **Response:** `InitialState`
  - `homeDir`, `downloadsDir`, `themeSource`, `networkPreferences`, `downloadsAtOnce`, `speedLimit`, `slowMode`, `slowModeSpeed`, `speedUnit`, `destinationDir`, `onboardingCompleted`, `security`

#### `updateSettings`

Updates user preferences and persists to `app-settings.json`.

- **Channel:** `updateSettings`
- **Request Payload:** `AppSettingsPatchSchema`
- **Response:** `Promise<void>`
- **Rate Limit:** 10 req/sec
- **Audit Logged:** Yes (`settings_update`)

#### `probeUrl`

Inspects a remote link or magnet URI before beginning download.

- **Channel:** `probeUrl`
- **Arguments:** `url: string`
- **Response:** `Promise<ProbeResult>`
  - Evaluates HTTP response headers, content-disposition, range capability, size, MIME type, `isExecutable`, and `securityWarning`.
- **Rate Limit:** 20 req/sec

#### `freeSpace`

Calculates available disk bytes for a given destination directory.

- **Channel:** `freeSpace`
- **Arguments:** `dir: string`
- **Response:** `Promise<number | null>`
- **Security:** Requires absolute directory path; returns null for non-absolute or invalid paths.

---

### 4. Push Streams (Main → Renderer)

- **`downloadUpdated`**: Sends incremental block/piece updates (`DownloadUpdate`)
- **`networksChanged`**: Pushes updated network adapter list (`NetworkInterfaceInfo[]`)
- **`updateStateChanged`**: Pushes updater progress and readiness states (`UpdateState`)
