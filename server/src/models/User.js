import mongoose from 'mongoose';
import { NOTE_FORMAT } from '@lanutria/shared';
import { baseOptions } from './plugins.js';

const preferencesSchema = new mongoose.Schema(
  {
    noteFormat: { type: String, enum: NOTE_FORMAT.values, default: 'libre' },
    defaultAgendaView: { type: String, enum: ['dia', 'semana', 'lista'], default: 'semana' },
    dashboardScope: { type: String, enum: ['mine', 'all'], default: 'mine' },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    // select:false → nunca sale de la BD salvo que se pida explícitamente.
    passwordHash: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, default: false },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    status: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
    preferences: { type: preferencesSchema, default: () => ({}) },
    lastLoginAt: Date,
    failedLogins: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
  },
  baseOptions,
);

export const User = mongoose.model('User', userSchema);
