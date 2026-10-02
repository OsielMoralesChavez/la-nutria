import { goalProgress } from '@lanutria/shared';
import { Goal, GoalType, MetricDefinition } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { record } from './auditService.js';
import { latestValuesByMetric } from './measurementService.js';

/** Agrega progreso calculado (nunca se guarda: se deriva de las mediciones). */
export function withProgress(goal, latest) {
  const g = goal.toJSON ? goal.toJSON() : goal;
  const current = g.metric ? latest[g.metric]?.value ?? null : null;
  return { ...g, current, progress: goalProgress(g, current) };
}

export async function listByPatient(patientId, { status } = {}) {
  const filter = { patient: patientId, ...(status && { status }) };
  const [goals, latest] = await Promise.all([
    Goal.find(filter).sort({ status: 1, dueDate: 1, createdAt: -1 }),
    latestValuesByMetric(patientId),
  ]);
  return goals.map((g) => withProgress(g, latest));
}

/**
 * `latest` permite pasar los valores actuales cuando se crea dentro de la
 * transacción de cierre (la medición recién creada aún no es visible fuera).
 */
export async function create(patientId, data, actor, { session, consultationId, req, latest } = {}) {
  const type = await GoalType.findOne({ key: data.goalType, active: true });
  if (!type) throw ApiError.validation([{ location: 'body', field: 'goalType', message: 'Tipo de objetivo inválido' }]);

  const kind = type.kind;
  const metric = kind === 'metrica' ? data.metric ?? type.defaultMetric : null;
  const direction = kind === 'metrica' ? data.direction ?? type.direction : null;

  if (kind === 'metrica') {
    if (!metric) throw ApiError.validation([{ location: 'body', field: 'metric', message: 'Indica la métrica' }]);
    if (!(await MetricDefinition.exists({ key: metric }))) {
      throw ApiError.validation([{ location: 'body', field: 'metric', message: 'Métrica inexistente' }]);
    }
    if (data.target === undefined) throw ApiError.validation([{ location: 'body', field: 'target', message: 'Indica la meta' }]);
  }

  let { baseline } = data;
  if (kind === 'metrica' && baseline === undefined) {
    const values = latest ?? (await latestValuesByMetric(patientId));
    baseline = values[metric]?.value;
  }

  const [goal] = await Goal.create(
    [
      {
        patient: patientId,
        goalType: type.key,
        title: data.title?.trim() || type.label,
        kind,
        metric,
        direction,
        baseline,
        target: data.target,
        tolerance: data.tolerance ?? (direction === 'mantener' ? type.defaultTolerance : undefined),
        startDate: data.startDate ?? new Date(),
        dueDate: data.dueDate,
        notes: data.notes,
        createdIn: consultationId,
        createdBy: actor.id,
      },
    ],
    { session },
  );
  if (req) await record({ req, action: 'goals.create', resource: 'goals', resourceId: goal.id, meta: { patient: patientId } });
  return goal;
}

const CLOSED = ['logrado', 'no_logrado', 'cancelado'];

export async function update(goalId, changes, actor, { session, req } = {}) {
  const goal = await Goal.findById(goalId).session(session ?? null);
  if (!goal) throw ApiError.notFound('Objetivo');

  const changedFields = [];
  for (const field of ['title', 'target', 'tolerance', 'dueDate', 'notes']) {
    if (changes[field] !== undefined) {
      goal[field] = changes[field];
      changedFields.push(field);
    }
  }
  if (changes.status && changes.status !== goal.status) {
    goal.status = changes.status;
    changedFields.push('status');
    if (CLOSED.includes(changes.status)) {
      goal.closedAt = new Date();
      goal.closedBy = actor.id;
    } else {
      goal.closedAt = undefined;
      goal.closedBy = undefined;
    }
  }
  await goal.save({ session });
  if (req && changedFields.length) {
    await record({ req, action: 'goals.update', resource: 'goals', resourceId: goalId, meta: { changedFields } });
  }
  return goal;
}

/** Avance de un objetivo cualitativo (uno por consulta: se reemplaza si ya existe). */
export async function addCheckpoint(goalId, { score, note, consultationId }, actor, { session } = {}) {
  const goal = await Goal.findById(goalId).session(session ?? null);
  if (!goal) throw ApiError.notFound('Objetivo');
  const existing = consultationId ? goal.checkpoints.find((c) => c.consultation?.toString() === consultationId) : null;
  if (existing) {
    existing.score = score;
    existing.note = note;
  } else {
    goal.checkpoints.push({ consultation: consultationId, score, note, by: actor.id, date: new Date() });
  }
  await goal.save({ session });
  return goal;
}

export async function get(goalId) {
  const goal = await Goal.findById(goalId);
  if (!goal) throw ApiError.notFound('Objetivo');
  const latest = await latestValuesByMetric(goal.patient.toString());
  return withProgress(goal, latest);
}
