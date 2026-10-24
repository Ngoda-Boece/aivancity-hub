'use strict';

const express = require('express');
const { searchJobs } = require('../services/jobs');
const { asyncRoute } = require('../lib/http');
const { Validator } = require('../lib/validate');
const { cleanText } = require('../lib/text');
const { rateLimit } = require('../lib/rateLimit');

const router = express.Router();

router.post('/jobs/search', rateLimit({ windowMs: 60 * 1000, max: 10, name: 'jobs' }), asyncRoute(async (req, res) => {
  const query = cleanText(req.body?.query, 100);
  const location = cleanText(req.body?.location, 100);
  const type = ['internship', 'apprenticeship', 'any'].includes(req.body?.type) ? req.body.type : 'internship';
  new Validator().check(query.length >= 2, 'query', 'Entrez un poste ou un mot-clé.').done();
  res.json(await searchJobs({ query, location, type }));
}));

module.exports = router;
