'use strict';

const { HttpError } = require('./http');

/**
 * Fixed-window in-memory rate limiter. Keyed by authenticated user when
 * available, otherwise by IP. Good enough for a single instance.
 */
function rateLimit({ windowMs, max, name = 'default' }) {
  const hits = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const key = `${name}:${req.user?.email || req.ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - entry.count));
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
      return next(new HttpError(429, 'rate_limited', 'Trop de requêtes, réessayez dans un instant.'));
    }
    next();
  };
}

module.exports = { rateLimit };
