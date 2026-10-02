import { Catalog, GoalType, MetricDefinition } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { record } from './auditService.js';

/**
 * Catálogos editables. Se DESACTIVAN, no se borran: un método o métrica usado
 * en el historial no puede desaparecer.
 */

// ── Listas simples ──
export async function list({ type, includeInactive }) {
  return Catalog.find({ ...(type && { type }), ...(!includeInactive && { active: true }) }).sort({ type: 1, order: 1, label: 1 });
}

export async function create(data, actor, req) {
  const item = await Catalog.create(data);
  await record({ req, action: 'catalogs.create', resource: 'catalogs', resourceId: item.id, meta: { type: data.type, key: data.key } });
  return item;
}

export async function update(id, changes, actor, req) {
  const item = await Catalog.findById(id);
  if (!item) throw ApiError.notFound('Elemento de catálogo');
  Object.assign(item, changes);
  if (changes.meta) item.markModified('meta');
  await item.save();
  await record({ req, action: 'catalogs.update', resource: 'catalogs', resourceId: id, meta: { changedFields: Object.keys(changes) } });
  return item;
}

// ── Métricas ──
export async function listMetrics({ includeInactive }) {
  return MetricDefinition.find(includeInactive ? {} : { active: true }).sort({ order: 1, label: 1 });
}

export async function createMetric(data, actor, req) {
  const metric = await MetricDefinition.create({ ...data, derived: null, isSystem: false });
  await record({ req, action: 'metrics.create', resource: 'catalogs', resourceId: metric.id, meta: { key: data.key } });
  return metric;
}

export async function updateMetric(id, changes, actor, req) {
  const metric = await MetricDefinition.findById(id);
  if (!metric) throw ApiError.notFound('Métrica');
  // En derivadas sólo se permite activar/desactivar y ordenar: su fórmula es fija.
  const allowed = metric.derived ? ['active', 'order', 'label'] : Object.keys(changes);
  for (const k of allowed) if (changes[k] !== undefined) metric[k] = changes[k];
  await metric.save();
  await record({ req, action: 'metrics.update', resource: 'catalogs', resourceId: id, meta: { changedFields: allowed.filter((k) => changes[k] !== undefined) } });
  return metric;
}

// ── Tipos de objetivo ──
export async function listGoalTypes({ includeInactive }) {
  return GoalType.find(includeInactive ? {} : { active: true }).sort({ order: 1, label: 1 });
}

export async function createGoalType(data, actor, req) {
  const gt = await GoalType.create({ ...data, isSystem: false });
  await record({ req, action: 'goal_types.create', resource: 'catalogs', resourceId: gt.id, meta: { key: data.key } });
  return gt;
}

export async function updateGoalType(id, changes, actor, req) {
  const gt = await GoalType.findById(id);
  if (!gt) throw ApiError.notFound('Tipo de objetivo');
  Object.assign(gt, changes);
  await gt.save();
  await record({ req, action: 'goal_types.update', resource: 'catalogs', resourceId: id, meta: { changedFields: Object.keys(changes) } });
  return gt;
}
