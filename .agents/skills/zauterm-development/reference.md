# ZauTerm 参考手册

供 SKILL.md 引用的详细映射；仅在需要定位文件或理解数据流时阅读。

## 目录结构（精简）

**三分法：`src/` 前端 · `src-tauri/` 后端 · `src-isolation/` IPC 闸门**

```
src-tauri/src/            # 后端（Rust）
  lib.rs                  应用入口、plugin、generate_handler!
  main.rs                 调用 zauterm_lib::run()
  invoke_commands.rs      自定义 command 权威列表 + isolation 同步测试
  ssh_key.rs              PEM 解析 + userauth_pubkey_memory
  commands/
    window.rs app.rs log.rs credentials.rs
    ssh.rs sftp.rs telnet.rs serial.rs
  ssh/ sftp/ telnet/ serial/
  path_policy/            本地路径 allowlist
  known_hosts/            指纹存储 + 信任弹窗
  vault/                  ChaCha20-Poly1305 + keyring
  encoding/               encoding_rs + binary wire
  ipc.rs dialogs/ session/ traffic_lights.rs

src/                      # 前端（Webview React）
  main.tsx                createTauriZauterm() → window.zauterm
  components/             React UI
  store/                  sessionStore、settingsStore（localStorage）
  lib/ipc/                contract、tauriZauterm、zauterm-api.d.ts、formatIpcError
  lib/import/             导出 envelope、合并导入
  lib/terminal/           xterm 会话、字体、编码归一化
  i18n/                   界面翻译 + ipcErrors
  context/SessionContext.tsx

src-isolation/
  index.js                ALLOWED_CMDS / ALLOWED_PLUGIN_CMDS

tests/                    Vitest，environment: node（见 vitest.config.ts）
docs/images/              README 截图
```

## IPC 通道命名

自定义 command 使用 **下划线**（Tauri invoke），事件使用 **冒号**：

| 前缀 | 模式 | 示例 |
|------|------|------|
| `ssh_` / `ssh:` | invoke + emit | `ssh_connect`, `ssh:output`, `ssh:closed` |
| `sftp_` | invoke + 进度事件 | `sftp_list`, `sftp_download` |
| `telnet_` / `serial_` | 同 ssh 流式 | |
| `credentials_` | invoke | `credentials_sync` |
| `app_` / `window_` / `log_` | invoke | `app_open_external`, `window_minimize` |

完整列表见 `invoke_commands.rs` 的 `REGISTERED_INVOKE_COMMANDS`。

## 后端模块职责

| 模块 | 作用 |
|------|------|
| `ipc` | 成功/失败 envelope 构造 |
| `path_policy` | 收集允许根、validate/assert 路径、`safe_file_stem` |
| `known_hosts` | known_hosts JSON + 三选一信任弹窗 |
| `vault` | 加密字段、sync/get/remove/duplicate/clear |
| `ssh_key` | 解析私钥材料、内存公钥认证 |
| `encoding` | Unicode ↔ 终端字节、binary-wire |
| `dialogs` | 打开/保存文件对话框（Rust DialogExt） |
| `session` | `AppState`、各协议 session map |
| `traffic_lights` | macOS 红绿灯位置（unsafe/objc） |

## 渲染进程 ↔ 后端 IPC 消费

- Bridge：`src/lib/ipc/tauriZauterm.ts`
- 成功/失败判断：`src/lib/ipc/ipcResponse.ts`（`isIpcSuccess` 等）
- 错误展示：`src/lib/ipc/formatIpcError.ts` + `src/i18n/ipcErrors.ts`
- 取 API：`src/lib/ipc/getZauterm.ts`

## 导入导出 envelope

- 会话/设置导出：`src/lib/import/downloadJsonExport.ts`
- 解析与校验：`parseImportFile.ts`、`parseSettingsImport.ts`、`normalizeSession.ts`
- 合并策略：`mergeImportedSessions.ts`
- 字段名：`zautermExport`（非 zenterm）；版本 `1`；上限 8 MB

## 数据存储路径

**app data**（因平台而异）：

- Windows: `%APPDATA%/zauterm/`
- macOS: `~/Library/Application Support/zauterm/`
- Linux: `~/.config/zauterm/`

| 文件/键 | 内容 |
|---------|------|
| `zauterm-known-hosts.json` | SSH 主机 SHA256 指纹 |
| `zauterm-credentials-vault.json` | encrypted 密码/私钥/passphrase |
| `localStorage.zauterm_saved_sessions` | 会话元数据（无密钥） |
| `localStorage.zauterm_settings` | 应用设置 |
| `localStorage.__zauterm_group_placeholders__` | 空分组占位 |

## 开发构建流水线

```
npm run tauri:dev
├── beforeDevCommand → npm run dev（Vite :5173）
└── tauri host（Rust debug）

npm run tauri:build
├── beforeBuildCommand → npm run build（tsc + vite → dist/）
├── tauri build → src-tauri/target/release/bundle/
└── scripts/rename-tauri-artifacts.mjs
    ├── 版本与架构间插入 mac/win/linux
    └── Windows：复制 ZauTerm.exe → bundle/portable/*-portable.exe
```

产物示例：`ZauTerm_3.2.9_mac_aarch64.dmg`、`ZauTerm_3.2.9_win_x64-setup.exe`、`ZauTerm_3.2.9_win_x64-portable.exe`。

## Isolation 与 Capabilities

- Isolation 目录：`src-isolation/`（`tauri.conf.json` → `security.pattern.isolation`）
- **禁止**恢复 `cmd.indexOf('plugin:') === 0` 全放行；只允许 `ALLOWED_PLUGIN_CMDS` 中的项
- Capabilities：`src-tauri/capabilities/default.json`
  - 需要：`core:default`、窗口控制、`dialog:allow-confirm` / `dialog:allow-message`、`core:event:default`、zoom/drag
  - 不要：前端 `fs:default`、`opener:default`、`dialog:default`（过宽）

## 质量门禁

```bash
npm run project:check    # 含 cargo:check + cargo:test
```

合并前本地应对齐上述命令。
