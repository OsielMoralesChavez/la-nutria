import { Archive, ArchiveRestore, CalendarPlus, Mail, MoreHorizontal, Pencil, Phone, Play, RefreshCcw, UserRoundCog } from 'lucide-react';
import { PATIENT_STATUS, SEX } from '@lanutria/shared';
import { useState } from 'react';
import { Alert, Avatar, Badge, Button, Field, IconButton, MenuItem, Modal, Popover, Select, StatusBadge, Textarea, useConfirm, useToast } from '../../../components/ui/index.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useNutritionists } from '../../catalogs/hooks.js';
import { useStartConsultation } from '../../consultations/hooks.js';
import { usePatientAction } from '../hooks.js';
import { PatientFormModal } from './PatientFormModal.jsx';

/** Encabezado persistente de la ficha con las acciones de 1 clic. */
export function PatientHeader({ patient }) {
  const { user, can } = useAuth();
  const start = useStartConsultation();
  const action = usePatientAction(patient.id);
  const confirm = useConfirm();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const archived = Boolean(patient.archivedAt);
  const isOwner = patient.primaryNutritionist?.id === user?.id;
  const canManage = can('patients:manage') || (can('patients:update') && isOwner);

  const archive = async () => {
    const ok = await confirm({
      title: `¿Archivar a ${patient.fullName}?`,
      description: 'El paciente dejará de aparecer en listados y se descartarán sus alertas. Su historial se conserva y puedes restaurarlo cuando quieras.',
      confirmLabel: 'Archivar',
      danger: true,
    });
    if (!ok) return;
    action.mutate(
      { action: 'archive' },
      {
        onSuccess: () =>
          toast.success('Paciente archivado', { action: { label: 'Deshacer', onClick: () => action.mutate({ action: 'restore' }) } }),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <header className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Avatar name={patient.fullName} size="xl" className="size-16 text-xl ring-4 ring-white/20 sm:size-24 sm:text-3xl" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-3xl">{patient.fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
            <span>
              {patient.age} años · {SEX.labels[patient.sex]}
            </span>
            <StatusBadge kind="patient" status={patient.status} size="sm" />
            <span className="max-sm:hidden">Resp. {patient.primaryNutritionist?.name}</span>
            {patient.tags?.map((t) => (
              <Badge key={t} tone="violet" size="sm">
                #{t}
              </Badge>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink-3">
            <a href={`tel:${patient.contact?.phone}`} className="inline-flex items-center gap-1 hover:text-accent">
              <Phone aria-hidden className="size-3.5" /> {patient.contact?.phone}
            </a>
            {patient.contact?.email && (
              <a href={`mailto:${patient.contact.email}`} className="inline-flex items-center gap-1 hover:text-accent max-sm:hidden">
                <Mail aria-hidden className="size-3.5" /> {patient.contact.email}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!archived && can('consultations:create') && (
          <Button icon={Play} loading={start.isPending} onClick={() => start.mutate({ patientId: patient.id })} className="max-sm:flex-1">
            Nueva consulta
          </Button>
        )}
        {!archived && can('appointments:create') && (
          <Button variant="secondary" icon={CalendarPlus} to={`/agenda?nueva=1&paciente=${patient.id}`} className="rounded-full max-sm:flex-1">
            Agendar
          </Button>
        )}
        {can('patients:update') && (
          <Popover width="w-56" trigger={(p) => <IconButton {...p} icon={MoreHorizontal} label="Más acciones" variant="secondary" />}>
            {({ close }) => (
              <>
                {!archived && (
                  <>
                    <MenuItem icon={Pencil} close={close} onClick={() => setModal('edit')}>
                      Editar datos generales
                    </MenuItem>
                    <MenuItem icon={RefreshCcw} close={close} onClick={() => setModal('status')}>
                      Cambiar estado
                    </MenuItem>
                  </>
                )}
                {canManage && !archived && (
                  <MenuItem icon={UserRoundCog} close={close} onClick={() => setModal('assign')}>
                    Reasignar responsable
                  </MenuItem>
                )}
                {canManage &&
                  (archived ? (
                    <MenuItem icon={ArchiveRestore} close={close} onClick={() => action.mutate({ action: 'restore' }, { onSuccess: () => toast.success('Paciente restaurado') })}>
                      Restaurar paciente
                    </MenuItem>
                  ) : (
                    <MenuItem icon={Archive} close={close} onClick={archive} danger>
                      Archivar paciente
                    </MenuItem>
                  ))}
              </>
            )}
          </Popover>
        )}
      </div>

      <PatientFormModal open={modal === 'edit'} onClose={() => setModal(null)} patient={patient} />
      <StatusModal open={modal === 'status'} onClose={() => setModal(null)} patient={patient} action={action} />
      <AssignModal open={modal === 'assign'} onClose={() => setModal(null)} patient={patient} action={action} />
    </header>
  );
}

function StatusModal({ open, onClose, patient, action }) {
  const [status, setStatus] = useState(patient.status);
  const [reason, setReason] = useState('');
  const toast = useToast();
  const save = () =>
    action.mutate(
      { action: 'status', body: { status, reason: reason || undefined } },
      {
        onSuccess: () => {
          toast.success('Estado actualizado');
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambiar estado"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={action.isPending} disabled={status === patient.status}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nuevo estado">
          {(p) => (
            <Select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              {PATIENT_STATUS.values.map((s) => (
                <option key={s} value={s}>
                  {PATIENT_STATUS.labels[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Motivo" hint="Queda en el historial del paciente.">
          {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}

function AssignModal({ open, onClose, patient, action }) {
  const nutritionists = useNutritionists();
  const [to, setTo] = useState(patient.primaryNutritionist?.id);
  const toast = useToast();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reasignar responsable"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={action.isPending}
            disabled={to === patient.primaryNutritionist?.id}
            onClick={() =>
              action.mutate(
                { action: 'assign', body: { nutritionist: to } },
                {
                  onSuccess: () => {
                    toast.success('Responsable actualizado');
                    onClose();
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Reasignar
          </Button>
        </>
      }
    >
      <Alert tone="info" className="mb-4">
        El historial se conserva. Las consultas anteriores mantienen a quien las atendió.
      </Alert>
      <Field label="Nuevo responsable">
        {(p) => (
          <Select {...p} value={to} onChange={(e) => setTo(e.target.value)}>
            {nutritionists.data?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Modal>
  );
}
