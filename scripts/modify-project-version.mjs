#!/usr/bin/env node
/**
 * 统一修改项目版本号（npm run mod:ver -- <version>）：
 *   package.json
 *   src-tauri/Cargo.toml          （仅 [package] 段）
 *   src-tauri/tauri.conf.json
 *   README.md / README.zh-CN.md   （标题行 · vX.Y.Z）
 *
 * 示例：
 *   npm run mod:ver -- 3.3.0
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

/** 宽松 semver：主.次.补丁，可选预发布/构建后缀 */
const VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

/**
 * 返回绝对路径
 * @param {string} rel 相对项目根的路径
 */
function abs(rel) {
  return path.join(root, rel)
}

/**
 * 返回文件内容
 * @param {string} filePath
 */
function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

/**
 * 写入文件内容
 * @param {string} filePath 文件路径
 * @param {string} content 文件内容
 */
function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8')
}

/**
 * 更新 package.json 中的版本号
 * @param {string} version 新版本号
 */
function updatePackageJson(version) {
  const file = abs('package.json')
  const pkg = JSON.parse(read(file))
  const prev = pkg.version
  pkg.version = version
  write(file, `${JSON.stringify(pkg, null, 2)}\n`)
  return { file: 'package.json', prev }
}

/**
 * 只改src-tauri/Cargo.toml [package] 里的 version，不动依赖版本约束
 * @param {string} version 新版本号
 */
function updateCargoToml(version) {
  const file = abs('src-tauri/Cargo.toml')
  const raw = read(file)
  let inPackage = false
  let replaced = false
  let prev = null
  const lines = raw.split(/\r?\n/)
  const out = lines.map((line) => {
    const trimmed = line.trim()
    if (/^\[package\]\s*$/.test(trimmed)) {
      inPackage = true
      return line
    }
    if (trimmed.startsWith('[')) {
      inPackage = false
      return line
    }
    if (inPackage && !replaced) {
      const m = line.match(/^(\s*version\s*=\s*")([^"]+)("\s*)$/)
      if (m) {
        prev = m[2]
        replaced = true
        return `${m[1]}${version}${m[3]}`
      }
    }
    return line
  })
  if (!replaced) {
    throw new Error('src-tauri/Cargo.toml: [package] version not found')
  }
  write(file, out.join('\n'))
  return { file: 'src-tauri/Cargo.toml', prev }
}

/**
 * 修改src-tauri/tauri.conf.json 中的 version
 * @param {string} version 新版本号
 */
function updateTauriConf(version) {
  const file = abs('src-tauri/tauri.conf.json')
  const conf = JSON.parse(read(file))
  const prev = conf.version
  if (typeof prev !== 'string') {
    throw new Error('src-tauri/tauri.conf.json: missing string "version"')
  }
  conf.version = version
  write(file, `${JSON.stringify(conf, null, 2)}\n`)
  return { file: 'src-tauri/tauri.conf.json', prev }
}

/**
 * 更新中英文README文件标题行末尾的 `· vX.Y.Z`（中英文 README 格式一致）
 * @param {string} rel 文件路径
 * @param {string} version 新版本号
 */
function updateReadmeBanner(rel, version) {
  const file = abs(rel)
  const raw = read(file)
  const re = /(·\s*v)(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)(\s*)$/m
  const m = raw.match(re)
  if (!m) {
    throw new Error(`${rel}: version banner (· vX.Y.Z) not found`)
  }
  const prev = m[2]
  write(file, raw.replace(re, `$1${version}$3`))
  return { file: rel, prev }
}

/** 打印使用说明 */
function usage() {
  console.error('Usage: npm run mod:ver -- <version>')
  console.error('Example: npm run mod:ver -- 3.3.0')
}

function main() {
  const version = process.argv[2]
  if (!version || version === '-h' || version === '--help') {
    usage()
    process.exit(version ? 0 : 1)
  }
  if (!VERSION_RE.test(version)) {
    console.error(`Invalid version: ${version}`)
    console.error('Expected semver like 3.3.0 or 3.3.0-beta.1')
    process.exit(1)
  }

  const results = [
    updatePackageJson(version),
    updateCargoToml(version),
    updateTauriConf(version),
    updateReadmeBanner('README.md', version),
    updateReadmeBanner('README.zh-CN.md', version),
  ]

  console.log(`Version → ${version}`)
  for (const { file, prev } of results) {
    console.log(`  ${file}: ${prev} → ${version}`)
  }
}

main()
