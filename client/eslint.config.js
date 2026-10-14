import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import unusedImports from 'eslint-plugin-unused-imports'

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
      'react': react,
      'unused-imports': unusedImports,
    },
    rules: {
      // The rules that would have caught the listener-leak / stale-closure bugs.
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // JSX references are real references: without this, every component
      // only ever rendered as <Tag /> is reported as an unused variable.
      'react/jsx-uses-vars': 'error',
      // no-undef cannot see JSX tags at all, so an unimported <Tag /> ships
      // as a runtime ReferenceError that no other gate catches (this has now
      // bitten this codebase twice: Calendar/Star, then ArrowRight).
      'react/jsx-no-undef': 'error',

      // Unused imports are autofixable (eslint --fix drops them); unused
      // variables stay visible as warnings. `^_` marks deliberate silence.
      // Catch bindings are idiomatic to name (`catch (err)`) even when the
      // error is only logged or ignored, so they are not counted.
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
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
