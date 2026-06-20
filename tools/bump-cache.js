#!/usr/bin/env node
/* ============================================================================
   bump-cache.js — anti-cache automatique
   ----------------------------------------------------------------------------
   Le navigateur (et le CDN Vercel) gardent en cache game.js / styles.css /
   collisions.js / content.js tant que leur URL ne change pas. L'URL ne change
   que par le suffixe « ?b=NN » dans index.html. Oublier de bumper ce numéro =
   l'ancien fichier reste servi et la modif n'apparaît jamais (cf. « build #407 »
   qui ne bouge pas dans la console alors qu'on vient de pousser).

   Ce script incrémente automatiquement le bon « ?b= » pour chaque fichier qui
   change. Appelé tout seul par le hook git pre-commit (tools/git-hooks/), donc
   on n'a plus rien à penser : on commit, le numéro monte, le cache saute.

   Usages :
     node tools/bump-cache.js --hook        # lit les fichiers indexés, bump, re-stage (le hook)
     node tools/bump-cache.js --all          # bump les 4 fichiers + ASSET_VER (full)
     node tools/bump-cache.js game.js        # bump un/des fichier(s) précis
     node tools/bump-cache.js --dry game.js  # montre sans rien écrire
   ============================================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const GAME = path.join(ROOT, 'game.js');

// Fichiers code dont le « ?b= » vit dans index.html.
const CODE_FILES = ['styles.css', 'collisions.js', 'content.js', 'game.js'];

// Dossiers d'images chargées à l'exécution via av() => couvertes par ASSET_VER
// (game.js). assets/projets/* gardent leur propre URL ; video/ et audio/ ont
// leur propre « ?b= » écrit en dur dans index.html : non concernés ici.
const ASSET_DIRS = ['assets/maps/', 'assets/avatar/', 'assets/orbs/', 'assets/fx/', 'assets/ui/'];

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const HOOK = args.includes('--hook');
const ALL = args.includes('--all');
const explicit = args.filter((a) => !a.startsWith('--'));

function stagedFiles() {
  // Fichiers qui partent dans ce commit (ajoutés/copiés/modifiés/renommés).
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((s) => s.trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

// Liste des chemins qui « changent » selon le mode d'appel.
let targets;
if (ALL) targets = CODE_FILES.slice();
else if (explicit.length) targets = explicit.map((s) => s.replace(/\\/g, '/'));
else targets = stagedFiles(); // mode hook / défaut

const codeToBump = new Set(); // noms de fichiers dont on bump le ?b= dans index.html
for (const f of targets) {
  const base = f.split('/').pop();
  if (CODE_FILES.includes(base)) codeToBump.add(base);
}

const assetChanged =
  ALL || targets.some((f) => ASSET_DIRS.some((d) => f.startsWith(d)));

const changed = []; // fichiers réellement réécrits, à re-stager
let assetVerLine = null;

// 1) Si une image runtime change : bump ASSET_VER dans game.js, et donc il faut
//    aussi re-servir game.js => bump son ?b= dans index.html.
if (assetChanged) {
  let src = fs.readFileSync(GAME, 'utf8');
  const m = src.match(/(const\s+ASSET_VER\s*=\s*)(\d+)(\s*;)/);
  if (m) {
    const next = parseInt(m[2], 10) + 1;
    assetVerLine = `ASSET_VER ${m[2]} -> ${next}`;
    if (!DRY) {
      src = src.replace(/(const\s+ASSET_VER\s*=\s*)(\d+)(\s*;)/, `$1${next}$3`);
      fs.writeFileSync(GAME, src);
      changed.push('game.js');
    }
    codeToBump.add('game.js'); // expédier le nouvel ASSET_VER
  }
}

// 2) Bump le « ?b=NN » de chaque fichier code concerné, dans index.html.
const bumps = [];
if (codeToBump.size) {
  let html = fs.readFileSync(INDEX, 'utf8');
  let touched = false;
  for (const file of codeToBump) {
    const re = new RegExp('(' + file.replace(/[.]/g, '\\$&') + '\\?b=)(\\d+)', 'g');
    let hit = false;
    html = html.replace(re, (full, prefix, num) => {
      hit = true;
      touched = true;
      const next = parseInt(num, 10) + 1;
      bumps.push(`${file} ?b=${num} -> ${next}`);
      return prefix + next;
    });
    if (!hit) bumps.push(`${file} (introuvable dans index.html, ignoré)`);
  }
  if (touched && !DRY) {
    fs.writeFileSync(INDEX, html);
    changed.push('index.html');
  }
}

// 3) Compte-rendu.
if (!bumps.length && !assetVerLine) {
  if (HOOK) process.exit(0); // rien de versionnable touché : commit silencieux
  console.log('bump-cache : rien à bumper (aucun fichier code/asset concerné).');
  process.exit(0);
}
console.log('[bump-cache]' + (DRY ? ' (dry-run)' : ''));
if (assetVerLine) console.log('  ' + assetVerLine + '  (game.js)');
for (const b of bumps) console.log('  ' + b);

// 4) En mode hook : re-stager les fichiers qu'on vient de réécrire pour qu'ils
//    partent dans le même commit.
if (HOOK && !DRY && changed.length) {
  const uniq = [...new Set(changed)];
  execSync('git add ' + uniq.map((f) => '"' + f + '"').join(' '), { cwd: ROOT });
  console.log('  re-stagé : ' + uniq.join(', '));
}
