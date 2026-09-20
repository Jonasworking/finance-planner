import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Every test runs in both time zones the app will live in: calendar-day logic must not
    // depend on the UTC offset or on DST rules (AU and EU switch in opposite directions).
    projects: [
      { extends: true, test: { name: 'sydney', env: { TZ: 'Australia/Sydney' } } },
      { extends: true, test: { name: 'berlin', env: { TZ: 'Europe/Berlin' } } },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/types.ts'],
      thresholds: { lines: 90, functions: 90, branches: 80 },
    },
  },
})
