import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { CLINICAL_SECTIONS, computeDerived, GOAL_STATUS } from '@lanutria/shared';
import { Alert, Button, Card } from '../../../components/ui/index.js';
import { fmtDateTime, fmtDelta, fmtNum } from '../../../lib/format.js';
import { useGoalTypes } from '../../catalogs/hooks.js';
import { isGoalDraftValid } from '../../patients/components/GoalForm.jsx';
import { todayValues } from '../state.js';

/**
 * Paso 6: revisión. Resume lo que se guardará; los avisos no bloquean salvo
 * datos incompletos que el servidor rechazaría.
 */
export function ReviewStep({ state, context, goTo, onClose, closing, saveStatus }) {
  const types = useGoalTypes();
  const today = todayValues(state);
  const fallback = Object.fromEntries(Object.entries(context.previous).map(([k, v]) => [k, v.value]));
  const derived = computeDerived(today, fallback, context.metrics.filter((m) => m.derived).map((m) => m.derived));
  const all = { ...today, ...derived };
  const metricDefs = Object.fromEntries(context.metrics.map((m) => [m.key, m]));
  const goalUpdates = Object.entries(state.goals.updates).filter(([, u]) => Object.keys(u).length);
  const invalidGoals = state.goals.create.filter((g) => !isGoalDraftValid(g, types.data));
  const clinicalChanged = Object.keys(state.clinical);
  const n = state.next;
  const hasNext = (n.mode === 'cita' && n.appointment.start) || (n.mode === 'seguimiento' && n.followUp.dueDate && n.followUp.reason) || context.nextAppointments?.length;
  const notesEmpty = !state.notes.freeText && !Object.values(state.notes.soap ?? {}).some(Boolean);

  const warnings = [
    Object.keys(today).length === 0 && { text: 'No se registraron mediciones.', step: 'mediciones' },
    notesEmpty && { text: 'La consulta no tiene notas.', step: 'notas' },
    !hasNext && { text: 'No hay próxima cita ni seguimiento definido.', step: 'siguiente' },
    n.mode === 'cita' && !n.appointment.start && { text: 'Elegiste agendar cita pero no seleccionaste horario.', step: 'siguiente' },
  ].filter(Boolean);
  const blockers = [
    invalidGoals.length && { text: `${invalidGoals.length} objetivo(s) nuevo(s) incompleto(s): elige el tipo y la meta, o quítalos.`, step: 'objetivos' },
    saveStatus === 'error' && { text: 'Hay datos que no se pudieron guardar. Revisa los pasos marcados.', step: 'mediciones' },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <Card title="6 · Revisar y cerrar" description="Al cerrar, la consulta queda en sólo lectura y la evolución del paciente se actualiza.">
        {blockers.map((b) => (
          <Alert key={b.text} tone="error" className="mb-3" action={<Button size="sm" variant="secondary" onClick={() => goTo(b.step)}>Corregir</Button>}>
            {b.text}
          </Alert>
        ))}
        {warnings.map((w) => (
          <Alert key={w.text} tone="warning" className="mb-3" action={<Button size="sm" variant="ghost" onClick={() => goTo(w.step)}>Ir</Button>}>
            {w.text}
          </Alert>
        ))}

        <dl className="divide-y divide-line/70 text-sm">
          <Row label="Notas">{notesEmpty ? '—' : <span className="line-clamp-2">{state.notes.freeText || state.notes.soap.p || state.notes.soap.a || state.notes.soap.s}</span>}</Row>
          <Row label="Expediente">{clinicalChanged.length ? clinicalChanged.map((k) => CLINICAL_SECTIONS.find((s) => s.key === k)?.label).join(', ') : 'Sin cambios'}</Row>
          <Row label="Mediciones">
            {Object.keys(all).length ? (
              <span className="flex flex-wrap gap-x-4 gap-y-1 tabular">
                {Object.entries(all).map(([k, v]) => {
                  const def = metricDefs[k];
                  const prev = context.previous[k]?.value;
                  return (
                    <span key={k}>
                      {def?.label ?? k}: <strong>{fmtNum(v, def?.decimals, def?.unit)}</strong>
                      {prev !== undefined && <span className="text-ink-3"> ({fmtDelta(v - prev, def?.decimals)})</span>}
                    </span>
                  );
                })}
              </span>
            ) : (
              '—'
            )}
          </Row>
          <Row label="Objetivos">
            {goalUpdates.length === 0 && state.goals.create.length === 0 ? (
              'Sin cambios'
            ) : (
              <ul className="space-y-0.5">
                {goalUpdates.map(([id, u]) => {
                  const g = context.goals.find((x) => x.id === id);
                  return (
                    <li key={id}>
                      {g?.title}: {[u.status && GOAL_STATUS.labels[u.status], u.target !== undefined && `nueva meta ${u.target}`, u.checkpoint && `avance ${u.checkpoint.score}%`].filter(Boolean).join(' · ')}
                    </li>
                  );
                })}
                {state.goals.create.map((g) => (
                  <li key={g.tmpId}>Nuevo: {g.title || types.data?.find((t) => t.key === g.goalType)?.label || 'sin tipo'}</li>
                ))}
              </ul>
            )}
          </Row>
          <Row label="Qué sigue">
            {n.mode === 'cita' && n.appointment.start
              ? `Cita ${fmtDateTime(n.appointment.start)}`
              : n.mode === 'seguimiento' && n.followUp.reason
                ? `Seguimiento: ${n.followUp.reason}`
                : context.nextAppointments?.length
                  ? `Conserva cita ${fmtDateTime(context.nextAppointments[0].start)}`
                  : '—'}
            {n.resolveFollowUps.length > 0 && <span className="block text-ink-3">{n.resolveFollowUps.length} seguimiento(s) resuelto(s)</span>}
          </Row>
        </dl>
      </Card>

      <div className="glass flex flex-col items-stretch gap-3 rounded-[var(--radius-card)] border p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-ink-2">
          {blockers.length ? <AlertTriangle aria-hidden className="size-4 text-red-600" /> : <CheckCircle2 aria-hidden className="size-4 text-emerald-600" />}
          {blockers.length ? 'Corrige lo indicado para cerrar.' : 'Todo listo. Podrás agregar adendas después.'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => goTo('notas')}>
            Seguir como borrador
          </Button>
          <Button icon={Lock} size="lg" loading={closing} disabled={blockers.length > 0} onClick={onClose}>
            Cerrar consulta
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}
