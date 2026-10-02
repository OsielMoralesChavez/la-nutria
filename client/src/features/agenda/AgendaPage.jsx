import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button, EmptyState, ErrorState, IconButton, PageHeader, SegmentedControl, Select, StatusBadge } from '../../components/ui/index.js';
import { cn } from '../../lib/cn.js';
import { addDays, fmtDateLong, fmtTimeOf, fullName, isSameDay, startOfDay } from '../../lib/format.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useLabels, useNutritionists, useSettings } from '../catalogs/hooks.js';
import { AppointmentDrawer } from './components/AppointmentDrawer.jsx';
import { AppointmentFormModal } from './components/AppointmentFormModal.jsx';
import { useAppointments } from './hooks.js';

const HOUR_PX = 56;
const STATUS_STYLE = {
  programada: 'border-dashed border-white/35 bg-surface-2 text-ink',
  confirmada: 'border-brand-600 bg-brand-50 text-accent',
  realizada: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200 opacity-80',
  cancelada: 'border-white/20 bg-white/5 text-ink-3 line-through opacity-60',
  no_asistio: 'border-amber-300/30 bg-amber-400/15 text-amber-200',
};

const startOfWeek = (d) => {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // lunes = 0
  return addDays(x, -day);
};

/**
 * AGENDA. Vista día (por defecto en tablet/móvil), semana (escritorio) y lista.
 * Clic en un hueco = nueva cita con la hora prellenada.
 */
