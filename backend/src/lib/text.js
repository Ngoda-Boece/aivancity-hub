'use strict';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Two names match when they contain exactly the same set of words, in any order
 * ("Dupont Marie" === "marie DUPONT"). Substring matching is deliberately avoided:
 * it let "an" match "Jean Martin" and leaked other students' points.
 */
function namesMatch(a, b) {
  const ta = normalizeName(a).split(' ').filter(Boolean).sort();
  const tb = normalizeName(b).split(' ').filter(Boolean).sort();
  return ta.length > 0 && ta.length === tb.length && ta.every((t, i) => t === tb[i]);
}

/** "marie.dupont-leroy@x.fr" → "Marie Dupont-Leroy" */
function nameFromEmail(email) {
  const local = String(email).split('@')[0].replace(/[0-9]+/g, '');
  return local
    .split(/[._]+/)
    .filter(Boolean)
    .map(part => part.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('-'))
    .join(' ') || 'Étudiant';
}

/** Strips control characters and trims to a maximum length. */
function cleanText(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

module.exports = { escapeHtml, normalizeName, namesMatch, nameFromEmail, cleanText };
