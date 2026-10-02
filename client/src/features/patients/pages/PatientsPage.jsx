import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Search, Stethoscope, UserPlus, Users, X } from 'lucide-react';
import { PATIENT_STATUS } from '@lanutria/shared';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Avatar, Badge, Button, EmptyState, ErrorState, IconButton, Input, LoadingState, PageHeader, Select, Sparkline, StatusBadge } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { fmtDate, fmtDelta, fmtRelative } from '../../../lib/format.js';
import { api } from '../../../lib/http.js';
import { qk } from '../../../lib/queryKeys.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useNutritionists } from '../../catalogs/hooks.js';
import { useStartConsultation } from '../../consultations/hooks.js';
import { PatientFormModal } from '../components/PatientFormModal.jsx';
import { usePatients } from '../hooks.js';

const PAGE_SIZE = 20;
const FILTER_KEYS = ['q', 'status', 'responsible', 'withAlerts', 'newDays', 'noRecentDays', 'sort', 'page', 'archived'];

/** Vistas rápidas: combinaciones de filtros frecuentes. */
const VIEWS = [
  { id: 'todos', label: 'Todos', params: {} },
  { id: 'mis-activos', label: 'Mis activos', params: { responsible: 'me', status: 'activo' } },
  { id: 'alertas', label: 'Con alertas', params: { withAlerts: 'true' } },
  { id: 'recientes', label: 'Atendidos recientemente', params: { sort: 'recent' } },
];

