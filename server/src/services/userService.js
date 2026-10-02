import { randomBytes } from 'node:crypto';
import { ROLE_KEYS } from '@lanutria/shared';
import { invalidateUserCache } from '../middleware/authenticate.js';
import { Patient, RefreshSession, Role, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/query.js';
import { record } from './auditService.js';
import { hashPassword } from './authService.js';

const isSuper = (actor) => actor.role.key === ROLE_KEYS.SUPERUSER;

/**
 * Regla anti-escalada: sólo se puede gestionar a usuarios (y asignar roles)
 * de nivel estrictamente menor al propio. El superusuario gestiona a todos,
 * pero nadie puede cambiar su propio rol ni desactivarse a sí mismo.
 */
function assertCanManage(actor, targetRoleLevel) {
  if (isSuper(actor)) return;
  if (targetRoleLevel >= actor.role.level) throw ApiError.forbidden('No puedes gestionar usuarios de ese nivel');
}

async function loadRole(roleId) {
  const role = await Role.findById(roleId);
  if (!role) throw ApiError.validation([{ location: 'body', field: 'role', message: 'Rol inexistente' }]);
  return role;
}

/** Contraseña temporal legible (sin caracteres ambiguos). */
function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export async function list({ q, status, role, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (role) filter.role = role;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [users, total, counts] = await Promise.all([
    User.find(filter).populate('role', 'key name level').sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
    Patient.aggregate([
      { $match: { archivedAt: null } },
      { $group: { _id: '$primaryNutritionist', count: { $sum: 1 } } },
    ]),
  ]);
  const byUser = new Map(counts.map((c) => [c._id?.toString(), c.count]));
  return {
    items: users.map((u) => ({ ...u.toJSON(), patientCount: byUser.get(u.id) ?? 0 })),
    total,
  };
}

/** Lista corta para selectores (responsable, agenda). */
export async function listNutritionists() {
  const users = await User.find({ status: 'activo' }).select('name role').populate('role', 'key name').sort({ name: 1 });
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role?.name }));
}

export async function get(id) {
  const user = await User.findById(id).populate('role', 'key name level');
  if (!user) throw ApiError.notFound('Usuario');
  return user;
}

export async function create(actor, { name, email, role: roleId }, req) {
  const role = await loadRole(roleId);
  assertCanManage(actor, role.level);

  const tempPassword = temporaryPassword();
  const user = await User.create({
    name,
    email,
    role: role._id,
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
  });
  await record({ req, action: 'users.create', resource: 'users', resourceId: user.id, meta: { role: role.key } });

  // La contraseña temporal se devuelve UNA sola vez para entregarla al usuario.
  return { user: await get(user.id), temporaryPassword: tempPassword };
}

export async function update(actor, id, changes, req) {
  const user = await User.findById(id).populate('role');
  if (!user) throw ApiError.notFound('Usuario');
  assertCanManage(actor, user.role.level);

  const changedFields = [];
  if (changes.role && changes.role !== user.role.id) {
    if (actor.id === id) throw ApiError.forbidden('No puedes cambiar tu propio rol');
    const newRole = await loadRole(changes.role);
    assertCanManage(actor, newRole.level);
    user.role = newRole._id;
    changedFields.push('role');
  }
  for (const field of ['name', 'email']) {
    if (changes[field] !== undefined && changes[field] !== user[field]) {
      user[field] = changes[field];
      changedFields.push(field);
    }
  }
  await user.save();
  invalidateUserCache(id);
  if (changedFields.length) {
    await record({ req, action: 'users.update', resource: 'users', resourceId: id, meta: { changedFields } });
  }
  return get(id);
}

/**
 * Desactivar exige que el usuario no tenga pacientes a cargo, o indicar a
 * quién se reasignan. Así ningún paciente queda sin responsable.
 */
export async function setStatus(actor, id, { status, reassignTo }, req) {
  if (actor.id === id) throw ApiError.forbidden('No puedes cambiar tu propio estado');
  const user = await User.findById(id).populate('role');
  if (!user) throw ApiError.notFound('Usuario');
  assertCanManage(actor, user.role.level);

  if (status === 'inactivo') {
    const owned = await Patient.countDocuments({ primaryNutritionist: id, archivedAt: null });
    if (owned > 0) {
      if (!reassignTo) {
        throw ApiError.conflict(`El usuario tiene ${owned} paciente(s) a cargo. Indica a quién reasignarlos.`, {
          patientCount: owned,
        });
      }
      const target = await User.findOne({ _id: reassignTo, status: 'activo' });
      if (!target || target.id === id) throw ApiError.badRequest('Usuario de reasignación inválido');
      await Patient.updateMany({ primaryNutritionist: id, archivedAt: null }, { primaryNutritionist: target._id });
    }
    await RefreshSession.updateMany({ user: id, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'user_deactivated' });
  }

  user.status = status;
  await user.save();
  invalidateUserCache(id);
  await record({
    req,
    action: status === 'inactivo' ? 'users.deactivate' : 'users.activate',
    resource: 'users',
    resourceId: id,
    meta: reassignTo ? { reassignedTo: reassignTo } : undefined,
  });
  return get(id);
}

export async function resetPassword(actor, id, req) {
  const user = await User.findById(id).populate('role');
  if (!user) throw ApiError.notFound('Usuario');
  assertCanManage(actor, user.role.level);
  const tempPassword = temporaryPassword();
  user.passwordHash = await hashPassword(tempPassword);
  user.mustChangePassword = true;
  await user.save();
  await RefreshSession.updateMany({ user: id, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'password_reset' });
  invalidateUserCache(id);
  await record({ req, action: 'users.password_reset', resource: 'users', resourceId: id });
  return { temporaryPassword: tempPassword };
}

export async function updatePreferences(userId, preferences) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Usuario');
  user.preferences = { ...user.preferences.toObject(), ...preferences };
  await user.save();
  return user.preferences;
}
