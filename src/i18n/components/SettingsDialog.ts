/** SettingsDialog.jsx */
export const SETTINGS = {
  zh: {
    "title": "设置",
    "cancel": "取消",
    "save": "保存",
    "saveClose": "保存并关闭",
    "tabs": {
      "general": "常规",
      "sshTerminal": "SSH 与终端",
      "dataSecurity": "数据与安全"
    },
    "sections": {
      "appearance": "外观与语言",
      "confirm": "操作确认",
      "terminal": "终端行为",
      "logging": "日志",
      "ssh": "SSH 连接",
      "algorithm": "SSH/SFTP 算法",
      "highlight": "终端输出高亮",
      "credentials": "凭据存储",
      "sessions": "会话管理",
      "settingsMgmt": "设置管理"
    },
    "fields": {
      "appTheme": {
        "label": "应用主题",
        "desc": "暗黑 / 浅色 / 跟随系统外观设置；内置默认跟随系统，保存后立即生效"
      },
      "uiLanguage": {
        "label": "Language / 语言",
        "desc": "含「自动」时按系统首选语言在简中 / 英文间选择；保存后立即生效"
      },
      "confirmDeleteSession": {
        "label": "删除会话前确认",
        "desc": "删除保存的会话前弹出确认对话框"
      },
      "confirmDeleteGroup": {
        "label": "删除分组前确认",
        "desc": "删除分组前弹出确认对话框"
      },
      "deleteGroupWithSessions": {
        "label": "删除分组时同时删除会话",
        "desc": "关闭时仅删除分组，组内会话变为未分组"
      },
      "terminalInteract": {
        "label": "选中复制 / 右键粘贴",
        "desc": "选中终端文本自动复制，右键单击粘贴剪贴板内容"
      },
      "terminalFontFamily": {
        "label": "字体",
        "desc": "终端字符使用的等宽字体；选择后立即生效，关闭设置未保存则恢复原字体"
      },
      "terminalScrollback": {
        "label": "视口外滚动历史（行）",
        "desc": "限制「已滚出屏幕上方」仍保留的行数，不包含当前窗口里可见的那些行（可见行数由窗口高度决定）。向上滚动能浏览的总行数约为「本数值 + 终端高度行数」。可设置 {min}–{max} 行，越大越占内存。保存后生效"
      },
      "sshKeepaliveInterval": {
        "label": "SSH keepalive 间隔（秒）",
        "desc": "0 表示关闭（默认，与 PuTTY/OpenSSH 一致）。定期发送 SSH 层探测包，可减轻 NAT/防火墙因 TCP 空闲而断线。华三等部分老旧设备可能无法正确处理 keepalive，会出现约间隔秒数后断连，此类设备请保持 0。保存后对新建立的 SSH/SFTP 连接生效"
      },
      "loggingMode": {
        "label": "终端 I/O 日志",
        "desc": "选「无」关闭。否则将会话写入下方目录中的独立 .log 文件。「原始流追加」按下行数据去 ANSI 后追加，在 zsh 重绘等场景可能与所见不一致；「缓冲快照覆盖」从 xterm 缓存导出纯文本并覆盖写入，与屏幕输出一致，但超过「视口外滚动历史（行）」会丢弃更早内容且覆盖写入对磁盘不友好，特别是当使用「视口外滚动历史（行）」较大时，可能会导致磁盘占用过高，不推荐使用该模式"
      },
      "logPath": {
        "label": "日志保存目录",
        "desc": "留空则保存至系统下载目录下的「zterm-session-log」文件夹。须位于主目录、文稿、下载、桌面、音乐、图片、视频等用户目录下；Windows 还可选系统盘（通常为 C 盘）以外的整盘路径，Linux / macOS 还可选根分区以外的独立挂载点或外置卷（如 /mnt、/media、/Volumes 下路径），否则写入会被主进程拒绝"
      },
      "saveSecretsToVault": {
        "label": "保存敏感凭据到加密存储",
        "desc": "开启后，保存 SSH 会话时会把密码、私钥路径或 PEM、私钥 passphrase 等一并写入系统加密存储。\n关闭后不再写入新凭据，但已保存的敏感信息会保留；若系统不支持加密，保存会话时会提示且不会把明文写入磁盘"
      }
    },
    "options": {
      "themeDark": "暗黑",
      "themeLight": "浅色",
      "themeAuto": "自动（跟随系统）",
      "langAuto": "自动（跟随系统）",
      "langZh": "简体中文",
      "langEn": "English",
      "backspaceAuto": "Auto",
      "backspaceDel": "DEL (0x7F)",
      "backspaceBs": "BS (0x08)",
      "loggingModeNone": "无",
      "loggingModeStream": "原始流追加",
      "loggingModeBuffer": "缓冲快照覆盖（不推荐）",
      "terminalFont": {
        "cascadia": "Cascadia Code",
        "jetbrains": "JetBrains Mono",
        "fira": "Fira Code",
        "menlo": "Menlo",
        "consolas": "Consolas",
        "source-code-pro": "Source Code Pro",
        "courier-new": "Courier New"
      }
    },
    "logChooseDir": "选择目录",
    "logCurrentDir": "当前日志目录：\n{path}",
    "logDefaultDir": "系统下载目录（默认）",
    "logResetDefault": "恢复默认目录为：\n{path}",
    "logResetAria": "恢复默认日志目录",
    "logPathDisabledTip": "当前未启用终端 I/O 日志，目录设置无效；先选择缓冲或原始流模式后再配置",
    "vaultEncryptionUnavailableTip": "当前系统不支持加密存储（例如 Linux 未配置密钥环），无法开启此项；保存 SSH 会话时不会将密码、私钥等写入加密库",
    "logPathRejected": "所选目录不在允许范围内，会话日志将无法写入",
    "logPathValidateFail": "校验日志目录失败：{msg}",
    "choose": "选择",
    "algoTitle": "SSH/SFTP 算法",
    "algoIntro": "除非连接老旧设备，否则慎用标记为「不安全」的算法，会降低协商强度",
    "resetDefault": "重置全部算法",
    "algoCategory": "算法类别",
    "resetSection": "重置当前算法",
    "weakBadge": "不安全",
    "weakTip": "遗留或较弱的算法，可能存在安全风险，仅在为兼容老旧 SSH 服务端时启用",
    "highlightRules": "高亮规则",
    "highlightDesc": "为终端输出文本定义匹配表达式和高亮颜色",
    "resetRules": "重置规则",
    "addRule": "新增规则",
    "ruleN": "规则 {n}",
    "ruleNamePh": "请输入规则名称",
    "ruleNameTip": "规则名称",
    "ruleEnabled": "规则已启用",
    "ruleDisabled": "规则已禁用",
    "delete": "删除",
    "patternPh": "请输入匹配规则",
    "patternTip": "匹配高亮文本规则",
    "colorTip": "点击选择匹配成功时终端里显示的高亮颜色",
    "matchOptions": "匹配选项",
    "caseAria": "区分大小写",
    "caseTipOn": "区分大小写（点击改为忽略大小写）",
    "caseTipOff": "忽略大小写（点击改为区分大小写）",
    "regexAria": "使用正则表达式",
    "regexTipOn": "使用正则表达式（点击改为纯文本匹配）",
    "regexTipOff": "纯文本匹配（点击改为正则）",
    "clearSecrets": "清空全部已保存的敏感信息",
    "clearSecretsDesc": "立即删除加密库中所有凭据；不影响会话列表与本地设置",
    "clearKnownHosts": "清除已知主机公钥",
    "clearKnownHostsDesc": "删除已信任的 SSH 主机公钥指纹，下次连接将重新确认",
    "clear": "清空",
    "exportSessions": "导出会话",
    "exportSessionsDesc": "将所有保存的会话导出为 JSON 文件",
    "importSessions": "导入会话",
    "importSessionsDesc": "从 JSON 文件导入会话。与现有会话合并，重复 savedId 的会话会被忽略；仅当名称与分组均相同时才视为重复",
    "export": "导出",
    "import": "导入",
    "clearAllSessions": "清除所有会话",
    "clearAllSessionsDesc": "删除全部保存的会话和分组，操作不可恢复",
    "clearAll": "清除",
    "exportSettings": "导出设置",
    "exportSettingsDesc": "将当前所有设置导出为 JSON 文件",
    "importSettings": "导入设置",
    "importSettingsDesc": "从 JSON 文件导入设置。高亮规则与现有的合并，重复 id 或 name 的规则会被忽略；其他设置将覆盖当前设置",
    "restoreDefaults": "恢复默认设置",
    "restoreDefaultsDesc": "将本地保存的全部选项重置为应用内置默认值（不影响已保存的会话列表与加密库中的敏感信息）",
    "restoreDefaultBtn": "恢复默认",
    "confirmResetHighlight": "确定将高亮规则重置为内置默认列表吗？\n当前列表中的规则会被全部替换；重置后请点击「保存」或「保存并关闭」写入本地",
    "importSessionsOk": "已导入 {n} 个新会话{duplicateNote}",
    "importSessionsDuplicatesNote": "（重复会话已忽略）",
    "importSessionsPartial": "已导入 {n} 个新会话{duplicateNote}\n\n以下项未按文件原样生效：\n{details}",
    "importSessionWarnings": {
      "ungrouped": "未分组",
      "sessionSkipped": "会话第 {index} 条已跳过：{reasonText}",
      "fieldDefaulted": "会话第 {index} 条：「{fieldLabel}」值「{value}」无效，已使用 {result}",
      "mergeDuplicateSavedId": "导入会话第 {index} 条（{label}）未合并：savedId「{savedId}」与现有会话重复",
      "mergeDuplicateLabel": "导入会话第 {index} 条（{label}）未合并：名称与分组（{group}）均与现有会话重复",
      "skipReason": {
        "notObject": "格式无效（不是对象）",
        "invalidType": "type 无效（须为 ssh、telnet 或 serial）",
        "missingHost": "缺少主机地址 host",
        "missingPath": "缺少串口路径 path"
      }
    },
    "importFail": "导入失败：{msg}",
    "importPathDenied": "所选文件路径不在允许范围内。\n\n{hint}",
    "exportFail": "导出失败：{msg}",
    "exportSessionsOk": "已导出 {n} 个会话",
    "exportSettingsOk": "设置已导出",
    "importFileKind": {
      "sessions": "会话",
      "settings": "设置"
    },
    "importErrors": {
      "invalidJson": "不是有效的 JSON 文件",
      "fileTooLarge": "文件过大（上限 {max} MB）",
      "tooManySessions": "会话数量过多（上限 {max} 个）",
      "readFailed": "无法读取所选文件",
      "wrongFileType": "文件类型不匹配，请选择 ZTerm 导出的{kind} JSON",
      "unsupportedVersion": "不支持的导出文件版本（当前支持的版本为 {version}）",
      "invalidPayload": "文件内容格式无效",
      "noValidSessions": "文件中没有可导入的会话（共跳过 {skipped} 条无效记录）"
    },
    "confirmClearSessions": "确定要清除所有保存的会话和分组吗？\n此操作不可恢复！",
    "confirmClearSessions2": "再次确认：将删除全部会话数据，确定继续？",
    "clearedSessions": "已清除所有会话和分组",
    "importSettingsDuplicatesNote": "（重复规则已忽略）",
    "importSettingsOk": "设置已导入{duplicateNote}，请点击「保存」按钮应用更改",
    "importSettingsPartial": "设置已导入{duplicateNote}，请点击「保存」按钮应用更改。\n\n以下项未按文件原样生效：\n{details}",
    "importWarnings": {
      "invalidBoolean": "「{fieldLabel}」：值无效（须为 true 或 false），已保留当前设置",
      "invalidEnum": "「{fieldLabel}」：值「{value}」无效，已保留当前设置",
      "valueClamped": "「{fieldLabel}」：值「{value}」超出允许范围，已调整为 {result}",
      "logPathNotString": "「{fieldLabel}」：值类型无效，已保留当前目录",
      "logPathRejected": "「{fieldLabel}」：路径「{value}」无效或不可写，已保留当前目录",
      "highlightRulesNotArray": "高亮规则：导入项不是数组，已保留现有规则",
      "highlightRuleSkipped": "高亮规则第 {index} 条已跳过：{reasonText}",
      "highlightRuleReason": {
        "invalidFormat": "格式无效（不是对象）",
        "missingPattern": "缺少匹配高亮文本规则",
        "invalidRegex": "正则表达式无效",
        "duplicateId": "id「{id}」与现有规则重复",
        "duplicateName": "名称「{name}」与现有规则重复"
      },
      "algorithmPreferencesNotObject": "SSH/SFTP 算法偏好：格式无效，已保留当前配置",
      "algorithmSectionInvalidType": "算法类别「{sectionLabel}」：须为数组，已保留当前该类配置",
      "algorithmSectionAllInvalid": "算法类别「{sectionLabel}」：所列算法均无效，已保留当前该类配置",
      "algorithmSectionPartialInvalid": "算法类别「{sectionLabel}」：已忽略 {skipped} 个无效算法"
    },
    "confirmRestore": "确定将所有本地设置恢复为默认值吗？\n终端高亮规则、SSH 算法偏好、日志路径、确认选项与凭据存储开关等都会重置；已保存的会话与加密库中的敏感信息不会删除，此操作不可撤销",
    "confirmRestore2": "再次确认：将立即把默认设置写入本机存储并生效，是否继续？",
    "restored": "已恢复为默认设置",
    "confirmClearVault": "确定清空全部已加密保存的敏感信息？\n已保存的会话列表仍会保留，但 SSH 的密码、私钥与 passphrase 需重新输入或重新保存",
    "confirmClearVault2": "再次确认：此操作不可恢复",
    "confirmClearKnownHosts": "确定清除全部已保存的 SSH 已知主机公钥？下次连接这些主机时将再次弹出指纹确认",
    "clearedKnownHosts": "已清除全部已知主机公钥",
    "clearKnownHostsFail": "清除失败：{msg}",
    "clearedVault": "已清空全部敏感信息",
    "clearVaultFail": "清空失败：{msg}",
    "unnamedRule": "未命名规则{n}",
    "algo": {
      "kex": "密钥交换 (kex)",
      "kexDesc": "用于协商 SSH 连接的密钥交换算法",
      "serverHostKey": "主机密钥 (serverHostKey)",
      "serverHostKeyDesc": "用于验证服务器身份的主机密钥算法",
      "cipher": "加密算法 (cipher)",
      "cipherDesc": "用于加密传输数据的对称加密算法",
      "hmac": "消息认证码 (hmac)",
      "hmacDesc": "用于验证 SSH 数据完整性的哈希算法",
      "compress": "压缩算法 (compress)",
      "compressDesc": "用于 SSH 连接压缩传输数据的算法"
    }
  },
  en: {
    "title": "Settings",
    "cancel": "Cancel",
    "save": "Save",
    "saveClose": "Save & close",
    "tabs": {
      "general": "General",
      "sshTerminal": "SSH & terminal",
      "dataSecurity": "Data & security"
    },
    "sections": {
      "appearance": "Appearance & language",
      "confirm": "Confirmations",
      "terminal": "Terminal behavior",
      "logging": "Logging",
      "ssh": "SSH connection",
      "algorithm": "SSH/SFTP algorithms",
      "highlight": "Terminal highlighting",
      "credentials": "Credential storage",
      "sessions": "Sessions",
      "settingsMgmt": "Settings file"
    },
    "fields": {
      "appTheme": {
        "label": "App theme",
        "desc": "Dark, light, or match the system. Default is follow system; applies after you save"
      },
      "uiLanguage": {
        "label": "语言 / Language",
        "desc": "With Automatic, the UI follows the system locale (Simplified Chinese vs English). Applies after you save"
      },
      "confirmDeleteSession": {
        "label": "Confirm before deleting a session",
        "desc": "Ask before removing a saved session"
      },
      "confirmDeleteGroup": {
        "label": "Confirm before deleting a group",
        "desc": "Ask before removing a group"
      },
      "deleteGroupWithSessions": {
        "label": "Deleting group also deletes sessions",
        "desc": "If off, only the group is removed; sessions become ungrouped"
      },
      "terminalInteract": {
        "label": "Copy on select / paste on right-click",
        "desc": "Auto-copy selection; right-click pastes clipboard"
      },
      "terminalFontFamily": {
        "label": "Font",
        "desc": "Monospace font for the terminal; applies immediately. If you close settings without saving, the previous font is restored"
      },
      "terminalScrollback": {
        "label": "Scrollback (lines above viewport)",
        "desc": "Rows kept after they scroll off the top—not the on-screen rows (those depend on window height). Total lines you can scroll through is about this value plus the terminal row count. Range {min}–{max}. Higher uses more RAM. Takes effect after you save"
      },
      "sshKeepaliveInterval": {
        "label": "SSH keepalive interval (seconds)",
        "desc": "0 = off (default, same as PuTTY/OpenSSH). Sends periodic SSH-level probes to reduce NAT/firewall idle TCP drops. Some legacy gear (e.g. old H3C) mishandle keepalive and may disconnect after about this interval—leave at 0 for those devices. Applies to new SSH/SFTP connections after you save"
      },
      "loggingMode": {
        "label": "Terminal I/O logging",
        "desc": "Choose “None” to disable. Otherwise each session is written to its own .log file under the directory below. Raw stream append: strip ANSI and append chunks (can diverge from what you see, e.g. zsh redraws). Buffer snapshot overwrite: export plain text from the xterm buffer and overwrite the file (matches the screen, but scrollback limits history and overwrite is heavier on disk, especially when using large scrollback limits, which may cause high disk usage, not recommended to use this mode)"
      },
      "logPath": {
        "label": "Log directory",
        "desc": "Empty = Downloads/zterm-session-log. Must be under user Home, Documents, Downloads, Desktop, Music, Pictures, Videos paths. On Windows you may also use a whole drive other than the system drive (usually C:). On Linux and macOS you may use separate mount points or external volumes outside the root filesystem (e.g. under /mnt, /media, or /Volumes). Other paths are rejected by the main process"
      },
      "saveSecretsToVault": {
        "label": "Save secrets to encrypted storage",
        "desc": "When on, saving SSH sessions stores password, private key / PEM, and passphrase in OS secure storage.\nWhen off, new secrets are not written, but existing vault entries stay; if encryption is unavailable, saving will warn and avoid writing plaintext"
      }
    },
    "options": {
      "themeDark": "Dark",
      "themeLight": "Light",
      "themeAuto": "Automatic (follow system)",
      "langAuto": "Automatic (follow system)",
      "langZh": "简体中文",
      "langEn": "English",
      "backspaceAuto": "Auto",
      "backspaceDel": "DEL (0x7F)",
      "backspaceBs": "BS (0x08)",
      "loggingModeNone": "None",
      "loggingModeStream": "Raw stream append",
      "loggingModeBuffer": "Buffer snapshot overwrite (not recommended)",
      "terminalFont": {
        "cascadia": "Cascadia Code",
        "jetbrains": "JetBrains Mono",
        "fira": "Fira Code",
        "menlo": "Menlo",
        "consolas": "Consolas",
        "source-code-pro": "Source Code Pro",
        "courier-new": "Courier New"
      }
    },
    "logChooseDir": "Choose folder",
    "logCurrentDir": "Current log directory:\n{path}",
    "logDefaultDir": "Downloads (default)",
    "logResetDefault": "Reset default directory to:\n{path}",
    "logResetAria": "Reset log directory to default",
    "logPathDisabledTip": "Logging is off, directory is ignored. Pick buffer or stream mode first to configure it",
    "vaultEncryptionUnavailableTip": "Encrypted storage is unavailable on this system (e.g. no keyring on Linux). This option cannot be enabled; SSH passwords and keys will not be saved to the vault",
    "logPathRejected": "This folder is outside the allowed locations; session logs cannot be written there",
    "logPathValidateFail": "Could not validate log folder: {msg}",
    "choose": "Browse",
    "algoTitle": "SSH/SFTP algorithms",
    "algoIntro": "Unless connecting to old devices, use items marked “weak” with caution (weakens negotiation)",
    "resetDefault": "Reset all algorithms",
    "algoCategory": "Category",
    "resetSection": "Reset current algorithm",
    "weakBadge": "Weak",
    "weakTip": "Legacy or weak algorithm; security risk—enable only for old SSH servers",
    "highlightRules": "Highlight rules",
    "highlightDesc": "Patterns and colors for terminal output",
    "resetRules": "Reset rules",
    "addRule": "Add rule",
    "ruleN": "Rule {n}",
    "ruleNamePh": "Rule name",
    "ruleNameTip": "Rule name",
    "ruleEnabled": "Rule enabled",
    "ruleDisabled": "Rule disabled",
    "delete": "Delete",
    "patternPh": "Match pattern",
    "patternTip": "Highlight pattern",
    "colorTip": "Pick highlight color when matched",
    "matchOptions": "Match options",
    "caseAria": "Case sensitive",
    "caseTipOn": "Case sensitive (click to ignore case)",
    "caseTipOff": "Ignore case (click for case sensitive)",
    "regexAria": "Regular expression",
    "regexTipOn": "Regex (click for plain text)",
    "regexTipOff": "Plain text (click for regex)",
    "clearSecrets": "Clear all stored secrets",
    "clearSecretsDesc": "Remove every credential from the vault; sessions and settings stay",
    "clearKnownHosts": "Clear known SSH host keys",
    "clearKnownHostsDesc": "Remove trusted SSH host key fingerprints, you will be prompted again on next connect",
    "clear": "Clear",
    "exportSessions": "Export sessions",
    "exportSessionsDesc": "Export all saved sessions to JSON",
    "importSessions": "Import sessions",
    "importSessionsDesc": "Import sessions from JSON. Merge with existing sessions; duplicate savedId is ignored; same name counts as duplicate only when the group matches too",
    "export": "Export",
    "import": "Import",
    "clearAllSessions": "Clear all sessions",
    "clearAllSessionsDesc": "Delete every saved session and group; cannot undo",
    "clearAll": "Clear",
    "exportSettings": "Export settings",
    "exportSettingsDesc": "Export current settings to JSON",
    "importSettings": "Import settings",
    "importSettingsDesc": "Import settings from JSON. Highlight rules are merged, rules with duplicate id or name are ignored; other settings overwrite current settings",
    "restoreDefaults": "Restore defaults",
    "restoreDefaultsDesc": "Reset all local options to app defaults (saved sessions and vault secrets are kept)",
    "restoreDefaultBtn": "Restore defaults",
    "confirmResetHighlight": "Reset highlight rules to built-in defaults?\nCurrent rules will be replaced; click Save or Save & close to persist",
    "importSessionsOk": "Imported {n} new session(s){duplicateNote}",
    "importSessionsDuplicatesNote": " (duplicate sessions ignored)",
    "importSessionsPartial": "Imported {n} new session(s){duplicateNote}\n\nThe following were not applied as in the file:\n{details}",
    "importSessionWarnings": {
      "ungrouped": "Ungrouped",
      "sessionSkipped": "Session #{index} skipped: {reasonText}",
      "fieldDefaulted": "Session #{index}: “{fieldLabel}” value “{value}” is invalid; using {result}",
      "mergeDuplicateSavedId": "Session #{index} ({label}) not merged: savedId “{savedId}” duplicates an existing session",
      "mergeDuplicateLabel": "Session #{index} ({label}) not merged: name and group ({group}) both match an existing session",
      "skipReason": {
        "notObject": "invalid format (not an object)",
        "invalidType": "invalid type (must be ssh, telnet, or serial)",
        "missingHost": "missing host address",
        "missingPath": "missing serial path"
      }
    },
    "importFail": "Import failed: {msg}",
    "importPathDenied": "The selected file path is not allowed.\n\n{hint}",
    "exportFail": "Export failed: {msg}",
    "exportSessionsOk": "Exported {n} session(s)",
    "exportSettingsOk": "Settings exported",
    "importFileKind": {
      "sessions": "sessions",
      "settings": "settings"
    },
    "importErrors": {
      "invalidJson": "Not a valid JSON file",
      "fileTooLarge": "File is too large (max {max} MB)",
      "tooManySessions": "Too many sessions (max {max})",
      "readFailed": "Could not read the selected file",
      "wrongFileType": "Wrong file type—use a ZTerm {kind} export JSON",
      "unsupportedVersion": "Unsupported export file version (current supported version is {version})",
      "invalidPayload": "Invalid file contents",
      "noValidSessions": "No importable sessions in file ({skipped} invalid record(s) skipped)"
    },
    "confirmClearSessions": "Delete all saved sessions and groups?\nThis cannot be undone",
    "confirmClearSessions2": "Confirm again: all session data will be removed. Continue?",
    "clearedSessions": "All sessions and groups cleared",
    "importSettingsDuplicatesNote": " (duplicate rules ignored)",
    "importSettingsOk": "Settings imported{duplicateNote}—click Save to apply",
    "importSettingsPartial": "Settings imported{duplicateNote}—click Save to apply.\n\nThe following were not applied as in the file:\n{details}",
    "importWarnings": {
      "invalidBoolean": "“{fieldLabel}”: invalid value (must be true or false); kept current setting",
      "invalidEnum": "“{fieldLabel}”: value “{value}” is invalid; kept current setting",
      "valueClamped": "“{fieldLabel}”: value “{value}” is out of range; adjusted to {result}",
      "logPathNotString": "“{fieldLabel}”: invalid type; kept current directory",
      "logPathRejected": "“{fieldLabel}”: path “{value}” is invalid or not writable; kept current directory",
      "highlightRulesNotArray": "Highlight rules: import value is not an array; kept existing rules",
      "highlightRuleSkipped": "Highlight rule #{index} skipped: {reasonText}",
      "highlightRuleReason": {
        "invalidFormat": "invalid format (not an object)",
        "missingPattern": "missing match highlight text pattern",
        "invalidRegex": "invalid regular expression",
        "duplicateId": "id “{id}” duplicates an existing rule",
        "duplicateName": "name “{name}” duplicates an existing rule"
      },
      "algorithmPreferencesNotObject": "SSH/SFTP algorithm preferences: invalid format; kept current configuration",
      "algorithmSectionInvalidType": "Algorithm category “{sectionLabel}”: must be an array; kept current list for this category",
      "algorithmSectionAllInvalid": "Algorithm category “{sectionLabel}”: all listed algorithms are invalid; kept current list",
      "algorithmSectionPartialInvalid": "Algorithm category “{sectionLabel}”: ignored {skipped} invalid algorithm(s)"
    },
    "confirmRestore": "Restore all local settings to defaults?\nHighlight rules, SSH algorithms, log path, confirmations, and vault toggle will reset. Saved sessions and vault secrets are kept. Cannot undo",
    "confirmRestore2": "Confirm again: defaults will be written immediately. Continue?",
    "restored": "Restored default settings",
    "confirmClearVault": "Clear all encrypted secrets?\nSaved sessions remain, but SSH passwords, keys, and passphrases must be re-entered",
    "confirmClearVault2": "This cannot be undone. Continue?",
    "confirmClearKnownHosts": "Clear all saved SSH known host keys? You will be asked to verify host keys again on next connect",
    "clearedKnownHosts": "Known host keys cleared",
    "clearKnownHostsFail": "Clear failed: {msg}",
    "clearedVault": "All secrets cleared",
    "clearVaultFail": "Clear failed: {msg}",
    "unnamedRule": "Unnamed rule {n}",
    "algo": {
      "kex": "Key exchange (kex)",
      "kexDesc": "Algorithms used to negotiate session keys",
      "serverHostKey": "Host key (serverHostKey)",
      "serverHostKeyDesc": "Server host key algorithms",
      "cipher": "Cipher",
      "cipherDesc": "Symmetric encryption for the channel",
      "hmac": "MAC (hmac)",
      "hmacDesc": "Message authentication / integrity",
      "compress": "Compression",
      "compressDesc": "Compression algorithms"
    }
  },
}
