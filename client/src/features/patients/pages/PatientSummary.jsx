import { Play, Sprout } from 'lucide-react';
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { Button, DataList, EmptyState } from '../../../components/ui/index.js';
import { fmtDate, fmtNum } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useMetricMap } from '../../catalogs/hooks.js';
import { useStartConsultation } from '../../consultations/hooks.js';
import { EvolutionChart } from '../components/EvolutionChart.jsx';
import { GoalCard } from '../components/GoalCard.jsx';
import { MetricComparisonTable } from '../components/MetricComparisonTable.jsx';
import { QuestionSection } from '../components/Section.jsx';
import { Timeline } from '../components/Timeline.jsx';

/**
 * RESUMEN 360°. Orden de lectura = la historia; prominencia = el uso:
 *   ③ ¿Cómo va? primero y más grande (es lo que se revisa en consulta),
 *   ① ¿Cómo inició? compacto como referencia,
 *   ② ¿Qué se hizo? como línea de tiempo breve.
 *   ④ ¿Qué sigue? vive en el panel fijo (PatientLayout).
 */
export function PatientSummary() {
  const { summary, patient } = useOutletContext();
  const { can } = useAuth();
  const start = useStartConsultation();
  const metricMap = useMetricMap();
  const { progress, start: begin, interventions } = summary;
  const hasConsultations = interventions.consultationCount > 0;
  const defaultMetric = progress.metrics.find((m) => m.target)?.key ?? progress.metrics.find((m) => m.key === 'peso')?.key ?? progress.metrics[0]?.key;
  const [selected, setSelected] = useState(defaultMetric);
  const selectedMetric = progress.metrics.find((m) => m.key === selected);
  const activeGoals = progress.goals.filter((g) => g.status === 'en_curso');

  if (!hasConsultations) {
    return (
      <div className="space-y-5">
        <div className="card">
          <EmptyState
            icon={Sprout}
            title="Aún no hay evolución"
            description="La evolución se construye a partir de la consulta inicial: ahí se registran la línea base, el expediente y los objetivos."
            action={
              can('consultations:create') &&
              !patient.archivedAt && (
                <Button icon={Play} loading={start.isPending} onClick={() => start.mutate({ patientId: patient.id })}>
                  Iniciar consulta inicial
                </Button>
              )
            }
          />
        </div>
        <QuestionSection n="①" question="¿Cómo inició?" to="inicio" linkLabel="Ver expediente">
          <DataList
            items={[
              { label: 'Registrado', value: fmtDate(patient.createdAt) },
              { label: 'Ocupación', value: patient.occupation },
              { label: 'Notas', value: patient.notes },
            ]}
          />
        </QuestionSection>
      </div>
    );
  }

  const onlyOne = progress.metrics.every((m) => !m.previous);
  return (
    <div className="space-y-5">
      {/* ③ ¿CÓMO VA? */}
      <QuestionSection
        n="③"
        question="¿Cómo va?"
        subtitle={`Última medición ${fmtDate(progress.lastMeasurementAt)} · toca una métrica para ver su gráfica`}
        to="evolucion"
        linkLabel="Evolución completa"
        emphasis
      >
        {onlyOne && <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-3">Hay una sola medición: las tendencias aparecerán desde la segunda.</p>}
        <MetricComparisonTable metrics={progress.metrics} selected={selected} onSelect={setSelected} />
        {selected && (
          <div className="mt-5 border-t border-line/70 pt-4">
            <EvolutionChart
              patientId={patient.id}
              metricKey={selected}
              target={selectedMetric?.target?.value}
              markers={interventions.lastPlanChangeAt ? [{ date: interventions.lastPlanChangeAt, label: 'Cambio de plan' }] : []}
            />
          </div>
        )}
        {activeGoals.length > 0 && (
          <div className="mt-5 grid gap-3 border-t border-line/70 pt-4 sm:grid-cols-2">
            {activeGoals.slice(0, 4).map((g) => (
              <GoalCard key={g.id} goal={g} metric={metricMap[g.metric]} patientId={patient.id} compact />
            ))}
          </div>
        )}
      </QuestionSection>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ① ¿CÓMO INICIÓ? */}
        <QuestionSection
          n="①"
          question="¿Cómo inició?"
          subtitle={begin.firstConsultation ? `${fmtDate(begin.firstConsultation.date)} · consulta inicial con ${begin.firstConsultation.nutritionist}` : undefined}
          to="inicio"
          linkLabel="Expediente"
        >
          {begin.reason && (
            <p className="mb-3 text-sm text-ink">
              <span className="text-ink-3">Motivo: </span>
              {begin.reason}
            </p>
          )}
          {begin.baseline.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2" aria-label="Línea base">
              {begin.baseline
                .filter((b) => ['peso', 'imc', 'grasa_pct', 'cintura', 'masa_muscular'].includes(b.key))
                .map((b) => (
                  <li key={b.key} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                    <span className="text-ink-3">{b.label}</span>{' '}
                    <span className="font-semibold text-ink tabular">{fmtNum(b.value, metricMap[b.key]?.decimals, b.unit)}</span>
                  </li>
                ))}
            </ul>
          )}
          {begin.clinicalHighlights.length > 0 && (
            <DataList items={begin.clinicalHighlights.map((h) => ({ label: h.label.split(' (')[0], value: h.text }))} />
          )}
          <p className="mt-3 text-xs text-ink-3">
            Objetivos definidos al inicio: {begin.initialGoals}
            {begin.clinicalVersion > 1 && ` · el expediente tiene ${begin.clinicalVersion} versiones`}
          </p>
        </QuestionSection>

        {/* ② ¿QUÉ SE HIZO? */}
        <QuestionSection
          n="②"
          question="¿Qué se hizo?"
          subtitle={`${interventions.consultationCount} consultas en ${interventions.monthsInTreatment} meses${interventions.lastPlanChangeAt ? ` · último ajuste de plan ${fmtDate(interventions.lastPlanChangeAt)}` : ''}`}
          to="intervenciones"
          linkLabel="Línea de tiempo"
        >
          <Timeline patientId={patient.id} limit={4} filterable={false} compact />
        </QuestionSection>
      </div>
    </div>
  );
}
