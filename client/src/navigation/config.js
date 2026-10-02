import { CalendarDays, LayoutDashboard, Settings, UserCog, Users, Workflow } from 'lucide-react';

/**
 * Navegación declarativa. Agregar un módulo (p. ej. Planes, Recetas) = una
 * entrada aquí + su ruta en app/router.jsx. El sidebar, la barra inferior
 * móvil y la paleta de comandos se generan a partir de esta lista y se
 * filtran por permiso.
 *
 * `badge` es la clave de un contador provisto por useNavBadges().
 */
export const NAV_GROUPS = [
  {
    id: 'operacion',
    label: 'Operación',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard:read', end: true, mobile: true, mobileLabel: 'Inicio' },
      { id: 'agenda', label: 'Agenda', path: '/agenda', icon: CalendarDays, permission: 'appointments:read', badge: 'todayAppointments', mobile: true },
      { id: 'pacientes', label: 'Pacientes', path: '/pacientes', icon: Users, permission: 'patients:read', mobile: true },
      { id: 'seguimiento', label: 'Seguimiento', path: '/seguimiento', icon: Workflow, permission: 'followups:read', badge: 'pending', mobile: true },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    items: [
      { id: 'usuarios', label: 'Usuarios', path: '/usuarios', icon: UserCog, permission: 'users:read' },
      { id: 'configuracion', label: 'Configuración', path: '/configuracion', icon: Settings, permission: 'settings:read' },
    ],
  },
];

export const visibleGroups = (can) =>
  NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(i.permission)) })).filter((g) => g.items.length);
