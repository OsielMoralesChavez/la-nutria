import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import * as auth from '../controllers/authController.js';
import * as admin from '../controllers/adminController.js';
import * as clinicalCtl from '../controllers/clinicalController.js';
import * as patient from '../controllers/patientController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { loginLimiter, refreshLimiter } from '../middleware/rateLimiters.js';
import { validate, zIdParam } from '../middleware/validate.js';
import { ALLOWED_MIME } from '../services/attachmentService.js';
import { ApiError } from '../utils/ApiError.js';
import * as v from '../validators/index.js';

/**
 * Mapa completo de la API v1. Cada ruta declara:
 *   1. autenticación (todas salvo login/refresh/files firmados)
 *   2. permiso requerido (`authorize`)
 *   3. validación de entrada (`validate`)
 * Las reglas de propiedad se aplican en los services.
 */
const router = Router();
const byId = { params: zIdParam };

// ───────────── Auth (público) ─────────────
router.post('/auth/login', loginLimiter, validate({ body: v.auth.login }), auth.login);
router.post('/auth/refresh', refreshLimiter, auth.refresh);
router.post('/auth/logout', auth.logout);

// Archivos con URL firmada (el token firmado ES la autorización; vence en 5 min).
router.get('/files/:token', clinicalCtl.files.stream);

// ───────────── A partir de aquí, todo requiere sesión ─────────────
router.use(authenticate);

router.get('/auth/me', auth.me);
router.patch('/auth/password', validate({ body: v.auth.changePassword }), auth.changePassword);
router.patch('/auth/preferences', validate({ body: v.auth.preferences }), auth.updatePreferences);
router.get('/auth/sessions', auth.sessions);
router.delete('/auth/sessions/:sessionId', validate({ params: v.auth.sessionParam }), auth.revokeSession);

// ───────────── Dashboard ─────────────
router.get('/dashboard', authorize('dashboard:read'), validate({ query: v.dashboard.query }), clinicalCtl.dashboard.get);

// ───────────── Pacientes ─────────────
router.get('/patients', authorize('patients:read'), validate({ query: v.patients.list }), patient.list);
router.post('/patients', authorize('patients:create'), validate({ body: v.patients.create }), patient.create);
router.get('/patients/:id', authorize('patients:read'), validate(byId), patient.get);
router.patch('/patients/:id', authorize('patients:update'), validate({ ...byId, body: v.patients.update }), patient.update);
router.patch('/patients/:id/status', authorize('patients:update'), validate({ ...byId, body: v.patients.status }), patient.setStatus);
router.patch('/patients/:id/assign', authorize('patients:update'), validate({ ...byId, body: v.patients.assign }), patient.assign);
router.post('/patients/:id/archive', authorize('patients:update'), validate(byId), patient.archive);
router.post('/patients/:id/restore', authorize('patients:update'), validate(byId), patient.restore);
router.delete('/patients/:id', authorize('patients:delete'), validate({ ...byId, body: v.patients.hardDelete }), patient.hardDelete);
router.get('/patients/:id/summary', authorize('patients:read'), validate(byId), patient.summary);
router.get('/patients/:id/timeline', authorize('patients:read'), validate({ ...byId, query: v.patients.timeline }), patient.timeline);

// Expediente
router.get('/patients/:id/clinical-record', authorize('clinical:read'), validate(byId), patient.getClinical);
router.put('/patients/:id/clinical-record', authorize('clinical:update'), validate({ ...byId, body: v.clinical.update }), patient.updateClinical);
router.get('/patients/:id/clinical-record/revisions', authorize('clinical:read'), validate(byId), patient.listRevisions);
router.get(
  '/patients/:id/clinical-record/revisions/:version',
  authorize('clinical:read'),
  validate({ params: v.clinical.revisionParam }),
  patient.getRevision,
);

