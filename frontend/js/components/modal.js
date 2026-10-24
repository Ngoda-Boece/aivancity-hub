import { html, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';

/**
 * Opens a native <dialog> (focus trap, Esc to close, backdrop for free).
 * Returns { el, body, close }. `onMount(dialog)` wires up behaviour.
 */
export function openModal({ title, body, footer, onMount, onClose, wide = false }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  if (wide) dialog.style.width = 'min(820px, calc(100vw - 32px))';
  dialog.setAttribute('aria-label', title);
  mount(dialog, html`
    <header class="modal-head">
      <h2>${title}</h2>
      <button class="btn btn-ghost icon-btn" data-close aria-label="${t('common.close')}">${icon('x')}</button>
    </header>
    <div class="modal-body">${body}</div>
    ${footer ? html`<footer class="modal-foot">${footer}</footer>` : ''}
  `);
  document.body.append(dialog);

  const close = () => dialog.open && dialog.close();
  dialog.addEventListener('close', () => { onClose?.(); dialog.remove(); });
  dialog.addEventListener('click', e => {
    if (e.target === dialog || e.target.closest('[data-close]')) close();
  });

  dialog.showModal();
  onMount?.(dialog, close);
  return { el: dialog, body: dialog.querySelector('.modal-body'), close };
}

export function confirmDialog({ title, message, confirmLabel, danger = false }) {
  return new Promise(resolve => {
    let answered = false;
    openModal({
      title,
      body: html`<p>${message}</p>`,
      footer: html`
        <button class="btn" data-close>${t('common.cancel')}</button>
        <button class="btn ${danger ? 'btn-accent' : 'btn-primary'}" data-ok>${confirmLabel || t('common.confirm')}</button>`,
      onMount(dialog, close) {
        dialog.querySelector('[data-ok]').addEventListener('click', () => { answered = true; resolve(true); close(); });
        dialog.querySelector('[data-ok]').focus();
      },
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}
