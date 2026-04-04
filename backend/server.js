require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');
const emailRouter = require('./routes/email');
const aipointsRouter = require('./routes/aipoints');
const internshipsRouter = require('./routes/internships');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow requests from any localhost origin (file://, VS Code Live Server, etc.)
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, file://)
    if (!origin) return cb(null, true);
    // Allow any localhost / 127.0.0.1 origin regardless of port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    // Allow the configured FRONTEND_URL if set
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

// Serve the frontend directly from the backend so everything is on one origin
app.use(express.static(path.join(__dirname, '../frontend')));

// Silence Chrome DevTools auto-probe
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.status(204).end());

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', authRouter);
app.use('/api', chatRouter);
app.use('/api', emailRouter);
app.use('/api', aipointsRouter);
app.use('/api', internshipsRouter);

// Catch-all: serve index.html for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Aivancity Hub running at http://localhost:${PORT}`);
});
