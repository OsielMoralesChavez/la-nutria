/**
 * MODO DEMO: levanta la API real contra un MongoDB EN MEMORIA con datos
 * ficticios. No necesita Atlas ni server/.env. Todo se borra al cerrar.
 *
 *   npm run dev:demo
 *
 * Usuarios demo y contraseña: ver server/src/seeds/demo.js (DEMO_USERS, DEMO_PASSWORD).
 */
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV === 'production') {
  console.error('El modo demo no está permitido en producción.');
  process.exit(1);
}

// Misma caché de binarios que usan las pruebas (node_modules/.cache en la raíz).
process.env.MONGOMS_DOWNLOAD_DIR ||= fileURLToPath(new URL('../../node_modules/.cache/mongodb-memory-server', import.meta.url));
const { MongoMemoryReplSet } = await import('mongodb-memory-server');

console.log('Iniciando MongoDB en memoria (la primera vez descarga el binario, puede tardar)…');
// Replica set: necesario para transacciones (cierre de consulta).
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

process.env.MONGODB_URI = mongo.getUri('la_nutria_demo');
process.env.JWT_ACCESS_SECRET ||= randomBytes(48).toString('hex');
process.env.JWT_REFRESH_SECRET ||= randomBytes(48).toString('hex');
process.env.ALERTS_JOB_MINUTES ||= '15';
process.env.TZ ||= 'America/Mexico_City';

const { connectDB } = await import('./config/db.js');
const { seedBase } = await import('./seeds/base.js');
const { seedDemo, DEMO_PASSWORD, DEMO_USERS } = await import('./seeds/demo.js');

await connectDB(process.env.MONGODB_URI);
await seedBase(() => {});
await seedDemo({ password: DEMO_PASSWORD, log: () => {} });

console.log('\nDatos demo cargados. Usuarios disponibles:');
for (const u of DEMO_USERS) console.log(`  · ${u.email.padEnd(28)} (${u.role})`);
console.log('  Contraseña: la definida en server/src/seeds/demo.js (DEMO_PASSWORD)\n');

const stop = async () => {
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

await import('./server.js');
