import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronDown, CloudOff, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { CONSULTATION_TYPE } from '@lanutria/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Button, ErrorState, IconButton, MenuItem, Popover, Skeleton, useConfirm, useToast } from '../../components/ui/index.js';
import { cn } from '../../lib/cn.js';
import { fmtDelta, fmtTimeOf } from '../../lib/format.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { usePatientSummary } from '../patients/hooks.js';
import { saveDraft, useCloseConsultation, useConsultationContext, useDiscardConsultation } from './hooks.js';
import { ClinicalStep } from './steps/ClinicalStep.jsx';
import { GoalsStep } from './steps/GoalsStep.jsx';
import { MeasurementsStep } from './steps/MeasurementsStep.jsx';
import { NextStep } from './steps/NextStep.jsx';
import { NotesStep } from './steps/NotesStep.jsx';
import { ReviewStep } from './steps/ReviewStep.jsx';
import { useAutosave } from './useAutosave.js';
import { buildInitialState, serializeSection } from './state.js';

const STEPS = [
  { key: 'notas', label: 'Notas' },
  { key: 'expediente', label: 'Expediente' },
  { key: 'mediciones', label: 'Mediciones' },
  { key: 'objetivos', label: 'Objetivos' },
  { key: 'siguiente', label: 'Qué sigue' },
  { key: 'revisar', label: 'Revisar y cerrar' },
];

/**
 * MODO CONSULTA: captura enfocada durante la consulta.
 * - Los pasos son pestañas (no un asistente obligatorio): se puede saltar.
 * - Borrador con autoguardado; si se cae la red o se cierra la pestaña,
 *   se retoma donde se quedó.
 * - Al cerrar, el servidor convierte el borrador en registros reales y la
 *   ficha 360° se actualiza sola.
 */
export function ConsultationMode() {
  const { id: patientId, cid } = useParams();
  const ctx = useConsultationContext(cid);
  const summary = usePatientSummary(patientId);

  if (ctx.isPending || summary.isPending) return <ConsultationSkeleton />;
  if (ctx.isError) return <ErrorState error={ctx.error} onRetry={() => ctx.refetch()} />;
  if (summary.isError) return <ErrorState error={summary.error} onRetry={() => summary.refetch()} />;
  if (ctx.data.consultation.status === 'cerrada') {
    return <Navigate to={`/pacientes/${patientId}/intervenciones/consultas/${cid}`} replace />;
  }
  return <ConsultationEditor key={cid} context={ctx.data} patient={summary.data.patient} />;
}

