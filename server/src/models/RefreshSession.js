import mongoose from 'mongoose';
import { baseOptions } from './plugins.js';

/**
 * Una sesión = una familia de refresh tokens rotados. Sólo se guarda el hash
 * del token vigente. Si llega un token viejo de la familia (reutilización),
 * se revoca la sesión completa: indica posible robo.
 */
const refreshSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    previousHashes: { type: [String], default: [], select: false },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedReason: String,
    userAgent: { type: String, maxlength: 300 },
    ip: String,
    lastUsedAt: Date,
  },
  baseOptions,
);

// MongoDB borra las sesiones expiradas automáticamente.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ previousHashes: 1 });

export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
