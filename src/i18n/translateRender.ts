import { translate } from '../../shared/translate'
import { APP, CREDENTIALS } from './components/App'
import { CONNECT, CREDENTIAL } from './components/ConnectDialog'
import { SETTINGS } from './components/SettingsDialog'
import { SFTP } from './components/SftpPanel'
import { TABBAR } from './components/TabBar'
import { TERMINAL } from './components/TerminalPanel'
import { TITLEBAR } from './components/TitleBar'
import { WELCOME } from './components/app/WelcomeScreen'
import { ABOUT } from './components/app/AboutDialog'
import { SIDEBAR } from './components/sidebar/Sidebar'
import { SSH, TELNET, SERIAL } from './ipcErrors'
import type { TranslateParams, UiLanguage } from '../types/common'

/** 聚合各模块文案；键路径如 settings.title */
const RENDER_MESSAGES = {
  zh: {
    app: APP.zh,
    connect: CONNECT.zh,
    credential: CREDENTIAL.zh,
    credentials: CREDENTIALS.zh,
    serial: SERIAL.zh,
    ssh: SSH.zh,
    telnet: TELNET.zh,
    settings: SETTINGS.zh,
    sftp: SFTP.zh,
    sidebar: SIDEBAR.zh,
    tabbar: TABBAR.zh,
    terminal: TERMINAL.zh,
    titlebar: TITLEBAR.zh,
    welcome: WELCOME.zh,
    about: ABOUT.zh,
  },
  en: {
    app: APP.en,
    connect: CONNECT.en,
    credential: CREDENTIAL.en,
    credentials: CREDENTIALS.en,
    serial: SERIAL.en,
    ssh: SSH.en,
    telnet: TELNET.en,
    settings: SETTINGS.en,
    sftp: SFTP.en,
    sidebar: SIDEBAR.en,
    tabbar: TABBAR.en,
    terminal: TERMINAL.en,
    titlebar: TITLEBAR.en,
    welcome: WELCOME.en,
    about: ABOUT.en,
  },
}

/**
 * 翻译文案，根据语言和路径获取翻译后的文案
 * @param lang 语言
 * @param path 路径(如"zh.titlebar.close")
 * @param params 参数（如{name: '张三'}）
 * @returns 翻译后的文案
 */
export function translateRender(
  lang: UiLanguage | string,
  path: string,
  params: TranslateParams = {},
) {
  const L = lang === 'en' ? 'en' : 'zh'
  return translate(L, RENDER_MESSAGES, path, params)
}
