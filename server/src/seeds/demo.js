import { computeDerived, ROLE_KEYS } from '@lanutria/shared';
import {
  Appointment,
  ClinicalRecord,
  ClinicalRecordRevision,
  Consultation,
  FollowUp,
  Goal,
  Measurement,
  Patient,
  Role,
  User,
} from '../models/index.js';
import { runAll } from '../services/alertService.js';
import { hashPassword } from '../services/authService.js';
import { refreshScheduleFields } from '../services/patientService.js';
import { addDays, startOfDay } from '../utils/query.js';

/**
 * DATOS DE DEMOSTRACIÓN (ficticios). Separados del resto del sistema:
 * sólo se cargan en modo demo (`npm run dev:demo`) o con `npm run seed:demo`.
 *
 * Contraseña de los usuarios demo:
 *   - modo demo en memoria: DEMO_PASSWORD (la BD se destruye al cerrar)
 *   - BD real (Atlas): obligatorio definir SEED_DEMO_PASSWORD
 */
export const DEMO_PASSWORD = 'LaNutriaDemo2026';

export const DEMO_USERS = [
  { key: 'super', name: 'Dirección La Nutria', email: 'superusuario@lanutria.demo', role: ROLE_KEYS.SUPERUSER },
  { key: 'luis', name: 'Luis Torres', email: 'luis@lanutria.demo', role: ROLE_KEYS.ADMIN },
  { key: 'ana', name: 'Ana Martínez', email: 'ana@lanutria.demo', role: ROLE_KEYS.USER },
  { key: 'sofia', name: 'Sofía Ramírez', email: 'sofia@lanutria.demo', role: ROLE_KEYS.USER },
];

/** Generador pseudoaleatorio determinista: los mismos datos en cada arranque. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const at = (day, h, m = 0) => {
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
};

/**
 * Escenarios de pacientes. `visits` = consultas cerradas; `trend` = cambio de
 * peso por consulta; `status` y `extras` crean casos para alertas y estados.
 */
