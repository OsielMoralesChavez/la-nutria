import { Appointment, FollowUp, Goal, Patient } from '../models/index.js';
import { addDays, startOfDay } from '../utils/query.js';

/**
 * Reglas de alerta OPERATIVAS. Ninguna contiene umbrales clínicos.
 *
 * Cada regla define:
 *   - defaults: parámetros, severidad y si viene activa (todo editable en
 *     Configuración → Alertas; el seed sólo los usa la primera vez)
 *   - params: descriptor para que la UI arme el formulario
 *   - evaluate({ params, patientId }) → situaciones vigentes
 *
 * Agregar una regla = agregar un objeto aquí (el seed crea su documento).
 */

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: process.env.TZ || 'America/Mexico_City' });
const fmtDateTime = (d) =>
  new Date(d).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TZ || 'America/Mexico_City',
  });
const fullName = (p) => (p ? `${p.firstName} ${p.lastName}` : 'Paciente');
const scope = (patientId) => (patientId ? { patient: patientId } : {});
const activePatients = (patientId) => ({ archivedAt: null, status: 'activo', ...(patientId && { _id: patientId }) });

export const RULES = [
  {
    key: 'followup_overdue',
    label: 'Seguimiento vencido',
    description: 'Un seguimiento pendiente pasó su fecha.',
    defaults: { enabled: true, severity: 'alta', params: { graceDays: 0 } },
    params: [{ key: 'graceDays', label: 'Días de tolerancia después de la fecha', type: 'number', min: 0, max: 60 }],
    async evaluate({ params, patientId }) {
      const limit = addDays(startOfDay(), -(params.graceDays ?? 0));
      const items = await FollowUp.find({ status: 'pendiente', dueDate: { $lt: limit }, ...scope(patientId) }).populate(
        'patient',
        'firstName lastName archivedAt',
      );
      return items
        .filter((f) => f.patient && !f.patient.archivedAt)
        .map((f) => ({
          patient: f.patient._id,
          assignedTo: f.assignedTo,
          dedupeKey: `followup_overdue:${f.id}`,
          source: { kind: 'followup', id: f._id },
          dueAt: f.dueDate,
          message: `Seguimiento vencido (${fmtDate(f.dueDate)}): ${f.reason}`,
        }));
    },
  },
  {
    key: 'appointment_upcoming',
    label: 'Próxima consulta',
    description: 'Hay una cita próxima. Opcionalmente, sólo si aún no está confirmada.',
    defaults: { enabled: true, severity: 'media', params: { hoursBefore: 24, onlyUnconfirmed: true } },
    params: [
      { key: 'hoursBefore', label: 'Avisar con cuántas horas de anticipación', type: 'number', min: 1, max: 168 },
      { key: 'onlyUnconfirmed', label: 'Sólo citas sin confirmar', type: 'boolean' },
    ],
    async evaluate({ params, patientId }) {
      const now = new Date();
      const until = new Date(now.getTime() + (params.hoursBefore ?? 24) * 3_600_000);
      const statuses = params.onlyUnconfirmed === false ? ['programada', 'confirmada'] : ['programada'];
      const items = await Appointment.find({ status: { $in: statuses }, start: { $gte: now, $lte: until }, ...scope(patientId) }).populate(
        'patient',
        'firstName lastName archivedAt',
      );
      return items
        .filter((a) => a.patient && !a.patient.archivedAt)
        .map((a) => ({
          patient: a.patient._id,
          assignedTo: a.nutritionist,
          dedupeKey: `appointment_upcoming:${a.id}`,
          source: { kind: 'appointment', id: a._id },
          dueAt: a.start,
          message: `Cita ${fmtDateTime(a.start)}${a.status === 'programada' ? ' · sin confirmar' : ''}`,
        }));
    },
  },
  {
    key: 'goal_due',
    label: 'Objetivo próximo a vencer',
    description: 'Un objetivo en curso vence pronto.',
    defaults: { enabled: true, severity: 'media', params: { daysBefore: 7 } },
    params: [{ key: 'daysBefore', label: 'Días antes del vencimiento', type: 'number', min: 1, max: 90 }],
    async evaluate({ params, patientId }) {
      const today = startOfDay();
      const items = await Goal.find({
        status: 'en_curso',
        dueDate: { $gte: today, $lte: addDays(today, params.daysBefore ?? 7) },
        ...scope(patientId),
      }).populate('patient', 'firstName lastName archivedAt primaryNutritionist');
      return items
        .filter((g) => g.patient && !g.patient.archivedAt)
        .map((g) => ({
          patient: g.patient._id,
          assignedTo: g.patient.primaryNutritionist,
          dedupeKey: `goal_due:${g.id}`,
          source: { kind: 'goal', id: g._id },
          dueAt: g.dueDate,
          message: `Objetivo "${g.title}" vence el ${fmtDate(g.dueDate)}`,
        }));
    },
  },
  {
    key: 'goal_overdue',
    label: 'Objetivo vencido',
    description: 'Un objetivo sigue en curso después de su fecha.',
    defaults: { enabled: true, severity: 'alta', params: {} },
    params: [],
    async evaluate({ patientId }) {
      const items = await Goal.find({ status: 'en_curso', dueDate: { $lt: startOfDay() }, ...scope(patientId) }).populate(
        'patient',
        'firstName lastName archivedAt primaryNutritionist',
      );
      return items
        .filter((g) => g.patient && !g.patient.archivedAt)
        .map((g) => ({
          patient: g.patient._id,
          assignedTo: g.patient.primaryNutritionist,
          dedupeKey: `goal_overdue:${g.id}`,
          source: { kind: 'goal', id: g._id },
          dueAt: g.dueDate,
          message: `Objetivo "${g.title}" venció el ${fmtDate(g.dueDate)}`,
        }));
    },
  },
  {
    key: 'measurement_missing',
    label: 'Sin mediciones recientes',
    description: 'Paciente activo sin mediciones registradas en el periodo indicado.',
    defaults: { enabled: true, severity: 'baja', params: { days: 45 } },
    params: [{ key: 'days', label: 'Días sin mediciones', type: 'number', min: 7, max: 365 }],
    async evaluate({ params, patientId }) {
      const limit = addDays(new Date(), -(params.days ?? 45));
      const items = await Patient.find({ ...activePatients(patientId), lastMeasurementAt: { $lt: limit } });
      return items.map((p) => ({
        patient: p._id,
        assignedTo: p.primaryNutritionist,
        dedupeKey: `measurement_missing:${p.id}`,
        source: { kind: 'patient', id: p._id },
        message: `${fullName(p)}: sin mediciones desde ${fmtDate(p.lastMeasurementAt)}`,
      }));
    },
  },
  {
    key: 'patient_inactive',
    label: 'Paciente sin actividad',
    description: 'Paciente activo sin consulta en el periodo indicado. Desactivada hasta que se defina el umbral.',
    defaults: { enabled: false, severity: 'media', params: { days: null } },
    params: [{ key: 'days', label: 'Días sin consulta', type: 'number', min: 7, max: 730, required: true }],
    async evaluate({ params, patientId }) {
      if (!params.days) return [];
      const limit = addDays(new Date(), -params.days);
      const items = await Patient.find({
        ...activePatients(patientId),
        $or: [{ lastConsultationAt: { $lt: limit } }, { lastConsultationAt: null, createdAt: { $lt: limit } }],
      });
      return items.map((p) => ({
        patient: p._id,
        assignedTo: p.primaryNutritionist,
        dedupeKey: `patient_inactive:${p.id}`,
        source: { kind: 'patient', id: p._id },
        message: p.lastConsultationAt
          ? `${fullName(p)}: sin consulta desde ${fmtDate(p.lastConsultationAt)}`
          : `${fullName(p)}: registrado sin consultas`,
      }));
    },
  },
];

export const RULES_BY_KEY = new Map(RULES.map((r) => [r.key, r]));
