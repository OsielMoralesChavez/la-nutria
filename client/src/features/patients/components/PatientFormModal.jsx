import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CalendarPlus, Stethoscope, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { SEX } from '@lanutria/shared';
import { z } from 'zod';
import { Alert, Button, Field, Input, Modal, Select, Textarea, useToast } from '../../../components/ui/index.js';
import { ageOf, toInputDate } from '../../../lib/format.js';
import { useNutritionists } from '../../catalogs/hooks.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useStartConsultation } from '../../consultations/hooks.js';
import { useCreatePatient, useUpdatePatient } from '../hooks.js';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Requerido').max(80),
  lastName: z.string().trim().min(1, 'Requerido').max(120),
  birthDate: z
    .string()
    .min(1, 'Requerida')
    .refine((v) => new Date(v) <= new Date() && new Date(v).getFullYear() > 1900, 'Fecha inválida'),
  sex: z.enum(SEX.values, { error: 'Selecciona una opción' }),
  phone: z.string().trim().min(7, 'Teléfono inválido').max(30),
  email: z.union([z.email('Correo inválido'), z.literal('')]).optional(),
  occupation: z.string().max(120).optional(),
  primaryNutritionist: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const toBody = (v) => ({
  firstName: v.firstName,
  lastName: v.lastName,
  birthDate: v.birthDate,
  sex: v.sex,
  contact: { phone: v.phone, email: v.email ?? '' },
  ...(v.occupation && { occupation: v.occupation }),
  ...(v.notes && { notes: v.notes }),
});

/**
 * Alta rápida (datos mínimos) o edición de datos generales.
 * En alta detecta posibles duplicados antes de crear y, al guardar,
 * ofrece el siguiente paso: iniciar consulta inicial, agendar o ir a la ficha.
 */
