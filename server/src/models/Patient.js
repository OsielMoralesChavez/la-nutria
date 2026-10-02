import mongoose from 'mongoose';
import { PATIENT_STATUS, SEX } from '@lanutria/shared';
import { normalizeText } from '../utils/query.js';
import { baseOptions, userRef } from './plugins.js';

const statusChangeSchema = new mongoose.Schema(
  {
    from: String,
    to: { type: String, required: true },
    reason: { type: String, maxlength: 500 },
    by: userRef,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const patientSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 120 },
    birthDate: { type: Date, required: true },
    sex: { type: String, enum: SEX.values, required: true },
    contact: {
      phone: { type: String, required: true, trim: true, maxlength: 30 },
      email: { type: String, trim: true, lowercase: true, maxlength: 160 },
      address: { type: String, trim: true, maxlength: 300 },
      emergencyName: { type: String, trim: true, maxlength: 120 },
      emergencyPhone: { type: String, trim: true, maxlength: 30 },
    },
    occupation: { type: String, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 2000 },
    tags: { type: [String], default: [] },

    status: { type: String, enum: PATIENT_STATUS.values, default: 'activo', index: true },
    // Historial de estados embebido: pocos cambios y siempre se lee con el paciente.
    statusHistory: { type: [statusChangeSchema], default: [] },
    primaryNutritionist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Desnormalizados para dashboard y listados (los mantiene el service).
    firstConsultationAt: Date,
    lastConsultationAt: { type: Date, index: true },
    lastMeasurementAt: Date,
    nextAppointmentAt: Date,
    nextFollowUpAt: Date,

    // Búsqueda sin acentos: nombre, teléfono y correo normalizados.
    searchText: { type: String, select: false, index: true },

    archivedAt: { type: Date, index: true },
    archivedBy: userRef,
    createdBy: userRef,
  },
  baseOptions,
);

patientSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

patientSchema.pre('save', function buildSearchText() {
  this.searchText = normalizeText(
    [this.firstName, this.lastName, this.contact?.phone?.replace(/\D/g, ''), this.contact?.email].filter(Boolean).join(' '),
  );
});

patientSchema.index({ primaryNutritionist: 1, status: 1 });

export const Patient = mongoose.model('Patient', patientSchema);
