---
name: zauterm-development
description: >-
  Develop, debug, test, and package the ZauTerm Tauri terminal app (SSH/SFTP/Telnet/Serial).
  Use when working in the zauterm repo. Layout: src/ frontend, src-tauri/ Rust backend,
  src-isolation/ IPC allowlist. Also for invoke commands, path policy, vault, Vitest,
  cargo:check / cargo:test, project:check, and tauri build.
---

# ZauTerm 开发 Skill

跨平台 Tauri 终端：React Webview + Rust 后端（ssh2 / serialport）。连接类型：SSH、SFTP、Telnet、Serial。

## 代码三分法（最重要）

改代码前先确认归属：

| 目录 | 角色 | 运行环境 | 说明 |
|------|------|----------|------|
| **`src/`** | **前端** | Tauri Webview | React UI、xterm、会话/设置 store、消费 `window.zauterm` |
| **`src-tauri/`** | **后端** | Rust / Tauri | commands、协议会话、路径策略、known_hosts、vault |
| **`src-isolation/`** | **IPC 闸门** | Isolation hook | 白名单过滤 invoke；须与 `invoke_commands.rs` 同步 |

**边界规则：**

- 前端 **不** 直接做网络/串口/密钥落盘；一律经 `window.zauterm` → `src/lib/ipc/tauriZauterm.ts` → Rust commands
- 后端 **不** 写 React/UI；负责 IPC、文件 I/O、加密存储、网络/串口
- 前后端对齐的 API 契约在 **`src/lib/ipc/zauterm-api.d.ts`** + **`src/lib/ipc/contract.ts`**
- 新增自定义 invoke 命令时 **必须三处同步**：`lib.rs` `generate_handler!`、`invoke_commands.rs`、`src-isolation/index.js`

```
前端 src/  ←—— window.zauterm ——→  tauriZauterm.ts  ←—— invoke/listen ——→  src-tauri/commands/
                     ↑                                              │
              src-isolation/                                    ssh/sftp/telnet/serial
```

## 架构速览

| 层 | 目录 | 职责 |
|----|------|------|
| 前端 | `src/` | UI、会话/设置 localStorage、IPC 消费 |
| IPC 桥 | `src/lib/ipc/tauriZauterm.ts` | 实现 `ZauTermApi`；`main.tsx` 挂到 `window.zauterm` |
| Isolation | `src-isolation/index.js` | `ALLOWED_CMDS` + `ALLOWED_PLUGIN_CMDS` |
| Commands | `src-tauri/src/commands/` | Tauri command 入口，返回 IPC envelope |
| 协议 | `src-tauri/src/{ssh,sftp,telnet,serial}/` | 连接与 I/O |
| 安全库 | `path_policy` / `known_hosts` / `vault` / `ssh_key` | 路径、主机指纹、凭据、内存私钥认证 |
| 测试 | `tests/` + `src-tauri` `#[cfg(test)]` | Vitest / `npm run cargo:test` |

## 改代码前先定位

| 需求 | 优先改哪里 |
|------|------------|
| UI / 会话列表 / 设置 | **前端** `src/components/`、`src/store/`、`src/context/` |
| 新增 IPC 能力 | **契约** `zauterm-api.d.ts` → **桥** `tauriZauterm.ts` → **Rust** `commands/` + 协议模块 → **白名单** `invoke_commands.rs` + `src-isolation/` |
| SSH/SFTP 协议逻辑 | **后端** `src-tauri/src/ssh/`、`sftp/`、`ssh_key.rs` |
| 本地路径权限 | **后端** `src-tauri/src/path_policy/` |
| 主机指纹 | **后端** `src-tauri/src/known_hosts/` |
| 密码/私钥存储 | **后端** `vault/` + `commands/credentials.rs`（前端不含明文） |
| 导入导出 JSON | **前端** `src/lib/import/` |
| i18n | **前端** `src/i18n/`；已知 IPC 错误码 `src/i18n/ipcErrors.ts` |

## 硬性约定

### 1. IPC 统一响应形状

类型：`src/lib/ipc/contract.ts`。Rust 侧用 `src-tauri/src/ipc.rs`：

- 成功：`{ success: true, content }`
- 失败：`{ success: false, errorKnown, content: { error, errorParams? } }`
- 已知错误用 **i18n 错误码**（如 `sftp.pathErrors.localDirDenied`），前端 `formatIpcError` 翻译

### 2. 新增 / 重命名 invoke 命令

