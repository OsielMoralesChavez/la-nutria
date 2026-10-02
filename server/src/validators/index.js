import { z } from 'zod';
import {
  ALERT_SEVERITY,
  APPOINTMENT_STATUS,
  CATALOG_TYPES,
  CLINICAL_SECTION_KEYS,
  CONSULTATION_TYPE,
  FOLLOWUP_STATUS,
  GOAL_DIRECTION,
  GOAL_KIND,
  GOAL_STATUS,
  METRIC_CATEGORY,
  NOTE_FORMAT,
  PATIENT_STATUS,
  SEX,
  TIMELINE_TYPES,
  ALL_PERMISSIONS,
} from '@lanutria/shared';
import { zBoolString, zDate, zId, zPaging, zText } from '../middleware/validate.js';

/**
 * Esquemas de entrada por recurso. Todos los objetos son estrictos: un campo
 * no declarado produce 422 (defensa contra mass-assignment).
 */

const zEnum = (e) => z.enum(e.values);
const zKey = z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/, 'Sólo minúsculas, números y _').max(40);
const zOptEmail = z.union([z.email('Correo inválido').max(160), z.literal('')]).optional();
const zPassword = z.string().min(10, 'Mínimo 10 caracteres').max(128);
const zNum = z.number().finite();

// ───────────── Auth ─────────────
export const auth = {
  login: z.strictObject({ email: z.email('Correo inválido').max(160), password: z.string().min(1).max(128) }),
  changePassword: z.strictObject({ currentPassword: z.string().min(1).max(128), newPassword: zPassword }),
  preferences: z.strictObject({
    noteFormat: zEnum(NOTE_FORMAT).optional(),
    defaultAgendaView: z.enum(['dia', 'semana', 'lista']).optional(),
    dashboardScope: z.enum(['mine', 'all']).optional(),
  }),
  sessionParam: z.strictObject({ sessionId: zId }),
};

// ───────────── Usuarios y roles ─────────────
export const users = {
  list: z.strictObject({ q: zText(80).optional(), status: z.enum(['activo', 'inactivo']).optional(), role: zId.optional(), ...zPaging }),
  create: z.strictObject({ name: zText(120).min(2), email: z.email('Correo inválido').max(160), role: zId }),
  update: z.strictObject({ name: zText(120).min(2).optional(), email: z.email().max(160).optional(), role: zId.optional() }),
  status: z.strictObject({ status: z.enum(['activo', 'inactivo']), reassignTo: zId.optional() }),
};

export const roles = {
  create: z.strictObject({
    key: zKey,
    name: zText(60).min(2),
    description: zText(200).optional(),
    level: z.number().int().min(1).max(99),
    permissions: z.array(z.enum(ALL_PERMISSIONS)).default([]),
  }),
  update: z.strictObject({ name: zText(60).min(2).optional(), description: zText(200).optional() }),
  permissions: z.strictObject({ permissions: z.array(z.enum(ALL_PERMISSIONS)) }),
};

// ───────────── Pacientes ─────────────
const contact = z.strictObject({
  phone: zText(30).min(7, 'Teléfono inválido'),
  email: zOptEmail,
  address: zText(300).optional(),
  emergencyName: zText(120).optional(),
  emergencyPhone: zText(30).optional(),
});
const birthDate = zDate.refine((d) => d <= new Date() && d.getFullYear() > 1900, 'Fecha de nacimiento inválida');
const patientFields = {
  firstName: zText(80).min(1, 'Requerido'),
  lastName: zText(120).min(1, 'Requerido'),
  birthDate,
  sex: zEnum(SEX),
  contact,
  occupation: zText(120).optional(),
  notes: zText(2000).optional(),
  tags: z.array(zText(40)).max(20).optional(),
};

export const patients = {
  list: z.strictObject({
    q: zText(80).optional(),
    status: zEnum(PATIENT_STATUS).optional(),
    responsible: z.union([z.literal('me'), zId]).optional(),
    tag: zText(40).optional(),
    withAlerts: zBoolString.optional(),
    noRecentDays: z.coerce.number().int().min(1).max(3650).optional(),
    newDays: z.coerce.number().int().min(1).max(3650).optional(),
    archived: zBoolString.optional(),
    sort: z.enum(['name', 'recent', 'next', 'created']).optional(),
    ...zPaging,
  }),
  create: z.strictObject({ ...patientFields, primaryNutritionist: zId.optional(), force: z.boolean().optional() }),
  update: z.strictObject({ ...patientFields, contact: contact.partial() }).partial(),
  status: z.strictObject({ status: zEnum(PATIENT_STATUS), reason: zText(500).optional() }),
  assign: z.strictObject({ nutritionist: zId }),
  hardDelete: z.strictObject({ confirmName: zText(200).min(1) }),
  timeline: z.strictObject({
    before: zDate.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    types: z
      .string()
      .optional()
      .transform((s) => (s ? s.split(',').filter((t) => TIMELINE_TYPES.values.includes(t)) : undefined)),
  }),
  series: z.strictObject({
    metrics: z.string().optional().transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined)),
    from: zDate.optional(),
  }),
};

