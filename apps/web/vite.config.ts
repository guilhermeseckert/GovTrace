import { config } from 'dotenv'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// Load .env from monorepo root into process.env BEFORE Vite starts.
// This makes ANTHROPIC_API_KEY, DATABASE_URL, etc. available in server functions.
config({ path: resolve(import.meta.dirname, '../../.env') })

export default defineConfig({
  plugins: [
    tanstackStart(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
})
