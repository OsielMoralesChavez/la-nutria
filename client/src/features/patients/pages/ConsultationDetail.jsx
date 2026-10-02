import { FilePlus2, Lock } from 'lucide-react';
import { CONSULTATION_TYPE } from '@lanutria/shared';
import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router';
import { Alert, Button, ErrorState, Field, LoadingState, PageHeader, Textarea, useToast } from '../../../components/ui/index.js';
import { fmtDateFull, fmtDateTime, fmtDelta, fmtNum, fmtTimeOf } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useMetricMap } from '../../catalogs/hooks.js';
import { useAddAddendum, useConsultation } from '../../consultations/hooks.js';
import { Attachments } from '../components/Attachments.jsx';
import { QuestionSection } from '../components/Section.jsx';

const SOAP = [
  ['s', 'Subjetivo'],
  ['o', 'Objetivo'],
  ['a', 'Análisis'],
  ['p', 'Plan'],
];

/** Consulta cerrada en sólo lectura. Correcciones = adendas (la nota original no cambia). */
export function ConsultationDetail() {
  const { cid } = useParams();
  const { patient } = useOutletContext();
  const { can } = useAuth();
  const query = useConsultation(cid);
  const metricMap = useMetricMap();
  const addendum = useAddAddendum(cid, patient.id);
  const toast = useToast();
  const [text, setText] = useState('');

  if (query.isPending) return <LoadingState rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const c = query.data;
  const soap = c.notes?.soap;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: `/pacientes/${patient.id}/intervenciones`, label: 'Volver a la línea de tiempo' }}
        title={`${CONSULTATION_TYPE.labels[c.type]} · ${fmtDateFull(c.date)}`}
        description={`${fmtTimeOf(c.date)} · ${c.nutritionist?.name}`}
        className="!mb-0"
      />
      {c.status === 'cerrada' && (
        <Alert tone="info">
          <span className="inline-flex items-center gap-1.5">
            <Lock aria-hidden className="size-3.5" /> Consulta cerrada el {fmtDateTime(c.closedAt)}. Para corregir algo, agrega una adenda.
          </span>
        </Alert>
      )}

      <QuestionSection n="②" question="Notas de la consulta">
        {c.reason && (
          <p className="mb-3 text-sm">
            <span className="text-ink-3">Motivo: </span>
            {c.reason}
          </p>
        )}
        {c.notes?.freeText && <p className="whitespace-pre-line text-sm text-ink">{c.notes.freeText}</p>}
        {soap && Object.values(soap).some(Boolean) && (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {SOAP.filter(([k]) => soap[k]).map(([k, label]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {k.toUpperCase()} · {label}
                </dt>
                <dd className="mt-1 whitespace-pre-line text-sm text-ink">{soap[k]}</dd>
              </div>
            ))}
          </dl>
        )}
        {!c.notes?.freeText && !soap && <p className="text-sm text-ink-3">Sin notas.</p>}
      </QuestionSection>

      {c.summary?.changes?.length > 0 && (
        <QuestionSection n="③" question="Mediciones registradas">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr>
                <th scope="col" className="py-1.5 font-medium">Métrica</th>
                <th scope="col" className="py-1.5 text-right font-medium">Valor</th>
                <th scope="col" className="py-1.5 text-right font-medium">Cambio vs. anterior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {c.summary.changes.map((ch) => {
                const m = metricMap[ch.metric];
                return (
                  <tr key={ch.metric}>
                    <th scope="row" className="py-1.5 text-left font-normal text-ink-2">
                      {m?.label ?? ch.metric}
                    </th>
                    <td className="py-1.5 text-right font-semibold text-ink tabular">{fmtNum(ch.value, m?.decimals, m?.unit)}</td>
                    <td className="py-1.5 text-right text-ink-3 tabular">{fmtDelta(ch.delta, m?.decimals)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </QuestionSection>
      )}

      <QuestionSection n="②" question="Archivos de esta consulta">
        <Attachments patientId={patient.id} consultationId={c.id} readOnly />
      </QuestionSection>

      <QuestionSection n="②" question={`Adendas (${c.addenda?.length ?? 0})`}>
        <ul className="space-y-2">
          {c.addenda?.map((a) => (
            <li key={a.id ?? a._id} className="rounded-xl border border-line bg-white p-3">
              <p className="whitespace-pre-line text-sm text-ink">{a.text}</p>
              <p className="mt-1 text-xs text-ink-3">
                {fmtDateTime(a.at)} · {a.by?.name}
              </p>
            </li>
          ))}
        </ul>
        {can('consultations:update') && c.status === 'cerrada' && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              addendum.mutate(text.trim(), {
                onSuccess: () => {
                  setText('');
                  toast.success('Adenda agregada');
                },
                onError: (err) => toast.error(err.message),
              });
            }}
          >
            <Field label="Nueva adenda" hint="Queda registrada con fecha y autor. La nota original no se modifica.">
              {(p) => <Textarea {...p} rows={2} value={text} onChange={(e) => setText(e.target.value)} />}
            </Field>
            <Button type="submit" size="sm" icon={FilePlus2} loading={addendum.isPending} disabled={!text.trim()}>
              Agregar adenda
            </Button>
          </form>
        )}
      </QuestionSection>
    </div>
  );
}
