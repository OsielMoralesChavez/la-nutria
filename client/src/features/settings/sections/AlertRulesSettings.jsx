import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Play, Save } from 'lucide-react';
import { ALERT_SEVERITY } from '@lanutria/shared';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, ErrorState, Field, Input, LoadingState, Select, Switch, useToast } from '../../../components/ui/index.js';
import { api } from '../../../lib/http.js';
import { qk } from '../../../lib/queryKeys.js';

/**
 * Reglas de alerta operativas. Sin umbrales clínicos fijos: cada consultorio
 * decide qué activar y con qué valores. "Vista previa" calcula cuántas
 * alertas generaría hoy sin guardar nada.
 */
export function AlertRulesSettings() {
  const rules = useQuery({ queryKey: qk.alertRules(), queryFn: () => api.get('/alert-rules') });
  const qc = useQueryClient();
  const toast = useToast();
  const run = useMutation({
    mutationFn: () => api.post('/alert-rules/run'),
    onSuccess: (r) => {
      toast.success(`Evaluación lista: ${r.created} nuevas, ${r.resolved} resueltas`);
      ['alerts', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error(e.message),
  });

  if (rules.isPending) return <LoadingState rows={4} />;
  if (rules.isError) return <ErrorState error={rules.error} onRetry={() => rules.refetch()} />;
  return (
    <div className="space-y-4">
      <Alert
        tone="info"
        action={
          <Button size="sm" variant="secondary" icon={Play} loading={run.isPending} onClick={() => run.mutate()}>
            Evaluar ahora
          </Button>
        }
      >
        Las reglas se evalúan automáticamente cada pocos minutos. Las alertas se resuelven solas cuando la condición deja de cumplirse.
      </Alert>
      {rules.data.map((r) => (
        <RuleCard key={r.key} rule={r} />
      ))}
    </div>
  );
}

function RuleCard({ rule }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [severity, setSeverity] = useState(rule.severity);
  const [params, setParams] = useState(() => Object.fromEntries(rule.paramsSchema.map((p) => [p.key, rule.params?.[p.key] ?? (p.type === 'boolean' ? false : '')])));
  const [preview, setPreview] = useState(null);
  const dirty =
    enabled !== rule.enabled ||
    severity !== rule.severity ||
    rule.paramsSchema.some((p) => String(params[p.key] ?? '') !== String(rule.params?.[p.key] ?? (p.type === 'boolean' ? false : '')));

  const clean = () =>
    Object.fromEntries(rule.paramsSchema.map((p) => [p.key, p.type === 'number' ? (params[p.key] === '' ? null : Number(params[p.key])) : Boolean(params[p.key])]));

  const save = useMutation({
    mutationFn: () => api.patch(`/alert-rules/${rule.key}`, { enabled, severity, params: clean() }),
    onSuccess: () => {
      toast.success(`Regla “${rule.label}” guardada`);
      ['alert-rules', 'alerts', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error(e.details?.[0]?.message ?? e.message),
  });
  const doPreview = useMutation({
    mutationFn: () => api.post(`/alert-rules/${rule.key}/preview`, { params: clean() }),
    onSuccess: (r) => setPreview(r.count),
    onError: (e) => toast.error(e.details?.[0]?.message ?? e.message),
  });
  const missingRequired = rule.paramsSchema.some((p) => p.required && (params[p.key] === '' || params[p.key] === null));

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {rule.label}
          {rule.enabled ? <Badge tone="green" size="sm">Activa</Badge> : <Badge size="sm">Inactiva</Badge>}
        </span>
      }
      description={rule.description}
      actions={<Switch label={`Activar ${rule.label}`} checked={enabled} onChange={setEnabled} disabled={missingRequired && !enabled} />}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {rule.paramsSchema.map((p) =>
          p.type === 'boolean' ? (
            <Checkbox key={p.key} label={p.label} checked={Boolean(params[p.key])} onChange={(e) => setParams({ ...params, [p.key]: e.target.checked })} className="pb-2.5" />
          ) : (
            <Field key={p.key} label={p.label} required={p.required} hint={`Entre ${p.min} y ${p.max}`}>
              {(fp) => <Input {...fp} type="number" min={p.min} max={p.max} value={params[p.key] ?? ''} onChange={(e) => setParams({ ...params, [p.key]: e.target.value })} />}
            </Field>
          ),
        )}
        <Field label="Severidad">
          {(fp) => (
            <Select {...fp} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {ALERT_SEVERITY.values.map((s) => (
                <option key={s} value={s}>
                  {ALERT_SEVERITY.labels[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {missingRequired && <p className="mt-2 text-xs text-amber-700">Define el valor para poder activar esta regla.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={Eye} loading={doPreview.isPending} disabled={missingRequired} onClick={() => doPreview.mutate()}>
            Vista previa
          </Button>
          {preview !== null && (
            <span className="text-sm text-ink-2" aria-live="polite">
              Hoy generaría <strong className="tabular">{preview}</strong> alerta{preview === 1 ? '' : 's'}.
            </span>
          )}
        </div>
        <Button size="sm" icon={Save} disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}