export function PatientFormModal({ open, onClose, patient, onCreated }) {
  const editing = Boolean(patient);
  const toast = useToast();
  const { user, can } = useAuth();
  const nutritionists = useNutritionists();
  const create = useCreatePatient();
  const update = useUpdatePatient(patient?.id);
  const start = useStartConsultation();
  const [duplicates, setDuplicates] = useState(null);
  const [created, setCreated] = useState(null);

  const values = useMemo(
    () =>
      patient
      ? {
          firstName: patient.firstName,
          lastName: patient.lastName,
          birthDate: toInputDate(patient.birthDate),
          sex: patient.sex,
          phone: patient.contact?.phone ?? '',
          email: patient.contact?.email ?? '',
          occupation: patient.occupation ?? '',
          notes: patient.notes ?? '',
        }
      : { primaryNutritionist: user?.id, sex: '' },
    [patient, user?.id],
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), values });

  const close = () => {
    reset();
    setDuplicates(null);
    setCreated(null);
    onClose();
  };

  const submit = async (values, force = false) => {
    try {
      if (editing) {
        await update.mutateAsync(toBody(values));
        toast.success('Datos actualizados');
        close();
        return;
      }
      const body = { ...toBody(values), primaryNutritionist: values.primaryNutritionist || undefined, ...(force && { force: true }) };
      const p = await create.mutateAsync(body);
      setDuplicates(null);
      setCreated(p);
      onCreated?.(p);
    } catch (err) {
      if (err.status === 409 && err.details?.duplicates) {
        setDuplicates(err.details.duplicates);
        return;
      }
      const fields = err.fieldErrors;
      const map = { 'contact.phone': 'phone', 'contact.email': 'email' };
      if (Object.keys(fields).length) Object.entries(fields).forEach(([f, m]) => setError(map[f] ?? f, { message: m }));
      else setError('root', { message: err.message });
    }
  };

  const birth = watch('birthDate');
  const age = birth ? ageOf(birth) : null;

  if (created) {
    return (
      <Modal open={open} onClose={close} title="Paciente registrado" description={`${created.fullName} quedó registrado. ¿Qué sigue?`} size="sm">
        <div className="grid gap-2">
          {can('consultations:create') && (
            <Button icon={Stethoscope} loading={start.isPending} onClick={() => start.mutate({ patientId: created.id }, { onSuccess: close })}>
              Iniciar consulta inicial
            </Button>
          )}
          {can('appointments:create') && (
            <Button variant="secondary" icon={CalendarPlus} to={`/agenda?nueva=1&paciente=${created.id}`} onClick={close}>
              Agendar primera cita
            </Button>
          )}
          <Button variant="ghost" icon={UserRound} to={`/pacientes/${created.id}`} onClick={close}>
            Ir a la ficha
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? 'Editar datos generales' : 'Nuevo paciente'}
      description={editing ? undefined : 'Sólo lo indispensable. El resto se completa en la consulta inicial.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" form="patient-form" loading={isSubmitting}>
            {editing ? 'Guardar cambios' : 'Registrar paciente'}
          </Button>
        </>
      }
    >
      <form id="patient-form" onSubmit={handleSubmit((v) => submit(v))} noValidate className="grid gap-4 sm:grid-cols-2">
        {errors.root && <Alert tone="error" className="sm:col-span-2">{errors.root.message}</Alert>}
        {duplicates && (
          <Alert
            tone="warning"
            title="¿Ya está registrado?"
            className="sm:col-span-2"
            action={
              <Button size="sm" variant="secondary" onClick={handleSubmit((v) => submit(v, true))}>
                Es otra persona
              </Button>
            }
          >
            <ul className="mt-1 space-y-1">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link to={`/pacientes/${d.id}`} onClick={close} className="font-medium underline">
                    {d.fullName}
                  </Link>{' '}
                  · {d.age} años · {d.phone}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <Field label="Nombre(s)" required error={errors.firstName?.message}>
          {(p) => <Input {...p} autoComplete="off" data-autofocus {...register('firstName')} />}
        </Field>
        <Field label="Apellidos" required error={errors.lastName?.message}>
          {(p) => <Input {...p} autoComplete="off" {...register('lastName')} />}
        </Field>
        <Field label="Fecha de nacimiento" required error={errors.birthDate?.message} hint={age !== null && !Number.isNaN(age) ? `${age} años` : undefined}>
          {(p) => <Input {...p} type="date" max={toInputDate(new Date())} {...register('birthDate')} />}
        </Field>
        <Field label="Sexo" required error={errors.sex?.message}>
          {(p) => (
            <Select {...p} {...register('sex')}>
              <option value="" disabled>
                Selecciona…
              </option>
              {SEX.values.map((s) => (
                <option key={s} value={s}>
                  {SEX.labels[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Teléfono" required error={errors.phone?.message}>
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="off" {...register('phone')} />}
        </Field>
        <Field label="Correo" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="off" {...register('email')} />}
        </Field>
        {editing && (
          <>
            <Field label="Ocupación" error={errors.occupation?.message}>
              {(p) => <Input {...p} {...register('occupation')} />}
            </Field>
            <Field label="Notas generales" className="sm:col-span-2" error={errors.notes?.message}>
              {(p) => <Textarea {...p} rows={2} {...register('notes')} />}
            </Field>
          </>
        )}
        {!editing && (
          <Field label="Nutriólogo responsable" className="sm:col-span-2">
            {(p) => (
              <Select {...p} {...register('primaryNutritionist')}>
                {(nutritionists.data ?? [{ id: user?.id, name: user?.name }]).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                    {n.id === user?.id ? ' (yo)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {duplicates === null && !editing && (
          <p className="flex items-center gap-1.5 text-xs text-ink-3 sm:col-span-2">
            <AlertTriangle aria-hidden className="size-3.5" />
            Si el nombre y la fecha de nacimiento o el teléfono coinciden con otro paciente, te avisaremos antes de crear.
          </p>
        )}
      </form>
    </Modal>
  );
}
