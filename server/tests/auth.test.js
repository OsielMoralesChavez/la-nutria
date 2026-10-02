import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AuditLog, RefreshSession } from '../src/models/index.js';
import { createUser, loginAs, PASSWORD, useTestDb } from './helpers.js';

const ctx = useTestDb();
const cookieValue = (setCookie) => setCookie.find((c) => c.startsWith('ln_rt=')).split(';')[0];

describe('autenticación', () => {
  it('inicia sesión y entrega access token + cookie httpOnly', async () => {
    const user = await createUser('usuario');
    const res = await request(ctx.app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.user.permissions).toContain('patients:read');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('rechaza credenciales inválidas con mensaje genérico y lo audita', async () => {
    const user = await createUser('usuario');
    const bad = await request(ctx.app).post('/api/v1/auth/login').send({ email: user.email, password: 'incorrecta-123' });
    const unknown = await request(ctx.app).post('/api/v1/auth/login').send({ email: 'nadie@test.local', password: 'x' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.error.message).toBe(unknown.body.error.message);
    expect(await AuditLog.countDocuments({ action: 'auth.login', result: 'denegado' })).toBe(2);
  });

  it('bloquea temporalmente tras 5 intentos fallidos', async () => {
    const user = await createUser('usuario');
    for (let i = 0; i < 5; i += 1) {
      await request(ctx.app).post('/api/v1/auth/login').send({ email: user.email, password: 'mala-contrasena' });
    }
    const res = await request(ctx.app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(423);
  });

  it('exige token en rutas protegidas', async () => {
    const res = await request(ctx.app).get('/api/v1/patients');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(res.body.error.requestId).toBeTypeOf('string');
  });

  it('rota el refresh token y detecta reutilización', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const first = cookieValue(s.cookie);

    const r1 = await request(ctx.app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    const second = cookieValue(r1.headers['set-cookie']);
    expect(second).not.toBe(first);

    // Dentro de la ventana de gracia (pestañas simultáneas) no se revoca.
    const concurrent = await request(ctx.app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(concurrent.status).toBe(200);
    expect(concurrent.headers['set-cookie']).toBeUndefined();

    // Pasada la ventana, reusar el token viejo revoca toda la sesión…
    await RefreshSession.updateMany({}, { lastUsedAt: new Date(Date.now() - 60_000) });
    const reuse = await request(ctx.app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(reuse.status).toBe(401);
    // …incluido el token vigente.
    const after = await request(ctx.app).post('/api/v1/auth/refresh').set('Cookie', second);
    expect(after.status).toBe(401);
  });

  it('logout invalida la sesión en servidor', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const cookie = cookieValue(s.cookie);
    expect((await request(ctx.app).post('/api/v1/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await request(ctx.app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });

  it('cambia la contraseña validando la actual', async () => {
    const s = await loginAs(ctx.app, 'usuario');
    const wrong = await s.patch('/api/v1/auth/password').send({ currentPassword: 'otra-cosa-123', newPassword: 'nueva-contrasena-123' });
    expect(wrong.status).toBe(422);
    const ok = await s.patch('/api/v1/auth/password').send({ currentPassword: PASSWORD, newPassword: 'nueva-contrasena-123' });
    expect(ok.status).toBe(204);
    const login = await request(ctx.app).post('/api/v1/auth/login').send({ email: s.user.email, password: 'nueva-contrasena-123' });
    expect(login.status).toBe(200);
  });
});
