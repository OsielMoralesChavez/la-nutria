import { ageFrom } from '@lanutria/shared';

const LOCALE = 'es-MX';

const df = (opts) => new Intl.DateTimeFormat(LOCALE, opts);
const fmtShort = df({ day: 'numeric', month: 'short' });
const fmtShortYear = df({ day: 'numeric', month: 'short', year: 'numeric' });
const fmtLong = df({ weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = df({ hour: '2-digit', minute: '2-digit', hour12: false });
const fmtMonth = df({ month: 'short', year: '2-digit' });
const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

const toDate = (d) => (d instanceof Date ? d : new Date(d));
const valid = (d) => d && !Number.isNaN(toDate(d).getTime());

export const fmtDate = (d) => {
  if (!valid(d)) return '—';
  const date = toDate(d);
  return date.getFullYear() === new Date().getFullYear() ? fmtShort.format(date) : fmtShortYear.format(date);
};
export const fmtDateFull = (d) => (valid(d) ? fmtShortYear.format(toDate(d)) : '—');
/** "viernes, 2 de octubre" → con mayúscula inicial sólo en la primera palabra. */
export const fmtDateLong = (d) => {
  if (!valid(d)) return '—';
  const s = fmtLong.format(toDate(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const fmtTimeOf = (d) => (valid(d) ? fmtTime.format(toDate(d)) : '—');
export const fmtDateTime = (d) => (valid(d) ? `${fmtDate(d)} · ${fmtTimeOf(d)}` : '—');
export const fmtMonthYear = (d) => (valid(d) ? fmtMonth.format(toDate(d)) : '');

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** "hoy", "ayer", "hace 3 días", "en 2 semanas"… */
export function fmtRelative(d) {
  if (!valid(d)) return '—';
  const days = Math.round((startOfDay(d) - startOfDay()) / 864e5);
  if (Math.abs(days) < 7) return rtf.format(days, 'day');
  if (Math.abs(days) < 60) return rtf.format(Math.round(days / 7), 'week');
  return rtf.format(Math.round(days / 30.44), 'month');
}

export const daysFromNow = (d) => Math.round((startOfDay(d) - startOfDay()) / 864e5);

/** Valor numérico con decimales del catálogo y unidad opcional. */
export function fmtNum(value, decimals = 1, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Number(value).toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  return unit ? `${n} ${unit}` : n;
}

/** Diferencia con signo: "+0.4", "−1.2" (signo menos tipográfico). */
export function fmtDelta(delta, decimals = 1) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return '—';
  const abs = Math.abs(delta).toLocaleString(LOCALE, { maximumFractionDigits: decimals });
  if (Number(abs) === 0 || abs === '0') return '0';
  return `${delta > 0 ? '+' : '−'}${abs}`;
}

export const fullName = (p) => (p ? p.fullName ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '');
export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
export const ageOf = (birthDate) => ageFrom(birthDate);

/** "Buenos días/tardes/noches" según la hora local. */
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Para <input type="datetime-local"> / <input type="date"> */
export const toInputDate = (d) => {
  if (!valid(d)) return '';
  const x = toDate(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const toInputDateTime = (d) => {
  if (!valid(d)) return '';
  const x = toDate(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${toInputDate(x)}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
