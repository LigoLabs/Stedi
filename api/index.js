'use strict';
/* ============================================================================
   API DU CLASSEMENT MONDIAL — Express (fonction serverless Vercel)
   ----------------------------------------------------------------------------
   Routes :
     GET  /api/leaderboard?limit=10   -> { ok, top: [...] }
     POST /api/scores  { name, projects, total, timeMs } -> { ok, score, rank, name, top }

   Le SCORE est recalculé côté serveur à partir de (projects, total, timeMs) : le
   client n'est jamais cru sur parole (anti-triche basique). Les constantes
   ci-dessous DOIVENT rester synchronisées avec celles de game.js (section SCORE).

   Local : `node api/index.js` démarre un serveur sur le port 8792.
   Vercel : ce fichier est exposé automatiquement comme fonction /api (voir
            vercel.json -> rewrites).
   ============================================================================ */

const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());                       // inoffensif en prod (same-origin) ; utile en dev local
app.use(express.json({ limit: '8kb' }));

/* --- Règles d'équilibrage (À GARDER SYNCHRO AVEC game.js) ------------------ */
const COMPLETION_POINTS = 1000000;     // 100 % des projets attrapés (peu importe leur nombre)
const TIME_PENALTY_PER_MS = 1;         // points perdus par milliseconde de jeu actif
const MAX_PROJECTS = 50;               // garde-fous de validation
const MAX_TIME_MS = 60 * 60 * 1000;    // 1 h

/* --- ANTI-TRICHE : temps minimal PLAUSIBLE selon les projets ATTRAPÉS -------
   Un tricheur peut POSTer directement /scores avec un temps absurde (« tout en
   5 s »). On refuse tout temps physiquement impossible. Le plancher SCALE avec
   le nombre de projets attrapés : traversée des cartes + petit détour par orbe.
   Mesuré par Steven : traversée à vide ~10 s, run hyper-optimisé attrapant TOUT
   ~13 s (donc ≈ +0,35 s / projet pour 9 projets). On NE bloque PAS l'arrivée :
   un run partiel est valide (score plus bas via la fraction de complétion).

   ANTI-EXPLOIT « total=1 » : un malin pourrait prétendre que le jeu n'a qu'1
   projet (total:1, projects:1) pour afficher 100 % de complétion à pas cher et
   baisser le plancher. On calcule donc le plancher sur le MAX entre les projets
   attrapés et (complétion × EXPECTED_PROJECTS). Ainsi un « 100 % » coûte toujours
   au moins le temps de prendre EXPECTED_PROJECTS orbes. EXPECTED_PROJECTS ≈ le
   nombre réel (content.js) : en AJOUTER ne casse rien (le client envoie un total
   plus grand, le plancher suit les projets attrapés) ; n'a d'effet que si on
   descend SOUS cette valeur. */
const MIN_TRAVERSAL_MS   = 10000;      // franchir toutes les cartes sans rien attraper
const MIN_MS_PER_PROJECT = 350;        // détour minimal pour aller chercher 1 orbe
const EXPECTED_PROJECTS  = 9;          // ≈ content.js ; sert d'ancrage anti-exploit (voir ci-dessus)

function minPlausibleMs(projects, total) {
  const caught = Math.max(0, Number(projects) || 0);
  const tot = total > 0 ? total : 1;
  const completion = Math.min(1, caught / tot);
  const effective = Math.max(caught, completion * EXPECTED_PROJECTS);   // un « 100 % » vaut au moins EXPECTED_PROJECTS orbes
  return MIN_TRAVERSAL_MS + effective * MIN_MS_PER_PROJECT;
}

// Barème SCALABLE : la complétion est une FRACTION (100 % = COMPLETION_POINTS, quel
// que soit le nombre de projets) et le temps coûte 1 point par milliseconde.
function computeScore(projects, total, timeMs) {
  const tot = total > 0 ? total : 1;
  const caught = Math.min(Math.max(0, projects), tot);
  const completion = caught / tot;
  return Math.max(0, Math.round(completion * COMPLETION_POINTS - timeMs * TIME_PENALTY_PER_MS));
}

function clampInt(v, lo, hi) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, n));
}

function cleanName(raw) {
  // garde uniquement les caractères imprimables (code >= 32, hors DEL 127),
  // trim, et coupe à 24 caractères (assez pour « Prénom Nom »).
  const str = String(raw == null ? '' : raw);
  let s = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 32 && c !== 127) s += str[i];
  }
  s = s.trim();
  if (!s) s = 'Anonyme';
  return s.slice(0, 24);
}

function fmt(r) {
  return {
    name: r.name,
    score: r.score,
    projects: r.projects,
    timeMs: (r.time_ms != null ? r.time_ms : r.timeMs),
    rank: r.rank,                 // rang global (présent pour /leaderboard paginé)
  };
}

