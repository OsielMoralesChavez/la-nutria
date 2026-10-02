/**
 * Elimina de body y params cualquier clave que empiece con `$` o contenga `.`
 * (operadores/rutas de MongoDB). Opera en sitio porque en Express 5 `req.query`
 * es un getter; la query además pasa siempre por zod antes de usarse.
 */
const isDangerousKey = (k) => k.startsWith('$') || k.includes('.');

function strip(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    value.forEach((v) => strip(v, depth + 1));
    return value;
  }
  for (const key of Object.keys(value)) {
    if (isDangerousKey(key)) delete value[key];
    else strip(value[key], depth + 1);
  }
  return value;
}

export function sanitize(req, _res, next) {
  if (req.body) strip(req.body);
  if (req.params) strip(req.params);
  next();
}
