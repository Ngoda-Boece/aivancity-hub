'use strict';

const { HttpError } = require('../lib/http');

function notFound(req, _res, next) {
  next(new HttpError(404, 'not_found', `Route inconnue : ${req.method} ${req.path}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err.type === 'entity.parse.failed') err = new HttpError(400, 'bad_json', 'Corps JSON invalide.');
  if (err.type === 'entity.too.large') err = new HttpError(413, 'too_large', 'Requête trop volumineuse.');

  const status = err instanceof HttpError ? err.status : 500;
  if (!(err instanceof HttpError)) console.error(`[error] ${req.method} ${req.path}:`, err);
  else if (status >= 500) console.warn(`[warn] ${req.method} ${req.path} → ${status} ${err.code}`);

  if (res.headersSent) return res.end();
  res.status(status).json({
    error: {
      code: err.code || 'internal',
      message: status >= 500 && !(err instanceof HttpError) ? 'Erreur interne du serveur.' : err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

module.exports = { notFound, errorHandler };
