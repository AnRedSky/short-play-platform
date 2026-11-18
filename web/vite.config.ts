import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// Single knob for the dev proxy: VITE_API_PROXY_TARGET from web/.env, falling
// back to the documented API_PORT default, so no second hardcoded port exists.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const proxyTarget = env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000'

  return {
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Development proxies to the local API so the browser talks to one origin.
      proxy: { '/api': { target: proxyTarget, changeOrigin: true } },
    },
    build: { outDir: 'dist', sourcemap: false },
  }
})
