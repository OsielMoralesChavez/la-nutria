import mongoose from 'mongoose';
import { ALERT_SEVERITY, ALERT_STATUS } from '@lanutria/shared';
import { baseOptions, userRef } from './plugins.js';

/**
 * Regla configurable. El comportamiento vive en server/src/alerts/rules/<key>.js;
 * aquí sólo están los parámetros que el consultorio puede ajustar.
 */
const alertRuleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: String,
    enabled: { type: Boolean, default: false },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    severity: { type: String, enum: ALERT_SEVERITY.values, default: 'media' },
    updatedBy: userRef,
  },
  baseOptions,
);

const alertSchema = new mongoose.Schema(
  {
    ruleKey: { type: String, required: true },
    type: { type: String, required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    severity: { type: String, enum: ALERT_SEVERITY.values, default: 'media' },
    // Orden numérico de severidad (alta=0) para ordenar en la BD.
    rank: { type: Number, default: 1 },
    status: { type: String, enum: ALERT_STATUS.values, default: 'abierta' },
    message: { type: String, required: true, maxlength: 300 },
    // Identifica "la misma situación": evita duplicados entre ejecuciones.
    dedupeKey: { type: String, required: true },
    // Referencia al objeto que la causó (seguimiento, objetivo, cita…).
    source: { kind: String, id: mongoose.Schema.Types.ObjectId },
    dueAt: Date,
    snoozedUntil: Date,
    resolvedAt: Date,
    resolvedBy: userRef,
    resolution: { type: String, enum: ['atendida', 'descartada', 'auto'], default: undefined },
    resolutionNote: { type: String, maxlength: 500 },
  },
  baseOptions,
);

// Sólo una alerta activa por situación.
alertSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['abierta', 'pospuesta'] } } },
);
alertSchema.index({ status: 1, severity: 1 });
alertSchema.index({ patient: 1, status: 1 });

export const AlertRule = mongoose.model('AlertRule', alertRuleSchema);
export const Alert = mongoose.model('Alert', alertSchema);
