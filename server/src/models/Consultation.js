import mongoose from 'mongoose';
import { CONSULTATION_STATUS, CONSULTATION_TYPE } from '@lanutria/shared';
import { baseOptions, userRef } from './plugins.js';

const soapSchema = new mongoose.Schema(
  {
    s: { type: String, maxlength: 5000, default: '' },
    o: { type: String, maxlength: 5000, default: '' },
    a: { type: String, maxlength: 5000, default: '' },
    p: { type: String, maxlength: 5000, default: '' },
  },
  { _id: false },
);

/** Notas híbridas: texto libre y/o SOAP opcional. */
const notesSchema = new mongoose.Schema(
  {
    freeText: { type: String, maxlength: 10000, default: '' },
    soap: { type: soapSchema, default: null },
  },
  { _id: false },
);

/** Corrección posterior al cierre: la nota original nunca se modifica. */
const addendumSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 5000 },
    by: userRef,
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const consultationSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    nutritionist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    date: { type: Date, required: true, default: Date.now },
    type: { type: String, enum: CONSULTATION_TYPE.values, required: true },
    status: { type: String, enum: CONSULTATION_STATUS.values, default: 'borrador' },
    reason: { type: String, maxlength: 500, default: '' },
    notes: { type: notesSchema, default: () => ({}) },
    addenda: { type: [addendumSchema], default: [] },
    // Datos de captura temporal mientras es borrador (mediciones aún no
    // confirmadas, próxima acción). Se convierten en registros reales al cerrar.
    draft: { type: mongoose.Schema.Types.Mixed, default: {} },
    measurement: { type: mongoose.Schema.Types.ObjectId, ref: 'Measurement' },
    summary: {
      // Resumen inmutable generado al cierre, útil para la línea de tiempo.
      changes: [{ metric: String, value: Number, delta: Number, _id: false }],
      goalsUpdated: { type: Number, default: 0 },
      nextAction: String,
    },
    closedAt: Date,
    closedBy: userRef,
  },
  baseOptions,
);

consultationSchema.index({ patient: 1, date: -1 });
consultationSchema.index({ nutritionist: 1, status: 1 });

export const Consultation = mongoose.model('Consultation', consultationSchema);
