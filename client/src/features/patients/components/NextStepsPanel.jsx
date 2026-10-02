import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, AlertTriangle, CalendarClock, CalendarPlus, Check, ClipboardList, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, EmptyState, Input, StatusBadge, useToast } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { addDays, fmtDate, fmtDateTime, fmtRelative, toInputDate } from '../../../lib/format.js';
import { api } from '../../../lib/http.js';
import { patientScopedKeys } from '../../../lib/queryKeys.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useStartConsultation } from '../../consultations/hooks.js';
import { useCreateFollowUp, useUpdateFollowUp } from '../hooks.js';

/**
 * ④ ¿QUÉ SIGUE? — lo único accionable de la ficha. Vive en un panel fijo
 * (escritorio) o en una hoja inferior (móvil) para estar siempre a mano.
 */
export function NextStepsPanel({ patient, next, className, compact }) {
  const { can } = useAuth();
  const start = useStartConsultation();
  const toast = useToast();
  const qc = useQueryClient();
  const updateFu = useUpdateFollowUp(patient.id);
  const appt = next.appointments[0];
  const archived = Boolean(patient.archivedAt);

  const alertAction = useMutation({
    mutationFn: ({ id, action, until }) => api.patch(`/alerts/${id}`, { action, ...(until && { until }) }),
    onSuccess: (_d, v) => {
      toast.success(v.action === 'posponer' ? 'Alerta pospuesta una semana' : 'Alerta atendida');
      patientScopedKeys(patient.id).forEach((queryKey) => qc.invalidateQueries({ queryKey }));
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className={cn('space-y-5', className)}>
      {!compact && (
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="grid size-6 place-items-center rounded-full bg-brand-700 text-xs text-white">④</span>
          ¿Qué sigue?
        </h2>
      )}

      {/* Próxima cita */}
      <section aria-label="Próxima cita">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Próxima cita</h3>
        {appt ? (
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">{fmtDateTime(appt.start)}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <StatusBadge kind="appointment" status={appt.status} size="sm" />
              <Link to={`/agenda?cita=${appt.id}`} className="text-xs font-medium text-accent hover:underline">
                Ver / reprogramar
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            Sin cita agendada.
            {can('appointments:create') && !archived && (
              <Link to={`/agenda?nueva=1&paciente=${patient.id}`} className="ml-1 font-semibold underline">
                Agendar
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Seguimientos */}
      <section aria-label="Seguimientos pendientes">
        <h3 className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-3">
          Seguimientos
          {next.followUps.length > 0 && <Badge size="sm">{next.followUps.length}</Badge>}
        </h3>
        {next.followUps.length === 0 && <p className="text-sm text-ink-3">Sin pendientes.</p>}
        <ul className="space-y-1.5">
          {next.followUps.map((f) => {
            const overdue = new Date(f.dueDate) < new Date();
            return (
              <li key={f.id} className="flex items-start gap-2 rounded-lg p-1.5 hover:bg-white/[0.06]">
                {can('followups:update') && (
                  <button
                    type="button"
                    aria-label={`Marcar como realizado: ${f.reason}`}
                    onClick={() => updateFu.mutate({ id: f.id, body: { status: 'realizado' } }, { onSuccess: () => toast.success('Seguimiento realizado') })}
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border border-white/20 bg-surface-2 text-transparent hover:border-brand-600 hover:text-accent"
                  >
                    <Check aria-hidden className="size-3.5" />
                  </button>
                )}
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block text-ink">{f.reason}</span>
                  <span className={cn('text-xs', overdue ? 'font-medium text-red-300' : 'text-ink-3')}>
                    {overdue ? 'Vencido · ' : ''}
                    {fmtDate(f.dueDate)} ({fmtRelative(f.dueDate)})
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {can('followups:create') && !archived && <QuickFollowUp patientId={patient.id} />}
      </section>

      {/* Objetivos por vencer */}
      {next.goalsDueSoon.length > 0 && (
        <section aria-label="Objetivos por vencer">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Objetivos por vencer</h3>
          <ul className="space-y-1.5">
            {next.goalsDueSoon.map((g) => (
              <li key={g.id} className="flex items-center gap-2 text-sm">
                <AlarmClock aria-hidden className="size-4 shrink-0 text-amber-300" />
                <span className="min-w-0 flex-1 truncate text-ink">{g.title}</span>
                <span className="shrink-0 text-xs text-ink-3">{fmtDate(g.dueDate)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Alertas */}
      {next.alerts.length > 0 && (
        <section aria-label="Alertas del paciente">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Alertas</h3>
          <ul className="space-y-2">
            {next.alerts.map((a) => (
              <li key={a.id} className="rounded-lg border border-line bg-surface-2 p-2.5">
                <p className="flex items-start gap-2 text-sm text-ink">
                  <AlertTriangle aria-hidden className={cn('mt-0.5 size-4 shrink-0', a.severity === 'alta' ? 'text-red-300' : 'text-amber-300')} />
                  {a.message}
                </p>
                {can('alerts:update') && (
                  <div className="mt-1.5 flex gap-1 pl-6">
                    <Button size="sm" variant="ghost" onClick={() => alertAction.mutate({ id: a.id, action: 'atender' })}>
                      Atender
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => alertAction.mutate({ id: a.id, action: 'posponer', until: addDays(new Date(), 7) })}>
                      Posponer 1 sem
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!archived && (
        <div className="grid gap-2 border-t border-line/70 pt-4">
          {can('consultations:create') && (
            <Button icon={Play} loading={start.isPending} onClick={() => start.mutate({ patientId: patient.id })}>
              Iniciar consulta
            </Button>
          )}
          {can('appointments:create') && (
            <Button variant="secondary" icon={CalendarPlus} to={`/agenda?nueva=1&paciente=${patient.id}`}>
              Agendar cita
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Crear seguimiento sin hora: escribir + Enter (2 interacciones). */
function QuickFollowUp({ patientId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [due, setDue] = useState(toInputDate(addDays(new Date(), 7)));
  const create = useCreateFollowUp(patientId);
  const toast = useToast();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
        <Plus aria-hidden className="size-3.5" /> Agregar seguimiento
      </button>
    );
  }
  const submit = (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    create.mutate(
      { reason: reason.trim(), dueDate: new Date(`${due}T12:00:00`) },
      {
        onSuccess: () => {
          toast.success('Seguimiento agregado');
          setReason('');
          setOpen(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };
  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl bg-white/5 p-2.5">
      <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="¿Qué hay que hacer?" aria-label="Motivo del seguimiento" className="h-9" />
      <div className="flex items-center gap-2">
        <Input type="date" value={due} min={toInputDate(new Date())} onChange={(e) => setDue(e.target.value)} aria-label="Fecha" className="h-9 flex-1" />
        <Button type="submit" size="sm" loading={create.isPending} icon={ClipboardList}>
          Agregar
        </Button>
      </div>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-3 hover:text-ink">
        Cancelar
      </button>
    </form>
  );
}

/** Barra inferior fija (móvil/tablet) con la siguiente acción. */
export function NextStepsBar({ patient, next, onOpen }) {
  const appt = next.appointments[0];
  const pending = next.followUps.length + next.alerts.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass fixed inset-x-3 bottom-[4.5rem] z-20 flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left shadow-[var(--shadow-pop)] lg:hidden"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-700 text-sm text-white">④</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink-3">¿Qué sigue? · {patient.firstName}</span>
        <span className="block truncate text-sm font-semibold text-ink">
          {appt ? `Cita ${fmtDateTime(appt.start)}` : 'Sin cita agendada'}
          {pending ? ` · ${pending} pendiente${pending > 1 ? 's' : ''}` : ''}
        </span>
      </span>
      <CalendarClock aria-hidden className="size-5 text-accent" />
    </button>
  );
}
