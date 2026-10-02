import { describe, expect, it } from 'vitest';
import { cn } from './cn.js';
import { fmtDateLong, fmtDelta, fmtNum, initials, toInputDate, toInputDateTime } from './format.js';

describe('formato', () => {
  it('cambio con signo tipográfico', () => {
    expect(fmtDelta(-1.24)).toBe('−1.2');
    expect(fmtDelta(0.5)).toBe('+0.5');
    expect(fmtDelta(0)).toBe('0');
    expect(fmtDelta(null)).toBe('—');
  });

  it('números con unidad y decimales del catálogo', () => {
    expect(fmtNum(82.45, 1, 'kg')).toBe('82.5 kg');
    expect(fmtNum(undefined)).toBe('—');
  });

  it('fecha larga con mayúscula sólo al inicio', () => {
    expect(fmtDateLong(new Date(2026, 9, 2))).toBe('Viernes, 2 de octubre');
  });

  it('valores para inputs date/datetime-local (24 h)', () => {
    const d = new Date(2026, 9, 2, 15, 5);
    expect(toInputDate(d)).toBe('2026-10-02');
    expect(toInputDateTime(d)).toBe('2026-10-02T15:05');
  });

  it('iniciales', () => {
    expect(initials('Laura Pérez Gómez')).toBe('LP');
  });

  it('cn resuelve conflictos de Tailwind (la última clase gana)', () => {
    expect(cn('inline-flex px-2', 'hidden lg:inline-flex')).toBe('px-2 hidden lg:inline-flex');
  });
});