/* --- Petit rate-limit en mémoire (anti-flood basique) ----------------------
   Fenêtre fixe par IP. ATTENTION : sur Vercel chaque instance serverless a sa
   propre mémoire et un cold start la vide ; c'est donc un garde-fou SOUPLE contre
   le spam naïf, pas une garantie dure (qui exigerait un store partagé, type Redis).
   Largement suffisant pour décourager l'inondation du classement. */
const rlBuckets = new Map();      // clé `${tag}:${ip}` -> { count, reset }

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();   // 1er hop = vrai client derrière le proxy Vercel
  return (req.socket && req.socket.remoteAddress) || req.ip || 'unknown';
}

function rateLimit(tag, max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const key = tag + ':' + clientIp(req);
    let b = rlBuckets.get(key);
    if (!b || now >= b.reset) { b = { count: 0, reset: now + windowMs }; rlBuckets.set(key, b); }
    b.count++;
    if (rlBuckets.size > 5000) {                     // borne mémoire : purge des fenêtres expirées
      for (const [k, v] of rlBuckets) if (now >= v.reset) rlBuckets.delete(k);
    }
    if (b.count > max) {
      res.set('Retry-After', String(Math.ceil((b.reset - now) / 1000)));
      return res.status(429).json({ ok: false, error: 'rate_limited' });
    }
    next();
  };
}

const router = express.Router();

router.get('/leaderboard', rateLimit('get', 100, 60 * 1000), async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);          // pagination « 10 par 10 »
    const q = (req.query.q == null ? '' : String(req.query.q)).slice(0, 40);  // recherche par nom (optionnelle)
    const { rows, total } = await db.pageScores({ limit, offset, q });
    res.json({ ok: true, top: rows.map(fmt), total });
  } catch (e) {
    console.error('GET /leaderboard', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.post('/scores', rateLimit('post', 10, 60 * 1000), async (req, res) => {
  try {
    const body = req.body || {};
    const projects = clampInt(body.projects, 0, MAX_PROJECTS);
    const timeMs = clampInt(body.timeMs, 0, MAX_TIME_MS);
    // total des projets attrapables : si absent (vieux client), on suppose une complétion pleine
    const total = body.total == null ? projects : clampInt(body.total, 1, MAX_PROJECTS);
    if (projects === null || timeMs === null || total === null) {
      return res.status(400).json({ ok: false, error: 'bad_request' });
    }
    // ANTI-TRICHE : temps physiquement impossible pour les projets attrapés -> on refuse.
    // (On ne bloque PAS les runs partiels : ils sont valides, juste moins bien notés.)
    if (timeMs < minPlausibleMs(projects, total)) {
      return res.status(422).json({ ok: false, error: 'too_fast' });
    }
    const name = cleanName(body.name);
    const score = computeScore(projects, total, timeMs);   // autorité serveur
    const { rank } = await db.addScore({ name, score, projects, timeMs });
    const top = await db.topScores(10);
    res.json({ ok: true, score, rank, name, top: top.map(fmt) });
  } catch (e) {
    console.error('POST /scores', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// En prod (Vercel) les requêtes arrivent en /api/... ; le second montage est un
// filet de sécurité si un rewrite venait à retirer le préfixe.
app.use('/api', router);
app.use('/', router);

// Healthcheck + ESTAMPILLE DE DÉPLOIEMENT.
// `commit`/`ref` sont injectés par Vercel dans la fonction serverless au moment du
// build : ils disent QUELLE version du code est réellement en ligne. Cette route
// étant dynamique (jamais mise en cache comme les fichiers statiques), c'est le
// moyen FIABLE de vérifier que la dernière version est bien publiée — sans dépendre
// du cache ni du `?b=`. Comparer `commit` au `git rev-parse --short HEAD` local.
// En local (`node api/index.js`) ces variables sont absentes -> commit: 'local'.
app.get('/api/health', (req, res) => res.json({
  ok: true,
  storage: db.USE_PG ? 'postgres' : 'file',
  commit: (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
  ref: process.env.VERCEL_GIT_COMMIT_REF || null,
  deployment: process.env.VERCEL_DEPLOYMENT_ID || null,
}));

// JSON malformé (ou autre erreur) -> réponse JSON propre, jamais de page HTML
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'bad_json' });
  }
  console.error('unhandled', err);
  res.status(500).json({ ok: false, error: 'server_error' });
});

// Démarrage local uniquement (ignoré quand Vercel importe le module).
if (require.main === module) {
  const port = process.env.PORT || 8792;
  app.listen(port, () => {
    console.log(`[stedi] API classement -> http://localhost:${port}`);
    console.log(`[stedi] stockage : ${db.USE_PG ? 'Vercel Postgres' : 'fichier JSON local (api/.data/scores.json)'}`);
  });
}

module.exports = app;
