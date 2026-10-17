# ADR-002: Modular Download Engine Decomposition

## Status

Accepted

## Context

Earlier versions of the application housed download coordination, HTTP transfer management, BitTorrent peer protocol handling, queue scheduling, disk persistence, speed tracking, and IPC registration within a monolithic `downloadManager.ts` file spanning over 2,500 lines. This tightly coupled architecture impeded unit testing, made isolated refactoring risky, and obscured single-responsibility boundaries.

## Decision

Decompose `downloadManager.ts` into specialized, isolated modules while preserving backward compatibility across all IPC channels:

1. **`DownloadOrchestrator` (`src/main/download/downloadOrchestrator.ts`)**:
   - Manages top-level lifecycle events: `start`, `pause`, `resume`, `cancel`, `remove`, `relink`.
   - Delegates domain actions to underlying runtime controllers.
2. **`DownloadScheduler` (`src/main/download/downloadScheduler.ts`)**:
   - Enforces concurrency limits (`downloadsAtOnce`).
   - Implements FIFO queue ordering for pending transfers.
   - Evaluates off-peak recurring schedule windows (`DownloadSchedule`) and suspends transfers outside authorized hours.
3. **`DownloadProgressTracker` (`src/main/download/downloadProgressTracker.ts`)**:
   - Collects 1-second interval throughput samples per interface (`sampleSpeeds`).
   - Maintains fixed-duration rolling speed history (`SPEED_HISTORY_SECONDS = 60`).
   - Calculates 5-second sustained peak speeds (`samplePeak`) and smoothed ETA (`updateTimeLeft`).
4. **`DownloadPersistence` (`src/main/download/downloadPersistence.ts`)**:
   - Manages serialized JSON recovery manifests under `%AppData%\Pulse\manifests\`.
   - Encrypts sensitive authentication tokens and session cookies via Electron's hardware-backed `safeStorage`.
   - Coordinates atomic partial checkpoint writes (`.plexo` sparse files).
5. **`registerDownloadIpcHandlers` (`src/main/ipc/downloadHandlers.ts`)**:
   - Extracts IPC handler registrations and payload decoding out of the download engine into dedicated transport handlers.

## Consequences

### Positive

- High testability: pure scheduling algorithms and block calculators can now be validated with fast, headless unit tests (`node --test`).
- Clean separation of concerns: storage, network, scheduler, and UI updates do not pollute each other's execution paths.
- Reduced cognitive load when modifying specific capabilities (e.g. adding Windows Defender scanning upon completion).

### Negative / Trade-offs

- Inter-module communication requires explicit interfaces or host adapter delegates (`TransferHost`, `ProgressTrackerTarget`).
