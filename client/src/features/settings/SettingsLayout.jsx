import { Bell, Building2, FileClock, KeyRound, ListTree, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { PageHeader } from '../../components/ui/index.js';
import { cn } from '../../lib/cn.js';
import { useAuth } from '../auth/AuthProvider.jsx';

const SECTIONS = [
  { to: 'perfil', label: 'Perfil y preferencias', icon: UserRound },
  { to: 'seguridad', label: 'Contraseña y sesiones', icon: KeyRound },
  { to: 'consultorio', label: 'Consultorio y agenda', icon: Building2, permission: 'settings:manage' },
  { to: 'catalogos', label: 'Catálogos', icon: ListTree, permission: 'catalogs:manage' },
  { to: 'alertas', label: 'Reglas de alerta', icon: Bell, permission: 'alerts:manage' },
  { to: 'auditoria', label: 'Auditoría', icon: FileClock, permission: 'audit:read' },
];

/** Configuración: menú de secciones (filtrado por permiso) + contenido. */
export function SettingsLayout() {
  const { can } = useAuth();
  const sections = SECTIONS.filter((s) => !s.permission || can(s.permission));
  return (
    <div>
      <PageHeader title="Configuración" description="Parámetros que pueden variar entre nutriólogos y consultorios: nada clínico está fijo en el código." />
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <nav aria-label="Secciones de configuración" className="card h-fit p-2 max-lg:flex max-lg:gap-1 max-lg:overflow-x-auto max-lg:scrollbar-thin">
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm',
                  isActive ? 'bg-brand-700/10 font-semibold text-brand-800' : 'text-ink-2 hover:bg-slate-900/5',
                )
              }
            >
              <s.icon aria-hidden className="size-4" />
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
