import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { yahooOptionsProxy } from './vite.yahoo-proxy.ts'

export default defineConfig({
  plugins: [react(), yahooOptionsProxy()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
