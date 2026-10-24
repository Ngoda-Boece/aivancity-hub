import { html, mount, $, $$, initials } from './core/dom.js';
import { icon } from './core/icons.js';
import { t, getLang, setLang } from './core/i18n.js';
import { state, listen } from './core/state.js';
import { api } from './core/api.js';
import { applyTheme, isDark, toggleTheme } from './core/theme.js';
import { loadSession } from './core/session.js';
import { NAV, startRouter, navigate, rerender } from './core/router.js';
import { openPalette, installPaletteShortcut } from './components/palette.js';
import { openModal } from './components/modal.js';
import { toast } from './components/toast.js';

const app = document.getElementById('app');
let shell = null;

applyTheme();
document.addEventListener('ah:toggle-theme', toggleTheme);

/* ---------------- Shell ---------------- */

const brand = html`<a class="brand" href="#/"><span class="brand-mark">a</span><span class="brand-name">aivancity<span>hub</span></span></a>`;

function navLink(item, variant) {
  const label = t(item.label);
  return variant === 'dock'
    ? html`<a href="#${item.path}" data-path="${item.path}">${icon(item.icon)}<span>${label}</span></a>`
    : html`<a class="nav-link" href="#${item.path}" data-path="${item.path}">${icon(item.icon)}<span>${label}</span></a>`;
}

function renderShell() {
  const u = state.user;
  const group = views => NAV.filter(n => views.includes(n.view)).map(n => navLink(n));
  shell = document.createElement('div');
  shell.className = 'shell';
  mount(shell, html`
    <a class="sr-only" href="#content">${t('common.skip')}</a>
    <aside class="sidebar" aria-label="${t('nav.aria')}">
      ${brand}
      <nav class="nav">
        <div class="nav-label">${t('nav.groupSpace')}</div>
        ${group(['home', 'schedule', 'assistant', 'studies'])}
        <div class="nav-label">${t('nav.groupCampus')}</div>
        ${group(['campus', 'career', 'life'])}
      </nav>
      <div class="sidebar-foot">
        <a class="user-chip" href="#/settings" data-path="/settings">
          <span class="avatar">${initials(u.name)}</span>
          <span class="who"><strong class="truncate">${u.name}</strong><span class="truncate">${u.email}</span></span>
          ${icon('settings')}
        </a>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        ${brand}
        <span class="topbar-title" data-title></span>
        <div class="topbar-actions">
          <button class="search-trigger" data-action="palette" aria-label="${t('palette.open')}">${icon('search')}<span>${t('palette.trigger')}</span><kbd>Ctrl K</kbd></button>
          <button class="btn btn-ghost btn-sm mono" data-action="lang" title="${t('settings.language')}">${getLang() === 'fr' ? 'EN' : 'FR'}</button>
          <button class="btn btn-ghost icon-btn" data-action="theme" aria-label="${t('settings.theme')}"></button>
        </div>
      </header>
      <main class="content" id="content" tabindex="-1"></main>
    </div>
    <nav class="dock" aria-label="${t('nav.aria')}">
      ${NAV.filter(n => n.dock).map(n => navLink(n, 'dock'))}
      <button data-action="more">${icon('menu')}<span>${t('nav.more')}</span></button>
    </nav>
    <div class="toasts"></div>
  `);
  app.replaceChildren(shell);
  updateThemeIcon();

  shell.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'palette') openPalette();
    else if (action === 'theme') toggleTheme();
    else if (action === 'lang') switchLang(getLang() === 'fr' ? 'en' : 'fr');
    else if (action === 'more') openMoreSheet();
  });
}

function updateThemeIcon() {
  const btn = shell && $('[data-action="theme"]', shell);
  if (btn) mount(btn, isDark() ? icon('sun') : icon('moon'));
}

export function switchLang(lang) {
  setLang(lang);
  shell = null;
  rerender();
}

function openMoreSheet() {
  openModal({
    title: t('nav.more'),
    body: html`<div class="more-grid">${NAV.map(n => html`<a class="more-item" href="#${n.path}" data-close>${icon(n.icon)}<span>${t(n.label)}</span></a>`)}</div>`,
  });
}

function highlightNav(path) {
  const section = `/${path.split('/')[1] || ''}`;
  $$('[data-path]', shell).forEach(a => {
    if (a.dataset.path === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const item = NAV.find(n => n.path === section);
  const title = $('[data-title]', shell);
  if (title) title.textContent = item ? t(item.label) : '';
  document.title = item && item.view !== 'home' ? `${t(item.label)} · Aivancity Hub` : 'Aivancity Hub';
}

/* ---------------- Boot ---------------- */

async function boot() {
  installPaletteShortcut();
  window.addEventListener('scroll', () => $('.topbar')?.classList.toggle('scrolled', scrollY > 4), { passive: true });
  listen('theme', updateThemeIcon);
  listen('lang', switchLang);

  listen('logout', () => { shell = null; navigate('/login'); });
  listen('unauthorized', () => {
    if (!state.user) return;
    state.user = null;
    shell = null;
    toast(t('errors.sessionExpired'), { type: 'error' });
    navigate('/login');
  });

  try {
    state.authConfig = await api.get('/auth/config');
    await loadSession();
  } catch (err) {
    console.error(err);
    mount(app, html`<div class="boot-error">${icon('wifiOff')}<h1>${t('errors.offlineTitle')}</h1><p>${t('errors.offlineBody')}</p><button class="btn btn-primary">${t('common.retry')}</button></div>`);
    $('button', app).addEventListener('click', () => location.reload());
    return;
  }

  await startRouter({
    container(route) {
      if (route.public) {
        shell = null;
        app.replaceChildren();
        return app;
      }
      if (!shell || !app.contains(shell)) renderShell();
      return $('#content', shell);
    },
    afterNavigate(route, path) {
      if (!route.public) highlightNav(path);
      window.scrollTo({ top: 0 });
    },
  });
}

boot();
