import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'src/**/*.vue', 'server/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'src/main.ts', 'tests/**'],
    },
  },
})
