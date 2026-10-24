import { storage, emit } from './state.js';

export const getThemePref = () => storage.get('theme', 'system');

export function applyTheme(mode = getThemePref()) {
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
}

export function isDark() {
  const forced = document.documentElement.getAttribute('data-theme');
  return forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}

export function setTheme(mode) {
  storage.set('theme', mode);
  applyTheme(mode);
  emit('theme', mode);
}

export const toggleTheme = () => setTheme(isDark() ? 'light' : 'dark');

matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => emit('theme', getThemePref()));
