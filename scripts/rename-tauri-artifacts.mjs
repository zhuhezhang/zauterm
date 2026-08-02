#!/usr/bin/env node
/**
 * 构建后处理（由 npm run tauri:build 调用）：
 * 1) 在 Tauri 默认安装包名上于版本号与架构之间插入系统名（保留 `_` 与原架构名）
 * 2) Windows：额外复制免安装主程序到 bundle/portable/
 *
 * 示例：
 *   ZauTerm_3.2.9_aarch64.dmg      → ZauTerm_3.2.9_mac_aarch64.dmg
 *   ZauTerm_3.2.9_x64-setup.exe    → ZauTerm_3.2.9_win_x64-setup.exe
 *   ZauTerm.exe                    → bundle/portable/ZauTerm_3.2.9_win_x64-portable.exe
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// import.meta.url：当前这个模块的 URL，对本地文件一般是 file:///Users/zhuhezhang/*/rename-tauri-artifacts.mjs
// fileURLToPath：将 URL 转换为文件绝对路径（包括文件名）
// path.dirname：获取文件绝对路径的目录（不包括文件名）
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')  // 拼接目录，这里是获取__dirname的父目录，即项目根目录的绝对路径
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))  // 读取 package.json 文件
const tauriConf = JSON.parse(
  fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'),  // 读取 tauri.conf.json 文件
)

const productName = tauriConf.productName || 'ZauTerm'
const mainBinaryName = tauriConf.mainBinaryName || productName
const version = tauriConf.version || pkg.version
const bundleRoot = path.join(root, 'src-tauri', 'target', 'release', 'bundle')
const targetRoot = path.join(root, 'src-tauri', 'target')

/**
 * 将字符串中的特殊字符转义，防止正则表达式出错
 * @param {string} s 字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 根据文件名后缀推断系统名
 * @param {string} core 不含 .sig 的文件名
 * @returns {'mac' | 'win' | 'linux' | null}
 */
function detectOs(core) {
  const lower = core.toLowerCase()
  // 勿把已生成的 portable 再当「待插入 os」的对象：名字里已有 _win_
  if (lower.endsWith('-portable.exe')) return 'win'
  if (lower.endsWith('-setup.exe') || lower.endsWith('.msi')) return 'win'
  if (lower.endsWith('.dmg') || lower.endsWith('.zip')) return 'mac'
  if (lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.rpm')) {
    return 'linux'
  }
  if (lower.endsWith('.tar.gz')) return 'linux'
  return null
}

/**
 * 将文件名转换为 ZauTerm 风格
 * @param {string} baseName 文件名
 * @returns {{ destName: string } | null} 转换后的文件名
 */
function mapArtifactName(baseName) {
  if (baseName.endsWith('.app')) return null
  // 便携版由 publishWindowsPortable 直接写出最终名，跳过
  if (baseName.toLowerCase().endsWith('-portable.exe')) return null

  const sig = baseName.endsWith('.sig')
  const core = sig ? baseName.slice(0, -4) : baseName  // .sig：更新器用的签名旁路文件；先剥掉 .sig 再匹配主体，最后再拼回去

  const os = detectOs(core)
  if (!os) return null
  if (new RegExp(`_${escapeRegExp(version)}_${os}_`, 'i').test(core)) {
    return null
  }

  const m = core.match(new RegExp(`^(.+)_${escapeRegExp(version)}_(.+)$`, 'i'))
  if (!m) return null

  return { destName: `${m[1]}_${version}_${os}_${m[2]}${sig ? '.sig' : ''}` }
}

/**
 * 遍历目录下的所有文件
 * @param {string} dir 目录路径
 * @returns {string[]} 文件路径数组
 */
function walkFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name.endsWith('.app')) continue
      out.push(...walkFiles(full))
    } else if (ent.isFile()) {
      out.push(full)
    }
  }
  return out
}

