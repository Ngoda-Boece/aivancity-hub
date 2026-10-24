'use strict';

/** Error carrying an HTTP status and a stable machine-readable code for the client. */
class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** fetch() with a hard timeout. */
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: options.signal || controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { HttpError, asyncRoute, fetchWithTimeout };
