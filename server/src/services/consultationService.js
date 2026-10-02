import mongoose from 'mongoose';
import { hasPermission } from '../middleware/authorize.js';
import { Appointment, Consultation, Patient } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { record } from './auditService.js';
import { reconcilePatient } from './alertService.js';
import * as clinical from './clinicalRecordService.js';
import * as goals from './goalService.js';
import * as measurements from './measurementService.js';
import { findOrThrow, refreshScheduleFields } from './patientService.js';
import * as schedule from './scheduleService.js';

const populate = (q) => q.populate('nutritionist', 'name').populate('closedBy', 'name').populate('addenda.by', 'name');

export async function get(id) {
  const c = await populate(Consultation.findById(id));
  if (!c) throw ApiError.notFound('Consulta');
  return c;
}

export async function listByPatient(patientId, { page, limit, status }) {
  const filter = { patient: patientId, ...(status && { status }) };
  const [items, total] = await Promise.all([
    populate(Consultation.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit)).select('-draft'),
    Consultation.countDocuments(filter),
  ]);
  return { items, total };
}

/**
 * Inicia una consulta. Si el mismo nutriólogo ya tiene un borrador con el
 * paciente, lo devuelve en lugar de crear otro (evita duplicados por doble clic
 * o por volver a entrar).
 */
export async function start(patientId, { appointment: appointmentId, type, reason }, actor, req) {
  await findOrThrow(patientId);

  const existing = await Consultation.findOne({ patient: patientId, nutritionist: actor.id, status: 'borrador' });
  if (existing) return { consultation: await get(existing.id), resumed: true };

  if (appointmentId) {
    const appt = await Appointment.findOne({ _id: appointmentId, patient: patientId });
    if (!appt) throw ApiError.notFound('Cita');
    if (!['programada', 'confirmada'].includes(appt.status)) throw ApiError.conflict('La cita no está activa');
  }

  const closedCount = await Consultation.countDocuments({ patient: patientId, status: 'cerrada' });
  const c = await Consultation.create({
    patient: patientId,
    nutritionist: actor.id,
    appointment: appointmentId,
    type: type ?? (closedCount === 0 ? 'inicial' : 'seguimiento'),
    reason: reason ?? '',
    date: new Date(),
    draft: {},
  });
  if (appointmentId) await Appointment.updateOne({ _id: appointmentId }, { consultation: c._id });
  await record({ req, action: 'consultations.start', resource: 'consultations', resourceId: c.id, meta: { patient: patientId } });
  return { consultation: await get(c.id), resumed: false };
}

function assertDraftEditable(c, actor) {
  if (c.status !== 'borrador') throw ApiError.conflict('La consulta ya está cerrada; agrega una adenda');
  const owner = (c.nutritionist._id ?? c.nutritionist).toString();
  if (owner !== actor.id && !hasPermission(actor, 'patients:manage')) {
    throw ApiError.forbidden('Sólo quien inició la consulta puede editar el borrador');
  }
}

/** Autoguardado: reemplaza las secciones enviadas del borrador. */
export async function saveDraft(id, { reason, type, notes, draft }, actor) {
  const c = await Consultation.findById(id);
  if (!c) throw ApiError.notFound('Consulta');
  assertDraftEditable(c, actor);

  if (reason !== undefined) c.reason = reason;
  if (type !== undefined) c.type = type;
  if (notes !== undefined) {
    c.notes = {
      freeText: notes.freeText ?? c.notes?.freeText ?? '',
      soap: notes.soap === undefined ? c.notes?.soap ?? null : notes.soap,
    };
  }
  if (draft !== undefined) {
    c.draft = { ...(c.draft ?? {}), ...draft };
    c.markModified('draft');
  }
  await c.save();
  return { id: c.id, updatedAt: c.updatedAt };
}

export async function discard(id, actor, req) {
  const c = await Consultation.findById(id);
  if (!c) throw ApiError.notFound('Consulta');
  assertDraftEditable(c, actor);
  if (c.appointment) await Appointment.updateOne({ _id: c.appointment }, { $unset: { consultation: 1 } });
  await c.deleteOne();
  await record({ req, action: 'consultations.discard', resource: 'consultations', resourceId: id });
}

/**
 * Cierra la consulta en UNA transacción: convierte el borrador en registros
 * reales (medición, objetivos, expediente, próxima cita/seguimiento),
 * actualiza la cita de origen y los campos desnormalizados del paciente.
 * Después reconcilia las alertas del paciente.
 */
