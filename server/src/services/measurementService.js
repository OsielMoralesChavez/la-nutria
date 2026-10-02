import mongoose from 'mongoose';
import { computeDerived } from '@lanutria/shared';
import { Measurement, MetricDefinition, Patient } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/** `{ clave: valor }` de una toma. */
export const toValueMap = (measurement) =>
  Object.fromEntries((measurement?.values ?? []).map((v) => [v.metric, v.value]));

export async function activeMetricDefinitions() {
  return MetricDefinition.find({ active: true }).sort({ order: 1, label: 1 }).lean();
}

/**
 * Último valor conocido de cada métrica (aunque vengan de tomas distintas).
 * Se usa como "fallback" para derivadas (estatura) y como "valor anterior".
 */
export async function latestValuesByMetric(patientId, { before } = {}) {
  const match = { patient: oid(patientId), ...(before && { takenAt: { $lt: before } }) };
  const rows = await Measurement.aggregate([
    { $match: match },
    { $sort: { takenAt: -1 } },
    { $unwind: '$values' },
    { $group: { _id: '$values.metric', value: { $first: '$values.value' }, takenAt: { $first: '$takenAt' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, { value: r.value, takenAt: r.takenAt }]));
}

/** Primer valor registrado de cada métrica (línea base de "¿Cómo inició?"). */
export async function baselineValuesByMetric(patientId) {
  const rows = await Measurement.aggregate([
    { $match: { patient: oid(patientId) } },
    { $sort: { takenAt: 1 } },
    { $unwind: '$values' },
    { $group: { _id: '$values.metric', value: { $first: '$values.value' }, takenAt: { $first: '$takenAt' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, { value: r.value, takenAt: r.takenAt }]));
}

/**
 * Construye los valores finales de una toma: valida contra el catálogo,
 * redondea, y agrega derivadas activas (IMC, ICC) usando la última estatura
 * conocida si no se midió hoy.
 */
export async function buildValues(patientId, rawValues, { before } = {}) {
  const defs = await MetricDefinition.find({ active: true }).lean();
  const byKey = new Map(defs.map((d) => [d.key, d]));

  const values = [];
  const map = {};
  for (const v of rawValues) {
    const def = byKey.get(v.metric);
    if (!def) throw ApiError.validation([{ location: 'body', field: `values.${v.metric}`, message: 'Métrica inexistente o inactiva' }]);
    if (def.derived) continue; // las derivadas siempre se calculan aquí
    const value = Number(v.value.toFixed(def.decimals ?? 2));
    values.push({ metric: def.key, value, unit: def.unit, ...(v.method && { method: v.method }) });
    map[def.key] = value;
  }

  const previous = await latestValuesByMetric(patientId, { before });
  const fallback = Object.fromEntries(Object.entries(previous).map(([k, v]) => [k, v.value]));
  const enabledDerived = defs.filter((d) => d.derived).map((d) => d.derived);
  const derived = computeDerived(map, fallback, enabledDerived);

  for (const def of defs.filter((d) => d.derived && derived[d.derived] !== undefined)) {
    values.push({ metric: def.key, value: derived[def.derived], unit: def.unit, derived: true });
  }
  return values;
}

export async function create({ patientId, consultationId, takenAt, method, device, notes, values }, actor, session) {
  const built = await buildValues(patientId, values);
  if (!built.length) return null;
  const [m] = await Measurement.create(
    [{ patient: patientId, consultation: consultationId, takenAt, takenBy: actor.id, method, device, notes, values: built }],
    { session },
  );
  await Patient.updateOne({ _id: patientId }, { lastMeasurementAt: takenAt }, { session });
  return m;
}

export async function list(patientId, { page, limit }) {
  const filter = { patient: patientId };
  const [items, total] = await Promise.all([
    Measurement.find(filter)
      .sort({ takenAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('takenBy', 'name'),
    Measurement.countDocuments(filter),
  ]);
  return { items, total };
}

/**
 * Series temporales por métrica para gráficas: `{ peso: [{date, value, method, consultation}] }`.
 */
export async function series(patientId, metrics, { from } = {}) {
  const match = { patient: oid(patientId), ...(from && { takenAt: { $gte: from } }) };
  const rows = await Measurement.aggregate([
    { $match: match },
    { $sort: { takenAt: 1 } },
    { $unwind: '$values' },
    ...(metrics?.length ? [{ $match: { 'values.metric': { $in: metrics } } }] : []),
    {
      $group: {
        _id: '$values.metric',
        points: {
          $push: {
            date: '$takenAt',
            value: '$values.value',
            method: { $ifNull: ['$values.method', '$method'] },
            consultation: '$consultation',
          },
        },
      },
    },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.points]));
}

/** Últimos N valores de una métrica para varios pacientes (sparklines del listado). */
export async function sparklines(patientIds, metric = 'peso', n = 8) {
  if (!patientIds.length) return {};
  const rows = await Measurement.aggregate([
    { $match: { patient: { $in: patientIds.map(oid) } } },
    { $unwind: '$values' },
    { $match: { 'values.metric': metric } },
    { $sort: { takenAt: 1 } },
    { $group: { _id: '$patient', points: { $push: '$values.value' }, first: { $first: '$values.value' } } },
    { $project: { first: 1, points: { $slice: ['$points', -n] } } },
  ]);
  return Object.fromEntries(
    rows.map((r) => [r._id.toString(), { metric, first: r.first, points: r.points, last: r.points[r.points.length - 1] }]),
  );
}