const PATIENTS = [
  { first: 'Laura', last: 'Pérez Gómez', sex: 'femenino', born: '1992-03-14', owner: 'ana', visits: 8, every: 21, w0: 82.4, h: 163, fat0: 36, trend: -0.75, fatTrend: -0.4, tags: ['diabetes-t2'], motivo: 'Bajar de peso y mejorar control glucémico', patologicos: 'Diabetes tipo 2 (dx 2023)', medicamentos: 'Metformina 850 mg c/12 h', alergias: 'Nuez', goalDueDays: 10, todayAt: [10, 30] },
  { first: 'Jorge', last: 'Ruiz Salas', sex: 'masculino', born: '1975-07-02', owner: 'luis', visits: 6, every: 28, w0: 95.1, h: 178, fat0: 29, trend: -1.1, fatTrend: -0.5, motivo: 'Reducir grasa abdominal', patologicos: 'Hipertensión arterial', medicamentos: 'Losartán 50 mg', todayAt: [9, 0] },
  { first: 'Carla', last: 'Díaz Ortega', sex: 'femenino', born: '1999-11-20', owner: 'ana', visits: 0, newPatient: true, todayAt: [12, 0], firstTime: true },
  { first: 'Mario', last: 'Soto Leal', sex: 'masculino', born: '1988-01-30', owner: 'ana', visits: 4, every: 21, w0: 104.2, h: 181, fat0: 33, trend: -0.9, fatTrend: -0.3, motivo: 'Pérdida de peso', overdueFollowUp: 5 },
  { first: 'Rosa', last: 'Cano Méndez', sex: 'femenino', born: '1964-05-09', owner: 'ana', visits: 5, every: 30, w0: 71.0, h: 156, fat0: 38, trend: -0.3, fatTrend: -0.2, lastVisitDaysAgo: 60, motivo: 'Control de colesterol', patologicos: 'Dislipidemia', laboratorios: 'Colesterol total 245 mg/dL (ene)' },
  { first: 'Diego', last: 'Herrera Paz', sex: 'masculino', born: '2001-09-12', owner: 'sofia', visits: 6, every: 14, w0: 63.5, h: 175, fat0: 14, trend: 0.45, fatTrend: 0.05, muscleTrend: 0.35, goal: 'aumento_masa_muscular', motivo: 'Aumento de masa muscular (deportista)', estiloVida: 'Entrena fútbol 5 días/semana' },
  { first: 'Valeria', last: 'Núñez Ríos', sex: 'femenino', born: '1995-02-27', owner: 'ana', visits: 7, every: 21, w0: 68.0, h: 165, fat0: 31, trend: -0.4, fatTrend: -0.45, goalReached: true, motivo: 'Mejorar composición corporal' },
  { first: 'Fernando', last: 'Gil Campos', sex: 'masculino', born: '1970-12-05', owner: 'luis', visits: 3, every: 30, w0: 88.0, h: 170, fat0: 30, trend: -0.5, fatTrend: -0.3, status: 'en_pausa', motivo: 'Control de peso' },
  { first: 'Isabel', last: 'Mora Vega', sex: 'femenino', born: '1990-08-18', owner: 'ana', visits: 9, every: 21, w0: 77.5, h: 160, fat0: 35, trend: -0.65, fatTrend: -0.4, status: 'alta', motivo: 'Pérdida de peso posparto', ginecoobstetricos: 'G2 P2, último parto 2024' },
  { first: 'Andrés', last: 'Lozano Cruz', sex: 'masculino', born: '1983-04-03', owner: 'sofia', visits: 2, every: 21, w0: 99.0, h: 176, fat0: 32, trend: -1.2, fatTrend: -0.6, motivo: 'Bajar de peso', nextInDays: 3 },
  { first: 'Paola', last: 'Reyes Ibarra', sex: 'femenino', born: '1997-06-25', owner: 'luis', visits: 4, every: 21, w0: 58.0, h: 168, fat0: 22, trend: 0.3, fatTrend: 0.0, goal: 'aumento_peso', motivo: 'Aumento de peso saludable', nextInDays: 1 },
  { first: 'Ricardo', last: 'Flores Ávila', sex: 'masculino', born: '1958-10-11', owner: 'ana', visits: 5, every: 28, w0: 84.0, h: 169, fat0: 31, trend: -0.4, fatTrend: -0.2, motivo: 'Control de glucosa', patologicos: 'Prediabetes', noShow: true },
  { first: 'Lucía', last: 'Sánchez Bravo', sex: 'femenino', born: '2005-01-08', owner: 'sofia', visits: 3, every: 21, w0: 54.0, h: 158, fat0: 24, trend: 0.0, fatTrend: -0.1, goal: 'mantenimiento_peso', motivo: 'Mantener peso y mejorar hábitos' },
  { first: 'Héctor', last: 'Vargas Luna', sex: 'masculino', born: '1979-03-22', owner: 'ana', visits: 6, every: 21, w0: 91.0, h: 174, fat0: 30, trend: -0.7, fatTrend: -0.35, todayAt: [16, 0], motivo: 'Pérdida de peso' },
];

