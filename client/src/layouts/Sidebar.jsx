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
    <nav aria-label="Principal" className="flex flex-col gap-5 overflow-y-auto px-4 pb-4 scrollbar-thin">
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
                        'group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive ? 'bg-white/15 text-ink shadow-[0_1px_0_rgb(255_255_255/0.08)_inset]' : 'text-ink-2 hover:bg-white/10 hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon aria-hidden className={cn('size-6 shrink-0', isActive ? 'text-ink' : 'text-ink-2')} />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {count > 0 &&
                          (collapsed ? (
                            <span aria-label={`${count} pendientes`} className="absolute right-2 top-2 size-2.5 rounded-full bg-brand-500 ring-2 ring-[#2b2766]" />
                          ) : (
                            <span className="grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white tabular">{count}</span>
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
                    cn('block truncate rounded-lg px-3 py-1.5 text-sm', isActive ? 'text-accent font-medium' : 'text-ink-2 hover:bg-white/10')
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
