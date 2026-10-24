'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Small JSON-file persistence for per-user data (preferences, booking history).
 * Writes are debounced and atomic (temp file + rename) so a crash never leaves
 * a half-written file. Suitable for a single instance; swap for a DB to scale.
 */
class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = { users: {} };
    this.timer = null;
    try {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data.users ||= {};
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`[store] Could not read ${file}, starting empty:`, err.message);
    }
  }

  user(email) {
    const key = email.toLowerCase();
    this.data.users[key] ||= { prefs: {}, bookings: [] };
    return this.data.users[key];
  }

  update(email, mutator) {
    const result = mutator(this.user(email));
    this.scheduleSave();
    return result;
  }

  scheduleSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 200);
  }

  flush() {
    clearTimeout(this.timer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[store] Save failed:', err.message);
    }
  }
}

const store = new JsonStore(path.join(config.dataDir, 'store.json'));
process.on('exit', () => store.flush());

module.exports = { store, JsonStore };