export async function close(id, actor, req) {
  const pre = await Consultation.findById(id);
  if (!pre) throw ApiError.notFound('Consulta');
  assertDraftEditable(pre, actor);

  const patientId = pre.patient.toString();
  let summaryChanges = [];

  await mongoose.connection.transaction(async (session) => {
    const c = await Consultation.findById(id).session(session);
    if (c.status !== 'borrador') throw ApiError.conflict('La consulta ya fue cerrada');
    const draft = c.draft ?? {};
    const now = new Date();

    // 1. Mediciones
    const values = (draft.measurement?.values ?? []).filter((v) => typeof v.value === 'number' && Number.isFinite(v.value));
    const before = await measurements.latestValuesByMetric(patientId);
    // Valores vigentes tras esta consulta (para líneas base de objetivos nuevos).
    const latest = { ...before };
    if (values.length) {
      const m = await measurements.create(
        {
          patientId,
          consultationId: c.id,
          takenAt: c.date,
          method: draft.measurement.method ?? null,
          device: draft.measurement.device,
          values,
        },
        actor,
        session,
      );
      if (m) {
        c.measurement = m._id;
        for (const v of m.values) latest[v.metric] = { value: v.value, takenAt: m.takenAt };
        summaryChanges = m.values.map((v) => ({
          metric: v.metric,
          value: v.value,
          delta: before[v.metric] ? Number((v.value - before[v.metric].value).toFixed(2)) : null,
        }));
      }
    }

    // 2. Objetivos: actualizaciones, avances cualitativos y nuevos
    let goalsUpdated = 0;
    for (const u of draft.goals?.updates ?? []) {
      const { goalId, checkpoint, ...changes } = u;
      if (Object.keys(changes).length) {
        await goals.update(goalId, changes, actor, { session });
        goalsUpdated += 1;
      }
      if (checkpoint && typeof checkpoint.score === 'number') {
        await goals.addCheckpoint(goalId, { ...checkpoint, consultationId: c.id }, actor, { session });
        goalsUpdated += 1;
      }
    }
    for (const g of draft.goals?.create ?? []) {
      await goals.create(patientId, g, actor, { session, consultationId: c.id, latest });
      goalsUpdated += 1;
    }

    // 3. Expediente
    if (draft.clinical && Object.keys(draft.clinical).length) {
      await clinical.update(patientId, draft.clinical, actor, { consultationId: c.id, session });
    }

    // 4. ¿Qué sigue?
    let nextAction = null;
    if (draft.next?.appointment?.start) {
      const a = await schedule.createAppointment(
        { patient: patientId, ...draft.next.appointment, force: true },
        actor,
        { session },
      );
      nextAction = `Cita ${a.start.toISOString()}`;
    }
    if (draft.next?.followUp?.dueDate && draft.next.followUp.reason) {
      await schedule.createFollowUp(patientId, draft.next.followUp, actor, { session, consultationId: c.id });
      nextAction = nextAction ?? `Seguimiento: ${draft.next.followUp.reason}`;
    }
    for (const fuId of draft.next?.resolveFollowUps ?? []) {
      await schedule.updateFollowUp(fuId, { status: 'realizado', resolutionNote: 'Resuelto en consulta' }, actor, { session });
    }

    // 5. Cita de origen → realizada
    if (c.appointment) {
      const appt = await Appointment.findById(c.appointment).session(session);
      if (appt && ['programada', 'confirmada'].includes(appt.status)) {
        await schedule.setAppointmentStatus(appt.id, { status: 'realizada' }, actor, { session });
      }
    }

    // 6. Cierre
    c.status = 'cerrada';
    c.closedAt = now;
    c.closedBy = actor.id;
    c.summary = { changes: summaryChanges, goalsUpdated, nextAction };
    c.draft = {};
    c.markModified('draft');
    await c.save({ session });

    // 7. Campos desnormalizados del paciente
    const patient = await Patient.findById(patientId).session(session);
    patient.lastConsultationAt = c.date;
    if (!patient.firstConsultationAt || c.date < patient.firstConsultationAt) patient.firstConsultationAt = c.date;
    await patient.save({ session });
    await refreshScheduleFields(patientId, session);
  });

  await record({ req, action: 'consultations.close', resource: 'consultations', resourceId: id, meta: { patient: patientId } });
  // Fuera de la transacción: si falla, no debe revertir la consulta.
  await reconcilePatient(patientId).catch((err) => req?.log?.error({ err }, 'Error reconciliando alertas'));
  return get(id);
}

export async function addAddendum(id, { text }, actor, req) {
  const c = await Consultation.findById(id);
  if (!c) throw ApiError.notFound('Consulta');
  if (c.status !== 'cerrada') throw ApiError.conflict('Las adendas sólo aplican a consultas cerradas');
  c.addenda.push({ text, by: actor.id, at: new Date() });
  await c.save();
  await record({ req, action: 'consultations.addendum', resource: 'consultations', resourceId: id });
  return get(id);
}

/**
 * Contexto para el modo consulta: valores anterior/inicio por métrica,
 * objetivos activos con progreso, seguimientos pendientes y datos clave del
 * expediente. Así la pantalla de captura no hace N llamadas.
 */
export async function context(id) {
  const c = await get(id);
  const patientId = c.patient.toString();
  const before = c.status === 'cerrada' ? c.date : undefined;
  const [metricDefs, previous, baseline, activeGoals, followUps, record_, nextAppointments] = await Promise.all([
    measurements.activeMetricDefinitions(),
    measurements.latestValuesByMetric(patientId, { before }),
    measurements.baselineValuesByMetric(patientId),
    goals.listByPatient(patientId, { status: 'en_curso' }),
    schedule.listFollowUps({ status: 'pendiente', patient: patientId, page: 1, limit: 50 }),
    clinical.get(patientId),
    Appointment.find({ patient: patientId, start: { $gt: new Date() }, status: { $in: ['programada', 'confirmada'] } }).sort({ start: 1 }).limit(3),
  ]);
  return {
    consultation: c,
    metrics: metricDefs,
    previous,
    baseline,
    goals: activeGoals,
    followUps: followUps.items,
    clinical: record_.sections,
    nextAppointments,
  };
}
