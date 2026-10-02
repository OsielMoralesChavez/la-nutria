import { Alert, Appointment, AuditLog, FollowUp, Goal, Patient } from '../models/index.js';
import { addDays, startOfDay } from '../utils/query.js';
import { get as getSetting } from './settingsService.js';
import { AlertRule } from '../models/index.js';

const PATIENT_ACTIONS = [
  'patients.create',
  'consultations.close',
  'appointments.create',
  'appointments.reschedule',
  'appointments.status',
  'clinical.update',
  'goals.create',
  'followups.create',
];

/**
 * Un solo endpoint con todo lo que el dashboard necesita.
 * `scope = 'mine'` limita a pacientes de los que el usuario es responsable.
 */
export async function overview(actor, { scope = 'mine' }) {
  const mine = scope === 'mine';
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const { newPatientsDays } = await getSetting('dashboard');

  const myPatientIds = mine
    ? (await Patient.find({ primaryNutritionist: actor.id, archivedAt: null }).select('_id')).map((p) => p._id)
    : null;
  const byPatient = mine ? { patient: { $in: myPatientIds } } : {};
  const patientBase = { archivedAt: null, ...(mine && { primaryNutritionist: actor.id }) };

  const inactiveRule = await AlertRule.findOne({ key: 'patient_inactive' }).lean();
  const inactiveDays = inactiveRule?.enabled ? inactiveRule.params?.days : null;
  const goalsPeriodStart = addDays(today, -90);

  const [
    activePatients,
    newPatients,
    todaysAppointments,
    followUpsPending,
    followUpsOverdue,
    followUpsToday,
    noRecentFollowUp,
    goalsActive,
    goalsReached,
    goalsByStatus,
    alertsOpen,
    topAlerts,
    activity,
  ] = await Promise.all([
    Patient.countDocuments({ ...patientBase, status: 'activo' }),
    Patient.countDocuments({ ...patientBase, createdAt: { $gte: addDays(today, -newPatientsDays) } }),
    Appointment.find({
      start: { $gte: today, $lt: tomorrow },
      status: { $ne: 'cancelada' },
      ...(mine && { nutritionist: actor.id }),
    })
      .sort({ start: 1 })
      .populate('patient', 'firstName lastName'),
    FollowUp.countDocuments({ status: 'pendiente', ...byPatient }),
    FollowUp.countDocuments({ status: 'pendiente', dueDate: { $lt: today }, ...byPatient }),
    FollowUp.find({ status: 'pendiente', dueDate: { $lt: tomorrow }, ...byPatient })
      .sort({ dueDate: 1 })
      .limit(10)
      .populate('patient', 'firstName lastName'),
    inactiveDays
      ? Patient.countDocuments({
          ...patientBase,
          status: 'activo',
          $or: [
            { lastConsultationAt: { $lt: addDays(today, -inactiveDays) } },
            { lastConsultationAt: null, createdAt: { $lt: addDays(today, -inactiveDays) } },
          ],
        })
      : null,
    Goal.countDocuments({ status: 'en_curso', ...byPatient }),
    Goal.countDocuments({ status: 'logrado', closedAt: { $gte: goalsPeriodStart }, ...byPatient }),
    Goal.aggregate([
      { $match: { ...byPatient, $or: [{ status: 'en_curso' }, { closedAt: { $gte: goalsPeriodStart } }] } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Alert.countDocuments({ status: 'abierta', ...byPatient }),
    Alert.find({ status: 'abierta', ...byPatient })
      .sort({ rank: 1, dueAt: 1 })
      .limit(5)
      .populate('patient', 'firstName lastName'),
    AuditLog.find({ action: { $in: PATIENT_ACTIONS }, result: 'ok', ...(mine && { actor: actor.id }) })
      .sort({ at: -1 })
      .limit(12)
      .populate('actor', 'name'),
  ]);

  const patientOf = (a) => (['patients', 'clinical'].includes(a.resource) ? a.resourceId : a.meta?.patient);
  const activityPatientIds = [...new Set(activity.map(patientOf).filter(Boolean))];
  const names = new Map(
    (await Patient.find({ _id: { $in: activityPatientIds } }).select('firstName lastName')).map((p) => [p.id, p.fullName]),
  );

  const nextAppointment = todaysAppointments.find((a) => a.start >= new Date() && ['programada', 'confirmada'].includes(a.status));
  const goalsTotal = goalsByStatus.reduce((s, g) => s + g.count, 0);

  return {
    scope,
    kpis: {
      activePatients,
      newPatients: { count: newPatients, days: newPatientsDays },
      today: {
        appointments: todaysAppointments.filter((a) => a.status !== 'cancelada').length,
        followUps: followUpsToday.filter((f) => f.dueDate >= today).length,
        next: nextAppointment
          ? { id: nextAppointment.id, start: nextAppointment.start, patient: nextAppointment.patient }
          : null,
      },
      followUps: { pending: followUpsPending, overdue: followUpsOverdue },
      noRecentFollowUp: { count: noRecentFollowUp, days: inactiveDays, configured: Boolean(inactiveDays) },
      goals: { active: goalsActive, reached: goalsReached, periodDays: 90 },
      alerts: alertsOpen,
    },
    agenda: todaysAppointments,
    followUpsDue: followUpsToday,
    attention: topAlerts,
    // Sólo se grafica si hay suficientes datos para que signifique algo.
    goalsChart: goalsTotal >= 5 ? Object.fromEntries(goalsByStatus.map((g) => [g._id, g.count])) : null,
    activity: activity.map((a) => ({
      id: a.id,
      at: a.at,
      action: a.action,
      actor: a.actor?.name,
      resource: a.resource,
      resourceId: a.resourceId,
      patient: patientOf(a) ? { id: patientOf(a), name: names.get(patientOf(a)) ?? null } : null,
    })),
  };
}
