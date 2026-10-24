'use strict';

const path = require('path');
const express = require('express');
const config = require('./config');
const { securityHeaders, parseCookies, csrfGuard } = require('./middleware/security');
const { loadSession, requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');

const FRONTEND = path.join(__dirname, '..', '..', 'frontend');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(parseCookies);

  const api = express.Router();
  api.use(express.json({ limit: '200kb' }));
  api.use(csrfGuard);
  api.use(loadSession);
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  api.get('/health', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));
  api.use(require('./routes/auth'));

  api.use(requireAuth);
  api.use(require('./routes/me'));
  api.use(require('./routes/data'));
  api.use(require('./routes/chat'));
  api.use(require('./routes/bookings'));
  api.use(require('./routes/jobs'));
  api.use(require('./routes/sync'));

  api.use(notFound);
  app.use('/api', api);

  app.use(express.static(FRONTEND, {
    index: 'index.html',
    setHeaders(res, file) {
      // HTML must revalidate so new deploys are picked up; assets can be cached briefly.
      res.setHeader('Cache-Control', file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600');
    },
  }));
  app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND, 'index.html')));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
