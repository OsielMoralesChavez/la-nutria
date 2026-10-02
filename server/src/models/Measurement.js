import mongoose from 'mongoose';
import { METRIC_CATEGORY } from '@lanutria/shared';
import { baseOptions, userRef } from './plugins.js';

/** Catálogo de métricas configurable por el consultorio. */
const metricDefinitionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_]+$/ },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    unit: { type: String, trim: true, maxlength: 20, default: '' },
    category: { type: String, enum: METRIC_CATEGORY.values, default: 'otra' },
    // Rango de CAPTURA (detectar errores de dedo), no rango clínico.
    min: Number,
    max: Number,
    decimals: { type: Number, min: 0, max: 3, default: 1 },
    // Clave de fórmula en @lanutria/shared DERIVED_METRICS (imc, icc).
    derived: { type: String, default: null },
    order: { type: Number, default: 100 },
    active: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
  },
  baseOptions,
);

const valueSchema = new mongoose.Schema(
  {
    metric: { type: String, required: true },
    value: { type: Number, required: true },
    unit: String,
    // Método específico de este valor si difiere del de la toma.
    method: String,
    derived: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * Una toma = un documento. Nunca se sobrescribe: el historial se construye
 * con todas las tomas del paciente ordenadas por fecha.
 */
const measurementSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    consultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true },
    takenAt: { type: Date, required: true },
    takenBy: userRef,
    method: { type: String, default: null }, // clave del catálogo measurement_method
    device: { type: String, maxlength: 120 },
    values: { type: [valueSchema], default: [] },
    notes: { type: String, maxlength: 1000 },
  },
  baseOptions,
);

measurementSchema.index({ patient: 1, takenAt: -1 });

export const MetricDefinition = mongoose.model('MetricDefinition', metricDefinitionSchema);
export const Measurement = mongoose.model('Measurement', measurementSchema);
