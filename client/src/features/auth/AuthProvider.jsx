import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from '../../lib/http.js';

const AuthContext = createContext(null);

/**
 * Sesión del usuario. Al cargar la app intenta renovar con la cookie
 * httpOnly; si no hay sesión, muestra el login.
 *
 * Los permisos aquí SÓLO deciden qué mostrar: el backend vuelve a validar
 * cada petición.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: 'loading', user: null, expired: false });

  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((user) => !cancelled && setState({ status: 'authenticated', user, expired: false }))
      .catch(() => !cancelled && setState({ status: 'anonymous', user: null, expired: false }));
    setSessionExpiredHandler(() => {
      queryClient.clear();
      setState({ status: 'anonymous', user: null, expired: true });
    });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const login = useCallback(async (credentials) => {
    const data = await api.post('/auth/login', credentials);
    setAccessToken(data.accessToken);
    setState({ status: 'authenticated', user: data.user, expired: false });
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      queryClient.clear();
      setState({ status: 'anonymous', user: null, expired: false });
    }
  }, [queryClient]);

  /** Recarga el perfil (tras cambiar contraseña o preferencias). */
  const reloadUser = useCallback(async () => {
    const user = await api.get('/auth/me');
    setState((s) => ({ ...s, user }));
    return user;
  }, []);

  const value = useMemo(() => {
    const perms = new Set(state.user?.permissions ?? []);
    return {
      ...state,
      login,
      logout,
      reloadUser,
      can: (permission) => perms.has(permission),
      canAny: (...list) => list.some((p) => perms.has(p)),
    };
  }, [state, login, logout, reloadUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const usePermission = (permission) => useAuth().can(permission);

/** Renderiza a sus hijos sólo con el permiso. Es UX: el backend también valida. */
export function Can({ permission, any, children, fallback = null }) {
  const { can, canAny } = useAuth();
  const allowed = permission ? can(permission) : canAny(...(any ?? []));
  return allowed ? children : fallback;
}
