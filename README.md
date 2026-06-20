# 🎮 Les Lucioles de Nantes, portfolio jouable de Steven Dieu

> **▶️ Jouer en ligne : [stediconsulting.fr](https://stediconsulting.fr)**

Un portfolio sous forme de **mini jeu de plateforme 2D**. On déplace un petit
esprit-lumière qui traverse des villes peintes (Lille, Paris, Nantes, puis un désert
« le prochain projet »). **Chaque orbe attrapée est un projet** : la fiche s'ouvre, et
à mesure que l'on récolte, le monde se réchauffe du crépuscule violet vers l'or.

Le jeu est un **site 100 % statique** : HTML + CSS + JavaScript + `<canvas>` 2D,
**aucune librairie, aucune étape de build, aucun npm**. Les décors sont des **images
peintes** (une par carte) ; le personnage, les orbes et les effets sont dessinés par le
code par-dessus. Seul le **classement mondial** (optionnel) ajoute une petite API.

---

## ▶️ Lancer le jeu

**Le plus simple :** double-clique sur `index.html`, ça s'ouvre dans ton navigateur.
(Une connexion internet est utile au 1er chargement pour les polices Google ; sinon des
polices de secours s'affichent.)

**En local avec un petit serveur** (recommandé pour tester proprement) :

```bash
python -m http.server 8791
# puis ouvre http://localhost:8791
```

Le **classement** est facultatif et nécessite Node : voir [`LEADERBOARD.md`](LEADERBOARD.md).
Sans lui, l'écran de fin reste utilisable (seul le tableau des scores disparaît).

### 🎯 Contrôles

| Touche | Action |
|---|---|
| ← → (ou A / D) | se déplacer |
| Maj (Shift) | sprint (en se déplaçant) |
| ↑ / Espace (ou W) | sauter (2× = double saut ; maintiens = planer) |
| ↓ (ou S) | s'accroupir (et traverser une plateforme vers le bas) |
| Échap / Entrée | reprendre (ferme une fiche projet) |

Saute dans une **orbe** pour ouvrir la fiche d'un projet. Les orbes **dorées (phares)**
sont placées en hauteur : grimpe les plateformes ou tente un double saut. Sur mobile,
des boutons tactiles apparaissent automatiquement (jeu pensé en mode paysage).

---

## ✏️ Personnaliser le contenu

**Tout se modifie dans un seul fichier : [`content.js`](content.js).** Aucune
compétence technique requise : remplace le texte entre guillemets, garde les guillemets
et les virgules.

- **`identity`** : prénom, nom, date de naissance (l'âge se calcule tout seul), rôle,
  ville, accroche.
- **`projects`** : la liste des projets (une orbe par projet). Chaque projet a un titre,
  une étiquette, une année, une description, des technos, un emoji, un logo et des
  captures, plus un lien optionnel. Ajoute **`premium: true`** sur un projet phare : son
  orbe devient dorée, plus grosse, et placée en hauteur.
- **`contact`** : le titre de fin et les liens (email, LinkedIn, GitHub).

Les logos et captures de chaque projet vivent dans `assets/projets/<dossier>/` :
voir [`assets/projets/README.md`](assets/projets/README.md).

---

## 🗂️ Structure du projet

| Fichier | Rôle |
|---|---|
| [`index.html`](index.html) | page + écrans superposés (accueil, prélude, fiche projet, contact, HUD) |
| [`styles.css`](styles.css) | habillage des écrans HTML posés par-dessus le canvas |
| [`game.js`](game.js) | le moteur (physique, rendu du décor/personnage, caméra, mise en scène, audio) |
| [`content.js`](content.js) | **le contenu éditable** (le seul fichier à toucher) |
| [`collisions.js`](collisions.js) | géométrie des plateformes, **générée** (ne pas éditer à la main) |
| [`api/`](api) | API serverless du classement mondial (Express + Postgres/Neon) |
| [`tools/`](tools) | scripts Python de génération (collisions, sprite-sheets d'effets) |

Les assets sont rangés par famille dans [`assets/`](assets) :

| Dossier | Contenu |
|---|---|
| `assets/maps/` | les 4 décors peints des cartes (`level-1.webp` … `level-4.webp`) |
| `assets/avatar/` | sprites du personnage (corps, tête, mains, pieds) |
| `assets/orbs/` | les orbes-projets (standard, phare, finale) |
| `assets/fx/` | effets : fumées, étincelles, flash, onde de choc, particules |
| `assets/ui/` | habillage : cadres, écriteau, flèche, icônes de contact, fond du prélude |
| `assets/audio/` | musiques et bruitages |
| `assets/video/` | poussière féérique de l'accueil (boucle vidéo légère) |
| `assets/projets/` | logo + captures de chaque projet (un dossier par projet) |

> **Cache-busting** : `index.html` charge les scripts/styles avec un suffixe `?b=NN`, et
> `game.js` ajoute `?b=ASSET_VER` à chaque asset. Après avoir édité `game.js`,
> `styles.css`, `content.js` ou les assets, incrémente le numéro concerné, sinon le
> navigateur sert l'ancienne version en cache.

---

## 🌐 Mettre en ligne

C'est un site **statique**, hébergeable gratuitement partout (Vercel, Netlify,
Cloudflare Pages, GitHub Pages…). Pour le classement, voir [`LEADERBOARD.md`](LEADERBOARD.md).
Le dépôt est déjà configuré pour Vercel ([`vercel.json`](vercel.json) : en-têtes de
sécurité, cache des assets, route de l'API).

---

## 🎨 Direction artistique

« Les Lucioles de Nantes : Le Crépuscule de la Loire ». Palette crépuscule vers or qui se
réchauffe au fil de la collecte, décors peints qui défilent en une seule pellicule,
personnage sans membres à mains et pieds flottants (physique à ressorts), mise en scène
finale (tremblement, naissance de l'orbe « ? », musique « boss »).

Polices : **Fraunces** et **Cinzel** (titres) + **Quicksand** (texte).

---

### Astuce dev

Ajoute `#dev` à l'URL (`index.html#dev`) pour exposer `window.__dev` (personnage, orbes,
état, pas-à-pas physique). Avec `#dev`, `window.__COL = 1` superpose les segments de
collision en rouge. Sans `#dev`, rien de tout cela n'existe.
