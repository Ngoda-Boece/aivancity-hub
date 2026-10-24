import { html, mount, $, on } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, pick } from '../core/i18n.js';
import { state, storage, userKey } from '../core/state.js';
import { api } from '../core/api.js';
import * as f from '../core/format.js';
import { demoBadge, sourceBadge, skeletonRows, emptyState, errorState, pointsLevel } from '../components/bits.js';

export default function homeView({ container }) {
  const firstName = state.user.name.split(' ')[0];
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const horizon = f.addDays(dayStart, 7);

  mount(container, html`
    <div class="bento">
      <section class="card hero-card b-8">
        <span class="eyebrow"><span class="dot"></span>${f.fullDate(now)}</span>
        <h1 class="hero-title">${t(f.greetingKey(now))}, ${firstName}.</h1>
        <p class="hero-summary" data-summary><span class="skeleton" style="display:inline-block;width:260px"></span></p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/assistant">${icon('sparkles')}${t('home.askAi')}</a>
          <a class="btn" href="#/campus?book=1">${icon('door')}${t('home.bookRoom')}</a>
          <a class="btn btn-ghost" href="#/schedule">${t('home.fullWeek')} ${icon('arrowRight')}</a>
        </div>
      </section>

      <section class="card card-ink next-card b-4" data-next>
        <div class="skeleton" style="opacity:.2;height:120px"></div>
      </section>

      <section class="card b-7">
        <div class="card-head"><h2>${t('home.today')}</h2><span data-src></span><a class="more" href="#/schedule">${t('common.seeAll')} ${icon('arrowRight')}</a></div>
        <div data-today>${skeletonRows(3)}</div>
      </section>

      <section class="card b-5">
        <div class="card-head"><h2>${t('home.todo')}</h2><span class="badge" data-todo-count></span></div>
        <form class="todo-add" data-todo-form>
          <input class="input" name="title" placeholder="${t('home.todoPh')}" maxlength="140" aria-label="${t('home.todoPh')}">
          <input class="input" name="due" type="date" aria-label="${t('home.todoDue')}">
          <button class="btn btn-primary icon-btn" aria-label="${t('common.add')}">${icon('plus')}</button>
        </form>
        <ul class="todo-list" data-todos></ul>
        <div class="card-sub-head"><span class="eyebrow">${t('home.deadlines')}</span><span data-deadline-badge></span></div>
        <div data-deadlines>${skeletonRows(2)}</div>
      </section>

      <section class="card card-lime b-4 points-card" data-points>
        <span class="eyebrow" style="color:var(--lime-ink)">AI Points</span>
        <div class="stat-value" style="margin-top:16px">…</div>
      </section>

      <section class="card b-4">
        <div class="card-head"><h2>${t('home.events')}</h2><a class="more" href="#/life">${t('common.seeAll')} ${icon('arrowRight')}</a></div>
        <div data-events>${skeletonRows(2)}</div>
      </section>

      <section class="card b-4">
        <div class="card-head"><h2>${t('home.shortcuts')}</h2></div>
        <div class="shortcut-grid">
          ${(state.campus?.links || []).slice(0, 6).map(l => html`
            <a class="shortcut" href="${l.url}" target="_blank" rel="noopener">${icon({ blackboard: 'book', aimara: 'calendar', library: 'library', print: 'printer', outlook: 'mail', teams: 'users' }[l.id] || 'external')}<span>${pick(l.name)}</span></a>`)}
        </div>
      </section>
    </div>`);

  /* ---- Personal to-do (local to this browser, per user) ---- */
  const todoKey = userKey('todos');
  const todosEl = $('[data-todos]', container);
  const renderTodos = () => {
    const todos = storage.get(todoKey, []);
    const open = todos.filter(x => !x.done).length;
    $('[data-todo-count]', container).textContent = open ? t('home.todoOpen', { n: open }) : '';
    mount(todosEl, todos.length ? todos.map(td => html`
      <li class="todo ${td.done ? 'done' : ''}">
        <button class="todo-check" data-toggle="${td.id}" aria-label="${t('home.todoToggle')}" aria-pressed="${td.done}">${icon(td.done ? 'check2' : 'circle')}</button>
        <span class="todo-title">${td.title}</span>
        ${td.due ? html`<span class="badge ${!td.done && td.due < f.dayKey(new Date()) ? 'badge-danger' : ''}">${f.dayMonth(td.due + 'T12:00:00')}</span>` : ''}
        <button class="btn btn-ghost icon-btn btn-sm" data-remove="${td.id}" aria-label="${t('common.delete')}">${icon('x')}</button>
      </li>`) : html`<li class="todo-empty muted">${t('home.todoEmpty')}</li>`);
  };
  renderTodos();
  $('[data-todo-form]', container).addEventListener('submit', e => {
    e.preventDefault();
    const form = e.currentTarget;
    const title = form.title.value.trim();
    if (!title) return form.title.focus();
    const todos = storage.get(todoKey, []);
    todos.unshift({ id: crypto.randomUUID(), title, due: form.due.value || null, done: false });
    storage.set(todoKey, todos.slice(0, 100));
    form.reset();
    renderTodos();
  });
  on(todosEl, 'click', '[data-toggle],[data-remove]', (_e, btn) => {
    let todos = storage.get(todoKey, []);
    if (btn.dataset.toggle) todos = todos.map(x => (x.id === btn.dataset.toggle ? { ...x, done: !x.done } : x));
    else todos = todos.filter(x => x.id !== btn.dataset.remove);
    todos.sort((a, b) => a.done - b.done);
    storage.set(todoKey, todos);
    renderTodos();
  });

  /* ---- Schedule: summary, next class, today ---- */
  let events = [];
  let source = null;
  const renderSchedule = () => {
    const nowTs = Date.now();
    const todayKey = f.dayKey(new Date());
    const today = events.filter(e => f.dayKey(e.start) === todayKey && !e.allDay);
    const remaining = today.filter(e => new Date(e.end) > nowTs);
    const next = events.find(e => new Date(e.end) > nowTs && !e.allDay);

    mount($('[data-summary]', container), today.length
      ? html`${t('home.summary', { n: today.length })} ${remaining.length ? t('home.summaryLeft', { n: remaining.length }) : t('home.summaryDone')} ${source === 'demo' ? demoBadge() : ''}`
      : html`${t('home.summaryFree')} ${source === 'demo' ? demoBadge() : ''}`);
    mount($('[data-src]', container), sourceBadge(source));

    const nextEl = $('[data-next]', container);
    if (next) {
      const ongoing = new Date(next.start) <= nowTs;
      const pct = ongoing ? Math.min(100, Math.round(((nowTs - new Date(next.start)) / (new Date(next.end) - new Date(next.start))) * 100)) : 0;
      mount(nextEl, html`
        <span class="eyebrow muted">${ongoing ? t('home.ongoing') : t('home.next')}</span>
        <div class="next-count">${ongoing ? t('home.endsIn', { time: f.relative(next.end) }) : f.relative(next.start)}</div>
        <h3 class="next-title">${next.title}</h3>
        <div class="next-meta">
          <span>${icon('clock')}${f.dayKey(next.start) === todayKey ? '' : `${f.weekday(next.start, 'short')} · `}${f.time(next.start)}–${f.time(next.end)}</span>
          ${next.room ? html`<span>${icon('pin')}${next.room}</span>` : ''}
        </div>
        ${ongoing ? html`<div class="progress next-progress"><span style="width:${pct}%"></span></div>` : ''}`);
    } else {
      mount(nextEl, html`<span class="eyebrow muted">${t('home.next')}</span><div class="next-count">${t('home.nothingSoon')}</div><p class="muted">${t('home.nothingSoonHint')}</p>`);
    }

    const todayEl = $('[data-today]', container);
    if (!today.length) {
      mount(todayEl, emptyState('calendar', t('home.freeDay'), t('home.freeDayHint')));
      return;
    }
    mount(todayEl, html`<ol class="timeline">${today.map(e => {
      const past = new Date(e.end) < nowTs;
      const live = new Date(e.start) <= nowTs && !past;
      return html`<li class="tl-item ${past ? 'past' : ''} ${live ? 'live' : ''}" style="--c:${f.colorFor(e.title)}">
        <div class="tl-time mono">${f.time(e.start)}<span>${f.duration(e.start, e.end)}</span></div>
        <div class="tl-body"><div class="row-title">${e.title}</div><div class="row-sub">${[e.room, e.description].filter(Boolean).join(' · ')}</div></div>
        ${live ? html`<span class="badge badge-accent">${t('home.live')}</span>` : ''}
      </li>`;
    })}</ol>`);
  };

  const loadSchedule = async () => {
    try {
      const data = await api.get(`/schedule?from=${dayStart.toISOString()}&to=${horizon.toISOString()}`);
      events = data.events;
      source = data.source;
      renderSchedule();
    } catch (err) {
      mount($('[data-today]', container), errorState(err));
      mount($('[data-summary]', container), '');
      mount($('[data-next]', container), html`<p class="muted">${err.message}</p>`);
    }
  };
  loadSchedule();
  on(container, 'click', '[data-retry]', () => { loadSchedule(); loadDashboard(); });
  const tick = setInterval(() => events.length && renderSchedule(), 30000);

  /* ---- Dashboard: deadlines, events ---- */
  const loadDashboard = async () => {
    try {
      const d = await api.get('/dashboard');
      const deadlines = (d.academics.deadlines || []).filter(x => !x.due || new Date(x.due) > Date.now()).slice(0, 4);
      mount($('[data-deadline-badge]', container), d.academics.demo ? demoBadge() : '');
      mount($('[data-deadlines]', container), deadlines.length ? html`<div class="rows">${deadlines.map(x => html`
        <div class="row"><div class="tile-icon">${icon('target')}</div>
          <div class="row-main"><div class="row-title">${x.title}</div><div class="row-sub">${x.course || ''}</div></div>
          ${x.due ? html`<div class="row-end"><span class="badge ${new Date(x.due) - Date.now() < 3 * 864e5 ? 'badge-accent' : ''}">${f.relative(x.due)}</span></div>` : ''}
        </div>`)}</div>` : html`<p class="muted" style="padding:8px 0">${t('home.noDeadlines')}</p>`);

      mount($('[data-events]', container), d.events.length ? html`<div class="rows">${d.events.slice(0, 3).map(ev => html`
        <a class="row" href="#/life"><div class="date-tile"><b>${f.dayNum(ev.start)}</b><span>${f.monthShort(ev.start)}</span></div>
          <div class="row-main"><div class="row-title">${ev.title}</div><div class="row-sub">${f.weekday(ev.start, 'short')} ${f.time(ev.start)} · ${ev.location || ''}</div></div></a>`)}</div>
        ${d.eventsDemo ? html`<div style="margin-top:8px">${demoBadge()}</div>` : ''}` : emptyState('party', t('home.noEvents'), ''));

      const ann = d.announcements?.[0];
      if (ann && !storage.get(userKey(`ann:${ann.id}`))) {
        const el = document.createElement('div');
        el.className = 'notice notice-info home-ann';
        mount(el, html`${icon('info')}<div><strong>${pick(ann.title)}</strong>${pick(ann.body)}</div>
          <div class="actions"><a class="btn btn-sm" href="#/settings">${t('home.connect')}</a><button class="btn btn-ghost icon-btn btn-sm" data-dismiss aria-label="${t('common.close')}">${icon('x')}</button></div>`);
        container.prepend(el);
        $('[data-dismiss]', el).addEventListener('click', () => { storage.set(userKey(`ann:${ann.id}`), true); el.remove(); });
      }
    } catch (err) {
      mount($('[data-deadlines]', container), errorState(err));
      mount($('[data-events]', container), '');
    }
  };
  loadDashboard();

  /* ---- AI points ---- */
  (async () => {
    const el = $('[data-points]', container);
    const cfg = state.campus?.aipoints || { levels: [] };
    if (!state.capabilities.aipoints) {
      mount(el, html`<span class="eyebrow" style="color:var(--lime-ink)">AI Points</span>
        <div class="stat-value" style="margin-top:16px">—</div><p class="muted" style="margin-top:8px">${t('points.notConfigured')}</p>
        <a class="more-link" href="#/life#points">${t('points.howTo')} ${icon('arrowRight')}</a>`);
      return;
    }
    try {
      const d = await api.get('/aipoints');
      if (!d.me) {
        mount(el, html`<span class="eyebrow" style="color:var(--lime-ink)">AI Points</span><div class="stat-value" style="margin-top:16px">—</div><p class="muted" style="margin-top:8px">${t('points.notFound')}</p>`);
        return;
      }
      const lvl = pointsLevel(d.me.points, cfg.levels);
      mount(el, html`<span class="eyebrow" style="color:var(--lime-ink)">AI Points · #${d.me.rank}/${d.total}</span>
        <div class="stat-value points-big">${f.number(d.me.points, 0)}</div>
        <div class="muted" style="margin:4px 0 12px">${pick(lvl.current?.name)}${lvl.next ? ` → ${pick(lvl.next.name)} (${lvl.next.min})` : ''}</div>
        <div class="progress progress-ink"><span style="width:${lvl.progress}%"></span></div>
        <a class="more-link" href="#/life#points">${t('points.leaderboard')} ${icon('arrowRight')}</a>`);
    } catch (err) {
      mount(el, html`<span class="eyebrow" style="color:var(--lime-ink)">AI Points</span><p style="margin-top:16px">${err.message}</p>`);
    }
  })();

  return { destroy: () => clearInterval(tick) };
}
