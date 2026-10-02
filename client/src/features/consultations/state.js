import { goalDraftToBody } from '../patients/components/GoalForm.jsx';

/**
 * Estado local del modo consulta y su traducción al borrador del servidor.
 * El borrador se guarda por secciones; al cerrar, el servidor lo convierte
 * en registros reales (medición, objetivos, expediente, cita/seguimiento).
 */
export function buildInitialState(context, user) {
  const c = context.consultation;
  const d = c.draft ?? {};
  const soap = c.notes?.soap;
  const hasSoap = soap && Object.values(soap).some(Boolean);
  const pref = user?.preferences?.noteFormat ?? 'libre';

  const values = {};
  for (const v of d.measurement?.values ?? []) {
    values[v.metric] = { raw: v.value === null || v.value === undefined ? '' : String(v.value), value: v.value ?? null, method: v.method ?? null };
  }

  const updates = {};
  for (const u of d.goals?.updates ?? []) {
    const { goalId, ...rest } = u;
    updates[goalId] = rest;
  }

  const next = d.next ?? {};
  return {
    type: c.type,
    reason: c.reason ?? '',
    noteFormat: hasSoap ? (c.notes?.freeText ? 'ambos' : 'soap') : pref,
    notes: { freeText: c.notes?.freeText ?? '', soap: { s: '', o: '', a: '', p: '', ...(soap ?? {}) } },
    clinical: d.clinical ?? {},
    measurement: {
      method: d.measurement?.method ?? 'bioimpedancia',
      perValueMethod: Object.values(values).some((v) => v.method),
      values,
    },
    goals: {
      updates,
      create: (d.goals?.create ?? []).map((g, i) => ({ tmpId: `saved-${i}`, ...g })),
    },
    next: {
      mode: next.appointment ? 'cita' : next.followUp ? 'seguimiento' : 'ninguno',
      appointment: next.appointment ?? { start: null, type: 'seguimiento' },
      followUp: next.followUp ?? { dueDate: null, reason: '' },
      resolveFollowUps: next.resolveFollowUps ?? [],
    },
  };
}

/** Payload parcial para PATCH /consultations/:id según la sección que cambió. */
export function serializeSection(section, s) {
  switch (section) {
    case 'reason':
      return { reason: s.reason };
    case 'type':
      return { type: s.type };
    case 'notes':
    case 'noteFormat':
      return {
        notes: {
          freeText: s.noteFormat === 'soap' ? '' : s.notes.freeText,
          soap: s.noteFormat === 'libre' ? null : s.notes.soap,
        },
      };
    case 'clinical':
      return { draft: { clinical: s.clinical } };
    case 'measurement':
      return {
        draft: {
          measurement: {
            method: s.measurement.method || null,
            values: Object.entries(s.measurement.values)
              .filter(([, v]) => v.raw !== '' && v.raw !== undefined)
              .map(([metric, v]) => ({ metric, value: v.value, ...(s.measurement.perValueMethod && v.method && { method: v.method }) })),
          },
        },
      };
    case 'goals':
      return {
        draft: {
          goals: {
            updates: Object.entries(s.goals.updates)
              .filter(([, u]) => Object.keys(u).length)
              .map(([goalId, u]) => ({ goalId, ...u })),
            create: s.goals.create.filter((g) => g.goalType).map(goalDraftToBody),
          },
        },
      };
    case 'next': {
      const n = s.next;
      return {
        draft: {
          next: {
            appointment: n.mode === 'cita' && n.appointment.start ? { start: n.appointment.start, type: n.appointment.type || null, ...(n.appointment.durationMin && { durationMin: n.appointment.durationMin }) } : null,
            followUp: n.mode === 'seguimiento' && n.followUp.dueDate && n.followUp.reason.trim() ? { dueDate: n.followUp.dueDate, reason: n.followUp.reason.trim() } : null,
            resolveFollowUps: n.resolveFollowUps,
          },
        },
      };
    }
    default:
      return {};
  }
}

/** `{ metric: number }` con los valores capturados hoy. */
export const todayValues = (s) =>
  Object.fromEntries(Object.entries(s.measurement.values).filter(([, v]) => typeof v.value === 'number').map(([k, v]) => [k, v.value]));
