'use strict';

const express = require('express');
const config = require('../config');
const { store } = require('../services/store');
const { fetchIcs } = require('../services/schedule');
const { asyncRoute } = require('../lib/http');
const { cleanText } = require('../lib/text');

const router = express.Router();

function capabilities(req) {
  return {
    ai: Boolean(config.mistral.apiKey),
    outlook: req.user.provider === 'microsoft' && Boolean(req.session?.state?.ms),
    emailDelivery: req.user.provider === 'microsoft' || config.smtp.enabled,
    aipoints: Boolean(config.aipointsCsvUrl),
    schoolCalendar: Boolean(config.scheduleIcsUrl),
    scraping: config.enableScraping,
  };
}

router.get('/me', (req, res) => {
  const prefs = store.user(req.user.email).prefs;
  res.json({
    user: req.user,
    capabilities: capabilities(req),
    prefs: { icsUrl: prefs.icsUrl || '' },
  });
});

/** Saves the personal calendar link after checking it really is an iCal feed. */
router.put('/me/prefs', asyncRoute(async (req, res) => {
  const icsUrl = cleanText(req.body?.icsUrl, 2000);
  if (icsUrl) await fetchIcs(icsUrl);
  store.update(req.user.email, u => { u.prefs.icsUrl = icsUrl; });
  res.json({ prefs: { icsUrl } });
}));

module.exports = router;
