import * as attachmentService from '../services/attachmentService.js';
import * as clinicalService from '../services/clinicalRecordService.js';
import * as consultationService from '../services/consultationService.js';
import * as goalService from '../services/goalService.js';
import * as measurementService from '../services/measurementService.js';
import * as patientService from '../services/patientService.js';
import * as scheduleService from '../services/scheduleService.js';
import * as timelineService from '../services/timelineService.js';
import { created, noContent, ok, paged } from '../utils/respond.js';

const pid = (req) => req.valid.params.id;

export async function list(req, res) {
  paged(res, await patientService.list(req.user, req.valid.query), req.valid.query);
}
export async function create(req, res) {
  created(res, await patientService.create(req.user, req.valid.body, req));
}
export async function get(req, res) {
  ok(res, await patientService.get(pid(req)));
}
export async function update(req, res) {
  ok(res, await patientService.update(req.user, pid(req), req.valid.body, req));
}
export async function setStatus(req, res) {
  ok(res, await patientService.setStatus(req.user, pid(req), req.valid.body, req));
}
export async function assign(req, res) {
  ok(res, await patientService.assign(req.user, pid(req), req.valid.body, req));
}
export async function archive(req, res) {
  ok(res, await patientService.archive(req.user, pid(req), req));
}
export async function restore(req, res) {
  ok(res, await patientService.restore(req.user, pid(req), req));
}
export async function hardDelete(req, res) {
  await patientService.hardDelete(req.user, pid(req), req.valid.body, req);
  noContent(res);
}
export async function summary(req, res) {
  await patientService.findOrThrow(pid(req), { includeArchived: true });
  ok(res, await patientService.summary(pid(req)));
}
export async function timeline(req, res) {
  const { items, nextCursor } = await timelineService.build(pid(req), req.valid.query);
  ok(res, items, { nextCursor });
}

// ── Expediente ──
export async function getClinical(req, res) {
  ok(res, await clinicalService.get(pid(req)));
}
export async function updateClinical(req, res) {
  await patientService.findOrThrow(pid(req));
  ok(res, await clinicalService.update(pid(req), req.valid.body, req.user, { req }));
}
export async function listRevisions(req, res) {
  ok(res, await clinicalService.listRevisions(pid(req)));
}
export async function getRevision(req, res) {
  ok(res, await clinicalService.getRevision(pid(req), req.valid.params.version));
}

// ── Consultas del paciente ──
export async function listConsultations(req, res) {
  paged(res, await consultationService.listByPatient(pid(req), req.valid.query), req.valid.query);
}
export async function startConsultation(req, res) {
  const { consultation, resumed } = await consultationService.start(pid(req), req.valid.body, req.user, req);
  ok(res, consultation, { resumed }, resumed ? 200 : 201);
}

// ── Mediciones ──
export async function listMeasurements(req, res) {
  paged(res, await measurementService.list(pid(req), req.valid.query), req.valid.query);
}
export async function series(req, res) {
  ok(res, await measurementService.series(pid(req), req.valid.query.metrics, req.valid.query));
}

// ── Objetivos ──
export async function listGoals(req, res) {
  ok(res, await goalService.listByPatient(pid(req), req.valid.query));
}
export async function createGoal(req, res) {
  await patientService.findOrThrow(pid(req));
  created(res, await goalService.create(pid(req), req.valid.body, req.user, { req }));
}

// ── Seguimientos ──
export async function createFollowUp(req, res) {
  await patientService.findOrThrow(pid(req));
  created(res, await scheduleService.createFollowUp(pid(req), req.valid.body, req.user, { req }));
}

// ── Archivos ──
export async function listAttachments(req, res) {
  ok(res, await attachmentService.list(pid(req), req.valid.query));
}
export async function uploadAttachment(req, res) {
  await patientService.findOrThrow(pid(req));
  created(res, await attachmentService.upload(pid(req), req.file, req.valid.body, req.user, req));
}
export async function attachmentUrl(req, res) {
  ok(res, await attachmentService.signedUrl(req.valid.params.attachmentId, pid(req)));
}
export async function deleteAttachment(req, res) {
  await attachmentService.remove(req.valid.params.attachmentId, pid(req), req.user, req);
  noContent(res);
}
