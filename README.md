# ZTerm

Cross-platform terminal emulator built with **Tauri 2**, **React**, and **xterm.js**.  
Supports SSH, SFTP, Telnet, and Serial.

> Migrated from the Electron edition. UI and features are intentionally kept the same; user data is **new** (no vault/known-hosts migration from Electron).

## Requirements

- Node.js 20+
- Rust stable (1.77+)
- Platform deps for Tauri: see https://v2.tauri.app/start/prerequisites/

## Develop

```bash
npm install
npm run tauri:dev
```

## Build

```bash
npm run tauri:build
```

Artifacts are under `src-tauri/target/release/bundle/`.

## Architecture

```
src/                 React UI + xterm (window.zterm facade)
shared/              IPC types / API contract
src-tauri/           Rust backend (SSH/SFTP/Telnet/Serial, vault, dialogs)
```

Frontend talks to the backend through `src/lib/ipc/tauriZterm.ts`, which implements the same `ZTermApi` surface as the former Electron preload bridge.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run tauri:dev` | Dev app (Vite + Tauri) |
| `npm run tauri:build` | Production bundle |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust unit tests |

## Data (new installs)

App data directory (platform-specific) stores:

- `zterm-known-hosts.json`
- `zterm-credentials-vault.json` (ChaCha20-Poly1305; master key in OS keyring)

Sessions/settings remain in renderer `localStorage`.
