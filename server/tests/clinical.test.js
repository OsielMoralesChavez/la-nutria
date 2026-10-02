import { describe, expect, it } from 'vitest';
import { Alert, Appointment, ClinicalRecordRevision, Measurement } from '../src/models/index.js';
import { addDays } from '../src/utils/query.js';
import { loginAs, newPatient, useTestDb } from './helpers.js';

const ctx = useTestDb();

/** Consulta completa: inicia, guarda borrador y cierra. */
async function consult(s, patientId, draft, extra = {}) {
  const start = await s.post(`/api/v1/patients/${patientId}/consultations`).send({});
  const id = start.body.data.id;
  const save = await s.patch(`/api/v1/consultations/${id}`).send({ notes: { freeText: 'Nota' }, draft, ...extra });
  expect(save.status, JSON.stringify(save.body)).toBe(200);
  const close = await s.post(`/api/v1/consultations/${id}/close`);
  expect(close.status, JSON.stringify(close.body)).toBe(200);
  return close.body.data;
}

describe('flujo clínico: paciente → consulta → mediciones → objetivos → evolución', () => {
  it('detecta posibles duplicados al dar de alta', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    expect((await s.post('/api/v1/patients').send(newPatient())).status).toBe(201);
    const dup = await s.post('/api/v1/patients').send(newPatient({ firstName: 'Laura', lastName: 'Perez' }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.details.duplicates).toHaveLength(1);
    expect((await s.post('/api/v1/patients').send(newPatient({ force: true }))).status).toBe(201);
  });

  it('reanuda el borrador existente en lugar de duplicarlo', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const p = (await s.post('/api/v1/patients').send(newPatient())).body.data;
    const a = await s.post(`/api/v1/patients/${p.id}/consultations`).send({});
    const b = await s.post(`/api/v1/patients/${p.id}/consultations`).send({});
    expect(a.status).toBe(201);
    expect(a.body.data.type).toBe('inicial');
    expect(b.status).toBe(200);
    expect(b.body.meta.resumed).toBe(true);
    expect(b.body.data.id).toBe(a.body.data.id);
  });

  it('cierra la consulta y actualiza la evolución automáticamente', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const p = (await s.post('/api/v1/patients').send(newPatient())).body.data;
    const nextStart = addDays(new Date(), 14);
    nextStart.setHours(10, 0, 0, 0);

    // Consulta 1: línea base + objetivo + próxima cita + expediente
    const c1 = await consult(s, p.id, {
      measurement: {
        method: 'bioimpedancia',
        values: [
          { metric: 'peso', value: 82.4 },
          { metric: 'estatura', value: 163 },
          { metric: 'cintura', value: 94 },
          { metric: 'cadera', value: 108 },
          { metric: 'grasa_pct', value: null },
        ],
      },
      goals: { create: [{ goalType: 'perdida_peso', target: 72, dueDate: addDays(new Date(), 90) }] },
      next: { appointment: { start: nextStart, type: 'seguimiento' } },
      clinical: { motivo: 'Bajar de peso', alergias: 'Nuez' },
    });
    expect(c1.status).toBe('cerrada');

    const m1 = await Measurement.findOne({ consultation: c1.id });
    const imc = m1.values.find((v) => v.metric === 'imc');
    expect(imc).toMatchObject({ value: 31, derived: true });
    expect(m1.values.find((v) => v.metric === 'icc').value).toBe(0.87);
    expect(m1.values.some((v) => v.metric === 'grasa_pct')).toBe(false);
    expect(await Appointment.countDocuments({ patient: p.id, status: 'programada' })).toBe(1);
    expect(await ClinicalRecordRevision.countDocuments({ patient: p.id })).toBe(1);

    // Consulta 2: sólo peso → IMC usa la estatura previa
    const c2 = await consult(s, p.id, { measurement: { values: [{ metric: 'peso', value: 77 }] } });
    expect(c2.type).toBe('seguimiento');
    expect(c2.summary.changes.find((x) => x.metric === 'peso').delta).toBe(-5.4);
    const m2 = await Measurement.findOne({ consultation: c2.id });
    expect(m2.values.find((v) => v.metric === 'imc').value).toBe(29);
    // La medición anterior se conserva intacta.
    expect(await Measurement.countDocuments({ patient: p.id })).toBe(2);

    // Ficha 360°: inicio → actual → meta
    const summary = (await s.get(`/api/v1/patients/${p.id}/summary`)).body.data;
    const peso = summary.progress.metrics.find((m) => m.key === 'peso');
    expect(peso.baseline.value).toBe(82.4);
    expect(peso.previous.value).toBe(82.4);
    expect(peso.current.value).toBe(77);
    expect(peso.target.value).toBe(72);
    expect(peso.target.progress.ratio).toBeCloseTo(0.519, 2);
    expect(summary.start.reason).toBe('Bajar de peso');
    expect(summary.start.clinicalHighlights.map((h) => h.key)).toContain('alergias');
    expect(summary.interventions.consultationCount).toBe(2);
    expect(summary.next.appointments).toHaveLength(1);
    expect(summary.patient.lastConsultationAt).toBeTruthy();

    // Series para gráficas
    const series = (await s.get(`/api/v1/patients/${p.id}/measurements/series?metrics=peso,imc`)).body.data;
    expect(series.peso.map((x) => x.value)).toEqual([82.4, 77]);

    // Línea de tiempo agrupa lo ocurrido dentro de cada consulta
    const tl = (await s.get(`/api/v1/patients/${p.id}/timeline`)).body.data;
    const first = tl.find((e) => e.consultationId === c1.id);
    expect(first.isStart).toBe(true);
    expect(first.goalsCreated).toHaveLength(1);
    expect(first.clinicalChanges).toEqual(expect.arrayContaining(['motivo', 'alergias']));
  });

  it('una consulta cerrada no se edita; se agregan adendas', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const p = (await s.post('/api/v1/patients').send(newPatient())).body.data;
    const c = await consult(s, p.id, {});
    expect((await s.patch(`/api/v1/consultations/${c.id}`).send({ notes: { freeText: 'cambio' } })).status).toBe(409);
    const add = await s.post(`/api/v1/consultations/${c.id}/addenda`).send({ text: 'Corrección: el paciente refiere alergia a nuez' });
    expect(add.status).toBe(200);
    expect(add.body.data.addenda).toHaveLength(1);
    expect(add.body.data.notes.freeText).toBe('Nota');
  });

  it('sólo quien inició el borrador puede editarlo', async () => {
    const ana = await loginAs(ctx.app, 'usuario');
    const luis = await loginAs(ctx.app, 'usuario');
    const p = (await ana.post('/api/v1/patients').send(newPatient())).body.data;
    const c = (await ana.post(`/api/v1/patients/${p.id}/consultations`).send({})).body.data;
    expect((await luis.patch(`/api/v1/consultations/${c.id}`).send({ reason: 'x' })).status).toBe(403);
  });

  it('valida métricas contra el catálogo', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const p = (await s.post('/api/v1/patients').send(newPatient())).body.data;
    const c = (await s.post(`/api/v1/patients/${p.id}/consultations`).send({})).body.data;
    await s.patch(`/api/v1/consultations/${c.id}`).send({ draft: { measurement: { values: [{ metric: 'inventada', value: 3 }] } } });
    const res = await s.post(`/api/v1/consultations/${c.id}/close`);
    expect(res.status).toBe(422);
    // La transacción se revirtió: la consulta sigue en borrador.
    expect((await s.get(`/api/v1/consultations/${c.id}`)).body.data.status).toBe('borrador');
  });

  it('objetivos cualitativos registran avance por consulta', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const p = (await s.post('/api/v1/patients').send(newPatient())).body.data;
    const g = (await s.post(`/api/v1/patients/${p.id}/goals`).send({ goalType: 'adherencia_plan' })).body.data;
    await consult(s, p.id, { goals: { updates: [{ goalId: g.id, checkpoint: { score: 70, note: 'Buen avance' } }] } });
    const goals = (await s.get(`/api/v1/patients/${p.id}/goals`)).body.data;
    expect(goals[0].progress.ratio).toBe(0.7);
  });
});