export async function seedDemo({ password, log = console.log } = {}) {
  if (!password || password.length < 10) throw new Error('Contraseña demo inválida (mínimo 10 caracteres)');
  if (await Patient.exists({})) {
    log('· Demo: ya hay pacientes en la BD, se omite para no mezclar datos.');
    return;
  }

  // ── Usuarios ──
  const roles = Object.fromEntries((await Role.find()).map((r) => [r.key, r]));
  const passwordHash = await hashPassword(password);
  const users = {};
  for (const u of DEMO_USERS) {
    users[u.key] =
      (await User.findOne({ email: u.email })) ??
      (await User.create({ name: u.name, email: u.email, role: roles[u.role]._id, passwordHash, mustChangePassword: false }));
  }
  log(`· Usuarios demo (${DEMO_USERS.length})`);

  const rand = rng(42);
  const noise = (amp) => (rand() - 0.5) * 2 * amp;
  const today = startOfDay();
  const round1 = (n) => Math.round(n * 10) / 10;

  for (const [i, p] of PATIENTS.entries()) {
    const owner = users[p.owner];
    const lastVisitDaysAgo = p.lastVisitDaysAgo ?? 7 + Math.floor(rand() * 14);
    const firstVisit = addDays(today, -(lastVisitDaysAgo + (p.visits - 1) * (p.every ?? 21)));
    const createdAt = p.newPatient ? addDays(today, -2) : addDays(firstVisit, -1);

    const patient = await Patient.create({
      firstName: p.first,
      lastName: p.last,
      sex: p.sex,
      birthDate: new Date(p.born),
      contact: { phone: `55 ${String(1000 + i * 731).slice(0, 4)} ${String(2000 + i * 977).slice(0, 4)}`, email: `${p.first.toLowerCase()}.demo@example.com` },
      occupation: ['Docente', 'Ingeniero', 'Estudiante', 'Contadora', 'Comerciante', 'Diseñadora'][i % 6],
      tags: p.tags ?? [],
      status: 'activo',
      primaryNutritionist: owner._id,
      createdBy: owner._id,
      statusHistory: [{ to: 'activo', by: owner._id, reason: 'Alta', at: createdAt }],
      createdAt,
    });

    // Expediente con su revisión inicial
    const sections = Object.fromEntries(
      ['motivo', 'patologicos', 'medicamentos', 'alergias', 'estiloVida', 'ginecoobstetricos', 'laboratorios']
        .filter((k) => p[k])
        .map((k) => [k, p[k]]),
    );
    const hasClinical = Object.keys(sections).length > 0;
    await ClinicalRecord.create({ patient: patient._id, sections, version: hasClinical ? 1 : 0, updatedBy: owner._id });

    // Consultas + mediciones con evolución realista
    let w = p.w0;
    let fat = p.fat0;
    let muscle = p.w0 ? round1(p.w0 * (p.sex === 'masculino' ? 0.42 : 0.33)) : 0;
    let waist = p.w0 ? round1(p.w0 * 0.98 + (p.sex === 'masculino' ? 6 : -2)) : 0;
    const hip = p.w0 ? round1(p.w0 * 0.85 + 35) : 0;
    let lastValues = null;
    const consultations = [];

    for (let v = 0; v < p.visits; v += 1) {
      const date = at(addDays(firstVisit, v * p.every), 9 + (v % 8), v % 2 ? 30 : 0);
      if (v > 0) {
        w = round1(w + p.trend + noise(0.35));
        fat = round1(fat + p.fatTrend + noise(0.25));
        muscle = round1(muscle + (p.muscleTrend ?? 0.05) + noise(0.15));
        waist = round1(waist + p.trend * 0.8 + noise(0.4));
      }
      const raw = { peso: w, estatura: p.h, grasa_pct: fat, masa_muscular: muscle, cintura: waist, cadera: round1(hip + (w - p.w0) * 0.5), grasa_visceral: Math.max(1, Math.round(fat / 3.5)), agua_pct: round1(60 - fat * 0.45) };
      const derived = computeDerived(raw);
      const values = [
        ...Object.entries(raw).map(([metric, value]) => ({ metric, value, unit: '' })),
        ...Object.entries(derived).map(([metric, value]) => ({ metric, value, unit: '', derived: true })),
      ];
      const summary = lastValues
        ? Object.entries({ ...raw, ...derived })
            .filter(([k]) => ['peso', 'grasa_pct', 'cintura', 'imc'].includes(k))
            .map(([metric, value]) => ({ metric, value, delta: round1(value - lastValues[metric]) }))
        : [];
      lastValues = { ...raw, ...derived };

      const c = await Consultation.create({
        patient: patient._id,
        nutritionist: owner._id,
        date,
        type: v === 0 ? 'inicial' : 'seguimiento',
        status: 'cerrada',
        reason: v === 0 ? p.motivo : 'Seguimiento',
        notes: {
          freeText:
            v === 0
              ? `Primera consulta. ${p.motivo}. Se explica plan inicial y se acuerdan objetivos.`
              : ['Buena adherencia entre semana; fines de semana más difíciles.', 'Se ajustan colaciones y horario de cena.', 'Refiere mejor descanso. Se refuerza hidratación.', 'Se revisa registro de alimentos; buen avance.'][v % 4],
          soap: v % 3 === 0 && v > 0 ? { s: 'Refiere más energía.', o: `Peso ${w} kg.`, a: 'Evolución favorable.', p: 'Ajuste de plan: aumentar proteína en desayuno.' } : null,
        },
        summary: { changes: summary, goalsUpdated: v === 0 ? 2 : 0 },
        closedAt: date,
        closedBy: owner._id,
      });
      const m = await Measurement.create({
        patient: patient._id,
        consultation: c._id,
        takenAt: date,
        takenBy: owner._id,
        method: v % 4 === 3 ? 'pliegues' : 'bioimpedancia',
        values,
      });
      c.measurement = m._id;
      await c.save();
      consultations.push(c);
    }

    if (hasClinical && consultations[0]) {
      await ClinicalRecordRevision.create({ patient: patient._id, version: 1, sections, changedFields: Object.keys(sections), changedBy: owner._id, consultation: consultations[0]._id });
    }

    // Objetivos
    if (consultations.length) {
      const first = consultations[0];
      const goalType = p.goal ?? 'perdida_peso';
      const metric = { aumento_masa_muscular: 'masa_muscular' }[goalType] ?? 'peso';
      const baseline = metric === 'masa_muscular' ? round1(p.w0 * (p.sex === 'masculino' ? 0.42 : 0.33)) : p.w0;
      const direction = { aumento_masa_muscular: 'subir', aumento_peso: 'subir', mantenimiento_peso: 'mantener' }[goalType] ?? 'bajar';
      const target = direction === 'mantener' ? p.w0 : direction === 'subir' ? round1(baseline + (metric === 'peso' ? 4 : 3)) : round1(baseline * 0.88);
      const labels = { perdida_peso: 'Pérdida de peso', aumento_masa_muscular: 'Aumento de masa muscular', aumento_peso: 'Aumento de peso', mantenimiento_peso: 'Mantenimiento de peso' };
      await Goal.create({
        patient: patient._id,
        goalType,
        title: labels[goalType],
        kind: 'metrica',
        metric,
        direction,
        baseline,
        target,
        tolerance: direction === 'mantener' ? 1 : undefined,
        startDate: first.date,
        dueDate: p.goalDueDays ? addDays(today, p.goalDueDays) : addDays(today, 30 + Math.floor(rand() * 90)),
        status: p.status === 'alta' ? 'logrado' : 'en_curso',
        closedAt: p.status === 'alta' ? consultations.at(-1).date : undefined,
        createdIn: first._id,
        createdBy: owner._id,
      });
      if (metric === 'peso' && direction === 'bajar') {
        await Goal.create({
          patient: patient._id,
          goalType: 'reduccion_grasa',
          title: 'Reducción de grasa',
          kind: 'metrica',
          metric: 'grasa_pct',
          direction: 'bajar',
          baseline: p.fat0,
          target: round1(p.fat0 - 5),
          startDate: first.date,
          dueDate: p.goalDueDays ? addDays(today, -3) : addDays(today, 60),
          status: p.goalReached ? 'logrado' : 'en_curso',
          closedAt: p.goalReached ? consultations.at(-1).date : undefined,
          createdIn: first._id,
          createdBy: owner._id,
        });
      }
      await Goal.create({
        patient: patient._id,
        goalType: 'adherencia_plan',
        title: 'Adherencia al plan',
        kind: 'cualitativo',
        startDate: first.date,
        status: 'en_curso',
        checkpoints: consultations.slice(1).map((c, k) => ({ consultation: c._id, date: c.date, score: Math.min(100, 50 + k * 8), note: k % 2 ? 'Mejora en fines de semana' : 'Cumple desayunos y comidas', by: owner._id })),
        createdIn: first._id,
        createdBy: owner._id,
      });
    }

    // Agenda
    if (p.todayAt) {
      await Appointment.create({
        patient: patient._id,
        nutritionist: owner._id,
        start: at(today, ...p.todayAt),
        end: at(today, p.todayAt[0] + (p.firstTime ? 1 : 0), p.todayAt[1] + (p.firstTime ? 0 : 45)),
        type: p.firstTime ? 'primera_vez' : 'seguimiento',
        status: p.firstTime ? 'programada' : 'confirmada',
        statusHistory: [{ to: 'programada', by: owner._id }],
        createdBy: owner._id,
      });
    }
    if (p.nextInDays) {
      const d = addDays(today, p.nextInDays);
      await Appointment.create({ patient: patient._id, nutritionist: owner._id, start: at(d, 11), end: at(d, 11, 45), type: 'seguimiento', status: 'programada', statusHistory: [{ to: 'programada', by: owner._id }], createdBy: owner._id });
    }
    if (p.noShow) {
      const d = addDays(today, -4);
      await Appointment.create({ patient: patient._id, nutritionist: owner._id, start: at(d, 13), end: at(d, 13, 45), type: 'seguimiento', status: 'no_asistio', statusHistory: [{ from: 'programada', to: 'no_asistio', by: owner._id }], createdBy: owner._id });
    }
    if (!p.todayAt && !p.nextInDays && !p.status && consultations.length && !p.lastVisitDaysAgo) {
      const d = addDays(today, 6 + (i % 10));
      await Appointment.create({ patient: patient._id, nutritionist: owner._id, start: at(d, 9 + (i % 9)), end: at(d, 9 + (i % 9), 45), type: 'seguimiento', status: 'programada', statusHistory: [{ to: 'programada', by: owner._id }], createdBy: owner._id });
    }

    // Seguimientos
    if (p.overdueFollowUp) {
      await FollowUp.create({ patient: patient._id, dueDate: addDays(today, -p.overdueFollowUp), reason: 'Llamar para reagendar consulta', assignedTo: owner._id, createdBy: owner._id, originConsultation: consultations.at(-1)?._id });
    }
    if (p.tags?.includes('diabetes-t2')) {
      await FollowUp.create({ patient: patient._id, dueDate: addDays(today, 14), reason: 'Revisar estudios de laboratorio', assignedTo: owner._id, createdBy: owner._id, originConsultation: consultations.at(-1)?._id });
    }

    // Estado final y campos desnormalizados
    if (p.status) {
      patient.statusHistory.push({ from: 'activo', to: p.status, by: owner._id, at: consultations.at(-1)?.date ?? today, reason: p.status === 'alta' ? 'Meta cumplida' : 'Viaje de trabajo' });
      patient.status = p.status;
    }
    if (consultations.length) {
      patient.firstConsultationAt = consultations[0].date;
      patient.lastConsultationAt = consultations.at(-1).date;
      patient.lastMeasurementAt = consultations.at(-1).date;
    }
    await patient.save();
    await refreshScheduleFields(patient._id);
  }
  log(`· Pacientes demo (${PATIENTS.length}) con consultas, mediciones, objetivos y agenda`);

  const res = await runAll();
  log(`· Alertas generadas (${res.created})`);
}
