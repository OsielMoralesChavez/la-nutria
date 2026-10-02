import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Play,
  Target,
  Trophy,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { GOAL_STATUS } from '@lanutria/shared';
import { Link } from 'react-router';
import { Button, Card, EmptyState, ErrorState, LoadingState, SegmentedControl, Skeleton, StatCard, StatusBadge, useToast } from '../../components/ui/index.js';
import { cn } from '../../lib/cn.js';
import { fmtDateLong, fmtRelative, fmtTimeOf, fullName, greeting } from '../../lib/format.js';
import { api } from '../../lib/http.js';
import { qk } from '../../lib/queryKeys.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useStartConsultation } from '../consultations/hooks.js';

/** Texto legible para la actividad reciente (bitácora). */
const ACTIVITY_LABEL = {
  'patients.create': 'registró a',
  'consultations.close': 'cerró consulta de',
  'appointments.create': 'agendó cita de',
  'appointments.reschedule': 'reprogramó cita de',
  'appointments.status': 'actualizó cita de',
  'clinical.update': 'actualizó expediente de',
  'goals.create': 'definió objetivo para',
  'followups.create': 'creó seguimiento para',
};

export function DashboardPage() {
  const { user, reloadUser } = useAuth();
  const scope = user?.preferences?.dashboardScope ?? 'mine';
  const query = useQuery({ queryKey: qk.dashboard(scope), queryFn: () => api.get('/dashboard', { scope }) });

  const setScope = async (value) => {
    await api.patch('/auth/preferences', { dashboardScope: value });
    await reloadUser();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {greeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-3">{fmtDateLong(new Date())}</p>
        </div>
        <SegmentedControl
          label="Alcance del dashboard"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'mine', label: 'Mis pacientes' },
            { value: 'all', label: 'Consultorio' },
          ]}
        />
      </header>

      {query.isPending && <DashboardSkeleton />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && <DashboardContent data={query.data} />}
    </div>
  );
}

function DashboardContent({ data }) {
  const { kpis } = data;
  return (
    <>
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-[1.6fr_repeat(4,1fr)]">
        <TodayCard kpis={kpis} className="col-span-2 md:col-span-4 xl:col-span-1 xl:row-span-2" />
        <StatCard label="Pacientes activos" value={kpis.activePatients} icon={Users} to="/pacientes?status=activo" />
        <StatCard label={`Nuevos (${kpis.newPatients.days} días)`} value={kpis.newPatients.count} icon={UserPlus} to={`/pacientes?newDays=${kpis.newPatients.days}&sort=created`} />
        <StatCard
          label="Seguimientos pendientes"
          value={kpis.followUps.pending}
          sub={kpis.followUps.overdue ? `${kpis.followUps.overdue} vencido${kpis.followUps.overdue > 1 ? 's' : ''}` : 'Ninguno vencido'}
          icon={ClipboardList}
          tone={kpis.followUps.overdue ? 'warning' : 'neutral'}
          to="/seguimiento"
        />
        <StatCard label="Alertas pendientes" value={kpis.alerts} icon={AlertTriangle} tone={kpis.alerts ? 'warning' : 'neutral'} to="/seguimiento/alertas" />
        <StatCard
          label="Sin seguimiento reciente"
          value={kpis.noRecentFollowUp.configured ? kpis.noRecentFollowUp.count : '—'}
          sub={kpis.noRecentFollowUp.configured ? `Más de ${kpis.noRecentFollowUp.days} días sin consulta` : 'Define el umbral en Configuración'}
          icon={UserX}
          to={kpis.noRecentFollowUp.configured ? '/seguimiento?tab=sin-seguimiento' : '/configuracion/alertas'}
        />
        <StatCard label="Objetivos activos" value={kpis.goals.active} icon={Target} to="/seguimiento?tab=objetivos" />
        <StatCard label={`Objetivos logrados (${kpis.goals.periodDays} días)`} value={kpis.goals.reached} icon={Trophy} to="/seguimiento?tab=objetivos" />
        <StatCard label="Citas hoy" value={kpis.today.appointments} icon={CalendarCheck} to="/agenda" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <TodayAgenda agenda={data.agenda} />
        <Attention alerts={data.attention} followUps={data.followUpsDue} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <GoalsOverview chart={data.goalsChart} />
        <RecentActivity items={data.activity} />
      </div>
    </>
  );
}