// ───────────── Expediente ─────────────
export const clinical = {
  update: z.strictObject(Object.fromEntries(CLINICAL_SECTION_KEYS.map((k) => [k, zText(5000).optional()]))),
  revisionParam: z.strictObject({ id: zId, version: z.coerce.number().int().min(1) }),
};

// ───────────── Consultas ─────────────
const soap = z.strictObject({ s: zText(5000), o: zText(5000), a: zText(5000), p: zText(5000) }).partial();
const goalCreate = z.strictObject({
  goalType: zKey,
  title: zText(160).optional(),
  metric: zKey.nullable().optional(),
  direction: zEnum(GOAL_DIRECTION).nullable().optional(),
  baseline: zNum.optional(),
  target: zNum.optional(),
  tolerance: zNum.min(0).optional(),
  startDate: zDate.optional(),
  dueDate: zDate.optional(),
  notes: zText(2000).optional(),
});
const goalUpdate = z.strictObject({
  title: zText(160).optional(),
  target: zNum.optional(),
  tolerance: zNum.min(0).optional(),
  dueDate: zDate.nullable().optional(),
  notes: zText(2000).optional(),
  status: zEnum(GOAL_STATUS).optional(),
});

/** Borrador del modo consulta: se convierte en registros reales al cerrar. */
const draft = z.strictObject({
  measurement: z
    .strictObject({
      method: zKey.nullable().optional(),
      device: zText(120).optional(),
      values: z
        .array(z.strictObject({ metric: zKey, value: zNum.nullable(), method: zKey.nullable().optional() }))
        .max(60)
        .default([]),
    })
    .optional(),
  goals: z
    .strictObject({
      updates: z
        .array(
          goalUpdate.extend({
            goalId: zId,
            checkpoint: z.strictObject({ score: z.number().int().min(0).max(100), note: zText(1000).optional() }).optional(),
          }),
        )
        .max(30)
        .default([]),
      create: z.array(goalCreate).max(10).default([]),
    })
    .optional(),
  next: z
    .strictObject({
      appointment: z
        .strictObject({ start: zDate, durationMin: z.number().int().min(5).max(480).optional(), type: zKey.nullable().optional() })
        .nullable()
        .optional(),
      followUp: z.strictObject({ dueDate: zDate, reason: zText(300).min(1) }).nullable().optional(),
      resolveFollowUps: z.array(zId).max(30).default([]),
    })
    .optional(),
  clinical: z.strictObject(Object.fromEntries(CLINICAL_SECTION_KEYS.map((k) => [k, zText(5000).optional()]))).optional(),
});

export const consultations = {
  start: z.strictObject({ appointment: zId.optional(), type: zEnum(CONSULTATION_TYPE).optional(), reason: zText(500).optional() }),
  list: z.strictObject({ status: z.enum(['borrador', 'cerrada']).optional(), ...zPaging }),
  saveDraft: z.strictObject({
    reason: zText(500).optional(),
    type: zEnum(CONSULTATION_TYPE).optional(),
    notes: z.strictObject({ freeText: zText(10000).optional(), soap: soap.nullable().optional() }).optional(),
    draft: draft.optional(),
  }),
  addendum: z.strictObject({ text: zText(5000).min(1) }),
};

// ───────────── Objetivos ─────────────
export const goals = {
  list: z.strictObject({ status: zEnum(GOAL_STATUS).optional() }),
  create: goalCreate,
  update: goalUpdate,
  checkpoint: z.strictObject({ score: z.number().int().min(0).max(100), note: zText(1000).optional() }),
};

// ───────────── Agenda y seguimiento ─────────────
export const appointments = {
  list: z.strictObject({
    from: zDate.optional(),
    to: zDate.optional(),
    nutritionist: zId.optional(),
    patient: zId.optional(),
    status: zText(100).optional(),
  }),
  create: z.strictObject({
    patient: zId,
    nutritionist: zId.optional(),
    start: zDate,
    durationMin: z.number().int().min(5).max(480).optional(),
    type: zKey.nullable().optional(),
    notes: zText(1000).optional(),
    force: z.boolean().optional(),
  }),
  update: z.strictObject({ notes: zText(1000).optional(), type: zKey.nullable().optional() }),
  status: z.strictObject({ status: zEnum(APPOINTMENT_STATUS), reason: zText(300).optional() }),
  reschedule: z.strictObject({ start: zDate, durationMin: z.number().int().min(5).max(480).optional(), force: z.boolean().optional() }),
  slots: z.strictObject({ nutritionist: zId.optional(), date: zDate, durationMin: z.coerce.number().int().min(5).max(480).optional() }),
};

export const followUps = {
  list: z.strictObject({
    status: zEnum(FOLLOWUP_STATUS).optional(),
    due: z.enum(['overdue', 'today', 'week']).optional(),
    assignedTo: z.union([z.literal('me'), zId]).optional(),
    patient: zId.optional(),
    ...zPaging,
  }),
  create: z.strictObject({ dueDate: zDate, reason: zText(300).min(1), assignedTo: zId.optional() }),
  update: z.strictObject({
    dueDate: zDate.optional(),
    reason: zText(300).min(1).optional(),
    assignedTo: zId.optional(),
    status: zEnum(FOLLOWUP_STATUS).optional(),
    resolutionNote: zText(500).optional(),
  }),
};

