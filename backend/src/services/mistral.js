'use strict';

const config = require('../config');
const { HttpError } = require('../lib/http');

/**
 * Streams a chat completion from Mistral. Calls onDelta(text) for each token
 * chunk and resolves with the full reply. Aborts upstream when `signal` fires
 * (e.g. the student pressed "stop" or closed the tab).
 */
async function streamChat({ messages, temperature, signal, onDelta }) {
  if (!config.mistral.apiKey) {
    throw new HttpError(503, 'ai_not_configured', "L'assistant IA n'est pas configuré (MISTRAL_API_KEY manquante).");
  }

  const res = await fetch(config.mistral.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${config.mistral.apiKey}`,
    },
    body: JSON.stringify({
      model: config.mistral.model,
      messages,
      temperature,
      max_tokens: config.mistral.maxTokens,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[mistral] HTTP ${res.status}: ${detail.slice(0, 300)}`);
    if (res.status === 401) throw new HttpError(502, 'ai_auth', 'Clé API Mistral invalide.');
    if (res.status === 429) throw new HttpError(503, 'ai_busy', "Le service IA est saturé, réessayez dans un instant.");
    throw new HttpError(502, 'ai_error', 'Le service IA a renvoyé une erreur.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return full;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) { full += delta; onDelta(delta); }
      } catch { /* partial or keep-alive line */ }
    }
  }
  return full;
}

module.exports = { streamChat };
