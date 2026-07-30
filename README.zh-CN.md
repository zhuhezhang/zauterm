# ZTerm

基于 **Tauri 2 + React + xterm.js** 的跨平台终端，支持 SSH / SFTP / Telnet / Serial。

从 Electron 版迁移而来：**UI 与功能对齐**；用户数据为**全新**（不迁移 Electron vault / known-hosts）。

## 开发

```bash
npm install
npm run tauri:dev
```

## 打包

```bash
npm run tauri:build
```

## 结构

- `src/` 前端（`window.zterm` 由 `src/lib/ipc/tauriZterm.ts` 注入）
- `shared/` IPC 契约
- `src-tauri/` Rust 后端
