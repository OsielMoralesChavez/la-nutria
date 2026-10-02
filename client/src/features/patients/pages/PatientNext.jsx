import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { Link, useOutletContext } from 'react-router';
import { EmptyState, LoadingState, StatusBadge } from '../../../components/ui/index.js';
import { fmtDateFull, fmtTimeOf } from '../../../lib/format.js';
import { api } from '../../../lib/http.js';
import { qk } from '../../../lib/queryKeys.js';
import { useLabels } from '../../catalogs/hooks.js';
import { NextStepsPanel } from '../components/NextStepsPanel.jsx';
import { QuestionSection } from '../components/Section.jsx';

/**
 * ④ ¿QUÉ SIGUE? (vista completa): acciones pendientes + historial de citas
 * (asistencias, cancelaciones, inasistencias).
 */
export function PatientNext() {
  const { summary, patient } = useOutletContext();
  const params = { patient: patient.id };
  const appts = useQuery({ queryKey: qk.appointments(params), queryFn: () => api.get('/appointments', params) });
  const types = useLabels('appointment_type');

  return (
    <div className="space-y-5">
      <QuestionSection n="④" question="¿Qué sigue?" emphasis className="lg:hidden">
        <NextStepsPanel patient={patient} next={summary.next} compact />
      </QuestionSection>

      <QuestionSection n="④" question="Citas" subtitle="Próximas e historial">
        {appts.isPending && <LoadingState rows={3} />}
        {appts.data?.length === 0 && <EmptyState compact icon={CalendarDays} title="Sin citas registradas" />}
        <ul className="divide-y divide-line/70">
          {appts.data
            ?.slice()
            .sort((a, b) => new Date(b.start) - new Date(a.start))
            .map((a) => {
              const future = new Date(a.start) > new Date();
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className={future ? 'w-40 text-sm font-semibold text-ink' : 'w-40 text-sm text-ink-2'}>
                    {fmtDateFull(a.start)} · {fmtTimeOf(a.start)}
                  </span>
                  <span className="text-sm text-ink-3">{types[a.type] ?? 'Cita'}</span>
                  <span className="text-xs text-ink-3">· {a.nutritionist?.name}</span>
                  <StatusBadge kind="appointment" status={a.status} size="sm" className="ml-auto" />
                  {a.consultation && (
                    <Link to={`../intervenciones/consultas/${a.consultation}`} relative="path" className="text-xs font-medium text-accent hover:underline">
                      Ver consulta
                    </Link>
                  )}
                  {future && ['programada', 'confirmada'].includes(a.status) && (
                    <Link to={`/agenda?cita=${a.id}`} className="text-xs font-medium text-accent hover:underline">
                      Gestionar
                    </Link>
                  )}
                </li>
              );
            })}
        </ul>
      </QuestionSection>
    </div>
  );
}
