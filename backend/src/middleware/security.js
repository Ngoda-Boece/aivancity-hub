'use strict';

const { HttpError } = require('../lib/http');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://login.microsoftonline.com",
  "object-src 'none'",
].join('; ');

/** Hardening headers (helmet-equivalent, no dependency). */
function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

/** Minimal cookie parser (avoids the cookie-parser dependency). */
function parseCookies(req, _res, next) {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    for (const part of header.split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const key = part.slice(0, eq).trim();
      try { req.cookies[key] = decodeURIComponent(part.slice(eq + 1).trim()); } catch { /* malformed */ }
    }
  }
  next();
}

/**
 * CSRF guard for state-changing API calls. The session cookie is SameSite=Lax,
 * and on top of that every mutating request must carry a custom header, which
 * a cross-site form cannot set and a cross-origin fetch cannot send without a
 * CORS preflight that this server never approves.
 */
function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'aivancity-hub') {
    return next(new HttpError(403, 'csrf', 'Requête refusée.'));
  }
  next();
}

module.exports = { securityHeaders, parseCookies, csrfGuard };
