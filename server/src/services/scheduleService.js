import { APPOINTMENT_STATUS, canTransitionAppointment } from '@lanutria/shared';
import { Appointment, Catalog, FollowUp, Patient, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { addDays, startOfDay } from '../utils/query.js';
import { record } from './auditService.js';
import { refreshScheduleFields } from './patientService.js';
import { get as getSetting } from './settingsService.js';

const ACTIVE = ['programada', 'confirmada'];

// ───────────────────────────── Citas ─────────────────────────────

async function durationFor(type) {
  if (type) {
    const t = await Catalog.findOne({ type: 'appointment_type', key: type, active: true }).lean();
    if (!t) throw ApiError.validation([{ location: 'body', field: 'type', message: 'Tipo de cita inválido' }]);
    if (t.meta?.durationMin) return t.meta.durationMin;
  }
  return (await getSetting('agenda')).defaultDurationMin;
}

export async function findConflicts({ nutritionist, start, end, excludeId }, session) {
  return Appointment.find({
    nutritionist,
    status: { $in: ACTIVE },
    start: { $lt: end },
    end: { $gt: start },
    ...(excludeId && { _id: { $ne: excludeId } }),
  })
    .populate('patient', 'firstName lastName')
    .session(session ?? null);
}

async function assertNoConflict(params, force, session) {
  const conflicts = await findConflicts(params, session);
  if (!conflicts.length) return;
  const { allowOverlap } = await getSetting('agenda');
  if (allowOverlap && force) return;
  throw ApiError.conflict('El nutriólogo ya tiene una cita en ese horario', {
    canForce: allowOverlap,
    conflicts: conflicts.map((c) => ({
      id: c.id,
      start: c.start,
      end: c.end,
      patient: c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : null,
    })),
  });
}

export async function createAppointment(data, actor, { session, req } = {}) {
  const { patient: patientId, nutritionist = actor.id, start, durationMin, type, notes, force } = data;
  if (!(await Patient.exists({ _id: patientId, archivedAt: null }).session(session ?? null))) throw ApiError.notFound('Paciente');
  if (!(await User.exists({ _id: nutritionist, status: 'activo' }).session(session ?? null))) {
    throw ApiError.validation([{ location: 'body', field: 'nutritionist', message: 'Nutriólogo inválido' }]);
  }
  const minutes = durationMin ?? (await durationFor(type));
  const end = new Date(new Date(start).getTime() + minutes * 60_000);
  await assertNoConflict({ nutritionist, start, end }, force, session);

  const [appt] = await Appointment.create(
    [
      {
        patient: patientId,
        nutritionist,
        start,
        end,
        type: type ?? null,
        notes,
        createdBy: actor.id,
        statusHistory: [{ to: 'programada', by: actor.id }],
      },
    ],
    { session },
  );
  await refreshScheduleFields(patientId, session);
  if (req) await record({ req, action: 'appointments.create', resource: 'appointments', resourceId: appt.id, meta: { patient: patientId.toString() } });
  return appt;
}

export async function listAppointments({ from, to, nutritionist, patient, status }) {
  const filter = {};
  if (from || to) filter.start = { ...(from && { $gte: from }), ...(to && { $lt: to }) };
  if (nutritionist) filter.nutritionist = nutritionist;
  if (patient) filter.patient = patient;
  if (status) filter.status = { $in: status.split(',').filter((s) => APPOINTMENT_STATUS.values.includes(s)) };
  return Appointment.find(filter)
    .sort({ start: 1 })
    .limit(500)
    .populate('patient', 'firstName lastName contact.phone')
    .populate('nutritionist', 'name');
}

export async function getAppointment(id) {
  const appt = await Appointment.findById(id)
    .populate('patient', 'firstName lastName contact.phone')
    .populate('nutritionist', 'name')
    .populate('statusHistory.by', 'name');
  if (!appt) throw ApiError.notFound('Cita');
  return appt;
}

export async function updateAppointment(id, { notes, type }, actor, req) {
  const appt = await Appointment.findById(id);
  if (!appt) throw ApiError.notFound('Cita');
  if (!ACTIVE.includes(appt.status)) throw ApiError.conflict('La cita ya no se puede modificar');
  if (notes !== undefined) appt.notes = notes;
  if (type !== undefined) appt.type = type;
  await appt.save();
  await record({ req, action: 'appointments.update', resource: 'appointments', resourceId: id });
  return getAppointment(id);
}

export async function setAppointmentStatus(id, { status, reason }, actor, { session, req } = {}) {
  const appt = await Appointment.findById(id).session(session ?? null);
  if (!appt) throw ApiError.notFound('Cita');
  if (appt.status === status) return appt;
  if (!canTransitionAppointment(appt.status, status)) {
    throw ApiError.conflict(`No se puede pasar de "${APPOINTMENT_STATUS.labels[appt.status]}" a "${APPOINTMENT_STATUS.labels[status]}"`);
  }
  appt.statusHistory.push({ from: appt.status, to: status, by: actor.id, reason });
  appt.status = status;
  if (status === 'cancelada') appt.cancelReason = reason;
  await appt.save({ session });
  await refreshScheduleFields(appt.patient, session);
  if (req) await record({ req, action: 'appointments.status', resource: 'appointments', resourceId: id, meta: { to: status, patient: appt.patient.toString() } });
  return appt;
}

/** Reprogramar = nueva cita ligada + la original queda cancelada ("reprogramada"). */
export async function reschedule(id, { start, durationMin, force }, actor, req) {
  const old = await Appointment.findById(id);
  if (!old) throw ApiError.notFound('Cita');
  if (!['programada', 'confirmada', 'no_asistio'].includes(old.status)) {
    throw ApiError.conflict('Esta cita no se puede reprogramar');
  }
  const minutes = durationMin ?? Math.round((old.end - old.start) / 60_000);
  const end = new Date(new Date(start).getTime() + minutes * 60_000);
  await assertNoConflict({ nutritionist: old.nutritionist, start, end, excludeId: old._id }, force);

  const created = await Appointment.create({
    patient: old.patient,
    nutritionist: old.nutritionist,
    start,
    end,
    type: old.type,
    notes: old.notes,
    rescheduledFrom: old._id,
    createdBy: actor.id,
    statusHistory: [{ to: 'programada', by: actor.id, reason: 'Reprogramada' }],
  });
  if (ACTIVE.includes(old.status)) {
    old.statusHistory.push({ from: old.status, to: 'cancelada', by: actor.id, reason: 'Reprogramada' });
    old.status = 'cancelada';
    old.cancelReason = 'reprogramada';
  }
  old.rescheduledTo = created._id;
  await old.save();
  await refreshScheduleFields(old.patient);
  await record({ req, action: 'appointments.reschedule', resource: 'appointments', resourceId: id, meta: { newId: created.id, patient: old.patient.toString() } });
  return getAppointment(created.id);
}

/** Huecos libres de un nutriólogo en un día, según horario y duración. */
export async function freeSlots({ nutritionist, date, durationMin }) {
  const { openingHours } = await getSetting('clinic');
  const { slotMinutes, defaultDurationMin } = await getSetting('agenda');
  const minutes = durationMin ?? defaultDurationMin;
  const day = startOfDay(date);
  if (!openingHours.days.includes(day.getDay())) return [];

  const [sh, sm] = openingHours.start.split(':').map(Number);
  const [eh, em] = openingHours.end.split(':').map(Number);
  const open = new Date(day);
  open.setHours(sh, sm);
  const close = new Date(day);
  close.setHours(eh, em);

  const busy = await Appointment.find({
    nutritionist,
    status: { $in: ACTIVE },
    start: { $lt: close },
    end: { $gt: open },
  }).lean();

  const slots = [];
  const now = new Date();
  for (let t = open.getTime(); t + minutes * 60_000 <= close.getTime(); t += slotMinutes * 60_000) {
    const s = new Date(t);
    const e = new Date(t + minutes * 60_000);
    if (s < now) continue;
    if (busy.some((b) => b.start < e && b.end > s)) continue;
    slots.push({ start: s, end: e });
  }
  return slots;
}

// ─────────────────────────── Seguimientos ───────────────────────────

export async function listFollowUps({ status = 'pendiente', due, assignedTo, patient, page, limit }) {
  const filter = { status };
  if (assignedTo) filter.assignedTo = assignedTo;
  if (patient) filter.patient = patient;
  const today = startOfDay();
  if (due === 'overdue') filter.dueDate = { $lt: today };
  else if (due === 'today') filter.dueDate = { $gte: today, $lt: addDays(today, 1) };
  else if (due === 'week') filter.dueDate = { $lt: addDays(today, 7) };

  const [items, total] = await Promise.all([
    FollowUp.find(filter)
      .sort({ dueDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('patient', 'firstName lastName archivedAt')
      .populate('assignedTo', 'name'),
    FollowUp.countDocuments(filter),
  ]);
  return { items: items.filter((f) => f.patient && !f.patient.archivedAt), total };
}

export async function createFollowUp(patientId, { dueDate, reason, assignedTo }, actor, { session, consultationId, req } = {}) {
  const [fu] = await FollowUp.create(
    [
      {
        patient: patientId,
        dueDate,
        reason,
        assignedTo: assignedTo ?? actor.id,
        originConsultation: consultationId,
        createdBy: actor.id,
      },
    ],
    { session },
  );
  await refreshScheduleFields(patientId, session);
  if (req) await record({ req, action: 'followups.create', resource: 'followups', resourceId: fu.id, meta: { patient: patientId.toString() } });
  return fu;
}

export async function updateFollowUp(id, changes, actor, { session, req } = {}) {
  const fu = await FollowUp.findById(id).session(session ?? null);
  if (!fu) throw ApiError.notFound('Seguimiento');
  for (const f of ['dueDate', 'reason', 'assignedTo', 'resolutionNote']) {
    if (changes[f] !== undefined) fu[f] = changes[f];
  }
  if (changes.status && changes.status !== fu.status) {
    fu.status = changes.status;
    if (changes.status === 'pendiente') {
      fu.resolvedAt = undefined;
      fu.resolvedBy = undefined;
    } else {
      fu.resolvedAt = new Date();
      fu.resolvedBy = actor.id;
    }
  }
  await fu.save({ session });
  await refreshScheduleFields(fu.patient, session);
  if (req) await record({ req, action: 'followups.update', resource: 'followups', resourceId: id });
  return fu;
}
