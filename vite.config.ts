import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const BACKEND_URL = 'https://admin.kssindustri.site';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  define: {
    // Inject storage base URL so it's available as import.meta.env.VITE_STORAGE_BASE_URL
    // regardless of whether a .env file is present (dev & production build).
    'import.meta.env.VITE_STORAGE_BASE_URL': JSON.stringify(BACKEND_URL),
  },
  server: {
    // Dev proxy: forward /api/* to backend so cookies work (same-origin).
    // This is ONLY used in development (npm run dev).
    // In production, the frontend is served from the same domain as the API,
    // so cookies work without a proxy.
    proxy: {
      '/api': { 
        target: BACKEND_URL,
        changeOrigin: true,
        secure: true,
        // Rewrite Set-Cookie headers so they work on localhost
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map((cookie: string) =>
                cookie
                  .replace(/;\s*Domain=[^;]*/gi, '')   // Remove Domain=admin.kssindustri.site
                  .replace(/;\s*Secure/gi, '')          // Remove Secure (http://localhost)
                  .replace(/;\s*SameSite=\w+/gi, '; SameSite=Lax')
              );
            }
          });
        },
      },
    }
  },
  build: {
    chunkSizeWarningLimit: 160000,
  }
  })  