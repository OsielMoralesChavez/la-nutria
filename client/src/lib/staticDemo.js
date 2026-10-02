import { normalizeQuery } from './queryString.js';

/**
 * DEMO ESTÁTICA (GitHub Pages).
 *
 * GitHub Pages sólo sirve archivos: no puede ejecutar la API. Para poder
 * navegar el sistema en una liga pública se publica una INSTANTÁNEA de
 * respuestas reales de la API (generada con los datos ficticios del modo
 * demo; ver scripts/snapshot-demo.mjs) y este adaptador las sirve en el
 * navegador. Es de sólo lectura: cualquier escritura responde con un aviso.
 *
 * Sólo se activa al construir con VITE_STATIC_DEMO=true (npm run pages:build).
 */
export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true';

export const READ_ONLY_MESSAGE =
  'Esta es una demo de sólo lectura publicada en GitHub Pages. Para registrar datos ejecuta el proyecto localmente (npm run dev:demo).';

let snapshotPromise = null;
const loadSnapshot = () => {
  snapshotPromise ??= fetch(`${import.meta.env.BASE_URL}demo-api.json`).then((r) => {
    if (!r.ok) throw new Error('No se pudo cargar la demo');
    return r.json();
  });
  return snapshotPromise;
};

const norm = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const paginate = (items, q, defaultLimit = 20) => {
  const page = Number(q.page ?? 1);
  const limit = Number(q.limit ?? defaultLimit);
  return {
    data: items.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total: items.length, pages: Math.max(1, Math.ceil(items.length / limit)) },
  };
};

/**
 * Filtros que la API aplica en el servidor y que aquí se reproducen sobre la
 * instantánea completa (sólo los que usa la interfaz).
 */
const FILTERS = [
  {
    test: (p) => p === '/patients',
    run: (body, q, ctx) => {
      let items = body.data;
      if (q.q) {
        const t = norm(q.q);
        const digits = q.q.replace(/\D/g, '');
        items = items.filter((p) => norm(p.fullName).includes(t) || (digits.length >= 4 && p.contact?.phone?.replace(/\D/g, '').includes(digits)));
      }
      if (q.status) items = items.filter((p) => p.status === q.status);
      if (q.responsible) items = items.filter((p) => p.primaryNutritionist?.id === (q.responsible === 'me' ? ctx.userId : q.responsible));
      if (q.withAlerts === 'true') items = items.filter((p) => p.openAlerts > 0);
      if (q.sort === 'recent') items = [...items].sort((a, b) => new Date(b.lastConsultationAt ?? 0) - new Date(a.lastConsultationAt ?? 0));
      if (q.sort === 'next') items = [...items].sort((a, b) => new Date(a.nextAppointmentAt ?? 8e15) - new Date(b.nextAppointmentAt ?? 8e15));
      if (q.sort === 'created') items = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return paginate(items, q);
    },
  },
  {
    test: (p) => /^\/patients\/[^/]+\/timeline$/.test(p),
    run: (body, q) => {
      const types = q.types ? q.types.split(',') : null;
      const limit = Number(q.limit ?? 20);
      const items = body.data.filter((e) => (!types || types.includes(e.type)) && (!q.before || new Date(e.date) < new Date(q.before)));
      const page = items.slice(0, limit);
      return { data: page, meta: { nextCursor: items.length > limit ? page[page.length - 1].date : null } };
    },
  },
  {
    test: (p) => p === '/appointments',
    run: (body, q) => ({
      data: body.data.filter(
        (a) =>
          (!q.from || new Date(a.start) >= new Date(q.from)) &&
          (!q.to || new Date(a.start) < new Date(q.to)) &&
          (!q.patient || a.patient?.id === q.patient) &&
          (!q.nutritionist || a.nutritionist?.id === q.nutritionist),
      ),
    }),
  },
  {
    test: (p) => p === '/alerts',
    run: (body, q) => {
      const status = q.status ?? 'abierta';
      const items = body.data.filter(
        (a) =>
          (status === 'activas' ? ['abierta', 'pospuesta'].includes(a.status) : a.status === status) &&
          (!q.type || a.type === q.type) &&
          (!q.severity || a.severity === q.severity) &&
          (!q.patient || a.patient?.id === q.patient),
      );
      return { ...paginate(items, q), meta: { ...paginate(items, q).meta, countsByType: body.meta?.countsByType } };
    },
  },
  {
    test: (p) => p === '/followups',
    run: (body, q) => {
      const today = new Date(new Date().toDateString());
      const items = body.data.filter((f) => {
        const d = new Date(f.dueDate);
        if (q.due === 'overdue') return d < today;
        if (q.due === 'today') return d.toDateString() === today.toDateString();
        if (q.due === 'week') return d < new Date(today.getTime() + 7 * 864e5);
        return !q.patient || f.patient?.id === q.patient;
      });
      return paginate(items, q, 100);
    },
  },
  {
    test: (p) => p === '/catalogs',
    run: (body, q) => ({ data: body.data.filter((c) => (!q.type || c.type === q.type) && (q.includeInactive === 'true' || c.active)) }),
  },
  {
    test: (p) => p === '/users',
    run: (body, q) => {
      const t = q.q ? norm(q.q) : null;
      return paginate(t ? body.data.filter((u) => norm(`${u.name} ${u.email}`).includes(t)) : body.data, q, 100);
    },
  },
  {
    test: (p) => p === '/audit-logs',
    run: (body, q) => paginate(body.data.filter((l) => (!q.resource || l.resource === q.resource) && (!q.result || l.result === q.result)), q, 50),
  },
];

/** Errores con la misma forma que los de la API real. */
const fail = (status, code, message) => ({ status, body: { error: { code, message } } });

/**
 * Atiende una petición con la instantánea. Devuelve { status, body } con la
 * misma forma que la API real para que el resto del cliente no cambie.
 */
export async function staticRequest(method, path, query = {}) {
  const snap = await loadSnapshot();
  const q = normalizeQuery(query);

  if (method !== 'GET') {
    if (path === '/auth/login' || path === '/auth/refresh') return { status: 200, body: snap.session };
    if (path === '/auth/logout') return { status: 204, body: null };
    return fail(403, 'DEMO_READ_ONLY', READ_ONLY_MESSAGE);
  }

  const entry = snap.responses[path];
  if (!entry) {
    if (path === '/appointments/slots') return { status: 200, body: { data: [] } };
    return fail(404, 'NOT_FOUND', 'Esta sección no está incluida en la demo estática.');
  }
  const filter = FILTERS.find((f) => f.test(path));
  return { status: 200, body: filter ? filter.run(entry, q, { userId: snap.session.data.user.id }) : entry };
}

export const snapshotInfo = async () => (await loadSnapshot()).info;
