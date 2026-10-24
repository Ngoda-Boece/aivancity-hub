import { html, mount, $, on } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, pick } from '../core/i18n.js';
import { state } from '../core/state.js';
import { api } from '../core/api.js';
import * as f from '../core/format.js';
import { demoBadge, skeletonRows, emptyState, errorState, pointsLevel } from '../components/bits.js';

const mailto = (to, subject, body) => `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

function googleCalUrl(ev) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates: `${stamp(ev.start)}/${stamp(ev.end || ev.start)}`, details: ev.description || '', location: ev.location || '' });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export default function lifeView({ container }) {
  const { aipoints, bdeEmail } = state.campus;
  const name = state.user.name;

  const bdeActions = [
    { key: 'join', icon: 'users', subject: t('life.bde.joinSubject'), body: t('life.bde.joinBody', { name }) },
    { key: 'event', icon: 'party', subject: t('life.bde.eventSubject'), body: t('life.bde.eventBody', { name }) },
    { key: 'club', icon: 'sparkles', subject: t('life.bde.clubSubject'), body: t('life.bde.clubBody', { name }) },
  ];

  mount(container, html`
    <header class="page-head">
      <div><span class="eyebrow"><span class="dot"></span>${t('life.eyebrow')}</span><h1>${t('nav.life')}</h1><p>${t('life.lede')}</p></div>
    </header>

    <section style="margin-bottom:32px">
      <div class="card-head"><h2>${t('life.events')}</h2><span data-events-badge></span></div>
      <div data-events>${skeletonRows(3)}</div>
    </section>

    <section class="card card-accent bde-card" style="margin-bottom:32px">
      <div class="bde-intro">
        <span class="eyebrow" style="color:#fff">BDE</span>
        <h2>${t('life.bde.title')}</h2>
        <p>${t('life.bde.body')}</p>
      </div>
      <div class="bde-actions">
        ${bdeActions.map(a => html`
          <a class="bde-action" href="${mailto(bdeEmail, a.subject, a.body)}">
            ${icon(a.icon)}<span><b>${t(`life.bde.${a.key}`)}</b><small>${t(`life.bde.${a.key}Hint`)}</small></span>${icon('arrowUpRight')}
          </a>`)}
      </div>
    </section>

    <section id="points">
      <div class="card-head"><h2>AI Points</h2></div>
      <div class="grid points-layout">
        <div class="card card-lime" data-me>${skeletonRows(1)}</div>
        <div class="card" data-board>${skeletonRows(4)}</div>
      </div>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="card">
          <div class="card-head"><h3>${t('points.earn')}</h3></div>
          <div class="rows">${aipoints.earn.map(e => html`
            <div class="row"><span class="badge badge-ink mono">+${e.pts}</span><div class="row-main">${pick(e.label)}</div></div>`)}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${t('points.rewards')}</h3></div>
          <div class="rows" data-rewards></div>
        </div>
      </div>
    </section>`);

  /* Events */
  async function loadEvents() {
    try {
      const d = await api.get('/dashboard');
      mount($('[data-events-badge]', container), d.eventsDemo ? demoBadge() : '');
      mount($('[data-events]', container), d.events.length ? html`<div class="event-grid">${d.events.map(ev => html`
        <article class="event card">
          <div class="event-date"><b>${f.dayNum(ev.start)}</b><span>${f.monthShort(ev.start)}</span><small>${f.weekday(ev.start, 'short')}</small></div>
          <div class="event-main">
            ${ev.tag ? html`<span class="badge badge-accent">${t(`life.tags.${ev.tag}`)}</span>` : ''}
            <h3>${ev.title}</h3>
            <p class="muted">${ev.description || ''}</p>
            <div class="event-meta"><span>${icon('clock')}${f.time(ev.start)}${ev.end ? (f.dayKey(ev.end) === f.dayKey(ev.start) ? `–${f.time(ev.end)}` : ` → ${f.weekday(ev.end, 'short')} ${f.time(ev.end)}`) : ''}</span>${ev.location ? html`<span>${icon('pin')}${ev.location}</span>` : ''}</div>
          </div>
          <a class="btn btn-sm" href="${googleCalUrl(ev)}" target="_blank" rel="noopener">${icon('calendar')}${t('life.addCal')}</a>
        </article>`)}</div>` : html`<div class="card">${emptyState('party', t('home.noEvents'), t('life.noEventsBody'))}</div>`);
    } catch (err) {
      mount($('[data-events]', container), html`<div class="card">${errorState(err)}</div>`);
    }
  }
  on(container, 'click', '[data-retry]', loadEvents);
  loadEvents();

  /* AI points */
  const renderRewards = points => mount($('[data-rewards]', container), aipoints.rewards.map(r => {
    const ok = points != null && points >= r.pts;
    return html`<div class="row">
      <span class="reward-icon">${r.icon}</span>
      <div class="row-main"><div class="row-title">${pick(r.label)}</div>
        <div class="progress" style="margin-top:6px"><span style="width:${points == null ? 0 : Math.min(100, (points / r.pts) * 100)}%;background:${ok ? 'var(--ok)' : 'var(--ink)'}"></span></div></div>
      <div class="row-end">${ok
        ? html`<a class="btn btn-sm btn-primary" href="${mailto(bdeEmail, `AI Points — ${pick(r.label)}`, t('points.redeemBody', { name, reward: pick(r.label), pts: r.pts }))}">${t('points.redeem')}</a>`
        : html`<span class="mono muted">${r.pts}</span>`}</div>
    </div>`;
  }));

  (async () => {
    const meEl = $('[data-me]', container);
    const boardEl = $('[data-board]', container);
    if (!state.capabilities.aipoints) {
      mount(meEl, html`<span class="eyebrow" style="color:var(--lime-ink)">${t('points.balance')}</span><div class="stat-value" style="margin:12px 0">—</div><p>${t('points.notConfigured')}</p>`);
      mount(boardEl, emptyState('trophy', t('points.leaderboard'), t('points.notConfiguredBoard')));
      renderRewards(null);
      return;
    }
    try {
      const d = await api.get('/aipoints');
      const pts = d.me?.points ?? null;
      const lvl = pts != null ? pointsLevel(pts, aipoints.levels) : null;
      mount(meEl, d.me ? html`
        <span class="eyebrow" style="color:var(--lime-ink)">${t('points.balance')}</span>
        <div class="stat-value points-big">${f.number(pts, 0)}</div>
        <p style="font-weight:600">${t('points.rank', { rank: d.me.rank, total: d.total })} · ${pick(lvl.current?.name)}</p>
        ${lvl.next ? html`<div class="progress progress-ink" style="margin:14px 0 6px"><span style="width:${lvl.progress}%"></span></div>
          <small>${t('points.toNext', { n: lvl.next.min - pts, level: pick(lvl.next.name) })}</small>` : ''}`
        : html`<span class="eyebrow" style="color:var(--lime-ink)">${t('points.balance')}</span><div class="stat-value" style="margin:12px 0">—</div><p>${t('points.notFound')}</p>`);
      mount(boardEl, html`<div class="card-head"><h3>${t('points.leaderboard')}</h3><span class="muted" style="margin-left:auto;font-size:var(--fs-sm)">${t('points.participants', { n: d.total })}</span></div>
        <ol class="leaderboard">${d.leaderboard.map(r => html`
          <li class="${r.isMe ? 'me' : ''}"><span class="lb-rank mono">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span><span class="lb-name truncate">${r.name}${r.isMe ? html` <span class="badge badge-ink">${t('points.you')}</span>` : ''}</span><span class="lb-pts mono">${r.points}</span></li>`)}</ol>`);
      renderRewards(pts);
    } catch (err) {
      mount(meEl, html`<p>${err.message}</p>`);
      mount(boardEl, '');
      renderRewards(null);
    }
  })();
}
