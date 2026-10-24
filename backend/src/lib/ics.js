'use strict';

/**
 * Minimal iCalendar (RFC 5545) reader for timetable feeds (Outlook "publish
 * calendar", Aimara/Google exports). Supports TZID / UTC / all-day dates,
 * RRULE (DAILY, WEEKLY + BYDAY, MONTHLY; INTERVAL, COUNT, UNTIL), EXDATE and
 * RECURRENCE-ID overrides. Occurrences are expanded inside a time window.
 */

const WINDOWS_TZ = {
  'romance standard time': 'Europe/Paris',
  'w. europe standard time': 'Europe/Berlin',
  'central europe standard time': 'Europe/Budapest',
  'gmt standard time': 'Europe/London',
  'utc': 'UTC',
};
const DEFAULT_TZ = 'Europe/Paris';
const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_MS = 86400000;

function resolveTz(tzid) {
  if (!tzid) return DEFAULT_TZ;
  const clean = tzid.replace(/^"|"$/g, '');
  const mapped = WINDOWS_TZ[clean.toLowerCase()] || clean;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: mapped });
    return mapped;
  } catch {
    return DEFAULT_TZ;
  }
}

const offsetFormatters = new Map();
function tzOffsetMs(ts, tz) {
  let fmt = offsetFormatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    offsetFormatters.set(tz, fmt);
  }
  const p = Object.fromEntries(fmt.formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts;
}

/** Converts a wall-clock time in `tz` to a UTC timestamp (DST-aware). */
function zonedToUtc(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo, d, h, mi, s);
  let ts = guess - tzOffsetMs(guess, tz);
  ts = guess - tzOffsetMs(ts, tz);
  return ts;
}

function unfold(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const [name, ...paramParts] = line.slice(0, colon).split(';');
  const params = {};
  for (const p of paramParts) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(v) {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

/** Returns { wall: {y,mo,d,h,mi,s}, tz, allDay, ts } */
function parseDate(prop) {
  const v = prop.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const wall = { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  const allDay = prop.params.VALUE === 'DATE' || !m[4];
  const tz = m[7] ? 'UTC' : resolveTz(prop.params.TZID);
  const ts = zonedToUtc(wall.y, wall.mo, wall.d, wall.h, wall.mi, wall.s, tz);
  return { wall, tz, allDay, ts };
}

function parseRrule(value) {
  const rule = {};
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) rule[k.toUpperCase()] = v;
  }
  return {
    freq: rule.FREQ,
    interval: Math.max(1, parseInt(rule.INTERVAL || '1', 10)),
    count: rule.COUNT ? parseInt(rule.COUNT, 10) : null,
    until: rule.UNTIL ? parseDate({ value: rule.UNTIL, params: {} })?.ts : null,
    byDay: rule.BYDAY ? rule.BYDAY.split(',').map(d => DAY_CODES.indexOf(d.slice(-2))).filter(i => i >= 0) : null,
  };
}

function parseEvents(text) {
  const events = [];
  let cur = null;
  for (const raw of unfold(text)) {
    if (raw === 'BEGIN:VEVENT') { cur = { exdates: new Set() }; continue; }
    if (raw === 'END:VEVENT') { if (cur && cur.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const prop = parseLine(raw);
    if (!prop) continue;
    switch (prop.name) {
      case 'UID': cur.uid = prop.value; break;
      case 'SUMMARY': cur.title = unescapeText(prop.value); break;
      case 'LOCATION': cur.location = unescapeText(prop.value); break;
      case 'DESCRIPTION': cur.description = unescapeText(prop.value); break;
      case 'DTSTART': cur.start = parseDate(prop); break;
      case 'DTEND': cur.end = parseDate(prop); break;
      case 'RRULE': cur.rrule = parseRrule(prop.value); break;
      case 'RECURRENCE-ID': cur.recurrenceId = parseDate(prop)?.ts; break;
      case 'STATUS': cur.status = prop.value.toUpperCase(); break;
      case 'EXDATE':
        for (const v of prop.value.split(',')) {
          const d = parseDate({ value: v, params: prop.params });
          if (d) cur.exdates.add(d.ts);
        }
        break;
      default: break;
    }
  }
  return events;
}

function* occurrences(ev, to) {
  const { wall, tz } = ev.start;
  const r = ev.rrule;
  if (!r || !['DAILY', 'WEEKLY', 'MONTHLY'].includes(r.freq)) {
    yield ev.start.ts;
    return;
  }
  const at = (y, mo, d) => zonedToUtc(y, mo, d, wall.h, wall.mi, wall.s, tz);
  const limit = Math.min(to, r.until ?? Infinity);
  let emitted = 0;
  const base = Date.UTC(wall.y, wall.mo, wall.d); // calendar-day arithmetic in UTC

  for (let step = 0; step < 2000; step++) {
    let days;
    if (r.freq === 'DAILY') days = [base + step * r.interval * DAY_MS];
    else if (r.freq === 'MONTHLY') {
      const dt = new Date(base); dt.setUTCMonth(dt.getUTCMonth() + step * r.interval);
      days = [dt.getTime()];
    } else {
      const weekStart = base - new Date(base).getUTCDay() * DAY_MS + step * r.interval * 7 * DAY_MS;
      const byDay = r.byDay?.length ? r.byDay : [new Date(base).getUTCDay()];
      days = [...byDay].sort((a, b) => a - b).map(i => weekStart + i * DAY_MS).filter(d => d >= base);
    }
    for (const day of days) {
      const dt = new Date(day);
      const ts = at(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
      if (ts > limit) return;
      if (r.count != null && emitted >= r.count) return;
      emitted++;
      yield ts;
    }
  }
}

/**
 * Expands a calendar into concrete occurrences between `from` and `to`
 * (timestamps), sorted by start.
 */
function expandCalendar(text, from, to) {
  const events = parseEvents(text);
  const overrides = new Set(events.filter(e => e.recurrenceId).map(e => `${e.uid}|${e.recurrenceId}`));
  const out = [];

  for (const ev of events) {
    if (ev.status === 'CANCELLED') continue;
    const duration = ev.end ? ev.end.ts - ev.start.ts : (ev.start.allDay ? DAY_MS : 3600000);
    const series = ev.recurrenceId ? [ev.start.ts] : occurrences(ev, to);
    for (const ts of series) {
      if (!ev.recurrenceId && (ev.exdates.has(ts) || overrides.has(`${ev.uid}|${ts}`))) continue;
      if (ts + duration < from || ts > to) continue;
      out.push({
        id: `${ev.uid || ev.title}|${ts}`,
        title: ev.title || '(sans titre)',
        start: new Date(ts).toISOString(),
        end: new Date(ts + duration).toISOString(),
        location: ev.location || '',
        description: (ev.description || '').slice(0, 300),
        allDay: ev.start.allDay,
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

module.exports = { expandCalendar, parseEvents, zonedToUtc };
