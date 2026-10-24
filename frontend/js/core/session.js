import { state, emit } from './state.js';
import { api } from './api.js';

/** Loads the signed-in user (or leaves state.user null on 401). */
export async function loadSession() {
  try {
    const { user } = await api.get('/auth/session');
    if (!user) { state.user = null; return; }
    const me = await api.get('/me');
    Object.assign(state, { user: me.user, capabilities: me.capabilities, prefs: me.prefs });
    state.campus ||= await api.get('/campus');
  } catch (err) {
    if (err.status !== 401) throw err;
    state.user = null;
  }
}

export async function logout() {
  await api.post('/auth/logout').catch(() => {});
  Object.assign(state, { user: null, capabilities: {}, prefs: {} });
  emit('logout');
}
