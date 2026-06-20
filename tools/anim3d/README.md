# Animation de la scène de présentation

Les planches `assets/avatar/pres-saut.webp` et `assets/avatar/pres-pose.webp` sont
**générées**, comme `collisions.js`. Ne pas les retoucher à la main : régénérer.

## Principe

Aucune modélisation et aucune image générée. Les PNG peints du personnage
(`assets/avatar/pres-*.png`, `hand-fist.png`) sont posés comme **plans texturés** dans
une scène Blender, et c'est la **caméra** qui fabrique la perspective. Le dessin d'origine
est donc conservé au pixel près.

Deux mécanismes portent tout le reste :

- **Les mains changent de dessin.** Une image plate ne peut pas changer de forme : pour
  que des doigts s'ouvrent, il faut échanger le dessin d'une image à l'autre. Chaque main
  est un emplacement qui porte plusieurs états calés sur la **manchette du poignet**,
  mesurée sur chaque PNG, ce qui permet de les échanger sans que la main saute.
- **Les bras sont alignés sur l'épaule.** Le personnage n'a pas de bras dessinés, mais le
  spectateur en déduit un. L'axe manchette vers doigts est donc **recalculé à chaque
  image** pour être couché sur la droite épaule vers poignet. Seul un petit fléchissement
  de poignet est ajouté par-dessus, et c'est lui qui fabrique par exemple le coucou.

## Régénérer

```bash
# 1. rendre les images (Blender 5.2, en ligne de commande, ~1,3 s pour 12 images)
blender --background --python tools/anim3d/scene.py -- --res 640 --mode entree --entree saut --mult 4 --out <dossier>/entree-saut
blender --background --python tools/anim3d/scene.py -- --res 640 --mode pose  --variante E --out <dossier>/frames-E

# 2. assembler les planches et relever les métadonnées de calage
python tools/anim3d/publie.py 82
```

`publie.py` écrit les `.webp` dans `assets/avatar/` et imprime les métadonnées
(`frames, fw, fh, cols, R, hf, ff, off`) à reporter dans `PRES_PLANCHES` de `game.js`.

## Ce qui est disponible

- **3 arrivées** : `--entree course|saut|chute`. Celle du jeu est `saut`, rendue à
  `--mult 4` (37 images jouées à 40 i/s) : elle couvre une grande distance, et à densité
  simple elle avançait de 44 px par image, ce qui clignotait.
- **5 poses** : `--variante A|B|C|D|E`, 40 images (23 de rafale + 17 de respiration
  bouclée). Celle du jeu est `E`, l'index levé.

Toute arrivée finit **exactement** sur l'état de repos, qui est aussi l'image 1 de toute
pose : les 15 combinaisons se raccordent donc sans retouche.

## Pièges

- En `sensor_fit = "VERTICAL"`, Blender prend `sensor_height` (24 mm par défaut) et non
  `sensor_width`. Il faut le forcer, sinon le personnage change de taille.
- Le cadre des arrivées est plus grand que celui des poses, mais à la **même échelle
  pixel/monde** : c'est la condition du raccord.
- Blender 5 range les fcurves dans des actions à calques, `action.fcurves` a disparu.
