import { CLINICAL_SECTION_KEYS } from '@lanutria/shared';
import { ClinicalRecord, ClinicalRecordRevision } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { record } from './auditService.js';

export async function get(patientId) {
  let rec = await ClinicalRecord.findOne({ patient: patientId }).populate('updatedBy', 'name');
  if (!rec) rec = await ClinicalRecord.create({ patient: patientId });
  return rec;
}

/**
 * Actualiza secciones y guarda una revisión inmutable con la versión nueva.
 * Si no cambió nada, no crea revisión.
 */
export async function update(patientId, sections, actor, { consultationId, req, session } = {}) {
  const rec = (await ClinicalRecord.findOne({ patient: patientId }).session(session ?? null)) ?? new ClinicalRecord({ patient: patientId });

  const changedFields = CLINICAL_SECTION_KEYS.filter(
    (k) => sections[k] !== undefined && (rec.sections?.[k] ?? '') !== sections[k],
  );
  if (!changedFields.length) return rec;

  for (const k of changedFields) rec.sections[k] = sections[k];
  rec.version += 1;
  rec.updatedBy = actor.id;
  await rec.save({ session });

  await ClinicalRecordRevision.create(
    [
      {
        patient: patientId,
        version: rec.version,
        sections: rec.sections.toObject(),
        changedFields,
        changedBy: actor.id,
        consultation: consultationId,
      },
    ],
    { session },
  );

  // Auditoría: sólo nombres de secciones, nunca su contenido.
  if (req) await record({ req, action: 'clinical.update', resource: 'clinical', resourceId: patientId, meta: { changedFields, version: rec.version } });
  return rec;
}

export async function listRevisions(patientId) {
  return ClinicalRecordRevision.find({ patient: patientId })
    .select('version changedFields changedBy consultation createdAt')
    .sort({ version: -1 })
    .populate('changedBy', 'name');
}

export async function getRevision(patientId, version) {
  const rev = await ClinicalRecordRevision.findOne({ patient: patientId, version }).populate('changedBy', 'name');
  if (!rev) throw ApiError.notFound('Revisión');
  return rev;
}
