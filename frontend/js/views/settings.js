import { html, mount, $, on, setBusy, initials, showFieldErrors } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, getLang } from '../core/i18n.js';
import { state, storage, emit } from '../core/state.js';
import { api } from '../core/api.js';
import { getThemePref, setTheme } from '../core/theme.js';
import { logout } from '../core/session.js';
import { rerender } from '../core/router.js';
import { toast, toastError } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';

export default function settingsView({ container }) {
  const u = state.user;
  const caps = state.capabilities;
  let pollTimer = null;

  const services = [
    ['ai', 'sparkles'], ['outlook', 'calendar'], ['emailDelivery', 'mail'],
    ['aipoints', 'trophy'], ['schoolCalendar', 'link'], ['scraping', 'refresh'],
  ];

  mount(container, html`
    <header class="page-head">
      <div><span class="eyebrow"><span class="dot"></span>${t('settings.eyebrow')}</span><h1>${t('nav.settings')}</h1></div>
    </header>

    <div class="settings">
      <section class="card profile-card">
        <span class="avatar avatar-lg">${initials(u.name)}</span>
        <div class="row-main">
          <h2>${u.name}</h2>
          <p class="muted">${u.email}</p>
          <span class="badge ${u.provider === 'microsoft' ? 'badge-ok' : 'badge-warn'}" style="margin-top:8px">${u.provider === 'microsoft' ? t('settings.providerMs') : t('settings.providerLocal')}</span>
        </div>
        <button class="btn" data-logout>${icon('logout')}${t('settings.logout')}</button>
      </section>

      <section class="card">
        <div class="card-head"><h2>${t('settings.prefs')}</h2></div>
        <div class="setting-row">
          <div><b>${t('settings.language')}</b><small>${t('settings.languageHint')}</small></div>
          <div class="segmented">
            <button data-lang="fr" aria-pressed="${getLang() === 'fr'}">Français</button>
            <button data-lang="en" aria-pressed="${getLang() === 'en'}">English</button>
          </div>
        </div>
        <div class="setting-row">
          <div><b>${t('settings.theme')}</b><small>${t('settings.themeHint')}</small></div>
          <div class="segmented" data-themes>
            ${['system', 'light', 'dark'].map(m => html`<button data-theme-mode="${m}" aria-pressed="${getThemePref() === m}">${t(`settings.themes.${m}`)}</button>`)}
          </div>
        </div>
      </section>

      <section class="card" id="calendar">
        <div class="card-head"><h2>${t('settings.calendar')}</h2>${caps.outlook ? html`<span class="badge badge-ok">${icon('check')}Outlook</span>` : ''}</div>
        ${caps.outlook ? html`<div class="notice notice-ok" style="margin-bottom:16px">${icon('check')}<div>${t('settings.outlookOn')}</div></div>` : ''}
        <p class="muted" style="margin-bottom:16px">${t('settings.calendarLede')}</p>
        <form data-ics novalidate>
          <div class="field">
            <label for="ics">${t('settings.icsLabel')}</label>
            <input class="input mono" id="ics" name="icsUrl" type="url" value="${state.prefs.icsUrl || ''}" placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics" spellcheck="false">
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" type="submit">${icon('link')}${t('settings.icsSave')}</button>
            ${state.prefs.icsUrl ? html`<button class="btn btn-danger" type="button" data-ics-remove>${t('settings.icsRemove')}</button>` : ''}
          </div>
        </form>
        <details class="howto">
          <summary>${t('settings.howto')}</summary>
          <ol>
            <li>${t('settings.howOutlook')}</li>
            <li>${t('settings.howGoogle')}</li>
            <li>${t('settings.howAimara')}</li>
          </ol>
        </details>
      </section>

      ${caps.scraping ? html`
      <section class="card">
        <div class="card-head"><h2>${t('settings.sync')}</h2><span data-sync-status></span></div>
        <p class="muted" style="margin-bottom:16px">${t('settings.syncLede')}</p>
        <button class="btn" data-sync>${icon('refresh')}${t('settings.syncNow')}</button>
      </section>` : ''}

      <section class="card">
        <div class="card-head"><h2>${t('settings.services')}</h2></div>
        <p class="muted" style="margin-bottom:12px">${t('settings.servicesLede')}</p>
        <div class="rows">${services.map(([k, ic]) => html`
          <div class="row"><div class="tile-icon">${icon(ic)}</div>
            <div class="row-main"><div class="row-title">${t(`settings.cap.${k}`)}</div><div class="row-sub">${t(`settings.capHint.${k}`)}</div></div>
            <span class="badge ${caps[k] ? 'badge-ok' : ''}">${caps[k] ? t('settings.on') : t('settings.off')}</span></div>`)}</div>
      </section>

      <section class="card">
        <div class="card-head"><h2>${t('settings.data')}</h2></div>
        <div class="setting-row">
          <div><b>${t('settings.clear')}</b><small>${t('settings.clearHint')}</small></div>
          <button class="btn btn-danger" data-clear>${icon('trash')}${t('settings.clearBtn')}</button>
        </div>
        <p class="faint" style="font-size:var(--fs-xs);margin-top:12px">${t('settings.privacy')}</p>
      </section>
    </div>`);

  on(container, 'click', '[data-lang]', (_e, b) => { if (b.dataset.lang !== getLang()) emit('lang', b.dataset.lang); });
  on(container, 'click', '[data-theme-mode]', (_e, b) => {
    setTheme(b.dataset.themeMode);
    container.querySelectorAll('[data-theme-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  on(container, 'click', '[data-logout]', () => logout());
  on(container, 'click', '[data-clear]', async () => {
    if (!(await confirmDialog({ title: t('settings.clear'), message: t('settings.clearConfirm'), confirmLabel: t('settings.clearBtn'), danger: true }))) return;
    storage.clearUserData();
    toast(t('settings.cleared'), { type: 'ok' });
  });

  const icsForm = $('[data-ics]', container);
  async function saveIcs(value) {
    const btn = $('button[type=submit]', icsForm);
    setBusy(btn, true);
    try {
      const { prefs } = await api.put('/me/prefs', { icsUrl: value });
      state.prefs = prefs;
      toast(value ? t('settings.icsSaved') : t('settings.icsRemoved'), { type: 'ok' });
      rerender();
    } catch (err) {
      showFieldErrors(icsForm, { icsUrl: err.message });
    } finally {
      setBusy(btn, false);
    }
  }
  icsForm.addEventListener('submit', e => { e.preventDefault(); saveIcs(icsForm.icsUrl.value.trim()); });
  $('[data-ics-remove]', container)?.addEventListener('click', () => saveIcs(''));

  /* Local sync */
  const syncBtn = $('[data-sync]', container);
  const paintSync = s => {
    const el = $('[data-sync-status]', container);
    if (!el) return;
    const cls = { running: 'badge-warn', done: 'badge-ok', failed: 'badge-danger', empty: 'badge-warn' }[s.status] || '';
    mount(el, html`<span class="badge ${cls}">${t(`settings.syncStatus.${s.status}`)}</span>`);
    setBusy(syncBtn, s.status === 'running');
  };
  const poll = async () => {
    try {
      const s = await api.get('/sync');
      paintSync(s);
      if (s.status === 'running') pollTimer = setTimeout(poll, 3000);
      else if (s.status === 'done' && s.finishedAt > Date.now() - 10000) toast(t('settings.syncDone'), { type: 'ok' });
    } catch { /* ignore */ }
  };
  if (syncBtn) {
    poll();
    syncBtn.addEventListener('click', async () => {
      try {
        await api.post('/sync');
        toast(t('settings.syncStarted'));
        poll();
      } catch (err) { toastError(err); }
    });
  }

  return { destroy: () => clearTimeout(pollTimer) };
}
