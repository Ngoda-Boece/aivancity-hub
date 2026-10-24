'use strict';

const dns = require('dns').promises;
const net = require('net');
const config = require('../config');
const microsoft = require('./microsoft');
const { store } = require('./store');
const { expandCalendar } = require('../lib/ics');
const { TtlCache } = require('../lib/cache');
const { HttpError } = require('../lib/http');
const { resolveRoom } = require('../data/campus');
const { demoSchedule } = require('../data/demo');

const icsCache = new TtlCache(5 * 60 * 1000, 100);
const MAX_ICS_BYTES = 5 * 1024 * 1024;

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

/**
 * Validates a user-supplied calendar URL against SSRF: https only, optional
 * host allow-list, and every resolved address must be public.
 */
async function assertSafeUrl(raw) {
  let url;
  try {
    url = new URL(String(raw).trim().replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    throw new HttpError(400, 'bad_url', 'Lien de calendrier invalide.');
  }
  if (url.protocol !== 'https:') throw new HttpError(400, 'bad_url', 'Le lien doit commencer par https://');
  if (url.username || url.password) throw new HttpError(400, 'bad_url', 'Lien de calendrier invalide.');
  const host = url.hostname.toLowerCase();
  if (config.icsAllowedHosts.length && !config.icsAllowedHosts.some(h => host === h || host.endsWith(`.${h}`))) {
    throw new HttpError(400, 'host_not_allowed', 'Ce domaine de calendrier n’est pas autorisé.');
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new HttpError(400, 'bad_url', 'Domaine introuvable.');
  if (addresses.some(a => isPrivateAddress(a.address))) throw new HttpError(400, 'bad_url', 'Adresse non autorisée.');
  return url;
}

async function fetchIcs(raw) {
  let url = await assertSafeUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'text/calendar, */*' } });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = await assertSafeUrl(new URL(res.headers.get('location'), url).href);
        continue;
      }
      if (!res.ok) throw new HttpError(502, 'ics_unavailable', `Le calendrier a répondu ${res.status}.`);
      if (Number(res.headers.get('content-length')) > MAX_ICS_BYTES) throw new HttpError(502, 'ics_too_large', 'Calendrier trop volumineux.');
      let body = '';
      const decoder = new TextDecoder();
      for await (const chunk of res.body) {
        body += decoder.decode(chunk, { stream: true });
        if (body.length > MAX_ICS_BYTES) throw new HttpError(502, 'ics_too_large', 'Calendrier trop volumineux.');
      }
      if (!body.includes('BEGIN:VCALENDAR')) throw new HttpError(422, 'not_ics', "Ce lien ne renvoie pas un calendrier iCal (.ics).");
      return body;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(502, 'ics_unavailable', 'Impossible de télécharger le calendrier.');
    } finally {
      clearTimeout(timer);
    }
  }
  throw new HttpError(502, 'ics_unavailable', 'Trop de redirections.');
}

async function icsEvents(url, from, to) {
  const text = await icsCache.wrap(url, () => fetchIcs(url));
  return expandCalendar(text, from.getTime(), to.getTime());
}

const decorate = events => events.map(e => ({ ...e, room: resolveRoom(e.location) }));

/**
 * Returns the student's timetable from the best available source:
 * Outlook (SSO) → personal ICS link → school-wide ICS → local scrape → demo.
 */
async function getSchedule({ user, session }, from, to) {
  const errors = [];

  if (user.provider === 'microsoft' && session?.state?.ms) {
    try {
      return { source: 'outlook', events: decorate(await microsoft.getCalendar(session.state, from, to)) };
    } catch (err) { errors.push(err.message); }
  }

  const personal = store.user(user.email).prefs.icsUrl;
  for (const [source, url] of [['ics', personal], ['school-ics', config.scheduleIcsUrl]]) {
    if (!url) continue;
    try {
      return { source, events: decorate(await icsEvents(url, from, to)) };
    } catch (err) { errors.push(err.message); }
  }

  const scraped = session?.state?.scrape?.data?.schedule;
  if (scraped?.length) {
    const inRange = scraped.filter(e => new Date(e.end) >= from && new Date(e.start) <= to);
    return { source: 'aimara', events: decorate(inRange) };
  }

  return { source: 'demo', demo: true, events: decorate(demoSchedule(from, to)), errors };
}

module.exports = { getSchedule, fetchIcs, assertSafeUrl, isPrivateAddress };
