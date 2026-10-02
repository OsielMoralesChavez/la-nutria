import { Suspense, useEffect, useState } from 'react';
import { Outlet, useMatch } from 'react-router';
import { Drawer, LoadingState } from '../components/ui/index.js';
import { useAuth } from '../features/auth/AuthProvider.jsx';
import { cn } from '../lib/cn.js';
import { STATIC_DEMO } from '../lib/staticDemo.js';
import { DemoBanner } from './DemoBanner.jsx';
import { BottomNav } from './BottomNav.jsx';
import { CommandPalette } from './CommandPalette.jsx';
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
    <div className="min-h-dvh">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        Saltar al contenido
      </a>
      <Topbar
        collapsed={collapsed}
        onToggleSidebar={toggleSidebar}
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenSearch={() => setPalette({ open: true, mode: 'search' })}
        onNewConsultation={() => setPalette({ open: true, mode: 'consultation' })}
        onLogout={handleLogout}
      />
      {STATIC_DEMO && <DemoBanner />}

      <div className="flex">
        <aside
          className={cn(
            'glass sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 border-r transition-[width] duration-200 lg:block',
            collapsed ? 'w-[72px]' : 'w-[248px]',
          )}
        >
          <Sidebar collapsed={collapsed} />
        </aside>

        <main id="contenido" tabIndex={-1} className={cn('min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-7', !inConsultation && 'pb-24 lg:pb-7')}>
          <div className="mx-auto w-full max-w-[1400px]">
            <Suspense fallback={<LoadingState rows={5} />}>
              <Outlet context={{ openPalette: (mode) => setPalette({ open: true, mode }) }} />
            </Suspense>
          </div>
        </main>
      </div>

      {!inConsultation && <BottomNav onMore={() => setDrawerOpen(true)} />}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Menú" width="sm:w-[300px]">
        <div className="-mx-5 -my-4">
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
          <div className="border-t border-line/70 px-6 py-3">
            <button type="button" onClick={handleLogout} className="text-sm font-medium text-red-700">
              Cerrar sesión
            </button>
          </div>
        </div>
      </Drawer>

      <CommandPalette open={palette.open} mode={palette.mode} onClose={() => setPalette((p) => ({ ...p, open: false }))} />
    </div>
  );
}
