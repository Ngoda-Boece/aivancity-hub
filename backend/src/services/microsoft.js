'use strict';

const crypto = require('crypto');
const config = require('../config');
const { HttpError, fetchWithTimeout } = require('../lib/http');

/**
 * Microsoft Entra ID (Azure AD) sign-in — authorization code flow with PKCE —
 * plus the two Graph calls the hub needs: reading the Outlook calendar and
 * sending mail as the student. Active only when MS_CLIENT_ID, MS_CLIENT_SECRET
 * and MS_REDIRECT_URI are configured.
 */

const ms = config.microsoft;
const SCOPES = 'openid profile email offline_access User.Read Calendars.Read Mail.Send';
const authority = () => `https://login.microsoftonline.com/${encodeURIComponent(ms.tenantId)}/oauth2/v2.0`;
const GRAPH = 'https://graph.microsoft.com/v1.0';

const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function createAuthRequest() {
  const state = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const params = new URLSearchParams({
    client_id: ms.clientId,
    response_type: 'code',
    redirect_uri: ms.redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return { url: `${authority()}/authorize?${params}`, state, verifier };
}

async function tokenRequest(body) {
  const res = await fetchWithTimeout(`${authority()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: ms.clientId, client_secret: ms.clientSecret, scope: SCOPES, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('[microsoft] token error:', json.error, json.error_description?.split('\n')[0]);
    throw new HttpError(401, 'ms_token', 'Connexion Microsoft refusée ou expirée.');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
}

const exchangeCode = (code, verifier) =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: ms.redirectUri, code_verifier: verifier });

/** Returns a valid access token, refreshing it when expired. Mutates `state.ms`. */
async function accessToken(state) {
  if (!state?.ms) throw new HttpError(401, 'ms_reconnect', 'Reconnectez-vous avec Microsoft.');
  if (Date.now() < state.ms.expiresAt) return state.ms.accessToken;
  if (!state.ms.refreshToken) throw new HttpError(401, 'ms_reconnect', 'Reconnectez-vous avec Microsoft.');
  state.ms = await tokenRequest({ grant_type: 'refresh_token', refresh_token: state.ms.refreshToken });
  return state.ms.accessToken;
}

async function graph(state, path, options = {}) {
  const token = await accessToken(state);
  const res = await fetchWithTimeout(`${GRAPH}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  }, 15000);
  if (res.status === 202 || res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn(`[graph] ${path} → ${res.status}`, json.error?.code);
    throw new HttpError(res.status === 403 ? 403 : 502, 'graph_error', json.error?.message || 'Erreur Microsoft Graph.');
  }
  return json;
}

async function getProfile(state) {
  const me = await graph(state, '/me?$select=displayName,mail,userPrincipalName');
  return { name: me.displayName, email: (me.mail || me.userPrincipalName || '').toLowerCase() };
}

async function getCalendar(state, from, to) {
  const q = new URLSearchParams({
    startDateTime: from.toISOString(),
    endDateTime: to.toISOString(),
    $select: 'id,subject,start,end,location,bodyPreview,isAllDay,isCancelled',
    $orderby: 'start/dateTime',
    $top: '250',
  });
  const json = await graph(state, `/me/calendarView?${q}`, { headers: { Prefer: 'outlook.timezone="UTC"' } });
  return (json.value || []).filter(e => !e.isCancelled).map(e => ({
    id: e.id,
    title: e.subject || '(sans titre)',
    start: new Date(`${e.start.dateTime}Z`).toISOString(),
    end: new Date(`${e.end.dateTime}Z`).toISOString(),
    location: e.location?.displayName || '',
    description: (e.bodyPreview || '').slice(0, 300),
    allDay: e.isAllDay,
  }));
}

async function sendMail(state, { to, subject, html, replyTo }) {
  await graph(state, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
        ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}),
      },
      saveToSentItems: true,
    }),
  });
}

module.exports = { createAuthRequest, exchangeCode, getProfile, getCalendar, sendMail };
