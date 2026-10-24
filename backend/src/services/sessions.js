'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE = 'ah_session';
const TTL_MS = config.sessionTtlHours * 3600 * 1000;

/**
 * Identity lives in a signed JWT stored in an httpOnly cookie (so page scripts
 * can never read it). Volatile server-side state — Microsoft tokens, scraped
 * data — lives in this map, keyed by the session id inside the JWT, and expires
 * with the session. Losing it on restart only degrades to "reconnect".
 */
const volatile = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [sid, s] of volatile) if (s.expires <= now) volatile.delete(sid);
}, 10 * 60 * 1000).unref();

function createSession(res, user, extra = {}) {
  const sid = crypto.randomUUID();
  const token = jwt.sign({ sid, email: user.email, name: user.name, provider: user.provider }, config.jwtSecret, {
    expiresIn: Math.floor(TTL_MS / 1000),
  });
  volatile.set(sid, { ...extra, expires: Date.now() + TTL_MS });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: TTL_MS,
    path: '/',
  });
  return sid;
}

function readSession(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return {
      sid: payload.sid,
      user: { email: payload.email, name: payload.name, provider: payload.provider },
      state: volatile.get(payload.sid) || null,
    };
  } catch {
    return null;
  }
}

function sessionState(sid) {
  let s = volatile.get(sid);
  if (!s) {
    s = { expires: Date.now() + TTL_MS };
    volatile.set(sid, s);
  }
  return s;
}

function destroySession(req, res) {
  const s = readSession(req);
  if (s) volatile.delete(s.sid);
  res.clearCookie(COOKIE, { path: '/' });
}

module.exports = { createSession, readSession, sessionState, destroySession, COOKIE };
