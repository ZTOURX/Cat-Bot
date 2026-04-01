import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Must mirror tsconfig.app.json paths — Vite resolves modules independently of TypeScript
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})