// Consultas, mediciones, objetivos, seguimientos del paciente
router.get('/patients/:id/consultations', authorize('consultations:read'), validate({ ...byId, query: v.consultations.list }), patient.listConsultations);
router.post('/patients/:id/consultations', authorize('consultations:create'), validate({ ...byId, body: v.consultations.start }), patient.startConsultation);
router.get('/patients/:id/measurements', authorize('measurements:read'), validate({ ...byId, query: v.paging }), patient.listMeasurements);
router.get('/patients/:id/measurements/series', authorize('measurements:read'), validate({ ...byId, query: v.patients.series }), patient.series);
router.get('/patients/:id/goals', authorize('goals:read'), validate({ ...byId, query: v.goals.list }), patient.listGoals);
router.post('/patients/:id/goals', authorize('goals:create'), validate({ ...byId, body: v.goals.create }), patient.createGoal);
router.post('/patients/:id/followups', authorize('followups:create'), validate({ ...byId, body: v.followUps.create }), patient.createFollowUp);

// Archivos (módulo opcional)
if (env.FEATURE_ATTACHMENTS) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) =>
      ALLOWED_MIME.includes(file.mimetype)
        ? cb(null, true)
        : cb(ApiError.validation([{ location: 'body', field: 'file', message: 'Formato no permitido (JPG, PNG, WEBP o PDF)' }])),
  });
  router.get('/patients/:id/attachments', authorize('attachments:read'), validate({ ...byId, query: v.attachments.list }), patient.listAttachments);
  router.post(
    '/patients/:id/attachments',
    authorize('attachments:create'),
    upload.single('file'),
    validate({ ...byId, body: v.attachments.upload }),
    patient.uploadAttachment,
  );
  router.get('/patients/:id/attachments/:attachmentId/url', authorize('attachments:read'), validate({ params: v.attachments.param }), patient.attachmentUrl);
  router.delete('/patients/:id/attachments/:attachmentId', authorize('attachments:delete'), validate({ params: v.attachments.param }), patient.deleteAttachment);
}

// ───────────── Consultas ─────────────
const c = clinicalCtl.consultations;
router.get('/consultations/:id', authorize('consultations:read'), validate(byId), c.get);
router.get('/consultations/:id/context', authorize('consultations:read'), validate(byId), c.context);
router.patch('/consultations/:id', authorize('consultations:update'), validate({ ...byId, body: v.consultations.saveDraft }), c.saveDraft);
router.post('/consultations/:id/close', authorize('consultations:update', 'measurements:create'), validate(byId), c.close);
router.delete('/consultations/:id', authorize('consultations:update'), validate(byId), c.discard);
router.post('/consultations/:id/addenda', authorize('consultations:update'), validate({ ...byId, body: v.consultations.addendum }), c.addAddendum);

// ───────────── Objetivos ─────────────
router.get('/goals/:id', authorize('goals:read'), validate(byId), clinicalCtl.goals.get);
router.patch('/goals/:id', authorize('goals:update'), validate({ ...byId, body: v.goals.update }), clinicalCtl.goals.update);
router.post('/goals/:id/checkpoints', authorize('goals:update'), validate({ ...byId, body: v.goals.checkpoint }), clinicalCtl.goals.checkpoint);

// ───────────── Agenda ─────────────
const a = clinicalCtl.appointments;
router.get('/appointments', authorize('appointments:read'), validate({ query: v.appointments.list }), a.list);
router.get('/appointments/slots', authorize('appointments:read'), validate({ query: v.appointments.slots }), a.slots);
router.post('/appointments', authorize('appointments:create'), validate({ body: v.appointments.create }), a.create);
router.get('/appointments/:id', authorize('appointments:read'), validate(byId), a.get);
router.patch('/appointments/:id', authorize('appointments:update'), validate({ ...byId, body: v.appointments.update }), a.update);
router.post('/appointments/:id/status', authorize('appointments:update'), validate({ ...byId, body: v.appointments.status }), a.setStatus);
router.post('/appointments/:id/reschedule', authorize('appointments:update'), validate({ ...byId, body: v.appointments.reschedule }), a.reschedule);
router.post('/appointments/:id/start-consultation', authorize('consultations:create'), validate(byId), a.startConsultation);

