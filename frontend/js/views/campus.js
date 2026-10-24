import { html, mount, $, $$, on, formData, showFieldErrors, setBusy, safeUrl } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, pick } from '../core/i18n.js';
import { state } from '../core/state.js';
import { api } from '../core/api.js';
import * as f from '../core/format.js';
import { skeletonRows, emptyState, errorState } from '../components/bits.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { toast, toastError } from '../components/toast.js';

const SLOTS = Array.from({ length: 27 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

function nextSlot() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return SLOTS.find(s => { const [h, m] = s.split(':').map(Number); return h * 60 + m > mins + 15; }) || '09:00';
}

function openBooking(roomNumber, onBooked) {
  const rooms = state.campus.rooms;
  const today = f.dayKey(new Date());
  const startDefault = nextSlot();
  const endDefault = SLOTS[Math.min(SLOTS.indexOf(startDefault) + 4, SLOTS.length - 1)];
  const lateToday = startDefault === '09:00' && new Date().getHours() >= 20;

  openModal({
    title: t('campus.book.title'),
    body: html`
      <form data-book novalidate>
        <div class="field">
          <label for="bk-room">${t('campus.book.room')}</label>
          <select class="select" id="bk-room" name="room">
            ${rooms.map(r => html`<option value="${r.number}" ${r.number === roomNumber ? 'selected' : ''}>${r.number} · ${r.name}${r.kind ? ` — ${pick(r.kind)}` : ''}</option>`)}
          </select>
        </div>
        <div class="field"><label for="bk-date">${t('campus.book.date')}</label>
          <input class="input" id="bk-date" name="date" type="date" min="${today}" value="${lateToday ? f.dayKey(f.addDays(new Date(), 1)) : today}" required></div>
        <div class="field-row">
          <div class="field"><label for="bk-start">${t('campus.book.start')}</label>
            <select class="select mono" id="bk-start" name="start">${SLOTS.slice(0, -1).map(s => html`<option ${s === startDefault ? 'selected' : ''}>${s}</option>`)}</select></div>
          <div class="field"><label for="bk-end">${t('campus.book.end')}</label>
            <select class="select mono" id="bk-end" name="end">${SLOTS.slice(1).map(s => html`<option ${s === endDefault ? 'selected' : ''}>${s}</option>`)}</select></div>
        </div>
        <div class="field"><label for="bk-purpose">${t('campus.book.purpose')}</label>
          <input class="input" id="bk-purpose" name="purpose" maxlength="200" placeholder="${t('campus.book.purposePh')}"></div>
        <div class="field"><label for="bk-people">${t('campus.book.people')}</label>
          <input class="input" id="bk-people" name="participants" type="number" min="1" max="200" inputmode="numeric" placeholder="4"></div>
        <div class="notice ${state.capabilities.emailDelivery ? 'notice-ok' : ''}">${icon(state.capabilities.emailDelivery ? 'mail' : 'info')}
          <div>${state.capabilities.emailDelivery ? t('campus.book.direct') : t('campus.book.draft')}</div></div>
      </form>`,
    footer: html`<button class="btn" data-close>${t('common.cancel')}</button><button class="btn btn-primary" data-submit>${t('campus.book.submit')}</button>`,
    onMount(dialog, close) {
      const form = $('[data-book]', dialog);
      const submit = $('[data-submit]', dialog);
      form.start.addEventListener('change', () => {
        const i = SLOTS.indexOf(form.start.value);
        if (SLOTS.indexOf(form.end.value) <= i) form.end.value = SLOTS[Math.min(i + 2, SLOTS.length - 1)];
      });
      const send = async () => {
        setBusy(submit, true);
        try {
          const { booking, mailto } = await api.post('/bookings', formData(form));
          close();
          if (mailto) {
            toast(t('campus.book.draftReady'), { type: 'ok' });
            window.location.href = mailto;
          } else {
            toast(t('campus.book.sent', { room: booking.roomName, date: f.dayMonth(`${booking.date}T12:00:00`) }), { type: 'ok' });
          }
          onBooked?.();
        } catch (err) {
          if (err.details) showFieldErrors(form, err.details);
          else toastError(err);
        } finally {
          setBusy(submit, false);
        }
      };
      submit.addEventListener('click', send);
      form.addEventListener('submit', e => { e.preventDefault(); send(); });
    },
  });
}

export default function campusView({ container, query }) {
  const { rooms, contacts, links, campus } = state.campus;
  const floors = [...new Set(rooms.map(r => r.floor).filter(v => v != null))].sort();

  mount(container, html`
    <header class="page-head">
      <div><span class="eyebrow"><span class="dot"></span>${campus.name}</span><h1>${t('nav.campus')}</h1><p>${t('campus.lede')}</p></div>
      <div class="actions"><button class="btn btn-primary" data-book-any>${icon('door')}${t('campus.book.title')}</button></div>
    </header>

    <section class="card" style="margin-bottom:16px">
      <div class="card-head"><h2>${t('campus.myBookings')}</h2></div>
      <div data-bookings>${skeletonRows(1)}</div>
    </section>

    <section class="card" style="margin-bottom:16px">
      <div class="card-head rooms-head">
        <h2>${t('campus.rooms')}</h2>
        <div class="rooms-filters">
          <input class="input" type="search" data-room-search placeholder="${t('campus.searchRoom')}" aria-label="${t('campus.searchRoom')}">
          ${floors.length ? html`<div class="segmented" data-floors>
            <button data-floor="" aria-pressed="true">${t('common.all')}</button>
            ${floors.map(fl => html`<button data-floor="${fl}" aria-pressed="false">${fl === 0 ? t('campus.ground') : t('campus.floor', { n: fl })}</button>`)}
          </div>` : ''}
        </div>
      </div>
      <div class="room-grid" data-rooms>
        ${rooms.map(r => html`
          <button class="room" data-room="${r.number}" data-floor-of="${r.floor ?? ''}" data-search="${`${r.number} ${r.name} ${pick(r.kind) || ''}`.toLowerCase()}">
            <span class="room-num mono">${r.number}</span>
            <b>${r.name}</b>
            <small>${r.kind ? pick(r.kind) : t('campus.room')}${r.floor != null ? ` · ${r.floor === 0 ? t('campus.ground') : t('campus.floor', { n: r.floor })}` : ''}</small>
            <span class="room-cta">${t('campus.book.short')} ${icon('arrowRight')}</span>
          </button>`)}
      </div>
      <p class="empty-filter muted" hidden>${t('campus.noRoom')}</p>
    </section>

    <div class="grid grid-2">
      <section class="card" id="map">
        <div class="card-head"><h2>${t('campus.map')}</h2><a class="more" href="${campus.mapsUrl}" target="_blank" rel="noopener">${t('campus.directions')} ${icon('external')}</a></div>
        <a class="map-frame" href="assets/map.jpeg" target="_blank" rel="noopener" title="${t('campus.mapOpen')}">
          <img src="assets/map.jpeg" alt="${t('campus.mapAlt')}" loading="lazy">
        </a>
        <p class="muted" style="margin-top:12px;display:flex;gap:8px;align-items:center">${icon('pin')}${campus.address}</p>
      </section>

      <section class="card" id="services">
        <div class="card-head"><h2>${t('campus.services')}</h2></div>
        <div class="rows">${links.map(l => html`
          <a class="row" href="${safeUrl(l.url)}" target="_blank" rel="noopener">
            <div class="tile-icon">${icon({ blackboard: 'book', aimara: 'calendar', library: 'library', print: 'printer', outlook: 'mail', teams: 'users' }[l.id] || 'external')}</div>
            <div class="row-main"><div class="row-title">${pick(l.name)}</div><div class="row-sub">${pick(l.desc)}</div></div>
            ${icon('arrowUpRight')}
          </a>`)}</div>
      </section>
    </div>

    <section class="card" style="margin-top:16px" id="contacts">
      <div class="card-head"><h2>${t('campus.contacts')}</h2>
        <input class="input" style="max-width:260px;margin-left:auto" type="search" data-contact-search placeholder="${t('campus.searchContact')}" aria-label="${t('campus.searchContact')}"></div>
      <div class="contact-grid">${contacts.map(c => html`
        <div class="contact" data-search="${`${pick(c.name)} ${pick(c.role)} ${c.email}`.toLowerCase()}">
          <div><b>${pick(c.name)}</b><small>${pick(c.role)}</small><span class="mono contact-mail">${c.email}</span></div>
          <div class="contact-actions">
            <button class="btn btn-ghost icon-btn btn-sm" data-copy="${c.email}" aria-label="${t('common.copy')}">${icon('copy')}</button>
            <a class="btn btn-sm" href="mailto:${c.email}">${icon('mail')}${t('campus.write')}</a>
          </div>
        </div>`)}</div>
    </section>`);

  /* Bookings list */
  async function loadBookings() {
    const el = $('[data-bookings]', container);
    try {
      const { bookings } = await api.get('/bookings');
      mount(el, bookings.length ? html`<div class="rows">${bookings.map(b => html`
        <div class="row">
          <div class="date-tile"><b>${f.dayNum(`${b.date}T12:00:00`)}</b><span>${f.monthShort(`${b.date}T12:00:00`)}</span></div>
          <div class="row-main"><div class="row-title">${b.room} · ${b.roomName}</div><div class="row-sub">${b.start}–${b.end}${b.purpose ? ` · ${b.purpose}` : ''}</div></div>
          <span class="badge ${b.status === 'sent' ? 'badge-ok' : 'badge-warn'}">${t(`campus.status.${b.status}`)}</span>
          <button class="btn btn-ghost icon-btn btn-sm" data-cancel="${b.id}" aria-label="${t('common.cancel')}">${icon('trash')}</button>
        </div>`)}</div>` : html`<p class="muted">${t('campus.noBookings')}</p>`);
    } catch (err) {
      mount(el, errorState(err));
    }
  }
  loadBookings();

  /* Interactions */
  on(container, 'click', '[data-book-any]', () => openBooking(null, loadBookings));
  on(container, 'click', '[data-room]', (_e, b) => openBooking(b.dataset.room, loadBookings));
  on(container, 'click', '[data-retry]', loadBookings);
  on(container, 'click', '[data-cancel]', async (_e, b) => {
    if (!(await confirmDialog({ title: t('campus.cancelTitle'), message: t('campus.cancelBody'), confirmLabel: t('campus.cancelOk'), danger: true }))) return;
    try {
      await api.del(`/bookings/${encodeURIComponent(b.dataset.cancel)}`);
      toast(t('campus.cancelled'), { type: 'ok' });
      loadBookings();
    } catch (err) { toastError(err); }
  });
  on(container, 'click', '[data-copy]', async (_e, b) => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(t('common.copied'), { type: 'ok', timeout: 1800 }); }
    catch { toast(t('errors.clipboard'), { type: 'error' }); }
  });

  let floor = '';
  const filterRooms = () => {
    const q = ($('[data-room-search]', container).value || '').trim().toLowerCase();
    let visible = 0;
    $$('[data-room]', container).forEach(el => {
      const show = el.dataset.search.includes(q) && (floor === '' || el.dataset.floorOf === floor);
      el.hidden = !show;
      visible += show;
    });
    $('.empty-filter', container).hidden = visible > 0;
  };
  $('[data-room-search]', container).addEventListener('input', filterRooms);
  on(container, 'click', '[data-floor]', (_e, b) => {
    floor = b.dataset.floor;
    $$('[data-floor]', container).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    filterRooms();
  });
  $('[data-contact-search]', container).addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    $$('.contact', container).forEach(el => { el.hidden = !el.dataset.search.includes(q); });
  });

  if (query.room) {
    const el = $(`[data-room="${CSS.escape(query.room)}"]`, container);
    el?.scrollIntoView({ block: 'center' });
    el?.classList.add('flash');
  }
  if (query.book) openBooking(query.room || null, loadBookings);
}

export { openBooking };
