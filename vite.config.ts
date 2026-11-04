import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Listen on all interfaces so the dev server is reachable from a phone on the same Wi-Fi
  // (Vite prints the Network URL). Owner preference, 2026-11-04.
  server: { host: true },
  build: {
    // Rolldown chunking: one cached vendor chunk per large library, and no micro-chunks for
    // shared app modules (they fold into whichever page imports them, or a small shared chunk).
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          groups: [
            { name: 'react', test: /node_modules\/(react|react-dom|scheduler|react-router)\// },
            { name: 'supabase', test: /node_modules\/@supabase\// },
            { name: 'query', test: /node_modules\/@tanstack\// },
            { name: 'dnd', test: /node_modules\/@dnd-kit\// },
            { name: 'vendor', test: /node_modules\// },
          ],
        },
      },
    },
  },
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
  },
})
