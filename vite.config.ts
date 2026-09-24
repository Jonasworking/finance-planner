import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const APP_BACKGROUND = '#0B0C0F'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The app asks before it swaps versions (a toast with "Aktualisieren", app/PwaUpdater).
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Finanzplaner',
        short_name: 'Finanzplaner',
        description:
          'Wöchentlich sparen: Ausgaben, Budget, Töpfe und Analyse – alles auf dem Gerät.',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: APP_BACKGROUND,
        theme_color: APP_BACKGROUND,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything the app needs offline. Fontsource ships every script of Inter; the browser
        // only ever loads Latin (unicode-range), so only those files are precached.
        globPatterns: [
          '**/*.{js,css,html}',
          'assets/inter-latin-*.woff2',
          '*.{ico,svg}',
          'pwa-*.png',
        ],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Recharts is the largest lazy chunk; precached like everything else, it must fit.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
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
