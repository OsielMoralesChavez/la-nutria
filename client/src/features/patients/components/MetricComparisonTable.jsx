import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '../../../lib/cn.js';
import { fmtDelta, fmtNum } from '../../../lib/format.js';
import { ProgressBar } from '../../../components/ui/index.js';

/**
 * Tabla Inicio · Anterior · Actual · Meta. Las MISMAS columnas que la línea
 * base de "¿Cómo inició?", para comparar sin buscar.
 * La flecha indica la dirección del cambio (no lo califica de bueno/malo:
 * eso depende del objetivo y lo decide el nutriólogo).
 */
export function MetricComparisonTable({ metrics, selected, onSelect, compareTo = 'baseline' }) {
  if (!metrics.length) return null;
  return (
    <div className="-mx-1 overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs text-ink-3">
          <tr>
            <th scope="col" className="px-2 py-2 font-medium">Métrica</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Inicio</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Anterior</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Actual</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">{compareTo === 'baseline' ? 'Cambio total' : 'Cambio'}</th>
            <th scope="col" className="px-2 py-2 font-medium">Meta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {metrics.map((m) => {
            const ref = compareTo === 'baseline' ? m.baseline : m.previous;
            const delta = m.current && ref && m.current.takenAt !== ref.takenAt ? m.current.value - ref.value : null;
            const Arrow = delta === null || Math.abs(delta) < 10 ** -(m.decimals ?? 1) ? ArrowRight : delta < 0 ? ArrowDownRight : ArrowUpRight;
            const isSel = selected === m.key;
            return (
              <tr
                key={m.key}
                onClick={onSelect ? () => onSelect(m.key) : undefined}
                className={cn(onSelect && 'cursor-pointer', isSel ? 'bg-brand-50/70' : onSelect && 'hover:bg-slate-900/[0.03]')}
              >
                <th scope="row" className="px-2 py-2 text-left font-medium text-ink">
                  {onSelect ? (
                    <button type="button" className={cn('text-left', isSel && 'text-brand-800')} aria-pressed={isSel} onClick={() => onSelect(m.key)}>
                      {m.label}
                    </button>
                  ) : (
                    m.label
                  )}
                  {m.unit && <span className="ml-1 text-xs font-normal text-ink-3">{m.unit}</span>}
                </th>
                <td className="px-2 py-2 text-right text-ink-3 tabular">{fmtNum(m.baseline?.value, m.decimals)}</td>
                <td className="px-2 py-2 text-right text-ink-3 tabular">{fmtNum(m.previous?.value, m.decimals)}</td>
                <td className="px-2 py-2 text-right font-semibold text-ink tabular">{fmtNum(m.current?.value, m.decimals)}</td>
                <td className="px-2 py-2 text-right tabular">
                  <span className="inline-flex items-center gap-0.5 text-ink-2">
                    {delta !== null && <Arrow aria-hidden className="size-3.5 text-ink-3" />}
                    {fmtDelta(delta, m.decimals)}
                  </span>
                </td>
                <td className="px-2 py-2">
                  {m.target ? (
                    <span className="flex items-center gap-2">
                      <span className="w-12 text-right text-ink-2 tabular">{fmtNum(m.target.value, m.decimals)}</span>
                      {m.target.progress?.ratio !== null && m.target.direction !== 'mantener' && (
                        <span className="flex w-24 items-center gap-1.5">
                          <ProgressBar value={m.target.progress.ratio} size="sm" label={`Progreso hacia la meta de ${m.label}`} />
                          <span className="w-8 text-xs text-ink-3 tabular">{Math.round(m.target.progress.ratio * 100)}%</span>
                        </span>
                      )}
                      {m.target.direction === 'mantener' && (
                        <span className="text-xs text-ink-3">{m.target.progress?.withinTolerance ? 'en rango' : 'fuera de rango'}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
