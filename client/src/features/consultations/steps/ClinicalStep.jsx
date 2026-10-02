import { CLINICAL_SECTIONS } from '@lanutria/shared';
import { useState } from 'react';
import { Badge, Card, Field, Textarea } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';

/**
 * Paso 2 (opcional): historia clínica. Se muestra el valor vigente; lo que se
 * edite aquí se guarda como nueva versión del expediente al cerrar.
 */
export function ClinicalStep({ state, update, context }) {
  const current = context.clinical ?? {};
  const isInitial = state.type === 'inicial';
  const [open, setOpen] = useState(() => (isInitial ? CLINICAL_SECTIONS.map((s) => s.key) : Object.keys(state.clinical)));

  const valueOf = (k) => (state.clinical[k] !== undefined ? state.clinical[k] : current[k] ?? '');
  const setValue = (k, v) =>
    update('clinical', (c) => {
      const next = { ...c };
      if ((current[k] ?? '') === v) delete next[k];
      else next[k] = v;
      return next;
    });

  return (
    <Card
      title="2 · Expediente (opcional)"
      description={isInitial ? 'Consulta inicial: registra la historia clínica. Todas las secciones son opcionales.' : 'Actualiza sólo lo que cambió. Se conserva la versión anterior.'}
    >
      <ul className="divide-y divide-line/70">
        {CLINICAL_SECTIONS.map((s) => {
          const expanded = open.includes(s.key);
          const changed = state.clinical[s.key] !== undefined;
          return (
            <li key={s.key} className="py-2">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen((o) => (expanded ? o.filter((k) => k !== s.key) : [...o, s.key]))}
                className="flex w-full items-center gap-2 py-1 text-left"
              >
                <span className={cn('flex-1 text-sm font-medium', expanded ? 'text-ink' : 'text-ink-2')}>{s.label}</span>
                {changed && (
                  <Badge tone="brand" size="sm">
                    Modificado
                  </Badge>
                )}
                {!expanded && valueOf(s.key) && <span className="max-w-[45%] truncate text-xs text-ink-3">{valueOf(s.key)}</span>}
              </button>
              {expanded && (
                <Field label={s.label} labelHidden className="mt-1.5">
                  {(p) => <Textarea {...p} rows={2} value={valueOf(s.key)} onChange={(e) => setValue(s.key, e.target.value)} />}
                </Field>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
