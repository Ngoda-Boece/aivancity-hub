/**
 * scraper.js — Scrapes Blackboard and Aimara using the user's real browser session.
 *
 * Strategy (in order):
 * 1. Try Edge live profile (Edge-first since Windows 11 default)
 * 2. Try Chrome live profile
 * 3. If profile is locked (browser running), clone session cookies to a temp dir and use that
 * 4. Final fallback: fresh Playwright browser (user authenticates manually)
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const ROOM_MAP = {
  '101': 'Singularity',    '102': 'Silent room',    '103': 'Synapse',
  '104': 'Quantum',        '105': 'Cortex',          '106': 'Vector',
  '107': 'AI Clinic',      '108': 'Nexus',           '109': 'Parity',
  '112': 'Tensor',         '113': 'Keras / Prolog',  '114': 'Hadoop / Scala',
  '115': 'Spark / Python', '116': 'IT Room',         '117': 'Aurora',
  '118': 'Storm',          '119': 'Ethos',
};

function resolveRoom(raw) {
  if (!raw) return raw;
  const m = raw.match(/\b(\d{3})\b/);
  return m && ROOM_MAP[m[1]] ? `${m[1]} — ${ROOM_MAP[m[1]]}` : raw;
}

// Returns all browser profiles found on this machine, Edge first (Windows 11 default)
function findBrowserProfiles() {
  const user = os.userInfo().username;
  const home = os.homedir();

  const candidates = [
    // Edge — default browser on Windows 11
    { dir: `C:\\Users\\${user}\\AppData\\Local\\Microsoft\\Edge\\User Data`, channel: 'msedge' },
    { dir: path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data'), channel: 'msedge' },
    // Chrome
    { dir: `C:\\Users\\${user}\\AppData\\Local\\Google\\Chrome\\User Data`, channel: 'chrome' },
    { dir: path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'), channel: 'chrome' },
  ];

  // Deduplicate by dir path, keep only existing ones
  const seen = new Set();
  return candidates.filter(c => {
    if (seen.has(c.dir) || !fs.existsSync(c.dir)) return false;
    seen.add(c.dir);
    return true;
  });
}

// Copy a file or directory recursively (best-effort — skips locked files)
function copySync(src, dst) {
  try {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        copySync(path.join(src, entry), path.join(dst, entry));
      }
    } else {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  } catch {
    // Silently skip locked/inaccessible files
  }
}

/**
 * Clone only the session-relevant files from a browser profile to a temp dir.
 * This lets Playwright open a new browser instance with the same cookies/sessions
 * even when the real browser is already running (and has the profile locked).
 */
