'use strict';
/* ============================================================================
   COUCHE DE STOCKAGE DU CLASSEMENT
   ----------------------------------------------------------------------------
   Deux modes, choisis automatiquement :
   - PRODUCTION (Vercel) : Postgres via le driver serverless Neon
     (@neondatabase/serverless). Activé dès qu'une URL de connexion est présente
     dans l'environnement (DATABASE_URL / POSTGRES_URL...). Ces variables sont
     injectées automatiquement quand tu relies un store « Neon / Postgres » à ton
     projet Vercel.
   - LOCAL (dev) : repli sur un simple fichier JSON (api/.data/scores.json), sans
     aucune dépendance native ni base — pour tester le classement tout de suite.
   ============================================================================ */

// Vercel/Neon exposent l'URL sous plusieurs noms selon l'intégration : on prend
// la première disponible (on privilégie la connexion « poolée »).
const CONN =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

const USE_PG = !!CONN;

/* ---------- Mode Postgres / Neon (production) ----------------------------- */
let _sql = null;          // fonction tag SQL (neon)
let pgInitPromise = null; // création de table mise en cache (1 fois par cold start)

async function pgSql() {
  if (!_sql) {
    const { neon } = require('@neondatabase/serverless');
    _sql = neon(CONN);
  }
  if (!pgInitPromise) {
    pgInitPromise = (async () => {
      await _sql`
        CREATE TABLE IF NOT EXISTS scores (
          id         BIGSERIAL   PRIMARY KEY,
          name       TEXT        NOT NULL,
          score      INTEGER     NOT NULL,
          projects   INTEGER     NOT NULL,
          time_ms    INTEGER     NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );`;
      await _sql`CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC, created_at ASC);`;
    })();
  }
  await pgInitPromise;
  return _sql;
}

/* ---------- Mode fichier JSON (dev local) --------------------------------- */
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'scores.json');

function fileRead() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (_) { return []; }
}
function fileWrite(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2));
}

/* ---------- API publique du module ---------------------------------------- */

// Insère un score et renvoie son rang (1 = meilleur).
async function addScore({ name, score, projects, timeMs }) {
  if (USE_PG) {
    const sql = await pgSql();
    const ins = await sql`
      INSERT INTO scores (name, score, projects, time_ms)
      VALUES (${name}, ${score}, ${projects}, ${timeMs})
      RETURNING id;`;
    const better = await sql`SELECT COUNT(*)::int AS c FROM scores WHERE score > ${score};`;
    return { id: ins[0].id, rank: better[0].c + 1 };
  }
  const rows = fileRead();
  const row = {
    id: rows.length + 1, name, score, projects, time_ms: timeMs,
    created_at: new Date().toISOString(),
  };
  rows.push(row);
  fileWrite(rows);
  const rank = rows.filter((r) => r.score > score).length + 1;
  return { id: row.id, rank };
}

// Renvoie les `limit` meilleurs scores (du meilleur au moins bon).
async function topScores(limit) {
  if (USE_PG) {
    const sql = await pgSql();
    const rows = await sql`
      SELECT name, score, projects, time_ms, created_at
      FROM scores
      ORDER BY score DESC, created_at ASC
      LIMIT ${limit};`;
    return rows;
  }
  const rows = fileRead();
  rows.sort((a, b) => (b.score - a.score) || (new Date(a.created_at) - new Date(b.created_at)));
  return rows.slice(0, limit);
}

// PAGE de scores (pagination « 10 par 10 ») : renvoie { rows, total }.
// - chaque ligne porte son RANG GLOBAL de compétition (ex aequo = même rang) ;
// - `q` (optionnel) filtre par nom (recherche), le total reflète alors les correspondances.
async function pageScores({ limit, offset, q }) {
  limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  offset = Math.max(0, parseInt(offset, 10) || 0);
  const needle = (q == null ? '' : String(q)).trim();
  if (USE_PG) {
    const sql = await pgSql();
    let rows, total;
    if (needle) {
      // recherche LITTÉRALE (position) = même sémantique que includes() en mode fichier (pas de jokers % / _)
      rows = await sql`
        WITH ranked AS (
          SELECT id, name, score, projects, time_ms, created_at,
                 RANK() OVER (ORDER BY score DESC, created_at ASC) AS rank
          FROM scores)
        SELECT * FROM ranked WHERE position(lower(${needle}) in lower(name)) > 0
        ORDER BY score DESC, created_at ASC, id ASC LIMIT ${limit} OFFSET ${offset};`;
      const c = await sql`SELECT COUNT(*)::int AS c FROM scores WHERE position(lower(${needle}) in lower(name)) > 0;`;
      total = c[0].c;
    } else {
      // ordre TOTALEMENT déterministe (id en dernier départage) : pas de doublon/saut entre pages avec OFFSET
      rows = await sql`
        WITH ranked AS (
          SELECT id, name, score, projects, time_ms, created_at,
                 RANK() OVER (ORDER BY score DESC, created_at ASC) AS rank
          FROM scores)
        SELECT * FROM ranked ORDER BY score DESC, created_at ASC, id ASC LIMIT ${limit} OFFSET ${offset};`;
      const c = await sql`SELECT COUNT(*)::int AS c FROM scores;`;
      total = c[0].c;
    }
    return { rows, total };
  }
  // mode fichier (dev local) : petite échelle, tout en mémoire
  let all = fileRead();
  all.sort((a, b) => (b.score - a.score) || (new Date(a.created_at) - new Date(b.created_at)));
  all = all.map((r) => ({ ...r, rank: all.filter((x) => x.score > r.score).length + 1 }));   // rang de compétition global
  if (needle) {
    const low = needle.toLowerCase();
    all = all.filter((r) => String(r.name).toLowerCase().includes(low));
  }
  return { rows: all.slice(offset, offset + limit), total: all.length };
}

module.exports = { addScore, topScores, pageScores, USE_PG };
