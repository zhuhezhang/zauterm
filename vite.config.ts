// 该文件是 Vite 的配置文件，用于配置开发服务器、构建等
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))  // 获取当前文件的绝对路径（不包括文件名）
const host = process.env.TAURI_DEV_HOST  // 获取开发主机地址

export default defineConfig({
  plugins: [react()],  // 使用 React 插件
  clearScreen: false,  // 在控制台打印信息时，不清空屏幕
  base: './',  // 基础路径
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },  // 定义 @/ 指 src/
    extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],  // 当导入一个文件时，Vite 会尝试使用这些扩展名来查找文件
  },
  build: {
    outDir: 'dist',  // 构建输出目录
    emptyOutDir: true,  // 构建前清空输出目录
    minify: 'esbuild',  // 使用 esbuild 压缩代码
    cssMinify: true,  // 压缩 CSS 文件
    reportCompressedSize: false,  // 不生成压缩后的文件大小报告
    chunkSizeWarningLimit: 1000,  // 超过 1000 字节的 chunk 会发出警告
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',  // 目标浏览器版本
  },
  server: {
    port: 5173,  // 开发服务器端口
    strictPort: true,  // 如果端口被占用，则抛出错误
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,  // 如果 host 为空，则不启用 HMR（Hot Module Replacement）
    watch: {
      ignored: ['**/src-tauri/**'],  // 忽略 src-tauri 目录下的文件
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],  // 环境变量前缀
})
