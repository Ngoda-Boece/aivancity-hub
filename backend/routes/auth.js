const express = require('express');
const jwt = require('jsonwebtoken');
const { scrapeAll } = require('../scraper');

const router = express.Router();

// In-memory session cache: token -> { user, data, _smtpPassword, scrapeStatus }
const sessionCache = new Map();

function getMockData(email) {
  const raw = email.split('@')[0].replace(/[._]/g, ' ');
  const name = raw.replace(/\b\w/g, c => c.toUpperCase());
  return {
    user: { name, email, program: 'AI Engineering', year: 3, campus: 'Paris-Cachan' },
    data: {
      courses: [
        { title: 'Machine Learning', code: 'ML-301' },
        { title: 'Data Engineering', code: 'DE-201' },
        { title: 'AI Ethics', code: 'AE-101' },
        { title: 'Deep Learning', code: 'DL-401' },
      ],
      grades: [
        { course: 'Machine Learning', assignment: 'Assignment 3', score: '92/100', date: 'Jan 15' },
        { course: 'Data Engineering', assignment: 'Midterm Exam', score: '87/100', date: 'Jan 10' },
        { course: 'AI Ethics', assignment: 'Essay', score: '88/100', date: 'Dec 20' },
      ],
      attendance: { overall: '94%', present: 38, absent: 2, byCourse: [] },
      schedule: [
        { time: '09:00', duration: '2h', title: 'Machine Learning', room: '105 — Cortex', professor: 'Prof. Martin', day: '' },
        { time: '14:00', duration: '1h30', title: 'Data Engineering', room: '115 — Spark / Python', professor: 'Prof. Dupont', day: '' },
        { time: '16:00', duration: '1h', title: 'AI Ethics', room: '103 — Synapse', professor: 'Prof. Bernard', day: '' },
      ],
      events: [
        { title: 'Career Fair 2025', date: 'Jan 22', desc: 'Meet top AI companies', location: 'Main Hall' },
        { title: 'AI Hackathon', date: 'Jan 25', desc: '24-hour challenge', location: 'Tech Lab' },
      ],
      announcements: [
        { title: 'Campus Event Tomorrow', body: 'Join us for the Tech Innovation Fair at 2 PM in Building A' }
      ],
      notifications: [
        { title: 'ML Assignment Due', due: 'Tomorrow, 23:59', course: 'Machine Learning' },
        { title: 'Data Engineering Project', due: 'Jan 20, 23:59', course: 'Data Engineering' },
      ],
    }
  };
}

// Background scrape — updates the session cache when done, frontend polls for it
async function runBackgroundScrape(token, email, password) {
  const session = sessionCache.get(token);
  if (!session) return;

  session.scrapeStatus = 'running';

  try {
    const scraped = await Promise.race([
      scrapeAll(email, password),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 180000)) // 3min: login + MFA + scraping
    ]);

    const hasRealData = scraped && (
      scraped.name ||
      (scraped.courses && scraped.courses.length > 0) ||
      (scraped.schedule && scraped.schedule.length > 0)
    );

    if (!hasRealData) {
      session.scrapeStatus = 'empty';
      console.warn(`[Scrape] No data returned for ${email} — MFA may be required or selectors changed`);
      return;
    }

    // Merge real data into session, keeping mock values as fallback
    if (scraped.name) session.user.name = scraped.name;
    if (scraped.courses?.length)       session.data.courses = scraped.courses;
    if (scraped.grades?.length)        session.data.grades = scraped.grades;
    if (scraped.schedule?.length)      session.data.schedule = scraped.schedule;
    if (scraped.events?.length)        session.data.events = scraped.events;
    if (scraped.announcements?.length) session.data.announcements = scraped.announcements;
    if (scraped.notifications?.length) session.data.notifications = scraped.notifications;
    if (scraped.attendance?.overall)   session.data.attendance = scraped.attendance;

    session.scrapeStatus = 'done';
    console.log(`[Scrape] Done for ${email} — courses: ${session.data.courses.length}, schedule: ${session.data.schedule.length}`);
  } catch (err) {
    if (err.message === 'mfa_required') {
      session.scrapeStatus = 'mfa_required';
      console.warn(`[Scrape] MFA required for ${email} — cannot proceed without OTP. Using mock data.`);
    } else if (err.message.includes('Invalid')) {
      session.scrapeStatus = 'auth_error';
      console.warn(`[Scrape] Bad credentials for ${email}`);
    } else {
      session.scrapeStatus = 'failed';
      console.warn(`[Scrape] Failed for ${email}:`, err.message);
    }
  }
}

// POST /api/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!email.includes('@')) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Always return mock data immediately so the app opens instantly
  const payload = getMockData(email);

  const token = jwt.sign(
    { email: payload.user.email, name: payload.user.name },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '8h' }
  );

  sessionCache.set(token, {
    ...payload,
    _smtpPassword: password,
    scrapeStatus: 'idle',
  });

  // Fire-and-forget background scrape (only if enabled)
  if (process.env.ENABLE_SCRAPING === 'true') {
    runBackgroundScrape(token, email, password);
    // Give scraping 2 seconds head-start — if very fast, the first response has real data
    // (usually won't be ready, but no harm in checking)
  }

  return res.json({ token, ...payload, scrapeStatus: process.env.ENABLE_SCRAPING === 'true' ? 'loading' : 'mock' });
});

// GET /api/scrape-status — frontend polls this after login to get real data once ready
router.get('/scrape-status', authMiddleware, (req, res) => {
  const session = req.sessionData;
  if (!session) return res.status(404).json({ error: 'Session not found' });

  return res.json({
    scrapeStatus: session.scrapeStatus || 'idle',
    // Only send full data payload when scraping is done
    ...(session.scrapeStatus === 'done' ? {
      user: session.user,
      data: session.data,
    } : {})
  });
});

// Middleware to verify JWT and retrieve session
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = auth.slice(7);
  try {
    req.jwtPayload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.sessionData = sessionCache.get(token);
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.sessionCache = sessionCache;
