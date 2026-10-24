/** App-wide state, event bus and resilient localStorage access. */

export const state = {
  authConfig: null,
  user: null,
  capabilities: {},
  prefs: {},
  campus: null,
};

const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const listen = (name, fn) => {
  const handler = e => fn(e.detail);
  bus.addEventListener(name, handler);
  return () => bus.removeEventListener(name, handler);
};

const PREFIX = 'ah:';

/** localStorage can throw (private mode, blocked storage): never let it break the app. */
export const storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* quota or disabled */ }
  },
  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
  clearUserData() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(`${PREFIX}u:`)).forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
  },
};

/** Per-user storage key, so two students sharing a browser never see each other's data. */
export const userKey = key => `u:${state.user?.email || 'anon'}:${key}`;
