import { NOTE_FORMAT, CONSULTATION_TYPE } from '@lanutria/shared';
import { Card, Field, Input, SegmentedControl, Select, Textarea } from '../../../components/ui/index.js';

const SOAP = [
  ['s', 'S · Subjetivo', 'Lo que refiere el paciente: síntomas, adherencia, dificultades…'],
  ['o', 'O · Objetivo', 'Hallazgos medibles: mediciones, laboratorios…'],
  ['a', 'A · Análisis', 'Interpretación del nutriólogo.'],
  ['p', 'P · Plan', 'Ajustes al plan e indicaciones.'],
];

/** Paso 1: notas híbridas — texto libre y/o SOAP (no obligatorio). */
export function NotesStep({ state, update }) {
  const fmt = state.noteFormat;
  return (
    <Card title="1 · Notas de la consulta" description="Usa texto libre, SOAP o ambos. Puedes cambiar el formato en cualquier momento.">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Motivo de la consulta">
            {(p) => <Input {...p} value={state.reason} onChange={(e) => update('reason', e.target.value)} placeholder="Ej. Seguimiento mensual, dudas con el plan…" />}
          </Field>
          <Field label="Tipo">
            {(p) => (
              <Select {...p} value={state.type} onChange={(e) => update('type', e.target.value)}>
                {CONSULTATION_TYPE.values.map((t) => (
                  <option key={t} value={t}>
                    {CONSULTATION_TYPE.labels[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <SegmentedControl
          label="Formato de nota"
          value={fmt}
          onChange={(v) => update('noteFormat', v)}
          options={NOTE_FORMAT.values.map((v) => ({ value: v, label: NOTE_FORMAT.labels[v] }))}
        />

        {fmt !== 'soap' && (
          <Field label="Nota">
            {(p) => (
              <Textarea
                {...p}
                rows={6}
                value={state.notes.freeText}
                onChange={(e) => update('notes', (n) => ({ ...n, freeText: e.target.value }))}
                placeholder="Observaciones de la consulta…"
              />
            )}
          </Field>
        )}
        {fmt !== 'libre' && (
          <div className="grid gap-4 md:grid-cols-2">
            {SOAP.map(([k, label, hint]) => (
              <Field key={k} label={label} hint={hint}>
                {(p) => <Textarea {...p} rows={3} value={state.notes.soap[k]} onChange={(e) => update('notes', (n) => ({ ...n, soap: { ...n.soap, [k]: e.target.value } }))} />}
              </Field>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
