import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { sanitize } from './middleware/sanitize.js';
import apiRouter from './routes/index.js';

/**
 * Composición de Express. Separada de server.js para poder probarla con
 * supertest sin abrir puertos ni conectar a Atlas.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Detrás de un proxy (Render, Railway, Nginx) para que req.ip y el rate
  // limit usen la IP real del cliente.
  app.set('trust proxy', env.isProd ? 1 : false);

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.isProd,
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Sólo método, ruta y estado. Nunca cuerpos ni query (pueden tener datos clínicos).
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );

  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use(sanitize);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1', apiLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
