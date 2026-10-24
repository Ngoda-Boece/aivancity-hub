'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Opens a Playwright browser context that reuses the local Edge/Chrome login
 * session, so Blackboard/Aimara SSO usually passes without typing anything.
 * LOCAL USE ONLY: it opens a window on the machine running the server.
 */

function findProfiles() {
  const local = path.join(os.homedir(), 'AppData', 'Local');
  return [
    { dir: path.join(local, 'Microsoft', 'Edge', 'User Data'), channel: 'msedge' },
    { dir: path.join(local, 'Google', 'Chrome', 'User Data'), channel: 'chrome' },
  ].filter(p => fs.existsSync(p.dir));
}

function copyIfExists(src, dst) {
  try {
    if (!fs.existsSync(src)) return;
    fs.cpSync(src, dst, { recursive: true, force: true, errorOnExist: false });
  } catch { /* locked file — best effort */ }
}

/**
 * Copies only what a session needs. `Local State` holds the key that decrypts
 * cookies on Windows — without it the copied cookies are unreadable (the old
 * code missed this). Saved passwords (`Login Data`) are deliberately NOT copied.
 */
function cloneSession(profileDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-session-'));
  copyIfExists(path.join(profileDir, 'Local State'), path.join(tmp, 'Local State'));
  for (const item of ['Network', 'Cookies', 'Local Storage', 'Session Storage', 'Preferences']) {
    copyIfExists(path.join(profileDir, 'Default', item), path.join(tmp, 'Default', item));
  }
  return tmp;
}

async function openContext() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    throw new Error('Playwright non installé : npm install playwright && npx playwright install chromium');
  }

  const launch = (dir, channel) => chromium.launchPersistentContext(dir, {
    headless: false,
    channel,
    viewport: null,
    args: ['--profile-directory=Default', '--no-first-run'],
    timeout: 15000,
  });

  for (const profile of findProfiles()) {
    try {
      return { context: await launch(profile.dir, profile.channel), cleanup: () => {} };
    } catch {
      // Profile locked because the browser is open — use a session copy instead.
    }
    const tmp = cloneSession(profile.dir);
    try {
      return { context: await launch(tmp, profile.channel), cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
    } catch (err) {
      console.warn(`[scrape] ${profile.channel} session copy failed:`, err.message);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: null });
  return { context, cleanup: () => browser.close().catch(() => {}) };
}

async function waitForUrl(page, pattern, timeoutMs = 120000) {
  if (pattern.test(page.url())) return true;
  try {
    await page.waitForURL(pattern, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

module.exports = { openContext, waitForUrl };
