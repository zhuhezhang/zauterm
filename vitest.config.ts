// 该文件是 Vitest 的配置文件，用于配置单元测试的运行环境、扫描范围、覆盖率等（释义参考vite.config.ts的注释）
import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
