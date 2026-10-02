import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../../components/ui/index.js';
import { ForbiddenPage } from '../errors/ErrorPages.jsx';
import { useAuth } from './AuthProvider.jsx';

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3 text-accent">
        <Spinner className="size-8" label="Cargando La Nutria" />
        <p className="text-sm text-ink-3">Cargando…</p>
      </div>
    </div>
  );
}

/** Rutas privadas: sin sesión → login (recordando a dónde iba). */
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.mustChangePassword && location.pathname !== '/cambiar-contrasena') {
    return <Navigate to="/cambiar-contrasena" replace />;
  }
  return <Outlet />;
}

/** Ruta que exige un permiso. Sin él → 403 (la API también lo rechazaría). */
export function RequirePermission({ permission, children }) {
  const { can } = useAuth();
  if (!can(permission)) return <ForbiddenPage />;
  return children ?? <Outlet />;
}
