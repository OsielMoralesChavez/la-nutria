import mongoose from 'mongoose';
import { Appointment, Attachment, ClinicalRecordRevision, Consultation, Goal, Patient } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Línea de tiempo compuesta al vuelo (no se guarda: una sola fuente de verdad).
 * Lo ocurrido DENTRO de una consulta se agrupa en el evento de la consulta;
 * el resto aparece como evento independiente.
 *
 * Paginación por cursor de fecha (`before`).
 */
export async function build(patientId, { before, limit = 20, types }) {
  const patient = await Patient.findById(patientId).populate('statusHistory.by', 'name');
  if (!patient) throw ApiError.notFound('Paciente');

  const pid = new mongoose.Types.ObjectId(patientId);
  const want = (t) => !types?.length || types.includes(t);
  const dateLt = (field) => (before ? { [field]: { $lt: before } } : {});
  const events = [];

  if (want('consulta') || want('medicion')) {
    const consultations = await Consultation.find({ patient: pid, status: 'cerrada', ...dateLt('date') })
      .sort({ date: -1 })
      .limit(limit + 1)
      .select('-draft')
      .populate('nutritionist', 'name');
    const ids = consultations.map((c) => c._id);
    const [goalsIn, revisionsIn, filesIn] = await Promise.all([
      Goal.find({ createdIn: { $in: ids } }).select('title createdIn'),
      ClinicalRecordRevision.find({ consultation: { $in: ids } }).select('version changedFields consultation'),
      Attachment.find({ consultation: { $in: ids }, deletedAt: null }).select('kind category originalName consultation'),
    ]);
    const by = (arr, key) => (id) => arr.filter((x) => x[key]?.toString() === id);
    const goalsOf = by(goalsIn, 'createdIn');
    const revsOf = by(revisionsIn, 'consultation');
    const filesOf = by(filesIn, 'consultation');

    for (const c of consultations) {
      events.push({
        id: `consulta:${c.id}`,
        type: 'consulta',
        date: c.date,
        title: c.type === 'inicial' ? 'Consulta inicial' : 'Consulta de seguimiento',
        actor: c.nutritionist?.name,
        consultationId: c.id,
        isStart: c.type === 'inicial',
        reason: c.reason,
        excerpt: (c.notes?.freeText || c.notes?.soap?.a || c.notes?.soap?.p || '').slice(0, 220),
        changes: c.summary?.changes ?? [],
        goalsCreated: goalsOf(c.id).map((g) => ({ id: g.id, title: g.title })),
        goalsUpdated: c.summary?.goalsUpdated ?? 0,
        clinicalChanges: revsOf(c.id).flatMap((r) => r.changedFields),
        attachments: filesOf(c.id).map((f) => ({ id: f.id, kind: f.kind, name: f.originalName })),
        nextAction: c.summary?.nextAction ?? null,
        addenda: c.addenda.length,
      });
    }
  }

  if (want('objetivo')) {
    const goals = await Goal.find({
      patient: pid,
      $or: [{ createdIn: null, ...dateLt('createdAt') }, { closedAt: { $ne: null, ...(before && { $lt: before }) } }],
    })
      .sort({ updatedAt: -1 })
      .limit(limit + 1);
    for (const g of goals) {
      if (!g.createdIn && (!before || g.createdAt < before)) {
        events.push({ id: `objetivo:${g.id}:creado`, type: 'objetivo', date: g.createdAt, title: `Objetivo definido: ${g.title}`, goalId: g.id });
      }
      if (g.closedAt && (!before || g.closedAt < before)) {
        events.push({ id: `objetivo:${g.id}:${g.status}`, type: 'objetivo', date: g.closedAt, title: `Objetivo ${g.status.replace('_', ' ')}: ${g.title}`, goalId: g.id, status: g.status });
      }
    }
  }

  if (want('expediente')) {
    const revs = await ClinicalRecordRevision.find({ patient: pid, consultation: null, ...dateLt('createdAt') })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate('changedBy', 'name');
    for (const r of revs) {
      events.push({
        id: `expediente:${r.version}`,
        type: 'expediente',
        date: r.createdAt,
        title: 'Expediente actualizado',
        actor: r.changedBy?.name,
        version: r.version,
        changedFields: r.changedFields,
      });
    }
  }

  if (want('cita')) {
    // Las citas realizadas ya están representadas por su consulta.
    const appts = await Appointment.find({ patient: pid, status: { $in: ['cancelada', 'no_asistio'] }, ...dateLt('start') })
      .sort({ start: -1 })
      .limit(limit + 1);
    for (const a of appts) {
      events.push({
        id: `cita:${a.id}`,
        type: 'cita',
        date: a.start,
        title: a.status === 'no_asistio' ? 'No asistió a la cita' : a.cancelReason === 'reprogramada' ? 'Cita reprogramada' : 'Cita cancelada',
        status: a.status,
        appointmentId: a.id,
      });
    }
  }

  if (want('archivo')) {
    const files = await Attachment.find({ patient: pid, consultation: null, deletedAt: null, ...dateLt('takenAt') })
      .sort({ takenAt: -1 })
      .limit(limit + 1);
    for (const f of files) {
      events.push({ id: `archivo:${f.id}`, type: 'archivo', date: f.takenAt, title: f.kind === 'foto' ? 'Fotografía agregada' : `Documento: ${f.originalName}`, attachmentId: f.id });
    }
  }

  if (want('estado')) {
    for (const s of patient.statusHistory) {
      if (before && s.at >= before) continue;
      events.push({
        id: `estado:${s.at.getTime()}`,
        type: 'estado',
        date: s.at,
        title: s.from ? `Estado: ${s.from} → ${s.to}` : 'Paciente registrado',
        actor: s.by?.name,
        reason: s.reason,
      });
    }
  }

  events.sort((a, b) => new Date(b.date) - new Date(a.date));
  const page = events.slice(0, limit);
  const nextCursor = events.length > limit ? page[page.length - 1].date : null;
  return { items: page, nextCursor };
}
