# Aivancity Hub

Le portail étudiant d'Aivancity : planning, assistants IA, réservation de salles, stages, vie étudiante et AI Points, réunis sur une seule page.

> Projet étudiant non officiel, né au hackathon Aivancity 2025.
>
> Lancé avec [Assim Ben Ahmed](https://github.com/assim-ben-ahmed) ([dépôt d'origine](https://github.com/assim-ben-ahmed/AivanvityHub)), puis refondu par [Ngoda Boece](https://github.com/Ngoda-Boece).

## Fonctionnalités

| Espace | Ce qu'on y trouve |
|---|---|
| **Aujourd'hui** | Prochain cours avec compte à rebours, journée en frise, tâches perso, échéances, AI Points, événements, raccourcis |
| **Planning** | Grille hebdomadaire (agenda en liste sur mobile), navigation par semaine, export `.ics` d'un cours |
| **Assistants** | 6 assistants Mistral (campus, e-mails, bien-être, entretiens, révisions, carrière) en streaming, historique local, Markdown sécurisé |
| **Études** | Notes et moyenne pondérée /20, assiduité, simulateur de moyenne (« quelle note me faut-il ? »), minuteur Pomodoro |
| **Campus** | 17 salles avec filtre, réservation (avec détection des conflits), plan, services en ligne, contacts |
| **Carrière** | Recherche de stages et d'alternances (LinkedIn + Welcome to the Jungle, Indeed, HelloWork, APEC), offres sauvegardées |
| **Vie étudiante** | Événements, actions BDE, AI Points (solde, rang, classement, récompenses) |
| **Paramètres** | Langue FR/EN, thème clair/sombre/système, connexion d'agenda ICS, état des services |

On peut aussi utiliser la palette de commandes (`Ctrl K` ou `/`), le mode sombre, l'installation en PWA et un affichage complet sur mobile.

## Démarrage

```bash
cd backend
npm install
cp .env.example .env      # puis renseignez au moins MISTRAL_API_KEY
npm run dev               # http://localhost:3000
```

Sans aucune configuration, l'application marche déjà : on se connecte avec une adresse `@aivancity.ai`, et le planning, les notes et les événements affichent des **données de démonstration clairement étiquetées**. Chaque service s'active dès que sa variable est renseignée (voir `backend/.env.example`).

| Pour activer… | Variable(s) |
|---|---|
| Assistants IA | `MISTRAL_API_KEY` |
| Vrai planning | lien ICS ajouté par l'étudiant dans Paramètres, ou `SCHEDULE_ICS_URL` |
| SSO Microsoft + agenda Outlook + envoi d'e-mails | `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REDIRECT_URI` |
| Envoi direct des réservations | SSO Microsoft ou `SMTP_*` (sinon : brouillon pré-rempli dans la messagerie) |
| AI Points | `AIPOINTS_SHEET_CSV_URL` (Google Sheet publiée en CSV) |
| Événements / annonces réels | fichiers `events.json` / `announcements.json` dans `DATA_DIR` |
| Synchro Blackboard/Aimara (local) | `ENABLE_SCRAPING=true` + Playwright |

### Format de `data/events.json`

```json
[
  { "id": "afterwork-nov", "title": "Afterwork BDE", "start": "2026-11-14T17:30:00Z", "end": "2026-11-14T20:00:00Z",
    "location": "117 · Aurora", "description": "Quiz IA et pizzas", "tag": "bde" }
]
```

`tag` peut valoir `bde`, `career`, `tech` ou `talk`. `announcements.json` contient une liste d'objets `{ id, title: {fr, en}, body: {fr, en} }`.

## Docker

```bash
docker build -t aivancity-hub .
docker run -p 8080:8080 -e JWT_SECRET=... -e MISTRAL_API_KEY=... -v hub-data:/data aivancity-hub
```

## Tests

```bash
cd backend && npm test
```

Les tests couvrent : le parseur CSV, le parseur ICS (fuseaux horaires, récurrences, exceptions), la correspondance des noms pour les AI Points, la protection SSRF, le nettoyage de l'historique du chat, le rendu Markdown anti-XSS, et le parcours API (connexion, CSRF, streaming du chat, réservations, en-têtes de sécurité). Un faux serveur Mistral est utilisé pour le streaming.

## Architecture

```
backend/
  src/
    index.js            démarrage + arrêt propre
    app.js              assemblage Express (API + frontend statique, même origine)
    config.js           lecture et validation de l'environnement
    middleware/         en-têtes de sécurité/CSP, CSRF, session, erreurs
    routes/             auth, me, data (planning, dashboard, campus, points), chat, bookings, jobs, sync
    services/           sessions, store JSON, mistral (SSE), microsoft (OAuth+Graph), mail,
                        schedule (ICS + anti-SSRF), aipoints, jobs, scraper/ (local)
    lib/                csv, ics, cache TTL, rate limit, validation, texte
    data/               prompts des assistants, salles/contacts/liens, données de démo
  test/                 node:test (aucune dépendance de test)
frontend/
  index.html            squelette (aucun script inline, compatible CSP stricte)
  css/                  tokens → base → layout → components → views
  js/
    main.js             shell, navigation, démarrage
    core/               dom (templating auto-échappé), api, router, i18n, state, format, markdown, theme, session, icons
    components/         modal, toast, palette, éléments partagés
    views/              une vue par page
    i18n/               fr.js, en.js
```

## Sécurité

- **Aucun mot de passe** n'est demandé ni stocké. La connexion passe soit par le SSO Microsoft (OAuth 2.0 + PKCE), soit par une adresse e-mail limitée aux domaines de l'école. Ce second mode est déclaratif : il faut le désactiver (`ALLOW_LOCAL_LOGIN=false`) dès que le SSO est en place.
- La session est stockée dans un cookie `HttpOnly` + `SameSite=Lax`. Chaque requête qui modifie des données doit porter un en-tête anti-CSRF.
- La CSP est stricte (`script-src 'self'`). Le frontend utilise des templates qui échappent automatiquement le contenu, et le Markdown des IA est rendu sans aucun HTML actif.
- Le chat est soumis à une limite de débit (15/min, 300/jour par utilisateur), son historique est validé côté serveur et les rôles `system` envoyés par le client sont rejetés.
- Les liens ICS fournis par les étudiants sont protégés contre le SSRF : HTTPS uniquement, adresses privées refusées, redirections vérifiées, taille limitée.
- Les certificats TLS sont toujours vérifiés.

## Licence

MIT
