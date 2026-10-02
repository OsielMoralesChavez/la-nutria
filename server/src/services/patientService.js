import mongoose from 'mongoose';
import { ageFrom, CLINICAL_SECTIONS } from '@lanutria/shared';
import { hasPermission } from '../middleware/authorize.js';
import {
  Alert,
  Appointment,
  Attachment,
  ClinicalRecord,
  ClinicalRecordRevision,
  Consultation,
  FollowUp,
  Goal,
  Measurement,
  Patient,
  User,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { addDays, escapeRegex, normalizeText } from '../utils/query.js';
import { record } from './auditService.js';
import { listByPatient as listGoals } from './goalService.js';
import { activeMetricDefinitions, baselineValuesByMetric, latestValuesByMetric, sparklines } from './measurementService.js';

/**
 * Regla de propiedad: reasignar/archivar requiere ser el responsable o tener
 * `patients:manage`. Se valida aquí (no sólo en la UI) porque depende del recurso.
 */
export function assertCanManagePatient(actor, patient) {
  if (hasPermission(actor, 'patients:manage')) return;
  if (hasPermission(actor, 'patients:update') && patient.primaryNutritionist.toString() === actor.id) return;
  throw ApiError.forbidden('Sólo el nutriólogo responsable o un administrador puede realizar esta acción');
}

export async function findOrThrow(id, { includeArchived = false } = {}) {
  const patient = await Patient.findById(id);
  if (!patient || (!includeArchived && patient.archivedAt)) throw ApiError.notFound('Paciente');
  return patient;
}

const serialize = (p) => {
  const json = p.toJSON ? p.toJSON() : p;
  return { ...json, age: ageFrom(json.birthDate) };
};

export async function list(actor, query) {
  const { q, status, responsible, tag, withAlerts, noRecentDays, newDays, archived, page, limit, sort } = query;
  const filter = { archivedAt: archived ? { $ne: null } : null };

  if (status) filter.status = status;
  if (responsible === 'me') filter.primaryNutritionist = actor.id;
  else if (responsible) filter.primaryNutritionist = responsible;
  if (tag) filter.tags = tag;
  if (newDays) filter.createdAt = { $gte: addDays(new Date(), -newDays) };
  if (noRecentDays) {
    filter.status = filter.status ?? 'activo';
    filter.$or = [{ lastConsultationAt: { $lt: addDays(new Date(), -noRecentDays) } }, { lastConsultationAt: null }];
  }
  if (q) {
    const term = normalizeText(q);
    const digits = q.replace(/\D/g, '');
    const parts = [escapeRegex(term)];
    if (digits.length >= 4) parts.push(escapeRegex(digits));
    filter.searchText = new RegExp(parts.join('|'));
  }
  if (withAlerts) {
    const ids = await Alert.distinct('patient', { status: 'abierta' });
    filter._id = { $in: ids };
  }

  const sortSpec =
    {
      name: { lastName: 1, firstName: 1 },
      recent: { lastConsultationAt: -1 },
      next: { nextAppointmentAt: 1 },
      created: { createdAt: -1 },
    }[sort] ?? { lastName: 1, firstName: 1 };

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .populate('primaryNutritionist', 'name')
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit),
    Patient.countDocuments(filter),
  ]);

  const ids = patients.map((p) => p.id);
  const [trends, alertCounts] = await Promise.all([
    sparklines(ids, 'peso'),
    Alert.aggregate([
      { $match: { patient: { $in: patients.map((p) => p._id) }, status: 'abierta' } },
      { $group: { _id: '$patient', count: { $sum: 1 } } },
    ]),
  ]);
  const alertsBy = new Map(alertCounts.map((a) => [a._id.toString(), a.count]));

  return {
    items: patients.map((p) => ({
      ...serialize(p),
      trend: trends[p.id] ?? null,
      openAlerts: alertsBy.get(p.id) ?? 0,
    })),
    total,
  };
}

/**
 * Busca posibles duplicados: mismo teléfono, o mismo nombre + fecha de nacimiento.
 */
