# ADR-003: IPC Security, Runtime Schema Validation & Threat Mitigation

## Status

Accepted

## Context

Electron desktop applications expose powerful native capabilities (file system access, shell commands, process spawning, network sockets) to renderer processes via IPC (Inter-Process Communication). Without strict boundaries, vulnerabilities in the renderer (such as DOM XSS or compromised dependencies) could escalate into arbitrary code execution, unauthorized file overwrites via directory traversal (`../../`), or denial-of-service via unbounded IPC message flooding.

## Decision

Implement a multi-layered defense-in-depth IPC security boundary:

1. **Runtime Schema Validation via Zod (`src/shared/ipc-validation.ts`)**:
   - Every IPC channel enforces a strongly-typed Zod schema (`validateIpcPayload`).
   - Unrecognized fields, malformed types, and negative numbers are rejected immediately at the IPC entrance boundary before reaching core logic.
2. **Standardized Error Boundaries (`withIpcErrorBoundary`)**:
   - IPC invocation exceptions are caught by structured error handlers.
   - Prevents unhandled main-process rejections or raw filesystem paths from leaking back into renderer state.
3. **IPC Rate Limiting (`src/main/ipc/rateLimiter.ts`)**:
   - A sliding-window token limiter restricts the frequency of renderer-invoked IPC messages per channel (e.g. 10 mutations/sec for `updateSettings`, 15/sec for `startDownload`).
   - Prevents runaway renderer loops or DoS attacks.
4. **Path Traversal & Confinement Guards (`src/main/download/security.ts`)**:
   - `isSafeDestinationPath` validates that target file paths strictly reside within the user-authorized destination directory.
   - Prohibits writing into critical OS system roots (`C:\Windows`, `C:\Program Files`, `/etc`, `/bin`, `/System`).
5. **Executable & Malicious Extension Blocking (`src/main/download/security.ts`)**:
   - Evaluates MIME types and file extensions against security policies.
   - Blocks or flags dangerous executable payloads (`.exe`, `.bat`, `.cmd`, `.scr`, `.msi`, `.vbs`, `.ps1`).
6. **Structured Audit Logging (`src/main/ipc/auditLogger.ts`)**:
   - Writes immutable JSONL audit logs to `%AppData%\Pulse\logs\audit-<date>.jsonl` tracking sensitive operations (`startDownload`, `updateSettings`, `removeDownload`, `exportHistory`).
   - Automatically sanitizes and redacts credentials, cookies, and tokens.

## Consequences

### Positive

- Robust protection against renderer privilege escalation, malicious link injection, and path traversal attacks.
- Predictable error contracts and protocol consistency across renderer and main processes.
- Audit trail for forensic review and enterprise compliance.

### Negative / Trade-offs

- Slight runtime parsing overhead (~0.05ms per IPC call) for Zod schema validation.
- Validated payloads must be kept in sync between TypeScript types and Zod schemas.
