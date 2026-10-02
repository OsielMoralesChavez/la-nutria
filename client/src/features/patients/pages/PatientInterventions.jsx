import { useOutletContext } from 'react-router';
import { Attachments } from '../components/Attachments.jsx';
import { QuestionSection } from '../components/Section.jsx';
import { Timeline } from '../components/Timeline.jsx';

/** ② ¿QUÉ SE HIZO? — línea de tiempo completa + documentos. */
export function PatientInterventions() {
  const { summary, patient } = useOutletContext();
  const { interventions } = summary;
  return (
    <div className="space-y-5">
      <QuestionSection
        n="②"
        question="¿Qué se hizo?"
        subtitle={`${interventions.consultationCount} consultas · ${interventions.monthsInTreatment} meses de seguimiento`}
        emphasis
      >
        <Timeline patientId={patient.id} />
      </QuestionSection>
      <QuestionSection n="②" question="Documentos" subtitle="Laboratorios, planes entregados y otros archivos.">
        <Attachments patientId={patient.id} kind="documento" readOnly={Boolean(patient.archivedAt)} />
      </QuestionSection>
    </div>
  );
}
