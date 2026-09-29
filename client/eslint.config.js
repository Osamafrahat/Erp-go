import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Flat config for ESLint 9. The repo previously had `npm run lint: eslint .`
// declared with no config file anywhere, so linting could never run -- which
// is why every missing-useEffect-dependency and uncleaned-listener bug in
// this codebase shipped unnoticed.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // The rules that would have caught the listener-leak / stale-closure bugs.
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Unused imports are cleanup debt, not correctness bugs. Kept as a
      // warning so they stay visible without drowning out the error-level
      // findings (duplicate object keys, undefined globals, broken hooks).
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
      // The codebase deliberately uses `catch {}` for best-effort operations
      // (non-critical fetches, cleanup). Allow those; still flag empty if/for
      // blocks, which are always a mistake.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Error-level by default from js.configs.recommended and deliberately
      // kept that way -- these are the rules that catch real breakage:
      //   no-dupe-keys, no-undef, no-empty, no-obj-calls, valid-typeof
    },
  },
  {
    // Tests and config files legitimately use console / Node globals.
    files: ['**/__tests__/**/*.{js,jsx}', 'vite.config.js', 'vitest.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-console': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
]
