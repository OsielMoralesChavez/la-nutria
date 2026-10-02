import * as alertService from '../services/alertService.js';
import * as attachmentService from '../services/attachmentService.js';
import * as consultationService from '../services/consultationService.js';
import * as dashboardService from '../services/dashboardService.js';
import * as goalService from '../services/goalService.js';
import * as scheduleService from '../services/scheduleService.js';
import { created, noContent, ok, paged } from '../utils/respond.js';

const id = (req) => req.valid.params.id;
/** `assignedTo=me` → id del usuario actual. */
const me = (req, v) => (v === 'me' ? req.user.id : v);

export const consultations = {
  async get(req, res) {
    ok(res, await consultationService.get(id(req)));
  },
  async context(req, res) {
    ok(res, await consultationService.context(id(req)));
  },
  async saveDraft(req, res) {
    ok(res, await consultationService.saveDraft(id(req), req.valid.body, req.user));
  },
  async close(req, res) {
    ok(res, await consultationService.close(id(req), req.user, req));
  },
  async discard(req, res) {
    await consultationService.discard(id(req), req.user, req);
    noContent(res);
  },
  async addAddendum(req, res) {
    ok(res, await consultationService.addAddendum(id(req), req.valid.body, req.user, req));
  },
};

export const goals = {
  async get(req, res) {
    ok(res, await goalService.get(id(req)));
  },
  async update(req, res) {
    await goalService.update(id(req), req.valid.body, req.user, { req });
    ok(res, await goalService.get(id(req)));
  },
  async checkpoint(req, res) {
    await goalService.addCheckpoint(id(req), req.valid.body, req.user);
    ok(res, await goalService.get(id(req)));
  },
};

export const appointments = {
  async list(req, res) {
    ok(res, await scheduleService.listAppointments(req.valid.query));
  },
  async get(req, res) {
    ok(res, await scheduleService.getAppointment(id(req)));
  },
  async create(req, res) {
    const appt = await scheduleService.createAppointment(req.valid.body, req.user, { req });
    created(res, await scheduleService.getAppointment(appt.id));
  },
  async update(req, res) {
    ok(res, await scheduleService.updateAppointment(id(req), req.valid.body, req.user, req));
  },
  async setStatus(req, res) {
    await scheduleService.setAppointmentStatus(id(req), req.valid.body, req.user, { req });
    ok(res, await scheduleService.getAppointment(id(req)));
  },
  async reschedule(req, res) {
    created(res, await scheduleService.reschedule(id(req), req.valid.body, req.user, req));
  },
  async startConsultation(req, res) {
    const appt = await scheduleService.getAppointment(id(req));
    const { consultation, resumed } = await consultationService.start(
      appt.patient._id.toString(),
      { appointment: appt.id },
      req.user,
      req,
    );
    ok(res, consultation, { resumed }, resumed ? 200 : 201);
  },
  async slots(req, res) {
    const q = req.valid.query;
    ok(res, await scheduleService.freeSlots({ ...q, nutritionist: q.nutritionist ?? req.user.id }));
  },
};

export const followUps = {
  async list(req, res) {
    const q = { ...req.valid.query, assignedTo: me(req, req.valid.query.assignedTo) };
    paged(res, await scheduleService.listFollowUps(q), q);
  },
  async update(req, res) {
    ok(res, await scheduleService.updateFollowUp(id(req), req.valid.body, req.user, { req }));
  },
};

export const alerts = {
  async list(req, res) {
    const q = { ...req.valid.query, assignedTo: me(req, req.valid.query.assignedTo) };
    paged(res, await alertService.list(q), q);
  },
  async act(req, res) {
    ok(res, await alertService.act(id(req), req.valid.body, req.user, req));
  },
  async rules(_req, res) {
    ok(res, await alertService.listRules());
  },
  async updateRule(req, res) {
    ok(res, await alertService.updateRule(req.valid.params.key, req.valid.body, req.user, req));
  },
  async previewRule(req, res) {
    ok(res, await alertService.previewRule(req.valid.params.key, req.valid.body.params));
  },
  async run(_req, res) {
    ok(res, await alertService.runAll());
  },
};

export const dashboard = {
  async get(req, res) {
    ok(res, await dashboardService.overview(req.user, req.valid.query));
  },
};

export const files = {
  async stream(req, res) {
    const { stream, mimeType, name } = await attachmentService.streamBySignedToken(req.params.token);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name ?? 'archivo')}"`);
    stream.pipe(res);
  },
};

