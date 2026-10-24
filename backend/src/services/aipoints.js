'use strict';

const config = require('../config');
const { parseCsvObjects } = require('../lib/csv');
const { namesMatch } = require('../lib/text');
const { TtlCache } = require('../lib/cache');
const { HttpError, fetchWithTimeout } = require('../lib/http');

const cache = new TtlCache(2 * 60 * 1000, 4);

const pick = (row, candidates) => {
  const key = Object.keys(row).find(k => candidates.some(c => k.includes(c)));
  return key ? row[key] : '';
};

/** Normalizes heterogeneous sheet layouts into { name, email, points }. */
function normalizeRows(rows) {
  return rows.map(row => {
    const first = pick(row, ['prénom', 'prenom', 'first']);
    const last = row.nom ?? pick(row, ['last', 'surname']);
    const name = pick(row, ['name', 'étudiant', 'etudiant', 'student']) || [first, last].filter(Boolean).join(' ');
    const rawPoints = pick(row, ['point', 'score', 'total']).replace(',', '.').replace(/[^\d.-]/g, '');
    return {
      name: name.trim(),
      email: pick(row, ['email', 'mail', 'courriel']).trim().toLowerCase(),
      points: Math.round(parseFloat(rawPoints)) || 0,
    };
  }).filter(r => r.name || r.email);
}

async function loadSheet() {
  return cache.wrap('sheet', async () => {
    const res = await fetchWithTimeout(config.aipointsCsvUrl, {}, 10000);
    if (!res.ok) throw new HttpError(502, 'sheet_unavailable', 'Impossible de lire la feuille AI Points.');
    return normalizeRows(parseCsvObjects(await res.text()));
  });
}

function findStudent(rows, user) {
  return rows.find(r => r.email && r.email === user.email.toLowerCase())
    || rows.find(r => r.name && namesMatch(r.name, user.name))
    || null;
}

async function getStandings(user) {
  if (!config.aipointsCsvUrl) return { configured: false };
  const rows = await loadSheet();
  const ranked = [...rows].sort((a, b) => b.points - a.points);
  const me = findStudent(ranked, user);
  return {
    configured: true,
    me: me ? { name: me.name, points: me.points, rank: ranked.indexOf(me) + 1 } : null,
    total: ranked.length,
    // Leaderboard shows names and points only — never emails.
    leaderboard: ranked.slice(0, 10).map((r, i) => ({ rank: i + 1, name: r.name, points: r.points, isMe: r === me })),
  };
}

module.exports = { getStandings, normalizeRows, findStudent };
