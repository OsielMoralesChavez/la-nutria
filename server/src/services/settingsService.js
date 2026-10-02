import { Setting } from '../models/index.js';
import { record } from './auditService.js';

/**
 * Configuración operativa del consultorio. Los valores por defecto son
 * operativos (no clínicos) y todos son editables desde Configuración.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  clinic: {
    name: 'La Nutria',
    timezone: 'America/Mexico_City',
    openingHours: { start: '08:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] },
    units: { weight: 'kg', length: 'cm' },
  },
  agenda: {
    defaultDurationMin: 45,
    slotMinutes: 15,
    allowOverlap: false,
  },
  dashboard: {
    newPatientsDays: 30,
  },
});

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

export async function getAll() {
  const rows = await Setting.find({ key: { $in: SETTING_KEYS } }).lean();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, { ...DEFAULT_SETTINGS[k], ...(stored[k] ?? {}) }]));
}

export async function get(key) {
  return (await getAll())[key];
}

export async function update(changes, actor, req) {
  const current = await getAll();
  for (const [key, value] of Object.entries(changes)) {
    await Setting.updateOne(
      { key },
      { $set: { value: { ...current[key], ...value }, updatedBy: actor.id } },
      { upsert: true },
    );
  }
  await record({ req, action: 'settings.update', resource: 'settings', meta: { sections: Object.keys(changes) } });
  return getAll();
}
