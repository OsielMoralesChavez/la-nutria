import { Menu } from 'lucide-react';
import { NavLink } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider.jsx';
import { cn } from '../lib/cn.js';
import { NAV_GROUPS } from '../navigation/config.js';
import { useNavBadges } from './useNavBadges.js';

/** Barra inferior en tablet/móvil: accesos principales + "Más" (abre el drawer). */
export function BottomNav({ onMore }) {
  const { can } = useAuth();
  const badges = useNavBadges();
  const items = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.mobile && can(i.permission));

  return (
    <nav aria-label="Navegación inferior" className="glass fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex max-w-xl">
        {items.map((item) => {
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <li key={item.id} className="flex-1">
              <NavLink
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn('relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-800' : 'text-ink-3')
                }
              >
                <span className="relative">
                  <item.icon aria-hidden className="size-6" />
                  {count > 0 && (
                    <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-4 text-white tabular">{count}</span>
                  )}
                </span>
                {item.mobileLabel ?? item.label}
              </NavLink>
            </li>
          );
        })}
        <li className="flex-1">
          <button type="button" onClick={onMore} className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-3">
            <Menu aria-hidden className="size-6" />
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
}