export async function findDuplicates({ firstName, lastName, birthDate, contact }) {
  const digits = contact?.phone?.replace(/\D/g, '');
  const name = normalizeText(`${firstName} ${lastName}`);
  const or = [];
  if (digits?.length >= 7) or.push({ searchText: new RegExp(escapeRegex(digits)) });
  if (birthDate) {
    const day = new Date(birthDate);
    or.push({
      searchText: new RegExp(`^${escapeRegex(name)}`),
      birthDate: { $gte: addDays(day, -1), $lte: addDays(day, 1) },
    });
  }
  if (!or.length) return [];
  const matches = await Patient.find({ $or: or, archivedAt: null }).limit(5);
  return matches.map((p) => ({ id: p.id, fullName: p.fullName, age: ageFrom(p.birthDate), phone: p.contact.phone }));
}

export async function create(actor, data, req) {
  const { force, ...fields } = data;
  if (!force) {
    const duplicates = await findDuplicates(fields);
    if (duplicates.length) throw ApiError.conflict('Posible paciente duplicado', { duplicates });
  }

  const primaryNutritionist = fields.primaryNutritionist ?? actor.id;
  if (!(await User.exists({ _id: primaryNutritionist, status: 'activo' }))) {
    throw ApiError.validation([{ location: 'body', field: 'primaryNutritionist', message: 'Nutriólogo inválido' }]);
  }

  const patient = new Patient({
    ...fields,
    primaryNutritionist,
    createdBy: actor.id,
    statusHistory: [{ to: 'activo', by: actor.id, reason: 'Alta' }],
  });
  await patient.save();
  await ClinicalRecord.create({ patient: patient._id });
  await record({ req, action: 'patients.create', resource: 'patients', resourceId: patient.id });
  return get(patient.id);
}

export async function get(id) {
  const patient = await Patient.findById(id).populate('primaryNutritionist', 'name email');
  if (!patient) throw ApiError.notFound('Paciente');
  return serialize(patient);
}

export async function update(actor, id, changes, req) {
  const patient = await findOrThrow(id);
  const changedFields = [];
  for (const [key, value] of Object.entries(changes)) {
    if (key === 'contact') {
      for (const [ck, cv] of Object.entries(value)) {
        if (patient.contact[ck] !== cv) {
          patient.contact[ck] = cv;
          changedFields.push(`contact.${ck}`);
        }
      }
    } else if (JSON.stringify(patient[key]) !== JSON.stringify(value)) {
      patient[key] = value;
      changedFields.push(key);
    }
  }
  if (changedFields.length) {
    await patient.save();
    await record({ req, action: 'patients.update', resource: 'patients', resourceId: id, meta: { changedFields } });
  }
  return get(id);
}

export async function setStatus(actor, id, { status, reason }, req) {
  const patient = await findOrThrow(id);
  if (patient.status === status) return get(id);
  patient.statusHistory.push({ from: patient.status, to: status, reason, by: actor.id });
  const from = patient.status;
  patient.status = status;
  await patient.save();
  await record({ req, action: 'patients.status', resource: 'patients', resourceId: id, meta: { from, to: status } });
  return get(id);
}

export async function assign(actor, id, { nutritionist }, req) {
  const patient = await findOrThrow(id);
  assertCanManagePatient(actor, patient);
  if (!(await User.exists({ _id: nutritionist, status: 'activo' }))) {
    throw ApiError.validation([{ location: 'body', field: 'nutritionist', message: 'Nutriólogo inválido' }]);
  }
  const from = patient.primaryNutritionist.toString();
  patient.primaryNutritionist = nutritionist;
  await patient.save();
  await record({ req, action: 'patients.assign', resource: 'patients', resourceId: id, meta: { from, to: nutritionist } });
  return get(id);
}

export async function archive(actor, id, req) {
  const patient = await findOrThrow(id);
  assertCanManagePatient(actor, patient);
  patient.archivedAt = new Date();
  patient.archivedBy = actor.id;
  await patient.save();
  // Las alertas abiertas de un paciente archivado dejan de tener sentido.
  await Alert.updateMany(
    { patient: id, status: { $in: ['abierta', 'pospuesta'] } },
    { status: 'descartada', resolution: 'auto', resolvedAt: new Date(), resolutionNote: 'Paciente archivado' },
  );
  await record({ req, action: 'patients.archive', resource: 'patients', resourceId: id });
  return get(id);
}

