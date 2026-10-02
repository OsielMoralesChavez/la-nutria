import { History } from 'lucide-react';
import { NavLink } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider.jsx';
import { cn } from '../lib/cn.js';
import { visibleGroups } from '../navigation/config.js';
import { useNavBadges } from './useNavBadges.js';
import { useRecentPatients } from './useRecentPatients.js';

/**
 * Navegación principal. `collapsed` = sólo íconos (con tooltip). En pantallas
 * < lg se usa dentro de un drawer (ver AppLayout).
 */
export function Sidebar({ collapsed, onNavigate }) {
  const { can } = useAuth();
  const badges = useNavBadges();
  const recent = useRecentPatients();
  const groups = visibleGroups(can);

  return (
    <nav aria-label="Principal" className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4 scrollbar-thin">
      {groups.map((group) => (
        <div key={group.id}>
          {!collapsed && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{group.label}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive ? 'bg-brand-700/10 text-brand-800' : 'text-ink-2 hover:bg-slate-900/5 hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-700" />}
                        <item.icon aria-hidden className={cn('size-5 shrink-0', isActive ? 'text-brand-700' : 'text-ink-3 group-hover:text-ink-2')} />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {count > 0 &&
                          (collapsed ? (
                            <span aria-label={`${count} pendientes`} className="absolute right-2 top-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-white" />
                          ) : (
                            <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-ink-2 tabular">{count}</span>
                          ))}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {!collapsed && recent.items.length > 0 && can('patients:read') && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            <History aria-hidden className="size-3.5" /> Recientes
          </p>
          <ul className="space-y-0.5">
            {recent.items.map((p) => (
              <li key={p.id}>
                <NavLink
                  to={`/pacientes/${p.id}`}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn('block truncate rounded-lg px-3 py-1.5 text-sm', isActive ? 'text-brand-800 font-medium' : 'text-ink-2 hover:bg-slate-900/5')
                  }
                >
                  {p.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
