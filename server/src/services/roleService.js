import { ROLE_KEYS } from '@lanutria/shared';
import { invalidateUserCache } from '../middleware/authenticate.js';
import { Role, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { record } from './auditService.js';

export async function list() {
  const [roles, counts] = await Promise.all([
    Role.find().sort({ level: -1 }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ]);
  const byRole = new Map(counts.map((c) => [c._id.toString(), c.count]));
  return roles.map((r) => ({ ...r.toJSON(), userCount: byRole.get(r.id) ?? 0 }));
}

export async function create(actor, { key, name, description, level, permissions = [] }, req) {
  if (level >= actor.role.level) throw ApiError.forbidden('El nivel debe ser menor al de tu rol');
  assertGrantable(actor, permissions);
  const role = await Role.create({ key, name, description, level, permissions, isSystem: false });
  await record({ req, action: 'roles.create', resource: 'roles', resourceId: role.id, meta: { key, permissions } });
  return role;
}

/** No se puede otorgar un permiso que uno mismo no tiene. */
function assertGrantable(actor, permissions) {
  const notOwned = permissions.filter((p) => !actor.permissions.has(p));
  if (notOwned.length) throw ApiError.forbidden(`No puedes otorgar permisos que no tienes: ${notOwned.join(', ')}`);
}

/**
 * Reemplaza los permisos de un rol. El rol Superusuario no es editable para
 * evitar que el sistema se quede sin nadie con control total.
 */
export async function updatePermissions(actor, id, permissions, req) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Rol');
  if (role.key === ROLE_KEYS.SUPERUSER) throw ApiError.forbidden('El rol Superusuario no se puede modificar');
  if (role.level >= actor.role.level) throw ApiError.forbidden('No puedes modificar un rol de tu nivel o superior');

  const before = new Set(role.permissions);
  const after = new Set(permissions);
  const added = [...after].filter((p) => !before.has(p));
  const removed = [...before].filter((p) => !after.has(p));
  assertGrantable(actor, added);

  role.permissions = [...after].sort();
  await role.save();
  invalidateUserCache(); // afecta a todos los usuarios con ese rol
  await record({ req, action: 'roles.permissions_update', resource: 'roles', resourceId: id, meta: { role: role.key, added, removed } });
  return role;
}

export async function update(actor, id, { name, description }, req) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Rol');
  if (role.level >= actor.role.level && role.key !== ROLE_KEYS.SUPERUSER) throw ApiError.forbidden();
  if (name !== undefined) role.name = name;
  if (description !== undefined) role.description = description;
  await role.save();
  await record({ req, action: 'roles.update', resource: 'roles', resourceId: id });
  return role;
}

export async function remove(actor, id, req) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Rol');
  if (role.isSystem) throw ApiError.forbidden('Los roles del sistema no se pueden eliminar');
  if (role.level >= actor.role.level) throw ApiError.forbidden();
  const inUse = await User.countDocuments({ role: id });
  if (inUse) throw ApiError.conflict(`El rol está asignado a ${inUse} usuario(s)`);
  await role.deleteOne();
  await record({ req, action: 'roles.delete', resource: 'roles', resourceId: id, meta: { key: role.key } });
}
