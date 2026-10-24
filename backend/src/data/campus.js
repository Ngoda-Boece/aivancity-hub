'use strict';

/** Static campus reference data. Edit here to update the whole app. */

const ROOMS = [
  { number: '101', name: 'Singularity', floor: 0, kind: { fr: 'Amphithéâtre', en: 'Lecture hall' } },
  { number: '102', name: 'Silent room', floor: 0, kind: { fr: 'Travail silencieux', en: 'Silent study' } },
  { number: '103', name: 'Synapse', floor: null, kind: null },
  { number: '104', name: 'Quantum', floor: null, kind: null },
  { number: '105', name: 'Cortex', floor: 1, kind: { fr: 'Lab IA', en: 'AI lab' } },
  { number: '106', name: 'Vector', floor: null, kind: null },
  { number: '107', name: 'AI Clinic', floor: 1, kind: { fr: 'Salle projet', en: 'Project room' } },
  { number: '108', name: 'Nexus', floor: null, kind: null },
  { number: '109', name: 'Parity', floor: null, kind: null },
  { number: '112', name: 'Tensor', floor: null, kind: null },
  { number: '113', name: 'Keras / Prolog', floor: null, kind: null },
  { number: '114', name: 'Hadoop / Scala', floor: null, kind: null },
  { number: '115', name: 'Spark / Python', floor: 1, kind: { fr: 'Salle informatique', en: 'Computer room' } },
  { number: '116', name: 'IT Room', floor: null, kind: null },
  { number: '117', name: 'Aurora', floor: 0, kind: { fr: 'Espace cafétéria', en: 'Cafeteria area' } },
  { number: '118', name: 'Storm', floor: null, kind: null },
  { number: '119', name: 'Ethos', floor: null, kind: null },
];

const ROOMS_BY_NUMBER = Object.fromEntries(ROOMS.map(r => [r.number, r]));

/** "Cours en 105" → "105 · Cortex" */
function resolveRoom(raw) {
  if (!raw) return '';
  const m = String(raw).match(/\b(1\d{2})\b/);
  const room = m && ROOMS_BY_NUMBER[m[1]];
  return room ? `${room.number} · ${room.name}` : String(raw);
}

const CONTACTS = [
  { id: 'pedagogy', email: 'pedagogy@aivancity.ai', name: { fr: 'Questions pédagogiques', en: 'Pedagogical questions' }, role: { fr: 'Cours, examens, absences', en: 'Courses, exams, absences' } },
  { id: 'jobs', email: 'jobs@aivancity.ai', name: { fr: 'Stages & alternance', en: 'Internships & work-study' }, role: { fr: 'Offres, conventions, contrats', en: 'Offers, agreements, contracts' } },
  { id: 'helpdesk', email: 'helpdesk@aivancity.ai', name: { fr: 'Support informatique', en: 'IT support' }, role: { fr: 'Compte, mot de passe, Wi-Fi', en: 'Account, password, Wi-Fi' } },
  { id: 'fees', email: 'benmlouka@aivancity.ai', name: { fr: 'Frais de scolarité', en: 'Tuition fees' }, role: { fr: 'Échéances, prélèvements, factures', en: 'Deadlines, debits, invoices' } },
  { id: 'civic', email: 'engagementcitoyen@aivancity.ai', name: { fr: 'Engagement citoyen', en: 'Civic engagement' }, role: { fr: 'Bénévolat, projets solidaires', en: 'Volunteering, solidarity projects' } },
  { id: 'bde', email: 'bde@aivancity.ai', name: { fr: 'BDE', en: 'Student council' }, role: { fr: 'Événements, clubs, vie associative', en: 'Events, clubs, student life' } },
];

const LINKS = [
  { id: 'blackboard', url: 'https://aivancity.blackboard.com/ultra/course', name: 'Blackboard', desc: { fr: 'Cours, devoirs et notes', en: 'Courses, assignments, grades' } },
  { id: 'aimara', url: 'https://aivancity.myintranet.online/Calendar', name: 'Aimara', desc: { fr: 'Intranet et planning officiel', en: 'Intranet and official schedule' } },
  { id: 'library', url: 'https://univ.scholarvox.com/', name: 'Scholarvox', desc: { fr: 'Bibliothèque numérique', en: 'Digital library' } },
  { id: 'print', url: 'https://print.aivancity.ai/app?service=page/UserSummary', name: { fr: 'Impression', en: 'Printing' }, desc: { fr: 'Portail d’impression du campus', en: 'Campus print portal' } },
  { id: 'outlook', url: 'https://outlook.office.com/mail/', name: 'Outlook', desc: { fr: 'Messagerie de l’école', en: 'School email' } },
  { id: 'teams', url: 'https://teams.microsoft.com/', name: 'Teams', desc: { fr: 'Cours à distance et groupes', en: 'Remote classes and groups' } },
];

const CAMPUS = {
  name: 'Aivancity Paris-Cachan',
  address: '8 rue de la Croix Jarry, 75013 Paris',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=8+rue+de+la+Croix+Jarry+75013+Paris',
};

const AIPOINTS = {
  levels: [
    { min: 0, name: { fr: 'Nouveau', en: 'Newcomer' } },
    { min: 100, name: { fr: 'Initié', en: 'Scholar' } },
    { min: 200, name: { fr: 'Avancé', en: 'Advanced' } },
    { min: 300, name: { fr: 'Expert', en: 'Expert' } },
    { min: 500, name: { fr: 'Légende', en: 'Legend' } },
  ],
  earn: [
    { pts: 5, label: { fr: 'Assister à un cours à l’heure', en: 'Attend a class on time' } },
    { pts: 20, label: { fr: 'Rendre un devoir', en: 'Submit an assignment' } },
    { pts: 30, label: { fr: 'Participer à un événement', en: 'Join an event' } },
  ],
  rewards: [
    { pts: 50, icon: '☕', label: { fr: 'Bon café', en: 'Coffee voucher' } },
    { pts: 75, icon: '📚', label: { fr: 'Prolongation bibliothèque', en: 'Library late pass' } },
    { pts: 100, icon: '🚪', label: { fr: 'Réservation de salle prioritaire', en: 'Priority room booking' } },
    { pts: 150, icon: '🍽️', label: { fr: 'Ticket repas', en: 'Meal voucher' } },
    { pts: 200, icon: '🎓', label: { fr: 'Atelier exclusif', en: 'Exclusive workshop' } },
    { pts: 500, icon: '💼', label: { fr: 'Coup de pouce stage', en: 'Internship fast track' } },
  ],
};

module.exports = { ROOMS, ROOMS_BY_NUMBER, resolveRoom, CONTACTS, LINKS, CAMPUS, AIPOINTS };
