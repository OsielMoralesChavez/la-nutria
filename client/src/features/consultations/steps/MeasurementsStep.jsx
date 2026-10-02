import { AlertTriangle, Calculator } from 'lucide-react';
import { computeDerived } from '@lanutria/shared';
import { Card, Checkbox, Field, NumberInput, Select } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { fmtDate, fmtDelta, fmtNum } from '../../../lib/format.js';
import { useCatalog } from '../../catalogs/hooks.js';
import { todayValues } from '../state.js';

/**
 * Paso 3: mediciones. Junto a cada campo se ve el valor anterior y el de
 * inicio; las derivadas (IMC, ICC) se calculan al escribir con la misma
 * fórmula que usa el servidor. Fuera de rango = aviso, nunca bloqueo.
 */
export function MeasurementsStep({ state, update, context }) {
  const methods = useCatalog('measurement_method');
  const { previous, baseline } = context;
  const inputs = context.metrics.filter((m) => !m.derived);
  const derivedDefs = context.metrics.filter((m) => m.derived);
  const m = state.measurement;

  const today = todayValues(state);
  const fallback = Object.fromEntries(Object.entries(previous).map(([k, v]) => [k, v.value]));
  const derived = computeDerived(today, fallback, derivedDefs.map((d) => d.derived));

  const setValue = (key, raw, value) => update('measurement', (cur) => ({ ...cur, values: { ...cur.values, [key]: { ...cur.values[key], raw, value } } }));
  const setMethod = (key, method) => update('measurement', (cur) => ({ ...cur, values: { ...cur.values, [key]: { ...(cur.values[key] ?? { raw: '', value: null }), method } } }));

  const rows = [
    ...inputs.map((d) => ({ def: d, input: true })),
    ...derivedDefs.map((d) => ({ def: d, input: false })),
  ];
  const lastDate = Object.values(previous).reduce((acc, v) => (!acc || v.takenAt > acc ? v.takenAt : acc), null);

  return (
    <Card title="3 · Mediciones" description={lastDate ? `Anterior: ${fmtDate(lastDate)}. Deja vacío lo que no midas hoy.` : 'Primera medición: será la línea base del paciente.'}>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Field label="Método de la toma" className="min-w-52">
          {(p) => (
            <Select {...p} value={m.method ?? ''} onChange={(e) => update('measurement', (cur) => ({ ...cur, method: e.target.value }))}>
              {methods.data?.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Checkbox
          label="Usar otro método en algunas métricas"
          checked={m.perValueMethod}
          onChange={(e) => update('measurement', (cur) => ({ ...cur, perValueMethod: e.target.checked }))}
          className="pb-2.5"
        />
      </div>

      <div className="-mx-1 overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-ink-3">
            <tr>
              <th scope="col" className="px-1 py-2 font-medium">Métrica</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Anterior</th>
              <th scope="col" className="w-32 px-1 py-2 text-right font-medium">Hoy</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Cambio</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Inicio</th>
              {m.perValueMethod && <th scope="col" className="px-1 py-2 font-medium">Método</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.map(({ def, input }) => {
              const v = m.values[def.key];
              const current = input ? v?.value ?? null : derived[def.derived] ?? null;
              const prev = previous[def.key]?.value;
              const delta = current !== null && prev !== undefined ? current - prev : null;
              const out = input && current !== null && ((def.min !== undefined && def.min !== null && current < def.min) || (def.max !== undefined && def.max !== null && current > def.max));
              const invalid = input && v?.raw && v.value === null;
              return (
                <tr key={def.key} className={cn(!input && 'bg-white/5')}>
                  <th scope="row" className="px-1 py-1.5 text-left font-medium text-ink">
                    <label htmlFor={`m-${def.key}`} className="flex items-center gap-1.5">
                      {!input && <Calculator aria-hidden className="size-3.5 text-ink-3" />}
                      {def.label}
                      {def.unit && <span className="text-xs font-normal text-ink-3">{def.unit}</span>}
                    </label>
                  </th>
                  <td className="px-1 py-1.5 text-right text-ink-3 tabular">{fmtNum(prev, def.decimals)}</td>
                  <td className="px-1 py-1.5">
                    {input ? (
                      <div>
                        <NumberInput
                          id={`m-${def.key}`}
                          value={v?.raw ?? ''}
                          onValue={(raw, n) => setValue(def.key, raw, n)}
                          aria-invalid={invalid || out ? true : undefined}
                          aria-describedby={out ? `w-${def.key}` : undefined}
                          className="h-9"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const all = [...document.querySelectorAll('[id^="m-"]')];
                              all[all.indexOf(e.currentTarget) + 1]?.focus();
                            }
                          }}
                        />
                        {out && (
                          <p id={`w-${def.key}`} className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-amber-300">
                            <AlertTriangle aria-hidden className="size-3" /> Fuera del rango habitual ({def.min}–{def.max})
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="pr-3 text-right font-semibold text-ink tabular" aria-live="polite">
                        {fmtNum(current, def.decimals)}
                        <span className="sr-only"> (calculado)</span>
                      </p>
                    )}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular">
                    <span className={cn(delta === null ? 'text-ink-3' : 'font-medium text-ink-2')}>{fmtDelta(delta, def.decimals)}</span>
                  </td>
                  <td className="px-1 py-1.5 text-right text-ink-3 tabular">{fmtNum(baseline[def.key]?.value, def.decimals)}</td>
                  {m.perValueMethod && (
                    <td className="px-1 py-1.5">
                      {input && (
                        <Select aria-label={`Método para ${def.label}`} value={v?.method ?? ''} onChange={(e) => setMethod(def.key, e.target.value || null)} className="h-9 text-xs">
                          <option value="">Igual que la toma</option>
                          {methods.data?.map((x) => (
                            <option key={x.key} value={x.key}>
                              {x.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Enter o Tab avanza al siguiente campo. Se aceptan coma o punto decimal. Las métricas calculadas usan la última estatura registrada si hoy no se midió.
      </p>
    </Card>
  );
}
