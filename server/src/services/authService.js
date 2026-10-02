import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { invalidateUserCache } from '../middleware/authenticate.js';
import { RefreshSession, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { record } from './auditService.js';

export const BCRYPT_ROUNDS = env.isTest ? 4 : 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Hash ficticio: se compara aunque el usuario no exista para que el tiempo de
// respuesta no revele qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export const REFRESH_COOKIE = 'ln_rt';
export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
});

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const newRefreshToken = () => randomBytes(48).toString('base64url');

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id ?? user._id.toString() }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    algorithm: 'HS256',
  });
}

/** Perfil público del usuario autenticado (sin datos sensibles). */
export function toSessionUser(user, role) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: { id: role._id.toString(), key: role.key, name: role.name, level: role.level },
    permissions: [...role.permissions].sort(),
    preferences: user.preferences,
    mustChangePassword: user.mustChangePassword,
  };
}

async function createSession(user, req) {
  const refreshToken = newRefreshToken();
  await RefreshSession.create({
    user: user._id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 864e5),
    userAgent: req.get('user-agent')?.slice(0, 300),
    ip: req.ip,
    lastUsedAt: new Date(),
  });
  return refreshToken;
}

export async function login({ email, password }, req) {
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+passwordHash +failedLogins +lockedUntil')
    .populate('role');

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    await record({ req, actorEmail: email, action: 'auth.login', resource: 'auth', result: 'denegado', meta: { reason: 'unknown_user' } });
    throw ApiError.unauthorized('Correo o contraseña incorrectos');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await record({ req, actor: user._id, action: 'auth.login', resource: 'auth', result: 'denegado', meta: { reason: 'locked' } });
    throw ApiError.locked('Demasiados intentos fallidos. Intenta de nuevo en unos minutos.');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok || user.status !== 'activo') {
    if (!ok) {
      user.failedLogins = (user.failedLogins ?? 0) + 1;
      if (user.failedLogins >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
        user.failedLogins = 0;
      }
      await user.save();
    }
    await record({
      req,
      actor: user._id,
      action: 'auth.login',
      resource: 'auth',
      result: 'denegado',
      meta: { reason: ok ? 'inactive' : 'bad_password' },
    });
    throw ApiError.unauthorized('Correo o contraseña incorrectos');
  }

  user.failedLogins = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const refreshToken = await createSession(user, req);
  await record({ req, actor: user._id, action: 'auth.login', resource: 'auth' });

  return { accessToken: signAccessToken(user), refreshToken, user: toSessionUser(user, user.role) };
}

/**
 * Rota el refresh token. Si llega un token ya rotado (reutilización), se
 * revoca la sesión completa: alguien más pudo haberlo copiado.
 */
export async function refresh(refreshToken, req) {
  if (!refreshToken) throw ApiError.unauthorized('Sesión no encontrada');
  const hash = sha256(refreshToken);

  const session = await RefreshSession.findOne({ tokenHash: hash });
  if (!session) {
    const reused = await RefreshSession.findOne({ previousHashes: hash, revokedAt: null });
    if (reused) {
      reused.revokedAt = new Date();
      reused.revokedReason = 'reuse_detected';
      await reused.save();
      await record({ req, actor: reused.user, action: 'auth.refresh_reuse', resource: 'auth', result: 'denegado' });
    }
    throw ApiError.unauthorized('Sesión inválida');
  }
  if (session.revokedAt || session.expiresAt < new Date()) throw ApiError.unauthorized('La sesión expiró');

  const user = await User.findById(session.user).populate('role');
  if (!user || user.status !== 'activo') {
    session.revokedAt = new Date();
    session.revokedReason = 'user_inactive';
    await session.save();
    throw ApiError.unauthorized('Usuario inactivo');
  }

  const next = newRefreshToken();
  await RefreshSession.updateOne(
    { _id: session._id },
    {
      $set: { tokenHash: sha256(next), lastUsedAt: new Date() },
      // Se conservan sólo los últimos hashes para detectar reutilización.
      $push: { previousHashes: { $each: [hash], $slice: -20 } },
    },
  );

  return { accessToken: signAccessToken(user), refreshToken: next, user: toSessionUser(user, user.role) };
}

export async function logout(refreshToken, req) {
  if (!refreshToken) return;
  const session = await RefreshSession.findOneAndUpdate(
    { tokenHash: sha256(refreshToken), revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'logout' },
  );
  if (session) await record({ req, actor: session.user, action: 'auth.logout', resource: 'auth' });
}

export async function me(userId) {
  const user = await User.findById(userId).populate('role');
  if (!user) throw ApiError.unauthorized();
  return toSessionUser(user, user.role);
}

export async function changePassword(userId, { currentPassword, newPassword }, currentRefreshToken, req) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized();
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    await record({ req, action: 'auth.password_change', resource: 'users', resourceId: userId, result: 'denegado' });
    throw ApiError.validation([{ location: 'body', field: 'currentPassword', message: 'La contraseña actual no es correcta' }]);
  }
  if (currentPassword === newPassword) {
    throw ApiError.validation([{ location: 'body', field: 'newPassword', message: 'Debe ser distinta de la actual' }]);
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  // Cierra todas las demás sesiones abiertas del usuario.
  const keep = currentRefreshToken ? sha256(currentRefreshToken) : null;
  await RefreshSession.updateMany(
    { user: user._id, revokedAt: null, ...(keep && { tokenHash: { $ne: keep } }) },
    { revokedAt: new Date(), revokedReason: 'password_change' },
  );
  invalidateUserCache(userId);
  await record({ req, action: 'auth.password_change', resource: 'users', resourceId: userId });
}

export async function listSessions(userId, currentRefreshToken) {
  const current = currentRefreshToken ? sha256(currentRefreshToken) : null;
  const sessions = await RefreshSession.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select('+tokenHash')
    .sort({ lastUsedAt: -1 });
  return sessions.map((s) => ({
    id: s._id.toString(),
    userAgent: s.userAgent,
    ip: s.ip,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    current: s.tokenHash === current,
  }));
}

export async function revokeSession(userId, sessionId, req) {
  const res = await RefreshSession.updateOne(
    { _id: sessionId, user: userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'user_revoked' },
  );
  if (!res.matchedCount) throw ApiError.notFound('Sesión');
  await record({ req, action: 'auth.session_revoke', resource: 'auth', resourceId: sessionId });
}
