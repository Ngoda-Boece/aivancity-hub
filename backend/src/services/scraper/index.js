'use strict';

const { openContext, waitForUrl } = require('./browser');
const { zonedToUtc } = require('../../lib/ics');

const BB = 'https://aivancity.blackboard.com';
const AIMARA = 'https://aivancity.myintranet.online';

async function scrapeBlackboard(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    await page.goto(`${BB}/ultra/course`, { waitUntil: 'domcontentloaded' });
    if (!(await waitForUrl(page, /blackboard\.com\/ultra/))) return {};

    const name = await page.$eval('[class*="userDisplayName"], [class*="user-display-name"], [data-displayname]', el => el.textContent.trim()).catch(() => '');

    await page.waitForSelector('[class*="courseTile"], [class*="course-card"]', { timeout: 10000 }).catch(() => {});
    const courses = await page.$$eval('[class*="courseTile"], [class*="course-card"]', els => els.slice(0, 20).map(el => ({
      title: (el.querySelector('[class*="courseName"], h4, h3') || el).textContent.trim().slice(0, 100),
      code: (el.querySelector('[class*="courseId"], [class*="code"]')?.textContent || '').trim(),
    })).filter(c => c.title)).catch(() => []);

    await page.goto(`${BB}/ultra/stream`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="streamItem"], [class*="stream-item"]', { timeout: 10000 }).catch(() => {});
    const stream = await page.$$eval('[class*="streamItem"], [class*="stream-item"]', els => els.slice(0, 30).map(el => ({
      course: (el.querySelector('[class*="courseName"], [class*="course"]')?.textContent || '').trim(),
      title: (el.querySelector('[class*="itemName"], h4, [class*="title"]')?.textContent || '').trim(),
      grade: (el.querySelector('[class*="grade"], [class*="score"]')?.textContent || '').trim(),
      date: el.querySelector('time')?.getAttribute('datetime') || '',
      text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 300),
    })).filter(i => i.title)).catch(() => []);

    const grades = stream.filter(i => i.grade).map(i => ({ course: i.course, item: i.title, scoreText: i.grade, date: i.date }));
    const deadlines = stream.filter(i => /\b(due|échéance|à rendre|dû)\b/i.test(i.text))
      .map((i, n) => ({ id: `bb-${n}`, title: i.title, course: i.course, due: i.date || null }));

    return { name, courses, grades, deadlines };
  } finally {
    await page.close().catch(() => {});
  }
}

function toEvent(raw) {
  const date = raw.date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const times = raw.time?.match(/(\d{1,2})[:h](\d{2})\D+(\d{1,2})[:h](\d{2})/);
  if (!date || !times) return null;
  const [y, mo, d] = [+date[1], +date[2] - 1, +date[3]];
  const start = zonedToUtc(y, mo, d, +times[1], +times[2], 0, 'Europe/Paris');
  const end = zonedToUtc(y, mo, d, +times[3], +times[4], 0, 'Europe/Paris');
  return { id: `aimara-${start}-${raw.title}`, title: raw.title, start: new Date(start).toISOString(), end: new Date(end).toISOString(), location: raw.location, description: '', allDay: false };
}

async function scrapeAimara(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    await page.goto(`${AIMARA}/Calendar`, { waitUntil: 'domcontentloaded' });
    if (!(await waitForUrl(page, /myintranet\.online\/(Calendar|Home|Dashboard)/))) return {};
    if (!page.url().includes('/Calendar')) await page.goto(`${AIMARA}/Calendar`, { waitUntil: 'networkidle' });

    await page.waitForSelector('.fc-event', { timeout: 10000 }).catch(() => {});
    const raw = await page.$$eval('.fc-event', els => els.slice(0, 80).map(el => {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      return {
        title: (el.querySelector('.fc-title, .fc-event-title')?.textContent || text).trim().slice(0, 100),
        time: (el.querySelector('.fc-time, .fc-event-time')?.textContent || text),
        date: el.closest('[data-date]')?.getAttribute('data-date') || '',
        location: (text.match(/\b1\d{2}\b/) || [''])[0],
      };
    })).catch(() => []);

    return { schedule: raw.map(toEvent).filter(Boolean) };
  } finally {
    await page.close().catch(() => {});
  }
}

let running = null;

/** Scrapes Blackboard + Aimara once; concurrent callers share the same run. */
function scrapeAll() {
  if (running) return running;
  running = (async () => {
    const { context, cleanup } = await openContext();
    try {
      const [bb, aimara] = await Promise.allSettled([scrapeBlackboard(context), scrapeAimara(context)]);
      if (bb.status === 'rejected') console.warn('[scrape] Blackboard:', bb.reason?.message);
      if (aimara.status === 'rejected') console.warn('[scrape] Aimara:', aimara.reason?.message);
      return { ...(bb.value || {}), ...(aimara.value || {}) };
    } finally {
      await context.close().catch(() => {});
      cleanup();
    }
  })().finally(() => { running = null; });
  return running;
}

module.exports = { scrapeAll, toEvent };
