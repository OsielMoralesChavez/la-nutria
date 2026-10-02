import { describe, expect, it } from 'vitest';
import { ageFrom, computeDerived, goalProgress } from './metrics.js';
import { ALL_PERMISSIONS, isValidPermission } from './permissions.js';
import { SYSTEM_ROLES } from './roles.js';

describe('computeDerived', () => {
  it('calcula IMC e ICC', () => {
    expect(computeDerived({ peso: 70, estatura: 175, cintura: 80, cadera: 100 })).toEqual({ imc: 22.9, icc: 0.8 });
  });

  it('usa la estatura previa si no se midió hoy', () => {
    expect(computeDerived({ peso: 70 }, { estatura: 175 })).toEqual({ imc: 22.9 });
  });

  it('no recalcula con datos sólo históricos', () => {
    expect(computeDerived({}, { peso: 70, estatura: 175 })).toEqual({});
  });

  it('omite derivadas desactivadas', () => {
    expect(computeDerived({ peso: 70, estatura: 175 }, {}, ['icc'])).toEqual({});
  });
});

describe('goalProgress', () => {
  it('progreso al bajar', () => {
    expect(goalProgress({ kind: 'metrica', direction: 'bajar', baseline: 80, target: 70 }, 75)).toEqual({ ratio: 0.5, reached: false });
  });

  it('acota y marca alcanzado', () => {
    expect(goalProgress({ kind: 'metrica', direction: 'subir', baseline: 20, target: 25 }, 26)).toEqual({ ratio: 1, reached: true });
    expect(goalProgress({ kind: 'metrica', direction: 'bajar', baseline: 80, target: 70 }, 85).ratio).toBe(0);
  });

  it('mantenimiento usa tolerancia', () => {
    expect(goalProgress({ kind: 'metrica', direction: 'mantener', target: 60, tolerance: 1 }, 60.8).withinTolerance).toBe(true);
    expect(goalProgress({ kind: 'metrica', direction: 'mantener', target: 60, tolerance: 1 }, 62).withinTolerance).toBe(false);
  });

  it('cualitativo usa el último puntaje', () => {
    expect(goalProgress({ kind: 'cualitativo', checkpoints: [{ score: 40 }, { score: 70 }] })).toEqual({ ratio: 0.7, reached: false });
  });
});

describe('ageFrom', () => {
  it('respeta el cumpleaños', () => {
    expect(ageFrom('1990-10-02', new Date('2026-10-01'))).toBe(35);
    expect(ageFrom('1990-10-01', new Date('2026-10-01'))).toBe(36);
  });
});

describe('roles base', () => {
  it('sólo usan permisos válidos', () => {
    for (const role of SYSTEM_ROLES) {
      for (const p of role.permissions) expect(isValidPermission(p), `${role.key}: ${p}`).toBe(true);
    }
  });

  it('el superusuario tiene todos los permisos', () => {
    expect(SYSTEM_ROLES[0].permissions).toHaveLength(ALL_PERMISSIONS.length);
  });
});
