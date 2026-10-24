import { html, mount, $, on } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { storage, userKey } from '../core/state.js';
import { api } from '../core/api.js';
import * as f from '../core/format.js';
import { demoBadge, sourceBadge, skeletonRows, emptyState, errorState } from '../components/bits.js';
import { toast } from '../components/toast.js';

const gradeClass = g => (g >= 14 ? 'badge-ok' : g >= 10 ? 'badge-warn' : 'badge-danger');

function weightedAverage(rows) {
  const valid = rows.filter(r => Number.isFinite(r.score) && r.score >= 0 && Number.isFinite(r.coef) && r.coef > 0);
  const coefs = valid.reduce((s, r) => s + r.coef, 0);
  return coefs ? valid.reduce((s, r) => s + (r.score / (r.outOf || 20)) * 20 * r.coef, 0) / coefs : null;
}

/* ---------------- Focus timer (Pomodoro) ---------------- */
function focusTimer(root) {
  const MODES = { focus: 25, short: 5, long: 15 };
  let mode = 'focus';
  let remaining = MODES.focus * 60;
  let timer = null;
  let sessions = storage.get(userKey(`focus:${f.dayKey(new Date())}`), 0);
  const baseTitle = document.title;

  const beep = () => {
    try {
      const ctx = new AudioContext();
      [0, 0.25, 0.5].forEach(d => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.15, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.2);
        o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2);
      });
    } catch { /* audio unavailable */ }
  };

  function paint() {
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    const total = MODES[mode] * 60;
    mount(root, html`
      <div class="focus">
        <div class="segmented">${Object.keys(MODES).map(k => html`<button data-mode="${k}" aria-pressed="${k === mode}">${t(`studies.focus.${k}`)}</button>`)}</div>
        <div class="focus-dial" style="--p:${((total - remaining) / total) * 360}deg"><div><span class="mono">${m}:${s}</span><small>${t(`studies.focus.${mode}`)}</small></div></div>
        <div class="focus-actions">
          <button class="btn btn-primary btn-lg" data-toggle>${timer ? icon('pause') : icon('play')}${timer ? t('studies.focus.pause') : t('studies.focus.start')}</button>
          <button class="btn btn-lg icon-btn" data-reset aria-label="${t('studies.focus.reset')}">${icon('refresh')}</button>
        </div>
        <p class="muted">${t('studies.focus.sessions', { n: sessions })}</p>
      </div>`);
    document.title = timer ? `${m}:${s} · ${t(`studies.focus.${mode}`)}` : baseTitle;
  }

  function stop() { clearInterval(timer); timer = null; }
  function setMode(next) { stop(); mode = next; remaining = MODES[mode] * 60; paint(); }

  on(root, 'click', '[data-mode]', (_e, b) => setMode(b.dataset.mode));
  on(root, 'click', '[data-reset]', () => setMode(mode));
  on(root, 'click', '[data-toggle]', () => {
    if (timer) { stop(); return paint(); }
    timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        stop();
        beep();
        if (mode === 'focus') {
          sessions++;
          storage.set(userKey(`focus:${f.dayKey(new Date())}`), sessions);
          toast(t('studies.focus.doneFocus'), { type: 'ok' });
          return setMode(sessions % 4 === 0 ? 'long' : 'short');
        }
        toast(t('studies.focus.doneBreak'), { type: 'ok' });
        return setMode('focus');
      }
      paint();
    }, 1000);
    paint();
  });

  paint();
  return () => { stop(); document.title = baseTitle; };
}

