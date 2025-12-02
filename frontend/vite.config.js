import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8001,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify('/api'),
    'import.meta.env.VITE_BASE_URL': JSON.stringify(process.env.BASE_URL || '')
  }
})