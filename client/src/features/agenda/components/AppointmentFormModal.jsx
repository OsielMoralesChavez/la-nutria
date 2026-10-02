import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, Field, Input, Modal, SegmentedControl, Select, Textarea, useToast } from '../../../components/ui/index.js';
import { fmtDateTime, fmtTimeOf, toInputDate, toInputDateTime } from '../../../lib/format.js';
import { api } from '../../../lib/http.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useCatalog, useNutritionists } from '../../catalogs/hooks.js';
import { PatientCombobox } from '../../patients/components/PatientCombobox.jsx';
import { useAppointmentMutation } from '../hooks.js';
import { SlotPicker } from './SlotPicker.jsx';

/**
 * Nueva cita. Desde un hueco de la agenda llega con la hora prellenada;
 * desde la ficha, con el paciente. Si hay traslape lo avisa y, si la
 * configuración lo permite, deja agendar de todos modos.
 */
export function AppointmentFormModal({ open, onClose, initialStart, initialPatientId, initialNutritionist }) {
  const { user } = useAuth();
  const toast = useToast();
  const types = useCatalog('appointment_type');
  const nutritionists = useNutritionists();
  const mutation = useAppointmentMutation();
  const initialPatient = useQuery({
    queryKey: ['patient', initialPatientId, 'basic'],
    queryFn: () => api.get(`/patients/${initialPatientId}`),
    enabled: Boolean(initialPatientId),
  });

  // undefined = aún no se toca (usa el paciente inicial); null = se quitó.
  const [patient, setPatient] = useState(undefined);
  const [nutritionist, setNutritionist] = useState(initialNutritionist ?? user.id);
  const [type, setType] = useState('seguimiento');
  const [mode, setMode] = useState(initialStart ? 'exacta' : 'libre');
  const [date, setDate] = useState(toInputDate(initialStart ?? new Date()));
  const [start, setStart] = useState(initialStart ? new Date(initialStart).toISOString() : null);
  const [exact, setExact] = useState(initialStart ? toInputDateTime(initialStart) : '');
  const [notes, setNotes] = useState('');
  const [conflict, setConflict] = useState(null);
  const [error, setError] = useState(null);

  const selectedPatient = patient === undefined ? initialPatient.data ?? null : patient;
  const duration = types.data?.find((t) => t.key === type)?.meta?.durationMin;
  const finalStart = mode === 'libre' ? start : exact ? new Date(exact).toISOString() : null;

  const submit = (force = false) => {
    setError(null);
    if (!selectedPatient) return setError('Elige al paciente.');
    if (!finalStart) return setError('Elige el horario.');
    mutation.mutate(
      { action: 'create', body: { patient: selectedPatient.id, nutritionist, start: finalStart, type, notes: notes || undefined, ...(force && { force: true }) } },
      {
        onSuccess: (a) => {
          toast.success(`Cita agendada: ${fmtDateTime(a.start)}`, { title: selectedPatient.fullName });
          onClose(a);
        },
        onError: (e) => {
          if (e.status === 409 && e.details?.conflicts) setConflict(e.details);
          else setError(e.message);
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={() => onClose()}
      title="Nueva cita"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onClose()}>
            Cancelar
          </Button>
          {conflict?.canForce && (
            <Button variant="secondary" onClick={() => submit(true)} loading={mutation.isPending}>
              Agendar de todos modos
            </Button>
          )}
          <Button onClick={() => submit(false)} loading={mutation.isPending}>
            Agendar cita
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {conflict && (
          <Alert tone="warning" title="Horario ocupado">
            {conflict.conflicts.map((c) => (
              <span key={c.id} className="block">
                {fmtTimeOf(c.start)}–{fmtTimeOf(c.end)} · {c.patient}
              </span>
            ))}
            {!conflict.canForce && <span className="mt-1 block">Elige otro horario (la configuración no permite traslapes).</span>}
          </Alert>
        )}
        <Field label="Paciente" required>
          {(p) => <PatientCombobox value={selectedPatient} onChange={setPatient} inputProps={p} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nutriólogo">
            {(p) => (
              <Select {...p} value={nutritionist} onChange={(e) => setNutritionist(e.target.value)}>
                {nutritionists.data?.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                    {n.id === user.id ? ' (yo)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tipo de cita">
            {(p) => (
              <Select {...p} value={type} onChange={(e) => setType(e.target.value)}>
                {types.data?.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} ({t.meta?.durationMin ?? '—'} min)
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <SegmentedControl
          size="sm"
          label="Forma de elegir horario"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setConflict(null);
          }}
          options={[
            { value: 'libre', label: 'Horarios libres' },
            { value: 'exacta', label: 'Hora específica' },
          ]}
        />
        {mode === 'libre' ? (
          <SlotPicker
            date={date}
            onDate={(d) => {
              setDate(d);
              setStart(null);
              setConflict(null);
            }}
            value={start}
            onChange={(s) => {
              setStart(s);
              setConflict(null);
            }}
            nutritionist={nutritionist}
            durationMin={duration}
          />
        ) : (
          <Field label="Fecha y hora">
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                value={exact}
                onChange={(e) => {
                  setExact(e.target.value);
                  setConflict(null);
                }}
              />
            )}
          </Field>
        )}
        <Field label="Notas">{(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}
