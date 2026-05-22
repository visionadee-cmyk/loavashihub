import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Ensure service worker and manifest are not bundled
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    headers: {
      // Required for service worker to work in development
      'Service-Worker-Allowed': '/',
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 5173,
    },
  },
})
