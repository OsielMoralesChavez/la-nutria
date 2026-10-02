import { describe, expect, it } from 'vitest';
import { AuditLog, Role } from '../src/models/index.js';
import { loginAs, newPatient, useTestDb } from './helpers.js';

const ctx = useTestDb();

describe('RBAC validado en backend', () => {
  it('un Usuario no puede listar usuarios ni ver auditoría (403 + bitácora)', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    expect((await s.get('/api/v1/users')).status).toBe(403);
    expect((await s.get('/api/v1/audit-logs')).status).toBe(403);
    expect(await AuditLog.countDocuments({ action: 'authz.denied', actor: s.user._id })).toBe(2);
  });

  it('rechaza campos no declarados (mass-assignment)', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const res = await s.post('/api/v1/patients').send({ ...newPatient(), archivedAt: null, role: 'superusuario' });
    expect(res.status).toBe(422);
  });

  it('elimina operadores de MongoDB en el cuerpo', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const res = await s.post('/api/v1/patients').send({ ...newPatient(), contact: { phone: '5512345678', $gt: '' } });
    expect(res.status).toBe(201);
  });

  it('el Administrador crea Usuarios pero no Superusuarios', async () => {
    const admin = await loginAs(ctx.app, 'administrador');
    const userRole = await Role.findOne({ key: 'usuario' });
    const superRole = await Role.findOne({ key: 'superusuario' });

    const ok = await admin.post('/api/v1/users').send({ name: 'Nueva Nutrióloga', email: 'nueva@test.local', role: userRole.id });
    expect(ok.status).toBe(201);
    expect(ok.body.data.temporaryPassword).toHaveLength(14);
    expect(ok.body.data.user.mustChangePassword).toBe(true);

    const denied = await admin.post('/api/v1/users').send({ name: 'Otro', email: 'otro@test.local', role: superRole.id });
    expect(denied.status).toBe(403);
  });

  it('nadie cambia su propio rol', async () => {
    const su = await loginAs(ctx.app, 'superusuario');
    const userRole = await Role.findOne({ key: 'usuario' });
    const res = await su.patch(`/api/v1/users/${su.user.id}`).send({ role: userRole.id });
    expect(res.status).toBe(403);
  });

  it('el rol Superusuario no es editable y los cambios de permisos se auditan', async () => {
    const su = await loginAs(ctx.app, 'superusuario');
    const superRole = await Role.findOne({ key: 'superusuario' });
    const userRole = await Role.findOne({ key: 'usuario' });
    expect((await su.put(`/api/v1/roles/${superRole.id}/permissions`).send({ permissions: [] })).status).toBe(403);

    const res = await su.put(`/api/v1/roles/${userRole.id}/permissions`).send({ permissions: [...userRole.permissions, 'audit:read'] });
    expect(res.status).toBe(200);
    const log = await AuditLog.findOne({ action: 'roles.permissions_update' });
    expect(log.meta.added).toEqual(['audit:read']);
  });

  it('el cambio de permisos aplica de inmediato en el backend', async () => {
    const su = await loginAs(ctx.app, 'superusuario');
    const nutri = await loginAs(ctx.app, 'usuario');
    expect((await nutri.get('/api/v1/audit-logs')).status).toBe(403);
    const userRole = await Role.findOne({ key: 'usuario' });
    await su.put(`/api/v1/roles/${userRole.id}/permissions`).send({ permissions: [...userRole.permissions, 'audit:read'] });
    expect((await nutri.get('/api/v1/audit-logs')).status).toBe(200);
  });

  it('sólo el responsable o un administrador archiva un paciente', async () => {
    const ana = await loginAs(ctx.app, 'usuario');
    const sofia = await loginAs(ctx.app, 'usuario');
    const admin = await loginAs(ctx.app, 'administrador');
    const p = (await ana.post('/api/v1/patients').send(newPatient())).body.data;

    // Otro nutriólogo puede VER y atender…
    expect((await sofia.get(`/api/v1/patients/${p.id}`)).status).toBe(200);
    // …pero no archivar ni reasignar.
    expect((await sofia.post(`/api/v1/patients/${p.id}/archive`)).status).toBe(403);
    expect((await sofia.patch(`/api/v1/patients/${p.id}/assign`).send({ nutritionist: sofia.user.id })).status).toBe(403);

    expect((await admin.patch(`/api/v1/patients/${p.id}/assign`).send({ nutritionist: sofia.user.id })).status).toBe(200);
    expect((await sofia.post(`/api/v1/patients/${p.id}/archive`)).status).toBe(200);
    expect((await ana.get(`/api/v1/patients/${p.id}/summary`)).status).toBe(200);
  });

  it('el borrado físico exige patients:delete y confirmar el nombre', async () => {
    const admin = await loginAs(ctx.app, 'administrador');
    const su = await loginAs(ctx.app, 'superusuario');
    const p = (await admin.post('/api/v1/patients').send(newPatient())).body.data;
    expect((await admin.del(`/api/v1/patients/${p.id}`).send({ confirmName: 'Laura Pérez' })).status).toBe(403);
    expect((await su.del(`/api/v1/patients/${p.id}`).send({ confirmName: 'otra persona' })).status).toBe(422);
    expect((await su.del(`/api/v1/patients/${p.id}`).send({ confirmName: 'laura perez' })).status).toBe(204);
    expect(await AuditLog.countDocuments({ action: 'patients.hard_delete' })).toBe(1);
  });

  it('no permite desactivar a un nutriólogo con pacientes sin reasignarlos', async () => {
    const admin = await loginAs(ctx.app, 'administrador');
    const ana = await loginAs(ctx.app, 'usuario');
    await ana.post('/api/v1/patients').send(newPatient());
    const res = await admin.patch(`/api/v1/users/${ana.user.id}/status`).send({ status: 'inactivo' });
    expect(res.status).toBe(409);
    expect(res.body.error.details.patientCount).toBe(1);
    const ok = await admin.patch(`/api/v1/users/${ana.user.id}/status`).send({ status: 'inactivo', reassignTo: admin.user.id });
    expect(ok.status).toBe(200);
    // La sesión del usuario desactivado deja de servir.
    expect((await ana.get('/api/v1/patients')).status).toBe(401);
  });
});
