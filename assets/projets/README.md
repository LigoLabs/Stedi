# Logos & captures des projets

Chaque projet (orbe) peut afficher **son logo** dans le cercle + la pop-up, et un
petit **carrousel de captures d'écran**. Tout se branche depuis
[`content.js`](../../content.js) via les champs `logo` et `shots`.

## Où déposer les fichiers

Un dossier par projet, ici dans `assets/projets/<dossier>/` :

**Side projects perso (orbes GOLD / projets phares)**

| Projet          | Dossier                  | URL                                         |
|-----------------|--------------------------|---------------------------------------------|
| Listopia        | `listopia/`              | https://listopia.fr/                        |
| Tooda           | `tooda/`                 | https://tooda.fr/                           |
| Blinee          | `blinee/`                | https://blinee.fr/                          |
| PausePump       | `pausepump/`             | https://ligolabs.github.io/PausePump/       |

**Projets clients**

| Projet          | Dossier                  | URL                                         |
|-----------------|--------------------------|---------------------------------------------|
| Aedile (Landing)| `landing/`               | https://landing-rust-gamma.vercel.app/      |
| Golden Triangle | `goldentriangle/`        | https://goldentriangle.fr/                  |
| Bernard Soria   | `bernardsoria/`          | https://bernardsoria.com/                   |
| Lacme Prod      | `lacmeprod/`             | https://lacmeprod.com/                      |
| Valléescope     | `valleescope/`           | https://www.valleescope.fr/                 |

## Le logo (`logo`)

- Fichier conseillé : `logo.png`, **fond transparent**, carré ou presque
  (il est centré dans un cercle, avec une petite marge).
- Déjà branché dans `content.js`, ex. `"assets/projets/listopia/logo.png"`.
- Tant que le fichier n'existe pas, l'orbe affiche l'emoji de secours (`icon`).

## Les captures (`shots`)

- Déposer les images dans le dossier du projet (ex. `capture-1.webp`,
  `capture-2.webp`, …).
- Puis les lister dans `content.js`, champ `shots` du projet :

  ```js
  shots: [
    "assets/projets/listopia/capture-1.webp",
    "assets/projets/listopia/capture-2.webp",
  ],
  ```

- Format paysage conseillé (le cadre du carrousel est en 16:10).
- **Garder les images LÉGÈRES** : ~1280 px de large max, en **WebP** (ou JPEG),
  pas de PNG de plusieurs Mo. Une capture lourde est décodée à l'ouverture de la
  carte et fait saccader le jeu sur les machines modestes. Repère : viser < 200 Ko
  par image.
- `shots: []` (vide) => pas de carrousel affiché.
