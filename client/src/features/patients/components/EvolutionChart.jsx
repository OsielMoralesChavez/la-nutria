import { ProgressChart } from '../../../components/charts/ProgressChart.jsx';
import { EmptyState, Skeleton } from '../../../components/ui/index.js';
import { LineChart } from 'lucide-react';
import { useLabels, useMetricMap } from '../../catalogs/hooks.js';
import { useSeries } from '../hooks.js';

/** Gráfica de una métrica del paciente con su meta y marcadores de intervención. */
export function EvolutionChart({ patientId, metricKey, target, markers, height }) {
  const series = useSeries(patientId, [metricKey]);
  const metricMap = useMetricMap();
  const methodLabels = useLabels('measurement_method');
  const def = metricMap[metricKey];
  if (series.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;
  const points = series.data?.[metricKey] ?? [];
  if (points.length < 2) {
    return (
      <EmptyState
        compact
        icon={LineChart}
        title="La gráfica aparece desde la 2.ª medición"
        description={points.length ? 'Por ahora sólo hay una toma registrada.' : 'Aún no hay mediciones de esta métrica.'}
      />
    );
  }
  return (
    <ProgressChart
      label={def?.label ?? metricKey}
      unit={def?.unit}
      decimals={def?.decimals ?? 1}
      points={points}
      target={target}
      markers={markers}
      methodLabels={methodLabels}
      height={height}
    />
  );
}