describe('agenda', () => {
  it('evita traslapes, reprograma y respeta transiciones', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const p = (await s.post('/api/v1/patients').send(newPatient())).body.data;
    const start = addDays(new Date(), 3);
    start.setHours(10, 0, 0, 0);

    const a = await s.post('/api/v1/appointments').send({ patient: p.id, start, type: 'seguimiento' });
    expect(a.status).toBe(201);
    expect((new Date(a.body.data.end) - start) / 60000).toBe(45);

    const clash = await s.post('/api/v1/appointments').send({ patient: p.id, start: new Date(start.getTime() + 15 * 60000) });
    expect(clash.status).toBe(409);
    expect(clash.body.error.details.conflicts).toHaveLength(1);

    const later = new Date(start.getTime() + 2 * 3600000);
    const re = await s.post(`/api/v1/appointments/${a.body.data.id}/reschedule`).send({ start: later });
    expect(re.status).toBe(201);
    expect(re.body.data.rescheduledFrom).toBe(a.body.data.id);
    const old = (await s.get(`/api/v1/appointments/${a.body.data.id}`)).body.data;
    expect(old.status).toBe('cancelada');

    expect((await s.post(`/api/v1/appointments/${old.id}/status`).send({ status: 'confirmada' })).status).toBe(409);
    expect((await s.post(`/api/v1/appointments/${re.body.data.id}/status`).send({ status: 'confirmada' })).status).toBe(200);
  });

  it('iniciar consulta desde la cita la marca realizada al cerrar', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const p = (await s.post('/api/v1/patients').send(newPatient())).body.data;
    const appt = (await s.post('/api/v1/appointments').send({ patient: p.id, start: new Date(Date.now() + 3600000) })).body.data;
    const c = (await s.post(`/api/v1/appointments/${appt.id}/start-consultation`)).body.data;
    expect(c.appointment).toBe(appt.id);
    await s.post(`/api/v1/consultations/${c.id}/close`);
    expect((await s.get(`/api/v1/appointments/${appt.id}`)).body.data.status).toBe('realizada');
  });
});