/* ---------------- Average simulator ---------------- */
function simulator(root) {
  const key = userKey('simulator');
  let rows = storage.get(key, null) || [
    { name: 'Machine Learning', score: 15, coef: 3 },
    { name: 'Data Engineering', score: 13, coef: 2 },
    { name: '', score: null, coef: 1 },
  ];
  let target = storage.get(`${key}:target`, 14);

  function paint() {
    const avg = weightedAverage(rows.map(r => ({ score: r.score, coef: r.coef, outOf: 20 })));
    const missing = rows.filter(r => r.score == null && r.coef > 0);
    const known = rows.filter(r => r.score != null && r.coef > 0);
    const knownSum = known.reduce((s, r) => s + r.score * r.coef, 0);
    const knownCoef = known.reduce((s, r) => s + r.coef, 0);
    const missingCoef = missing.reduce((s, r) => s + r.coef, 0);
    const needed = missingCoef ? (target * (knownCoef + missingCoef) - knownSum) / missingCoef : null;

    mount(root, html`
      <div class="sim">
        <div class="sim-rows">
          <div class="sim-row sim-head"><span>${t('studies.sim.subject')}</span><span>${t('studies.sim.grade')}</span><span>${t('studies.sim.coef')}</span><span></span></div>
          ${rows.map((r, i) => html`<div class="sim-row">
            <input class="input" data-i="${i}" data-k="name" value="${r.name}" placeholder="${t('studies.sim.subject')}" aria-label="${t('studies.sim.subject')}">
            <input class="input mono" data-i="${i}" data-k="score" type="number" min="0" max="20" step="0.25" value="${r.score ?? ''}" placeholder="?" aria-label="${t('studies.sim.grade')}">
            <input class="input mono" data-i="${i}" data-k="coef" type="number" min="0" max="20" step="0.5" value="${r.coef}" aria-label="${t('studies.sim.coef')}">
            <button class="btn btn-ghost icon-btn" data-del="${i}" aria-label="${t('common.delete')}">${icon('x')}</button>
          </div>`)}
          <button class="btn btn-sm" data-add>${icon('plus')}${t('studies.sim.add')}</button>
        </div>
        <div class="sim-result card-ink card">
          <span class="eyebrow muted">${t('studies.sim.average')}</span>
          <div class="stat-value" style="font-size:3rem;margin:8px 0">${avg == null ? '—' : f.number(avg)}<small class="muted" style="font-size:1rem"> /20</small></div>
          <label class="sim-target">${t('studies.sim.target')} <input class="input mono" data-target type="number" min="0" max="20" step="0.5" value="${target}"></label>
          <p class="muted" style="margin-top:12px">${missing.length
            ? needed > 20 ? t('studies.sim.impossible') : needed <= 0 ? t('studies.sim.secured') : t('studies.sim.needed', { n: f.number(needed), count: missing.length })
            : t('studies.sim.leaveEmpty')}</p>
        </div>
      </div>`);
  }

  const persist = () => { storage.set(key, rows); storage.set(`${key}:target`, target); };
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.target !== undefined) { target = Math.min(20, Math.max(0, parseFloat(el.value) || 0)); }
    else if (el.dataset.k) {
      const r = rows[+el.dataset.i];
      if (el.dataset.k === 'name') r.name = el.value.slice(0, 60);
      else {
        const v = el.value === '' ? null : parseFloat(el.value);
        r[el.dataset.k] = el.dataset.k === 'score' ? (v == null ? null : Math.min(20, Math.max(0, v))) : Math.max(0, v || 0);
      }
    } else return;
    persist();
    paint();
  });
  on(root, 'click', '[data-add]', () => { rows.push({ name: '', score: null, coef: 1 }); persist(); paint(); root.querySelectorAll('[data-k="name"]')[rows.length - 1]?.focus(); });
  on(root, 'click', '[data-del]', (_e, b) => { rows.splice(+b.dataset.del, 1); persist(); paint(); });
  paint();
}