// ───────────── Seguimientos ─────────────
router.get('/followups', authorize('followups:read'), validate({ query: v.followUps.list }), clinicalCtl.followUps.list);
router.patch('/followups/:id', authorize('followups:update'), validate({ ...byId, body: v.followUps.update }), clinicalCtl.followUps.update);

// ───────────── Alertas ─────────────
const al = clinicalCtl.alerts;
router.get('/alerts', authorize('alerts:read'), validate({ query: v.alerts.list }), al.list);
router.patch('/alerts/:id', authorize('alerts:update'), validate({ ...byId, body: v.alerts.act }), al.act);
router.get('/alert-rules', authorize('alerts:read'), al.rules);
router.patch('/alert-rules/:key', authorize('alerts:manage'), validate({ params: v.alerts.ruleParam, body: v.alerts.ruleUpdate }), al.updateRule);
router.post('/alert-rules/:key/preview', authorize('alerts:manage'), validate({ params: v.alerts.ruleParam, body: v.alerts.rulePreview }), al.previewRule);
router.post('/alert-rules/run', authorize('alerts:manage'), al.run);

// ───────────── Catálogos ─────────────
const cat = admin.catalogs;
router.get('/catalogs', authorize('catalogs:read'), validate({ query: v.catalogs.list }), cat.list);
router.post('/catalogs', authorize('catalogs:manage'), validate({ body: v.catalogs.create }), cat.create);
router.patch('/catalogs/:id', authorize('catalogs:manage'), validate({ ...byId, body: v.catalogs.update }), cat.update);
router.get('/metrics', authorize('catalogs:read'), validate({ query: v.catalogs.includeInactive }), cat.listMetrics);
router.post('/metrics', authorize('catalogs:manage'), validate({ body: v.catalogs.metricCreate }), cat.createMetric);
router.patch('/metrics/:id', authorize('catalogs:manage'), validate({ ...byId, body: v.catalogs.metricUpdate }), cat.updateMetric);
router.get('/goal-types', authorize('catalogs:read'), validate({ query: v.catalogs.includeInactive }), cat.listGoalTypes);
router.post('/goal-types', authorize('catalogs:manage'), validate({ body: v.catalogs.goalTypeCreate }), cat.createGoalType);
router.patch('/goal-types/:id', authorize('catalogs:manage'), validate({ ...byId, body: v.catalogs.goalTypeUpdate }), cat.updateGoalType);

// ───────────── Usuarios y roles ─────────────
const u = admin.users;
// Lista mínima para selectores (responsable, agenda): cualquier usuario con acceso a pacientes.
router.get('/users/nutritionists', authorize('patients:read'), u.nutritionists);
router.get('/users', authorize('users:read'), validate({ query: v.users.list }), u.list);
router.post('/users', authorize('users:create'), validate({ body: v.users.create }), u.create);
router.get('/users/:id', authorize('users:read'), validate(byId), u.get);
router.patch('/users/:id', authorize('users:update'), validate({ ...byId, body: v.users.update }), u.update);
router.patch('/users/:id/status', authorize('users:update'), validate({ ...byId, body: v.users.status }), u.setStatus);
router.post('/users/:id/reset-password', authorize('users:update'), validate(byId), u.resetPassword);

const r = admin.roles;
router.get('/roles', authorize('roles:read'), r.list);
router.get('/permissions', authorize('roles:read'), r.catalog);
router.post('/roles', authorize('roles:manage'), validate({ body: v.roles.create }), r.create);
router.patch('/roles/:id', authorize('roles:manage'), validate({ ...byId, body: v.roles.update }), r.update);
router.put('/roles/:id/permissions', authorize('roles:manage'), validate({ ...byId, body: v.roles.permissions }), r.updatePermissions);
router.delete('/roles/:id', authorize('roles:manage'), validate(byId), r.remove);

// ───────────── Configuración y auditoría ─────────────
router.get('/settings', authorize('settings:read'), admin.settings.get);
router.patch('/settings', authorize('settings:manage'), validate({ body: v.settings.update }), admin.settings.update);
router.get('/audit-logs', authorize('audit:read'), validate({ query: v.audit.list }), admin.audit.list);

export default router;
