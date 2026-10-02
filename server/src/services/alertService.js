import { RULES, RULES_BY_KEY } from '../alerts/rules.js';
import { logger } from '../config/logger.js';
import { Alert, AlertRule } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { record } from './auditService.js';

const RANK = { alta: 0, media: 1, baja: 2 };
const ACTIVE = ['abierta', 'pospuesta'];

/** Crea las reglas que falten con sus valores por defecto (no pisa cambios). */
export async function ensureRules() {
  for (const rule of RULES) {
    await AlertRule.updateOne(
      { key: rule.key },
      {
        $setOnInsert: {
          key: rule.key,
          enabled: rule.defaults.enabled,
          severity: rule.defaults.severity,
          params: rule.defaults.params,
        },
        $set: { label: rule.label, description: rule.description },
      },
      { upsert: true },
    );
  }
}

/**
 * Aplica el resultado de una regla: crea alertas nuevas y resuelve
 * automáticamente las que ya no aplican. `patientId` limita el alcance.
 */
async function applyRule(ruleDoc, patientId) {
  const rule = RULES_BY_KEY.get(ruleDoc.key);
  if (!rule) return { created: 0, resolved: 0 };

  const candidates = ruleDoc.enabled ? await rule.evaluate({ params: ruleDoc.params ?? {}, patientId }) : [];
  const keys = new Set(candidates.map((c) => c.dedupeKey));
  const scope = { ruleKey: rule.key, status: { $in: ACTIVE }, ...(patientId && { patient: patientId }) };

  // Resolver las que ya no se cumplen (o regla desactivada).
  const stale = await Alert.find(scope).select('dedupeKey');
  const staleIds = stale.filter((a) => !keys.has(a.dedupeKey)).map((a) => a._id);
  if (staleIds.length) {
    await Alert.updateMany(
      { _id: { $in: staleIds } },
      { status: 'atendida', resolution: 'auto', resolvedAt: new Date(), resolutionNote: 'La condición ya no se cumple' },
    );
  }

  // Crear las nuevas; las existentes se respetan (incluye pospuestas).
  const existing = new Set(stale.map((a) => a.dedupeKey));
  let created = 0;
  for (const c of candidates) {
    if (existing.has(c.dedupeKey)) continue;
    try {
      await Alert.create({
        ...c,
        ruleKey: rule.key,
        type: rule.key,
        severity: ruleDoc.severity,
        rank: RANK[ruleDoc.severity] ?? 1,
      });
      created += 1;
    } catch (err) {
      if (err.code !== 11000) throw err; // otra ejecución ya la creó
    }
  }
  return { created, resolved: staleIds.length };
}

/** Reactiva alertas pospuestas cuyo plazo terminó. */
async function wakeSnoozed() {
  await Alert.updateMany({ status: 'pospuesta', snoozedUntil: { $lte: new Date() } }, { status: 'abierta', $unset: { snoozedUntil: 1 } });
}

export async function runAll() {
  await wakeSnoozed();
  const rules = await AlertRule.find();
  const totals = { created: 0, resolved: 0 };
  for (const r of rules) {
    try {
      const res = await applyRule(r);
      totals.created += res.created;
      totals.resolved += res.resolved;
    } catch (err) {
      logger.error({ err: err.message, rule: r.key }, 'Error evaluando regla de alerta');
    }
  }
  return totals;
}

/** Reevalúa sólo un paciente (tras cerrar consulta, medir, agendar…). */
export async function reconcilePatient(patientId) {
  const rules = await AlertRule.find();
  for (const r of rules) await applyRule(r, patientId);
}

// ─────────────────────────── API ───────────────────────────

