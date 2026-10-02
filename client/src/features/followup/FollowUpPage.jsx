import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, CalendarPlus, Check, ClipboardList, Settings2, Target, UserX } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, SegmentedControl, Tabs, useToast } from '../../components/ui/index.js';
import { cn } from '../../lib/cn.js';
import { fmtDate, fmtRelative, fullName } from '../../lib/format.js';
import { api, http } from '../../lib/http.js';
import { qk } from '../../lib/queryKeys.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { AlertList } from './AlertList.jsx';

/**
 * SEGUIMIENTO: bandeja de trabajo transversal (todos los pacientes).
 *   Pendientes · Sin seguimiento · Objetivos · Alertas
 */
export function FollowUpPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'pendientes';
  const setTab = (t) => setParams(t === 'pendientes' ? {} : { tab: t }, { replace: true });
  const dash = useQuery({ queryKey: ['followup-counts'], queryFn: () => api.get('/dashboard', { scope: 'all' }), staleTime: 60_000 });
  const k = dash.data?.kpis;

  return (
    <div>
      <PageHeader title="Seguimiento" description="Lo que hay que atender para que ningún paciente se quede sin seguimiento." />
      <Tabs
        label="Secciones de seguimiento"
        value={tab}
        onChange={setTab}
        className="mb-4"
        items={[
          { value: 'pendientes', label: 'Pendientes', icon: ClipboardList, badge: k?.followUps.pending },
          { value: 'sin-seguimiento', label: 'Sin seguimiento', icon: UserX, badge: k?.noRecentFollowUp.count ?? undefined },
          { value: 'objetivos', label: 'Objetivos', icon: Target },
          { value: 'alertas', label: 'Alertas', icon: Bell, badge: k?.alerts },
        ]}
      />
      {tab === 'pendientes' && <PendingFollowUps />}
      {tab === 'sin-seguimiento' && <NoRecent />}
      {tab === 'objetivos' && (
        <Card title="Objetivos por vencer o vencidos" description="Según las reglas de alerta de objetivos.">
          <div className="space-y-6">
            <AlertList params={{ status: 'activas', type: 'goal_overdue' }} emptyTitle="Ningún objetivo vencido" emptyDescription="" />
            <AlertList params={{ status: 'activas', type: 'goal_due' }} emptyTitle="Ningún objetivo por vencer" emptyDescription="" />
          </div>
        </Card>
      )}
      {tab === 'alertas' && (
        <Card
          title="Alertas activas"
          actions={
            <Button size="sm" variant="ghost" to="/seguimiento/alertas">
              Centro de alertas
            </Button>
          }
        >
          <AlertList params={{ status: 'activas' }} />
        </Card>
      )}
    </div>
  );
}

function PendingFollowUps() {
  const [params, setParams] = useSearchParams();
  const due = params.get('due') ?? '';
  const mine = params.get('mine') === '1';
  const toast = useToast();
  const qc = useQueryClient();
  const q = { status: 'pendiente', due: due || undefined, assignedTo: mine ? 'me' : undefined, limit: 100 };
  const query = useQuery({
    queryKey: qk.followUps(q),
    queryFn: async () => (await http.get('/followups', q)).data,
  });
  const done = useMutation({
    mutationFn: (id) => api.patch(`/followups/${id}`, { status: 'realizado' }),
    onSuccess: () => {
      toast.success('Seguimiento realizado');
      ['followups', 'dashboard', 'patient', 'alerts'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
    },
    onError: (e) => toast.error(e.message),
  });
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="sm"
          label="Vencimiento"
          value={due}
          onChange={(v) => set('due', v)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'overdue', label: 'Vencidos' },
            { value: 'today', label: 'Hoy' },
            { value: 'week', label: 'Esta semana' },
          ]}
        />
        <SegmentedControl
          size="sm"
          label="Asignación"
          value={mine ? '1' : ''}
          onChange={(v) => set('mine', v)}
          options={[
            { value: '', label: 'Todos' },
            { value: '1', label: 'Asignados a mí' },
          ]}
        />
      </div>
      {query.isPending && <LoadingState rows={4} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data?.length === 0 && <EmptyState compact icon={Check} title="Sin pendientes" description="No hay seguimientos con estos filtros." />}
      <ul className="divide-y divide-line/70">
        {query.data?.map((f) => {
          const overdue = new Date(f.dueDate) < new Date(new Date().toDateString());
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <button
                type="button"
                aria-label={`Marcar realizado: ${f.reason}`}
                onClick={() => done.mutate(f.id)}
                className="grid size-6 shrink-0 place-items-center rounded-md border border-white/20 bg-surface-2 text-transparent hover:border-brand-600 hover:text-accent"
              >
                <Check aria-hidden className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{f.reason}</p>
                <p className="text-xs text-ink-3">
                  <Link to={`/pacientes/${f.patient?.id}`} className="font-medium text-accent hover:underline">
                    {fullName(f.patient)}
                  </Link>
                  {f.assignedTo?.name && ` · ${f.assignedTo.name}`}
                </p>
              </div>
              <span className={cn('text-xs', overdue ? 'font-semibold text-red-300' : 'text-ink-3')}>
                {overdue && <AlertTriangle aria-hidden className="mr-1 inline size-3.5" />}
                {fmtDate(f.dueDate)} · {fmtRelative(f.dueDate)}
              </span>
              <Button size="sm" variant="ghost" icon={CalendarPlus} to={`/agenda?nueva=1&paciente=${f.patient?.id}`}>
                Agendar
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function NoRecent() {
  const { can } = useAuth();
  const rules = useQuery({ queryKey: qk.alertRules(), queryFn: () => api.get('/alert-rules'), staleTime: 5 * 60_000 });
  const rule = rules.data?.find((r) => r.key === 'patient_inactive');
  const days = rule?.enabled ? rule.params?.days : null;
  const q = { status: 'activo', noRecentDays: days, sort: 'recent', limit: 100 };
  const query = useQuery({ queryKey: qk.patients(q), queryFn: () => api.get('/patients', q), enabled: Boolean(days) });

  if (rules.isPending) return <LoadingState rows={3} />;
  if (!days) {
    return (
      <Card>
        <EmptyState
          icon={UserX}
          title="Define cuándo un paciente está “sin seguimiento”"
          description="No hay un umbral fijo: cada consultorio decide cuántos días sin consulta son demasiados."
          action={
            can('alerts:manage') ? (
              <Button icon={Settings2} to="/configuracion/alertas">
                Configurar umbral
              </Button>
            ) : (
              <p className="text-sm text-ink-3">Pide a un administrador que lo configure.</p>
            )
          }
        />
      </Card>
    );
  }
  return (
    <Card title={`Pacientes activos sin consulta en más de ${days} días`}>
      {query.isPending && <LoadingState rows={4} />}
      {query.data?.length === 0 && <EmptyState compact icon={Check} title="Todos tienen seguimiento reciente" />}
      <ul className="divide-y divide-line/70">
        {query.data?.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Avatar name={p.fullName} size="sm" />
            <Link to={`/pacientes/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-accent">
              {p.fullName}
            </Link>
            <Badge size="sm" tone="amber">
              {p.lastConsultationAt ? `Última: ${fmtRelative(p.lastConsultationAt)}` : 'Sin consultas'}
            </Badge>
            <Button size="sm" variant="ghost" icon={CalendarPlus} to={`/agenda?nueva=1&paciente=${p.id}`}>
              Agendar
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
