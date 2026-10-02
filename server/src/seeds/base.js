import { ALL_PERMISSIONS, ROLE_KEYS, SYSTEM_ROLES } from '@lanutria/shared';
import { Catalog, GoalType, MetricDefinition, Role, User } from '../models/index.js';
import { ensureRules } from '../services/alertService.js';
import { hashPassword } from '../services/authService.js';

/**
 * Datos base del sistema. Idempotente: se puede correr varias veces.
 * Usa $setOnInsert para NO pisar lo que el consultorio ya personalizó.
 */

export const METRICS = [
  { key: 'peso', label: 'Peso', unit: 'kg', category: 'antropometria', min: 1, max: 400, decimals: 1, order: 10 },
  { key: 'estatura', label: 'Estatura', unit: 'cm', category: 'antropometria', min: 40, max: 250, decimals: 1, order: 20 },
  { key: 'imc', label: 'IMC', unit: 'kg/m²', category: 'antropometria', decimals: 1, order: 30, derived: 'imc' },
  { key: 'grasa_pct', label: '% grasa corporal', unit: '%', category: 'composicion', min: 1, max: 75, decimals: 1, order: 40 },
  { key: 'masa_muscular', label: 'Masa muscular', unit: 'kg', category: 'composicion', min: 1, max: 150, decimals: 1, order: 50 },
  { key: 'grasa_visceral', label: 'Grasa visceral', unit: 'nivel', category: 'composicion', min: 1, max: 60, decimals: 0, order: 60 },
  { key: 'agua_pct', label: 'Agua corporal', unit: '%', category: 'composicion', min: 10, max: 90, decimals: 1, order: 70 },
  { key: 'cintura', label: 'Cintura', unit: 'cm', category: 'antropometria', min: 20, max: 250, decimals: 1, order: 80 },
  { key: 'cadera', label: 'Cadera', unit: 'cm', category: 'antropometria', min: 20, max: 250, decimals: 1, order: 90 },
  { key: 'icc', label: 'Relación cintura/cadera', unit: '', category: 'antropometria', decimals: 2, order: 100, derived: 'icc' },
];

export const CATALOGS = [
  { type: 'measurement_method', key: 'bioimpedancia', label: 'Bioimpedancia', order: 10 },
  { type: 'measurement_method', key: 'pliegues', label: 'Antropometría / pliegues', order: 20 },
  { type: 'measurement_method', key: 'bascula_cinta', label: 'Báscula y cinta', order: 30 },
  { type: 'measurement_method', key: 'otro', label: 'Otro', order: 90 },
  { type: 'appointment_type', key: 'primera_vez', label: 'Primera vez', order: 10, meta: { durationMin: 60, color: 'violet' } },
  { type: 'appointment_type', key: 'seguimiento', label: 'Seguimiento', order: 20, meta: { durationMin: 45, color: 'teal' } },
  { type: 'appointment_type', key: 'en_linea', label: 'En línea', order: 30, meta: { durationMin: 40, color: 'sky' } },
  { type: 'attachment_category', key: 'foto_frente', label: 'Foto de frente', order: 10 },
  { type: 'attachment_category', key: 'foto_perfil', label: 'Foto de perfil', order: 20 },
  { type: 'attachment_category', key: 'foto_espalda', label: 'Foto de espalda', order: 30 },
  { type: 'attachment_category', key: 'laboratorio', label: 'Estudio de laboratorio', order: 40 },
  { type: 'attachment_category', key: 'plan', label: 'Plan alimenticio', order: 50 },
  { type: 'attachment_category', key: 'otro', label: 'Otro', order: 90 },
  { type: 'cancel_reason', key: 'paciente', label: 'Cancelada por el paciente', order: 10 },
  { type: 'cancel_reason', key: 'nutriologo', label: 'Cancelada por el nutriólogo', order: 20 },
  { type: 'cancel_reason', key: 'otro', label: 'Otro motivo', order: 90 },
];

export const GOAL_TYPES = [
  { key: 'perdida_peso', label: 'Pérdida de peso', kind: 'metrica', defaultMetric: 'peso', direction: 'bajar', order: 10 },
  { key: 'aumento_peso', label: 'Aumento de peso', kind: 'metrica', defaultMetric: 'peso', direction: 'subir', order: 20 },
  { key: 'mantenimiento_peso', label: 'Mantenimiento de peso', kind: 'metrica', defaultMetric: 'peso', direction: 'mantener', defaultTolerance: 1, order: 30 },
  { key: 'reduccion_grasa', label: 'Reducción de grasa', kind: 'metrica', defaultMetric: 'grasa_pct', direction: 'bajar', order: 40 },
  { key: 'aumento_masa_muscular', label: 'Aumento de masa muscular', kind: 'metrica', defaultMetric: 'masa_muscular', direction: 'subir', order: 50 },
  { key: 'mejora_composicion', label: 'Mejora de composición corporal', kind: 'metrica', defaultMetric: 'cintura', direction: 'bajar', order: 60 },
  { key: 'cambio_habitos', label: 'Cambio de hábitos', kind: 'cualitativo', order: 70 },
  { key: 'adherencia_plan', label: 'Adherencia al plan', kind: 'cualitativo', order: 80 },
  { key: 'personalizado', label: 'Objetivo personalizado', kind: 'cualitativo', order: 90 },
];

async function upsertAll(Model, items, keyFields, extra = { isSystem: true }) {
  for (const item of items) {
    const filter = Object.fromEntries(keyFields.map((k) => [k, item[k]]));
    await Model.updateOne(filter, { $setOnInsert: { ...item, ...extra } }, { upsert: true });
  }
}

export async function seedRoles() {
  for (const role of SYSTEM_ROLES) {
    const isSuper = role.key === ROLE_KEYS.SUPERUSER;
    await Role.updateOne(
      { key: role.key },
      {
        $set: {
          name: role.name,
          description: role.description,
          level: role.level,
          isSystem: true,
          // El superusuario siempre recibe permisos nuevos del catálogo.
          ...(isSuper && { permissions: [...ALL_PERMISSIONS] }),
        },
        ...(!isSuper && { $setOnInsert: { permissions: role.permissions } }),
      },
      { upsert: true },
    );
  }
}

export async function seedSuperuser({ name, email, password }, log = console.log) {
  if (!email || !password) {
    log('· Superusuario: omitido (define SEED_SUPERUSER_EMAIL y SEED_SUPERUSER_PASSWORD en server/.env)');
    return null;
  }
  if (password.length < 10) throw new Error('SEED_SUPERUSER_PASSWORD debe tener al menos 10 caracteres');
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    log(`· Superusuario: ya existe (${email})`);
    return existing;
  }
  const role = await Role.findOne({ key: ROLE_KEYS.SUPERUSER });
  const user = await User.create({
    name: name || 'Administrador General',
    email,
    role: role._id,
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
  });
  log(`· Superusuario creado: ${email} (deberá cambiar la contraseña al entrar)`);
  return user;
}

export async function seedBase(log = console.log) {
  await seedRoles();
  log('· Roles base');
  await upsertAll(MetricDefinition, METRICS, ['key']);
  log(`· Métricas (${METRICS.length})`);
  await upsertAll(Catalog, CATALOGS.map((c) => ({ ...c, meta: c.meta ?? {} })), ['type', 'key'], {});
  log(`· Catálogos (${CATALOGS.length})`);
  await upsertAll(GoalType, GOAL_TYPES, ['key']);
  log(`· Tipos de objetivo (${GOAL_TYPES.length})`);
  await ensureRules();
  log('· Reglas de alerta');
}