1. 在 `src-tauri/src/commands/` 实现并加入 `lib.rs` `generate_handler!`
2. 更新 `REGISTERED_INVOKE_COMMANDS`（`invoke_commands.rs`）
3. 更新 `src-isolation/index.js` 的 `ALLOWED_CMDS`
4. 更新 `tauriZauterm.ts` / `zauterm-api.d.ts`
5. 跑 `npm run cargo:test`（isolation 同步测试会失败若漏改）

插件命令白名单（前端实际调用）在 `ALLOWED_PLUGIN_CMDS` / `ALLOWED_PLUGIN_COMMANDS`：dialog message、event listen/unlisten、window start_dragging、webview set_webview_zoom、clipboard-manager read/write text。

### 3. 进程 / 安全边界

| 操作 | 位置 |
|------|------|
| 读本地私钥 / PEM 解析 | Rust `ssh_key::resolve_private_key_material` |
| SSH/SFTP 公钥认证 | `userauth_pubkey_memory`（**禁止**再写临时 `.pem`） |
| 主机密钥弹窗 | `known_hosts::verify_host_key_with_lang` |
| 会话/设置持久化 | 前端 `localStorage`（**不含**密钥明文） |
| 密钥明文 | `zauterm-credentials-vault.json` + OS keyring |

### 4. 路径 alias

- 前端 TS：`@/` → `src/`（`tsconfig.json` + `vite.config.ts`）
- Rust 用 crate 模块路径，不用 `@/`

### 5. 改动范围

最小 diff；匹配现有命名与注释风格；不擅自加无关抽象或文档。

**迁移 / 拆分代码时**：移动、提取、重命名文件或符号时，须**原样带走**原有 JSDoc、`//` 行内说明与块注释；仅当行为或签名变更时才改写注释。

### 6. Capabilities

`src-tauri/capabilities/default.json` 保持最小权限。前端未使用 `plugin-fs`；opener 仅 Rust 侧 `app_open_external` 使用，勿把宽泛 `fs:default` / `opener:default` 加回前端能力。

## 开发与构建

```bash
npm run tauri:dev        # Vite :5173 + Tauri
npm run typecheck
npm run lint
npm run test             # vitest run
npm run cargo:check
npm run cargo:test       # cd src-tauri && cargo test
npm run project:check    # typecheck + lint + test + cargo:check + cargo:test
npm run tauri:build      # tauri build + insert os into artifact names
npm run rename:artifacts # only rename existing bundle artifacts
```

主二进制名：`tauri.conf.json` → `mainBinaryName: "ZauTerm"`。安装包：在 Tauri 默认名上于版本与架构间插入 `mac`/`win`/`linux`；Windows 额外复制免安装 `bundle/portable/*-portable.exe`（见 `scripts/rename-tauri-artifacts.mjs`）。

版本号三处对齐：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`。

## 测试

- 前端：`tests/**/*.test.ts`，镜像 `src/lib/` 等纯逻辑
- Rust：模块内 `#[cfg(test)]`（path_policy、known_hosts、vault、ssh_key、invoke_commands）
- 不测 React 组件、不测真实 SSH/串口
- 新增 path_policy / vault / known_hosts 逻辑时优先补 Rust 用例

## 持久化（全量 rewrite，非增量）

| 数据 | 位置 |
|------|------|
| 已知主机 | `{appData}/zauterm-known-hosts.json` |
| 凭据 vault | `{appData}/zauterm-credentials-vault.json` |
| 已保存会话 | `localStorage` → `zauterm_saved_sessions` |
| 设置 | `localStorage` → `zauterm_settings` |

JSON 写入使用 pretty print + `.tmp` 原子替换（Rust 侧）。

## 常见任务清单

**新增 IPC command**

1. `src/lib/ipc/zauterm-api.d.ts` 扩展 API
2. `src/lib/ipc/tauriZauterm.ts` 调用 `invoke` / `listen`
3. `src-tauri/src/commands/*.rs` 实现
4. 注册 `lib.rs` + `invoke_commands.rs` + `src-isolation/index.js`
5. 错误码加入 `src/i18n/ipcErrors.ts`（若需 i18n）
6. 补 Vitest 或 `npm run cargo:test`

**改 SSH 连接参数**

- 表单/类型：`src/types/session.ts`、`zauterm-api.d.ts`
- 私钥：`ssh_key.rs`（内存认证）
- 会话循环：`src-tauri/src/ssh/mod.rs`

## 延伸阅读

- 目录与安全细节：[reference.md](reference.md)
- 仓库文档：`README.zh-CN.md` / `README.md`
