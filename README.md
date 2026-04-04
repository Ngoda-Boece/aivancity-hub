# Aivancity Hub

A student web app for Aivancity School that centralizes campus life in one place — schedule, grades, AI assistant, room booking, internship search, and more.

Built as a hackathon project by students, for students.

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Today's schedule, upcoming classes, announcements |
| **AI Chatbot** | 6 specialized bots: Campus Assistant, Email Writer, Wellness, Interview Prep, Study Helper, Career Advisor |
| **Schedule** | Weekly timetable pulled from Aimara Intranet |
| **Grades** | Recent grades and activity stream from Blackboard |
| **Room Booking** | Book any of 19 campus rooms — sends a confirmation email |
| **AI Points** | Live leaderboard fetched from Google Sheets |
| **Internships** | Search internships by role and location via LinkedIn |
| **Library** | Quick access to Scholarvox digital library |
| **Printing** | Direct link to the campus printing portal |
| **Campus Map** | Named room map with all 19 rooms labeled |
| **Contacts** | Key school contacts with one-tap email |
| **BDE** | Apply to join, propose events, or start a club |

---

## Tech Stack

**Backend** — Node.js + Express
- `jsonwebtoken` — JWT-based session auth
- `nodemailer` — Room booking emails via Office 365 SMTP
- `playwright` — Browser automation for Blackboard & Aimara scraping
- `node-fetch` — Google Sheets CSV fetch for AI Points
- Mistral AI API — Powers all chatbot responses

**Frontend** — Vanilla HTML/CSS/JS
- Mobile-first, single-page app
- Dark theme with Aivancity brand colors
- Bilingual (EN / FR)

---

## Project Structure

```
aivancity-hub/
├── backend/
│   ├── server.js              # Express entry point
│   ├── scraper.js             # Playwright scraper (Blackboard + Aimara)
│   ├── .env                   # Environment variables (not committed)
│   └── routes/
│       ├── auth.js            # POST /api/login, GET /api/scrape-status
│       ├── chat.js            # POST /api/chat (Mistral AI proxy)
│       ├── email.js           # POST /api/booking-email
│       ├── aipoints.js        # GET /api/aipoints (Google Sheets)
│       └── internships.js     # POST /api/internships
└── frontend/
    ├── index.html             # Full single-page app
    └── assets/
        └── map.jpeg           # Campus room map
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Mistral AI API key ([console.mistral.ai](https://console.mistral.ai))
- Microsoft Edge or Chrome installed (for scraping, optional)

### 1. Install dependencies

```bash
cd backend
npm install
npx playwright install chromium
```

### 2. Configure environment

Create `backend/.env`:

```env
ENABLE_SCRAPING=false
MISTRAL_API_KEY=your_mistral_api_key_here
MISTRAL_MODEL=mistral-large-latest
JWT_SECRET=your-secret-here
PORT=3000

# Google Sheets CSV export URL for AI Points
AIPOINTS_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/.../pub?output=csv
```

> Set `ENABLE_SCRAPING=true` to enable live data from Blackboard and Aimara. The scraper uses your existing browser session (Edge or Chrome) so no credentials are stored.

### 3. Run

```bash
node server.js
```

Open [http://localhost:3000](http://localhost:3000) and log in with your Aivancity email.

---

## Scraping (optional)

When `ENABLE_SCRAPING=true`, the app opens your real Edge/Chrome browser profile at login to fetch live data from Blackboard and Aimara. If you're already logged in, scraping happens silently. If your session expired, only the MFA prompt appears (email/password are remembered by your browser).

The scraper never stores or transmits your credentials — it reuses your browser's existing session cookies only.

---

## Room Booking Emails

Booking requests are sent via `smtp.office365.com` using the logged-in student's own Aivancity email as the sender. The recipient is the campus administration. No shared SMTP credentials are needed.

> Note: Microsoft 365 must have SMTP AUTH enabled for your account. Contact IT if emails fail to send.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MISTRAL_API_KEY` | Yes | Mistral AI API key |
| `MISTRAL_MODEL` | No | Model name (default: `mistral-large-latest`) |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `PORT` | No | Server port (default: `3000`) |
| `ENABLE_SCRAPING` | No | `true` to enable live scraping (default: `false`) |
| `AIPOINTS_SHEET_CSV_URL` | No | Published CSV URL from Google Sheets |

---

## License

MIT — built for the Aivancity Hackathon 2025.
