# Classement mondial — guide

Le jeu calcule un **score** et propose un **classement mondial** persisté côté serveur.

- **Score** = `projets attrapés × 1000 − temps de jeu actif`.
- Chaque projet (orbe) attrapé rapporte **1000 points**.
- Pendant la partie, le HUD n'affiche **que le chrono** (format `m:ss`), à droite du
  compteur de projets. Le chrono ne tourne que sur le jeu *actif* (en pause pendant
  les modales projet, les transitions de carte et avant le départ).
- Le **score est calculé à la fin**, à partir du temps : `12 points / seconde`
  sont retranchés. Le score ne descend jamais sous 0.

> ⚖️ **Régler l'équilibrage** : la pénalité est la constante `SCORE_PENALTY_PER_SEC`.
> Elle existe à **deux endroits qui doivent rester identiques** :
> [`game.js`](game.js) (affichage en jeu) et [`api/index.js`](api/index.js) (le
> serveur recalcule le score, il fait autorité). Mets `1000` par projet et la même
> pénalité dans les deux fichiers.

---

## Architecture

| Pièce | Fichier | Rôle |
|---|---|---|
| Jeu (statique) | `game.js`, `styles.css`, `index.html` | score live + écran de fin + appels `fetch` |
| API | `api/index.js` | serveur **Express** (fonction serverless Vercel) |
| Stockage | `api/db.js` | **Postgres/Neon** en prod · **fichier JSON** en local |
| Routage | `vercel.json` | `rewrites` : `/api/*` → la fonction Express |

Endpoints :

- `GET  /api/leaderboard?limit=10` → `{ ok, top: [{name, score, projects, timeMs}] }`
- `POST /api/scores` body `{ name, projects, timeMs }` → `{ ok, score, rank, name, top }`

> 🔒 Le **serveur recalcule le score** à partir de `projects` + `timeMs` (le client
> n'est pas cru sur parole). Le pseudo est nettoyé et coupé à 16 caractères. C'est un
> classement de portfolio, sans authentification.

---

## Développement local

Le jeu reste un **site statique** (aucun build). Seul le classement a besoin de Node.

```bash
# 1) dépendances de l'API (une fois)
npm install

# 2) démarrer l'API (port 8792) — en local elle stocke dans api/.data/scores.json
npm run dev:api          # = node api/index.js

# 3) servir le jeu (autre terminal)
python -m http.server 8791
# puis http://localhost:8791
```

En local, le jeu détecte automatiquement l'API sur `http://localhost:8792`
(via `location.port`). Si l'API n'est pas lancée, l'écran de fin reste utilisable :
seul le classement disparaît (dégradation propre). Le stockage local
(`api/.data/`) est ignoré par git.

---

## Déploiement sur Vercel

Le projet est déjà connecté à Vercel (déploiement à chaque push GitHub). Il faut
juste **brancher une base Postgres**.

1. **Créer la base** : dans le dashboard Vercel → projet → onglet **Storage** →
   *Create Database* → **Neon (Postgres)** → relie-la au projet.
   Vercel injecte alors automatiquement les variables d'environnement
   (`DATABASE_URL` / `POSTGRES_URL`…). `api/db.js` les détecte tout seul.
2. **Déployer** : `git push`. Vercel installe les dépendances (`package.json`),
   publie les fichiers statiques **et** la fonction `api/`. Aucun *Build Command*
   n'est nécessaire (laisser vide / « Other »).
3. **C'est tout** : la table `scores` est créée automatiquement à la première
   requête. En prod, l'API est *same-origin* (`/api/...`) → aucun souci de CORS.

### Vérifier après déploiement

```bash
curl https://TON-DOMAINE.vercel.app/api/health
# -> {"ok":true,"storage":"postgres"}
```

Si `storage` vaut `file`, c'est que la variable de connexion Postgres n'est pas
présente dans l'environnement de la fonction (revoir l'étape 1).
