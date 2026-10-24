'use strict';

const { zonedToUtc } = require('../lib/ics');

/**
 * Demonstration data, generated relative to "now" so the dashboard never looks
 * stale. Everything returned here is flagged `demo: true` and labelled as such
 * in the UI — it is never presented as the student's real data.
 */

const TZ = 'Europe/Paris';

function parisWall(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(date).map(x => [x.type, x.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: +p.year, mo: +p.month - 1, d: +p.day, weekday };
}

function at(base, dayOffset, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const dt = new Date(Date.UTC(base.y, base.mo, base.d + dayOffset));
  return new Date(zonedToUtc(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), h, m, 0, TZ));
}

const WEEK_TEMPLATE = [
  // [weekday 1=Mon, start, end, title, room, teacher]
  [1, '09:00', '11:00', 'Machine Learning', '105 · Cortex', 'Prof. Martin'],
  [1, '14:00', '15:30', 'Data Engineering', '115 · Spark / Python', 'Prof. Dupont'],
  [2, '10:00', '12:00', 'Bases de données avancées', '113 · Keras / Prolog', 'Prof. Johnson'],
  [2, '13:30', '15:00', 'Statistiques pour le ML', '103 · Synapse', 'Prof. Bernard'],
  [3, '09:00', '12:00', 'Deep Learning — TP', '105 · Cortex', 'Prof. Martin'],
  [4, '11:00', '13:00', 'Éthique & régulation de l’IA', '101 · Singularity', 'Prof. Dubois'],
  [4, '14:00', '16:00', 'Projet de groupe', '107 · AI Clinic', 'Équipe projet'],
  [5, '09:30', '11:30', 'MLOps', '114 · Hadoop / Scala', 'Prof. Chen'],
];

function demoSchedule(from, to) {
  const out = [];
  const startWall = parisWall(from);
  // Monday of the week containing `from`
  const mondayOffset = -((startWall.weekday + 6) % 7);
  for (let week = 0; week < 6; week++) {
    for (const [wd, s, e, title, location, teacher] of WEEK_TEMPLATE) {
      const offset = mondayOffset + week * 7 + (wd - 1);
      const start = at(startWall, offset, s);
      const end = at(startWall, offset, e);
      if (end < from || start > to) continue;
      out.push({ id: `demo-${start.getTime()}-${title}`, title, start: start.toISOString(), end: end.toISOString(), location, description: teacher, allDay: false });
    }
  }
  return out;
}

function demoAcademics() {
  const now = new Date();
  const w = parisWall(now);
  const iso = days => at(w, days, '23:59').toISOString();
  return {
    demo: true,
    courses: [
      { code: 'ML-301', title: 'Machine Learning', progress: 72 },
      { code: 'DL-401', title: 'Deep Learning', progress: 58 },
      { code: 'DE-201', title: 'Data Engineering', progress: 81 },
      { code: 'DB-310', title: 'Bases de données avancées', progress: 64 },
      { code: 'AE-101', title: 'Éthique & régulation de l’IA', progress: 90 },
      { code: 'OPS-320', title: 'MLOps', progress: 45 },
    ],
    grades: [
      { course: 'Machine Learning', item: 'Projet 2 — Classification', score: 16.5, outOf: 20, coef: 2, date: iso(-6) },
      { course: 'Deep Learning', item: 'Quiz CNN', score: 14, outOf: 20, coef: 1, date: iso(-11) },
      { course: 'Data Engineering', item: 'Partiel', score: 15.5, outOf: 20, coef: 3, date: iso(-18) },
      { course: 'Éthique & régulation de l’IA', item: 'Dissertation', score: 17, outOf: 20, coef: 2, date: iso(-25) },
      { course: 'Bases de données avancées', item: 'TP noté', score: 12.5, outOf: 20, coef: 1, date: iso(-30) },
    ],
    attendance: {
      rate: 94, present: 47, absent: 3,
      byCourse: [
        { course: 'Machine Learning', rate: 100 }, { course: 'Deep Learning', rate: 92 },
        { course: 'Data Engineering', rate: 96 }, { course: 'Bases de données avancées', rate: 78 },
        { course: 'Éthique & régulation de l’IA', rate: 100 },
      ],
    },
    deadlines: [
      { id: 'd1', title: 'Rendu TP Deep Learning', course: 'Deep Learning', due: iso(2) },
      { id: 'd2', title: 'Rapport projet de groupe', course: 'Projet de groupe', due: iso(6) },
      { id: 'd3', title: 'Quiz MLOps', course: 'MLOps', due: iso(9) },
    ],
  };
}

function demoEvents() {
  const w = parisWall(new Date());
  const ev = (days, time, durH, title, location, desc, tag) => {
    const start = at(w, days, time);
    return { id: `demo-ev-${days}`, title, start: start.toISOString(), end: new Date(start.getTime() + durH * 3600000).toISOString(), location, description: desc, tag, demo: true };
  };
  return [
    ev(3, '12:30', 2, 'Afterwork BDE', '117 · Aurora', 'Rencontre entre promos, quiz IA et pizzas.', 'bde'),
    ev(8, '10:00', 6, 'Forum entreprises', '101 · Singularity', 'Rencontrez les recruteurs IA & Data : stages, alternances, CDI.', 'career'),
    ev(15, '09:00', 24, 'Hackathon IA générative', '105 · Cortex', '24 h pour prototyper une solution IA responsable. Équipes de 3 à 5.', 'tech'),
    ev(21, '15:00', 2, 'Conférence : l’AI Act en pratique', '101 · Singularity', 'Ce que la régulation européenne change pour les data scientists.', 'talk'),
  ];
}

const DEMO_ANNOUNCEMENTS = [
  { id: 'a1', title: { fr: 'Bienvenue sur Aivancity Hub', en: 'Welcome to Aivancity Hub' }, body: { fr: 'Connectez votre agenda (Paramètres) pour remplacer les données de démonstration par votre vrai emploi du temps.', en: 'Connect your calendar (Settings) to replace demo data with your real timetable.' } },
];

module.exports = { demoSchedule, demoAcademics, demoEvents, DEMO_ANNOUNCEMENTS };
