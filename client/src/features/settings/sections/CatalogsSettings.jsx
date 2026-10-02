import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, Pencil, Plus } from 'lucide-react';
import { CATALOG_TYPES, GOAL_DIRECTION, GOAL_KIND, METRIC_CATEGORY } from '@lanutria/shared';
import { useState } from 'react';
import { Alert, Badge, Button, Card, ErrorState, Field, IconButton, Input, LoadingState, Modal, Select, Switch, Tabs, useToast } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { api } from '../../../lib/http.js';
import { useCatalog, useGoalTypes, useMetrics } from '../../catalogs/hooks.js';

const TABS = [
  { value: 'metrics', label: 'Métricas' },
  { value: 'goal-types', label: 'Tipos de objetivo' },
  ...CATALOG_TYPES.values.map((t) => ({ value: t, label: CATALOG_TYPES.labels[t] })),
];

/** Convierte una etiqueta en clave: "Báscula y cinta" → "bascula_y_cinta". */
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);

/**
 * Catálogos editables. Se DESACTIVAN en lugar de borrarse para no romper el
 * historial (una métrica o método usado en mediciones anteriores se conserva).
 */
export function CatalogsSettings() {
  const [tab, setTab] = useState('metrics');
  return (
    <Card title="Catálogos" description="Listas que usa el sistema. Lo desactivado deja de ofrecerse, pero el historial se conserva.">
      <Tabs label="Catálogos" value={tab} onChange={setTab} items={TABS} className="mb-4" />
      {tab === 'metrics' && <MetricsEditor />}
      {tab === 'goal-types' && <GoalTypesEditor />}
      {CATALOG_TYPES.values.includes(tab) && <GenericEditor key={tab} type={tab} />}
    </Card>
  );
}

function useSave(invalidateKey) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ path, id, body }) => (id ? api.patch(`${path}/${id}`, body) : api.post(path, body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      toast.success('Catálogo actualizado');
    },
    onError: (e) => toast.error(e.message),
  });
}

function ActiveSwitch({ item, onToggle }) {
  return <Switch label={item.active ? `Desactivar ${item.label}` : `Activar ${item.label}`} checked={item.active} onChange={onToggle} />;
}

