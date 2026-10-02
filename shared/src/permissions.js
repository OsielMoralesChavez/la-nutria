/**
 * Catálogo de permisos: `recurso:acción`.
 *
 * Es la única fuente de verdad. El servidor lo usa para autorizar cada ruta y el
 * cliente para decidir qué mostrar. Agregar un recurso nuevo (p. ej. "plans")
 * empieza aquí.
 */

export const ACTIONS = Object.freeze({
  read: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  manage: 'Administrar',
});

/**
 * `actions` limita qué acciones existen para cada recurso (la matriz de permisos
 * muestra "—" en las que no aplican). `notes` explica acciones no obvias.
 */
export const RESOURCES = Object.freeze({
  dashboard: { label: 'Dashboard', actions: ['read'] },
  patients: {
    label: 'Pacientes',
    actions: ['read', 'create', 'update', 'delete', 'manage'],
    notes: {
      update: 'Editar datos, cambiar estado; reasignar/archivar sólo sus pacientes',
      manage: 'Reasignar y archivar cualquier paciente',
      delete: 'Borrado físico (excepcional)',
    },
  },
  clinical: { label: 'Expediente clínico', actions: ['read', 'update'] },
  consultations: { label: 'Consultas', actions: ['read', 'create', 'update'] },
  measurements: { label: 'Mediciones', actions: ['read', 'create'] },
  goals: { label: 'Objetivos', actions: ['read', 'create', 'update'] },
  followups: { label: 'Seguimientos', actions: ['read', 'create', 'update'] },
  appointments: { label: 'Agenda', actions: ['read', 'create', 'update'] },
  attachments: {
    label: 'Fotos y documentos',
    actions: ['read', 'create', 'delete', 'manage'],
    notes: { delete: 'Eliminar archivos que subió', manage: 'Eliminar cualquier archivo' },
  },
  alerts: {
    label: 'Alertas',
    actions: ['read', 'update', 'manage'],
    notes: { manage: 'Configurar reglas de alerta' },
  },
  catalogs: { label: 'Catálogos', actions: ['read', 'manage'] },
  users: {
    label: 'Usuarios',
    actions: ['read', 'create', 'update'],
    notes: { update: 'Sólo usuarios de rol inferior al propio' },
  },
  roles: { label: 'Roles y permisos', actions: ['read', 'manage'] },
  settings: { label: 'Configuración', actions: ['read', 'manage'] },
  audit: { label: 'Auditoría', actions: ['read'] },
});

export const perm = (resource, action) => `${resource}:${action}`;

/** Todos los permisos válidos del sistema. */
export const ALL_PERMISSIONS = Object.freeze(
  Object.entries(RESOURCES).flatMap(([resource, { actions }]) =>
    actions.map((action) => perm(resource, action)),
  ),
);

export const isValidPermission = (p) => ALL_PERMISSIONS.includes(p);

/** Constantes para evitar strings sueltos en rutas y componentes. */
export const P = Object.freeze(
  Object.fromEntries(ALL_PERMISSIONS.map((p) => [p.replace(':', '_').toUpperCase(), p])),
);
