'use strict';

const { TtlCache } = require('../lib/cache');
const { fetchWithTimeout } = require('../lib/http');

/**
 * Job / internship search. Uses LinkedIn's public guest listing endpoint (plain
 * HTTP, no headless browser) and always returns ready-made search links for
 * other French job boards, so the feature works even when LinkedIn blocks us.
 */

const cache = new TtlCache(10 * 60 * 1000, 200);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const text = s => decode(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const grab = (html, re) => (html.match(re) || [])[1] || '';

function parseLinkedIn(html) {
  return html.split(/<li[\s>]/).slice(1).map(card => {
    const url = decode(grab(card, /class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/) || grab(card, /href="(https:\/\/[a-z.]*linkedin\.com\/jobs\/view\/[^"]+)"/));
    return {
      title: text(grab(card, /class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/)),
      company: text(grab(card, /class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/)),
      location: text(grab(card, /class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/)),
      postedAt: grab(card, /<time[^>]*datetime="([^"]+)"/),
      url: url.split('?')[0],
      source: 'LinkedIn',
    };
  }).filter(j => j.title && /^https:\/\/([a-z]+\.)?linkedin\.com\//.test(j.url));
}

const CONTRACT = {
  internship: { kw: 'stage', linkedin: { f_JT: 'I' }, wttj: 'internship', indeed: 'stage' },
  apprenticeship: { kw: 'alternance', linkedin: { f_JT: 'O' }, wttj: 'apprenticeship', indeed: 'apprentissage' },
  any: { kw: '', linkedin: {}, wttj: '', indeed: '' },
};

function boardLinks(query, location, type) {
  const c = CONTRACT[type] || CONTRACT.any;
  const kw = [query, c.kw].filter(Boolean).join(' ');
  const e = encodeURIComponent;
  return [
    { name: 'LinkedIn', url: `https://www.linkedin.com/jobs/search/?keywords=${e(query)}&location=${e(location)}&f_TPR=r2592000${c.linkedin.f_JT ? `&f_JT=${c.linkedin.f_JT}` : ''}` },
    { name: 'Welcome to the Jungle', url: `https://www.welcometothejungle.com/fr/jobs?query=${e(query)}${c.wttj ? `&refinementList%5Bcontract_type%5D%5B%5D=${c.wttj}` : ''}${location ? `&aroundQuery=${e(location)}` : ''}` },
    { name: 'Indeed', url: `https://fr.indeed.com/jobs?q=${e(kw)}&l=${e(location)}` },
    { name: 'HelloWork', url: `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${e(kw)}&l=${e(location)}` },
    { name: 'APEC', url: `https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles=${e(kw)}` },
  ];
}

async function searchLinkedIn(query, location, type) {
  const c = CONTRACT[type] || CONTRACT.any;
  const params = new URLSearchParams({ keywords: query, location: location || 'France', f_TPR: 'r2592000', start: '0', ...c.linkedin });
  const res = await fetchWithTimeout(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' },
  }, 8000);
  if (!res.ok) throw new Error(`LinkedIn HTTP ${res.status}`);
  return parseLinkedIn(await res.text()).slice(0, 15);
}

async function searchJobs({ query, location, type }) {
  const key = JSON.stringify([query.toLowerCase(), location.toLowerCase(), type]);
  return cache.wrap(key, async () => {
    let results = [];
    let warning = null;
    try {
      results = await searchLinkedIn(query, location, type);
    } catch (err) {
      console.warn('[jobs] LinkedIn search failed:', err.message);
      warning = 'linkedin_unavailable';
    }
    return { results, warning, boards: boardLinks(query, location, type) };
  });
}

module.exports = { searchJobs, parseLinkedIn, boardLinks };
