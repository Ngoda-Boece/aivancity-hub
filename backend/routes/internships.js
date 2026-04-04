const express = require('express');
const { authMiddleware } = require('./auth');

const router = express.Router();

router.post('/internships', authMiddleware, async (req, res) => {
  const { title, region } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Job title is required' });
  }

  const encodedTitle = encodeURIComponent(title);
  const encodedRegion = encodeURIComponent(region || '');
  const linkedInUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedTitle}${encodedRegion ? '&location=' + encodedRegion : ''}&f_TPR=r2592000`;

  // Try Playwright scraping — fall back to returning the URL if unavailable
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    return res.json({ url: linkedInUrl, results: [] });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);

    await page.goto(linkedInUrl, { waitUntil: 'domcontentloaded' });

    // Wait for job cards
    await page.waitForSelector('.jobs-search__results-list li, .base-card', { timeout: 10000 }).catch(() => {});

    const jobs = await page.$$eval(
      '.jobs-search__results-list li, .base-card',
      (cards) => cards.slice(0, 5).map(card => {
        const titleEl = card.querySelector('.base-search-card__title, h3');
        const companyEl = card.querySelector('.base-search-card__subtitle, h4');
        const locationEl = card.querySelector('.job-search-card__location, .base-search-card__metadata span');
        const dateEl = card.querySelector('time, .job-search-card__listdate');
        const linkEl = card.querySelector('a[href*="/jobs/"]');

        return {
          title: titleEl?.textContent?.trim() || '',
          company: companyEl?.textContent?.trim() || '',
          location: locationEl?.textContent?.trim() || '',
          date: dateEl?.textContent?.trim() || '',
          url: linkEl?.href || '',
        };
      }).filter(j => j.title)
    ).catch(() => []);

    return res.json({ url: linkedInUrl, results: jobs });

  } catch (err) {
    console.warn('LinkedIn scrape failed:', err.message);
    return res.json({ url: linkedInUrl, results: [] });
  } finally {
    if (browser) await browser.close();
  }
});

module.exports = router;