/**
 * 从已有 nsis/msi 文件名或 process.arch 推断 Windows 架构 token（x64 / arm64 / x86）
 * @returns {string} Windows 架构 token
 */
function detectWindowsArch() {
  for (const sub of ['nsis', 'msi']) {
    const dir = path.join(bundleRoot, sub)
    for (const filePath of walkFiles(dir)) {
      const base = path.basename(filePath)
      let m = base.match(/_(x64|x86|arm64)(?:-setup)?\.exe$/i)
      if (m) return m[1].toLowerCase()
      m = base.match(/_(x64|x86|arm64)_/i)
      if (m) return m[1].toLowerCase()
    }
  }
  if (process.arch === 'arm64') return 'arm64'
  if (process.arch === 'ia32') return 'x86'
  return 'x64'
}

/**
 * 查找 release 主程序 .exe（含 cross-compile 的 target/<triple>/release）
 * @returns {string | null} release 主程序路径
 */
function findReleaseExe() {
  const exe = `${mainBinaryName}.exe`
  const candidates = [path.join(targetRoot, 'release', exe)]
  if (fs.existsSync(targetRoot)) {
    for (const ent of fs.readdirSync(targetRoot, { withFileTypes: true })) {
      if (!ent.isDirectory() || ent.name === 'release') continue
      candidates.push(path.join(targetRoot, ent.name, 'release', exe))
    }
  }
  return candidates.find((p) => fs.existsSync(p))
}

/**
 * 复制免安装主程序到 bundle/portable/
 * （Tauri 无官方 portable target；行为对齐 ZenTerm 的 *-Portable.exe）
 */
function publishWindowsPortable() {
  const src = findReleaseExe()
  if (!src) return false

  const arch = detectWindowsArch()
  const destDir = path.join(bundleRoot, 'portable')
  fs.mkdirSync(destDir, { recursive: true })
  const destName = `${productName}_${version}_win_${arch}-portable.exe`
  const destPath = path.join(destDir, destName)
  fs.copyFileSync(src, destPath)
  console.log(`portable: ${path.relative(root, src)} → ${path.relative(root, destPath)}`)
  return true
}

/**
 * 重命名打包后的所有文件
 * @returns {number} 重命名文件的数量
 */
function renameBundledArtifacts() {
  if (!fs.existsSync(bundleRoot)) {  // 如果 bundle 目录不存在，则输出警告并返回 0
    console.warn(`[rename-tauri-artifacts] bundle dir not found: ${bundleRoot}`)
    return 0
  }

  let renamed = 0
  for (const filePath of walkFiles(bundleRoot)) {
    const base = path.basename(filePath)  // 获取文件名
    const mapped = mapArtifactName(base)
    if (!mapped) continue  // 如果文件名不符合规则，则跳过

    const destPath = path.join(path.dirname(filePath), mapped.destName)  // 新路径 = 同目录 + 新文件名（原地改名）
    if (path.resolve(filePath) === path.resolve(destPath)) continue  // 如果新路径与原路径相同，则跳过

    if (fs.existsSync(destPath)) fs.rmSync(destPath, { force: true })  // 如果新路径已存在，则删除
    fs.renameSync(filePath, destPath)  // 重命名文件
    console.log(`rename: ${base} → ${mapped.destName}`)  // 输出日志
    renamed += 1
  }
  return renamed
}

function main() {
  const renamed = renameBundledArtifacts()
  if (renamed === 0 && fs.existsSync(bundleRoot)) {
    console.warn(
      '[rename-tauri-artifacts] no matching installers renamed (ok if only portable / .app)',
    )
  } else if (renamed > 0) {
    console.log(`[rename-tauri-artifacts] ${renamed} artifact(s) renamed under ${bundleRoot}`)
  }

  // Windows 构建或产物目录里已有 .exe 时生成便携版
  if (publishWindowsPortable()) {
    console.log('[rename-tauri-artifacts] Windows portable exe published under bundle/portable/')
  }
}

main()
