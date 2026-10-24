'use strict';

const { HttpError } = require('./http');

/** Collects field errors and throws a single 400 with all of them. */
class Validator {
  constructor() { this.errors = {}; }

  check(condition, field, message) {
    if (!condition && !this.errors[field]) this.errors[field] = message;
    return this;
  }

  done() {
    if (Object.keys(this.errors).length) {
      throw new HttpError(400, 'validation', 'Certains champs sont invalides.', this.errors);
    }
  }
}

const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isTime = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const toMinutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const isEmail = v => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

module.exports = { Validator, isDate, isTime, toMinutes, isEmail };
