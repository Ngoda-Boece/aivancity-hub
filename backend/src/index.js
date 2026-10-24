'use strict';

const config = require('./config');
const { createApp } = require('./app');
const { store } = require('./services/store');

const server = createApp().listen(config.port, () => {
  console.log(`Aivancity Hub → http://localhost:${config.port}`);
  const flags = {
    'IA (Mistral)': Boolean(config.mistral.apiKey),
    'Connexion Microsoft': config.microsoft.enabled,
    'SMTP': config.smtp.enabled,
    'AI Points': Boolean(config.aipointsCsvUrl),
    'Calendrier école (ICS)': Boolean(config.scheduleIcsUrl),
    'Scraping local': config.enableScraping,
  };
  for (const [k, v] of Object.entries(flags)) console.log(`  ${v ? '✔' : '·'} ${k}`);
});

function shutdown(signal) {
  console.log(`\n${signal} reçu, arrêt…`);
  store.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
