import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Flask backend runs on :5001 (5000 is used by another local project). Vite
// proxies API + media calls to it in dev so the SPA can use relative URLs (no
// CORS handling needed during development). Override with BACKEND_URL if needed.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5001';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      proxy: {
        '/api': { target: BACKEND, changeOrigin: true },
        '/media': { target: BACKEND, changeOrigin: true },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