export function PatientsPage() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const nutritionists = useNutritionists();
  const rules = useQuery({ queryKey: qk.alertRules(), queryFn: () => api.get('/alert-rules'), staleTime: 5 * 60_000 });
  const inactiveRule = rules.data?.find((r) => r.key === 'patient_inactive' && r.enabled);

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? undefined]));
  const query = usePatients({ ...filters, page: filters.page ?? 1, limit: PAGE_SIZE });

  const setFilter = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Búsqueda con debounce (300 ms); el término vive en la URL (compartible).
  useEffect(() => {
    const t = setTimeout(() => term !== (params.get('q') ?? '') && setFilter({ q: term.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const activeView = VIEWS.find((v) => {
    const keys = FILTER_KEYS.filter((k) => k !== 'page' && k !== 'q');
    return keys.every((k) => (v.params[k] ?? undefined) === filters[k]);
  });
  const hasFilters = FILTER_KEYS.some((k) => k !== 'page' && filters[k]);
  const showNew = params.get('nuevo') === '1';

  return (
    <div>
      <PageHeader
        title="Pacientes"
        description={query.data ? `${query.data.meta.total} paciente${query.data.meta.total === 1 ? '' : 's'}${hasFilters ? ' con estos filtros' : ''}` : undefined}
        actions={
          can('patients:create') && (
            <Button icon={UserPlus} onClick={() => setFilter({ nuevo: '1' })}>
              Nuevo paciente
            </Button>
          )
        }
      />

      <div className="card mb-4 space-y-3 p-3 sm:p-4">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre, teléfono o correo…"
            aria-label="Buscar pacientes"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Estado" value={filters.status ?? ''} onChange={(e) => setFilter({ status: e.target.value })} className="h-9 w-auto min-w-36">
            <option value="">Todos los estados</option>
            {PATIENT_STATUS.values.map((s) => (
              <option key={s} value={s}>
                {PATIENT_STATUS.labels[s]}
              </option>
            ))}
          </Select>
          <Select aria-label="Responsable" value={filters.responsible ?? ''} onChange={(e) => setFilter({ responsible: e.target.value })} className="h-9 w-auto min-w-40">
            <option value="">Cualquier responsable</option>
            <option value="me">Mis pacientes</option>
            {nutritionists.data?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Select>
          <FilterChip active={filters.withAlerts === 'true'} onClick={() => setFilter({ withAlerts: filters.withAlerts ? undefined : 'true' })} icon={AlertTriangle}>
            Con alertas
          </FilterChip>
          {inactiveRule && (
            <FilterChip
              active={Boolean(filters.noRecentDays)}
              onClick={() => setFilter({ noRecentDays: filters.noRecentDays ? undefined : String(inactiveRule.params.days) })}
            >
              Sin consulta en {inactiveRule.params.days} días
            </FilterChip>
          )}
          {filters.newDays && (
            <FilterChip active onClick={() => setFilter({ newDays: undefined })}>
              Nuevos ({filters.newDays} días) <X aria-hidden className="size-3.5" />
            </FilterChip>
          )}
          <Select aria-label="Ordenar" value={filters.sort ?? 'name'} onChange={(e) => setFilter({ sort: e.target.value === 'name' ? undefined : e.target.value })} className="ml-auto h-9 w-auto">
            <option value="name">Orden: nombre</option>
            <option value="recent">Orden: última consulta</option>
            <option value="next">Orden: próxima cita</option>
            <option value="created">Orden: registro reciente</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm" role="group" aria-label="Vistas rápidas">
          <span className="mr-1 text-xs text-ink-3">Vistas:</span>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={activeView?.id === v.id}
              onClick={() => setParams(new URLSearchParams({ ...v.params, ...(filters.q && { q: filters.q }) }), { replace: true })}
              className={cn('rounded-lg px-2.5 py-1 font-medium', activeView?.id === v.id ? 'bg-brand-700/10 text-accent' : 'text-ink-3 hover:bg-white/10 hover:text-ink')}
            >
              {v.label}
            </button>
          ))}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                setParams(new URLSearchParams(), { replace: true });
              }}
              className="ml-auto text-xs font-medium text-accent hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {query.isPending && (
        <div className="card p-5">
          <LoadingState rows={6} />
        </div>
      )}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <div className="card">
          {hasFilters ? (
            <EmptyState
              icon={Search}
              title={filters.q ? `Ningún paciente coincide con “${filters.q}”` : 'Ningún paciente con estos filtros'}
              action={
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => (setTerm(''), setParams(new URLSearchParams(), { replace: true }))}>
                    Limpiar filtros
                  </Button>
                  {can('patients:create') && <Button icon={UserPlus} onClick={() => setFilter({ nuevo: '1' })}>Registrar paciente</Button>}
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Aún no hay pacientes"
              description="Registra al primero para comenzar su expediente."
              action={can('patients:create') && <Button icon={UserPlus} onClick={() => setFilter({ nuevo: '1' })}>Registrar el primero</Button>}
            />
          )}
        </div>
      )}
      {query.data && query.data.items.length > 0 && (
        <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')}>
          <PatientTable patients={query.data.items} />
          <PatientCards patients={query.data.items} />
          <Pagination meta={query.data.meta} onPage={(page) => setFilter({ page: String(page) })} />
        </div>
      )}

      <PatientFormModal open={showNew} onClose={() => setFilter({ nuevo: undefined })} />
    </div>
  );
}

function FilterChip({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
        active ? 'border-brand-600 bg-brand-50 text-accent' : 'border-line bg-surface-2 text-ink-2 hover:border-white/20',
      )}
    >
      {Icon && <Icon aria-hidden className="size-4" />}
      {children}
    </button>
  );
}

/** Tendencia: minigráfica de peso + cambio desde el inicio (responde "¿cómo va?" sin abrir la ficha). */
function Trend({ trend }) {
  if (!trend || trend.points.length < 2) return <span className="text-xs text-ink-3">Sin datos</span>;
  const delta = trend.last - trend.first;
  return (
    <span className="inline-flex items-center gap-2">
      <Sparkline points={trend.points} />
      <span className="text-xs font-medium text-ink-2 tabular" title="Cambio de peso desde la primera medición">
        {fmtDelta(delta)} kg
      </span>
    </span>
  );
}

