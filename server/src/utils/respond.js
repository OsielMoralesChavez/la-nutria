import { pageMeta } from './query.js';

/** Respuestas uniformes: `{ data, meta? }`. */
export const ok = (res, data, meta, status = 200) => res.status(status).json(meta ? { data, meta } : { data });
export const created = (res, data) => ok(res, data, undefined, 201);
export const noContent = (res) => res.status(204).end();
export const paged = (res, { items, total, ...extra }, { page, limit }) =>
  ok(res, items, { ...pageMeta({ page, limit, total }), ...extra });
