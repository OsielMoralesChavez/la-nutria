import { logger } from '../config/logger.js';
import { AuditLog } from '../models/index.js';

/**
 * Registra una acción sensible. Nunca debe romper la operación principal:
 * si la bitácora falla, se registra en el log y se continúa.
 *
 * IMPORTANTE: `meta` no debe contener valores clínicos ni credenciales.
 * Usar nombres de campos (`changedFields`) en lugar de valores.
 */
export async function record({ req, actor, actorEmail, action, resource, resourceId, result = 'ok', meta }) {
  try {
    await AuditLog.create({
      actor: actor ?? req?.user?.id,
      actorEmail,
      action,
      resource,
      resourceId: resourceId?.toString(),
      result,
      ip: req?.ip,
      userAgent: req?.get?.('user-agent')?.slice(0, 300),
      meta,
    });
  } catch (err) {
    logger.error({ err: err.message, action, resource }, 'No se pudo registrar auditoría');
  }
}

export async function list({ actor, action, resource, result, from, to, page = 1, limit = 50 }) {
  const filter = {};
  if (actor) filter.actor = actor;
  if (action) filter.action = action;
  if (resource) filter.resource = resource;
  if (result) filter.result = result;
  if (from || to) filter.at = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'name email'),
    AuditLog.countDocuments(filter),
  ]);
  return { items: items.map((d) => d.toJSON()), total };
}
