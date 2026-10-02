import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';
import { ensureRules, startAlertsJob, stopAlertsJob } from './services/alertService.js';

async function main() {
  await connectDB(env.MONGODB_URI);
  await ensureRules();

  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info(`API escuchando en http://localhost:${env.PORT}/api/v1`));
  startAlertsJob(env.ALERTS_JOB_MINUTES);

  const shutdown = async (signal) => {
    logger.info(`${signal} recibido, cerrando…`);
    stopAlertsJob();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // El mensaje de Mongo puede incluir el host, nunca credenciales; aun así se resume.
  logger.fatal({ err: err.message }, 'No se pudo iniciar el servidor');
  process.exit(1);
});
