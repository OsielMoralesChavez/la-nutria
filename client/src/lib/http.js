/**
 * Cliente HTTP único de la app.
 *
 * - El access token vive SÓLO en memoria (no localStorage) para mitigar XSS.
 * - El refresh token viaja en cookie httpOnly; el navegador la envía sola.
 * - Ante un 401 se intenta renovar UNA vez (en vuelo compartido) y se reintenta.
 * - Los errores se normalizan a ApiError { status, code, message, details, requestId }.
 */
import { STATIC_DEMO, staticRequest } from './staticDemo.js';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

let accessToken = null;
let refreshInFlight = null;
let onSessionExpired = () => {};

export const setAccessToken = (t) => {
  accessToken = t;
};
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** Errores de validación por campo: { 'contact.phone': 'mensaje' } */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

function buildUrl(path, query) {
  const url = new URL(BASE_URL + path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, v instanceof Date ? v.toISOString() : String(v));
    }
  }
  return url.toString();
}

async function parse(res) {
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  const body = type.includes('application/json') ? await res.json().catch(() => null) : null;
  if (res.ok) return body;
  const e = body?.error ?? {};
  throw new ApiError({
    status: res.status,
    code: e.code ?? (res.status === 0 ? 'NETWORK' : 'HTTP_ERROR'),
    message: e.message ?? 'No se pudo completar la solicitud',
    details: e.details,
    requestId: e.requestId,
  });
}

async function send(method, path, { body, query, signal } = {}) {
  if (STATIC_DEMO) {
    // Demo estática (GitHub Pages): responde con la instantánea, sin servidor.
    const r = await staticRequest(method, path, query);
    return new Response(r.body === null ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }
  const headers = {};
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError({ status: 0, code: 'NETWORK', message: 'Sin conexión con el servidor. Revisa tu red e intenta de nuevo.' });
  }
  return res;
}

/** Renueva la sesión con la cookie. Varias llamadas simultáneas comparten la misma petición. */
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await send('POST', '/auth/refresh');
      const body = await parse(res);
      if (!body) throw new ApiError({ status: 401, code: 'NO_SESSION', message: 'Sin sesión' });
      setAccessToken(body.data.accessToken);
      return body.data.user;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function request(method, path, options = {}) {
  let res = await send(method, path, options);

  if (res.status === 401 && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
    } catch {
      setAccessToken(null);
      onSessionExpired();
      return parse(res);
    }
    res = await send(method, path, options);
  }
  return parse(res);
}

export const http = {
  get: (path, query, opts) => request('GET', path, { query, ...opts }),
  post: (path, body, opts) => request('POST', path, { body, ...opts }),
  put: (path, body, opts) => request('PUT', path, { body, ...opts }),
  patch: (path, body, opts) => request('PATCH', path, { body, ...opts }),
  del: (path, body, opts) => request('DELETE', path, { body, ...opts }),
};

/** Atajo: devuelve sólo `data` (la mayoría de llamadas). */
export const api = {
  get: async (path, query, opts) => (await http.get(path, query, opts)).data,
  post: async (path, body) => (await http.post(path, body))?.data,
  put: async (path, body) => (await http.put(path, body))?.data,
  patch: async (path, body) => (await http.patch(path, body))?.data,
  del: async (path, body) => (await http.del(path, body))?.data,
};
