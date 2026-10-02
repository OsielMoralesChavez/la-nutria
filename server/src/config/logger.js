import pino from 'pino';
import { env } from './env.js';

/**
 * Campos que jamás deben llegar a un log. pino los reemplaza por "[REDACTED]".
 * Incluye credenciales y cualquier cuerpo de petición (puede traer datos
 * clínicos): los handlers registran sólo identificadores.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  '*.password',
  '*.passwordHash',
  '*.token',
  'body',
  'req.body',
];

const transport =
  !env.isProd && !env.isTest
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined;

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  transport,
});
