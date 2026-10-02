import { useOutletContext } from 'react-router';
import { SEX } from '@lanutria/shared';
import { DataList } from '../../../components/ui/index.js';
import { fmtDate, fmtDateFull, fmtNum } from '../../../lib/format.js';
import { useMetricMap } from '../../catalogs/hooks.js';
import { ClinicalRecord } from '../components/ClinicalRecord.jsx';
import { GoalCard } from '../components/GoalCard.jsx';
import { QuestionSection } from '../components/Section.jsx';

/** ① ¿CÓMO INICIÓ? — punto de partida: datos, consulta inicial, línea base, objetivos iniciales y expediente. */
export function PatientStart() {
  const { summary, patient } = useOutletContext();
  const metricMap = useMetricMap();
  const { start, progress } = summary;
  const initialGoals = progress.goals.filter((g) => start.firstConsultation && g.createdIn === start.firstConsultation.id);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <QuestionSection n="①" question="Punto de partida" subtitle={start.firstConsultation ? `Consulta inicial: ${fmtDateFull(start.firstConsultation.date)}` : 'Sin consulta inicial todavía'}>
          <DataList
            items={[
              { label: 'Motivo', value: start.reason },
              { label: 'Atendió', value: start.firstConsultation?.nutritionist },
              { label: 'Registrado', value: fmtDate(patient.createdAt) },
            ]}
          />
          {start.baseline.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <caption className="mb-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">Línea base</caption>
              <tbody className="divide-y divide-line/70">
                {start.baseline.map((b) => (
                  <tr key={b.key}>
                    <th scope="row" className="py-1.5 text-left font-normal text-ink-2">
                      {b.label}
                    </th>
                    <td className="py-1.5 text-right font-semibold text-ink tabular">{fmtNum(b.value, metricMap[b.key]?.decimals, b.unit)}</td>
                    <td className="w-24 py-1.5 text-right text-xs text-ink-3">{fmtDate(b.takenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QuestionSection>

        <QuestionSection n="①" question="Datos generales">
          <DataList
            items={[
              { label: 'Nombre', value: patient.fullName },
              { label: 'Nacimiento', value: `${fmtDateFull(patient.birthDate)} (${patient.age} años)` },
              { label: 'Sexo', value: SEX.labels[patient.sex] },
              { label: 'Teléfono', value: patient.contact?.phone },
              { label: 'Correo', value: patient.contact?.email },
              { label: 'Ocupación', value: patient.occupation },
              { label: 'Responsable', value: patient.primaryNutritionist?.name },
              { label: 'Notas', value: patient.notes },
            ]}
          />
        </QuestionSection>
      </div>

      {initialGoals.length > 0 && (
        <QuestionSection n="①" question="Objetivos definidos al inicio">
          <div className="grid gap-3 sm:grid-cols-2">
            {initialGoals.map((g) => (
              <GoalCard key={g.id} goal={g} metric={metricMap[g.metric]} patientId={patient.id} compact />
            ))}
          </div>
        </QuestionSection>
      )}

      <QuestionSection n="①" question="Historia clínica" subtitle="Antecedentes, medicamentos, alergias, hábitos… con historial de cambios.">
        <ClinicalRecord patientId={patient.id} readOnly={Boolean(patient.archivedAt)} />
      </QuestionSection>
    </div>
  );
}
