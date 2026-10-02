import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Caché corta de usuario+permisos para no consultar la BD en cada petición.
 * 30 s es un balance: un cambio de permisos o una desactivación se aplica
 * casi de inmediato. Se invalida explícitamente al editar usuarios/roles.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map();

export const invalidateUserCache = (userId) => (userId ? cache.delete(userId.toString()) : cache.clear());

async function loadPrincipal(userId) {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.principal;

  const user = await User.findById(userId).populate('role').lean();
  if (!user || user.status !== 'activo' || !user.role) return null;

  const principal = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: { id: user.role._id.toString(), key: user.role.key, name: user.role.name, level: user.role.level },
    permissions: new Set(user.role.permissions),
    mustChangePassword: user.mustChangePassword,
  };
  cache.set(userId, { principal, expires: Date.now() + CACHE_TTL_MS });
  return principal;
}

/** Verifica el access token (Authorization: Bearer) y carga `req.user`. */
export async function authenticate(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw err.name === 'TokenExpiredError'
      ? new ApiError(401, 'TOKEN_EXPIRED', 'La sesión expiró')
      : ApiError.unauthorized('Token inválido');
  }

  const principal = await loadPrincipal(payload.sub);
  if (!principal) throw ApiError.unauthorized('Usuario inactivo o inexistente');

  req.user = principal;
  next();
}
