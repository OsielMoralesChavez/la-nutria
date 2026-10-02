import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useMatch } from 'react-router';
import { Drawer, LoadingState } from '../components/ui/index.js';
import { useAuth } from '../features/auth/AuthProvider.jsx';
import { cn } from '../lib/cn.js';
import { STATIC_DEMO } from '../lib/staticDemo.js';
import { DemoBanner } from './DemoBanner.jsx';
import { BottomNav } from './BottomNav.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { Logo } from './Logo.jsx';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { useRecentPatients } from './useRecentPatients.js';

const COLLAPSE_KEY = 'ln.sidebarCollapsed';
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Estructura principal: Topbar + Sidebar + área de contenido.
 * - ≥ lg: sidebar fijo (contraíble, preferencia recordada).
 * - < lg: sidebar en drawer + barra de navegación inferior.
 * - Modo consulta: sidebar contraído y sin barra inferior para enfocar la captura.
 */
export function AppLayout() {
  const { logout } = useAuth();
  const recent = useRecentPatients();
  const inConsultation = Boolean(useMatch('/pacientes/:id/consulta/:cid'));
  const [collapsedPref, setCollapsedPref] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [palette, setPalette] = useState({ open: false, mode: 'search' });
  const collapsed = collapsedPref || inConsultation;

  // Ctrl/⌘ K abre la búsqueda desde cualquier pantalla.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette({ open: true, mode: 'search' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSidebar = () => {
    const next = !collapsedPref;
    setCollapsedPref(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      /* preferencia no persistida: no pasa nada */
    }
  };

  const handleLogout = async () => {
    recent.clear(); // no dejar nombres de pacientes en un equipo compartido
    await logout();
  };

  return (
    <div className="min-h-dvh lg:p-5">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface-2 focus:px-3 focus:py-2 focus:shadow">
        Saltar al contenido
      </a>

      {/* Marco de vidrio (lg+): contiene menú, barra superior y contenido. En móvil el contenido va directo sobre el fondo. */}
      <div className="frame flex min-h-dvh max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none lg:min-h-[calc(100dvh-2.5rem)] lg:rounded-[2rem] lg:backdrop-blur-2xl">
        <aside
          className={cn(
            'pane sticky top-5 hidden h-[calc(100dvh-2.5rem)] shrink-0 self-start border-r transition-[width] duration-200 lg:block lg:rounded-l-[2rem]',
            collapsed ? 'w-[84px]' : 'w-[260px]',
          )}
        >
          <div className={cn('flex h-16 items-center px-6', collapsed && 'justify-center px-0')}>
            <Link to="/" aria-label="La Nutria, ir al inicio" className="rounded-lg">
              <Logo compact={collapsed} />
            </Link>
          </div>
          <Sidebar collapsed={collapsed} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            collapsed={collapsed}
            onToggleSidebar={toggleSidebar}
            onOpenDrawer={() => setDrawerOpen(true)}
            onOpenSearch={() => setPalette({ open: true, mode: 'search' })}
            onNewConsultation={() => setPalette({ open: true, mode: 'consultation' })}
            onLogout={handleLogout}
          />
          {STATIC_DEMO && <DemoBanner />}

          <main id="contenido" tabIndex={-1} className={cn('min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-7', !inConsultation && 'pb-24 lg:pb-7')}>
            <div className="mx-auto w-full max-w-[1400px]">
              <Suspense fallback={<LoadingState rows={5} />}>
                <Outlet context={{ openPalette: (mode) => setPalette({ open: true, mode }) }} />
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      {!inConsultation && <BottomNav onMore={() => setDrawerOpen(true)} />}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Menú" width="sm:w-[300px]">
        <div className="-mx-5 -my-4">
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
          <div className="border-t border-line/70 px-6 py-3">
            <button type="button" onClick={handleLogout} className="text-sm font-medium text-red-300">
              Cerrar sesión
            </button>
          </div>
        </div>
      </Drawer>

      <CommandPalette open={palette.open} mode={palette.mode} onClose={() => setPalette((p) => ({ ...p, open: false }))} />
    </div>
  );
}