// ───────────── Alertas ─────────────
export const alerts = {
  list: z.strictObject({
    status: z.enum(['abierta', 'pospuesta', 'atendida', 'descartada', 'activas']).optional(),
    type: zText(40).optional(),
    severity: zEnum(ALERT_SEVERITY).optional(),
    assignedTo: z.union([z.literal('me'), zId]).optional(),
    patient: zId.optional(),
    ...zPaging,
  }),
  act: z.strictObject({
    action: z.enum(['atender', 'descartar', 'posponer', 'reabrir']),
    until: zDate.optional(),
    note: zText(500).optional(),
  }),
  ruleParam: z.strictObject({ key: zKey }),
  ruleUpdate: z.strictObject({
    enabled: z.boolean().optional(),
    severity: zEnum(ALERT_SEVERITY).optional(),
    params: z.record(z.string(), z.union([z.number(), z.boolean(), z.null()])).optional(),
  }),
  rulePreview: z.strictObject({ params: z.record(z.string(), z.union([z.number(), z.boolean(), z.null()])).default({}) }),
};

// ───────────── Catálogos ─────────────
const zMeta = z.record(z.string(), z.union([z.string().max(100), z.number(), z.boolean()])).optional();
export const catalogs = {
  list: z.strictObject({ type: zEnum(CATALOG_TYPES).optional(), includeInactive: zBoolString.optional() }),
  create: z.strictObject({ type: zEnum(CATALOG_TYPES), key: zKey, label: zText(80).min(1), order: z.number().int().optional(), meta: zMeta }),
  update: z.strictObject({ label: zText(80).min(1).optional(), order: z.number().int().optional(), active: z.boolean().optional(), meta: zMeta }),
  includeInactive: z.strictObject({ includeInactive: zBoolString.optional() }),
  metricCreate: z.strictObject({
    key: zKey,
    label: zText(60).min(1),
    unit: zText(20).optional(),
    category: zEnum(METRIC_CATEGORY).optional(),
    min: zNum.optional(),
    max: zNum.optional(),
    decimals: z.number().int().min(0).max(3).optional(),
    order: z.number().int().optional(),
  }),
  metricUpdate: z.strictObject({
    label: zText(60).min(1).optional(),
    unit: zText(20).optional(),
    category: zEnum(METRIC_CATEGORY).optional(),
    min: zNum.nullable().optional(),
    max: zNum.nullable().optional(),
    decimals: z.number().int().min(0).max(3).optional(),
    order: z.number().int().optional(),
    active: z.boolean().optional(),
  }),
  goalTypeCreate: z.strictObject({
    key: zKey,
    label: zText(80).min(1),
    kind: zEnum(GOAL_KIND),
    defaultMetric: zKey.nullable().optional(),
    direction: zEnum(GOAL_DIRECTION).nullable().optional(),
    defaultTolerance: zNum.min(0).optional(),
    order: z.number().int().optional(),
  }),
  goalTypeUpdate: z.strictObject({
    label: zText(80).min(1).optional(),
    defaultMetric: zKey.nullable().optional(),
    direction: zEnum(GOAL_DIRECTION).nullable().optional(),
    defaultTolerance: zNum.min(0).optional(),
    order: z.number().int().optional(),
    active: z.boolean().optional(),
  }),
};

// ───────────── Configuración y auditoría ─────────────
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM');
export const settings = {
  update: z.strictObject({
    clinic: z
      .strictObject({
        name: zText(120).min(1),
        timezone: zText(60),
        openingHours: z.strictObject({ start: hhmm, end: hhmm, days: z.array(z.number().int().min(0).max(6)).max(7) }),
        units: z.strictObject({ weight: z.enum(['kg']), length: z.enum(['cm']) }),
      })
      .partial()
      .optional(),
    agenda: z
      .strictObject({
        defaultDurationMin: z.number().int().min(5).max(480),
        slotMinutes: z.number().int().min(5).max(120),
        allowOverlap: z.boolean(),
      })
      .partial()
      .optional(),
    dashboard: z.strictObject({ newPatientsDays: z.number().int().min(1).max(365) }).partial().optional(),
  }),
};

export const audit = {
  list: z.strictObject({
    actor: zId.optional(),
    action: zText(60).optional(),
    resource: zText(40).optional(),
    result: z.enum(['ok', 'denegado', 'error']).optional(),
    from: zDate.optional(),
    to: zDate.optional(),
    ...zPaging,
  }),
};

export const attachments = {
  list: z.strictObject({ kind: z.enum(['foto', 'documento']).optional(), consultation: zId.optional() }),
  upload: z.strictObject({
    consultation: zId.optional(),
    category: zKey.optional(),
    takenAt: zDate.optional(),
    notes: zText(500).optional(),
  }),
  param: z.strictObject({ id: zId, attachmentId: zId }),
};

export const dashboard = { query: z.strictObject({ scope: z.enum(['mine', 'all']).optional() }) };

export const paging = z.strictObject({ ...zPaging });
