'use strict';

const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = process.env;
const isProd = env.NODE_ENV === 'production';

function list(value, fallback = []) {
  if (!value) return fallback;
  return value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

let jwtSecret = env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProd) {
    // Refuse to boot with a guessable secret: anyone could forge sessions.
    throw new Error('JWT_SECRET must be set (≥ 32 characters) when NODE_ENV=production');
  }
  jwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn('[config] JWT_SECRET missing or too short — using a random secret (sessions reset on restart).');
}

const microsoft = {
  clientId: env.MS_CLIENT_ID || '',
  clientSecret: env.MS_CLIENT_SECRET || '',
  tenantId: env.MS_TENANT_ID || 'organizations',
  redirectUri: env.MS_REDIRECT_URI || '',
};
microsoft.enabled = Boolean(microsoft.clientId && microsoft.clientSecret && microsoft.redirectUri);

const smtp = {
  host: env.SMTP_HOST || '',
  port: int(env.SMTP_PORT, 587),
  secure: env.SMTP_SECURE === 'true',
  user: env.SMTP_USER || '',
  pass: env.SMTP_PASS || '',
  from: env.SMTP_FROM || env.SMTP_USER || '',
};
smtp.enabled = Boolean(smtp.host && smtp.user && smtp.pass);

module.exports = {
  isProd,
  port: int(env.PORT, 3000),
  publicUrl: env.PUBLIC_URL || '',
  trustProxy: env.TRUST_PROXY === 'true',
  jwtSecret,
  sessionTtlHours: int(env.SESSION_TTL_HOURS, 12),
  allowedEmailDomains: list(env.ALLOWED_EMAIL_DOMAINS, ['aivancity.ai', 'aivancity.education']),
  // Email-only sign-in (no identity proof). Disable it once Microsoft SSO is configured.
  allowLocalLogin: env.ALLOW_LOCAL_LOGIN !== 'false',
  dataDir: env.DATA_DIR || path.join(__dirname, '..', 'data'),

  mistral: {
    apiKey: env.MISTRAL_API_KEY || '',
    apiUrl: env.MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions',
    model: env.MISTRAL_MODEL || 'mistral-large-latest',
    maxTokens: int(env.MISTRAL_MAX_TOKENS, 1200),
  },

  microsoft,
  smtp,

  bookingRecipient: env.BOOKING_RECIPIENT || 'assim.ahmed@aivancity.education',
  bdeEmail: env.BDE_EMAIL || 'bde@aivancity.ai',
  aipointsCsvUrl: env.AIPOINTS_SHEET_CSV_URL || '',
  scheduleIcsUrl: env.SCHEDULE_ICS_URL || '',
  icsAllowedHosts: list(env.ICS_ALLOWED_HOSTS),
  enableScraping: env.ENABLE_SCRAPING === 'true',
};
