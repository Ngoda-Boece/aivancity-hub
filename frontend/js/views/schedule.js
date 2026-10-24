import { html, mount, $, on } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { api } from '../core/api.js';
import * as f from '../core/format.js';
import { sourceBadge, emptyState, errorState } from '../components/bits.js';
import { openModal } from '../components/modal.js';

const START_H = 8;
const END_H = 20;
const HOUR_PX = 56;

function icsFor(e) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = s => String(s || '').replace(/[\\,;]/g, m => `\\${m}`).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aivancity Hub//FR', 'BEGIN:VEVENT',
    `UID:${esc(e.id)}@aivancity-hub`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`, `LOCATION:${esc(e.room || e.location)}`, `DESCRIPTION:${esc(e.description)}`,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

function showEvent(e) {
  openModal({
    title: e.title,
    body: html`
      <div class="rows">
        <div class="row"><div class="tile-icon">${icon('calendar')}</div><div class="row-main"><div class="row-title">${f.longDate(e.start)}</div><div class="row-sub">${e.allDay ? t('schedule.allDay') : `${f.time(e.start)} – ${f.time(e.end)} · ${f.duration(e.start, e.end)}`}</div></div></div>
        ${e.room || e.location ? html`<div class="row"><div class="tile-icon">${icon('pin')}</div><div class="row-main"><div class="row-title">${e.room || e.location}</div><div class="row-sub">${t('schedule.location')}</div></div></div>` : ''}
        ${e.description ? html`<div class="row"><div class="tile-icon">${icon('info')}</div><div class="row-main" style="white-space:pre-line">${e.description}</div></div>` : ''}
      </div>`,
    footer: html`<button class="btn" data-ics>${icon('calendar')}${t('schedule.addToCalendar')}</button><button class="btn btn-primary" data-close>${t('common.close')}</button>`,
    onMount(dialog) {
      $('[data-ics]', dialog).addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([icsFor(e)], { type: 'text/calendar' }));
        Object.assign(document.createElement('a'), { href: url, download: `${e.title.replace(/[^\w-]+/g, '_').slice(0, 40)}.ics` }).click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    },
  });
}

export default function scheduleView({ container }) {
  let offset = 0;
  let events = [];

  mount(container, html`
    <header class="page-head">
      <div>
        <span class="eyebrow"><span class="dot"></span>${t('schedule.eyebrow')}</span>
        <h1 data-range>${t('nav.schedule')}</h1>
        <p data-source-line class="muted"></p>
      </div>
      <div class="actions">
        <div class="segmented week-nav">
          <button data-week="-1" aria-label="${t('schedule.prev')}">${icon('chevronLeft')}</button>
          <button data-week="0">${t('schedule.thisWeek')}</button>
          <button data-week="1" aria-label="${t('schedule.next')}">${icon('chevronRight')}</button>
        </div>
      </div>
    </header>
    <div data-notice></div>
    <div data-body></div>`);

  const body = $('[data-body]', container);

  function renderWeek(from, source, warnings) {
    const days = Array.from({ length: 7 }, (_, i) => f.addDays(from, i));
    const byDay = new Map(days.map(d => [f.dayKey(d), []]));
    for (const e of events) byDay.get(f.dayKey(e.start))?.push(e);
    const shownDays = days.filter((d, i) => i < 5 || byDay.get(f.dayKey(d)).length);
    const todayKey = f.dayKey(new Date());

    $('[data-range]', container).textContent = `${f.dayMonth(days[0])} – ${f.dayMonth(days[6])}`;
    mount($('[data-source-line]', container), html`${sourceBadge(source)} <span>${t('schedule.count', { n: events.length })}</span>`);
    mount($('[data-notice]', container), source === 'demo' ? html`
      <div class="notice notice-warn" style="margin-bottom:20px">${icon('info')}<div><strong>${t('schedule.demoTitle')}</strong>${t('schedule.demoBody')}${warnings?.length ? html`<br><small>${warnings.join(' · ')}</small>` : ''}</div>
      <div class="actions"><a class="btn btn-sm btn-primary" href="#/settings#calendar">${t('schedule.connect')}</a></div></div>` : '');

    if (!events.length) {
      mount(body, html`<div class="card">${emptyState('calendar', t('schedule.emptyTitle'), t('schedule.emptyBody'))}</div>`);
      return;
    }

    const hours = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i);
    const nowMin = f.minutesOfDay(new Date());

    mount(body, html`
      <div class="week card card-flush" style="--cols:${shownDays.length};--hour:${HOUR_PX}px">
        <div class="week-head">
          <div></div>
          ${shownDays.map(d => html`<div class="week-day ${f.dayKey(d) === todayKey ? 'today' : ''}"><span>${f.weekday(d, 'short')}</span><b>${f.dayNum(d)}</b></div>`)}
        </div>
        <div class="week-grid">
          <div class="week-hours">${hours.map(h => html`<span style="top:${(h - START_H) * HOUR_PX}px">${String(h).padStart(2, '0')}:00</span>`)}</div>
          ${shownDays.map(d => {
            const key = f.dayKey(d);
            const list = byDay.get(key).filter(e => !e.allDay);
            return html`<div class="week-col ${key === todayKey ? 'today' : ''}">
              ${hours.map(h => html`<i style="top:${(h - START_H) * HOUR_PX}px"></i>`)}
              ${key === todayKey && nowMin > START_H * 60 && nowMin < END_H * 60 ? html`<div class="now-line" style="top:${((nowMin - START_H * 60) / 60) * HOUR_PX}px"></div>` : ''}
              ${list.map(e => {
                const s = Math.max(f.minutesOfDay(e.start), START_H * 60);
                const en = Math.min(Math.max(f.minutesOfDay(e.end), s + 30), END_H * 60 + 59);
                const top = ((s - START_H * 60) / 60) * HOUR_PX;
                const height = Math.max(((en - s) / 60) * HOUR_PX - 3, 24);
                return html`<button class="ev-block" data-ev="${events.indexOf(e)}" style="top:${top}px;height:${height}px;--c:${f.colorFor(e.title)}">
                  <b>${e.title}</b><span>${f.time(e.start)}–${f.time(e.end)}${e.room ? ` · ${e.room}` : ''}</span></button>`;
              })}
            </div>`;
          })}
        </div>
      </div>

      <div class="agenda">
        ${days.map(d => {
          const list = byDay.get(f.dayKey(d));
          if (!list.length) return '';
          return html`<section class="agenda-day ${f.dayKey(d) === todayKey ? 'today' : ''}">
            <h3><span>${f.weekday(d)}</span> ${f.dayMonth(d)}</h3>
            <div class="card card-flush">${list.map(e => html`
              <button class="agenda-item" data-ev="${events.indexOf(e)}" style="--c:${f.colorFor(e.title)}">
                <span class="mono">${e.allDay ? t('schedule.allDay') : f.time(e.start)}<small>${e.allDay ? '' : f.duration(e.start, e.end)}</small></span>
                <span class="agenda-main"><b>${e.title}</b><small>${[e.room || e.location, e.description].filter(Boolean).join(' · ')}</small></span>
                ${icon('chevronRight')}
              </button>`)}</div>
          </section>`;
        })}
      </div>`);

    const grid = $('.week-grid', body);
    if (grid) {
      // Current week during the day: centre on now. Otherwise: start at the earliest class.
      const earliest = Math.min(...events.filter(e => !e.allDay).map(e => f.minutesOfDay(e.start)), END_H * 60);
      const focusMin = offset === 0 && nowMin > START_H * 60 && nowMin < END_H * 60 ? nowMin - 60 : earliest - 30;
      grid.scrollTop = Math.max(0, ((focusMin / 60) - START_H) * HOUR_PX);
    }
  }

  async function load() {
    const from = f.weekStart(new Date(), offset);
    const to = f.addDays(from, 7);
    mount(body, html`<div class="card"><div class="skeleton" style="height:420px"></div></div>`);
    try {
      const data = await api.get(`/schedule?from=${from.toISOString()}&to=${to.toISOString()}`);
      events = data.events;
      renderWeek(from, data.source, data.errors);
    } catch (err) {
      mount(body, html`<div class="card">${errorState(err)}</div>`);
    }
  }

  on(container, 'click', '[data-week]', (_e, b) => {
    const step = +b.dataset.week;
    offset = step === 0 ? 0 : offset + step;
    load();
  });
  on(container, 'click', '[data-ev]', (_e, b) => showEvent(events[+b.dataset.ev]));
  on(container, 'click', '[data-retry]', load);
  load();
}
