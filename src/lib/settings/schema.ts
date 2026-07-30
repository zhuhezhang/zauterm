import { TERMINAL_SCROLLBACK_MIN, TERMINAL_SCROLLBACK_MAX, SSH_KEEPALIVE_INTERVAL_MIN, SSH_KEEPALIVE_INTERVAL_MAX } from './defaults'
import { TERMINAL_FONT_FAMILY_OPTIONS } from '../../../shared/terminalFonts'

/** 设置对话框标签页（labelKey 对应 settings.tabs.*） */
export const SETTINGS_TABS = [
  { key: 'general', labelKey: 'settings.tabs.general' },
  { key: 'ssh-terminal', labelKey: 'settings.tabs.sshTerminal' },
  { key: 'data-security', labelKey: 'settings.tabs.dataSecurity' },
]

/** 各标签内区块顺序（与 SETTINGS_SCHEMA 中 section 字段对应） */
export const SETTINGS_TAB_SECTION_IDS = {
  'general': ['confirm', 'terminal', 'logging', 'appearance'],
  'ssh-terminal': ['algorithm', 'ssh', 'highlight'],
  'data-security': ['sessions', 'settingsMgmt', 'credentials'],
}

/** 设置界面区块与表单项定义（文案由 i18n 解析） */
export const SETTINGS_SCHEMA = [
  {
    section: 'confirm',
    items: [
      { key: 'confirmDeleteSession', type: 'boolean' },
      { key: 'confirmDeleteGroup', type: 'boolean' },
      { key: 'deleteGroupWithSessions', type: 'boolean' },
    ],
  },
  {
    section: 'terminal',
    items: [
      { key: 'terminalInteract', type: 'boolean' },
      {
        key: 'terminalFontFamily',
        type: 'select',
        options: TERMINAL_FONT_FAMILY_OPTIONS.map((o) => ({
          value: o.value,
          labelKey: `settings.options.terminalFont.${o.value}`,
        })),
      },
      {
        key: 'terminalScrollback',
        type: 'number',
        min: TERMINAL_SCROLLBACK_MIN,
        max: TERMINAL_SCROLLBACK_MAX,
        step: 500,
      },
    ],
  },
  {
    section: 'logging',
    items: [
      {
        key: 'loggingMode',
        type: 'select',
        options: [
          { value: 'none', labelKey: 'settings.options.loggingModeNone' },
          { value: 'stream', labelKey: 'settings.options.loggingModeStream' },
          { value: 'buffer', labelKey: 'settings.options.loggingModeBuffer' },
        ],
      },
      { key: 'logPath', type: 'path' },
    ],
  },
  {
    section: 'appearance',
    items: [
      {
        key: 'appTheme',
        type: 'select',
        options: [
          { value: 'dark', labelKey: 'settings.options.themeDark' },
          { value: 'light', labelKey: 'settings.options.themeLight' },
          { value: 'auto', labelKey: 'settings.options.themeAuto' },
        ],
      },
      {
        key: 'uiLanguage',
        type: 'select',
        options: [
          { value: 'auto', labelKey: 'settings.options.langAuto' },
          { value: 'zh', labelKey: 'settings.options.langZh' },
          { value: 'en', labelKey: 'settings.options.langEn' },
        ],
      },
    ],
  },
  {
    section: 'algorithm',
    kind: 'algorithm',
    header: {
      labelKey: 'settings.algoTitle',
      descKey: 'settings.algoIntro',
      actions: [{ action: 'resetAlgorithmPreferences', buttonKey: 'settings.resetDefault' }],
    },
  },
  {
    section: 'ssh',
    items: [
      {
        key: 'sshKeepaliveInterval',
        type: 'number',
        min: SSH_KEEPALIVE_INTERVAL_MIN,
        max: SSH_KEEPALIVE_INTERVAL_MAX,
        step: 5,
      },
    ],
  },
  {
    section: 'highlight',
    kind: 'highlight',
    header: {
      labelKey: 'settings.highlightRules',
      descKey: 'settings.highlightDesc',
      actions: [
        { action: 'resetHighlightRules', buttonKey: 'settings.resetRules' },
        { action: 'addHighlightRule', buttonKey: 'settings.addRule' },
      ],
    },
  },
  {
    section: 'sessions',
    items: [
      {
        type: 'action',
        action: 'exportSessions',
        labelKey: 'settings.exportSessions',
        descKey: 'settings.exportSessionsDesc',
        buttonKey: 'settings.export',
      },
      {
        type: 'action',
        action: 'importSessions',
        labelKey: 'settings.importSessions',
        descKey: 'settings.importSessionsDesc',
        buttonKey: 'settings.import',
      },
      {
        type: 'action',
        action: 'clearAllSessions',
        labelKey: 'settings.clearAllSessions',
        descKey: 'settings.clearAllSessionsDesc',
        buttonKey: 'settings.clearAll',
        danger: true,
      },
    ],
  },
  {
    section: 'settingsMgmt',
    items: [
      {
        type: 'action',
        action: 'exportSettings',
        labelKey: 'settings.exportSettings',
        descKey: 'settings.exportSettingsDesc',
        buttonKey: 'settings.export',
      },
      {
        type: 'action',
        action: 'importSettings',
        labelKey: 'settings.importSettings',
        descKey: 'settings.importSettingsDesc',
        buttonKey: 'settings.import',
      },
      {
        type: 'action',
        action: 'restoreDefaultSettings',
        labelKey: 'settings.restoreDefaults',
        descKey: 'settings.restoreDefaultsDesc',
        buttonKey: 'settings.restoreDefaultBtn',
        danger: true,
      },
    ],
  },
  {
    section: 'credentials',
    items: [
      { key: 'saveSecretsToVault', type: 'boolean' },
      {
        type: 'action',
        action: 'clearVault',
        labelKey: 'settings.clearSecrets',
        descKey: 'settings.clearSecretsDesc',
        buttonKey: 'settings.clear',
        danger: true,
      },
      {
        type: 'action',
        action: 'clearKnownHosts',
        labelKey: 'settings.clearKnownHosts',
        descKey: 'settings.clearKnownHostsDesc',
        buttonKey: 'settings.clear',
        danger: true,
      },
    ],
  },
]
