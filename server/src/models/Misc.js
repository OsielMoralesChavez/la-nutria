import mongoose from 'mongoose';
import { ATTACHMENT_KIND, CATALOG_TYPES } from '@lanutria/shared';
import { baseOptions, userRef } from './plugins.js';

/** Listas simples editables (métodos, tipos de cita, categorías…). */
const catalogSchema = new mongoose.Schema(
  {
    type: { type: String, enum: CATALOG_TYPES.values, required: true },
    key: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9_]+$/ },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    order: { type: Number, default: 100 },
    active: { type: Boolean, default: true },
    // Datos extra por tipo: p. ej. appointment_type → { durationMin, color }
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions,
);
catalogSchema.index({ type: 1, key: 1 }, { unique: true });

/** Configuración clave/valor del consultorio. */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
    updatedBy: userRef,
  },
  baseOptions,
);

/**
 * Metadatos de fotos y documentos. El archivo vive en el adaptador de
 * almacenamiento (`storageKey`), nunca en MongoDB.
 */
const attachmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    consultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
    kind: { type: String, enum: ATTACHMENT_KIND.values, required: true },
    category: { type: String, default: null },
    originalName: { type: String, maxlength: 200 },
    storageKey: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    takenAt: { type: Date, default: Date.now },
    notes: { type: String, maxlength: 500 },
    uploadedBy: userRef,
    deletedAt: Date,
    deletedBy: userRef,
  },
  baseOptions,
);
attachmentSchema.index({ patient: 1, takenAt: -1 });

/**
 * Bitácora append-only. Nunca guarda valores clínicos: sólo quién, qué acción,
 * sobre qué recurso, resultado y, como mucho, NOMBRES de campos cambiados.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorEmail: String, // útil cuando el login falla y no hay actor
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: String,
    result: { type: String, enum: ['ok', 'denegado', 'error'], default: 'ok' },
    ip: String,
    userAgent: { type: String, maxlength: 300 },
    meta: { type: mongoose.Schema.Types.Mixed },
    at: { type: Date, default: Date.now },
  },
  { ...baseOptions, timestamps: false },
);
auditLogSchema.index({ at: -1 });
auditLogSchema.index({ actor: 1, at: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, at: -1 });

export const Catalog = mongoose.model('Catalog', catalogSchema);
export const Setting = mongoose.model('Setting', settingSchema);
export const Attachment = mongoose.model('Attachment', attachmentSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
