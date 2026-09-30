import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Match @vitejs/plugin-react's automatic JSX runtime so component tests
  // don't need an explicit React import (esbuild's default is classic).
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/stores/**'],
      exclude: ['src/__tests__/**'],
    },
  },
})
