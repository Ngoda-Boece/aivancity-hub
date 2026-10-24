'use strict';

const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const { store } = require('../services/store');
const { sendAsStudent } = require('../services/mail');
const { ROOMS_BY_NUMBER } = require('../data/campus');
const { asyncRoute, HttpError } = require('../lib/http');
const { Validator, isDate, isTime, toMinutes } = require('../lib/validate');
const { escapeHtml, cleanText } = require('../lib/text');
const { rateLimit } = require('../lib/rateLimit');

const router = express.Router();
const OPEN = '08:00';
const CLOSE = '21:00';

function parisToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

function emailHtml(b, user) {
  const row = (label, value) => `<tr><td style="padding:10px 14px;color:#6b6b6b;font-size:13px;border-bottom:1px solid #eee;width:140px">${label}</td><td style="padding:10px 14px;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(value)}</td></tr>`;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#151515">
  <h2 style="margin:0 0 4px">Demande de réservation de salle</h2>
  <p style="margin:0 0 18px;color:#6b6b6b;font-size:13px">Envoyée via Aivancity Hub</p>
  <table style="width:100%;border-collapse:collapse;border:1px solid #eee">
    ${row('Étudiant·e', user.name)}${row('E-mail', user.email)}
    ${row('Salle', `${b.room} — ${b.roomName}`)}${row('Date', b.date)}
    ${row('Horaire', `${b.start} – ${b.end}`)}${row('Motif', b.purpose || 'Non précisé')}
    ${row('Participants', b.participants || 'Non précisé')}
  </table>
  <p style="color:#8a8a8a;font-size:12px;margin-top:14px">Répondez à ${escapeHtml(user.email)} pour confirmer ou refuser.</p></div>`;
}

function emailText(b, user) {
  return [
    'Bonjour,', '',
    `Je souhaiterais réserver la salle ${b.room} — ${b.roomName} le ${b.date} de ${b.start} à ${b.end}.`,
    b.purpose ? `Motif : ${b.purpose}` : null,
    b.participants ? `Nombre de participants : ${b.participants}` : null,
    '', 'Merci par avance,', user.name,
  ].filter(l => l !== null).join('\n');
}

const overlaps = (a, b) => a.room === b.room && a.date === b.date && a.status !== 'cancelled'
  && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

router.get('/bookings', (req, res) => {
  const today = parisToday();
  const mine = store.user(req.user.email).bookings
    .filter(b => b.date >= today && b.status !== 'cancelled')
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  res.json({ bookings: mine, hours: { open: OPEN, close: CLOSE } });
});

router.post('/bookings', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, name: 'booking' }), asyncRoute(async (req, res) => {
  const body = req.body || {};
  const room = ROOMS_BY_NUMBER[String(body.room)];
  const b = {
    room: room?.number,
    roomName: room?.name,
    date: String(body.date || ''),
    start: String(body.start || ''),
    end: String(body.end || ''),
    purpose: cleanText(body.purpose, 200),
    participants: body.participants ? Math.trunc(Number(body.participants)) : null,
  };

  new Validator()
    .check(room, 'room', 'Choisissez une salle.')
    .check(isDate(b.date), 'date', 'Date invalide.')
    .check(!isDate(b.date) || b.date >= parisToday(), 'date', 'La date est passée.')
    .check(isTime(b.start), 'start', 'Heure de début invalide.')
    .check(isTime(b.end), 'end', 'Heure de fin invalide.')
    .check(!isTime(b.start) || !isTime(b.end) || toMinutes(b.end) > toMinutes(b.start), 'end', 'La fin doit être après le début.')
    .check(!isTime(b.start) || toMinutes(b.start) >= toMinutes(OPEN), 'start', `Le campus ouvre à ${OPEN}.`)
    .check(!isTime(b.end) || toMinutes(b.end) <= toMinutes(CLOSE), 'end', `Le campus ferme à ${CLOSE}.`)
    .check(b.participants === null || (b.participants >= 1 && b.participants <= 200), 'participants', 'Entre 1 et 200 participants.')
    .done();

  // Conflicts we know about: bookings made through the hub by anyone.
  const conflict = Object.values(store.data.users).flatMap(u => u.bookings || []).find(x => overlaps(x, b));
  if (conflict) throw new HttpError(409, 'conflict', `Déjà demandée via le Hub : ${conflict.start}–${conflict.end}.`);

  const subject = `Réservation salle ${b.room} — ${b.roomName} — ${b.date} ${b.start}-${b.end}`;
  const delivery = await sendAsStudent({ session: req.session, user: req.user, to: config.bookingRecipient, subject, html: emailHtml(b, req.user) });

  const booking = {
    id: crypto.randomUUID(),
    ...b,
    status: delivery.sent ? 'sent' : 'draft',
    via: delivery.via,
    createdAt: new Date().toISOString(),
  };
  store.update(req.user.email, u => { u.bookings.push(booking); });

  res.status(201).json({
    booking,
    // No server-side channel: the client opens this pre-filled draft in the student's mail app.
    mailto: delivery.sent ? null : `mailto:${config.bookingRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailText(b, req.user))}`,
  });
}));

router.delete('/bookings/:id', (req, res) => {
  const found = store.update(req.user.email, u => {
    const bk = u.bookings.find(x => x.id === req.params.id);
    if (bk) bk.status = 'cancelled';
    return bk;
  });
  if (!found) throw new HttpError(404, 'not_found', 'Réservation introuvable.');
  res.json({ ok: true });
});

module.exports = router;
