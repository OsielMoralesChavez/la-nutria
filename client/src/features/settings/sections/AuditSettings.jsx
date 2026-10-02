import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, ErrorState, Input, LoadingState, Select } from '../../../components/ui/index.js';
import { fmtDateTime, toInputDate } from '../../../lib/format.js';
import { http } from '../../../lib/http.js';
import { qk } from '../../../lib/queryKeys.js';

const RESULT_TONE = { ok: 'green', denegado: 'amber', error: 'red' };
const RESOURCES = ['auth', 'patients', 'clinical', 'consultations', 'goals', 'appointments', 'followups', 'alerts', 'attachments', 'users', 'roles', 'settings', 'catalogs'];

/**
 * Bitácora: usuario → acción → recurso → fecha → resultado.
 * Nunca muestra valores clínicos: sólo nombres de campos modificados.
 */
export function AuditSettings() {
  const [filters, setFilters] = useState({ resource: '', result: '', from: '', page: 1 });
  const params = {
    resource: filters.resource || undefined,
    result: filters.result || undefined,
    from: filters.from ? new Date(`${filters.from}T00:00:00`) : undefined,
    page: filters.page,
    limit: 50,
  };
  const query = useQuery({ queryKey: qk.audit(params), queryFn: () => http.get('/audit-logs', params), placeholderData: keepPreviousData });
  const set = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <Card title="Auditoría" description="Accesos, cambios de permisos, modificaciones de expediente, eliminaciones y cambios administrativos.">
      <div className="mb-4 flex flex-wrap gap-2">
        <Select aria-label="Recurso" value={filters.resource} onChange={(e) => set({ resource: e.target.value })} className="h-9 w-auto">
          <option value="">Todos los recursos</option>
          {RESOURCES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Select aria-label="Resultado" value={filters.result} onChange={(e) => set({ result: e.target.value })} className="h-9 w-auto">
          <option value="">Todo resultado</option>
          <option value="ok">Correcto</option>
          <option value="denegado">Denegado</option>
          <option value="error">Error</option>
        </Select>
        <Input aria-label="Desde" type="date" max={toInputDate(new Date())} value={filters.from} onChange={(e) => set({ from: e.target.value })} className="h-9 w-auto" />
      </div>
      {query.isPending && <LoadingState rows={5} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-ink-3">
                <tr>
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Usuario</th>
                  <th className="px-2 py-2 font-medium">Acción</th>
                  <th className="px-2 py-2 font-medium">Recurso</th>
                  <th className="px-2 py-2 font-medium">Resultado</th>
                  <th className="px-2 py-2 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {query.data.data.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-2 py-2 text-ink-2 tabular">{fmtDateTime(l.at)}</td>
                    <td className="px-2 py-2 text-ink">{l.actor?.name ?? l.actorEmail ?? '—'}</td>
                    <td className="px-2 py-2 font-mono text-xs text-ink-2">{l.action}</td>
                    <td className="px-2 py-2 text-ink-2">
                      {l.resource}
                      {l.resourceId && <span className="block font-mono text-[11px] text-ink-3">{l.resourceId.slice(-8)}</span>}
                    </td>
                    <td className="px-2 py-2">
                      <Badge size="sm" tone={RESULT_TONE[l.result]}>
                        {l.result}
                      </Badge>
                    </td>
                    <td className="max-w-64 px-2 py-2 text-xs text-ink-3">
                      {l.meta?.changedFields && `Campos: ${l.meta.changedFields.join(', ')}`}
                      {l.meta?.added?.length > 0 && `+ ${l.meta.added.join(', ')} `}
                      {l.meta?.removed?.length > 0 && `− ${l.meta.removed.join(', ')}`}
                      {l.meta?.reason && `Motivo: ${l.meta.reason}`}
                      {l.meta?.required && `Requería: ${l.meta.required.join(', ')}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-ink-3">
            <span>
              {query.data.meta.total} registros · página {query.data.meta.page} de {query.data.meta.pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={filters.page <= 1} onClick={() => set({ page: filters.page - 1 })}>
                Anterior
              </Button>
              <Button size="sm" variant="secondary" iconRight={ChevronRight} disabled={filters.page >= query.data.meta.pages} onClick={() => set({ page: filters.page + 1 })}>
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
