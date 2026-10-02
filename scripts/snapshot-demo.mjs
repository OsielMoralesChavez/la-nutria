/**
 * Genera la instantánea de la DEMO ESTÁTICA (GitHub Pages).
 *
 * 1. Levanta la API real en modo demo (MongoDB en memoria + datos ficticios).
 * 2. Inicia sesión como Superusuario demo y recorre los endpoints de lectura.
 * 3. Guarda las respuestas en client/.pages/demo-api.json.
 *
 * El cliente construido con VITE_STATIC_DEMO=true las sirve sin servidor
 * (ver client/src/lib/staticDemo.js). Sólo contiene datos FICTICIOS.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = process.env.SNAPSHOT_PORT ?? '4100';
const BASE = `http://localhost:${PORT}/api/v1`;
const OUT_DIR = `${root}client/.pages`;
const REPO_URL = process.env.REPO_URL ?? '';

const demoSource = await readFile(`${root}server/src/seeds/demo.js`, 'utf8');
const DEMO_PASSWORD = demoSource.match(/DEMO_PASSWORD = '([^']+)'/)[1];
const DEMO_EMAIL = demoSource.match(/email: '([^']+)', role: ROLE_KEYS\.SUPERUSER/)[1];

// ── 1. API en modo demo ──
const server = spawn(process.execPath, ['src/demo.js'], {
  cwd: `${root}server`,
  env: { ...process.env, PORT, ALERTS_JOB_MINUTES: '0', LOG_LEVEL: 'warn', NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const stop = () => server.kill();
process.on('exit', stop);

let exited = null;
server.on('exit', (code) => (exited = code));
server.stderr.on('data', (d) => process.stderr.write(d));
const deadline = Date.now() + 300_000; // la 1.ª vez puede descargar el binario de MongoDB
for (;;) {
  if (exited !== null) throw new Error(`La API demo terminó (código ${exited})`);
  if (Date.now() > deadline) throw new Error('La API demo no arrancó a tiempo');
  try {
    if ((await fetch(`http://localhost:${PORT}/health`)).ok) break;
  } catch {
    /* aún no escucha */
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.log('API demo lista. Generando instantánea…');

// ── 2. Sesión ──
const call = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.status === 204 ? null : res.json();
};

const login = await call('POST', '/auth/login', { email: DEMO_EMAIL, password: DEMO_PASSWORD });
const token = login.data.accessToken;
await call('PATCH', '/auth/preferences', { dashboardScope: 'all' }, token);
const me = await call('GET', '/auth/me', null, token);

const responses = {};
const qs = (q) => (q ? `?${new URLSearchParams(q)}` : '');
/** Guarda la respuesta COMPLETA bajo la ruta (sin query); el adaptador filtra. */
const grab = async (path, query) => {
  responses[path] = await call('GET', path + qs(query), null, token);
  return responses[path];
};

// ── 3. Recorrido ──
await grab('/auth/me');
await grab('/dashboard', { scope: 'all' });
const patients = await grab('/patients', { limit: 100 });
await grab('/users/nutritionists');
await grab('/settings');
await grab('/alert-rules');
await grab('/metrics', { includeInactive: true });
await grab('/goal-types', { includeInactive: true });
await grab('/catalogs', { includeInactive: true });
const appointments = await grab('/appointments');
await grab('/alerts', { status: 'activas', limit: 100 });
await grab('/followups', { limit: 100 });
await grab('/users', { limit: 100 });
await grab('/roles');
await grab('/permissions');
await grab('/auth/sessions');

for (const p of patients.data) {
  const base = `/patients/${p.id}`;
  await grab(base);
  await grab(`${base}/summary`);
  await grab(`${base}/timeline`, { limit: 50 });
  await grab(`${base}/measurements/series`);
  await grab(`${base}/goals`);
  await grab(`${base}/clinical-record`);
  const revisions = await grab(`${base}/clinical-record/revisions`);
  for (const r of revisions.data) await grab(`${base}/clinical-record/revisions/${r.version}`);
  const consultations = await grab(`${base}/consultations`, { status: 'cerrada', limit: 100 });
  for (const c of consultations.data) await grab(`/consultations/${c.id}`);
  await grab(`${base}/attachments`);
}
for (const a of appointments.data) await grab(`/appointments/${a.id}`);
// Al final, para que incluya los accesos del propio recorrido.
await grab('/audit-logs', { limit: 100 });

const snapshot = {
  info: { generatedAt: new Date().toISOString(), repoUrl: REPO_URL, note: 'Datos ficticios generados por server/src/seeds/demo.js' },
  session: { data: { accessToken: 'demo-estatica', user: me.data } },
  responses,
};
await mkdir(OUT_DIR, { recursive: true });
await writeFile(`${OUT_DIR}/demo-api.json`, JSON.stringify(snapshot));
console.log(`Instantánea: ${Object.keys(responses).length} rutas → client/.pages/demo-api.json`);
stop();
process.exit(0);
