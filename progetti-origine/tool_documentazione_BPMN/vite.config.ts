import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            markdown: ['react-markdown', 'remark-gfm'],
            zip: ['jszip'],
          },
        },
      },
      chunkSizeWarningLimit: 700,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Proxy API to unified Python backend (soa-reverse-engineer/web/server.py on 8000)
      // In dev: Vite 3000 proxies /api -> 8000; in prod: Python serves dist directly on 8000
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
