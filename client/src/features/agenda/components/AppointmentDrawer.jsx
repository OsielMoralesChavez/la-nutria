import { Ban, BellOff, CalendarCheck, CalendarClock, Phone, Play, UserRound, XCircle } from 'lucide-react';
import { APPOINTMENT_STATUS, canTransitionAppointment } from '@lanutria/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert, Button, DataList, Drawer, ErrorState, Field, LoadingState, Select, StatusBadge, useToast } from '../../../components/ui/index.js';
import { fmtDateLong, fmtDateTime, fmtTimeOf, fullName, toInputDate } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useCatalog, useLabels } from '../../catalogs/hooks.js';
import { useStartConsultation } from '../../consultations/hooks.js';
import { useAppointment, useAppointmentMutation } from '../hooks.js';
import { SlotPicker } from './SlotPicker.jsx';

/** Panel de cita: estado, acciones (confirmar, iniciar, no asistió, cancelar, reprogramar) e historial. */
export function AppointmentDrawer({ id, onClose }) {
  const { can } = useAuth();
  const query = useAppointment(id);
  const mutation = useAppointmentMutation();
  const start = useStartConsultation();
  const types = useLabels('appointment_type');
  const cancelReasons = useCatalog('cancel_reason');
  const toast = useToast();
  const [mode, setMode] = useState(null); // 'reschedule' | 'cancel'
  const [date, setDate] = useState(null);
  const [newStart, setNewStart] = useState(null);
  const [reason, setReason] = useState('paciente');

  const a = query.data;
  const active = a && ['programada', 'confirmada'].includes(a.status);
  const act = (status, extra) =>
    mutation.mutate(
      { action: 'status', id, body: { status, ...extra } },
      { onSuccess: () => toast.success(`Cita: ${APPOINTMENT_STATUS.labels[status].toLowerCase()}`), onError: (e) => toast.error(e.message) },
    );

  return (
    <Drawer open={Boolean(id)} onClose={onClose} title="Cita">
      {query.isPending && <LoadingState rows={3} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {a && (
        <div className="space-y-5">
          <div>
            <Link to={`/pacientes/${a.patient?.id}`} className="text-lg font-semibold text-ink hover:text-accent">
              {fullName(a.patient)}
            </Link>
            <p className="mt-0.5 text-sm text-ink-2">
              {fmtDateLong(a.start)} · {fmtTimeOf(a.start)}–{fmtTimeOf(a.end)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge kind="appointment" status={a.status} />
              <span className="text-sm text-ink-3">
                {types[a.type] ?? 'Cita'} · {a.nutritionist?.name}
              </span>
            </div>
          </div>

          <DataList
            items={[
              { label: 'Teléfono', value: a.patient?.contact?.phone && <a href={`tel:${a.patient.contact.phone}`} className="inline-flex items-center gap-1 text-accent"><Phone aria-hidden className="size-3.5" />{a.patient.contact.phone}</a> },
              { label: 'Notas', value: a.notes },
              { label: 'Cancelación', value: a.cancelReason },
            ]}
          />

          {active && can('appointments:update') && mode === null && (
            <div className="grid gap-2">
              {can('consultations:create') && (
                <Button icon={Play} loading={start.isPending} onClick={() => start.mutate({ appointmentId: a.id })}>
                  Iniciar consulta
                </Button>
              )}
              {canTransitionAppointment(a.status, 'confirmada') && (
                <Button variant="secondary" icon={CalendarCheck} onClick={() => act('confirmada')} loading={mutation.isPending}>
                  Confirmar asistencia
                </Button>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="secondary" icon={CalendarClock} onClick={() => { setMode('reschedule'); setDate(toInputDate(a.start)); }}>
                  Reprogramar
                </Button>
                <Button size="sm" variant="secondary" icon={Ban} onClick={() => act('no_asistio')}>
                  No asistió
                </Button>
                <Button size="sm" variant="danger-ghost" icon={XCircle} onClick={() => setMode('cancel')}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {a.status === 'no_asistio' && can('appointments:update') && mode === null && (
            <Button variant="secondary" icon={CalendarClock} onClick={() => { setMode('reschedule'); setDate(toInputDate(new Date())); }}>
              Reprogramar
            </Button>
          )}
          {a.consultation && (
            <Button variant="ghost" icon={UserRound} to={`/pacientes/${a.patient?.id}/intervenciones/consultas/${a.consultation}`}>
              Ver consulta
            </Button>
          )}

          {mode === 'reschedule' && (
            <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">Reprogramar</p>
              <SlotPicker
                date={date}
                onDate={(d) => {
                  setDate(d);
                  setNewStart(null);
                }}
                value={newStart}
                onChange={setNewStart}
                nutritionist={a.nutritionist?.id}
                durationMin={Math.round((new Date(a.end) - new Date(a.start)) / 60000)}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
                  Volver
                </Button>
                <Button
                  size="sm"
                  disabled={!newStart}
                  loading={mutation.isPending}
                  onClick={() =>
                    mutation.mutate(
                      { action: 'reschedule', id, body: { start: newStart } },
                      {
                        onSuccess: (n) => {
                          toast.success(`Reprogramada para ${fmtDateTime(n.start)}`);
                          setMode(null);
                          onClose(n.id);
                        },
                        onError: (e) => toast.error(e.message),
                      },
                    )
                  }
                >
                  Confirmar nuevo horario
                </Button>
              </div>
            </div>
          )}

          {mode === 'cancel' && (
            <div className="space-y-3 rounded-xl border border-red-300/30 bg-red-400/10 p-3">
              <Field label="Motivo de cancelación">
                {(p) => (
                  <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
                    {cancelReasons.data?.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
                  Volver
                </Button>
                <Button size="sm" variant="danger" loading={mutation.isPending} onClick={() => { act('cancelada', { reason }); setMode(null); }}>
                  Cancelar cita
                </Button>
              </div>
            </div>
          )}

          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Historial</h3>
            <ol className="space-y-1 text-xs text-ink-3">
              {a.statusHistory?.map((h, i) => (
                <li key={i}>
                  {fmtDateTime(h.at)} · {h.from ? `${APPOINTMENT_STATUS.labels[h.from]} → ` : ''}
                  {APPOINTMENT_STATUS.labels[h.to]}
                  {h.by?.name ? ` · ${h.by.name}` : ''}
                  {h.reason ? ` (${h.reason})` : ''}
                </li>
              ))}
            </ol>
          </section>

          <Alert tone="info">
            <span className="inline-flex items-center gap-1.5">
              <BellOff aria-hidden className="size-3.5" /> Recordatorios automáticos: no configurados (próximamente).
            </span>
          </Alert>
        </div>
      )}
    </Drawer>
  );
}