export function AgendaPage() {
  const { user, can } = useAuth();
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const nutritionists = useNutritionists();
  const types = useLabels('appointment_type');
  const isNarrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
  const [view, setView] = useState(isNarrow ? 'dia' : user?.preferences?.defaultAgendaView ?? 'semana');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [who, setWho] = useState(user.id);
  const [newAt, setNewAt] = useState(null);

  const range = useMemo(() => {
    if (view === 'dia') return { from: cursor, to: addDays(cursor, 1) };
    if (view === 'semana') {
      const s = startOfWeek(cursor);
      return { from: s, to: addDays(s, 7) };
    }
    return { from: cursor, to: addDays(cursor, 14) };
  }, [view, cursor]);

  const query = useAppointments({ from: range.from, to: range.to, nutritionist: who || undefined });
  const hours = settings.data?.clinic?.openingHours ?? { start: '08:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] };
  const openH = Number(hours.start.split(':')[0]);
  const closeH = Math.ceil(Number(hours.end.split(':')[0]) + Number(hours.end.split(':')[1]) / 60);

  const step = view === 'semana' ? 7 : view === 'lista' ? 14 : 1;
  const days =
    view === 'semana'
      ? Array.from({ length: 7 }, (_, i) => addDays(range.from, i)).filter((d) => hours.days.includes(d.getDay()))
      : [cursor];

  const showNew = params.get('nueva') === '1';
  const selectedId = params.get('cita');
  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const title = view === 'semana' ? `Semana del ${range.from.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}` : fmtDateLong(cursor);

  return (
    <div>
      <PageHeader
        title="Agenda"
        description={<span className="">{title}</span>}
        actions={
          can('appointments:create') && (
            <Button icon={Plus} onClick={() => setParam('nueva', '1')}>
              Nueva cita
            </Button>
          )
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="Anterior" size="sm" variant="secondary" onClick={() => setCursor((c) => addDays(c, -step))} />
          <Button size="sm" variant="secondary" onClick={() => setCursor(startOfDay(new Date()))}>
            Hoy
          </Button>
          <IconButton icon={ChevronRight} label="Siguiente" size="sm" variant="secondary" onClick={() => setCursor((c) => addDays(c, step))} />
        </div>
        <SegmentedControl
          size="sm"
          label="Vista"
          value={view}
          onChange={setView}
          options={[
            { value: 'dia', label: 'Día' },
            { value: 'semana', label: 'Semana' },
            { value: 'lista', label: 'Lista' },
          ]}
        />
        <Select aria-label="Nutriólogo" value={who} onChange={(e) => setWho(e.target.value)} className="ml-auto h-9 w-auto min-w-44">
          <option value="">Todo el consultorio</option>
          {nutritionists.data?.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
              {n.id === user.id ? ' (yo)' : ''}
            </option>
          ))}
        </Select>
      </div>

      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {view === 'lista' ? (
        <ListView items={query.data ?? []} loading={query.isPending} types={types} onOpen={(id) => setParam('cita', id)} />
      ) : (
        <div className={cn('card overflow-hidden', query.isFetching && 'opacity-80')}>
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[640px]" style={view === 'dia' ? { minWidth: 0 } : undefined}>
              <div className="grid border-b border-line bg-white/5" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
                <span />
                {days.map((d) => (
                  <div key={d.toISOString()} className={cn('px-2 py-2 text-center text-xs font-medium', isSameDay(d, new Date()) ? 'text-accent' : 'text-ink-3')}>
                    <span className="">{d.toLocaleDateString('es-MX', { weekday: 'short' })}</span>{' '}
                    <span className={cn('inline-grid size-6 place-items-center rounded-full tabular', isSameDay(d, new Date()) && 'bg-brand-700 text-white')}>{d.getDate()}</span>
                  </div>
                ))}
              </div>
              <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
                <div>
                  {Array.from({ length: closeH - openH }, (_, i) => (
                    <div key={i} style={{ height: HOUR_PX }} className="border-b border-line/60 pr-2 pt-1 text-right text-[11px] text-ink-3 tabular">
                      {String(openH + i).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>
                {days.map((d) => (
                  <DayColumn
                    key={d.toISOString()}
                    day={d}
                    openH={openH}
                    closeH={closeH}
                    items={(query.data ?? []).filter((a) => isSameDay(a.start, d))}
                    types={types}
                    showWho={!who}
                    onOpen={(id) => setParam('cita', id)}
                    onNew={can('appointments:create') ? (date) => setNewAt(date) : null}
                  />
                ))}
              </div>
            </div>
          </div>
          {query.isSuccess && query.data.length === 0 && (
            <p className="border-t border-line/70 px-4 py-3 text-center text-sm text-ink-3">Sin citas en este periodo. Haz clic en un horario para agendar.</p>
          )}
        </div>
      )}

      {(showNew || newAt) && (
        <AppointmentFormModal
          open
          initialStart={newAt}
          initialPatientId={params.get('paciente') ?? undefined}
          initialNutritionist={who || undefined}
          onClose={(created) => {
            setNewAt(null);
            const next = new URLSearchParams(params);
            next.delete('nueva');
            next.delete('paciente');
            if (created) {
              setCursor(startOfDay(created.start));
              next.set('cita', created.id);
            }
            setParams(next, { replace: true });
          }}
        />
      )}
      <AppointmentDrawer id={selectedId} onClose={(nextId) => setParam('cita', typeof nextId === 'string' ? nextId : null)} />
    </div>
  );
}

function DayColumn({ day, openH, closeH, items, types, showWho, onOpen, onNew }) {
  const now = new Date();
  const nowTop = isSameDay(day, now) ? ((now.getHours() + now.getMinutes() / 60 - openH) * HOUR_PX) : null;
  return (
    <div className="relative border-l border-line/60">
      {Array.from({ length: closeH - openH }, (_, i) => (
        <div key={i} style={{ height: HOUR_PX }} className="border-b border-line/60">
          {[0, 30].map((m) => {
            const slot = new Date(day);
            slot.setHours(openH + i, m, 0, 0);
            const past = slot < now;
            return onNew && !past ? (
              <button
                key={m}
                type="button"
                aria-label={`Agendar ${slot.toLocaleString('es-MX', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}`}
                onClick={() => onNew(slot)}
                className="block h-1/2 w-full transition-colors hover:bg-brand-50/70 focus-visible:bg-brand-50"
              />
            ) : (
              <span key={m} className={cn('block h-1/2', past && 'bg-white/5')} />
            );
          })}
        </div>
      ))}
      {nowTop !== null && nowTop >= 0 && nowTop <= (closeH - openH) * HOUR_PX && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-500" style={{ top: nowTop }}>
          <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-red-500" />
        </span>
      )}
      {items.map((a) => {
        const s = new Date(a.start);
        const e = new Date(a.end);
        const top = (s.getHours() + s.getMinutes() / 60 - openH) * HOUR_PX;
        const height = Math.max(26, ((e - s) / 3_600_000) * HOUR_PX - 2);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onOpen(a.id)}
            style={{ top: top + 1, height }}
            className={cn('absolute inset-x-1 z-[5] overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm transition-shadow hover:shadow-md', STATUS_STYLE[a.status])}
          >
            <span className="block truncate font-semibold">{fullName(a.patient)}</span>
            <span className="block truncate opacity-80">
              {fmtTimeOf(a.start)} · {types[a.type] ?? 'Cita'}
              {showWho && a.nutritionist?.name ? ` · ${a.nutritionist.name.split(' ')[0]}` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ListView({ items, loading, types, onOpen }) {
  if (loading) return <div className="card h-40 animate-pulse" />;
  if (!items.length) return <div className="card"><EmptyState icon={CalendarDays} title="Sin citas en las próximas dos semanas" /></div>;
  const groups = items.reduce((acc, a) => {
    const k = startOfDay(a.start).toISOString();
    (acc[k] ??= []).push(a);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([day, list]) => (
        <section key={day} className="card">
          <h2 className="border-b border-line/70 px-4 py-2.5 text-sm font-semibold text-ink">{fmtDateLong(day)}</h2>
          <ul className="divide-y divide-line/70">
            {list.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(a.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.06]">
                  <span className="w-12 text-sm font-semibold text-ink tabular">{fmtTimeOf(a.start)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{fullName(a.patient)}</span>
                    <span className="block text-xs text-ink-3">
                      {types[a.type] ?? 'Cita'} · {a.nutritionist?.name}
                    </span>
                  </span>
                  <StatusBadge kind="appointment" status={a.status} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
