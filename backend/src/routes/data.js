'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../config');
const { getSchedule } = require('../services/schedule');
const { getStandings } = require('../services/aipoints');
const { asyncRoute, HttpError } = require('../lib/http');
const { demoAcademics, demoEvents, DEMO_ANNOUNCEMENTS } = require('../data/demo');
const { ROOMS, CONTACTS, LINKS, CAMPUS, AIPOINTS } = require('../data/campus');
const { publicBots } = require('../data/bots');

const router = express.Router();
const DAY = 86400000;

/**
 * Optional admin-maintained content: drop events.json / announcements.json in
 * DATA_DIR to replace the demo ones (see README for the format).
 */
function readContent(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(config.dataDir, file), 'utf8'));
  } catch {
    return null;
  }
}

router.get('/campus', (_req, res) => {
  res.set('Cache-Control', 'private, max-age=300');
  res.json({ campus: CAMPUS, rooms: ROOMS, contacts: CONTACTS, links: LINKS, aipoints: AIPOINTS, bots: publicBots(), bdeEmail: config.bdeEmail });
});

router.get('/schedule', asyncRoute(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - DAY);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 14 * DAY);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to - from > 93 * DAY) {
    throw new HttpError(400, 'bad_range', 'Période invalide (93 jours maximum).');
  }
  res.json(await getSchedule(req, from, to));
}));

router.get('/dashboard', (req, res) => {
  const scraped = req.session?.state?.scrape?.data;
  const hasScraped = Boolean(scraped && (scraped.courses?.length || scraped.grades?.length));
  const now = Date.now();

  const academics = hasScraped
    ? { demo: false, source: 'blackboard', courses: scraped.courses || [], grades: scraped.grades || [], deadlines: scraped.deadlines || [], attendance: null }
    : { ...demoAcademics(), source: 'demo' };

  const customEvents = readContent('events.json');
  const events = (Array.isArray(customEvents) ? customEvents : demoEvents())
    .filter(e => new Date(e.end || e.start).getTime() >= now)
    .sort((a, b) => a.start.localeCompare(b.start));

  const customAnn = readContent('announcements.json');
  res.json({
    academics,
    events,
    eventsDemo: !Array.isArray(customEvents),
    announcements: Array.isArray(customAnn) ? customAnn : DEMO_ANNOUNCEMENTS,
  });
});

router.get('/aipoints', asyncRoute(async (req, res) => {
  res.json(await getStandings(req.user));
}));

module.exports = router;