export async function list({ status = 'abierta', type, severity, assignedTo, patient, page, limit }) {
  const filter = { status: status === 'activas' ? { $in: ACTIVE } : status };
  if (type) filter.type = type;
  if (severity) filter.severity = severity;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (patient) filter.patient = patient;
  const [items, total, byType] = await Promise.all([
    Alert.find(filter)
      .sort({ rank: 1, dueAt: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('patient', 'firstName lastName')
      .populate('assignedTo', 'name'),
    Alert.countDocuments(filter),
    Alert.aggregate([{ $match: { status: 'abierta' } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
  ]);
  return { items, total, countsByType: Object.fromEntries(byType.map((b) => [b._id, b.count])) };
}

export async function act(id, { action, until, note }, actor, req) {
  const alert = await Alert.findById(id);
  if (!alert) throw ApiError.notFound('Alerta');

  if (action === 'reabrir') {
    alert.status = 'abierta';
    alert.resolvedAt = undefined;
    alert.resolvedBy = undefined;
    alert.resolution = undefined;
  } else {
    if (!ACTIVE.includes(alert.status)) throw ApiError.conflict('La alerta ya fue cerrada');
    if (action === 'posponer') {
      if (!until || until <= new Date()) throw ApiError.validation([{ location: 'body', field: 'until', message: 'Indica una fecha futura' }]);
      alert.status = 'pospuesta';
      alert.snoozedUntil = until;
    } else {
      alert.status = action === 'atender' ? 'atendida' : 'descartada';
      alert.resolution = alert.status;
      alert.resolvedAt = new Date();
      alert.resolvedBy = actor.id;
    }
  }
  if (note !== undefined) alert.resolutionNote = note;
  try {
    await alert.save();
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('Ya existe una alerta activa para esta situación');
    throw err;
  }
  await record({ req, action: `alerts.${action}`, resource: 'alerts', resourceId: id });
  return alert;
}

export async function listRules() {
  const docs = await AlertRule.find().sort({ key: 1 });
  return RULES.map((rule) => {
    const doc = docs.find((d) => d.key === rule.key);
    return { ...doc?.toJSON(), key: rule.key, label: rule.label, description: rule.description, paramsSchema: rule.params };
  });
}

function validateParams(rule, params) {
  const clean = {};
  for (const p of rule.params) {
    const v = params?.[p.key];
    if (v === undefined || v === null || v === '') {
      if (p.required) clean[p.key] = null;
      continue;
    }
    if (p.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || (p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)) {
        throw ApiError.validation([{ location: 'body', field: `params.${p.key}`, message: `Debe estar entre ${p.min} y ${p.max}` }]);
      }
      clean[p.key] = n;
    } else if (p.type === 'boolean') {
      clean[p.key] = Boolean(v);
    }
  }
  return clean;
}

export async function updateRule(key, { enabled, severity, params }, actor, req) {
  const rule = RULES_BY_KEY.get(key);
  const doc = await AlertRule.findOne({ key });
  if (!rule || !doc) throw ApiError.notFound('Regla');

  if (params !== undefined) doc.params = { ...doc.params, ...validateParams(rule, params) };
  if (severity !== undefined) doc.severity = severity;
  if (enabled !== undefined) {
    const missing = rule.params.filter((p) => p.required && (doc.params?.[p.key] === null || doc.params?.[p.key] === undefined));
    if (enabled && missing.length) {
      throw ApiError.validation(missing.map((p) => ({ location: 'body', field: `params.${p.key}`, message: 'Define este valor antes de activar la regla' })));
    }
    doc.enabled = enabled;
  }
  doc.updatedBy = actor.id;
  doc.markModified('params');
  await doc.save();
  if (severity !== undefined) await Alert.updateMany({ ruleKey: key, status: { $in: ACTIVE } }, { severity, rank: RANK[severity] });
  await applyRule(doc);
  await record({ req, action: 'alerts.rule_update', resource: 'alerts', resourceId: key, meta: { enabled: doc.enabled, params: doc.params, severity: doc.severity } });
  return (await listRules()).find((r) => r.key === key);
}

/** "Hoy generaría N alertas" con parámetros aún no guardados. */
export async function previewRule(key, params) {
  const rule = RULES_BY_KEY.get(key);
  if (!rule) throw ApiError.notFound('Regla');
  const candidates = await rule.evaluate({ params: validateParams(rule, params) });
  return { count: candidates.length };
}

let timer = null;
export function startAlertsJob(minutes) {
  if (!minutes) return;
  const tick = () =>
    runAll()
      .then((t) => (t.created || t.resolved) && logger.info(t, 'Alertas evaluadas'))
      .catch((err) => logger.error({ err: err.message }, 'Fallo del job de alertas'));
  tick();
  timer = setInterval(tick, minutes * 60_000);
  timer.unref();
}
export const stopAlertsJob = () => timer && clearInterval(timer);
