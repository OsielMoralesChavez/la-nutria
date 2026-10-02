import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { ProgressChart } from '../../../components/charts/ProgressChart.jsx';
import { Button, EmptyState, Modal, SegmentedControl, Skeleton, useToast } from '../../../components/ui/index.js';
import { cn } from '../../../lib/cn.js';
import { addDays } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useGoalTypes, useLabels, useMetricMap } from '../../catalogs/hooks.js';
import { Attachments } from '../components/Attachments.jsx';
import { GoalCard } from '../components/GoalCard.jsx';
import { goalDraftToBody, GoalFields, isGoalDraftValid } from '../components/GoalForm.jsx';
import { MetricComparisonTable } from '../components/MetricComparisonTable.jsx';
import { QuestionSection } from '../components/Section.jsx';
import { useGoalMutation, useSeries } from '../hooks.js';

const PERIODS = [
  { value: '90', label: '3 m' },
  { value: '180', label: '6 m' },
  { value: '365', label: '1 a' },
  { value: 'all', label: 'Todo' },
];

/**
 * ③ ¿CÓMO VA? — mediciones, gráficas, objetivos y fotografías.
 * Varias métricas = gráficas pequeñas sincronizadas (una por métrica),
 * nunca dos escalas en el mismo eje.
 */
export function PatientProgress() {
  const { summary, patient } = useOutletContext();
  const { progress, interventions } = summary;
  const metricMap = useMetricMap();
  const methodLabels = useLabels('measurement_method');
  const series = useSeries(patient.id);
  const [compareTo, setCompareTo] = useState('baseline');
  const [period, setPeriod] = useState('all');
  const withGoal = progress.metrics.filter((m) => m.target).map((m) => m.key);
  const [selected, setSelected] = useState(() => [...new Set(['peso', ...withGoal])].filter((k) => progress.metrics.some((m) => m.key === k)).slice(0, 4));
  const [newGoal, setNewGoal] = useState(false);

  const toggle = (key) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  const from = period === 'all' ? null : addDays(new Date(), -Number(period));
  const inRange = (points) => (from ? points.filter((p) => new Date(p.date) >= from) : points);
  const goals = useMemo(() => [...progress.goals].sort((a, b) => (a.status === 'en_curso' ? 0 : 1) - (b.status === 'en_curso' ? 0 : 1)), [progress.goals]);

  return (
    <div className="space-y-5">
      <QuestionSection
        n="③"
        question="¿Cómo va?"
        subtitle="Compara contra el inicio o contra la consulta anterior."
        emphasis
      >
        {progress.metrics.length === 0 ? (
          <EmptyState compact title="Sin mediciones" description="Las mediciones se registran durante la consulta." />
        ) : (
          <>
            <div className="mb-3 flex justify-end">
              <SegmentedControl
                size="sm"
                label="Comparar contra"
                value={compareTo}
                onChange={setCompareTo}
                options={[
                  { value: 'baseline', label: 'vs. inicio' },
                  { value: 'previous', label: 'vs. anterior' },
                ]}
              />
            </div>
            <MetricComparisonTable metrics={progress.metrics} compareTo={compareTo} selected={null} />
          </>
        )}
      </QuestionSection>

      <QuestionSection n="③" question="Gráficas de evolución" subtitle="Selecciona las métricas que quieres ver. Cada una con su propia escala.">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Métricas">
            {progress.metrics.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={selected.includes(m.key)}
                onClick={() => toggle(m.key)}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                  selected.includes(m.key) ? 'border-brand-600 bg-brand-50 text-accent' : 'border-line bg-surface-2 text-ink-3 hover:text-ink',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <SegmentedControl size="sm" label="Periodo" value={period} onChange={setPeriod} options={PERIODS} className="ml-auto" />
        </div>
        {series.isPending ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : selected.length === 0 ? (
          <EmptyState compact title="Selecciona al menos una métrica" />
        ) : (
          <div className={cn('grid gap-6', selected.length > 1 && 'md:grid-cols-2')}>
            {selected.map((key) => {
              const points = inRange(series.data?.[key] ?? []);
              const def = metricMap[key];
              const m = progress.metrics.find((x) => x.key === key);
              return points.length < 2 ? (
                <div key={key} className="rounded-xl border border-dashed border-line p-4">
                  <p className="text-sm font-semibold text-ink">{def?.label}</p>
                  <p className="mt-1 text-xs text-ink-3">{points.length ? 'Una sola medición en este periodo.' : 'Sin mediciones en este periodo.'}</p>
                </div>
              ) : (
                <ProgressChart
                  key={key}
                  label={def?.label ?? key}
                  unit={def?.unit}
                  decimals={def?.decimals ?? 1}
                  points={points}
                  target={m?.target?.value}
                  markers={interventions.lastPlanChangeAt ? [{ date: interventions.lastPlanChangeAt }] : []}
                  methodLabels={methodLabels}
                  height={selected.length > 1 ? 220 : 280}
                />
              );
            })}
          </div>
        )}
      </QuestionSection>

      <QuestionSection n="③" question="Objetivos y progreso">
        <GoalsBlock goals={goals} patient={patient} metricMap={metricMap} onNew={() => setNewGoal(true)} />
      </QuestionSection>

      <QuestionSection n="③" question="Fotografías de progreso" subtitle="Selecciona dos para compararlas lado a lado.">
        <Attachments patientId={patient.id} kind="foto" readOnly={Boolean(patient.archivedAt)} />
      </QuestionSection>

      {newGoal && <NewGoalModal patient={patient} currentValues={Object.fromEntries(progress.metrics.map((m) => [m.key, m.current?.value]))} onClose={() => setNewGoal(false)} />}
    </div>
  );
}

function GoalsBlock({ goals, patient, metricMap, onNew }) {
  const { can } = useAuth();
  return (
    <>
      <div className="mb-3 flex justify-end">
        {can('goals:create') && !patient.archivedAt && (
          <Button size="sm" variant="secondary" icon={Plus} onClick={onNew}>
            Nuevo objetivo
          </Button>
        )}
      </div>
      {goals.length === 0 ? (
        <EmptyState compact title="Sin objetivos" description="Define objetivos de peso, composición corporal, hábitos o personalizados." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} metric={metricMap[g.metric]} patientId={patient.id} />
          ))}
        </div>
      )}
    </>
  );
}

function NewGoalModal({ patient, currentValues, onClose }) {
  const [draft, setDraft] = useState({});
  const types = useGoalTypes();
  const mutate = useGoalMutation(patient.id);
  const toast = useToast();
  const valid = isGoalDraftValid(draft, types.data);
  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo objetivo"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            loading={mutate.isPending}
            onClick={() =>
              mutate.mutate(
                { body: goalDraftToBody(draft) },
                {
                  onSuccess: () => {
                    toast.success('Objetivo creado');
                    onClose();
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Crear objetivo
          </Button>
        </>
      }
    >
      <GoalFields value={draft} onChange={setDraft} currentValues={currentValues} />
    </Modal>
  );
}
