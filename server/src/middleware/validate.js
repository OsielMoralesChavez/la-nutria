import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Valida body/query/params con zod. Los schemas deben ser `.strict()` (o
 * construidos con `z.strictObject`) para rechazar campos no declarados y
 * evitar mass-assignment (p. ej. mandar `role` al editar el perfil).
 *
 * El resultado limpio queda en `req.valid.{body,query,params}`.
 * (En Express 5 `req.query` es de sólo lectura, por eso no se reemplaza.)
 */
export function validate({ body, query, params }) {
  return function validateMiddleware(req, _res, next) {
    req.valid = req.valid ?? {};
    const issues = [];

    for (const [part, schema] of Object.entries({ params, query, body })) {
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        req.valid[part] = result.data;
      } else {
        issues.push(
          ...result.error.issues.map((i) => ({
            location: part,
            field: i.path.join('.'),
            message: i.message,
          })),
        );
      }
    }

    if (issues.length) throw ApiError.validation(issues);
    next();
  };
}

/** Helpers comunes para schemas. */
export const zId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');
export const zIdParam = z.strictObject({ id: zId });
export const zDate = z.coerce.date({ error: 'Fecha inválida' });
export const zPaging = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
export const zText = (max) => z.string().trim().max(max);
export const zBoolString = z.enum(['true', 'false']).transform((v) => v === 'true');
