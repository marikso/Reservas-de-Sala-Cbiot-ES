import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 4321,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8061',
        changeOrigin: true,
      },
    },
  },
});
