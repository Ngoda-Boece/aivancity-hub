import { html, mount, $, $$ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, pick } from '../core/i18n.js';
import { state } from '../core/state.js';
import { navigate, NAV } from '../core/router.js';

/** Global command palette (Ctrl/⌘+K or "/"): jump anywhere, start actions. */

function commands() {
  const list = NAV.map(n => ({ group: t('palette.pages'), label: t(n.label), icon: n.icon, run: () => navigate(n.path), keywords: n.path }));
  for (const bot of state.campus?.bots || []) {
    list.push({ group: t('palette.assistants'), label: pick(bot.name), hint: pick(bot.tagline), icon: 'sparkles', run: () => navigate(`/assistant/${bot.id}`) });
  }
  list.push(
    { group: t('palette.actions'), label: t('palette.book'), icon: 'door', run: () => navigate('/campus?book=1') },
    { group: t('palette.actions'), label: t('palette.jobs'), icon: 'briefcase', run: () => navigate('/career') },
    { group: t('palette.actions'), label: t('palette.focus'), icon: 'timer', run: () => navigate('/studies#focus') },
    { group: t('palette.actions'), label: t('palette.theme'), icon: 'moon', run: () => document.dispatchEvent(new CustomEvent('ah:toggle-theme')) },
  );
  for (const room of state.campus?.rooms || []) {
    list.push({ group: t('palette.rooms'), label: `${room.number} · ${room.name}`, hint: room.kind ? pick(room.kind) : '', icon: 'pin', run: () => navigate(`/campus?room=${room.number}`) });
  }
  for (const link of state.campus?.links || []) {
    list.push({ group: t('palette.services'), label: pick(link.name), hint: pick(link.desc), icon: 'external', run: () => window.open(link.url, '_blank', 'noopener') });
  }
  return list;
}

const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let open = false;

export function openPalette() {
  if (open || !state.user) return;
  open = true;
  const all = commands();
  const dialog = document.createElement('dialog');
  dialog.className = 'palette';
  mount(dialog, html`
    <div class="palette-input">${icon('search')}<input type="text" placeholder="${t('palette.placeholder')}" aria-label="${t('palette.placeholder')}" autocomplete="off"><kbd>Esc</kbd></div>
    <div class="palette-list" role="listbox"></div>`);
  document.body.append(dialog);

  const input = $('input', dialog);
  const listEl = $('.palette-list', dialog);
  let shown = [];
  let active = 0;

  function render() {
    const q = norm(input.value.trim());
    shown = q ? all.filter(c => norm(`${c.label} ${c.hint || ''} ${c.keywords || ''}`).includes(q)) : all.filter(c => c.group !== t('palette.rooms'));
    shown = shown.slice(0, 40);
    active = Math.min(active, Math.max(0, shown.length - 1));
    let lastGroup = null;
    mount(listEl, shown.length ? shown.map((c, i) => {
      const head = c.group !== lastGroup ? html`<div class="palette-group">${c.group}</div>` : '';
      lastGroup = c.group;
      return html`${head}<button class="palette-item" role="option" data-i="${i}" aria-selected="${i === active}">${icon(c.icon)}<span>${c.label}</span>${c.hint ? html`<small class="truncate">${c.hint}</small>` : ''}</button>`;
    }) : html`<div class="palette-empty">${t('palette.empty')}</div>`);
  }

  function select(i) {
    active = i;
    $$('.palette-item', listEl).forEach(el => el.setAttribute('aria-selected', String(+el.dataset.i === i)));
    $(`.palette-item[data-i="${i}"]`, listEl)?.scrollIntoView({ block: 'nearest' });
  }

  function run(i) {
    const cmd = shown[i];
    dialog.close();
    cmd?.run();
  }

  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(Math.min(active + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(active); }
  });
  listEl.addEventListener('click', e => { const b = e.target.closest('.palette-item'); if (b) run(+b.dataset.i); });
  listEl.addEventListener('mousemove', e => { const b = e.target.closest('.palette-item'); if (b && +b.dataset.i !== active) select(+b.dataset.i); });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { open = false; dialog.remove(); });

  render();
  dialog.showModal();
  input.focus();
}

export function installPaletteShortcut() {
  document.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      openPalette();
    }
  });
}
