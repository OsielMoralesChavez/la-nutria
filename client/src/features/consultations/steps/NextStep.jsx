import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CalendarClock, ClipboardList, Minus } from 'lucide-react';
import { Alert, Card, Checkbox, Field, Input, SegmentedControl, Select, Skeleton } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { addDays, fmtDate, fmtDateLong, fmtDateTime, fmtTimeOf, toInputDate } from '../../../lib/format.js';
import { api } from '../../../lib/http.js';
import { qk } from '../../../lib/queryKeys.js';
import { useCatalog } from '../../catalogs/hooks.js';
import { Attachments } from '../../patients/components/Attachments.jsx';

const SHORTCUTS = [
  { label: '+1 semana', days: 7 },
  { label: '+2 semanas', days: 14 },
  { label: '+3 semanas', days: 21 },
  { label: '+1 mes', days: 30 },
];

/**
 * Paso 5: ¿qué sigue? Próxima cita (con huecos libres reales) o seguimiento
 * sin hora; resolver pendientes; adjuntar fotos o documentos de la consulta.
 */
export function NextStep({ state, update, context, patient }) {
  const n = state.next;
  const types = useCatalog('appointment_type');
  const existing = context.nextAppointments?.[0];
  const set = (patch) => update('next', (cur) => ({ ...cur, ...patch }));
  const setAppt = (patch) => update('next', (cur) => ({ ...cur, appointment: { ...cur.appointment, ...patch } }));
  const setFu = (patch) => update('next', (cur) => ({ ...cur, followUp: { ...cur.followUp, ...patch } }));

  const apptType = types.data?.find((t) => t.key === n.appointment.type);
  const duration = apptType?.meta?.durationMin;
  const day = n.appointment.day ?? (n.appointment.start ? toInputDate(n.appointment.start) : null);
  const slotsParams = { date: day, durationMin: duration };
  const slots = useQuery({
    queryKey: qk.slots(slotsParams),
    queryFn: () => api.get('/appointments/slots', { date: new Date(`${day}T12:00:00`), durationMin: duration }),
    enabled: n.mode === 'cita' && Boolean(day),
  });

  return (
    <div className="space-y-5">
      <Card title="5 · ¿Qué sigue?" description="Deja definida la siguiente acción antes de cerrar.">
        {existing && (
          <Alert tone="info" className="mb-4">
            Ya tiene cita el {fmtDateTime(existing.start)}. Puedes conservarla o agendar otra.
          </Alert>
        )}
        <SegmentedControl
          label="Siguiente acción"
          value={n.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'cita', label: 'Agendar cita', icon: CalendarCheck },
            { value: 'seguimiento', label: 'Seguimiento sin hora', icon: ClipboardList },
            { value: 'ninguno', label: existing ? 'Conservar cita' : 'Nada por ahora', icon: Minus },
          ]}
        />

        {n.mode === 'cita' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de fecha">
              {SHORTCUTS.map((s) => {
                const d = toInputDate(addDays(new Date(), s.days));
                return (
                  <button
                    key={s.days}
                    type="button"
                    aria-pressed={day === d}
                    onClick={() => setAppt({ day: d, start: null })}
                    className={cn('rounded-lg border px-3 py-1.5 text-sm font-medium', day === d ? 'border-brand-600 bg-brand-50 text-accent' : 'border-line bg-surface-2 text-ink-2 hover:border-white/20')}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha">
                {(p) => <Input {...p} type="date" min={toInputDate(new Date())} value={day ?? ''} onChange={(e) => setAppt({ day: e.target.value, start: null })} />}
              </Field>
              <Field label="Tipo de cita">
                {(p) => (
                  <Select {...p} value={n.appointment.type ?? ''} onChange={(e) => setAppt({ type: e.target.value })}>
                    {types.data?.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label} ({t.meta?.durationMin ?? '—'} min)
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            {day && (
              <div>
                <p className="mb-2 text-sm font-medium text-ink-2">Horarios libres · {fmtDateLong(new Date(`${day}T12:00:00`))}</p>
                {slots.isPending && <Skeleton className="h-10 w-full" />}
                {slots.data?.length === 0 && <p className="text-sm text-ink-3">No hay horarios libres ese día (o el consultorio no abre). Prueba otra fecha.</p>}
                <div className="flex flex-wrap gap-1.5">
                  {slots.data?.map((s) => {
                    const sel = n.appointment.start && new Date(n.appointment.start).getTime() === new Date(s.start).getTime();
                    return (
                      <button
                        key={s.start}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => setAppt({ start: s.start, durationMin: duration })}
                        className={cn('rounded-lg border px-2.5 py-1.5 text-sm tabular', sel ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-surface-2 text-ink-2 hover:border-brand-400')}
                      >
                        {fmtTimeOf(s.start)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {n.appointment.start && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-accent">
                <CalendarClock aria-hidden className="size-4" /> Se agendará: {fmtDateTime(n.appointment.start)}
              </p>
            )}
          </div>
        )}

        {n.mode === 'seguimiento' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="¿Qué hay que hacer?">
              {(p) => <Input {...p} value={n.followUp.reason} onChange={(e) => setFu({ reason: e.target.value })} placeholder="Ej. Revisar estudios de laboratorio" />}
            </Field>
            <Field label="Fecha">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  min={toInputDate(new Date())}
                  value={n.followUp.dueDate ? toInputDate(n.followUp.dueDate) : ''}
                  onChange={(e) => setFu({ dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
                />
              )}
            </Field>
          </div>
        )}
      </Card>

      {context.followUps.length > 0 && (
        <Card title="Seguimientos pendientes" description="Marca los que se resolvieron en esta consulta.">
          <ul className="space-y-2">
            {context.followUps.map((f) => (
              <li key={f.id}>
                <Checkbox
                  label={f.reason}
                  description={`Para el ${fmtDate(f.dueDate)}`}
                  checked={n.resolveFollowUps.includes(f.id)}
                  onChange={(e) =>
                    set({ resolveFollowUps: e.target.checked ? [...n.resolveFollowUps, f.id] : n.resolveFollowUps.filter((x) => x !== f.id) })
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Fotos y documentos de esta consulta">
        <div className="space-y-5">
          <Attachments patientId={patient.id} kind="foto" consultationId={context.consultation.id} />
          <Attachments patientId={patient.id} kind="documento" consultationId={context.consultation.id} />
        </div>
      </Card>
    </div>
  );
}
