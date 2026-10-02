import { CheckCircle2, MoreHorizontal, Pencil, Target, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button, Field, IconButton, Input, MenuItem, Modal, NumberInput, Popover, ProgressBar, StatusBadge, Textarea, useToast } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { daysFromNow, fmtDate, fmtNum, toInputDate } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useGoalMutation } from '../hooks.js';

/**
 * Objetivo con su progreso calculado (inicio → actual → meta).
 * Mantenimiento muestra "en rango / fuera de rango"; cualitativos, el último avance.
 */
export function GoalCard({ goal, metric, patientId, compact }) {
  const { can } = useAuth();
  const mutate = useGoalMutation(patientId);
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const p = goal.progress ?? {};
  const decimals = metric?.decimals ?? 1;
  const unit = metric?.unit ?? '';
  const due = goal.dueDate ? daysFromNow(goal.dueDate) : null;
  const active = goal.status === 'en_curso';
  const overdue = active && due !== null && due < 0;
  const soon = active && due !== null && due >= 0 && due <= 14;

  const setStatus = (status) =>
    mutate.mutate({ goalId: goal.id, body: { status } }, { onSuccess: () => toast.success('Objetivo actualizado'), onError: (e) => toast.error(e.message) });

  const lastCheckpoint = goal.checkpoints?.at(-1);

  return (
    <article className={cn('rounded-xl border bg-surface-2 p-3.5', overdue ? 'border-amber-300/30' : 'border-line')}>
      <header className="flex items-start gap-2">
        <Target aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-ink">{goal.title}</h3>
        <StatusBadge kind="goal" status={goal.status} size="sm" />
        {can('goals:update') && !compact && (
          <Popover width="w-52" trigger={(t) => <IconButton {...t} icon={MoreHorizontal} label="Acciones del objetivo" size="sm" />}>
            {({ close }) => (
              <>
                <MenuItem icon={Pencil} close={close} onClick={() => setEdit(true)}>
                  Ajustar meta o fecha
                </MenuItem>
                {active ? (
                  <>
                    <MenuItem icon={CheckCircle2} close={close} onClick={() => setStatus('logrado')}>
                      Marcar logrado
                    </MenuItem>
                    <MenuItem icon={XCircle} close={close} onClick={() => setStatus('no_logrado')}>
                      Marcar no logrado
                    </MenuItem>
                    <MenuItem icon={XCircle} close={close} onClick={() => setStatus('cancelado')}>
                      Cancelar objetivo
                    </MenuItem>
                  </>
                ) : (
                  <MenuItem icon={Target} close={close} onClick={() => setStatus('en_curso')}>
                    Reabrir
                  </MenuItem>
                )}
              </>
            )}
          </Popover>
        )}
      </header>

      {goal.kind === 'metrica' ? (
        goal.direction === 'mantener' ? (
          <p className="mt-2 text-sm text-ink-2">
            Mantener {fmtNum(goal.target, decimals, unit)} ± {fmtNum(goal.tolerance ?? 0, decimals)} · actual{' '}
            <strong className="tabular">{fmtNum(goal.current, decimals, unit)}</strong>{' '}
            <span className={p.withinTolerance ? 'text-emerald-300' : 'text-amber-300'}>({p.withinTolerance ? 'en rango' : 'fuera de rango'})</span>
          </p>
        ) : (
          <div className="mt-2.5">
            <ProgressBar value={p.ratio} tone={goal.status === 'logrado' ? 'green' : 'brand'} label={`Progreso de ${goal.title}`} />
            <div className="mt-1.5 flex justify-between text-xs text-ink-3 tabular">
              <span>Inicio {fmtNum(goal.baseline, decimals)}</span>
              <span className="font-semibold text-ink">
                Actual {fmtNum(goal.current, decimals)} {p.ratio !== null && p.ratio !== undefined ? `· ${Math.round(p.ratio * 100)}%` : ''}
              </span>
              <span>Meta {fmtNum(goal.target, decimals)} {unit}</span>
            </div>
          </div>
        )
      ) : (
        <div className="mt-2.5">
          {p.ratio !== null && p.ratio !== undefined && <ProgressBar value={p.ratio} tone="sky" label={`Avance de ${goal.title}`} />}
          <p className="mt-1.5 text-xs text-ink-3">
            {goal.checkpoints?.length
              ? `Registros: ${goal.checkpoints.slice(-4).map((c) => `${c.score}%`).join(' → ')}`
              : 'Sin registros de avance todavía'}
          </p>
          {lastCheckpoint?.note && <p className="mt-1 text-xs italic text-ink-2">“{lastCheckpoint.note}”</p>}
        </div>
      )}

      {goal.dueDate && (
        <p className={cn('mt-2 text-xs', overdue ? 'font-medium text-amber-200' : soon ? 'text-amber-300' : 'text-ink-3')}>
          {overdue ? `Venció el ${fmtDate(goal.dueDate)}` : `Fecha objetivo: ${fmtDate(goal.dueDate)}${soon ? ` · faltan ${due} días` : ''}`}
        </p>
      )}

      {p.reached && active && can('goals:update') && !compact && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-400/15 px-2.5 py-1.5 text-xs text-emerald-200">
          La medición actual alcanza la meta.
          <Button size="sm" variant="ghost" onClick={() => setStatus('logrado')}>
            Marcar logrado
          </Button>
        </div>
      )}

      {edit && <GoalEditModal goal={goal} unit={unit} onClose={() => setEdit(false)} mutate={mutate} />}
    </article>
  );
}

function GoalEditModal({ goal, unit, onClose, mutate }) {
  const toast = useToast();
  const [target, setTarget] = useState({ raw: goal.target ?? '', value: goal.target ?? null });
  const [dueDate, setDueDate] = useState(toInputDate(goal.dueDate));
  const [notes, setNotes] = useState(goal.notes ?? '');
  const save = () =>
    mutate.mutate(
      {
        goalId: goal.id,
        body: {
          ...(goal.kind === 'metrica' && target.value !== null && { target: target.value }),
          dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
          notes,
        },
      },
      {
        onSuccess: () => {
          toast.success('Objetivo actualizado');
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={`Ajustar: ${goal.title}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={mutate.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {goal.kind === 'metrica' && (
          <Field label={`Meta (${unit})`}>{(p) => <NumberInput {...p} value={target.raw} onValue={(raw, value) => setTarget({ raw, value })} />}</Field>
        )}
        <Field label="Fecha objetivo">{(p) => <Input {...p} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
        <Field label="Notas">{(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}
