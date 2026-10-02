import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En desarrollo la API se sirve por el mismo origen: la cookie de sesión
    // (SameSite=Strict, httpOnly) funciona sin configuración extra de CORS.
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY || 'http://localhost:4000', changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
