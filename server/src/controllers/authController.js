import * as authService from '../services/authService.js';
import { REFRESH_COOKIE, refreshCookieOptions } from '../services/authService.js';
import * as userService from '../services/userService.js';
import { noContent, ok } from '../utils/respond.js';

const setRefreshCookie = (res, token) => res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
const clearRefreshCookie = (res) => {
  const { maxAge: _maxAge, ...opts } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, opts);
};

export async function login(req, res) {
  const { accessToken, refreshToken, user } = await authService.login(req.valid.body, req);
  setRefreshCookie(res, refreshToken);
  ok(res, { accessToken, user });
}

export async function refresh(req, res) {
  // Sin cookie simplemente no hay sesión (p. ej. al abrir la app): no es un error.
  if (!req.cookies?.[REFRESH_COOKIE]) return noContent(res);
  try {
    const { accessToken, refreshToken, user } = await authService.refresh(req.cookies?.[REFRESH_COOKIE], req);
    if (refreshToken) setRefreshCookie(res, refreshToken);
    ok(res, { accessToken, user });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE], req);
  clearRefreshCookie(res);
  noContent(res);
}

export async function me(req, res) {
  ok(res, await authService.me(req.user.id));
}

export async function changePassword(req, res) {
  await authService.changePassword(req.user.id, req.valid.body, req.cookies?.[REFRESH_COOKIE], req);
  noContent(res);
}

export async function updatePreferences(req, res) {
  ok(res, await userService.updatePreferences(req.user.id, req.valid.body));
}

export async function sessions(req, res) {
  ok(res, await authService.listSessions(req.user.id, req.cookies?.[REFRESH_COOKIE]));
}

export async function revokeSession(req, res) {
  await authService.revokeSession(req.user.id, req.valid.params.sessionId, req);
  noContent(res);
}