function ConsultationEditor({ context, patient }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const consultation = context.consultation;
  const [state, setState] = useState(() => buildInitialState(context, user));
  const [step, setStep] = useState(state.type === 'inicial' && !context.clinical?.motivo ? 'notas' : 'mediciones');
  const [showContext, setShowContext] = useState(true);
  const close = useCloseConsultation(patient.id);
  const discard = useDiscardConsultation(patient.id);
  const autosave = useAutosave((payload) => saveDraft(consultation.id, payload));

  /** Actualiza una sección del estado y encola su guardado. */
  const update = (section, value) => {
    setState((s) => {
      const next = { ...s, [section]: typeof value === 'function' ? value(s[section]) : value };
      autosave.queue(serializeSection(section, next));
      return next;
    });
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const goTo = (key) => {
    setStep(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onClose = async () => {
    try {
      await autosave.flush();
      const closed = await close.mutateAsync(consultation.id);
      const weight = closed.summary?.changes?.find((c) => c.metric === 'peso');
      toast.success(
        weight?.delta !== null && weight?.delta !== undefined ? `Consulta cerrada · peso ${fmtDelta(weight.delta)} kg vs. anterior` : 'Consulta cerrada. La evolución se actualizó.',
        { title: patient.fullName },
      );
      navigate(`/pacientes/${patient.id}`, { replace: true, state: { justClosed: true } });
    } catch (err) {
      toast.error(err.message, { title: 'No se pudo cerrar la consulta' });
      if (err.details && Array.isArray(err.details)) goTo('revisar');
    }
  };

  const onDiscard = async () => {
    const ok = await confirm({
      title: '¿Descartar este borrador?',
      description: 'Se eliminará lo capturado en esta consulta (no afecta consultas anteriores).',
      confirmLabel: 'Descartar',
      danger: true,
    });
    if (!ok) return;
    discard.mutate(consultation.id, {
      onSuccess: () => {
        toast.info('Borrador descartado');
        navigate(`/pacientes/${patient.id}`, { replace: true });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const leave = async () => {
    try {
      await autosave.flush();
    } catch {
      /* si no se pudo, el aviso de beforeunload/estado ya lo indica */
    }
    navigate(`/pacientes/${patient.id}`);
  };

  // Atajos: Ctrl+→ / Ctrl+← para cambiar de paso.
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'ArrowRight' && stepIndex < STEPS.length - 1) goTo(STEPS[stepIndex + 1].key);
      if (e.key === 'ArrowLeft' && stepIndex > 0) goTo(STEPS[stepIndex - 1].key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepIndex]);

  const stepProps = { state, update, context, patient, goTo };
  const filled = useMemo(
    () => ({
      notas: Boolean(state.notes.freeText || Object.values(state.notes.soap ?? {}).some(Boolean) || state.reason),
      expediente: Object.keys(state.clinical).length > 0,
      mediciones: Object.values(state.measurement.values).some((v) => v.value !== null && v.value !== undefined),
      objetivos: Object.keys(state.goals.updates).length > 0 || state.goals.create.length > 0,
      siguiente: state.next.mode !== 'ninguno' || state.next.resolveFollowUps.length > 0,
    }),
    [state],
  );

  return (
    <div className="-mt-1">
      {/* Cabecera mínima y fija */}
      <div className="glass sticky top-14 z-20 -mx-4 mb-4 border-b px-4 py-2.5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <IconButton icon={ArrowLeft} label="Volver a la ficha" size="sm" onClick={leave} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              <Link to={`/pacientes/${patient.id}`} className="hover:text-brand-700">
                {patient.fullName}
              </Link>
              <span className="font-normal text-ink-3">
                {' '}
                · {CONSULTATION_TYPE.labels[state.type]} · inició {fmtTimeOf(consultation.date)}
              </span>
            </p>
            <SaveIndicator status={autosave.status} />
          </div>
          <Popover width="w-52" trigger={(p) => <IconButton {...p} icon={MoreHorizontal} label="Más opciones" size="sm" />}>
            {({ close: closeMenu }) => (
              <MenuItem icon={Trash2} close={closeMenu} onClick={onDiscard} danger>
                Descartar borrador
              </MenuItem>
            )}
          </Popover>
          <Button size="sm" icon={Check} onClick={() => goTo('revisar')} className={cn(step === 'revisar' && 'invisible')}>
            Cerrar consulta
          </Button>
        </div>
        {/* Pasos como pestañas */}
        <div role="tablist" aria-label="Pasos de la consulta" className="mt-2.5 flex gap-1 overflow-x-auto scrollbar-thin">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              role="tab"
              type="button"
              aria-selected={step === s.key}
              onClick={() => goTo(s.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                step === s.key ? 'bg-brand-700 text-white shadow-sm' : 'text-ink-3 hover:bg-slate-900/5 hover:text-ink',
              )}
            >
              <span className={cn('grid size-5 place-items-center rounded-full text-[11px]', step === s.key ? 'bg-white/20' : filled[s.key] ? 'bg-brand-100 text-brand-800' : 'bg-slate-200 text-ink-3')}>
                {filled[s.key] && step !== s.key ? <Check aria-hidden className="size-3" /> : i + 1}
              </span>
              {s.label}
              {s.key === 'expediente' && <span className="sr-only">(opcional)</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {step === 'notas' && <NotesStep {...stepProps} />}
          {step === 'expediente' && <ClinicalStep {...stepProps} />}
          {step === 'mediciones' && <MeasurementsStep {...stepProps} />}
          {step === 'objetivos' && <GoalsStep {...stepProps} />}
          {step === 'siguiente' && <NextStep {...stepProps} />}
          {step === 'revisar' && <ReviewStep {...stepProps} onClose={onClose} closing={close.isPending} saveStatus={autosave.status} />}

          {step !== 'revisar' && (
            <div className="mt-5 flex justify-between gap-2">
              <Button variant="ghost" disabled={stepIndex === 0} onClick={() => goTo(STEPS[stepIndex - 1].key)}>
                Anterior
              </Button>
              <Button variant="secondary" onClick={() => goTo(STEPS[stepIndex + 1].key)}>
                Siguiente: {STEPS[stepIndex + 1].label}
              </Button>
            </div>
          )}
        </div>

        <aside aria-label="Contexto del paciente" className="order-first xl:order-none">
          <div className="card xl:sticky xl:top-40">
            <button
              type="button"
              onClick={() => setShowContext((v) => !v)}
              aria-expanded={showContext}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
            >
              Contexto del paciente
              <ChevronDown aria-hidden className={cn('size-4 text-ink-3 transition-transform', showContext && 'rotate-180')} />
            </button>
            {showContext && <PatientContext context={context} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PatientContext({ context }) {
  const c = context.clinical ?? {};
  const items = [
    ['Motivo', c.motivo],
    ['Alergias', c.alergias],
    ['Medicamentos', c.medicamentos],
    ['Antecedentes', c.patologicos],
  ].filter(([, v]) => v);
  return (
    <div className="space-y-3 border-t border-line/70 px-4 py-3 text-sm">
      {items.length === 0 && <p className="text-ink-3">Sin datos de expediente todavía.</p>}
      {items.map(([label, value]) => (
        <div key={label}>
          <p className={cn('text-xs font-medium', label === 'Alergias' ? 'text-red-700' : 'text-ink-3')}>
            {label === 'Alergias' && <AlertCircle aria-hidden className="mr-1 inline size-3.5" />}
            {label}
          </p>
          <p className="whitespace-pre-line text-ink">{value}</p>
        </div>
      ))}
      <p className="text-xs text-ink-3">
        Objetivos activos: {context.goals.length} · Seguimientos pendientes: {context.followUps.length}
      </p>
    </div>
  );
}

function SaveIndicator({ status }) {
  const map = {
    saved: [CheckCircle2, 'text-emerald-700', 'Borrador guardado'],
    dirty: [Loader2, 'text-ink-3', 'Cambios por guardar…'],
    saving: [Loader2, 'text-ink-3', 'Guardando…'],
    offline: [CloudOff, 'text-amber-700', 'Sin conexión: se guardará al reconectar'],
    error: [AlertCircle, 'text-red-700', 'No se pudo guardar: revisa los datos'],
  };
  const [Icon, color, label] = map[status];
  return (
    <p className={cn('flex items-center gap-1 text-xs', color)} aria-live="polite">
      <Icon aria-hidden className={cn('size-3.5', status === 'saving' && 'animate-spin')} />
      {label}
    </p>
  );
}

function ConsultationSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando consulta">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
