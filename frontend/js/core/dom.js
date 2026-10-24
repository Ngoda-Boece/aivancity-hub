/**
 * Safe HTML templating. Every value interpolated into html`` is escaped unless
 * it is itself a SafeHtml (another html`` result, or an explicit raw()). This
 * makes XSS impossible by default instead of relying on per-call care.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export const escapeHtml = value => String(value ?? '').replace(/[&<>"'`]/g, c => ESCAPES[c]);

export class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/** Marks trusted, developer-authored markup (icons, rendered markdown). */
export const raw = value => new SafeHtml(String(value ?? ''));

function stringify(value) {
  if (value == null || value === false || value === true) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(stringify).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += stringify(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

export function mount(el, content) {
  el.innerHTML = stringify(content);
  return el;
}

/** Only http(s) and mailto links may reach an href. */
export function safeUrl(url) {
  try {
    const u = new URL(String(url), location.origin);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : '#';
  } catch {
    return '#';
  }
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Delegated event listener. Returns an unsubscribe function. */
export function on(root, event, selector, handler, options) {
  const listener = e => {
    const target = e.target.closest?.(selector);
    if (target && root.contains(target)) handler(e, target);
  };
  root.addEventListener(event, listener, options);
  return () => root.removeEventListener(event, listener, options);
}

/** Collects named form fields into a plain object. */
export function formData(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
}

/** Shows server-side validation errors next to their fields. */
export function showFieldErrors(form, details = {}) {
  $$('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
  $$('.field .error', form).forEach(el => el.remove());
  for (const [name, message] of Object.entries(details)) {
    const input = form.elements[name];
    if (!input) continue;
    input.setAttribute('aria-invalid', 'true');
    const err = document.createElement('div');
    err.className = 'error';
    err.textContent = message;
    input.closest('.field')?.append(err);
  }
  $('[aria-invalid="true"]', form)?.focus();
}

export function setBusy(button, busy) {
  if (!button) return;
  button.classList.toggle('loading', busy);
  button.disabled = busy;
}

export const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
