'use strict';

const express = require('express');
const { BOTS_BY_ID, systemPromptFor } = require('../data/bots');
const { streamChat } = require('../services/mistral');
const { HttpError } = require('../lib/http');
const { rateLimit } = require('../lib/rateLimit');
const { cleanText } = require('../lib/text');

const router = express.Router();

const MAX_MESSAGES = 30;
const MAX_CHARS = 6000;
const MAX_TOTAL_CHARS = 40000;

/** Only user/assistant turns from the client — the system prompt is ours alone. */
function sanitizeHistory(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, 'validation', 'Conversation vide.');
  const messages = raw.slice(-MAX_MESSAGES).map(m => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: cleanText(m?.content, MAX_CHARS),
  })).filter(m => m.content);

  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length;
    if (total > MAX_TOTAL_CHARS) { messages.splice(0, i + 1); break; }
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    throw new HttpError(400, 'validation', 'Le dernier message doit venir de l’étudiant.');
  }
  return messages;
}

router.post('/chat', rateLimit({ windowMs: 60 * 1000, max: 15, name: 'chat' }), rateLimit({ windowMs: 24 * 3600 * 1000, max: 300, name: 'chat-day' }), async (req, res, next) => {
  try {
    const bot = BOTS_BY_ID[req.body?.botId];
    if (!bot) throw new HttpError(400, 'unknown_bot', 'Assistant inconnu.');
    const history = sanitizeHistory(req.body.messages);
    const lang = req.body.lang === 'en' ? 'en' : 'fr';

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
    };
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      await streamChat({
        messages: [{ role: 'system', content: systemPromptFor(bot, { firstName: req.user.name.split(' ')[0], lang }) }, ...history],
        temperature: bot.temperature,
        signal: controller.signal,
        onDelta: text => { start(); send('delta', { text }); },
      });
      start();
      send('done', {});
      res.end();
    } catch (err) {
      if (controller.signal.aborted) return res.end();
      if (!started) throw err; // nothing sent yet → regular JSON error
      send('error', { message: err instanceof HttpError ? err.message : 'La réponse a été interrompue.' });
      res.end();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.sanitizeHistory = sanitizeHistory;
