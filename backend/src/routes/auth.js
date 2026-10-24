'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const microsoft = require('../services/microsoft');
const { createSession, destroySession } = require('../services/sessions');
const { HttpError, asyncRoute } = require('../lib/http');
const { Validator, isEmail } = require('../lib/validate');
const { nameFromEmail, cleanText } = require('../lib/text');
const { rateLimit } = require('../lib/rateLimit');

const router = express.Router();
const OAUTH_COOKIE = 'ah_oauth';

function domainAllowed(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return !config.allowedEmailDomains.length || config.allowedEmailDomains.includes(domain);
}

/** Public: who is signed in (null when nobody) — avoids a 401 on every cold load. */
router.get('/auth/session', (req, res) => {
  res.json({ user: req.user || null });
});

router.get('/auth/config', (_req, res) => {
  res.json({
    microsoft: config.microsoft.enabled,
    localLogin: config.allowLocalLogin,
    domains: config.allowedEmailDomains,
  });
});

/**
 * Email-only sign-in. It cannot prove identity (only Microsoft SSO can), so it
 * is restricted to school domains and asks for no password: the hub never
 * handles school credentials.
 */
router.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, name: 'login' }), (req, res) => {
  if (!config.allowLocalLogin) throw new HttpError(403, 'local_login_disabled', 'Utilisez la connexion Microsoft.');

  const email = cleanText(req.body?.email, 254).toLowerCase();
  const name = cleanText(req.body?.name, 80);
  new Validator()
    .check(isEmail(email), 'email', 'Adresse e-mail invalide.')
    .check(!isEmail(email) || domainAllowed(email), 'email', `Utilisez votre adresse ${config.allowedEmailDomains.map(d => '@' + d).join(' ou ')}.`)
    .done();

  const user = { email, name: name || nameFromEmail(email), provider: 'local' };
  createSession(res, user);
  res.json({ user });
});

router.get('/auth/microsoft', (_req, res) => {
  if (!config.microsoft.enabled) throw new HttpError(404, 'ms_disabled', 'Connexion Microsoft non configurée.');
  const { url, state, verifier } = microsoft.createAuthRequest();
  res.cookie(OAUTH_COOKIE, jwt.sign({ state, verifier }, config.jwtSecret, { expiresIn: 600 }), {
    httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 600000, path: '/api/auth',
  });
  res.redirect(url);
});

router.get('/auth/microsoft/callback', asyncRoute(async (req, res) => {
  const fail = reason => res.redirect(`/#/login?error=${encodeURIComponent(reason)}`);
  res.clearCookie(OAUTH_COOKIE, { path: '/api/auth' });

  if (req.query.error) return fail(String(req.query.error_description || req.query.error).slice(0, 200));

  let pending;
  try {
    pending = jwt.verify(req.cookies[OAUTH_COOKIE] || '', config.jwtSecret);
  } catch {
    return fail('Session de connexion expirée, réessayez.');
  }
  if (!req.query.code || req.query.state !== pending.state) return fail('Réponse Microsoft invalide.');

  const state = { ms: await microsoft.exchangeCode(String(req.query.code), pending.verifier) };
  const profile = await microsoft.getProfile(state);
  if (!profile.email || !domainAllowed(profile.email)) return fail('Ce compte Microsoft n’appartient pas à l’école.');

  createSession(res, { email: profile.email, name: profile.name || nameFromEmail(profile.email), provider: 'microsoft' }, state);
  res.redirect('/#/');
}));

router.post('/auth/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

module.exports = router;
