import { Field, Input, Skeleton } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { fmtTimeOf, toInputDate } from '../../../lib/format.js';
import { useSlots } from '../hooks.js';

/**
 * Selector de horario: fecha + huecos libres reales del nutriólogo
 * (según horario del consultorio y citas existentes).
 */
export function SlotPicker({ date, onDate, value, onChange, nutritionist, durationMin }) {
  const slots = useSlots({ date: date ? new Date(`${date}T12:00:00`) : null, nutritionist, durationMin });
  return (
    <div className="space-y-3">
      <Field label="Fecha">{(p) => <Input {...p} type="date" min={toInputDate(new Date())} value={date ?? ''} onChange={(e) => onDate(e.target.value)} />}</Field>
      {date && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Horarios libres</p>
          {slots.isPending && <Skeleton className="h-10 w-full" />}
          {slots.data?.length === 0 && <p className="text-sm text-ink-3">Sin horarios libres ese día. Prueba otra fecha.</p>}
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin" role="group" aria-label="Horarios libres">
            {slots.data?.map((s) => {
              const sel = value && new Date(value).getTime() === new Date(s.start).getTime();
              return (
                <button
                  key={s.start}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => onChange(s.start)}
                  className={cn('rounded-lg border px-2.5 py-1.5 text-sm tabular', sel ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white text-ink-2 hover:border-brand-400')}
                >
                  {fmtTimeOf(s.start)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
