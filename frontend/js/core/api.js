import { t } from './i18n.js';
import { emit } from './state.js';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const HEADERS = { 'X-Requested-With': 'aivancity-hub' };

async function send(method, path, body, { signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { ...HEADERS, 'Content-Type': 'application/json' } : HEADERS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', t('errors.network'));
  }
  return res;
}

async function parse(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error || {};
    if (res.status === 401 && e.code === 'unauthenticated') emit('unauthorized');
    throw new ApiError(res.status, e.code || `http_${res.status}`, e.message || t('errors.generic'), e.details);
  }
  return data;
}

const request = async (method, path, body, opts) => parse(await send(method, path, body, opts));

export const api = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body = {}, opts) => request('POST', path, body, opts),
  put: (path, body = {}, opts) => request('PUT', path, body, opts),
  del: (path, opts) => request('DELETE', path, undefined, opts),
};

/**
 * Streams an assistant reply (Server-Sent Events over POST). Calls onDelta
 * with each text chunk; resolves when the server sends `done`.
 */
export async function streamChat({ botId, messages, lang, signal, onDelta }) {
  const res = await send('POST', '/chat', { botId, messages, lang }, { signal });
  if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) return parse(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || data == null) continue;
      const payload = JSON.parse(data);
      if (event === 'delta') onDelta(payload.text);
      else if (event === 'error') throw new ApiError(502, 'stream', payload.message);
      else if (event === 'done') return;
    }
  }
}