function RowActions({ patient, className }) {
  const { can } = useAuth();
  const start = useStartConsultation();
  return (
    <div className={cn('flex items-center justify-end gap-1', className)}>
      {can('consultations:create') && patient.status !== 'alta' && (
        <IconButton icon={Stethoscope} label={`Iniciar consulta con ${patient.fullName}`} size="sm" onClick={() => start.mutate({ patientId: patient.id })} />
      )}
      {can('appointments:create') && (
        <Link
          to={`/agenda?nueva=1&paciente=${patient.id}`}
          aria-label={`Agendar cita para ${patient.fullName}`}
          title="Agendar cita"
          className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-white/10"
        >
          <CalendarPlus aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  );
}

function PatientTable({ patients }) {
  return (
    <div className="card hidden overflow-hidden md:block">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-white/5 text-left text-xs font-medium text-ink-3">
          <tr>
            <th scope="col" className="px-4 py-2.5">Paciente</th>
            <th scope="col" className="px-3 py-2.5">Estado</th>
            <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Responsable</th>
            <th scope="col" className="px-3 py-2.5">Última consulta</th>
            <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Próxima cita</th>
            <th scope="col" className="px-3 py-2.5">Tendencia (peso)</th>
            <th scope="col" className="px-3 py-2.5"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {patients.map((p) => (
            <tr key={p.id} className="group transition-colors hover:bg-brand-50/40">
              <td className="px-4 py-2.5">
                <Link to={`/pacientes/${p.id}`} className="flex items-center gap-3 rounded-lg">
                  <Avatar name={p.fullName} size="sm" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-ink group-hover:text-accent">
                      {p.fullName}
                      {p.openAlerts > 0 && (
                        <AlertTriangle aria-label={`${p.openAlerts} alertas`} className="size-3.5 text-amber-300" />
                      )}
                    </span>
                    <span className="block text-xs text-ink-3">
                      {p.age} años{p.tags?.length ? ` · ${p.tags.join(', ')}` : ''}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge kind="patient" status={p.status} size="sm" />
              </td>
              <td className="hidden px-3 py-2.5 text-ink-2 xl:table-cell">{p.primaryNutritionist?.name}</td>
              <td className="px-3 py-2.5 text-ink-2">{p.lastConsultationAt ? fmtRelative(p.lastConsultationAt) : <Badge size="sm">Sin consultas</Badge>}</td>
              <td className="hidden px-3 py-2.5 text-ink-2 lg:table-cell">{p.nextAppointmentAt ? fmtDate(p.nextAppointmentAt) : '—'}</td>
              <td className="px-3 py-2.5">
                <Trend trend={p.trend} />
              </td>
              <td className="px-3 py-2.5">
                <RowActions patient={p} className="opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PatientCards({ patients }) {
  return (
    <ul className="space-y-2 md:hidden">
      {patients.map((p) => (
        <li key={p.id} className="card flex items-center gap-3 p-3">
          <Link to={`/pacientes/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={p.fullName} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate font-medium text-ink">
                {p.fullName}
                {p.openAlerts > 0 && <AlertTriangle aria-label="Con alertas" className="size-3.5 shrink-0 text-amber-300" />}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                <StatusBadge kind="patient" status={p.status} size="sm" />
                {p.nextAppointmentAt ? `Cita ${fmtDate(p.nextAppointmentAt)}` : p.lastConsultationAt ? `Última ${fmtRelative(p.lastConsultationAt)}` : 'Sin consultas'}
              </span>
            </span>
            <span className="max-[380px]:hidden">
              <Trend trend={p.trend} />
            </span>
          </Link>
          <RowActions patient={p} />
        </li>
      ))}
    </ul>
  );
}

function Pagination({ meta, onPage }) {
  if (meta.pages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm text-ink-3">
      <span>
        Página {meta.page} de {meta.pages}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          Anterior
        </Button>
        <Button size="sm" variant="secondary" iconRight={ChevronRight} disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
