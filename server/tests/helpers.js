import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { invalidateUserCache } from '../src/middleware/authenticate.js';
import { Role, User } from '../src/models/index.js';
import { hashPassword } from '../src/services/authService.js';
import { seedBase } from '../src/seeds/base.js';

export const PASSWORD = 'contrasena-de-prueba-123';

/**
 * Levanta un replica set en memoria por archivo de pruebas y limpia las
 * colecciones antes de cada prueba (re-sembrando catálogos base).
 */
export function useTestDb() {
  const ctx = { app: null };
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri('la_nutria_test'));
    ctx.app = createApp();
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
    invalidateUserCache();
    await seedBase(() => {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  return ctx;
}

let counter = 0;
export async function createUser(roleKey, overrides = {}) {
  counter += 1;
  const role = await Role.findOne({ key: roleKey });
  return User.create({
    name: `Usuario ${counter}`,
    email: `u${counter}@test.local`,
    role: role._id,
    passwordHash: await hashPassword(PASSWORD),
    ...overrides,
  });
}

/** Crea usuario, inicia sesión y devuelve un cliente con Authorization. */
export async function loginAs(app, roleKey, overrides) {
  const user = await createUser(roleKey, overrides);
  const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login falló: ${res.status} ${JSON.stringify(res.body)}`);
  const token = res.body.data.accessToken;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    user,
    token,
    cookie: res.headers['set-cookie'],
    get: (url) => auth(request(app).get(url)),
    post: (url) => auth(request(app).post(url)),
    patch: (url) => auth(request(app).patch(url)),
    put: (url) => auth(request(app).put(url)),
    del: (url) => auth(request(app).delete(url)),
  };
}

export const newPatient = (over = {}) => ({
  firstName: 'Laura',
  lastName: 'Pérez',
  birthDate: '1992-03-14',
  sex: 'femenino',
  contact: { phone: '55 1234 5678' },
  ...over,
});
