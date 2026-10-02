import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Carga y valida variables de entorno. Si falta algo obligatorio, la app no
 * arranca (mejor fallar al iniciar que en medio de una consulta).
 * Usa el cargador nativo de Node (>= 21), sin dependencia de dotenv.
 */
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (process.env.NODE_ENV !== 'test' && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const isTest = process.env.NODE_ENV === 'test';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: isTest ? z.string().optional() : z.string().min(1, 'MONGODB_URI es obligatoria'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ALERTS_JOB_MINUTES: z.coerce.number().int().min(0).default(15),
  FEATURE_ATTACHMENTS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(10),
  SEED_SUPERUSER_NAME: z.string().optional(),
  SEED_SUPERUSER_EMAIL: z.string().optional(),
  SEED_SUPERUSER_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Sólo se listan nombres de variables y el motivo, nunca sus valores.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\nConfiguración inválida. Revisa server/.env (ver server/.env.example):\n${issues}\n`);
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
});