/** Tarjeta destacada (glass): lo que sigue hoy, con acción de 1 clic. */
function TodayCard({ kpis, className }) {
  const start = useStartConsultation();
  const next = kpis.today.next;
  return (
    <section aria-label="Hoy" className={cn('glass-brand flex flex-col justify-between rounded-[var(--radius-card)] p-5 text-white shadow-[var(--shadow-pop)]', className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Hoy</p>
        <p className="mt-1 text-2xl font-semibold tabular">
          {kpis.today.appointments} cita{kpis.today.appointments === 1 ? '' : 's'}
          <span className="text-white/70"> · </span>
          {kpis.today.followUps} seguimiento{kpis.today.followUps === 1 ? '' : 's'}
        </p>
      </div>
      {next ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white/12 p-3 ring-1 ring-white/20">
          <div className="min-w-0">
            <p className="text-xs text-white/75">Próxima · {fmtTimeOf(next.start)}</p>
            <p className="truncate font-semibold">{fullName(next.patient)}</p>
          </div>
          <Button size="sm" variant="secondary" icon={Play} loading={start.isPending} onClick={() => start.mutate({ appointmentId: next.id })}>
            Iniciar
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/80">No quedan citas por atender hoy.</p>
      )}
    </section>
  );
}

function TodayAgenda({ agenda }) {
  const start = useStartConsultation();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useMutation({
    mutationFn: (id) => api.post(`/appointments/${id}/status`, { status: 'confirmada' }),
    onSuccess: () => {
      toast.success('Cita confirmada');
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card
      title="Agenda de hoy"
      icon={CalendarDays}
      actions={
        <Button size="sm" variant="ghost" to="/agenda" iconRight={ChevronRight}>
          Agenda
        </Button>
      }
      bodyClassName="px-2 sm:px-3"
    >
      {agenda.length === 0 ? (
        <EmptyState compact icon={CalendarDays} title="Sin citas hoy" description="Las citas agendadas para hoy aparecerán aquí." action={<Button size="sm" variant="secondary" to="/agenda?nueva=1">Agendar cita</Button>} />
      ) : (
        <ul className="divide-y divide-line/70">
          {agenda.map((a) => {
            const active = ['programada', 'confirmada'].includes(a.status);
            return (
              <li key={a.id} className={cn('flex items-center gap-3 px-2 py-2.5', !active && 'opacity-70')}>
                <span className="w-12 shrink-0 text-sm font-semibold text-ink tabular">{fmtTimeOf(a.start)}</span>
                <Link to={`/pacientes/${a.patient?.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-brand-700">
                  {fullName(a.patient)}
                </Link>
                <StatusBadge kind="appointment" status={a.status} size="sm" className="max-sm:hidden" />
                {a.status === 'programada' && (
                  <Button size="sm" variant="ghost" loading={confirm.isPending && confirm.variables === a.id} onClick={() => confirm.mutate(a.id)} className="max-md:hidden">
                    Confirmar
                  </Button>
                )}
                {active && (
                  <Button size="sm" variant="subtle" icon={Play} loading={start.isPending && start.variables?.appointmentId === a.id} onClick={() => start.mutate({ appointmentId: a.id })}>
                    Iniciar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Attention({ alerts, followUps }) {
  const items = [
    ...followUps.map((f) => ({ id: `f-${f.id}`, patient: f.patient, text: f.reason, sub: `Seguimiento · ${fmtRelative(f.dueDate)}`, severity: new Date(f.dueDate) < new Date() ? 'alta' : 'media' })),
    // Una alerta de seguimiento vencido ya está representada por su seguimiento.
    ...alerts
      .filter((a) => !(a.type === 'followup_overdue' && followUps.some((f) => f.id === a.source?.id)))
      .map((a) => ({ id: `a-${a.id}`, patient: a.patient, text: a.message, sub: 'Alerta', severity: a.severity })),
  ].slice(0, 6);

  return (
    <Card
      title="Requiere atención"
      icon={AlertTriangle}
      actions={
        <Button size="sm" variant="ghost" to="/seguimiento" iconRight={ChevronRight}>
          Ver todo
        </Button>
      }
      bodyClassName="px-2 sm:px-3"
    >
      {items.length === 0 ? (
        <EmptyState compact icon={Trophy} title="Todo al día" description="No hay seguimientos vencidos ni alertas abiertas." />
      ) : (
        <ul className="divide-y divide-line/70">
          {items.map((it) => (
            <li key={it.id}>
              <Link to={`/pacientes/${it.patient?.id}`} className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-900/[0.03]">
                <StatusBadge kind="severity" status={it.severity} size="sm" className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{fullName(it.patient)}</span>
                  <span className="block text-xs text-ink-3">{it.text}</span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-3">{it.sub}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Objetivos por estado (últimos 90 días). Barras horizontales de una sola
 * tinta con etiqueta directa: sólo se muestra con datos suficientes.
 */
function GoalsOverview({ chart }) {
  if (!chart) {
    return (
      <Card title="Objetivos (90 días)" icon={Target}>
        <EmptyState compact icon={Target} title="Aún no hay suficientes objetivos" description="La distribución aparece cuando hay al menos 5 objetivos." />
      </Card>
    );
  }
  const total = Object.values(chart).reduce((s, n) => s + n, 0);
  const order = ['en_curso', 'logrado', 'no_logrado', 'cancelado'];
  const reached = chart.logrado ?? 0;
  const closed = reached + (chart.no_logrado ?? 0);
  return (
    <Card title="Objetivos (90 días)" icon={Target} description={closed ? `${Math.round((reached / closed) * 100)} % de los objetivos cerrados se lograron` : undefined}>
      <ul className="space-y-3" aria-label="Objetivos por estado">
        {order
          .filter((s) => chart[s])
          .map((s) => (
            <li key={s} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="text-ink-2">{GOAL_STATUS.labels[s]}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <span className={cn('block h-full rounded-full', s === 'logrado' ? 'bg-brand-700' : 'bg-brand-400')} style={{ width: `${(chart[s] / total) * 100}%` }} />
              </span>
              <span className="text-right font-semibold text-ink tabular">{chart[s]}</span>
            </li>
          ))}
      </ul>
    </Card>
  );
}

function RecentActivity({ items }) {
  return (
    <Card title="Actividad reciente" icon={Activity} bodyClassName="px-2 sm:px-3">
      {items.length === 0 ? (
        <EmptyState compact icon={Activity} title="Sin actividad todavía" description="Aquí verás consultas cerradas, citas y cambios recientes." />
      ) : (
        <ul className="divide-y divide-line/70">
          {items.map((a) => (
            <li key={a.id} className="flex items-baseline gap-3 px-2 py-2 text-sm">
              <span className="w-20 shrink-0 text-xs text-ink-3">{fmtRelative(a.at)}</span>
              <span className="min-w-0 flex-1 text-ink-2">
                <span className="font-medium text-ink">{a.actor}</span> {ACTIVITY_LABEL[a.action] ?? a.action}{' '}
                {a.patient?.name ? (
                  <Link to={`/pacientes/${a.patient.id}`} className="font-medium text-brand-700 hover:underline">
                    {a.patient.name}
                  </Link>
                ) : (
                  'un paciente'
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <LoadingState rows={4} />
        </div>
        <div className="card p-5">
          <LoadingState rows={4} />
        </div>
      </div>
    </div>
  );
}
