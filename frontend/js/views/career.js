import { html, mount, $, on, formData, setBusy, safeUrl, showFieldErrors } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { storage, userKey } from '../core/state.js';
import { api } from '../core/api.js';
import * as f from '../core/format.js';
import { emptyState } from '../components/bits.js';
import { toast } from '../components/toast.js';

export default function careerView({ container }) {
  const savedKey = userKey('jobs:saved');
  const lastKey = userKey('jobs:last');
  const last = storage.get(lastKey, { query: 'Data Scientist', location: 'Paris', type: 'internship' });
  let results = [];

  mount(container, html`
    <header class="page-head">
      <div><span class="eyebrow"><span class="dot"></span>${t('career.eyebrow')}</span><h1>${t('nav.career')}</h1><p>${t('career.lede')}</p></div>
    </header>

    <section class="card search-card">
      <form class="job-search" data-form novalidate>
        <div class="field"><label for="jq">${t('career.query')}</label>
          <input class="input" id="jq" name="query" value="${last.query}" placeholder="${t('career.queryPh')}" maxlength="100" required></div>
        <div class="field"><label for="jl">${t('career.location')}</label>
          <input class="input" id="jl" name="location" value="${last.location}" placeholder="Paris, Lyon, Remote…" maxlength="100"></div>
        <div class="field"><span class="label">${t('career.type')}</span>
          <div class="segmented" data-types>
            ${['internship', 'apprenticeship', 'any'].map(k => html`<button type="button" data-type="${k}" aria-pressed="${last.type === k}">${t(`career.types.${k}`)}</button>`)}
          </div></div>
        <button class="btn btn-primary btn-lg" type="submit">${icon('search')}${t('career.search')}</button>
      </form>
    </section>

    <div class="career-layout">
      <section>
        <div class="card-head" style="margin:24px 0 12px"><h2 data-results-title>${t('career.results')}</h2></div>
        <div data-results>${emptyState('briefcase', t('career.startTitle'), t('career.startBody'))}</div>
      </section>
      <aside>
        <section class="card" style="margin-top:24px">
          <div class="card-head"><h3>${t('career.boards')}</h3></div>
          <div class="rows" data-boards><p class="muted">${t('career.boardsHint')}</p></div>
        </section>
        <section class="card" style="margin-top:16px">
          <div class="card-head"><h3>${t('career.saved')}</h3></div>
          <div data-saved></div>
        </section>
        <section class="card card-ink" style="margin-top:16px">
          <h3>${t('career.coachTitle')}</h3>
          <p class="muted" style="margin:8px 0 16px">${t('career.coachBody')}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn btn-accent btn-sm" href="#/assistant/career">${icon('briefcase')}${t('career.coachCv')}</a>
            <a class="btn btn-sm" href="#/assistant/interview">${icon('mic')}${t('career.coachInterview')}</a>
          </div>
        </section>
      </aside>
    </div>`);

  let type = last.type;
  const form = $('[data-form]', container);

  const renderSaved = () => {
    const saved = storage.get(savedKey, []);
    mount($('[data-saved]', container), saved.length ? html`<div class="rows">${saved.map(j => html`
      <div class="row"><div class="row-main"><a class="row-title" href="${safeUrl(j.url)}" target="_blank" rel="noopener" style="display:block">${j.title}</a><div class="row-sub">${j.company}</div></div>
      <button class="btn btn-ghost icon-btn btn-sm" data-unsave="${j.url}" aria-label="${t('common.delete')}">${icon('x')}</button></div>`)}</div>`
      : html`<p class="muted">${t('career.noSaved')}</p>`);
  };

  const renderResults = data => {
    const saved = new Set(storage.get(savedKey, []).map(j => j.url));
    $('[data-results-title]', container).textContent = t('career.resultsN', { n: data.results.length });
    mount($('[data-boards]', container), data.boards.map(b => html`
      <a class="row" href="${safeUrl(b.url)}" target="_blank" rel="noopener"><div class="row-main"><div class="row-title">${b.name}</div></div>${icon('arrowUpRight')}</a>`));
    mount($('[data-results]', container), html`
      ${data.warning ? html`<div class="notice notice-warn" style="margin-bottom:12px">${icon('info')}<div>${t('career.linkedinDown')}</div></div>` : ''}
      ${data.results.length ? html`<div class="job-list">${data.results.map((j, i) => html`
        <article class="job card">
          <div class="job-logo">${(j.company || '?').slice(0, 1).toUpperCase()}</div>
          <div class="job-main">
            <h3><a href="${safeUrl(j.url)}" target="_blank" rel="noopener">${j.title}</a></h3>
            <p>${j.company}</p>
            <div class="job-tags">
              ${j.location ? html`<span class="badge">${icon('pin')}${j.location}</span>` : ''}
              ${j.postedAt ? html`<span class="badge">${icon('clock')}${f.relative(j.postedAt)}</span>` : ''}
              <span class="badge badge-cobalt">${j.source}</span>
            </div>
          </div>
          <div class="job-actions">
            <button class="btn btn-ghost icon-btn" data-save="${i}" aria-pressed="${saved.has(j.url)}" aria-label="${t('career.save')}">${icon(saved.has(j.url) ? 'check' : 'plus')}</button>
            <a class="btn btn-sm" href="${safeUrl(j.url)}" target="_blank" rel="noopener">${t('career.view')} ${icon('arrowUpRight')}</a>
          </div>
        </article>`)}</div>` : emptyState('search', t('career.noResults'), t('career.noResultsBody'))}`);
  };

  async function search() {
    const values = { ...formData(form), type };
    storage.set(lastKey, values);
    const btn = $('button[type=submit]', form);
    setBusy(btn, true);
    mount($('[data-results]', container), html`<div class="job-list">${[1, 2, 3].map(() => html`<div class="card"><div class="skeleton" style="height:64px"></div></div>`)}</div>`);
    try {
      const data = await api.post('/jobs/search', values);
      results = data.results;
      renderResults(data);
    } catch (err) {
      if (err.details) showFieldErrors(form, err.details);
      mount($('[data-results]', container), emptyState('alert', t('errors.loadTitle'), err.message));
    } finally {
      setBusy(btn, false);
    }
  }

  form.addEventListener('submit', e => { e.preventDefault(); search(); });
  on(container, 'click', '[data-type]', (_e, b) => {
    type = b.dataset.type;
    container.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  on(container, 'click', '[data-save]', (_e, b) => {
    const job = results[+b.dataset.save];
    let saved = storage.get(savedKey, []);
    const exists = saved.some(j => j.url === job.url);
    saved = exists ? saved.filter(j => j.url !== job.url) : [{ title: job.title, company: job.company, url: job.url }, ...saved].slice(0, 30);
    storage.set(savedKey, saved);
    b.setAttribute('aria-pressed', String(!exists));
    mount(b, icon(exists ? 'plus' : 'check'));
    if (!exists) toast(t('career.savedToast'), { type: 'ok', timeout: 1800 });
    renderSaved();
  });
  on(container, 'click', '[data-unsave]', (_e, b) => {
    storage.set(savedKey, storage.get(savedKey, []).filter(j => j.url !== b.dataset.unsave));
    renderSaved();
  });

  renderSaved();
}
