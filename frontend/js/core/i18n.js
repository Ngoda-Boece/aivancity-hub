import fr from '../i18n/fr.js';
import en from '../i18n/en.js';
import { storage } from './state.js';

const DICTS = { fr, en };
let lang = storage.get('lang') || (navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en');
if (!DICTS[lang]) lang = 'fr';
document.documentElement.lang = lang;

export const getLang = () => lang;

export function setLang(next) {
  if (!DICTS[next]) return;
  lang = next;
  storage.set('lang', next);
  document.documentElement.lang = next;
}

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);

/** t('home.greet', { name }) — falls back to French, then to the key itself. */
export function t(key, vars) {
  let s = lookup(DICTS[lang], key) ?? lookup(DICTS.fr, key) ?? key;
  if (typeof s === 'function') return s(vars || {});
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  return s;
}

/** Picks the right language from a { fr, en } object coming from the API. */
export const pick = value => (value && typeof value === 'object' ? value[lang] ?? value.fr ?? '' : value ?? '');

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
