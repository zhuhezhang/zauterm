// 该文件是 ESLint 的配置文件，用于配置 ESLint 的规则、忽略的文件、全局变量等
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist/**', 'src-tauri/**', 'node_modules/**', '**/*.d.ts'] },  // 忽略的文件
  js.configs.recommended,  // 使用 ESLint 的推荐配置
  ...tseslint.configs.recommended,  // 使用 TypeScript ESLint 的推荐配置
  {
    languageOptions: {
      ecmaVersion: 2022,  // ECMAScript 版本
      sourceType: 'module',  // 源代码类型
      globals: {
        ...globals.browser,  // 浏览器全局变量
        ...globals.node,  // Node.js 全局变量
      },
    },
    rules: {
      'no-unused-vars': 'off',  // 禁用未使用的变量
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],  // 警告未使用的变量
      'no-empty': ['error', { allowEmptyCatch: true }],  // 禁止空块
      '@typescript-eslint/no-explicit-any': 'off',  // 禁用 any 类型
      '@typescript-eslint/no-require-imports': 'off',  // 禁用 require 和 import 语句
      'no-control-regex': 'off',  // 禁用控制字符正则表达式
      'prefer-const': 'off',  // 建议使用 const 声明变量
    },
  },
)
