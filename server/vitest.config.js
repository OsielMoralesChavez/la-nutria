import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      TZ: 'America/Mexico_City',
      // Secretos SÓLO para pruebas (BD en memoria, se destruye al terminar).
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef012345678',
      ALERTS_JOB_MINUTES: '0',
      UPLOAD_DIR: 'tests/.uploads',
    },
    // La primera ejecución descarga el binario de MongoDB.
    hookTimeout: 600_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
