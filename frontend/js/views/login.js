import { html, mount, $, formData, showFieldErrors, setBusy } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, getLang } from '../core/i18n.js';
import { state, emit } from '../core/state.js';
import { api } from '../core/api.js';
import { loadSession } from '../core/session.js';
import { isDark, toggleTheme } from '../core/theme.js';
import { navigate } from '../core/router.js';

export default function loginView({ container, query }) {
  const cfg = state.authConfig || {};
  const domain = cfg.domains?.[0] || 'aivancity.ai';

  mount(container, html`
    <div class="auth">
      <section class="auth-hero">
        <div class="auth-grid"></div>
        <div class="auth-orb"></div>
        <a class="brand" href="#/login"><span class="brand-mark">a</span><span class="brand-name">aivancity<span>hub</span></span></a>
        <h1>${t('login.heroA')} <em>${t('login.heroB')}</em></h1>
        <p class="lede">${t('login.lede')}</p>
        <ul class="auth-features">
          ${['planning', 'ai', 'rooms', 'jobs', 'points', 'events'].map(k => html`<li>${t(`login.features.${k}`)}</li>`)}
        </ul>
      </section>

      <section class="auth-panel">
        <div class="auth-top">
          <div class="segmented" role="group" aria-label="${t('settings.language')}">
            <button data-lang="fr" aria-pressed="${getLang() === 'fr'}">FR</button>
            <button data-lang="en" aria-pressed="${getLang() === 'en'}">EN</button>
          </div>
          <button class="btn btn-ghost icon-btn" data-theme aria-label="${t('settings.theme')}">${isDark() ? icon('sun') : icon('moon')}</button>
        </div>

        <div class="auth-card">
          <span class="eyebrow"><span class="dot"></span>${t('login.eyebrow')}</span>
          <h2 style="margin-top:12px">${t('login.title')}</h2>
          <p>${t('login.subtitle')}</p>

          ${query.error ? html`<div class="notice notice-danger" style="margin-bottom:16px">${icon('alert')}<div>${query.error}</div></div>` : ''}

          ${cfg.microsoft ? html`
            <a class="btn btn-primary btn-lg btn-block" href="/api/auth/microsoft">
              <svg viewBox="0 0 21 21" width="18" height="18" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
              ${t('login.microsoft')}
            </a>
            ${cfg.localLogin ? html`<div class="divider">${t('login.or')}</div>` : ''}` : ''}

          ${cfg.localLogin ? html`
            <form novalidate data-form>
              <div class="field">
                <label for="email">${t('login.email')}</label>
                <input class="input" id="email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="prenom.nom@${domain}" required autofocus>
              </div>
              <div class="field">
                <label for="name">${t('login.name')} <span class="faint">(${t('common.optional')})</span></label>
                <input class="input" id="name" name="name" type="text" autocomplete="name" placeholder="${t('login.namePh')}" maxlength="80">
                <span class="hint">${t('login.nameHint')}</span>
              </div>
              <button class="btn ${cfg.microsoft ? '' : 'btn-primary'} btn-lg btn-block" type="submit">${t('login.submit')} ${icon('arrowRight')}</button>
            </form>
            <div class="notice" style="margin-top:20px">${icon('info')}<div class="muted">${t('login.privacy')}</div></div>` : ''}

          ${!cfg.localLogin && !cfg.microsoft ? html`<div class="notice notice-warn">${icon('alert')}<div>${t('login.noMethod')}</div></div>` : ''}
        </div>

        <p class="auth-foot">${t('login.footer')}</p>
      </section>
    </div>`);

  container.addEventListener('click', e => {
    const lang = e.target.closest('[data-lang]')?.dataset.lang;
    if (lang && lang !== getLang()) emit('lang', lang);
    if (e.target.closest('[data-theme]')) {
      toggleTheme();
      mount($('[data-theme]', container), isDark() ? icon('sun') : icon('moon'));
    }
  });

  const form = $('[data-form]', container);
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    setBusy(btn, true);
    try {
      await api.post('/auth/login', formData(form));
      await loadSession();
      navigate('/');
    } catch (err) {
      showFieldErrors(form, err.details || { email: err.message });
    } finally {
      setBusy(btn, false);
    }
  });
}
