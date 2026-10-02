import mongoose from 'mongoose';
import { APPOINTMENT_STATUS, FOLLOWUP_STATUS } from '@lanutria/shared';
import { baseOptions, userRef } from './plugins.js';

/**
 * Appointment = un horario concreto en la agenda.
 * FollowUp     = una tarea "qué sigue" sin hora (p. ej. revisar laboratorios).
 */

const appointmentStatusChangeSchema = new mongoose.Schema(
  { from: String, to: String, by: userRef, at: { type: Date, default: Date.now }, reason: String },
  { _id: false },
);

/** Preparado para recordatorios futuros (correo, WhatsApp…). Vacío en el MVP. */
const reminderSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['email', 'sms', 'whatsapp', 'push'] },
    sendAt: Date,
    status: { type: String, enum: ['pendiente', 'enviado', 'fallido', 'cancelado'], default: 'pendiente' },
    sentAt: Date,
  },
  { _id: true },
);

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    nutritionist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    type: { type: String, default: null }, // clave catálogo appointment_type
    status: { type: String, enum: APPOINTMENT_STATUS.values, default: 'programada' },
    statusHistory: { type: [appointmentStatusChangeSchema], default: [] },
    consultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
    rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    rescheduledTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    cancelReason: String,
    notes: { type: String, maxlength: 1000 },
    reminders: { type: [reminderSchema], default: [] },
    createdBy: userRef,
  },
  baseOptions,
);

appointmentSchema.index({ nutritionist: 1, start: 1 });
appointmentSchema.index({ patient: 1, start: -1 });
appointmentSchema.index({ start: 1, status: 1 });

const followUpSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    dueDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: FOLLOWUP_STATUS.values, default: 'pendiente' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originConsultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
    resolvedAt: Date,
    resolvedBy: userRef,
    resolutionNote: { type: String, maxlength: 500 },
    createdBy: userRef,
  },
  baseOptions,
);

followUpSchema.index({ status: 1, dueDate: 1 });
followUpSchema.index({ patient: 1, status: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
export const FollowUp = mongoose.model('FollowUp', followUpSchema);
