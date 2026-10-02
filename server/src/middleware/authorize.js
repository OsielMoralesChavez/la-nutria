import { isValidPermission } from '@lanutria/shared';
import { record } from '../services/auditService.js';
import { ApiError } from '../utils/ApiError.js';

export const hasPermission = (user, permission) => Boolean(user?.permissions?.has(permission));

/**
 * Exige TODOS los permisos indicados. Las reglas de propiedad ("sólo sus
 * pacientes") se validan después, en el service, porque requieren el recurso.
 *
 *   router.post('/', authorize('patients:create'), controller.create)
 */
export function authorize(...permissions) {
  for (const p of permissions) {
    if (!isValidPermission(p)) throw new Error(`Permiso desconocido en ruta: ${p}`);
  }

  return async function authorizeMiddleware(req, _res, next) {
    if (!req.user) throw ApiError.unauthorized();
    const missing = permissions.filter((p) => !hasPermission(req.user, p));
    if (missing.length) {
      await record({
        req,
        action: 'authz.denied',
        resource: permissions[0].split(':')[0],
        result: 'denegado',
        meta: { required: missing, method: req.method, path: req.baseUrl + req.route?.path },
      });
      throw ApiError.forbidden();
    }
    next();
  };
}
