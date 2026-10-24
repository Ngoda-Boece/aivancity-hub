import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';

/** Small shared UI fragments. */

export const demoBadge = () => html`<span class="badge badge-demo" title="${t('common.demoHint')}">${t('common.demo')}</span>`;

export const sourceBadge = source => {
  if (!source || source === 'demo') return demoBadge();
  return html`<span class="badge badge-ok">${icon('check')}${t(`sources.${source}`)}</span>`;
};

export const skeletonRows = (n = 3) => html`<div class="rows">${Array.from({ length: n }, () => html`
  <div class="row"><div class="skeleton" style="width:40px;height:40px;border-radius:12px"></div>
  <div class="row-main"><div class="skeleton" style="width:60%;margin-bottom:6px"></div><div class="skeleton" style="width:35%;height:11px"></div></div></div>`)}</div>`;

export const emptyState = (iconName, title, text, action = '') => html`
  <div class="empty">${icon(iconName)}<strong>${title}</strong>${text ? html`<p>${text}</p>` : ''}${action}</div>`;

export const errorState = (err, retryAttr = 'data-retry') => html`
  <div class="empty">${icon('alert')}<strong>${t('errors.loadTitle')}</strong><p>${err?.message || t('errors.generic')}</p>
  <button class="btn btn-sm" ${retryAttr}>${icon('refresh')}${t('common.retry')}</button></div>`;

export function pointsLevel(points, levels = []) {
  const sorted = [...levels].sort((a, b) => a.min - b.min);
  let current = sorted[0];
  let next = null;
  for (const l of sorted) {
    if (points >= l.min) current = l;
    else { next = l; break; }
  }
  const progress = next ? Math.round(((points - current.min) / (next.min - current.min)) * 100) : 100;
  return { current, next, progress };
}
