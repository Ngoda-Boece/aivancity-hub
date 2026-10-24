import { state } from './state.js';

/** Primary navigation — drives the sidebar, the mobile dock and the palette. */
export const NAV = [
  { path: '/', view: 'home', label: 'nav.home', icon: 'home', dock: true },
  { path: '/schedule', view: 'schedule', label: 'nav.schedule', icon: 'calendar', dock: true },
  { path: '/assistant', view: 'assistant', label: 'nav.assistant', icon: 'sparkles', dock: true },
  { path: '/studies', view: 'studies', label: 'nav.studies', icon: 'cap' },
  { path: '/campus', view: 'campus', label: 'nav.campus', icon: 'map', dock: true },
  { path: '/career', view: 'career', label: 'nav.career', icon: 'briefcase' },
  { path: '/life', view: 'life', label: 'nav.life', icon: 'party' },
  { path: '/settings', view: 'settings', label: 'nav.settings', icon: 'settings' },
];

const ROUTES = [
  { pattern: /^\/login$/, view: 'login', public: true },
  { pattern: /^\/assistant\/([\w-]+)$/, view: 'assistant', params: ['bot'] },
  ...NAV.map(n => ({ pattern: new RegExp(`^${n.path === '/' ? '\\/' : n.path.replace(/\//g, '\\/')}$`), view: n.view })),
];

let current = null;
let renderId = 0;
let hooks = {};

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [pathAndQuery, anchor = ''] = raw.split('#');
  const [path, qs = ''] = pathAndQuery.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs)), anchor };
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (location.hash === target) return render();
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace) render();
}

export const currentPath = () => parseHash().path;

async function render() {
  const id = ++renderId;
  const { path, query, anchor } = parseHash();
  const route = ROUTES.find(r => r.pattern.test(path));
  if (!route) return navigate('/', { replace: true });

  if (!route.public && !state.user) return navigate('/login', { replace: true });
  if (route.view === 'login' && state.user) return navigate('/', { replace: true });

  const params = {};
  (route.params || []).forEach((name, i) => { params[name] = decodeURIComponent(route.pattern.exec(path)[i + 1]); });

  const mod = await import(`../views/${route.view}.js`);
  if (id !== renderId) return; // a newer navigation won

  current?.destroy?.();
  // Each view gets a brand-new element, so its delegated listeners die with it.
  const container = document.createElement('div');
  container.className = 'view';
  hooks.container(route).replaceChildren(container);
  hooks.afterNavigate?.(route, path);

  current = (await mod.default({ container, params, query, anchor })) || null;
  if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function startRouter(h) {
  hooks = h;
  window.addEventListener('hashchange', render);
  return render();
}

export const rerender = () => render();
