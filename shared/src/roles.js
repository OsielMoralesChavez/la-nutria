import { ALL_PERMISSIONS } from './permissions.js';

/**
 * Roles base. Se siembran en la BD; después el Superusuario puede ajustar los
 * permisos de "administrador" y "usuario" o crear roles nuevos (p. ej. Asistente).
 *
 * `level` evita escaladas: nadie puede asignar ni editar un rol de nivel mayor
 * o igual al suyo (salvo el superusuario).
 */

const CLINICAL_DAILY = [
  'dashboard:read',
  'patients:read',
  'patients:create',
  'patients:update',
  'clinical:read',
  'clinical:update',
  'consultations:read',
  'consultations:create',
  'consultations:update',
  'measurements:read',
  'measurements:create',
  'goals:read',
  'goals:create',
  'goals:update',
  'followups:read',
  'followups:create',
  'followups:update',
  'appointments:read',
  'appointments:create',
  'appointments:update',
  'attachments:read',
  'attachments:create',
  'attachments:delete',
  'alerts:read',
  'alerts:update',
  'catalogs:read',
  'settings:read',
];

export const ROLE_KEYS = Object.freeze({
  SUPERUSER: 'superusuario',
  ADMIN: 'administrador',
  USER: 'usuario',
});

export const SYSTEM_ROLES = Object.freeze([
  {
    key: ROLE_KEYS.SUPERUSER,
    name: 'Superusuario',
    description: 'Control administrativo global del sistema',
    level: 100,
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: ROLE_KEYS.ADMIN,
    name: 'Administrador',
    description: 'Nutriólogo coordinador: todos los pacientes, usuarios, catálogos y configuración',
    level: 50,
    permissions: [
      ...CLINICAL_DAILY,
      'patients:manage',
      'attachments:manage',
      'alerts:manage',
      'catalogs:manage',
      'users:read',
      'users:create',
      'users:update',
      'roles:read',
      'settings:manage',
    ],
  },
  {
    key: ROLE_KEYS.USER,
    name: 'Usuario',
    description: 'Nutriólogo: operación clínica cotidiana',
    level: 10,
    permissions: [...CLINICAL_DAILY],
  },
]);
