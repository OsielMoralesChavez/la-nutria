/**
 * Uso:
 *   npm run seed        → roles, catálogos, métricas, reglas y superusuario (desde .env)
 *   npm run seed:demo   → lo anterior + datos ficticios (requiere SEED_DEMO_PASSWORD)
 */
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedBase, seedSuperuser } from './base.js';
import { seedDemo } from './demo.js';

const withDemo = process.argv.includes('--demo');

try {
  if (env.isProd && withDemo) throw new Error('No se cargan datos demo en producción');
  await connectDB(env.MONGODB_URI);
  console.log('Sembrando datos base…');
  await seedBase();
  await seedSuperuser({ name: env.SEED_SUPERUSER_NAME, email: env.SEED_SUPERUSER_EMAIL, password: env.SEED_SUPERUSER_PASSWORD });
  if (withDemo) {
    const password = process.env.SEED_DEMO_PASSWORD;
    if (!password) throw new Error('Define SEED_DEMO_PASSWORD en server/.env para crear usuarios demo en una BD real');
    console.log('Sembrando datos de demostración…');
    await seedDemo({ password });
  }
  console.log('Listo.');
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
