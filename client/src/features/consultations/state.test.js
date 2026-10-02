import { describe, expect, it } from 'vitest';
import { buildInitialState, serializeSection, todayValues } from './state.js';

const context = (draft = {}, notes = {}) => ({
  consultation: { type: 'seguimiento', reason: '', notes, draft },
});

describe('estado del modo consulta', () => {
  it('reanuda un borrador guardado', () => {
    const s = buildInitialState(
      context({
        measurement: { method: 'pliegues', values: [{ metric: 'peso', value: 76.8 }] },
        next: { followUp: { dueDate: '2026-10-20', reason: 'Llamar' } },
      }),
      { preferences: { noteFormat: 'soap' } },
    );
    expect(s.measurement.method).toBe('pliegues');
    expect(s.measurement.values.peso).toMatchObject({ raw: '76.8', value: 76.8 });
    expect(s.next.mode).toBe('seguimiento');
    expect(s.noteFormat).toBe('soap');
    expect(todayValues(s)).toEqual({ peso: 76.8 });
  });

  it('serializa sólo lo capturado y respeta el formato de nota', () => {
    const s = buildInitialState(context(), {});
    s.measurement.values = { peso: { raw: '70', value: 70 }, cintura: { raw: '', value: null }, cadera: { raw: '9x', value: null } };
    expect(serializeSection('measurement', s).draft.measurement.values).toEqual([
      { metric: 'peso', value: 70 },
      { metric: 'cadera', value: null },
    ]);

    s.noteFormat = 'libre';
    s.notes = { freeText: 'Nota', soap: { s: 'x', o: '', a: '', p: '' } };
    expect(serializeSection('notes', s)).toEqual({ notes: { freeText: 'Nota', soap: null } });
  });

  it('la próxima cita sólo se envía con horario elegido', () => {
    const s = buildInitialState(context(), {});
    s.next.mode = 'cita';
    expect(serializeSection('next', s).draft.next.appointment).toBeNull();
    s.next.appointment = { start: '2026-10-16T16:00:00.000Z', type: 'seguimiento' };
    expect(serializeSection('next', s).draft.next.appointment).toEqual({ start: '2026-10-16T16:00:00.000Z', type: 'seguimiento' });
  });

  it('descarta objetivos nuevos sin tipo', () => {
    const s = buildInitialState(context(), {});
    s.goals.create = [{ tmpId: 'a' }, { tmpId: 'b', goalType: 'perdida_peso', target: 70 }];
    expect(serializeSection('goals', s).draft.goals.create).toEqual([{ goalType: 'perdida_peso', target: 70 }]);
  });
});