export async function restore(actor, id, req) {
  const patient = await findOrThrow(id, { includeArchived: true });
  assertCanManagePatient(actor, patient);
  patient.archivedAt = undefined;
  patient.archivedBy = undefined;
  await patient.save();
  await record({ req, action: 'patients.restore', resource: 'patients', resourceId: id });
  return get(id);
}

/**
 * Borrado físico (sólo `patients:delete`, Superusuario). Debe ser excepcional:
 * la normativa de expediente clínico exige conservarlo. Elimina todo lo
 * relacionado para no dejar datos huérfanos.
 */
export async function hardDelete(actor, id, { confirmName }, req) {
  const patient = await findOrThrow(id, { includeArchived: true });
  if (normalizeText(confirmName) !== normalizeText(patient.fullName)) {
    throw ApiError.validation([{ location: 'body', field: 'confirmName', message: 'El nombre no coincide' }]);
  }
  const filter = { patient: id };
  await Promise.all([
    Consultation.deleteMany(filter),
    Measurement.deleteMany(filter),
    Goal.deleteMany(filter),
    FollowUp.deleteMany(filter),
    Appointment.deleteMany(filter),
    Alert.deleteMany(filter),
    ClinicalRecord.deleteMany(filter),
    ClinicalRecordRevision.deleteMany(filter),
    Attachment.updateMany(filter, { deletedAt: new Date(), deletedBy: actor.id }),
  ]);
  await patient.deleteOne();
  await record({ req, action: 'patients.hard_delete', resource: 'patients', resourceId: id });
}

/**
 * Datos de la Ficha 360°: responde las cuatro preguntas en una sola llamada.
 *   ① inicio   ② intervenciones   ③ evolución   ④ siguiente
 */
