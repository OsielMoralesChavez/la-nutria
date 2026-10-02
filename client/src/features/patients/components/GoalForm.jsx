import { useState } from 'react';
import { Field, Input, NumberInput, Select, Textarea } from '../../../components/ui/index.js';
import { fmtNum, toInputDate } from '../../../lib/format.js';
import { useGoalTypes, useMetrics } from '../../catalogs/hooks.js';

/**
 * Campos para definir un objetivo a partir del catálogo de tipos.
 * El tipo precarga métrica y dirección; la línea base se toma de la última
 * medición (o de la de hoy si se crea durante la consulta).
 *
 * Controlado: `value` es el borrador y `onChange` recibe el siguiente.
 */
export function GoalFields({ value, onChange, currentValues = {} }) {
  const types = useGoalTypes();
  const metrics = useMetrics();
  const type = types.data?.find((t) => t.key === value.goalType);
  const metricKey = value.metric ?? type?.defaultMetric;
  const metric = metrics.data?.find((m) => m.key === metricKey);
  const current = currentValues[metricKey];
  const [targetRaw, setTargetRaw] = useState(value.target ?? '');
  const [tolRaw, setTolRaw] = useState(value.tolerance ?? type?.defaultTolerance ?? '');

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Tipo de objetivo" required className="sm:col-span-2">
        {(p) => (
          <Select
            {...p}
            value={value.goalType ?? ''}
            onChange={(e) => {
              const t = types.data?.find((x) => x.key === e.target.value);
              onChange({ goalType: e.target.value, metric: t?.defaultMetric ?? null, direction: t?.direction ?? null, title: '', dueDate: value.dueDate });
              setTargetRaw('');
              setTolRaw(t?.defaultTolerance ?? '');
            }}
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {types.data?.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {type && (
        <Field label="Título" hint="Opcional. Por defecto, el nombre del tipo." className="sm:col-span-2">
          {(p) => <Input {...p} value={value.title ?? ''} placeholder={type.label} onChange={(e) => set({ title: e.target.value })} />}
        </Field>
      )}

      {type?.kind === 'metrica' && (
        <>
          <Field label="Métrica">
            {(p) => (
              <Select {...p} value={metricKey ?? ''} onChange={(e) => set({ metric: e.target.value })}>
                {metrics.data
                  ?.filter((m) => !m.derived || m.key === metricKey)
                  .map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field
            label={value.direction === 'mantener' ? `Valor a mantener (${metric?.unit ?? ''})` : `Meta (${metric?.unit ?? ''})`}
            required
            hint={current !== undefined && current !== null ? `Valor actual: ${fmtNum(current, metric?.decimals, metric?.unit)}` : 'Sin medición previa: la línea base será la próxima toma'}
          >
            {(p) => (
              <NumberInput
                {...p}
                value={targetRaw}
                onValue={(raw, n) => {
                  setTargetRaw(raw);
                  set({ target: n ?? undefined });
                }}
              />
            )}
          </Field>
          {value.direction === 'mantener' && (
            <Field label={`Tolerancia ± (${metric?.unit ?? ''})`}>
              {(p) => (
                <NumberInput
                  {...p}
                  value={tolRaw}
                  onValue={(raw, n) => {
                    setTolRaw(raw);
                    set({ tolerance: n ?? undefined });
                  }}
                />
              )}
            </Field>
          )}
        </>
      )}

      {type && (
        <Field label="Fecha objetivo">
          {(p) => (
            <Input
              {...p}
              type="date"
              min={toInputDate(new Date())}
              value={value.dueDate ? toInputDate(value.dueDate) : ''}
              onChange={(e) => set({ dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })}
            />
          )}
        </Field>
      )}
      {type && (
        <Field label="Notas" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={value.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />}
        </Field>
      )}
    </div>
  );
}

/** ¿El borrador del objetivo está completo? */
export function isGoalDraftValid(draft, types) {
  const type = types?.find((t) => t.key === draft.goalType);
  if (!type) return false;
  if (type.kind === 'metrica') return typeof draft.target === 'number';
  return true;
}

/** Limpia el borrador para enviarlo a la API. */
export function goalDraftToBody(d) {
  const body = { goalType: d.goalType };
  for (const k of ['title', 'metric', 'direction', 'target', 'tolerance', 'dueDate', 'notes']) {
    if (d[k] !== undefined && d[k] !== null && d[k] !== '') body[k] = d[k];
  }
  return body;
}