function cloneProfileSession(profileDir) {
  const tmp = path.join(os.tmpdir(), `pw-session-${Date.now()}`);
  const srcDef = path.join(profileDir, 'Default');
  const dstDef = path.join(tmp, 'Default');

  // These files/folders carry authentication state
  const sessionItems = [
    'Cookies',
    path.join('Network', 'Cookies'),
    'Local Storage',
    'Session Storage',
    'Extension Cookies',
    'Login Data',
  ];

  for (const item of sessionItems) {
    const src = path.join(srcDef, item);
    if (fs.existsSync(src)) {
      copySync(src, path.join(dstDef, item));
    }
  }

  console.log(`[Scrape] Cloned session data to ${tmp}`);
  return tmp;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────────────────────────────────────
async function scrapeAll(email, _password) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    throw new Error('Playwright not installed. Run: npx playwright install chromium');
  }

  const profiles = findBrowserProfiles();
  let context = null;
  let tmpProfileDir = null;

  // Try each profile: first live, then cloned session
  for (const profile of profiles) {
    // 1. Try the live profile directly (works if browser isn't running)
    try {
      context = await chromium.launchPersistentContext(profile.dir, {
        headless: false,
        channel: profile.channel,
        args: ['--profile-directory=Default', '--start-maximized', '--no-first-run'],
        ignoreDefaultArgs: ['--enable-automation'],
        timeout: 15000,
      });
      console.log(`[Scrape] Using live ${profile.channel} profile at ${profile.dir}`);
      break;
    } catch (e) {
      console.warn(`[Scrape] Live ${profile.channel} profile locked (browser running) — trying session clone...`);
    }

    // 2. Browser is running → clone session data to a temp dir
    try {
      tmpProfileDir = cloneProfileSession(profile.dir);
      context = await chromium.launchPersistentContext(tmpProfileDir, {
        headless: false,
        channel: profile.channel,
        args: ['--profile-directory=Default', '--start-maximized', '--no-first-run'],
        ignoreDefaultArgs: ['--enable-automation'],
        timeout: 15000,
      });
      console.log(`[Scrape] Using cloned ${profile.channel} session (temp dir)`);
      break;
    } catch (e) {
      console.warn(`[Scrape] Cloned ${profile.channel} session also failed:`, e.message);
      if (tmpProfileDir) {
        fs.rmSync(tmpProfileDir, { recursive: true, force: true });
        tmpProfileDir = null;
      }
    }
  }

  // 3. Final fallback: fresh visible browser — user authenticates manually
  if (!context) {
    console.warn('[Scrape] All profiles failed — launching fresh browser for manual auth');
    const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
    context = await browser.newContext({ viewport: null });
  }

  try {
    const [bbResult, aimaraResult] = await Promise.allSettled([
      scrapeBlackboard(context),
      scrapeAimara(context),
    ]);

    const bb     = bbResult.status     === 'fulfilled' ? bbResult.value     : {};
    const aimara = aimaraResult.status === 'fulfilled' ? aimaraResult.value : {};

    if (bbResult.status === 'rejected')     console.warn('[Scrape] Blackboard error:', bbResult.reason?.message);
    if (aimaraResult.status === 'rejected') console.warn('[Scrape] Aimara error:', aimaraResult.reason?.message);

    return { ...bb, ...aimara };
  } finally {
    await context.close().catch(() => {});
    // Clean up temp profile dir if we created one
    if (tmpProfileDir) {
      fs.rmSync(tmpProfileDir, { recursive: true, force: true });
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Wait for login to complete (handles any auth flow — SSO, MFA, etc.)
// ──────────────────────────────────────────────────────────────────────────────
async function waitForAuthentication(page, targetPattern, timeoutMs = 90000) {
  const already = page.url().match(targetPattern);
  if (already) return;

  console.log('[Scrape] Waiting for user to complete authentication in the browser window...');
  try {
    await page.waitForURL(targetPattern, { timeout: timeoutMs });
  } catch {
    console.warn('[Scrape] Auth wait timed out — will try to scrape whatever is loaded');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Blackboard
// ──────────────────────────────────────────────────────────────────────────────
async function scrapeBlackboard(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    await page.goto('https://aivancity.blackboard.com/ultra/course', { waitUntil: 'domcontentloaded' });

    if (!page.url().includes('blackboard.com/ultra')) {
      const ssoBtn = await page.$('a[href*="saml"], a[href*="sso"], [data-bb-handler], a:text-matches("aivancity|Connexion|institution", "i")').catch(() => null);
      if (ssoBtn) {
        await ssoBtn.click();
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      }
      await waitForAuthentication(page, /blackboard\.com\/ultra/);
    }

    console.log('[Scrape] On Blackboard, scraping...');

    // ── Student name ──
    let name = '';
    try {
      name = await page.$eval(
        '[data-displayname], .user-display-name, [aria-label*="profile"] span, [class*="userName"], [class*="userDisplayName"]',
        el => el.textContent.trim()
      );
    } catch {}

    // ── Courses ──
    let courses = [];
    try {
      await page.waitForSelector('[class*="courseTile"], [class*="course-card"], [class*="base-courses"]', { timeout: 8000 });
      courses = await page.$$eval(
        '[class*="courseTile"], [class*="course-card"]',
        els => els.slice(0, 12).map(el => ({
          title: (el.querySelector('[class*="courseName"], [class*="title"], h4, h3') || el).textContent.trim().slice(0, 80),
          code: (el.querySelector('[class*="courseId"], [class*="code"]') || { textContent: '' }).textContent.trim(),
        })).filter(c => c.title)
      );
    } catch {}

    // ── Grades ──
    let grades = [];
    try {
      await page.goto('https://aivancity.blackboard.com/ultra/activity-stream', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[class*="streamItem"]', { timeout: 8000 });
      grades = await page.$$eval('[class*="streamItem"]', els =>
        els.slice(0, 10).map(el => ({
          course: (el.querySelector('[class*="courseName"]') || { textContent: '' }).textContent.trim(),
          assignment: (el.querySelector('[class*="itemName"], h4') || { textContent: '' }).textContent.trim(),
          score: (el.querySelector('[class*="grade"], [class*="score"]') || { textContent: '' }).textContent.trim(),
          date: (el.querySelector('time, [class*="date"]') || { textContent: '' }).textContent.trim(),
        })).filter(g => g.assignment)
      );
    } catch {}

    // ── Notifications ──
    let notifications = [];
    try {
      notifications = await page.$$eval('[class*="streamItem"]', els =>
        els.filter(el => el.textContent.includes('due') || el.textContent.includes('dû')).slice(0, 8)
          .map(el => ({
            title: (el.querySelector('h4, [class*="title"]') || { textContent: '' }).textContent.trim(),
            due: (el.querySelector('time, [class*="due"]') || { textContent: '' }).textContent.trim(),
            course: (el.querySelector('[class*="course"]') || { textContent: '' }).textContent.trim(),
          })).filter(n => n.title)
      );
    } catch {}

    // ── Announcements ──
    let announcements = [];
    try {
      await page.goto('https://aivancity.blackboard.com/ultra/stream', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[class*="announcement"]', { timeout: 6000 });
      announcements = await page.$$eval('[class*="announcement"]', els =>
        els.slice(0, 3).map(el => ({
          title: (el.querySelector('h3, h4, [class*="title"]') || { textContent: '' }).textContent.trim(),
          body: (el.querySelector('p, [class*="body"]') || { textContent: '' }).textContent.trim(),
        })).filter(a => a.title)
      );
    } catch {}

    return { name, courses, grades, notifications, announcements };
  } finally {
    await page.close().catch(() => {});
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Aimara Intranet
// ──────────────────────────────────────────────────────────────────────────────
async function scrapeAimara(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    await page.goto('https://aivancity.myintranet.online/Calendar', { waitUntil: 'domcontentloaded' });

    if (!page.url().includes('myintranet.online/Calendar') && !page.url().includes('myintranet.online/Home')) {
      const ssoBtn = await page.$('a[href*="microsoft"], a[href*="azure"], a[href*="sso"], a:text-matches("Microsoft|aivancity|Connect", "i")').catch(() => null);
      if (ssoBtn) {
        await ssoBtn.click();
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      }
      await waitForAuthentication(page, /myintranet\.online\/(Calendar|Home|Dashboard)/);
    }

    if (!page.url().includes('/Calendar')) {
      await page.goto('https://aivancity.myintranet.online/Calendar', { waitUntil: 'networkidle' });
    }

    console.log('[Scrape] On Aimara, scraping schedule...');

    // ── Schedule ──
    let schedule = [];
    try {
      await page.waitForSelector('.fc-event, [class*="event"], [class*="calendar-item"]', { timeout: 8000 });
      schedule = await page.$$eval('.fc-event, [class*="event"]', (els, roomMap) =>
        els.slice(0, 30).map(el => {
          const timeEl = el.querySelector('.fc-time, [class*="time"]');
          const titleEl = el.querySelector('.fc-title, [class*="title"]');
          const text = el.textContent || '';
          const roomMatch = text.match(/\b(\d{3})\b/);
          const rawRoom = roomMatch ? roomMatch[1] : '';
          return {
            time: timeEl ? timeEl.textContent.trim() : '',
            title: titleEl ? titleEl.textContent.trim() : text.trim().slice(0, 60),
            room: rawRoom ? (roomMap[rawRoom] ? `${rawRoom} — ${roomMap[rawRoom]}` : rawRoom) : '',
            professor: '',
            duration: '2h',
            day: el.closest('[data-date]')?.getAttribute('data-date') || '',
          };
        }).filter(s => s.title),
        ROOM_MAP
      );
    } catch {}

    // ── Events ──
    let events = [];
    try {
      await page.goto('https://aivancity.myintranet.online/Events', { waitUntil: 'networkidle' });
      await page.waitForSelector('[class*="event-card"], [class*="event-item"], article', { timeout: 6000 });
      events = await page.$$eval('[class*="event-card"], [class*="event-item"], article', els =>
        els.slice(0, 8).map(el => ({
          title: (el.querySelector('h3, h4, [class*="title"]') || { textContent: '' }).textContent.trim(),
          date: (el.querySelector('time, [class*="date"]') || { textContent: '' }).textContent.trim(),
          desc: (el.querySelector('p, [class*="desc"]') || { textContent: '' }).textContent.trim().slice(0, 120),
          location: (el.querySelector('[class*="location"]') || { textContent: '' }).textContent.trim(),
        })).filter(e => e.title)
      );
    } catch {}

    return { schedule, events };
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrapeAll, ROOM_MAP };
