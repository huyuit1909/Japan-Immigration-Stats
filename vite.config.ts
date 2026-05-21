import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/estat': {
        target: 'https://api.e-stat.go.jp/rest/3.0/app/json',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/estat/, '')
      }
    }
  }
})