// ───────── Métricas ─────────
function MetricsEditor() {
  const metrics = useMetrics(true);
  const save = useSave('metrics');
  const [edit, setEdit] = useState(null);
  if (metrics.isPending) return <LoadingState rows={4} />;
  if (metrics.isError) return <ErrorState error={metrics.error} onRetry={() => metrics.refetch()} />;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" icon={Plus} onClick={() => setEdit({})}>
          Nueva métrica
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-ink-3">
            <tr>
              <th className="px-2 py-2 font-medium">Métrica</th>
              <th className="px-2 py-2 font-medium">Unidad</th>
              <th className="px-2 py-2 font-medium">Categoría</th>
              <th className="px-2 py-2 font-medium">Rango de captura</th>
              <th className="px-2 py-2 font-medium">Activa</th>
              <th className="px-2 py-2"><span className="sr-only">Editar</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {metrics.data.map((m) => (
              <tr key={m.id} className={cn(!m.active && 'opacity-60')}>
                <td className="px-2 py-2 font-medium text-ink">
                  {m.label}
                  {m.derived && (
                    <Badge size="sm" icon={Calculator} className="ml-2">
                      Calculada
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-2 text-ink-2">{m.unit || '—'}</td>
                <td className="px-2 py-2 text-ink-2">{METRIC_CATEGORY.labels[m.category]}</td>
                <td className="px-2 py-2 text-ink-2 tabular">{m.derived ? '—' : `${m.min ?? '—'} – ${m.max ?? '—'}`}</td>
                <td className="px-2 py-2">
                  <ActiveSwitch item={m} onToggle={(active) => save.mutate({ path: '/metrics', id: m.id, body: { active } })} />
                </td>
                <td className="px-2 py-2 text-right">
                  <IconButton icon={Pencil} label={`Editar ${m.label}`} size="sm" onClick={() => setEdit(m)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-3">El rango de captura sólo detecta errores de dedo (avisa, no bloquea). No es un rango clínico.</p>
      {edit && <MetricModal metric={edit} onClose={() => setEdit(null)} save={save} />}
    </>
  );
}

function MetricModal({ metric, onClose, save }) {
  const isNew = !metric.id;
  const [f, setF] = useState({ label: metric.label ?? '', unit: metric.unit ?? '', category: metric.category ?? 'antropometria', min: metric.min ?? '', max: metric.max ?? '', decimals: metric.decimals ?? 1, order: metric.order ?? 100 });
  const n = (v) => (v === '' || v === null ? undefined : Number(v));
  const submit = () => {
    const body = metric.derived
      ? { label: f.label, order: n(f.order) }
      : { label: f.label, unit: f.unit, category: f.category, min: n(f.min) ?? (isNew ? undefined : null), max: n(f.max) ?? (isNew ? undefined : null), decimals: n(f.decimals), order: n(f.order) };
    if (isNew) body.key = slug(f.label);
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
    save.mutate({ path: '/metrics', id: metric.id, body }, { onSuccess: onClose });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nueva métrica' : `Editar ${metric.label}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={save.isPending} disabled={!f.label.trim()} onClick={submit}>Guardar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {metric.derived && <Alert tone="info" className="sm:col-span-2">Métrica calculada: su fórmula es fija. Sólo puedes cambiar el nombre y el orden.</Alert>}
        <Field label="Nombre" required>{(p) => <Input {...p} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />}</Field>
        <Field label="Orden">{(p) => <Input {...p} type="number" value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} />}</Field>
        {!metric.derived && (
          <>
            <Field label="Unidad">{(p) => <Input {...p} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="kg, cm, %, mm…" />}</Field>
            <Field label="Categoría">
              {(p) => (
                <Select {...p} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                  {METRIC_CATEGORY.values.map((c) => <option key={c} value={c}>{METRIC_CATEGORY.labels[c]}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Mínimo de captura">{(p) => <Input {...p} type="number" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />}</Field>
            <Field label="Máximo de captura">{(p) => <Input {...p} type="number" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />}</Field>
            <Field label="Decimales">{(p) => <Input {...p} type="number" min={0} max={3} value={f.decimals} onChange={(e) => setF({ ...f, decimals: e.target.value })} />}</Field>
          </>
        )}
        {isNew && f.label && <p className="text-xs text-ink-3 sm:col-span-2">Clave interna: <code>{slug(f.label)}</code></p>}
      </div>
    </Modal>
  );
}

// ───────── Tipos de objetivo ─────────
function GoalTypesEditor() {
  const types = useGoalTypes(true);
  const metrics = useMetrics();
  const save = useSave('goal-types');
  const [edit, setEdit] = useState(null);
  if (types.isPending) return <LoadingState rows={4} />;
  if (types.isError) return <ErrorState error={types.error} onRetry={() => types.refetch()} />;
  const metricLabel = Object.fromEntries((metrics.data ?? []).map((m) => [m.key, m.label]));
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" icon={Plus} onClick={() => setEdit({})}>Nuevo tipo</Button>
      </div>
      <ul className="divide-y divide-line/70">
        {types.data.map((t) => (
          <li key={t.id} className={cn('flex items-center gap-3 py-2.5', !t.active && 'opacity-60')}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.label}</p>
              <p className="text-xs text-ink-3">
                {GOAL_KIND.labels[t.kind]}
                {t.defaultMetric && ` · ${metricLabel[t.defaultMetric] ?? t.defaultMetric}`}
                {t.direction && ` · ${GOAL_DIRECTION.labels[t.direction]}`}
              </p>
            </div>
            <ActiveSwitch item={t} onToggle={(active) => save.mutate({ path: '/goal-types', id: t.id, body: { active } })} />
            <IconButton icon={Pencil} label={`Editar ${t.label}`} size="sm" onClick={() => setEdit(t)} />
          </li>
        ))}
      </ul>
      {edit && <GoalTypeModal type={edit} metrics={metrics.data ?? []} onClose={() => setEdit(null)} save={save} />}
    </>
  );
}

function GoalTypeModal({ type, metrics, onClose, save }) {
  const isNew = !type.id;
  const [f, setF] = useState({ label: type.label ?? '', kind: type.kind ?? 'metrica', defaultMetric: type.defaultMetric ?? 'peso', direction: type.direction ?? 'bajar', defaultTolerance: type.defaultTolerance ?? '' });
  const submit = () => {
    const metric = f.kind === 'metrica';
    const body = {
      label: f.label,
      defaultMetric: metric ? f.defaultMetric : null,
      direction: metric ? f.direction : null,
      ...(metric && f.direction === 'mantener' && f.defaultTolerance !== '' && { defaultTolerance: Number(f.defaultTolerance) }),
      ...(isNew && { key: slug(f.label), kind: f.kind }),
    };
    save.mutate({ path: '/goal-types', id: type.id, body }, { onSuccess: onClose });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nuevo tipo de objetivo' : `Editar ${type.label}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={save.isPending} disabled={!f.label.trim()} onClick={submit}>Guardar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required className="sm:col-span-2">{(p) => <Input {...p} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />}</Field>
        <Field label="Clase" hint={isNew ? undefined : 'No se puede cambiar después de crearlo.'}>
          {(p) => (
            <Select {...p} disabled={!isNew} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {GOAL_KIND.values.map((k) => <option key={k} value={k}>{GOAL_KIND.labels[k]}</option>)}
            </Select>
          )}
        </Field>
        {f.kind === 'metrica' && (
          <>
            <Field label="Métrica por defecto">
              {(p) => (
                <Select {...p} value={f.defaultMetric} onChange={(e) => setF({ ...f, defaultMetric: e.target.value })}>
                  {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Dirección">
              {(p) => (
                <Select {...p} value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}>
                  {GOAL_DIRECTION.values.map((d) => <option key={d} value={d}>{GOAL_DIRECTION.labels[d]}</option>)}
                </Select>
              )}
            </Field>
            {f.direction === 'mantener' && (
              <Field label="Tolerancia por defecto (±)">{(p) => <Input {...p} type="number" min={0} step="0.1" value={f.defaultTolerance} onChange={(e) => setF({ ...f, defaultTolerance: e.target.value })} />}</Field>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ───────── Listas simples ─────────
function GenericEditor({ type }) {
  const items = useCatalog(type, true);
  const save = useSave('catalogs');
  const [edit, setEdit] = useState(null);
  const withDuration = type === 'appointment_type';
  if (items.isPending) return <LoadingState rows={3} />;
  if (items.isError) return <ErrorState error={items.error} onRetry={() => items.refetch()} />;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" icon={Plus} onClick={() => setEdit({})}>Agregar</Button>
      </div>
      {items.data.length === 0 && <p className="py-4 text-center text-sm text-ink-3">Sin elementos todavía.</p>}
      <ul className="divide-y divide-line/70">
        {items.data.map((c) => (
          <li key={c.id} className={cn('flex items-center gap-3 py-2.5', !c.active && 'opacity-60')}>
            <span className="min-w-0 flex-1 text-sm font-medium text-ink">
              {c.label}
              {withDuration && c.meta?.durationMin && <span className="ml-2 text-xs font-normal text-ink-3">{c.meta.durationMin} min</span>}
            </span>
            <ActiveSwitch item={c} onToggle={(active) => save.mutate({ path: '/catalogs', id: c.id, body: { active } })} />
            <IconButton icon={Pencil} label={`Editar ${c.label}`} size="sm" onClick={() => setEdit(c)} />
          </li>
        ))}
      </ul>
      {edit && (
        <CatalogItemModal
          item={edit}
          type={type}
          withDuration={withDuration}
          onClose={() => setEdit(null)}
          save={save}
        />
      )}
    </>
  );
}

function CatalogItemModal({ item, type, withDuration, onClose, save }) {
  const isNew = !item.id;
  const [label, setLabel] = useState(item.label ?? '');
  const [duration, setDuration] = useState(item.meta?.durationMin ?? 45);
  const submit = () => {
    const body = {
      label,
      ...(withDuration && { meta: { ...(item.meta ?? {}), durationMin: Number(duration) } }),
      ...(isNew && { type, key: slug(label) }),
    };
    save.mutate({ path: '/catalogs', id: item.id, body }, { onSuccess: onClose });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? `Agregar a ${CATALOG_TYPES.labels[type]}` : `Editar ${item.label}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={save.isPending} disabled={!label.trim()} onClick={submit}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" required>{(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} data-autofocus />}</Field>
        {withDuration && <Field label="Duración (min)">{(p) => <Input {...p} type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>}
      </div>
    </Modal>
  );
}
