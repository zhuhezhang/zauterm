import type { AppSettings } from '../../types/settings'
import { normalizeHighlightRulesForSave } from './highlightRules'
import { clampTerminalScrollback, normalizeLoggingMode, clampSshKeepaliveInterval } from './normalize'
import { normalizeTerminalFontFamilyKey } from '../../../shared/terminalFonts'

/** 
 * 将设置表单转为可持久化的 AppSettings
 * @param form 设置表单
 * @param msgLang 消息语言
 * @returns 可持久化的 AppSettings
 */
export function buildSettingsFromForm(form: AppSettings, msgLang: 'zh' | 'en'): AppSettings {
  return {
    ...form,
    highlightRules: normalizeHighlightRulesForSave(form.highlightRules, msgLang),
    terminalFontFamily: normalizeTerminalFontFamilyKey(form.terminalFontFamily),
    terminalScrollback: clampTerminalScrollback(form.terminalScrollback),
    sshKeepaliveInterval: clampSshKeepaliveInterval(form.sshKeepaliveInterval),
    loggingMode: normalizeLoggingMode(form.loggingMode),
  }
}
