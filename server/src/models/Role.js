import mongoose from 'mongoose';
import { isValidPermission } from '@lanutria/shared';
import { baseOptions } from './plugins.js';

/**
 * Permisos embebidos como strings: son pocos (< 60), acotados y siempre se
 * leen junto al rol. El catálogo válido vive en @lanutria/shared.
 */
const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_]+$/ },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 200 },
    level: { type: Number, required: true, min: 1, max: 100 },
    permissions: {
      type: [String],
      default: [],
      validate: { validator: (arr) => arr.every(isValidPermission), message: 'Permiso inválido' },
    },
    isSystem: { type: Boolean, default: false },
  },
  baseOptions,
);

export const Role = mongoose.model('Role', roleSchema);
