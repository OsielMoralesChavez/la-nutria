import mongoose from 'mongoose';
import { GOAL_DIRECTION, GOAL_KIND, GOAL_STATUS } from '@lanutria/shared';
import { baseOptions, userRef } from './plugins.js';

/** Catálogo de tipos de objetivo (editable). */
const goalTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_]+$/ },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, enum: GOAL_KIND.values, required: true },
    defaultMetric: { type: String, default: null },
    direction: { type: String, enum: GOAL_DIRECTION.values, default: null },
    defaultTolerance: Number,
    order: { type: Number, default: 100 },
    active: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
  },
  baseOptions,
);

/** Avance cualitativo registrado en una consulta (hábitos, adherencia…). */
const checkpointSchema = new mongoose.Schema(
  {
    consultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
    date: { type: Date, default: Date.now },
    score: { type: Number, min: 0, max: 100 },
    note: { type: String, maxlength: 1000 },
    by: userRef,
  },
  { _id: false },
);

const goalSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    goalType: { type: String, required: true }, // clave en goaltypes
    title: { type: String, required: true, trim: true, maxlength: 160 },
    kind: { type: String, enum: GOAL_KIND.values, required: true },
    metric: { type: String, default: null },
    direction: { type: String, enum: GOAL_DIRECTION.values, default: null },
    baseline: Number,
    target: Number,
    tolerance: Number,
    startDate: { type: Date, default: Date.now },
    dueDate: Date,
    status: { type: String, enum: GOAL_STATUS.values, default: 'en_curso' },
    checkpoints: { type: [checkpointSchema], default: [] },
    notes: { type: String, maxlength: 2000 },
    createdIn: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
    createdBy: userRef,
    closedAt: Date,
    closedBy: userRef,
  },
  baseOptions,
);

goalSchema.index({ patient: 1, status: 1 });
goalSchema.index({ status: 1, dueDate: 1 });

export const GoalType = mongoose.model('GoalType', goalTypeSchema);
export const Goal = mongoose.model('Goal', goalSchema);
