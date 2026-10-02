import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import { Link } from 'react-router';
import { Button, EmptyState, ErrorState, LoadingState, MenuItem, Popover, StatusBadge, useToast } from '../../components/ui/index.js';
import { addDays, fmtRelative, fullName } from '../../lib/format.js';
import { http, api } from '../../lib/http.js';
import { qk } from '../../lib/queryKeys.js';
import { useAuth } from '../auth/AuthProvider.jsx';

/**
 * Lista de alertas con acciones de 1–2 clics. Cada alerta explica la regla
 * que la generó (enlace a la configuración para quien puede ajustarla).
 */
export function AlertList({ params, emptyTitle = 'Todo al día', emptyDescription = 'No hay alertas con estos filtros.' }) {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.alerts(params),
    queryFn: async () => {
      const res = await http.get('/alerts', { limit: 50, ...params });
      return { items: res.data, meta: res.meta };
    },
  });
  const act = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/alerts/${id}`, body),
    onSuccess: (_d, v) => {
      const msg = { atender: 'Alerta atendida', descartar: 'Alerta descartada', posponer: 'Alerta pospuesta', reabrir: 'Alerta reabierta' }[v.action];
      toast.success(msg);
      ['alerts', 'dashboard', 'patient'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error(e.message),
  });

  if (query.isPending) return <LoadingState rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data.items.length) return <EmptyState compact icon={CheckCircle2} title={emptyTitle} description={emptyDescription} />;

  return (
    <ul className="divide-y divide-line/70">
      {query.data.items.map((a) => {
        const open = ['abierta', 'pospuesta'].includes(a.status);
        return (
          <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <StatusBadge kind="severity" status={a.severity} size="sm" className="mt-0.5" />
              <div className="min-w-0">
                <Link to={`/pacientes/${a.patient?.id}`} className="text-sm font-semibold text-ink hover:text-accent">
                  {fullName(a.patient)}
                </Link>
                <p className="text-sm text-ink-2">{a.message}</p>
                <p className="text-xs text-ink-3">
                  {a.status === 'pospuesta' ? `Pospuesta hasta ${fmtRelative(a.snoozedUntil)}` : `Generada ${fmtRelative(a.createdAt)}`}
                  {a.assignedTo?.name && ` · ${a.assignedTo.name}`}
                  {can('alerts:manage') && (
                    <>
                      {' · '}
                      <Link to="/configuracion/alertas" className="hover:underline">
                        regla
                      </Link>
                    </>
                  )}
                  {!open && a.resolution && ` · ${a.resolution === 'auto' ? 'resuelta automáticamente' : a.resolution}`}
                </p>
              </div>
            </div>
            {can('alerts:update') && (
              <div className="flex shrink-0 gap-1 pl-12 sm:pl-0">
                {open ? (
                  <>
                    <Button size="sm" variant="subtle" icon={CheckCircle2} onClick={() => act.mutate({ id: a.id, action: 'atender' })}>
                      Atender
                    </Button>
                    <Popover width="w-48" trigger={(p) => <Button {...p} size="sm" variant="ghost" icon={Clock}>Posponer</Button>}>
                      {({ close }) =>
                        [
                          ['1 día', 1],
                          ['3 días', 3],
                          ['1 semana', 7],
                          ['2 semanas', 14],
                        ].map(([label, days]) => (
                          <MenuItem key={days} close={close} onClick={() => act.mutate({ id: a.id, action: 'posponer', until: addDays(new Date(), days) })}>
                            {label}
                          </MenuItem>
                        ))
                      }
                    </Popover>
                    <Button size="sm" variant="ghost" icon={XCircle} onClick={() => act.mutate({ id: a.id, action: 'descartar' })}>
                      Descartar
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => act.mutate({ id: a.id, action: 'reabrir' })}>
                    Reabrir
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
      {query.data.meta.total > query.data.items.length && (
        <li className="py-2 text-center text-xs text-ink-3">
          <BellRing aria-hidden className="mr-1 inline size-3.5" />
          Mostrando {query.data.items.length} de {query.data.meta.total}. Usa los filtros para acotar.
        </li>
      )}
    </ul>
  );
}
