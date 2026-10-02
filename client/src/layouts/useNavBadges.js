import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../features/auth/AuthProvider.jsx';
import { api } from '../lib/http.js';
import { qk } from '../lib/queryKeys.js';

/**
 * Contadores del menú (citas de hoy, pendientes) y de la campana.
 * Reutiliza la caché del dashboard y se refresca cada 5 minutos.
 */
export function useNavBadges() {
  const { can, user } = useAuth();
  const scope = user?.preferences?.dashboardScope ?? 'mine';
  const { data } = useQuery({
    queryKey: qk.dashboard(scope),
    queryFn: () => api.get('/dashboard', { scope }),
    enabled: can('dashboard:read'),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
  const k = data?.kpis;
  return {
    todayAppointments: k?.today.appointments ?? 0,
    pending: (k?.followUps.overdue ?? 0) + (k?.alerts ?? 0),
    alerts: k?.alerts ?? 0,
  };
}
