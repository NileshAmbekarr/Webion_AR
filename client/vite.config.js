import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: true,
    // Proxy API requests to the backend — critical for Cloudflare tunnel
    // The tunnel only exposes port 5173, not 3001
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ar-temp': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  }
});
