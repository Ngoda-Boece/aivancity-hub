'use strict';

/** Tiny TTL cache with in-flight de-duplication of concurrent loads. */
class TtlCache {
  constructor(ttlMs, maxEntries = 500) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.entries = new Map();
    this.pending = new Map();
  }

  get(key) {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (e.expires <= Date.now()) { this.entries.delete(key); return undefined; }
    return e.value;
  }

  set(key, value) {
    if (this.entries.size >= this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  async wrap(key, loader) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    if (this.pending.has(key)) return this.pending.get(key);
    const p = Promise.resolve().then(loader)
      .then(value => { this.set(key, value); return value; })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }
}

module.exports = { TtlCache };
