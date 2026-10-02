import { Archive, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { Alert, EmptyState, ErrorState, Modal, Skeleton } from '../../../components/ui/index.js';
import { fmtDate } from '../../../lib/format.js';
import { useRecentPatients } from '../../../layouts/useRecentPatients.js';
import { NextStepsBar, NextStepsPanel } from '../components/NextStepsPanel.jsx';
import { PatientHeader } from '../components/PatientHeader.jsx';
import { PatientThread } from '../components/PatientThread.jsx';
import { usePatientSummary } from '../hooks.js';

/**
 * FICHA 360°. La estructura responde a las cuatro preguntas:
 *   - El Hilo (①→④) es la navegación principal.
 *   - Columna principal: pasado y presente (①②③), vía <Outlet/>.
 *   - Panel derecho fijo: ④ ¿Qué sigue? (siempre visible porque es lo accionable).
 *     En móvil/tablet se reduce a una barra inferior que abre una hoja.
 */
export function PatientLayout() {
  const { id } = useParams();
  const summary = usePatientSummary(id);
  const recent = useRecentPatients();
  const [sheet, setSheet] = useState(false);
  const patient = summary.data?.patient;

  useEffect(() => {
    if (patient) recent.push(patient);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id]);

  if (summary.isPending) return <PatientSkeleton />;
  if (summary.isError) {
    if (summary.error.status === 404) {
      return <EmptyState icon={UserX} title="Paciente no encontrado" description="Puede que el enlace sea incorrecto o que el paciente haya sido eliminado." action={<Link to="/pacientes" className="font-medium text-accent hover:underline">Volver a pacientes</Link>} />;
    }
    return <ErrorState error={summary.error} onRetry={() => summary.refetch()} />;
  }

  const data = summary.data;
  return (
    <div className="space-y-5 pb-16 lg:pb-0">
      <PatientHeader patient={patient} />
      {patient.archivedAt && (
        <Alert tone="warning" title="Paciente archivado">
          <span className="inline-flex items-center gap-1">
            <Archive aria-hidden className="size-3.5" />
            Archivado el {fmtDate(patient.archivedAt)}. Su historial se conserva; para registrar nuevas consultas, restáuralo.
          </span>
        </Alert>
      )}
      <PatientThread summary={data} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0">
          <Outlet context={{ summary: data, patient }} />
        </div>
        <aside aria-label="¿Qué sigue?" className="hidden lg:block">
          <div className="glass lg:sticky lg:top-[104px] rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-card)]">
            <NextStepsPanel patient={patient} next={data.next} />
          </div>
        </aside>
      </div>

      <NextStepsBar patient={patient} next={data.next} onOpen={() => setSheet(true)} />
      <Modal open={sheet} onClose={() => setSheet(false)} title="④ ¿Qué sigue?">
        <NextStepsPanel patient={patient} next={data.next} compact />
      </Modal>
    </div>
  );
}

function PatientSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando paciente">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Skeleton className="h-96 rounded-[var(--radius-card)]" />
        <Skeleton className="hidden h-96 rounded-[var(--radius-card)] lg:block" />
      </div>
    </div>
  );
}
