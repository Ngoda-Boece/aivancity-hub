'use strict';

const { readSession } = require('../services/sessions');
const { HttpError } = require('../lib/http');

/** Attaches req.user / req.session when a valid session cookie is present. */
function loadSession(req, _res, next) {
  const s = readSession(req);
  if (s) {
    req.user = s.user;
    req.session = s;
  }
  next();
}

function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'unauthenticated', 'Session expirée, reconnectez-vous.'));
  next();
}

module.exports = { loadSession, requireAuth };
