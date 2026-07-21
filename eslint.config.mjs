import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // Node scripts (build tooling, config).
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        performance: 'readonly',
      },
    },
  },
  // Service worker (demo latency simulation).
  {
    files: ['demo/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
      },
    },
  },
  // Browser demo client script.
  {
    files: ['demo/assets/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        performance: 'readonly',
        PerformanceObserver: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
  },
)
