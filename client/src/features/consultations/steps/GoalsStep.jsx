import { CheckCircle2, Plus, Target, Trash2 } from 'lucide-react';
import { goalProgress, GOAL_STATUS } from '@lanutria/shared';
import { Button, Card, EmptyState, Field, IconButton, Input, ProgressBar, Select } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { fmtDate, fmtNum } from '../../../lib/format.js';
import { useGoalTypes, useMetricMap } from '../../catalogs/hooks.js';
import { GoalFields, isGoalDraftValid } from '../../patients/components/GoalForm.jsx';
import { todayValues } from '../state.js';

/**
 * Paso 4: objetivos. El progreso se recalcula EN VIVO con las mediciones de
 * hoy. Si un objetivo alcanza su meta se SUGIERE marcarlo como logrado (no se
 * cambia solo: lo decide el nutriólogo).
 */
export function GoalsStep({ state, update, context }) {
  const metricMap = useMetricMap();
  const types = useGoalTypes();
  const today = todayValues(state);
  const current = { ...Object.fromEntries(Object.entries(context.previous).map(([k, v]) => [k, v.value])), ...today };

  const setUpdate = (goalId, patch) =>
    update('goals', (g) => {
      const merged = { ...(g.updates[goalId] ?? {}), ...patch };
      for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
      return { ...g, updates: { ...g.updates, [goalId]: merged } };
    });
  const addDraft = () => update('goals', (g) => ({ ...g, create: [...g.create, { tmpId: Math.random().toString(36).slice(2) }] }));
  const setDraft = (tmpId, value) => update('goals', (g) => ({ ...g, create: g.create.map((d) => (d.tmpId === tmpId ? { ...value, tmpId } : d)) }));
  const removeDraft = (tmpId) => update('goals', (g) => ({ ...g, create: g.create.filter((d) => d.tmpId !== tmpId) }));

  return (
    <div className="space-y-5">
      <Card title="4 · Objetivos activos" description="Registra avances, ajusta metas o cierra objetivos.">
        {context.goals.length === 0 ? (
          <EmptyState compact icon={Target} title="Sin objetivos activos" description="Define el primero abajo." />
        ) : (
          <ul className="space-y-3">
            {context.goals.map((goal) => {
              const u = state.goals.updates[goal.id] ?? {};
              const metric = metricMap[goal.metric];
              const value = goal.metric ? current[goal.metric] : null;
              const target = u.target ?? goal.target;
              const progress = goalProgress(
                { ...goal, target, checkpoints: u.checkpoint ? [...(goal.checkpoints ?? []), u.checkpoint] : goal.checkpoints },
                value,
              );
              const status = u.status ?? goal.status;
              const measuredToday = goal.metric && today[goal.metric] !== undefined;
              return (
                <li key={goal.id} className={cn('rounded-xl border p-3.5', status !== 'en_curso' ? 'border-emerald-200 bg-emerald-50/40' : 'border-line bg-white')}>
                  <div className="flex flex-wrap items-start gap-2">
                    <Target aria-hidden className="mt-0.5 size-4 text-brand-700" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{goal.title}</p>
                      {goal.dueDate && <p className="text-xs text-ink-3">Fecha objetivo: {fmtDate(goal.dueDate)}</p>}
                    </div>
                    <Select aria-label={`Estado de ${goal.title}`} value={status} onChange={(e) => setUpdate(goal.id, { status: e.target.value === goal.status ? undefined : e.target.value })} className="h-8 w-auto text-xs">
                      {GOAL_STATUS.values.map((s) => (
                        <option key={s} value={s}>
                          {GOAL_STATUS.labels[s]}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {goal.kind === 'metrica' ? (
                    <div className="mt-3">
                      {goal.direction !== 'mantener' && <ProgressBar value={progress.ratio} label={`Progreso de ${goal.title}`} />}
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3 tabular">
                        <span>Inicio {fmtNum(goal.baseline, metric?.decimals)}</span>
                        <span className={cn('font-semibold', measuredToday ? 'text-brand-800' : 'text-ink')}>
                          {measuredToday ? 'Hoy' : 'Actual'} {fmtNum(value, metric?.decimals)}
                          {goal.direction === 'mantener'
                            ? progress.withinTolerance
                              ? ' · en rango'
                              : ' · fuera de rango'
                            : progress.ratio !== null
                              ? ` · ${Math.round(progress.ratio * 100)}%`
                              : ''}
                        </span>
                        <label className="inline-flex items-center gap-1.5">
                          Meta
                          <Input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Meta de ${goal.title}`}
                            defaultValue={target ?? ''}
                            onBlur={(e) => {
                              const n = Number(e.target.value.replace(',', '.'));
                              if (e.target.value !== '' && Number.isFinite(n) && n !== goal.target) setUpdate(goal.id, { target: n });
                            }}
                            className="h-7 w-20 text-right text-xs"
                          />
                          {metric?.unit}
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr]">
                      <Field label={`Avance hoy: ${u.checkpoint?.score ?? '—'}${u.checkpoint ? '%' : ''}`}>
                        {(p) => (
                          <input
                            {...p}
                            type="range"
                            min={0}
                            max={100}
                            step={10}
                            value={u.checkpoint?.score ?? goal.checkpoints?.at(-1)?.score ?? 50}
                            onChange={(e) => setUpdate(goal.id, { checkpoint: { ...(u.checkpoint ?? {}), score: Number(e.target.value) } })}
                            className="w-full accent-brand-700"
                          />
                        )}
                      </Field>
                      <Field label="Nota de avance">
                        {(p) => (
                          <Input
                            {...p}
                            value={u.checkpoint?.note ?? ''}
                            onChange={(e) => setUpdate(goal.id, { checkpoint: { score: u.checkpoint?.score ?? goal.checkpoints?.at(-1)?.score ?? 50, note: e.target.value } })}
                            placeholder="Ej. cumple desayunos, falla fines de semana"
                          />
                        )}
                      </Field>
                    </div>
                  )}

                  {progress.reached && status === 'en_curso' && (
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 aria-hidden className="size-4" /> {measuredToday ? 'Con la medición de hoy se alcanza la meta.' : 'La meta está alcanzada.'}
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => setUpdate(goal.id, { status: 'logrado' })}>
                        Marcar logrado
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title="Nuevos objetivos"
        actions={
          <Button size="sm" variant="secondary" icon={Plus} onClick={addDraft}>
            Agregar
          </Button>
        }
      >
        {state.goals.create.length === 0 ? (
          <p className="text-sm text-ink-3">No se agregarán objetivos nuevos en esta consulta.</p>
        ) : (
          <ul className="space-y-4">
            {state.goals.create.map((d, i) => (
              <li key={d.tmpId} className="rounded-xl border border-line p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">Objetivo nuevo {i + 1}</p>
                  <div className="flex items-center gap-2">
                    {!isGoalDraftValid(d, types.data) && <span className="text-xs text-amber-700">Incompleto</span>}
                    <IconButton icon={Trash2} label="Quitar objetivo" size="sm" onClick={() => removeDraft(d.tmpId)} />
                  </div>
                </div>
                <GoalFields value={d} onChange={(v) => setDraft(d.tmpId, v)} currentValues={current} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
