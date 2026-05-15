import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

const DEFAULT_WEB_PORT = 5173
const DEFAULT_API_PROXY_TARGET = 'http://localhost:3001'

export default defineConfig(({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const parsedPort = Number(env.WEB_PORT)
  const webPort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_WEB_PORT
  const apiProxyTarget = env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET

  return {
    plugins: [vue()],
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
