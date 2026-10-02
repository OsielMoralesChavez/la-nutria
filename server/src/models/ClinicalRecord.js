import mongoose from 'mongoose';
import { CLINICAL_SECTION_KEYS } from '@lanutria/shared';
import { baseOptions, userRef } from './plugins.js';

/** Secciones de texto libre (todas opcionales) definidas en @lanutria/shared. */
const sectionsDefinition = Object.fromEntries(
  CLINICAL_SECTION_KEYS.map((key) => [key, { type: String, trim: true, maxlength: 5000, default: '' }]),
);
const sectionsSchema = new mongoose.Schema(sectionsDefinition, { _id: false });

/** Estado ACTUAL del expediente: uno por paciente. */
const clinicalRecordSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true },
    sections: { type: sectionsSchema, default: () => ({}) },
    version: { type: Number, default: 0 },
    updatedBy: userRef,
  },
  baseOptions,
);

/** Revisión inmutable (append-only): permite saber qué decía antes y quién lo cambió. */
const revisionSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    version: { type: Number, required: true },
    sections: { type: sectionsSchema, required: true },
    changedFields: { type: [String], default: [] },
    changedBy: userRef,
    consultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
  },
  baseOptions,
);
revisionSchema.index({ patient: 1, version: -1 }, { unique: true });

export const ClinicalRecord = mongoose.model('ClinicalRecord', clinicalRecordSchema);
export const ClinicalRecordRevision = mongoose.model('ClinicalRecordRevision', revisionSchema);