export default function studiesView({ container }) {
  mount(container, html`
    <header class="page-head">
      <div><span class="eyebrow"><span class="dot"></span>${t('studies.eyebrow')}</span><h1>${t('nav.studies')}</h1><p>${t('studies.lede')}</p></div>
      <div class="actions"><a class="btn" href="https://aivancity.blackboard.com/ultra/course" target="_blank" rel="noopener">${icon('external')}Blackboard</a></div>
    </header>

    <div class="grid studies-top">
      <section class="card avg-card"><div data-avg>${skeletonRows(1)}</div></section>
      <section class="card"><div data-att>${skeletonRows(1)}</div></section>
      <section class="card"><div data-count>${skeletonRows(1)}</div></section>
    </div>

    <div class="grid grid-2" style="margin-top:16px">
      <section class="card">
        <div class="card-head"><h2>${t('studies.grades')}</h2><span data-src></span></div>
        <div data-grades>${skeletonRows(4)}</div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${t('studies.courses')}</h2></div>
        <div data-courses>${skeletonRows(4)}</div>
      </section>
    </div>

    <section class="card" style="margin-top:16px" id="simulator">
      <div class="card-head"><h2>${t('studies.sim.title')}</h2><span class="muted" style="font-size:var(--fs-sm)">${t('studies.sim.lede')}</span></div>
      <div data-sim></div>
    </section>

    <section class="card" style="margin-top:16px" id="focus">
      <div class="card-head"><h2>${t('studies.focus.title')}</h2><span class="muted" style="font-size:var(--fs-sm)">${t('studies.focus.lede')}</span></div>
      <div data-focus></div>
    </section>`);

  simulator($('[data-sim]', container));
  const stopFocus = focusTimer($('[data-focus]', container));

  async function load() {
    try {
      const { academics: a } = await api.get('/dashboard');
      mount($('[data-src]', container), sourceBadge(a.source));

      const numeric = (a.grades || []).filter(g => typeof g.score === 'number');
      const avg = weightedAverage(numeric);
      mount($('[data-avg]', container), html`<span class="eyebrow">${t('studies.average')} ${a.demo ? demoBadge() : ''}</span>
        <div class="stat-value" style="margin-top:12px">${avg == null ? '—' : f.number(avg)}<small class="muted" style="font-size:1rem"> /20</small></div>
        <div class="stat-label">${t('studies.averageHint', { n: numeric.length })}</div>`);

      const att = a.attendance;
      mount($('[data-att]', container), att ? html`<span class="eyebrow">${t('studies.attendance')}</span>
        <div class="stat-value" style="margin-top:12px">${att.rate}%</div>
        <div class="progress" style="margin:10px 0 8px"><span style="width:${att.rate}%;background:${att.rate >= 90 ? 'var(--ok)' : att.rate >= 80 ? 'var(--warn)' : 'var(--danger)'}"></span></div>
        <div class="stat-label">${t('studies.attendanceHint', { present: att.present, absent: att.absent })}</div>`
        : html`<span class="eyebrow">${t('studies.attendance')}</span><p class="muted" style="margin-top:12px">${t('studies.noAttendance')}</p>`);

      const deadlines = (a.deadlines || []).filter(d => !d.due || new Date(d.due) > Date.now());
      mount($('[data-count]', container), html`<span class="eyebrow">${t('studies.upcoming')}</span>
        <div class="stat-value" style="margin-top:12px">${deadlines.length}</div>
        <div class="stat-label">${deadlines[0] ? html`${t('studies.nextDeadline')} <b>${deadlines[0].title}</b> ${deadlines[0].due ? f.relative(deadlines[0].due) : ''}` : t('home.noDeadlines')}</div>`);

      mount($('[data-grades]', container), a.grades?.length ? html`<div class="rows">${a.grades.map(g => html`
        <div class="row">
          <span class="grade-pill ${typeof g.score === 'number' ? gradeClass((g.score / (g.outOf || 20)) * 20) : ''}">${typeof g.score === 'number' ? f.number(g.score, 2) : (g.scoreText || '—')}</span>
          <div class="row-main"><div class="row-title">${g.item}</div><div class="row-sub">${g.course}${g.coef ? ` · coef ${g.coef}` : ''}</div></div>
          ${g.date ? html`<div class="row-end muted" style="font-size:var(--fs-sm)">${f.dayMonth(g.date)}</div>` : ''}
        </div>`)}</div>` : emptyState('cap', t('studies.noGrades'), ''));

      mount($('[data-courses]', container), a.courses?.length ? html`<div class="rows">${a.courses.map(c => html`
        <div class="row">
          <span class="course-dot" style="background:${f.colorFor(c.title)}"></span>
          <div class="row-main"><div class="row-title">${c.title}</div>
            ${typeof c.progress === 'number' ? html`<div class="progress" style="margin-top:6px"><span style="width:${c.progress}%;background:${f.colorFor(c.title)}"></span></div>` : ''}</div>
          <div class="row-end mono muted" style="font-size:var(--fs-sm)">${c.code || ''}${typeof c.progress === 'number' ? html` · ${c.progress}%` : ''}</div>
        </div>`)}</div>` : emptyState('book', t('studies.noCourses'), ''));
    } catch (err) {
      mount($('[data-grades]', container), errorState(err));
    }
  }
  on(container, 'click', '[data-retry]', load);
  load();

  return { destroy: stopFocus };
}
