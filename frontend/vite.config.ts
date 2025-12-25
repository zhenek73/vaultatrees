import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser',
    }
  },
  optimizeDeps: {
    include: ['buffer', 'process']
  },
  define: {
    'process.env': {}
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})

