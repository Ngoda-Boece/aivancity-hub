const express = require('express');
const fetch = require('node-fetch');
const { authMiddleware } = require('./auth');

const router = express.Router();

// Parse CSV text into array of { name, points } objects
function parseSheetCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // Find header indices
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('nom'));
  const pointsIdx = headers.findIndex(h => h.includes('point') || h.includes('score'));

  if (nameIdx === -1 || pointsIdx === -1) return [];

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    return {
      name: cols[nameIdx] || '',
      points: parseInt(cols[pointsIdx] || '0', 10) || 0
    };
  }).filter(r => r.name);
}

// Fuzzy name match: normalize and compare
function matchName(sheetName, lookupName) {
  const normalize = s => s.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9 ]/g, '');

  const a = normalize(sheetName);
  const b = normalize(lookupName);
  if (a === b) return true;

  // Check if all parts of one name appear in the other
  const aParts = a.split(' ').filter(Boolean);
  const bParts = b.split(' ').filter(Boolean);
  return aParts.every(p => b.includes(p)) || bParts.every(p => a.includes(p));
}

router.get('/aipoints', authMiddleware, async (req, res) => {
  const session = req.sessionData;
  const studentName = session?.user?.name || req.jwtPayload?.name;

  if (!studentName) {
    return res.status(400).json({ error: 'Student name not found in session' });
  }

  const sheetUrl = process.env.AIPOINTS_SHEET_CSV_URL;

  if (!sheetUrl) {
    // Sheet not configured — return a placeholder value for demo
    return res.json({ points: null, name: studentName, message: 'AI Points sheet not configured' });
  }

  try {
    const response = await fetch(sheetUrl, { timeout: 10000 });
    if (!response.ok) {
      throw new Error(`Sheet fetch failed: ${response.status}`);
    }
    const csv = await response.text();
    const rows = parseSheetCSV(csv);

    const match = rows.find(r => matchName(r.name, studentName));

    if (match) {
      return res.json({ points: match.points, name: match.name });
    } else {
      return res.json({ points: null, name: studentName, message: 'Points not found — contact administration' });
    }
  } catch (err) {
    console.error('AI Points fetch error:', err);
    return res.status(502).json({ error: 'Could not load AI Points data' });
  }
});

module.exports = router;