export async function summary(id) {
  const patient = await get(id);
  const pid = new mongoose.Types.ObjectId(id);

  const [
    metricDefs,
    baseline,
    latest,
    goals,
    firstConsultation,
    recentConsultations,
    consultationCount,
    lastPlanChange,
    clinical,
    nextAppointments,
    followUps,
    alerts,
    attachmentCount,
  ] = await Promise.all([
    activeMetricDefinitions(),
    baselineValuesByMetric(id),
    latestValuesByMetric(id),
    listGoals(id),
    Consultation.findOne({ patient: pid, status: 'cerrada' }).sort({ date: 1 }).populate('nutritionist', 'name'),
    Consultation.find({ patient: pid, status: 'cerrada' }).sort({ date: -1 }).limit(4).populate('nutritionist', 'name'),
    Consultation.countDocuments({ patient: pid, status: 'cerrada' }),
    Consultation.findOne({ patient: pid, status: 'cerrada', 'notes.soap.p': { $nin: [null, ''] } }).sort({ date: -1 }).select('date'),
    ClinicalRecord.findOne({ patient: pid }),
    Appointment.find({ patient: pid, start: { $gte: new Date() }, status: { $in: ['programada', 'confirmada'] } })
      .sort({ start: 1 })
      .limit(3)
      .populate('nutritionist', 'name'),
    FollowUp.find({ patient: pid, status: 'pendiente' }).sort({ dueDate: 1 }).limit(10),
    Alert.find({ patient: pid, status: 'abierta' }).sort({ rank: 1, createdAt: -1 }).limit(10),
    Attachment.countDocuments({ patient: pid, deletedAt: null }),
  ]);

  // "Anterior" = penúltimo valor de cada métrica.
  const previous = latest && Object.keys(latest).length
    ? await previousValuesByMetric(pid)
    : {};

  const metrics = metricDefs
    .filter((d) => baseline[d.key] || latest[d.key])
    .map((d) => {
      const goal = goals.find((g) => g.metric === d.key && g.status === 'en_curso');
      return {
        key: d.key,
        label: d.label,
        unit: d.unit,
        decimals: d.decimals,
        baseline: baseline[d.key] ?? null,
        previous: previous[d.key] ?? null,
        current: latest[d.key] ?? null,
        target: goal ? { value: goal.target, goalId: goal.id, direction: goal.direction, progress: goal.progress } : null,
      };
    });

  const activeGoals = goals.filter((g) => g.status === 'en_curso');
  const soon = addDays(new Date(), 14);
  const goalsDueSoon = activeGoals.filter((g) => g.dueDate && new Date(g.dueDate) <= soon);
  const pick = (key) => clinical?.sections?.[key] || '';
  const sectionLabel = Object.fromEntries(CLINICAL_SECTIONS.map((s) => [s.key, s.label]));

  return {
    patient,
    // ① ¿Cómo inició?
    start: {
      firstConsultation: firstConsultation
        ? { id: firstConsultation.id, date: firstConsultation.date, nutritionist: firstConsultation.nutritionist?.name, reason: firstConsultation.reason }
        : null,
      reason: pick('motivo') || firstConsultation?.reason || '',
      baseline: metrics.filter((m) => m.baseline).map((m) => ({ key: m.key, label: m.label, unit: m.unit, ...m.baseline })),
      initialGoals: goals.filter((g) => firstConsultation && g.createdIn?.toString() === firstConsultation.id).length,
      clinicalHighlights: ['patologicos', 'medicamentos', 'alergias']
        .filter((k) => pick(k))
        .map((k) => ({ key: k, label: sectionLabel[k], text: pick(k) })),
      clinicalVersion: clinical?.version ?? 0,
    },
    // ② ¿Qué se hizo?
    interventions: {
      consultationCount,
      lastPlanChangeAt: lastPlanChange?.date ?? null,
      monthsInTreatment: firstConsultation
        ? Math.max(0, Math.round((Date.now() - firstConsultation.date.getTime()) / (30.44 * 864e5)))
        : 0,
      recent: recentConsultations.map((c) => ({
        id: c.id,
        date: c.date,
        type: c.type,
        nutritionist: c.nutritionist?.name,
        excerpt: (c.notes?.freeText || c.notes?.soap?.p || c.notes?.soap?.a || c.reason || '').slice(0, 160),
        changes: c.summary?.changes ?? [],
      })),
      attachmentCount,
    },
    // ③ ¿Cómo va?
    progress: {
      metrics,
      goals,
      goalsActive: activeGoals.length,
      goalsReached: goals.filter((g) => g.status === 'logrado').length,
      lastMeasurementAt: patient.lastMeasurementAt ?? null,
    },
    // ④ ¿Qué sigue?
    next: {
      appointments: nextAppointments,
      followUps,
      goalsDueSoon,
      alerts,
    },
  };
}

async function previousValuesByMetric(pid) {
  const rows = await Measurement.aggregate([
    { $match: { patient: pid } },
    { $sort: { takenAt: -1 } },
    { $unwind: '$values' },
    { $group: { _id: '$values.metric', vals: { $push: { value: '$values.value', takenAt: '$takenAt' } } } },
    { $project: { prev: { $arrayElemAt: ['$vals', 1] } } },
  ]);
  return Object.fromEntries(rows.filter((r) => r.prev).map((r) => [r._id, r.prev]));
}

/** Mantiene los campos desnormalizados del paciente. */
export async function refreshScheduleFields(patientId, session) {
  const now = new Date();
  const [nextAppt, nextFu] = await Promise.all([
    Appointment.findOne({ patient: patientId, start: { $gte: now }, status: { $in: ['programada', 'confirmada'] } })
      .sort({ start: 1 })
      .session(session ?? null),
    FollowUp.findOne({ patient: patientId, status: 'pendiente' }).sort({ dueDate: 1 }).session(session ?? null),
  ]);
  await Patient.updateOne(
    { _id: patientId },
    { nextAppointmentAt: nextAppt?.start ?? null, nextFollowUpAt: nextFu?.dueDate ?? null },
    { session },
  );
}
