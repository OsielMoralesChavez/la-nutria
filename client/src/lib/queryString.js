/**
 * Normaliza parámetros de consulta igual que los envía el cliente HTTP:
 * omite vacíos y convierte fechas a ISO. Devuelve strings.
 */
export function normalizeQuery(query = {}) {
  const out = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v instanceof Date ? v.toISOString() : String(v);
  }
  return out;
}
