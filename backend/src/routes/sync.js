'use strict';

const express = require('express');
const config = require('../config');
const { sessionState } = require('../services/sessions');
const { HttpError } = require('../lib/http');

const router = express.Router();

/**
 * Optional local sync with Blackboard + Aimara via the scraper. Only enabled
 * with ENABLE_SCRAPING=true, which only makes sense when the server runs on
 * the student's own computer (it opens a browser window there).
 */
router.post('/sync', (req, res) => {
  if (!config.enableScraping) throw new HttpError(404, 'sync_disabled', 'Synchronisation locale désactivée.');
  const state = sessionState(req.session.sid);
  if (state.scrape?.status === 'running') return res.status(202).json({ status: 'running' });

  state.scrape = { ...state.scrape, status: 'running', startedAt: Date.now() };
  const { scrapeAll } = require('../services/scraper');
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4 * 60 * 1000));

  Promise.race([scrapeAll(), timeout])
    .then(data => {
      const useful = data && (data.courses?.length || data.schedule?.length || data.grades?.length);
      state.scrape = { status: useful ? 'done' : 'empty', data: useful ? data : state.scrape?.data, finishedAt: Date.now() };
    })
    .catch(err => {
      console.warn('[sync] failed:', err.message);
      state.scrape = { ...state.scrape, status: 'failed', error: err.message, finishedAt: Date.now() };
    });

  res.status(202).json({ status: 'running' });
});

router.get('/sync', (req, res) => {
  const s = req.session?.state?.scrape;
  res.json({ enabled: config.enableScraping, status: s?.status || 'idle', finishedAt: s?.finishedAt || null });
});

module.exports = router;
