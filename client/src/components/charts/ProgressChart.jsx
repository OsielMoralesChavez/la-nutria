import { Table2, LineChart as LineIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '../../lib/cn.js';
import { fmtDate, fmtDateFull, fmtDelta, fmtNum } from '../../lib/format.js';

/**
 * Evolución de UNA métrica en el tiempo (nunca doble eje).
 * - Línea de 2 px en color de marca, marcadores ≥ 8 px.
 * - Meta como línea punteada con etiqueta directa.
 * - Marcadores verticales sutiles para intervenciones (p. ej. cambio de plan).
 * - Si las tomas usan métodos distintos, el marcador cambia de forma y se avisa.
 * - Tooltip con fecha, valor, cambio y método; vista de tabla equivalente.
 */
const INK = { line: '#a9a7ff', grid: 'rgba(255,255,255,0.12)', axis: '#cbc8f0', target: '#fbbf24', marker: 'rgba(255,255,255,0.35)', ring: '#2b2766' };

function Dot({ cx, cy, payload, methods }) {
  if (cx == null || cy == null) return null;
  const alt = methods.length > 1 && payload.method && payload.method !== methods[0];
  return alt ? (
    <rect x={cx - 4.5} y={cy - 4.5} width={9} height={9} rx={1.5} fill={INK.ring} stroke={INK.line} strokeWidth={2} />
  ) : (
    <circle cx={cx} cy={cy} r={4.5} fill={INK.line} stroke={INK.ring} strokeWidth={2} />
  );
}

function ChartTooltip({ active, payload, unit, decimals, methodLabels }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="glass-strong rounded-xl border border-white/15 px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <p className="font-medium text-ink-3">{fmtDateFull(p.date)}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink tabular">{fmtNum(p.value, decimals, unit)}</p>
      {p.delta !== null && <p className="text-ink-3 tabular">{fmtDelta(p.delta, decimals)} vs. anterior</p>}
      {p.method && <p className="text-ink-3">Método: {methodLabels?.[p.method] ?? p.method}</p>}
    </div>
  );
}

export function ProgressChart({ label, unit, decimals = 1, points = [], target, markers = [], methodLabels, height = 260, className }) {
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  const data = points.map((p, i) => ({
    ...p,
    t: new Date(p.date).getTime(),
    delta: i ? Number((p.value - points[i - 1].value).toFixed(decimals)) : null,
  }));
  const methods = [...new Set(points.map((p) => p.method).filter(Boolean))];

  const values = data.map((d) => d.value).concat(target ?? []);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, max * 0.01, 0.5);

  const first = data[0];
  const last = data[data.length - 1];
  const summary =
    data.length > 1
      ? `${label}: de ${fmtNum(first.value, decimals, unit)} (${fmtDate(first.date)}) a ${fmtNum(last.value, decimals, unit)} (${fmtDate(last.date)}), cambio ${fmtDelta(last.value - first.value, decimals)} ${unit}.`
      : `${label}: una sola medición.`;

  return (
    <figure className={cn('min-w-0', className)} aria-labelledby={titleId}>
      <figcaption className="mb-2 flex items-center justify-between gap-2">
        <span id={titleId} className="text-sm font-semibold text-ink">
          {label} {unit && <span className="font-normal text-ink-3">({unit})</span>}
        </span>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-3 hover:bg-white/10 hover:text-ink"
          aria-pressed={asTable}
        >
          {asTable ? <LineIcon aria-hidden className="size-3.5" /> : <Table2 aria-hidden className="size-3.5" />}
          {asTable ? 'Ver gráfica' : 'Ver tabla'}
        </button>
      </figcaption>
      <p className="sr-only">{summary}</p>

      {asTable ? (
        <div className="max-h-[320px] overflow-auto rounded-xl border border-line scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/5 text-left text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-3 py-2">Fecha</th>
                <th scope="col" className="px-3 py-2 text-right">Valor</th>
                <th scope="col" className="px-3 py-2 text-right">Cambio</th>
                {methods.length > 0 && <th scope="col" className="px-3 py-2">Método</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {[...data].reverse().map((d) => (
                <tr key={d.t}>
                  <td className="px-3 py-1.5 text-ink-2">{fmtDateFull(d.date)}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-ink tabular">{fmtNum(d.value, decimals)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-3 tabular">{fmtDelta(d.delta, decimals)}</td>
                  {methods.length > 0 && <td className="px-3 py-1.5 text-ink-3">{methodLabels?.[d.method] ?? d.method ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid stroke={INK.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                padding={{ left: 12, right: 12 }}
                tickFormatter={(t) => fmtDate(t)}
                tick={{ fill: INK.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: INK.grid }}
                minTickGap={24}
              />
              <YAxis
                domain={[min - pad, max + pad]}
                tickFormatter={(v) => fmtNum(v, decimals)}
                tick={{ fill: INK.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              {markers.map((m) => (
                <ReferenceLine key={m.date} x={new Date(m.date).getTime()} stroke={INK.marker} strokeDasharray="2 4" />
              ))}
              {target !== undefined && target !== null && (
                <ReferenceLine
                  y={target}
                  stroke={INK.target}
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{ value: `Meta ${fmtNum(target, decimals)}`, position: 'insideTopRight', fill: INK.target, fontSize: 11, fontWeight: 600 }}
                />
              )}
              <Tooltip
                content={<ChartTooltip unit={unit} decimals={decimals} methodLabels={methodLabels} />}
                cursor={{ stroke: INK.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={INK.line}
                strokeWidth={2}
                dot={<Dot methods={methods} />}
                activeDot={{ r: 6, fill: INK.line, stroke: INK.ring, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {methods.length > 1 && !asTable && (
        <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-brand-700" /> {methodLabels?.[methods[0]] ?? methods[0]}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-sm border-2 border-brand-700 bg-surface-2" /> Otro método
          </span>
          <span>· Comparar métodos distintos puede no ser equivalente.</span>
        </p>
      )}
    </figure>
  );
}
