# Contributing to Pulse

Thank you for your interest in contributing to Pulse! This guide explains our development environment, testing philosophy, and contribution workflow.

---

## Prerequisites

- **Node.js:** v22.x or higher
- **npm:** v10.x or higher
- **Operating System:** Windows 10/11, macOS 12+, or modern Linux (Ubuntu 22.04+)
- **C/C++ Build Tools (optional for native FFI rebuilds):** Windows SDK / Visual Studio Build Tools, or GCC/Clang on POSIX

---

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/pulse.git
   cd pulse
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

   _Note: The postinstall hook will apply required patches via `patch-package`, install electron binaries, and compile dependencies._

3. **Launch in development mode:**
   ```bash
   npm run dev
   ```
   _Starts Vite dev server for the renderer and compiles main process with live HMR._

---

## Code Quality & Verification

Pulse enforces strict code quality standards. All PRs must pass with 0 errors and 0 warnings:

```bash
# 1. Check code formatting (Prettier)
npm run format:check

# 2. Automatically fix code formatting
npm run format

# 3. Lint codebase (ESLint Flat Config)
npm run lint

# 4. Strict Type checking (all 4 targets: node, web, e2e, extension)
npm run typecheck

# 5. Run native unit tests
npm run test:unit

# 6. Run end-to-end smoke tests (Playwright)
npm run test:e2e:smoke
```

---

## Architecture Guidelines

- **Main vs Renderer Isolation:** The renderer has `nodeIntegration: false` and `contextIsolation: true`. Never expose raw Node.js modules into renderer window globals.
- **Typed IPC:** All IPC calls must pass through `IpcChannels` and define Zod validation schemas in `src/shared/ipc-validation.ts`.
- **Security Boundaries:**
  - File operations must pass through `isSafeDestinationPath` to prevent directory traversal.
  - Dangerous executable types and extensions must respect `SecuritySettings`.
  - Sensitive operations must invoke `logAuditEvent`.
- **Atomic File Writing:** All partial downloads write to `.plexo` sparse staging files before atomic rename publication.

---

## Commit Guidelines

We use conventional commit messages:

- `feat:` A new user-facing feature
- `fix:` A bug fix
- `docs:` Documentation updates or ADRs
- `refactor:` Code restructuring without behavior change
- `test:` Adding or updating unit/e2e tests
- `chore:` Dependency bumps, CI updates, build scripts
