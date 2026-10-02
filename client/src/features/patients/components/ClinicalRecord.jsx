import { useQuery } from '@tanstack/react-query';
import { History, NotebookPen, Pencil, Save } from 'lucide-react';
import { CLINICAL_SECTIONS } from '@lanutria/shared';
import { useState } from 'react';
import { Alert, Button, Drawer, EmptyState, ErrorState, Field, LoadingState, Textarea, useToast } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { fmtDateTime } from '../../../lib/format.js';
import { api } from '../../../lib/http.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useClinicalRecord, useRevisions, useUpdateClinical } from '../hooks.js';

/**
 * Historia clínica por secciones (todas opcionales). Cada edición genera una
 * revisión: se puede ver qué decía antes, quién lo cambió y cuándo.
 */
export function ClinicalRecord({ patientId, readOnly }) {
  const { can } = useAuth();
  const record = useClinicalRecord(patientId);
  const update = useUpdateClinical(patientId);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [history, setHistory] = useState(false);

  if (record.isPending) return <LoadingState rows={3} />;
  if (record.isError) return <ErrorState error={record.error} onRetry={() => record.refetch()} />;
  const sections = record.data.sections ?? {};
  const filled = CLINICAL_SECTIONS.filter((s) => sections[s.key]);

  const startEdit = () => {
    setDraft(Object.fromEntries(CLINICAL_SECTIONS.map((s) => [s.key, sections[s.key] ?? ''])));
    setEditing(true);
  };
  const save = () => {
    const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => (sections[k] ?? '') !== v));
    if (!Object.keys(changed).length) {
      setEditing(false);
      return;
    }
    update.mutate(changed, {
      onSuccess: () => {
        toast.success('Expediente actualizado (se guardó una nueva versión)');
        setEditing(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-3">
          {record.data.version
            ? `Versión ${record.data.version} · actualizado ${fmtDateTime(record.data.updatedAt)}${record.data.updatedBy?.name ? ` por ${record.data.updatedBy.name}` : ''}`
            : 'Sin datos registrados'}
        </p>
        <div className="flex gap-2">
          {record.data.version > 0 && (
            <Button size="sm" variant="ghost" icon={History} onClick={() => setHistory(true)}>
              Ver cambios
            </Button>
          )}
          {can('clinical:update') && !readOnly && !editing && (
            <Button size="sm" variant="secondary" icon={Pencil} onClick={startEdit}>
              Editar
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-4">
          <Alert tone="info">Cada sección es opcional. Al guardar se conserva la versión anterior.</Alert>
          {CLINICAL_SECTIONS.map((s) => (
            <Field key={s.key} label={s.label}>
              {(p) => <Textarea {...p} rows={2} value={draft[s.key]} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />}
            </Field>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button icon={Save} loading={update.isPending} onClick={save}>
              Guardar versión
            </Button>
          </div>
        </div>
      ) : filled.length === 0 ? (
        <EmptyState
          compact
          icon={NotebookPen}
          title="Historia clínica vacía"
          description="Se completa en la consulta inicial o desde aquí."
          action={can('clinical:update') && !readOnly && <Button size="sm" variant="secondary" onClick={startEdit}>Completar ahora</Button>}
        />
      ) : (
        <dl className="divide-y divide-line/70">
          {filled.map((s) => (
            <div key={s.key} className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="text-sm text-ink-3">{s.label}</dt>
              <dd className="whitespace-pre-line text-sm text-ink">{sections[s.key]}</dd>
            </div>
          ))}
        </dl>
      )}

      <RevisionsDrawer open={history} onClose={() => setHistory(false)} patientId={patientId} current={sections} />
    </div>
  );
}

function RevisionsDrawer({ open, onClose, patientId, current }) {
  const revisions = useRevisions(patientId, open);
  const [version, setVersion] = useState(null);
  const selected = useQuery({
    queryKey: ['patient', patientId, 'revision', version],
    queryFn: () => api.get(`/patients/${patientId}/clinical-record/revisions/${version}`),
    enabled: Boolean(version),
  });
  const prev = useQuery({
    queryKey: ['patient', patientId, 'revision', version - 1],
    queryFn: () => api.get(`/patients/${patientId}/clinical-record/revisions/${version - 1}`),
    enabled: Boolean(version && version > 1),
  });

  return (
    <Drawer open={open} onClose={onClose} title="Historial del expediente" width="sm:w-[560px]">
      {revisions.isPending && <LoadingState rows={3} />}
      <ol className="space-y-1">
        {revisions.data?.map((r) => (
          <li key={r.version}>
            <button
              type="button"
              onClick={() => setVersion(r.version === version ? null : r.version)}
              aria-expanded={r.version === version}
              className={cn('w-full rounded-xl px-3 py-2 text-left text-sm transition-colors', r.version === version ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-900/[0.03]')}
            >
              <span className="font-semibold text-ink">Versión {r.version}</span>
              <span className="text-ink-3"> · {fmtDateTime(r.createdAt)} · {r.changedBy?.name}</span>
              <span className="block text-xs text-ink-3">
                Cambió: {r.changedFields.map((k) => CLINICAL_SECTIONS.find((s) => s.key === k)?.label ?? k).join(', ')}
              </span>
            </button>
            {r.version === version && selected.data && (
              <div className="mt-2 space-y-3 rounded-xl border border-line bg-white p-3">
                {r.changedFields.map((k) => (
                  <div key={k}>
                    <p className="text-xs font-semibold text-ink-2">{CLINICAL_SECTIONS.find((s) => s.key === k)?.label}</p>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-red-50/70 p-2 text-xs text-red-950">
                        <p className="mb-0.5 font-medium text-red-800">Antes</p>
                        <p className="whitespace-pre-line">{(version > 1 ? prev.data?.sections?.[k] : '') || <em className="opacity-70">(vacío)</em>}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50/70 p-2 text-xs text-emerald-950">
                        <p className="mb-0.5 font-medium text-emerald-800">Después</p>
                        <p className="whitespace-pre-line">{selected.data.sections?.[k] || <em className="opacity-70">(vacío)</em>}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {current && <p className="text-[11px] text-ink-3">Comparación entre la versión {version} y la anterior.</p>}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Drawer>
  );
}
