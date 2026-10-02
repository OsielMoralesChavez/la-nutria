import { useInfiniteQuery } from '@tanstack/react-query';
import { CalendarX, FileText, Flag, History, ListChecks, NotebookPen, Paperclip, Stethoscope, Target, UserCog } from 'lucide-react';
import { CLINICAL_SECTIONS, TIMELINE_TYPES } from '@lanutria/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, EmptyState, ErrorState, LoadingState } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { fmtDateFull, fmtDelta, fmtNum } from '../../../lib/format.js';
import { http } from '../../../lib/http.js';
import { qk } from '../../../lib/queryKeys.js';
import { useMetricMap } from '../../catalogs/hooks.js';

const ICONS = { consulta: Stethoscope, medicion: ListChecks, objetivo: Target, expediente: NotebookPen, cita: CalendarX, archivo: Paperclip, estado: UserCog };
const SECTION_LABEL = Object.fromEntries(CLINICAL_SECTIONS.map((s) => [s.key, s.label]));
const SUMMARY_METRICS = ['peso', 'grasa_pct', 'cintura', 'imc', 'masa_muscular'];

/**
 * ② ¿Qué se hizo? — línea de tiempo. Lo ocurrido dentro de una consulta
 * (mediciones, objetivos, cambios de expediente, archivos) se agrupa en ella.
 * El hito INICIO siempre queda como ancla al final.
 */
export function Timeline({ patientId, limit = 15, filterable = true, compact = false }) {
  const [types, setTypes] = useState([]);
  const metricMap = useMetricMap();
  const query = useInfiniteQuery({
    queryKey: qk.patientTimeline(patientId, types.join(',')),
    // http (no api) porque se necesita meta.nextCursor
    queryFn: ({ pageParam }) => http.get(`/patients/${patientId}/timeline`, { limit, before: pageParam, types: types.join(',') || undefined }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });

  const toggle = (t) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const events = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div>
      {filterable && (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar eventos">
          {TIMELINE_TYPES.values.map((t) => {
            const Icon = ICONS[t];
            const on = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                  on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink-3 hover:text-ink',
                )}
              >
                <Icon aria-hidden className="size-3.5" />
                {TIMELINE_TYPES.labels[t]}
              </button>
            );
          })}
        </div>
      )}

      {query.isPending && <LoadingState rows={4} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.isSuccess && events.length === 0 && (
        <EmptyState compact icon={History} title="Sin eventos" description={types.length ? 'No hay eventos de este tipo.' : 'La historia del paciente aparecerá aquí conforme se registren consultas.'} />
      )}

      <ol className="relative space-y-1">
        {events.map((e, i) => {
          const Icon = e.isStart ? Flag : ICONS[e.type] ?? FileText;
          const isLast = i === events.length - 1 && !query.hasNextPage;
          return (
            <li key={e.id} className="relative flex gap-3 pb-4">
              {!isLast && <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-line" />}
              <span
                className={cn(
                  'relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-white',
                  e.isStart ? 'bg-brand-700 text-white' : e.type === 'consulta' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-ink-3',
                )}
              >
                <Icon aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <time className="text-xs font-medium text-ink-3 tabular" dateTime={e.date}>
                    {fmtDateFull(e.date)}
                  </time>
                  <span className={cn('text-sm font-semibold', e.isStart ? 'text-brand-800' : 'text-ink')}>
                    {e.isStart ? 'INICIO · ' : ''}
                    {e.title}
                  </span>
                  {e.actor && <span className="text-xs text-ink-3">· {e.actor}</span>}
                </div>

                {e.type === 'consulta' && (
                  <div className="mt-1 space-y-1.5">
                    {e.changes?.length > 0 && (
                      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2 tabular">
                        {e.changes
                          .filter((c) => SUMMARY_METRICS.includes(c.metric))
                          .map((c) => (
                            <span key={c.metric}>
                              {metricMap[c.metric]?.label ?? c.metric} <strong className="font-semibold text-ink">{fmtNum(c.value, metricMap[c.metric]?.decimals)}</strong>
                              {c.delta !== null && c.delta !== undefined && <span className="text-ink-3"> ({fmtDelta(c.delta, metricMap[c.metric]?.decimals)})</span>}
                            </span>
                          ))}
                      </p>
                    )}
                    {!compact && e.excerpt && <p className="line-clamp-2 text-sm text-ink-2">“{e.excerpt}”</p>}
                    {!compact && (
                      <div className="flex flex-wrap gap-1.5">
                        {e.goalsCreated?.map((g) => (
                          <Badge key={g.id} tone="sky" size="sm" icon={Target}>
                            Nuevo objetivo: {g.title}
                          </Badge>
                        ))}
                        {e.clinicalChanges?.length > 0 && (
                          <Badge tone="violet" size="sm" icon={NotebookPen}>
                            Expediente: {e.clinicalChanges.map((k) => SECTION_LABEL[k]?.split(' ')[0] ?? k).join(', ')}
                          </Badge>
                        )}
                        {e.attachments?.map((f) => (
                          <Badge key={f.id} size="sm" icon={Paperclip}>
                            {f.name ?? (f.kind === 'foto' ? 'Fotografía' : 'Documento')}
                          </Badge>
                        ))}
                        {e.addenda > 0 && <Badge size="sm">{e.addenda} adenda{e.addenda > 1 ? 's' : ''}</Badge>}
                      </div>
                    )}
                    <Link to={`/pacientes/${patientId}/intervenciones/consultas/${e.consultationId}`} className="inline-block text-xs font-medium text-brand-700 hover:underline">
                      Ver consulta
                    </Link>
                  </div>
                )}
                {e.type === 'expediente' && e.changedFields?.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-3">Secciones: {e.changedFields.map((k) => SECTION_LABEL[k] ?? k).join(', ')}</p>
                )}
                {e.type === 'estado' && e.reason && <p className="mt-0.5 text-xs text-ink-3">Motivo: {e.reason}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {query.hasNextPage && (
        <Button variant="secondary" size="sm" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
          Cargar anteriores
        </Button>
      )}
    </div>
  );
}
