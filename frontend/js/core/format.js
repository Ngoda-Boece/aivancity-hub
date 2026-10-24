import { getLang } from './i18n.js';

const TZ = 'Europe/Paris';
const locale = () => (getLang() === 'en' ? 'en-GB' : 'fr-FR');
const cache = new Map();

function fmt(options) {
  const key = locale() + JSON.stringify(options);
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(locale(), { timeZone: TZ, ...options }));
  return cache.get(key);
}

const toDate = v => (v instanceof Date ? v : new Date(v));

export const time = v => fmt({ hour: '2-digit', minute: '2-digit' }).format(toDate(v));
export const weekday = (v, style = 'long') => fmt({ weekday: style }).format(toDate(v));
export const dayMonth = v => fmt({ day: 'numeric', month: 'short' }).format(toDate(v));
export const longDate = v => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(toDate(v));
export const fullDate = v => fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(toDate(v));
export const monthShort = v => fmt({ month: 'short' }).format(toDate(v)).replace('.', '');
export const dayNum = v => fmt({ day: 'numeric' }).format(toDate(v));

/** Calendar day key in Paris time: "2026-10-22". */
export const dayKey = v => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(toDate(v));

/** Minutes since midnight, Paris time. */
export function minutesOfDay(v) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(toDate(v)).map(x => [x.type, x.value]));
  return +p.hour * 60 + +p.minute;
}

export function duration(startIso, endIso) {
  const mins = Math.round((toDate(endIso) - toDate(startIso)) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
}

export function relative(v) {
  const diff = toDate(v) - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 3600000) return rtf.format(Math.round(diff / 60000), 'minute');
  if (abs < 86400000) return rtf.format(Math.round(diff / 3600000), 'hour');
  return rtf.format(Math.round(diff / 86400000), 'day');
}

/** Monday 00:00 (local browser time) of the week containing `date`, shifted by `weeks`. */
export function weekStart(date = new Date(), weeks = 0) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weeks * 7);
  return d;
}

export const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };

export const number = (n, digits = 2) => new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(n);

/** Stable colour index for a course name. */
export function colorFor(text) {
  let h = 0;
  for (const c of String(text)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `var(--c${(h % 6) + 1})`;
}

export function greetingKey(date = new Date()) {
  const h = date.getHours();
  return h < 5 ? 'home.greet.night' : h < 12 ? 'home.greet.morning' : h < 18 ? 'home.greet.afternoon' : 'home.greet.evening';
}
