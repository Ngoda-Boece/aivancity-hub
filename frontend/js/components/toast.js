import { html, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';

let host;

export function toast(message, { type = 'info', timeout = 4200 } = {}) {
  host ||= document.querySelector('.toasts') || Object.assign(document.body.appendChild(document.createElement('div')), { className: 'toasts' });
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  mount(el, html`${icon(type === 'ok' ? 'check' : type === 'error' ? 'alert' : 'info')}<div>${message}</div>`);
  host.append(el);

  const close = () => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  setTimeout(close, timeout);
  el.addEventListener('click', close);
}

export const toastError = err => toast(err?.message || String(err), { type: 'error', timeout: 6000 });
