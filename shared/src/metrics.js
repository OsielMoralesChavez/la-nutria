/**
 * Cálculos compartidos: el cliente los usa para mostrar valores en vivo durante
 * la consulta y el servidor para guardarlos. Así ambos siempre coinciden.
 *
 * Sólo contiene fórmulas matemáticas estándar (IMC, ICC) y el cálculo de
 * progreso hacia una meta. No contiene interpretación clínica.
 */

const round = (n, decimals = 2) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Fórmulas de métricas derivadas, por clave de `metricdefinitions`.
 * `requires` lista las métricas de entrada.
 */
export const DERIVED_METRICS = Object.freeze({
  imc: {
    requires: ['peso', 'estatura'],
    decimals: 1,
    compute: ({ peso, estatura }) => {
      const m = estatura / 100;
      return m > 0 ? peso / (m * m) : null;
    },
  },
  icc: {
    requires: ['cintura', 'cadera'],
    decimals: 2,
    compute: ({ cintura, cadera }) => (cadera > 0 ? cintura / cadera : null),
  },
});

/**
 * Calcula las métricas derivadas a partir de un mapa `{ clave: valor }`.
 * `fallback` permite usar valores de tomas previas (p. ej. la estatura no se
 * mide en cada consulta).
 *
 * @param {Record<string, number>} values
 * @param {Record<string, number>} [fallback]
 * @param {string[]} [enabledKeys] claves derivadas activas; por defecto todas
 * @returns {Record<string, number>} sólo las derivadas que se pudieron calcular
 */
export function computeDerived(values, fallback = {}, enabledKeys = Object.keys(DERIVED_METRICS)) {
  const result = {};
  for (const key of enabledKeys) {
    const def = DERIVED_METRICS[key];
    if (!def) continue;
    // Sólo se calcula si al menos una entrada viene de esta toma: evita
    // "inventar" un IMC nuevo con datos viejos.
    if (!def.requires.some((r) => isNum(values[r]))) continue;
    const inputs = {};
    let ok = true;
    for (const r of def.requires) {
      const v = isNum(values[r]) ? values[r] : fallback[r];
      if (!isNum(v)) {
        ok = false;
        break;
      }
      inputs[r] = v;
    }
    if (!ok) continue;
    const out = def.compute(inputs);
    if (isNum(out)) result[key] = round(out, def.decimals);
  }
  return result;
}

/**
 * Progreso de un objetivo.
 *
 * - métrica + bajar/subir: fracción recorrida de inicio a meta (0–1, acotada).
 * - métrica + mantener: dentro/fuera de tolerancia.
 * - cualitativo: último puntaje registrado (0–100) / 100.
 *
 * @returns {{ ratio: number|null, reached: boolean, withinTolerance?: boolean }}
 */
export function goalProgress(goal, currentValue) {
  if (goal.kind === 'cualitativo') {
    const last = goal.checkpoints?.length ? goal.checkpoints[goal.checkpoints.length - 1] : null;
    const score = isNum(last?.score) ? last.score : null;
    return { ratio: score === null ? null : score / 100, reached: score === 100 };
  }

  const { baseline, target, direction, tolerance } = goal;
  if (!isNum(currentValue) || !isNum(target)) return { ratio: null, reached: false };

  if (direction === 'mantener') {
    const tol = isNum(tolerance) ? tolerance : 0;
    const within = Math.abs(currentValue - target) <= tol;
    return { ratio: within ? 1 : 0, reached: within, withinTolerance: within };
  }

  if (!isNum(baseline) || baseline === target) {
    const reached = direction === 'bajar' ? currentValue <= target : currentValue >= target;
    return { ratio: reached ? 1 : 0, reached };
  }

  const raw = (currentValue - baseline) / (target - baseline);
  const ratio = Math.min(1, Math.max(0, raw));
  const reached = direction === 'bajar' ? currentValue <= target : currentValue >= target;
  return { ratio: round(ratio, 3), reached };
}

/** Edad cumplida en años a una fecha dada. */
export function ageFrom(birthDate, at = new Date()) {
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age -= 1;
  return age;
}
