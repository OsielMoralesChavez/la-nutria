import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { hasPermission } from '../middleware/authorize.js';
import { Attachment, Catalog, Consultation } from '../models/index.js';
import { storage } from '../storage/index.js';
import { ApiError } from '../utils/ApiError.js';
import { record } from './auditService.js';

/** Tipos permitidos, verificados por "magic bytes" (no se confía en el MIME del cliente). */
const SIGNATURES = [
  { mime: 'image/jpeg', ext: 'jpg', kind: 'foto', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', kind: 'foto', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', kind: 'foto', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', kind: 'documento', test: (b) => b.subarray(0, 5).toString() === '%PDF-' },
];

export const ALLOWED_MIME = SIGNATURES.map((s) => s.mime);

const detect = (buffer) => SIGNATURES.find((s) => s.test(buffer));

export async function list(patientId, { kind, consultation }) {
  return Attachment.find({ patient: patientId, deletedAt: null, ...(kind && { kind }), ...(consultation && { consultation }) })
    .sort({ takenAt: -1 })
    .populate('uploadedBy', 'name');
}

export async function upload(patientId, file, meta, actor, req) {
  if (!file) throw ApiError.validation([{ location: 'body', field: 'file', message: 'Adjunta un archivo' }]);
  const sig = detect(file.buffer);
  if (!sig) throw ApiError.validation([{ location: 'body', field: 'file', message: 'Formato no permitido (JPG, PNG, WEBP o PDF)' }]);

  if (meta.consultation && !(await Consultation.exists({ _id: meta.consultation, patient: patientId }))) {
    throw ApiError.validation([{ location: 'body', field: 'consultation', message: 'La consulta no pertenece al paciente' }]);
  }
  if (meta.category && !(await Catalog.exists({ type: 'attachment_category', key: meta.category, active: true }))) {
    throw ApiError.validation([{ location: 'body', field: 'category', message: 'Categoría inválida' }]);
  }

  const storageKey = await storage.put(file.buffer, { ext: sig.ext });
  const att = await Attachment.create({
    patient: patientId,
    consultation: meta.consultation,
    kind: sig.kind,
    category: meta.category ?? null,
    originalName: file.originalname?.slice(0, 200),
    storageKey,
    mimeType: sig.mime,
    size: file.size,
    takenAt: meta.takenAt ?? new Date(),
    notes: meta.notes,
    uploadedBy: actor.id,
  });
  await record({ req, action: 'attachments.create', resource: 'attachments', resourceId: att.id, meta: { patient: patientId, kind: sig.kind } });
  return att;
}

/** URL firmada de corta duración: permite usar <img src> sin exponer el token de sesión. */
export async function signedUrl(id, patientId) {
  const att = await Attachment.findOne({ _id: id, patient: patientId, deletedAt: null });
  if (!att) throw ApiError.notFound('Archivo');
  const token = jwt.sign({ aid: att.id, purpose: 'file' }, env.JWT_ACCESS_SECRET, { expiresIn: '5m', algorithm: 'HS256' });
  return { url: `/api/v1/files/${token}`, expiresIn: 300 };
}

export async function streamBySignedToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw ApiError.unauthorized('Enlace expirado');
  }
  if (payload.purpose !== 'file') throw ApiError.unauthorized('Enlace inválido');
  const att = await Attachment.findOne({ _id: payload.aid, deletedAt: null }).select('+storageKey');
  if (!att) throw ApiError.notFound('Archivo');
  return { stream: await storage.stream(att.storageKey), mimeType: att.mimeType, name: att.originalName };
}

/** Borrado lógico; el archivo físico se conserva para auditoría. */
export async function remove(id, patientId, actor, req) {
  const att = await Attachment.findOne({ _id: id, patient: patientId, deletedAt: null });
  if (!att) throw ApiError.notFound('Archivo');
  const own = att.uploadedBy?.toString() === actor.id;
  if (!own && !hasPermission(actor, 'attachments:manage')) throw ApiError.forbidden('Sólo puedes eliminar archivos que subiste');
  att.deletedAt = new Date();
  att.deletedBy = actor.id;
  await att.save();
  await record({ req, action: 'attachments.delete', resource: 'attachments', resourceId: id, meta: { patient: patientId } });
}
