import { RESOURCES, ACTIONS } from '@lanutria/shared';
import * as auditService from '../services/auditService.js';
import * as catalogService from '../services/catalogService.js';
import * as roleService from '../services/roleService.js';
import * as settingsService from '../services/settingsService.js';
import * as userService from '../services/userService.js';
import { created, noContent, ok, paged } from '../utils/respond.js';

// ── Usuarios ──
export const users = {
  async list(req, res) {
    paged(res, await userService.list(req.valid.query), req.valid.query);
  },
  async nutritionists(_req, res) {
    ok(res, await userService.listNutritionists());
  },
  async get(req, res) {
    ok(res, await userService.get(req.valid.params.id));
  },
  async create(req, res) {
    created(res, await userService.create(req.user, req.valid.body, req));
  },
  async update(req, res) {
    ok(res, await userService.update(req.user, req.valid.params.id, req.valid.body, req));
  },
  async setStatus(req, res) {
    ok(res, await userService.setStatus(req.user, req.valid.params.id, req.valid.body, req));
  },
  async resetPassword(req, res) {
    ok(res, await userService.resetPassword(req.user, req.valid.params.id, req));
  },
};

// ── Roles y permisos ──
export const roles = {
  async list(_req, res) {
    ok(res, await roleService.list());
  },
  async catalog(_req, res) {
    ok(res, { resources: RESOURCES, actions: ACTIONS });
  },
  async create(req, res) {
    created(res, await roleService.create(req.user, req.valid.body, req));
  },
  async update(req, res) {
    ok(res, await roleService.update(req.user, req.valid.params.id, req.valid.body, req));
  },
  async updatePermissions(req, res) {
    ok(res, await roleService.updatePermissions(req.user, req.valid.params.id, req.valid.body.permissions, req));
  },
  async remove(req, res) {
    await roleService.remove(req.user, req.valid.params.id, req);
    noContent(res);
  },
};

// ── Catálogos ──
export const catalogs = {
  async list(req, res) {
    ok(res, await catalogService.list(req.valid.query));
  },
  async create(req, res) {
    created(res, await catalogService.create(req.valid.body, req.user, req));
  },
  async update(req, res) {
    ok(res, await catalogService.update(req.valid.params.id, req.valid.body, req.user, req));
  },
  async listMetrics(req, res) {
    ok(res, await catalogService.listMetrics(req.valid.query));
  },
  async createMetric(req, res) {
    created(res, await catalogService.createMetric(req.valid.body, req.user, req));
  },
  async updateMetric(req, res) {
    ok(res, await catalogService.updateMetric(req.valid.params.id, req.valid.body, req.user, req));
  },
  async listGoalTypes(req, res) {
    ok(res, await catalogService.listGoalTypes(req.valid.query));
  },
  async createGoalType(req, res) {
    created(res, await catalogService.createGoalType(req.valid.body, req.user, req));
  },
  async updateGoalType(req, res) {
    ok(res, await catalogService.updateGoalType(req.valid.params.id, req.valid.body, req.user, req));
  },
};

// ── Configuración ──
export const settings = {
  async get(_req, res) {
    ok(res, await settingsService.getAll());
  },
  async update(req, res) {
    ok(res, await settingsService.update(req.valid.body, req.user, req));
  },
};

// ── Auditoría ──
export const audit = {
  async list(req, res) {
    paged(res, await auditService.list(req.valid.query), req.valid.query);
  },
};
