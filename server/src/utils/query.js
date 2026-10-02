import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

export const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v) && /^[a-f\d]{24}$/i.test(v);

/** Lanza 404 (no 400) para no revelar si un id con formato raro existe. */
export function assertFound(doc, resource) {
  if (!doc) throw ApiError.notFound(resource);
  return doc;
}

/** Escapa texto del usuario para usarlo dentro de un RegExp de búsqueda. */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Normaliza para búsqueda sin acentos ni mayúsculas. */
export const normalizeText = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Respuesta paginada por offset (listados) */
export const pageMeta = ({ page, limit, total }) => ({ page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};
