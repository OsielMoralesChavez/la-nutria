import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarPlus, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Stethoscope, User, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Avatar, Badge, IconButton, MenuItem, Popover, StatusBadge } from '../components/ui/index.js';
import { useAuth } from '../features/auth/AuthProvider.jsx';
import { api } from '../lib/http.js';
import { qk } from '../lib/queryKeys.js';
import { fullName, fmtRelative } from '../lib/format.js';
import { Logo } from './Logo.jsx';
import { useNavBadges } from './useNavBadges.js';

export function Topbar({ collapsed, onToggleSidebar, onOpenDrawer, onOpenSearch, onNewConsultation, onLogout }) {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const badges = useNavBadges();

  return (
    <header className="glass sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 sm:px-4">
      <IconButton icon={Menu} label="Abrir menú" onClick={onOpenDrawer} className="lg:hidden" />
      <IconButton
        icon={collapsed ? PanelLeftOpen : PanelLeftClose}
        label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        onClick={onToggleSidebar}
        className="hidden lg:inline-flex"
      />
      <Link to="/" className="mr-2 rounded-lg" aria-label="La Nutria, ir al inicio">
        <Logo compact={false} className="max-sm:[&>span:last-child]:hidden" />
      </Link>

      {/* Búsqueda: abre la paleta de comandos */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="ml-auto flex h-10 items-center gap-2 rounded-xl border border-line bg-white/70 px-3 text-sm text-ink-3 transition-colors hover:border-slate-300 hover:text-ink-2 sm:ml-4 sm:w-72 lg:w-96"
        aria-label="Buscar paciente o acción"
      >
        <Search aria-hidden className="size-4" />
        <span className="hidden flex-1 text-left sm:inline">Buscar paciente o acción…</span>
        <kbd className="hidden rounded border border-line bg-white px-1.5 text-[11px] text-ink-3 sm:inline">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:ml-2">
        {/* Acceso rápido */}
        {(can('patients:create') || can('appointments:create') || can('consultations:create')) && (
          <Popover
            width="w-60"
            trigger={(p) => (
              <button
                type="button"
                {...p}
                className="hidden h-10 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-sm font-medium text-white shadow-sm hover:bg-brand-800 sm:inline-flex"
              >
                <Plus aria-hidden className="size-4" /> Nuevo
              </button>
            )}
          >
            {({ close }) => (
              <>
                {can('consultations:create') && (
                  <MenuItem icon={Stethoscope} close={close} onClick={onNewConsultation}>
                    Nueva consulta
                  </MenuItem>
                )}
                {can('patients:create') && (
                  <MenuItem icon={UserPlus} close={close} to="/pacientes?nuevo=1">
                    Nuevo paciente
                  </MenuItem>
                )}
                {can('appointments:create') && (
                  <MenuItem icon={CalendarPlus} close={close} to="/agenda?nueva=1">
                    Nueva cita
                  </MenuItem>
                )}
              </>
            )}
          </Popover>
        )}

        {can('alerts:read') && <NotificationsPopover count={badges.alerts} />}

        {can('settings:read') && <IconButton icon={Settings} label="Configuración" onClick={() => navigate('/configuracion')} className="hidden md:inline-flex" />}

        <Popover
          width="w-64"
          trigger={(p) => (
            <button type="button" {...p} aria-label="Menú de perfil" className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-900/5">
              <Avatar name={user?.name} size="sm" />
              <span className="hidden max-w-32 truncate text-sm font-medium text-ink-2 xl:inline">{user?.name}</span>
            </button>
          )}
        >
          {({ close }) => (
            <>
              <div className="border-b border-line/70 px-2.5 pb-2.5 pt-1.5">
                <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                <p className="truncate text-xs text-ink-3">{user?.email}</p>
                <Badge tone="brand" className="mt-1.5">
                  {user?.role?.name}
                </Badge>
              </div>
              <div className="pt-1.5">
                <MenuItem icon={User} close={close} to="/configuracion/perfil">
                  Mi perfil y preferencias
                </MenuItem>
                <MenuItem icon={KeyRound} close={close} to="/configuracion/seguridad">
                  Contraseña y sesiones
                </MenuItem>
                <MenuItem icon={LogOut} close={close} onClick={onLogout} danger>
                  Cerrar sesión
                </MenuItem>
              </div>
            </>
          )}
        </Popover>
      </div>
    </header>
  );
}

function NotificationsPopover({ count }) {
  return (
    <Popover
      width="w-96"
      trigger={(p) => (
        <IconButton {...p} icon={Bell} label={count ? `Alertas: ${count} sin atender` : 'Alertas'} badge={count} />
      )}
    >
      {({ close }) => <NotificationsList close={close} />}
    </Popover>
  );
}

function NotificationsList({ close }) {
  const params = { status: 'abierta', limit: 5 };
  const { data, isPending } = useQuery({ queryKey: qk.alerts(params), queryFn: () => api.get('/alerts', params) });
  return (
    <div>
      <p className="px-2.5 pb-2 pt-1 text-sm font-semibold text-ink">Alertas sin atender</p>
      {isPending && <p className="px-2.5 py-3 text-sm text-ink-3">Cargando…</p>}
      {data?.length === 0 && <p className="px-2.5 py-3 text-sm text-ink-3">Todo al día. No hay alertas abiertas.</p>}
      <ul className="max-h-80 space-y-0.5 overflow-y-auto scrollbar-thin">
        {data?.map((a) => (
          <li key={a.id}>
            <Link to={`/pacientes/${a.patient?.id}`} onClick={close} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-900/5">
              <StatusBadge kind="severity" status={a.severity} size="sm" className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{fullName(a.patient)}</span>
                <span className="block text-xs text-ink-3">{a.message}</span>
                <span className="block text-[11px] text-ink-3">{fmtRelative(a.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/seguimiento/alertas" onClick={close} className="mt-1 block rounded-lg px-2.5 py-2 text-center text-sm font-medium text-brand-700 hover:bg-brand-50">
        Ver todas las alertas
      </Link>
    </div>
  );
}