describe('alertas configurables', () => {
  it('crea y resuelve automáticamente la alerta de seguimiento vencido', async () => {
    const s = await loginAs(ctx.app, 'administrador');
    const p = (await s.post('/api/v1/patients').send(newPatient())).body.data;
    const fu = (await s.post(`/api/v1/patients/${p.id}/followups`).send({ dueDate: addDays(new Date(), -3), reason: 'Llamar' })).body.data;

    await s.post('/api/v1/alert-rules/run');
    const open = (await s.get('/api/v1/alerts')).body;
    expect(open.data.map((x) => x.type)).toContain('followup_overdue');

    await s.patch(`/api/v1/followups/${fu.id}`).send({ status: 'realizado' });
    await s.post('/api/v1/alert-rules/run');
    expect(await Alert.countDocuments({ type: 'followup_overdue', status: 'abierta' })).toBe(0);
    expect(await Alert.countDocuments({ type: 'followup_overdue', resolution: 'auto' })).toBe(1);
  });

  it('"paciente sin actividad" no se activa sin umbral definido', async () => {
    const s = await loginAs(ctx.app, 'administrador');
    expect((await s.patch('/api/v1/alert-rules/patient_inactive').send({ enabled: true })).status).toBe(422);
    const ok = await s.patch('/api/v1/alert-rules/patient_inactive').send({ enabled: true, params: { days: 60 } });
    expect(ok.status).toBe(200);
    expect(ok.body.data.enabled).toBe(true);
    expect((await s.patch('/api/v1/alert-rules/patient_inactive').send({ params: { days: 2 } })).status).toBe(422);
  });

  it('un Usuario no puede configurar reglas', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    expect((await s.patch('/api/v1/alert-rules/goal_due').send({ enabled: false })).status).toBe(403);
  });
});

describe('dashboard', () => {
  it('devuelve KPIs operativos', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    await s.post('/api/v1/patients').send(newPatient());
    const res = await s.get('/api/v1/dashboard?scope=mine');
    expect(res.status).toBe(200);
    expect(res.body.data.kpis).toMatchObject({ activePatients: 1, newPatients: { count: 1 } });
    expect(res.body.data.kpis.noRecentFollowUp.configured).toBe(false);
    expect(res.body.data.activity[0]).toMatchObject({ action: 'patients.create', patient: { name: 'Laura Pérez' } });
  });
});
