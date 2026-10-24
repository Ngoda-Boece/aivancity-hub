import { html, mount, raw, $, on } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, pick, getLang } from '../core/i18n.js';
import { state, storage, userKey } from '../core/state.js';
import { streamChat } from '../core/api.js';
import { renderMarkdown } from '../core/markdown.js';
import { navigate } from '../core/router.js';
import { toast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';

const BOT_ICON = { campus: 'compass', email: 'pen', wellness: 'heart', interview: 'mic', study: 'book', career: 'briefcase' };
const BOT_COLOR = { campus: 'var(--c1)', email: 'var(--c2)', wellness: 'var(--c3)', interview: 'var(--c4)', study: 'var(--c5)', career: 'var(--c6)' };
const MAX_STORED = 60;

export default function assistantView({ container, params }) {
  const bots = state.campus?.bots || [];
  const bot = bots.find(b => b.id === params.bot);
  if (params.bot && !bot) return navigate('/assistant', { replace: true });

  const aiReady = state.capabilities.ai;
  const key = bot ? userKey(`chat:${bot.id}`) : null;
  let messages = bot ? storage.get(key, []) : [];
  let controller = null;

  mount(container, html`
    <div class="assistant ${bot ? 'has-chat' : ''}">
      <aside class="bot-list">
        <header class="page-head" style="margin-bottom:20px">
          <div><span class="eyebrow"><span class="dot"></span>${t('assistant.eyebrow')}</span><h1>${t('nav.assistant')}</h1><p>${t('assistant.lede')}</p></div>
        </header>
        ${!aiReady ? html`<div class="notice notice-warn" style="margin-bottom:16px">${icon('alert')}<div><strong>${t('assistant.offTitle')}</strong>${t('assistant.offBody')}</div></div>` : ''}
        <div class="bot-cards">
          ${bots.map(b => html`
            <a class="bot-card ${b.id === bot?.id ? 'active' : ''}" href="#/assistant/${b.id}" style="--c:${BOT_COLOR[b.id] || 'var(--c1)'}">
              <span class="bot-avatar">${icon(BOT_ICON[b.id] || 'sparkles')}</span>
              <span class="bot-text"><b>${pick(b.name)}</b><small>${pick(b.tagline)}</small></span>
              ${storage.get(userKey(`chat:${b.id}`), []).length ? html`<span class="badge">${t('assistant.resume')}</span>` : icon('chevronRight')}
            </a>`)}
        </div>
      </aside>

      <section class="chat card card-flush">
        ${bot ? html`
          <header class="chat-head" style="--c:${BOT_COLOR[bot.id]}">
            <a class="btn btn-ghost icon-btn chat-back" href="#/assistant" aria-label="${t('common.back')}">${icon('chevronLeft')}</a>
            <span class="bot-avatar">${icon(BOT_ICON[bot.id] || 'sparkles')}</span>
            <div class="chat-title"><b>${pick(bot.name)}</b><small>${pick(bot.tagline)}</small></div>
            <button class="btn btn-ghost btn-sm" data-reset>${icon('refresh')}<span class="hide-sm">${t('assistant.new')}</span></button>
          </header>
          ${bot.id === 'wellness' ? html`<div class="notice notice-info chat-safety">${icon('heart')}<div>${t('assistant.safety')}</div></div>` : ''}
          <div class="chat-scroll" data-scroll><div class="chat-log" data-log aria-live="polite"></div></div>
          <form class="composer" data-form>
            <textarea class="composer-input" name="msg" rows="1" placeholder="${aiReady ? t('assistant.placeholder', { name: pick(bot.name).split(' ')[0] }) : t('assistant.offShort')}" ${aiReady ? '' : 'disabled'} maxlength="6000" aria-label="${t('assistant.placeholder', { name: '' })}"></textarea>
            <button class="btn btn-accent icon-btn" type="submit" data-send ${aiReady ? '' : 'disabled'} aria-label="${t('assistant.send')}">${icon('send')}</button>
          </form>
          <p class="composer-hint">${t('assistant.hint')}</p>` : html`
          <div class="chat-placeholder">
            <div class="orb-stack">${bots.map(b => html`<span style="--c:${BOT_COLOR[b.id]}">${icon(BOT_ICON[b.id])}</span>`)}</div>
            <h2>${t('assistant.pickTitle')}</h2><p class="muted">${t('assistant.pickBody')}</p>
          </div>`}
      </section>
    </div>`);

  if (!bot) return;

  const log = $('[data-log]', container);
  const scroller = $('[data-scroll]', container);
  const form = $('[data-form]', container);
  const input = form.msg;
  const sendBtn = $('[data-send]', container);

  const save = () => storage.set(key, messages.slice(-MAX_STORED));
  const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
  const scrollDown = (force = false) => { if (force || nearBottom()) scroller.scrollTop = scroller.scrollHeight; };

  const bubble = (m, i) => m.role === 'user'
    ? html`<div class="msg user"><div class="bubble">${m.content}</div></div>`
    : html`<div class="msg bot ${m.error ? 'error' : ''}" style="--c:${BOT_COLOR[bot.id]}">
        <span class="bot-avatar sm">${icon(BOT_ICON[bot.id])}</span>
        <div class="bubble">
          ${m.error ? html`<p>${m.content}</p><button class="btn btn-sm" data-retry>${icon('refresh')}${t('common.retry')}</button>`
            : m.content ? html`<div class="prose">${raw(renderMarkdown(m.content))}</div>` : html`<div class="typing"><i></i><i></i><i></i></div>`}
          ${!m.error && m.content && !m.streaming ? html`<div class="msg-tools"><button class="btn btn-ghost btn-sm" data-copy="${i}">${icon('copy')}${t('common.copy')}</button></div>` : ''}
        </div>
      </div>`;

  function render() {
    if (!messages.length) {
      mount(log, html`<div class="chat-intro">
        <span class="bot-avatar lg" style="--c:${BOT_COLOR[bot.id]}">${icon(BOT_ICON[bot.id])}</span>
        <h2>${pick(bot.name)}</h2><p class="muted">${pick(bot.tagline)}</p>
        <div class="starters">${(pick(bot.starters) || []).map(s => html`<button class="starter" data-starter="${s}" ${aiReady ? '' : 'disabled'}>${s}${icon('arrowUpRight')}</button>`)}</div>
      </div>`);
      return;
    }
    mount(log, messages.map(bubble));
  }

  let frame = 0;
  const renderSoon = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); scrollDown(); }); };

  function setStreaming(on) {
    mount(sendBtn, on ? icon('stop') : icon('send'));
    sendBtn.setAttribute('aria-label', on ? t('assistant.stop') : t('assistant.send'));
    sendBtn.classList.toggle('btn-primary', on);
    sendBtn.classList.toggle('btn-accent', !on);
    sendBtn.type = on ? 'button' : 'submit';
  }

  async function ask(text) {
    if (controller || !aiReady) return;
    messages = messages.filter(m => !m.error);
    if (text) messages.push({ role: 'user', content: text });
    const reply = { role: 'assistant', content: '', streaming: true };
    messages.push(reply);
    render();
    scrollDown(true);
    controller = new AbortController();
    setStreaming(true);
    try {
      await streamChat({
        botId: bot.id,
        lang: getLang(),
        signal: controller.signal,
        messages: messages.filter(m => m !== reply && !m.error).map(({ role, content }) => ({ role, content })),
        onDelta: d => { reply.content += d; renderSoon(); },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        if (!reply.content) Object.assign(reply, { content: err.message, error: true });
        else toast(err.message, { type: 'error' });
      }
    } finally {
      reply.streaming = false;
      if (!reply.content) messages.pop();
      controller = null;
      setStreaming(false);
      save();
      render();
      scrollDown();
      input.focus();
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = '';
    ask(text);
  });
  sendBtn.addEventListener('click', () => { if (controller) controller.abort(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  });

  on(log, 'click', '[data-starter]', (_e, b) => ask(b.dataset.starter));
  on(log, 'click', '[data-retry]', () => ask(null));
  on(log, 'click', '[data-copy]', async (_e, b) => {
    try {
      await navigator.clipboard.writeText(messages[+b.dataset.copy].content);
      toast(t('common.copied'), { type: 'ok', timeout: 1800 });
    } catch { toast(t('errors.clipboard'), { type: 'error' }); }
  });
  $('[data-reset]', container).addEventListener('click', async () => {
    if (!messages.length) return;
    if (!(await confirmDialog({ title: t('assistant.new'), message: t('assistant.resetConfirm'), confirmLabel: t('assistant.new') }))) return;
    controller?.abort();
    messages = [];
    save();
    render();
  });

  render();
  scrollDown(true);
  if (aiReady && matchMedia('(min-width: 961px)').matches) input.focus();

  return { destroy: () => controller?.abort() };
}
