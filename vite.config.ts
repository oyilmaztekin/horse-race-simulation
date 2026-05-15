import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const API_PROXY_TARGET = 'http://localhost:3001'
const WEB_PORT = 5173

export default defineConfig({
  plugins: [vue()],
  server: {
    port: WEB_PORT,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
