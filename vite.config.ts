import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const API_PROXY_TARGET = 'http://localhost:3001'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
