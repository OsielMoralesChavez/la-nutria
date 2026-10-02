import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

const common = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (req, res) =>
    res.status(429).json({
      error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiadas solicitudes. Espera un momento.', requestId: req.id },
    }),
};

/** Límite general de la API (por IP). */
export const apiLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 300 });

/** Estricto para login: frena fuerza bruta junto con el bloqueo por usuario. */
export const loginLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 20 });

export const refreshLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 30 });
