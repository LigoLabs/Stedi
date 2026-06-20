# Intro cinématique « L'épopée de Steven Dieu »

Scénario de la vidéo d'introduction qui doit remplacer l'écran de prélude en texte.
Production : images clés générées dans ChatGPT (gpt-image), animation par Seedance,
montage et encodage en local, intégration en overlay HTML.

> ## ⚠ Virage du 2026-07-31 : on passe au manga
>
> L'approche « 14 images clés peintes, une par plan » est **abandonnée**. Steven ne
> voulait pas de ce rendu et a tranché pour le **manga**, qu'il veut assumer comme
> identité de son portfolio. Les sections 3 à 6 ci-dessous décrivent l'ancienne
> approche : elles restent pour l'historique et parce que le **découpage en 13 beats
> reste valable**, mais les prompts d'images peintes ne servent plus.
>
> **Nouveau procédé**, voir la section 10 en fin de document :
> on fabrique un dossier de préparation (planche personnage, planche décor, planches
> de scénario à cases), et on donne **le paquet entier** à Seedance en mode référence,
> qui compose le film lui-même. On ne lui dicte plus chaque image.

Statut : scénario validé sur le papier, images clés à produire.

**Toute la cinématique se déroule en plein jour**, sous le même soleil que les cartes
peintes du jeu : ciel bleu franc, gros cumulus blancs et crème, lumière chaude,
ombres douces et bleutées. Aucun plan de nuit, aucun crépuscule.

**Registre : cinématique, pas enfantin.** C'est un piège dans lequel les modèles
d'image tombent tout seuls. Voir 3.5, c'est la section la plus importante du
document avec celle sur les bras.

---

## 1. Ce que la vidéo doit dire

Exactement le même message que le prélude actuel, mais joué au lieu d'être lu :

1. Steven vole dans le ciel avec ses projets dans les bras.
2. Des bugs le percutent, ses projets tombent.
3. Il plonge au sol pour les récupérer.
4. Il repère une première orbe et fonce dessus. Fin : « Portfolio de Steven Dieu ».

Le joueur doit comprendre sans une ligne de dialogue : **les orbes sont les projets,
il faut les attraper**. C'est la seule information de gameplay que le prélude texte
apportait et qu'on ne peut pas perdre.

## 2. Contraintes de production

| Point | Cible |
|---|---|
| Durée totale | 30 à 32 s de vidéo (13 plans), plus le carton final en HTML |
| Format image | 16:9, montage en 1280x720 (le canvas du jeu est en 1280x720 virtuel) |
| Poids livré | 5 Mo maximum, `.webm` VP9 + `.mp4` H.264 de repli |
| Durée par clip | 4 à 15 s (limite réelle de Seedance 2.0). Générer **environ 2x la durée cible** et couper au montage. Le coût étant linéaire avec la durée, chaque seconde générée en trop est payée |
| Dialogue | aucun. Mime uniquement |
| Audio | **généré par Seedance**, avec direction sonore imposée par plan. Jamais de voix, jamais de musique : la musique du jeu passe par-dessus au montage |
| Texte incrusté | le moins possible (voir 6.4) |
| Sous-titre | non, mais résumé texte accessible conservé (voir 7) |

## 3. Bible visuelle

Trois planches de référence à joindre à **chaque** conversation de génération :

- `ref-perso.jpg` : le personnage, ses pièces détachées, les orbes, la palette jour.
- `ref-decor.jpg` : un extrait de la carte 1 peinte, pour le style de décor.
- `ref-flottant.jpg` : le schéma OUI / NON sur l'absence de bras et de jambes.

### Personnage (« Steven »)

Petit esprit lumineux **sans bras ni jambes**. Tête de jeune homme, cheveux bruns en
pics, barbe de trois jours, grands yeux bleus. Corps réduit à un sweat à capuche
turquoise avec cordons crème et bande basse crème rayée orange. Deux mains gantées de
blanc, style moufle à quatre doigts, **flottant à distance du corps**. Deux baskets
blanches et orange, elles aussi **flottantes**.

### La règle des membres, formulée pour être comprise

Dire « sans bras » ne suffit pas : le modèle rajoute des bras quand même. Il faut le
formuler **positivement**, en décrivant le vide :

> Entre le sweat et chaque main gantée, il y a uniquement du vide : on voit le ciel
> ou le décor à travers cet espace. Le sweat n'a pas de manches, ses ouvertures
> d'épaules sont fermées. Sous le sweat, il n'y a rien non plus : les baskets flottent
> dans le vide sous lui.

C'est cette formulation, plus la planche `ref-flottant.jpg`, qui tient. Vérifier
systématiquement chaque image générée sur ce point avant tout le reste.

**Corollaire, dès que le personnage n'est plus debout** (plongeon, vrille, chute) :
comme ses morceaux ne sont reliés par rien, le modèle les empile dans le désordre. Le
seul remède qui marche est de lui dicter **l'ordre d'empilement du haut vers le bas
de l'image**, morceau par morceau. Exemple pour un plongeon tête la première : « du
haut vers le bas du cadre : les baskets, puis le sweat, puis les mains, puis la tête
tout en bas ». Ne pas dire « il pique vers le sol » et espérer qu'il déduise.

Interdits absolus : bras, jambes, cou, manches, épaules, articulations visibles.

Ne jamais citer de nom de licence existante dans un prompt : décrire le personnage,
ne pas le comparer.

### Comment il vole : l'hélice de cheveux

Il ne plane pas et il n'a pas d'ailes. **Il vole en faisant tourner la mèche de
cheveux du sommet de son crâne comme un rotor d'hélicoptère.** La mèche est floutée
par la rotation en un disque, un léger anneau de vent et de poussière dorée tourne
autour de sa tête, son corps est suspendu sous elle et pend légèrement, incliné vers
l'avant dans le sens de la marche.

C'est valable pour les plans 1 à 5. À partir du plan 7 il pique vers le sol : la
mèche s'arrête et les cheveux sont plaqués vers l'arrière par la vitesse.

### Orbes-projets

Sphère de verre ambré cerclée d'une monture d'or ouvragée, gemmes turquoise, disque
central lisse et doré au milieu (c'est là que se pose le logo du projet dans le jeu),
halo chaud, fines traînées turquoise à l'intérieur.

**Huit orbes, et elles sont petites** : environ un quart de sa tête, la taille d'une
balle de tennis à côté de lui. Elles forment une grappe serrée contre son sweat,
maintenue par ses deux mains gantées posées dessus. Pas de grosses sphères, pas trois
énormes billes : une brassée de petites orbes, c'est ce qui donne l'idée qu'il
transporte toute sa collection.

### 3.5 Registre graphique : cinématique, pas enfantin

Le premier essai est sorti trop enfantin. C'est le défaut par défaut des modèles
d'image dès qu'on dit « cartoon » ou « volumes ronds » : ils basculent en
illustration pour tout-petits, couleurs bonbon, formes simplifiées, lumière plate.

Le bon registre, c'est celui de tes cartes : **une peinture d'illustration
cinématique, presque semi-réaliste pour le décor**, avec un personnage stylisé posé
dedans. C'est exactement ce contraste qui fait que le jeu ne fait pas enfantin.

À demander :

- key art de jeu vidéo, peinture numérique 2D, matière et coups de pinceau visibles
- décor **détaillé et semi-réaliste**, au niveau de finition de `ref-decor.jpg`, jamais
  simplifié pour se mettre au niveau du personnage
- éclairage dramatique, contraste de valeurs marqué, contre-jour, lumière volumétrique
- profondeur de champ, perspective atmosphérique, poussière et particules dans les
  rayons
- couleurs riches mais tenues, pas saturées à fond
- cadrage cinématographique, un vrai point de vue de caméra

À interdire explicitement dans chaque prompt :

- style livre illustré pour enfants, style dessin animé pour tout-petits
- couleurs bonbon, pastel, arc-en-ciel
- formes simplifiées, décor vide ou schématique
- contour noir uniforme posé sur le décor
- rendu plat, sans ombre ni profondeur
- 3D plastique lisse, style anime

### 3.6 Look validé : les images 1, 6 et 10 font foi

Les images 1, 6 et 10 ont été générées et **validées par Steven le 2026-07-31**. À
partir de maintenant ce sont elles la référence, pas ce document. Les 11 prompts
restants doivent explicitement demander de garder leur personnage et leur style.

Ce que ces trois images ont figé :

- **Visage** : plus adulte que le sprite du jeu. Mâchoire marquée, nez droit,
  sourcils épais, yeux bleus clairs, barbe de trois jours, cheveux bruns en piques
  dressées. Ce n'est pas exactement le sprite du jeu, c'est assumé : le sprite
  faisait trop jeune une fois peint en grand.
- **Tête flottante**, sans cou ni col, nettement séparée du sweat.
- **Sweat** turquoise à ouvertures d'épaules fermées en tube, sans manches, bande
  basse crème rayée orange. Mains gantées et baskets flottantes.
- **Hélice** : un disque doré de rotation net au-dessus de la tête, avec les cheveux
  en dessous. C'est devenu un attribut graphique lisible, on le garde tel quel.
- **Orbes** : une grappe compacte de huit orbes dorées serties d'or avec gemmes
  turquoise, tenue à deux mains contre le sweat.
- **Ciel en vol** : cumulus embrasés d'or par le contre-jour, plages de bleu franc,
  flare de soleil. **Ciel au sol** : bleu franc et cumulus blancs.
- **Décor au sol** : la Grand-Place de Lille peinte, beffroi, pignons flamands,
  terrasses. L'image 10 est le niveau de finition à tenir pour tous les plans au sol.

### Décor et lumière : plein jour

C'est le point qui a changé, et c'est le bon choix : les cartes du jeu sont peintes
en plein jour, l'intro doit fusionner avec elles, pas contraster.

Ciel de **milieu de journée** : bleu franc et profond en haut, plus pâle et laiteux
vers l'horizon, traversé de **gros cumulus blancs et crème** aux ventres légèrement
gris-bleu, peints en larges coups de pinceau. Soleil haut et chaud, hors champ ou en
contre-jour derrière le personnage, halos et poussière dorée dans les rayons.

Au sol : ville flamande peinte, briques rouges et ocre, pierre blanche sculptée,
toits d'ardoise, beffroi et clochers, exactement le registre de `ref-decor.jpg`.
Ombres portées franches mais colorées, jamais grises.

Palette relevée directement sur `assets/maps/level-1.webp` : `#5b83ab` bleu ciel,
`#97a8ba` bleu pâle, `#f2ece2` nuage blanc, `#dfd1be` nuage crème, `#c6a47b` pierre
claire, `#a5825e` brique, `#634c3a` bois et ombre, `#f0a34a` soleil et or. Le
turquoise `#2fb3ae` et le crème `#fff3d6` restent réservés au personnage : c'est ce
qui le détache du décor.

À proscrire : nuit, crépuscule, ciel violet ou prune, ciel orageux, néons, brume
grise, palette froide et désaturée.

### Les bugs

Trois cafards volants, carapace brune vernie luisante, ailes translucides en
mouvement, gros casque et lunettes d'aviateur en cuir, écharpe qui claque au vent,
sourire narquois. Ils sont comiques, jamais gore, jamais réalistes. Ils volent
toujours en formation serrée, très vite, avec des traînées de vitesse. En plein jour
ils se découpent en silhouettes sombres sur les cumulus blancs : c'est ce contraste
qui les rend lisibles, il faut le chercher.

### Une règle d'effets à ne pas oublier

Les effets (fumée, onde de choc, poussière) doivent rester **nets et graphiques** :
anneaux, arcs, éclats. Jamais de bouffées molles qui ressemblent à des nuages, sinon
ils se noient dans les vrais cumulus du ciel. C'est la même règle que pour les FX du
jeu.

---

## 4. Découpage plan par plan

14 plans. Les durées sont des cibles de montage : chaque clip est généré un peu plus
long, on coupe au montage.

| # | Durée | Contenu | Caméra | Son |
|---|---|---|---|---|
| 1 | 3,5 s | Steven avance tranquillement au-dessus des nuages, porté par sa mèche de cheveux qui tourne en rotor, une grappe de huit petites orbes serrée contre lui. Étiquette « Steven » flottant au-dessus de sa tête. En fin de plan il tourne la tête vers la droite. | travelling latéral qui suit, léger flottement | thème `petit-prince-intro`, vent |
| 2 | 3,0 s | **Plan des cafards seuls**, Steven n'est pas dans le cadre. Les trois bestioles foncent droit vers l'objectif en formation serrée, une étiquette « Bug » flottant au-dessus de chacune comme un nom d'ennemi de MMORPG, puis dépassent la caméra par le haut dans un souffle. | fixe puis léger recadrage vers le haut au passage | vrombissement qui monte, whoosh |
| 3 | 2,0 s | Impact. Les cafards le percutent de plein fouet, Steven part en vrille, sa mèche décroche, les huit orbes lui échappent des mains et s'éparpillent. | secousse de caméra franche | choc sourd, tintement cristallin des orbes |
| 4 | 2,5 s | Steven se stabilise, se retourne vers eux, paumes ouvertes vers le haut, tête penchée : le geste universel « pourquoi ? ». | plan taille, légère contre-plongée | musique en suspens |
| 5 | 2,5 s | Les trois cafards, arrêtés un peu plus loin, se tiennent le ventre et explosent de rire, puis repartent d'un coup à toute vitesse. | fixe, ils sortent du cadre à gauche | rires stridents, whoosh de départ |
| 6 | 3,5 s | Gros plan sur son visage : d'abord énervé, sourcils froncés. Puis ses yeux s'écarquillent, il réalise. Il baisse la tête. La caméra bascule avec lui vers le bas : tout en bas, la pluie de petites orbes tombe en tournoyant vers la ville ensoleillée. | gros plan puis bascule verticale rapide | coupure musicale, note grave |
| 7 | 2,0 s | Vu de loin, Steven bascule et plonge à la verticale comme un avion de chasse. Deux anneaux de fumée blanche restent en l'air à l'endroit exact de son accélération. | plan large fixe, il file vers le bas du cadre | bang d'accélération |
| 8 | 2,0 s | Chute libre vue de profil, corps tendu vers le bas, mains en avant, aura dorée qui traîne derrière lui, cumulus qui défilent. | travelling latéral qui l'accompagne en chute | vent violent, musique qui remonte |
| 9 | 1,5 s | Très gros plan sur son visage en chute, mâchoire serrée, regard verrouillé sur sa cible, cheveux plaqués par la vitesse. | face, très serré, léger tremblement | respiration, montée de tension |
| 10 | 2,5 s | Impact au sol. Cratère, onde de choc circulaire, poussière dorée projetée, pavés soulevés, en plein soleil. Il est accroupi au centre, poing au sol. | contre-plongée large, secousse | impact `boom-appear`, gravats |
| 11 | 2,0 s | La poussière retombe. Il se redresse, regarde partout, puis ses yeux s'agrandissent : il a vu quelque chose. | plan poitrine, léger arc autour de lui | musique qui repart, tintement |
| 12 | 3,0 s | Une orbe est posée au sol au premier plan, elle clignote doucement. La caméra recule et s'écarte : l'orbe grossit au premier plan pendant que Steven, en second plan, devient petit dans le décor peint. | travelling arrière large | pulsation de l'orbe |
| 13 | 2,5 s | Retour face à lui : il fonce droit vers l'objectif, de plus en plus près, jusqu'à ce que son corps remplisse l'écran. Éclat de lumière blanche et dorée. | travelling avant rapide, il vient dans l'objectif | musique qui monte, coupe nette |

Total : 30,5 s de vidéo. **Il n'y a pas de plan 14** : le carton final « Portfolio
de Steven Dieu » est un écran HTML posé après la vidéo, pas une image générée. Plus
net, accessible, modifiable sans rien regénérer, et gratuit.

### Notes de raccord

- Plan 2 : le passage des cafards **au-dessus** de l'objectif donne le whoosh qui
  vend la vitesse. C'est le plan à ne pas rater.
- Plan 6 : c'est le pivot émotionnel. Trois émotions en 3,5 s, colère puis prise de
  conscience puis abattement. Comme Seedance accepte des clips longs, le tourner en
  une seule prise généreuse et couper au montage, plutôt que de le découper en deux.
- Plan 12 : la mise au point doit rester sur l'orbe au premier plan, Steven flou en
  second plan. C'est ce qui fait comprendre « l'objet compte plus que le personnage ».
- Plan 13 : la sortie n'est plus un fondu au noir mais un **éclat de lumière**. En
  plein jour, un noir tomberait comme un couperet, alors qu'un flash blanc doré
  enchaîne naturellement sur le carton final clair, puis sur le jeu qui est lui aussi
  en plein jour.

---

## 5. Prompts d'images clés

### 5.1 Bloc à coller une seule fois, en tête de conversation

À envoyer avec les trois planches `ref-perso.jpg`, `ref-decor.jpg` et
`ref-flottant.jpg` jointes.

> Je prépare les images clés d'une courte cinématique pour un portfolio jouable.
> Les trois images jointes sont mes références obligatoires : la première fixe le
> personnage, ses proportions et les orbes, la deuxième fixe le style et le niveau de
> finition du décor peint, la troisième montre en OUI / NON la règle la plus
> importante.
>
> **Anatomie du personnage, règle non négociable.** C'est un petit esprit lumineux
> composé de morceaux séparés qui flottent : une tête, un sweat, deux mains, deux
> baskets. Entre le sweat et chaque main gantée il y a **uniquement du vide** : on
> voit le ciel ou le décor à travers cet espace. Le sweat **n'a pas de manches** et
> ses ouvertures d'épaules sont fermées. Sous le sweat il n'y a rien non plus, les
> baskets flottent dans le vide. Aucun bras, aucune épaule, aucune jambe, aucun cou,
> aucune manche, jamais, sur aucune image.
>
> Description : tête de jeune homme, cheveux bruns en pics, barbe de trois jours,
> yeux bleus. Sweat à capuche turquoise, cordons crème, bande basse crème rayée
> orange. Mains gantées de blanc en forme de moufle. Baskets blanc et orange.
>
> **Comment il vole** : il fait tourner la mèche de cheveux du sommet de son crâne
> comme un rotor d'hélicoptère. La mèche est floutée en un disque par la rotation, un
> anneau de vent et de poussière dorée tourne autour, son corps est suspendu sous
> elle et penche vers l'avant. Il n'a ni ailes ni cape.
>
> **Registre graphique.** Je veux un rendu de **key art de jeu vidéo**, peinture
> numérique 2D avec de la matière et des coups de pinceau visibles, éclairage
> dramatique, fort contraste de valeurs, contre-jour, lumière volumétrique,
> profondeur de champ, perspective atmosphérique, poussière dans les rayons, cadrage
> cinématographique. Le **décor doit être détaillé et semi-réaliste**, au niveau de
> finition de la deuxième image jointe, jamais simplifié pour se mettre au niveau du
> personnage : c'est le contraste entre un personnage stylisé et un monde peint riche
> qui fait tout.
>
> **À ne surtout pas faire** : style livre illustré pour enfants, style dessin animé
> pour tout-petits, couleurs bonbon ou pastel, formes simplifiées, décor vide ou
> schématique, contour noir uniforme sur le décor, rendu plat sans ombre, 3D
> plastique lisse, style anime, pixel art.
>
> Lumière : **toutes les images se passent en plein jour**, en milieu de journée.
> Ciel bleu franc, gros cumulus blancs et crème, soleil haut et chaud, ombres
> colorées. Jamais de nuit, jamais de crépuscule, jamais de ciel violet.
>
> Palette imposée : bleu ciel #5b83ab, bleu pâle #97a8ba, nuage blanc #f2ece2, nuage
> crème #dfd1be, pierre claire #c6a47b, brique #a5825e, ombre chaude #634c3a, soleil
> #f0a34a. Le turquoise #2fb3ae et le crème #fff3d6 sont réservés au personnage.
>
> Format : paysage 1536x1024, composition cadrée pour supporter un recadrage 16:9,
> donc rien d'important dans les 10 % du haut et du bas. Aucun texte dans l'image
> sauf si je le demande explicitement.
>
> Je vais te demander 14 images numérotées. Le personnage doit être **rigoureusement
> identique** d'une image à l'autre. Confirme et attends ma première demande.

### 5.2 Les 14 demandes

Les images 1, 6 et 10 sont faites et validées. Les 11 suivantes se demandent **dans
la même conversation**, dans cet ordre : la séquence en vol (2, 3, 4, 5), la chute
(7, 8, 9), le sol (11, 12, 13), puis le carton (14).

Chaque prompt se termine par la clause de continuité. Ne jamais la retirer : c'est
elle qui empêche le personnage de dériver au fil de la conversation.

**Image 2.** Aucun personnage humain dans le cadre : uniquement les trois cafards
volants. Ils foncent droit vers l'objectif en formation serrée en V, déjà proches,
vus en légère contre-plongée, ils occupent une bonne partie du cadre. Carapace brune
vernie et luisante, ailes translucides floutées par la vitesse, gros casque de cuir
et lunettes d'aviateur, longue écharpe qui claque derrière eux, sourire narquois et
dents apparentes. Longues traînées de vitesse et déplacement d'air derrière eux.
Ciel de plein jour, gros cumulus lumineux, soleil en contre-jour, même lumière que
l'image 1. Au-dessus de chacun des trois, flottant dans les airs, une étiquette de
nom comme dans un jeu en ligne : le mot « Bug » en rouge lumineux avec un liseré
sombre, posé sur une petite plaque translucide, exactement comme le nom d'un ennemi
affiché au-dessus d'un monstre dans un MMORPG. Le mot doit être parfaitement lisible
et correctement orthographié : Bug.
Garde exactement le style, la lumière et le registre des images 1, 6 et 10. Rendu key
art cinématique peint, décor détaillé, pas de style enfantin.

**Image 3.** Instant de l'impact, en plein ciel. Les trois cafards de l'image 2
traversent le cadre de la droite vers la gauche à toute vitesse et le percutent de
plein fouet. Il part en vrille, sweat et tête désaxés, bouche ouverte de surprise,
son disque de rotation décroche et part de travers. La grappe d'orbes éclate : les
huit orbes dorées s'éparpillent en gerbe dans toutes les directions, chacune avec sa
traînée lumineuse. Éclats de lumière nets au point de contact. Cadre penché.
Garde exactement le personnage, le visage, le sweat et le style des images 1, 6
et 10. Aucun bras, aucune manche, aucun cou : la tête, les mains et les baskets
flottent séparées. Rendu key art cinématique peint, décor détaillé, pas de style
enfantin.

**Image 4.** Le personnage seul, stabilisé en vol, disque de rotation à nouveau
régulier au-dessus de sa tête, vu de face en légère contre-plongée sur le ciel et les
cumulus. Ses deux mains gantées flottantes sont ouvertes paumes vers le ciel,
écartées loin de part et d'autre du sweat. Tête penchée sur le côté, sourcils
froncés, bouche pincée : il demande des explications sans un mot. Plus aucune orbe
dans le cadre.
Garde exactement le personnage, le visage, le sweat et le style des images 1, 6
et 10. Aucun bras, aucune manche, aucun cou : la tête, les mains et les baskets
flottent séparées. Rendu key art cinématique peint, décor détaillé, pas de style
enfantin.

**Image 5.** Les trois cafards volants de l'image 2, arrêtés en vol devant un
gros cumulus lumineux, groupés, en train de rire aux éclats : corps renversés en
arrière, pattes sur le ventre, bouches grandes ouvertes, lunettes d'aviateur
relevées, petites larmes de rire. Au second plan, loin et flou, le personnage
minuscule les regarde. Arcs de rire peints autour d'eux.
Garde exactement le personnage, le visage, le sweat et le style des images 1, 6
et 10. Aucun bras, aucune manche, aucun cou : la tête, les mains et les baskets
flottent séparées. Rendu key art cinématique peint, décor détaillé, pas de style
enfantin.

**Image 7.** Plan large en plongée depuis le ciel. Le personnage plonge **la tête la
première** vers le sol. L'ordre d'empilement de ses morceaux, du haut vers le bas de
l'image, doit être exactement celui-ci : les deux baskets tout en haut, elles
traînent derrière lui ; le sweat juste en dessous ; les deux mains gantées plaquées
le long du sweat, doigts vers le bas ; et **la tête tout en bas**, la plus proche du
sol, cheveux pointés vers le sol. Il regarde vers le bas, vers la ville, pas vers
l'objectif. Son disque de rotation s'est arrêté. Flou de vitesse vertical et traînée
d'air derrière lui pour qu'on sente qu'il tombe très vite. Loin au-dessus de lui,
deux anneaux de fumée parfaitement circulaires restent suspendus dans l'air, marquant
son accélération : des anneaux fins, légèrement grisés et translucides, à bord net,
qu'on ne puisse pas confondre avec les nuages. Tout en bas, très loin sous une couche
de cumulus, la Grand-Place et le beffroi de l'image 10, en plein soleil.
Garde exactement le personnage, le visage, le sweat et le style des images 1, 6
et 10. Aucun bras, aucune manche, aucun cou : la tête, les mains et les baskets
flottent séparées. Rendu key art cinématique peint, décor détaillé, pas de style
enfantin.

**Image 8.** Chute libre vue de profil strict. Le personnage tombe tête la
première, sweat tendu, ses deux mains gantées ramenées en pointe devant lui, ses deux
baskets alignées derrière, chacune bien détachée. Cheveux plaqués vers l'arrière,
plus aucun disque de rotation. Longue aura dorée et traînée de poussière lumineuse
derrière lui. Le ciel et les cumulus filent en flou de vitesse horizontal. Il occupe
le centre du cadre.
Garde exactement le personnage, le visage, le sweat et le style des images 1, 6
et 10. Aucun bras, aucune manche, aucun cou : la tête, les mains et les baskets
flottent séparées. Rendu key art cinématique peint, décor détaillé, pas de style
enfantin.

**Image 9.** Très gros plan de face sur son visage en pleine chute, cadrage
encore plus serré que l'image 6. Cheveux plaqués vers l'arrière par la vitesse,
mâchoire serrée, dents serrées, regard verrouillé droit vers l'objectif, reflet doré
dans les yeux bleus. Le fond n'est qu'un flou de vitesse bleu et or.
Garde exactement le personnage, le visage, le sweat et le style des images 1, 6
et 10. Aucun bras, aucune manche, aucun cou : la tête, les mains et les baskets
flottent séparées. Rendu key art cinématique peint, décor détaillé, pas de style
enfantin.

**Image 11.** Le personnage debout au centre de la Grand-Place de l'image 10, la
poussière retombe autour de lui dans les rayons du soleil, les gravats sont encore au
sol. Il regarde vers la droite, tête tournée, yeux très écarquillés, sourcils levés :
il vient de repérer quelque chose. Plan poitrine. Ciel bleu et cumulus blancs
au-dessus, façades de briques et beffroi détaillés derrière.
Garde exactement le personnage, le visage, le sweat et le style des images 1, 6
et 10. Aucun bras, aucune manche, aucun cou : la tête, les mains et les baskets
flottent séparées. Rendu key art cinématique peint, décor détaillé, pas de style
enfantin.

**Image 12.** Composition en profondeur sur la Grand-Place. Au tout premier plan
à droite, une petite orbe dorée posée sur les pavés ensoleillés, si proche de
l'objectif qu'elle occupe un quart du cadre, parfaitement nette, halo lumineux
pulsant autour d'elle. Loin derrière, petit et légèrement flou, le personnage la
regarde. Le beffroi et les pignons flamands tout autour, ciel bleu et cumulus. Fort
effet de profondeur de champ, mise au point sur l'orbe.
Garde exactement le personnage, le visage, le sweat et le style des images 1, 6
et 10. Aucun bras, aucune manche, aucun cou : la tête, les mains et les baskets
flottent séparées. Rendu key art cinématique peint, décor détaillé, pas de style
enfantin.

**Image 13.** Le personnage fonce droit vers l'objectif, vu de face, très proche,
déterminé, sourcils froncés et sourire décidé, ses deux mains gantées lancées en
avant de part et d'autre. Il occupe presque tout le cadre. Léger flou de mouvement
radial. La Grand-Place ensoleillée floutée derrière lui, soleil en contre-jour qui
déborde sur les bords du cadre.
Garde exactement le personnage, le visage, le sweat et le style des images 1, 6
et 10. Aucun bras, aucune manche, aucun cou : la tête, les mains et les baskets
flottent séparées. Rendu key art cinématique peint, décor détaillé, pas de style
enfantin.

Il n'y a pas d'image 14 : le carton final est un écran HTML.

### 5.3 Images de fin de plan

Seedance donne un bien meilleur résultat quand on lui fournit aussi l'image de fin.
Quatre plans en ont besoin parce que la composition change beaucoup :

- **Plan 2 fin** : les trois cafards énormes, à moitié sortis par le haut du cadre.
- **Plan 6 fin** : cadre basculé vers le sol, la pluie de huit petites orbes qui
  tombent en tournoyant vers la ville ensoleillée, vues de haut à travers les nuages.
- **Plan 12 fin** : même scène que l'image 12 mais caméra beaucoup plus reculée,
  personnage minuscule, orbe toujours au premier plan.
- **Plan 13 fin** : cadre presque entièrement mangé par un éclat de lumière blanche
  et dorée, on ne devine plus qu'un bord de sweat turquoise.

### 5.4 Prompts de réparation

Trois erreurs reviennent. À envoyer en réponse directe sur l'image fautive, sans
relancer une génération complète : c'est plus rapide et ça ne casse pas la cohérence
du personnage.

**Des bras sont apparus :**

> Reprends exactement cette image et **supprime les bras**. Entre le sweat et chaque
> main gantée il ne doit rester que du vide : on voit le ciel à travers. Le sweat n'a
> pas de manches, ses ouvertures d'épaules sont fermées et arrondies. Les mains
> flottent librement, séparées du corps par un large espace. Ne change rien d'autre :
> même cadrage, même lumière, même décor, même visage.

**Le rendu fait enfantin :**

> Garde exactement la même composition mais remonte le rendu d'un cran : peinture
> numérique de key art de jeu vidéo, matière et coups de pinceau visibles, éclairage
> dramatique avec contre-jour, contraste de valeurs marqué, profondeur de champ,
> décor beaucoup plus détaillé et semi-réaliste, poussière dans la lumière. Enlève
> tout ce qui fait illustration pour enfants : couleurs bonbon, formes simplifiées,
> décor vide, rendu plat, contour noir uniforme.

**Les orbes sont trop grosses ou pas assez nombreuses :**

> Remplace les orbes par **huit petites orbes** en grappe serrée contre son sweat.
> Chacune fait environ un quart de sa tête, pas plus. Même modèle d'orbe que dans
> l'image de référence : verre ambré, monture d'or, gemmes turquoise, disque central
> lisse. Ne change rien d'autre.

---

## 6. Prompts d'animation Seedance

Le principe : l'image clé porte tout le décor et le personnage, le prompt ne décrit
plus que **le mouvement et la caméra**. Ne pas redécrire le personnage, cela pousse le
modèle à le redessiner et donc à le déformer.

### 6.0 Un clip par plan, généreusement long

Seedance accepte jusqu'à 30 s par clip. S'en servir comme **marge**, pas comme
prétexte à faire un plan-séquence :

- **Générer environ 3x la durée cible** et choisir au montage la fenêtre où le
  personnage ne dérive pas. C'est le meilleur filet de sécurité du projet.
- **Un clip par plan quand même.** Les modèles vidéo prolongent une action continue,
  ils ne savent pas faire une coupe : demander plusieurs plans dans une génération
  donne des fondus mous, pas du montage. Et le rythme de l'intro est justement dans
  les coupes.
- **La dérive est proportionnelle à la durée.** Sur un personnage fait de morceaux
  qui flottent, plus le clip est long, plus le modèle finit par lui recoller des bras.
- **Vérifier le compromis durée / qualité** de l'offre : si un clip long sort en
  résolution inférieure ou coûte beaucoup plus cher, revenir à des clips courts.

### 6.1 Seedance : versions, modes et paramètres

Relevé le 2026-07-31. Sources en fin de section.

**Versions.** Seedance **2.0** génère des clips de **4 à 15 s**. Le palier phare monte
à la 4K, les paliers **Fast** et **Mini** plafonnent à 720p pour beaucoup moins cher.
Seedance **2.5** est la version qui fait **30 s en une seule passe**, avec audio natif.
Les 1.x sont dépassées. Donc : si l'offre annonce 30 s, c'est de la 2.5.

**Quatre modes d'entrée.**

1. *Texte vers vidéo* : inutilisable ici, le personnage serait réinventé à chaque clip.
2. *Image vers vidéo, image de départ* : le mode par défaut du projet.
3. *Image de départ + image de fin* : le modèle bascule en **interpolation** entre deux
   états connus. Moins de dérive, mouvement plus prévisible. C'est exactement ce qu'on
   a préparé pour les plans 2, 6, 12 et 13, et la doc confirme que c'est le bon usage.
4. *Référence vers vidéo* : jusqu'à **9 images**, 3 vidéos et 3 audios dans une même
   génération, désignés dans le prompt par `@image1` … `@image9`, `@video1`, `@audio1`.
   La numérotation suit l'ordre d'envoi. Chaque référence peut porter un rôle
   différent : personnage et vêtements sur l'une, décor sur l'autre, mouvement de
   caméra sur une vidéo.

**Paramètres utiles.**

| Paramètre | À mettre |
|---|---|
| `aspect_ratio` | `16:9` (les valeurs possibles vont de 21:9 à 9:16, plus `adaptive`) |
| `resolution` | 720p pour les brouillons, la plus haute pour le rendu final |
| `duration` | 3x la durée cible du plan. `-1` laisse le modèle décider, à éviter ici |
| audio natif | **coupé**. La bande-son du jeu existe déjà, l'audio généré la parasiterait |
| `seed` | à noter quand un rendu est bon, pour pouvoir le retrouver |

**Écriture du prompt de mouvement**, structure recommandée par la doc :
sujet, puis action sur toute la durée, puis ambiance, puis **caméra nommée**, puis
rythme. Deux règles qui reviennent partout : ne pas redécrire ce qui est déjà dans
l'image de départ, et nommer le mouvement de caméra précisément (« lent travelling
avant ») plutôt que d'écrire « cinématique ». Une seule transformation majeure par
clip : cumuler orbite + rotation + changement de lumière fait tout rater.

**Deux pièges à connaître.**

- **Les visages humains réalistes et identifiables sont bloqués par le filtre.** Le
  visage validé de l'intro est peint, donc il devrait passer, mais les images 6 et 9
  sont des très gros plans presque photoréalistes : ce sont les deux plans les plus
  susceptibles d'être refusés. Si ça arrive, regénérer l'image clé un cran plus
  stylisée plutôt que d'insister.
- **Brouillonner sur Fast ou Mini**, valider le mouvement en 720p, puis ne repasser
  sur le palier phare que pour le rendu final. C'est le conseil de production qui
  revient dans toutes les docs, et il divise la facture.

Sources : documentation Scenario sur la famille Seedance, fiche modèle Replicate,
guide de prompt RunDiffusion, guides Seedance 2.5.

### 6.2 Paramètres réels via Higgsfield

Relevés directement sur le connecteur MCP Higgsfield le 2026-07-31, donc fiables,
contrairement aux valeurs des articles de blog.

Deux modèles utiles, `seedance_2_0` et `seedance_2_0_mini`.

| Paramètre | `seedance_2_0` | `seedance_2_0_mini` |
|---|---|---|
| `duration` | 4 à 15 s, défaut 5 | idem |
| `resolution` | 480p, 720p, 1080p, 4k | 480p, 720p seulement |
| `mode` | `std` (jusqu'à la 4K) ou `fast` (480p/720p) | pas de mode |
| `bitrate_mode` | `standard` ou `high` | idem |
| `genre` | auto, action, horror, comedy, noir, drama, epic | idem |
| `generate_audio` | **défaut `true`** | **défaut `true`** |
| `aspect_ratio` | auto, 16:9, 9:16, 4:3, 3:4, 1:1, 21:9 | idem |

Rôles de médias acceptés par les deux : `start_image`, `end_image`,
`image_references`, `video_references`, `audio_references`.

**Ce qu'il faut en retenir pour ce projet.**

- **15 s maximum, confirmé.** Pas de 30 s : c'est bien Seedance 2.0, pas 2.5. La
  stratégie « générer 3x la durée cible et couper » reste valable, un plan de 3,5 s
  peut se tourner en 12 s.
- **`generate_audio` doit être passé à `false`.** Il est à `true` par défaut, et la
  bande-son du jeu existe déjà : un son généré viendrait la parasiter.
- **`start_image` + `end_image` sont natifs.** Les quatre images de fin de plan
  préparées pour les plans 2, 6, 12 et 13 se branchent directement.
- **`image_references` est le verrou supplémentaire** contre le retour des bras : on
  peut joindre une vue validée du personnage en plus de l'image de départ.
- **Brouillonner sur `seedance_2_0_mini` en 720p**, puis ne repasser sur
  `seedance_2_0` en `std` que pour le rendu final. Le montage final est en 1280x720,
  donc **le 1080p suffit largement, la 4K est du gaspillage** de crédits.
- `genre` : `epic` ou `action` sur les plans 3, 7, 10 et 13, `auto` ailleurs. À tester,
  ça peut aussi durcir l'image plus que voulu.
- `get_cost: true` permet de connaître le coût en crédits **sans lancer** la
  génération. À utiliser systématiquement avant de lancer une série.

| # | Prompt de mouvement |
|---|---|
| 1 | La mèche de cheveux tourne en rotor au-dessus de sa tête, le corps oscille doucement sous elle, avance stable vers la droite. Les cordons du sweat ondulent. La caméra suit latéralement à la même vitesse. Nuages et poussière dorée défilent lentement. En toute fin de plan il tourne vivement la tête vers la droite. |
| 2 | Les trois insectes volants foncent vers l'objectif et grossissent très vite, leurs étiquettes de nom les suivent en flottant, puis ils sortent du cadre par le haut dans un souffle. La caméra bascule légèrement vers le haut pour les suivre. |
| 3 | Impact violent : le personnage est projeté et part en vrille, sa mèche décroche, les huit petites orbes lui échappent et s'éparpillent en gerbe avec des traînées lumineuses. Forte secousse de caméra à l'impact, puis stabilisation. |
| 4 | Il se retourne vers la droite, écarte lentement ses deux mains paumes vers le ciel et penche la tête sur le côté. Mouvement calme, caméra presque fixe, très léger travelling avant. |
| 5 | Les trois insectes se plient de rire, corps renversés en arrière, puis filent brusquement hors du cadre par la gauche en laissant des traînées de vitesse. Caméra fixe. |
| 6 | Le visage passe de la colère à la stupeur, les yeux s'écarquillent. Il baisse la tête. La caméra bascule vers le bas avec lui et découvre les orbes qui tombent en tournoyant très loin en dessous, au-dessus de la ville. Mouvement continu, sans coupure. |
| 7 | Il bascule à la verticale et plonge à toute vitesse vers le bas du cadre. Les deux anneaux de fumée restent immobiles en l'air et se dilatent lentement en gardant leur forme d'anneau. Caméra fixe, il quitte le cadre par le bas. |
| 8 | Chute libre continue, le corps reste tendu, l'aura dorée s'allonge derrière lui. Les nuages défilent en flou de vitesse. La caméra tombe avec lui, latéralement. |
| 9 | Très léger zoom avant sur le visage, tremblement de caméra, cheveux qui vibrent sous la vitesse, regard qui se verrouille. |
| 10 | Impact au sol : l'onde de choc circulaire se propage vers l'extérieur, la poussière dorée jaillit puis retombe dans les rayons du soleil, les débris volent. Forte secousse de caméra à l'impact puis apaisement. |
| 11 | La poussière retombe. Il se redresse, tourne la tête de gauche à droite, puis ses yeux s'écarquillent d'un coup. Léger mouvement d'arc de la caméra autour de lui. |
| 12 | Travelling arrière large et régulier. L'orbe reste énorme et nette au premier plan et pulse doucement. Le personnage et le décor s'éloignent et rapetissent derrière elle. |
| 13 | Il court droit vers l'objectif, de plus en plus vite et de plus en plus près, jusqu'à ce que son corps remplisse tout le cadre. L'image finit noyée dans un éclat de lumière blanche et dorée. |

### 6.3 Audio généré : direction sonore par plan

`generate_audio` est laissé à `true`. Seedance fabrique alors la bande son en même
temps que l'image, ce qui donne des bruitages calés à l'image gratuitement. Deux
règles pour que ça serve au lieu de gêner :

- **Interdire les voix et la musique dans chaque prompt.** Le modèle a tendance à
  ajouter du dialogue ou une nappe musicale, ce qui entrerait en collision avec la
  musique du jeu. Terminer chaque prompt de mouvement par une ligne « Son : … Aucune
  voix, aucune parole, aucune musique. »
- **Ne garder que les bruitages au montage.** La musique reste celle du jeu
  (`petit-prince-intro`), posée par-dessus.

Direction sonore par plan :

| # | Son à demander |
|---|---|
| 1 | vent d'altitude régulier, souffle léger du rotor |
| 2 | vrombissement d'ailes qui monte puis whoosh de passage tout près |
| 3 | choc sourd et mat, tintements cristallins qui s'éparpillent |
| 4 | souffle du rotor, ambiance calme et suspendue |
| 5 | rires stridents d'insectes, puis whoosh de départ |
| 6 | vent qui s'atténue jusqu'au silence |
| 7 | bang d'accélération puis sifflement qui s'éloigne |
| 8 | vent violent de chute libre, grondement grave |
| 9 | vent assourdi, respiration courte et tendue |
| 10 | impact très grave, gravats, poussière qui retombe |
| 11 | derniers gravats, léger tintement cristallin au loin |
| 12 | pulsation cristalline régulière de l'orbe |
| 13 | course, souffle qui monte, montée vers un éclat |

### 6.4 bis Coûts réels et plan de budget

Relevés le 2026-07-31 sur le connecteur Higgsfield, en 16:9, avec `get_cost` donc sans
rien dépenser. **Le coût est linéaire avec la durée** :

| Configuration | Crédits / seconde | Un plan de 6 s |
|---|---|---|
| `seedance_2_0_mini` 720p | 2,5 | 15 |
| `seedance_2_0` 720p | 4,5 | 27 |
| `seedance_2_0` 1080p | 9 | 54 |
| `seedance_2_0` 4K | 22 | 132 |

Avec 13 plans générés à environ deux fois leur durée cible, soit **66 s de rushes** :

| Stratégie | Coût | Reste sur 1210 crédits |
|---|---|---|
| tout en mini 720p | 165 | 1045 |
| tout en 720p | 297 | 913 |
| tout en 1080p | **594** | 616 |
| 1080p + 4K sur 3 plans phares | 815 | 395 |
| tout en 4K | 1452 | **impossible** |

La 4K intégrale ne tient pas dans le budget, et sans la moindre reprise. Or il y aura
des reprises : c'est le poste de dépense qu'il faut protéger en priorité.

Et le rendu final est un `.webm` de 1280x720 pesant moins de 5 Mo dans une page web.
Réduire de la 4K vers du 720p nettoie mieux les artefacts que réduire du 1080p, c'est
vrai, mais l'écart visible après réduction est faible face au facteur 2,4 sur le prix.

**Recommandation : tout en 1080p, et réserver la 4K aux plans 1, 10 et 13** si on veut
un cran de plus sur l'ouverture, l'impact et la dernière image. C'est là que ça se voit.

### 6.4 Règle sur le texte

Ne rien faire écrire à Seedance. Les modèles vidéo déforment le texte dès que ça
bouge.

- **Étiquette « Bug »** : peinte dans l'image clé du plan 2, une au-dessus de chaque
  cafard, en rouge d'ennemi de MMORPG. Vérifier l'orthographe sur la vidéo rendue.
  Si Seedance la fait baver, la retirer de l'image clé et l'incruster au montage.
- **Étiquette « Steven »** : l'image 1 est validée sans elle. Demander à GPT la même
  plaque que celle du plan 2 mais avec « Steven » écrit en doré, sur fond neutre, en
  élément isolé, puis l'incruster au montage au-dessus de sa tête. Avantage : les
  deux plaques se ressemblent forcément, et aucune des deux ne peut se déformer en
  animation. Convention de MMORPG à respecter : nom d'ennemi en rouge, nom du joueur
  en doré.
- Le carton final « Portfolio de Steven Dieu » : **entièrement en HTML**, aucune image
  générée. La vidéo se termine sur l'éclat de lumière du plan 13, et le carton prend
  le relais en fondu. Avantages : texte net, indexable, lisible par un lecteur
  d'écran, modifiable sans regénérer la vidéo, et zéro crédit dépensé.

---

## 7. Intégration dans le site

### Où ça se branche

Nouvel overlay `#intro` entre `#cover` et `#prelude` dans [index.html](../../index.html).
Le clic sur « Jouer » de l'accueil lance la vidéo au lieu d'ouvrir le prélude
directement. À la fin de la vidéo, on enchaîne sur le prélude.

Le fait que la cinématique finisse en pleine lumière au lieu de finir au noir rend le
raccord plus doux : on enchaîne sur un écran clair, puis sur la carte 1 qui est elle
aussi en plein jour.

### Le prélude texte ne disparaît pas complètement

Recommandation : garder après la vidéo une version courte du prélude, réduite à
l'orbe, à la phrase d'objectif et au bouton « Jouer ». Raisons :

1. Un recruteur pressé ne regarde pas 32 s de cinématique, il veut le titre, la ville
   et le poste. Ces informations doivent rester en texte dans le DOM.
2. Référencement : une vidéo n'est pas indexable, le `h1` actuel oui.
3. Accessibilité : lecteurs d'écran, son coupé, connexion lente.

Concrètement : la vidéo remplace l'écran narratif, pas la carte d'identité.

### Points techniques à ne pas rater

- **Bouton « Passer »** visible en permanence, plus la touche Échap. Obligatoire.
- **Deuxième visite** : mémoriser dans `localStorage` que l'intro a été vue et la
  sauter par défaut, avec un lien « revoir l'intro » sur l'accueil.
- **Mouvement réduit** : la machine de Steven a `prefers-reduced-motion` activé. Sous
  cette préférence, ne pas lancer la cinématique automatiquement : afficher l'image
  d'affiche et un bouton « Voir l'intro ». Sinon Steven ne verra jamais sa propre
  intro sur son poste, et un utilisateur sensible au mouvement se prend 32 s de
  caméra qui secoue.
- **Son** : le clic sur « Jouer » de l'accueil est un geste utilisateur, donc la
  vidéo peut démarrer avec le son. Respecter l'état du bouton son de l'accueil.
- **Chargement** : `preload="none"` tant que l'accueil est affiché, précharger au
  survol du bouton « Jouer ».
- **Mobile en portrait** : le 16:9 sera très petit. Garder l'action au centre du
  cadre et accepter les bandes, ou prévoir un recadrage 9:16 au montage.
- **Cache** : bumper `?b=` sur `index.html`, `styles.css` et `game.js`, et poser un
  `?b=` sur les sources vidéo comme pour `dust-loop`.

### Encodage

Cible 1280x720, 30 ips.

```bash
ffmpeg -i intro-master.mp4 -c:v libvpx-vp9 -crf 34 -b:v 0 -vf scale=1280:720 -c:a libopus -b:a 96k assets/video/intro.webm
```

```bash
ffmpeg -i intro-master.mp4 -c:v libx264 -crf 26 -preset slow -vf scale=1280:720 -c:a aac -b:a 96k -movflags +faststart assets/video/intro.mp4
```

Si le `.webm` dépasse 5 Mo, monter le `crf` à 38 avant de rogner dans le montage.
Attention : un ciel bleu dégradé avec de gros nuages est plus dur à compresser qu'un
ciel sombre, surveiller les aplats de bleu qui se marbrent.

---

## 8. Pipeline de production

1. Générer les 14 images clés dans une seule conversation ChatGPT, avec le bloc 5.1
   en tête et les deux planches jointes. Les demander une par une, dans l'ordre.
2. Télécharger en `plan-01.png` à `plan-14.png` dans un dossier de travail local.
3. Recadrer en 16:9 : `python tools/intro-video/crop169.py <dossier>`.
4. Valider la cohérence du personnage sur les 14 images **avant** de lancer la moindre
   animation. Regénérer les images qui dérivent.
5. Animer plan par plan dans Seedance avec les prompts du 6, image de début et, pour
   les plans 2, 6, 12 et 13, image de fin.
6. Monter, caler le son, exporter un master.
7. Encoder, intégrer, bumper les caches.

### Ordre de validation conseillé

Vérifier chaque image dans cet ordre, du plus grave au moins grave :

1. **Bras ou manches** : si le modèle en a remis, corriger tout de suite avec le
   prompt de réparation du 5.4. Ne jamais laisser passer, sinon la suite de la
   conversation prend cette image comme nouvelle référence et tout dérive.
2. **Registre** : est-ce que ça fait key art de jeu ou illustration pour enfants ?
3. **Hélice** : la mèche tourne-t-elle vraiment, avec le flou de rotation ?
4. **Orbes** : huit, petites, en grappe.
5. Cohérence du visage et du sweat avec les images précédentes.

Ne pas produire les 14 images d'un bloc. Faire d'abord les **images 1, 6 et 10** :
un vol, un gros plan de visage, une scène au sol avec effet. Si le personnage tient
sur ces trois-là, il tiendra sur les onze autres. Puis animer le seul plan 1 dans
Seedance pour vérifier que le personnage ne se déforme pas en mouvement, en
particulier ses mains et ses pieds flottants, qui sont exactement ce qu'un modèle
vidéo a tendance à vouloir rattacher au corps.

C'est le vrai risque du projet : un modèle vidéo veut donner des bras à un
personnage qui n'en a pas.

---

## 9. Fichiers de ce dossier

| Fichier | Rôle |
|---|---|
| `scenario.md` | ce document |
| `ref-perso.jpg` | planche de référence personnage, orbes et palette jour, à joindre aux prompts |
| `ref-decor.jpg` | extrait de la carte 1 peinte, référence de style et de niveau de finition du décor |
| `ref-flottant.jpg` | schéma OUI / NON sur l'absence de bras et de jambes, à joindre aussi |
| `crop169.py` | recadre en 16:9 les images téléchargées |

---

## 10. Procédé manga (à partir du 2026-07-31)

### 10.1 Le principe

On ne fabrique plus une image par plan. On fabrique un **dossier de préparation**, et
on le donne en bloc à Seedance en mode référence, qui accepte jusqu'à 9 images. Il lit
l'ensemble et compose le film lui-même. On lui donne la matière et le scénario, on le
laisse réaliser.

Le dossier :

1. **Planche personnage** : tous les morceaux du personnage, les orbes, encrés.
2. **Planche décor** : la ville et le ciel, encrés dans le même style.
3. **Planches de scénario** : quatre ou cinq planches à cases qui racontent les 13 beats.

Puis trois ou quatre générations Seedance, chacune avec le dossier complet et un acte
du scénario, parce que le modèle plafonne à 15 s par clip. À l'intérieur de chaque
acte, il est libre.

### 10.2 La règle qui a tout débloqué : convertir, jamais créer

Trois tentatives ont été nécessaires pour la planche personnage :

- **Demander une planche de personnage à créer** → le modèle lui a planté une hélice
  mécanique sur la tête et lui a remis des manches dès les vues de profil.
- **Insister sur les vues de profil et de dos** → pire : il lui a dessiné un cou, des
  épaules et un torse complet, plus aucun morceau flottant.
- **Demander de CONVERTIR la planche existante en style manga, sans rien recomposer**
  → réussi du premier coup.

**Sur ce personnage, ne jamais laisser le modèle dessiner librement.** Il n'a aucun
référent pour un corps fait de morceaux séparés, donc il le normalise systématiquement.
Toujours partir d'une image existante et demander un changement de rendu, en écrivant
explicitement « ne déplace rien, ne recompose rien, c'est une conversion de style ».

### 10.3 Direction artistique

- Encrage manga, trait de plume, hachures, trames grises, noirs francs.
- **Planche personnage** : noir et blanc, sauf le sweat turquoise, les orbes dorées et
  les baskets orange, qui restent en couleur. Ce sont les repères qui permettront au
  joueur de reconnaître son avatar en entrant dans le jeu.
- **Planche décor et planches de scénario** : noir et blanc intégral.

### 10.4 Modèles et coûts

| Usage | Modèle | Coût |
|---|---|---|
| Planches | `seedream_v4_5`, quality `high`, jusqu'à 4992x3328 | **1 crédit l'image** |
| Film | `seedance_2_0`, 1080p, mode `std` | 9 crédits la seconde |

Les planches ne coûtent presque rien : itérer librement, ne jamais valider une planche
approximative pour économiser.

### 10.5 État

- Planche personnage : **faite et validée**, `D:\Downloads\intro\manga\perso-C.png`.
- Planche décor : en cours.
- Planches de scénario : à faire.

### 10.6 Découpage en planches

Quatre planches, format portrait 2:3, quatorze cases au total. Une planche par acte,
ce qui correspond aussi au découpage des générations Seedance : un acte par clip.

**Planche 1, « L'accroc »** (beats 1, 2, 3)

1. Grande case haut de page : Steven vole au-dessus des nuages, mèche en rotor, la
   grappe d'orbes serrée contre lui. Étiquette de nom flottante « Steven ».
2. Bandeau : les trois cafards en formation foncent vers le lecteur, étiquettes
   « Bug » au-dessus de chacun, longues lignes de vitesse.
3. Grande case bas de page : l'impact. Steven part en vrille, les orbes explosent en
   gerbe, onomatopée d'impact.

**Planche 2, « La moquerie »** (beats 4, 5, 6)

1. Steven stabilisé, mains ouvertes paumes vers le ciel, tête penchée : « pourquoi ? »
2. Les trois cafards pliés de rire, larmes aux yeux.
3. Les cafards repartent d'un coup, traînées de vitesse.
4. Gros plan sur le visage de Steven, furieux, puis bandeau vers le bas : les orbes
   tombent en tournoyant vers la ville, très loin en dessous.

**Planche 3, « Le plongeon »** (beats 7, 8, 9, 10)

1. Il bascule à la verticale, deux anneaux de fumée restent suspendus.
2. Chute de profil, lignes de vitesse verticales sur toute la case.
3. Très gros plan sur son visage, mâchoire serrée, regard verrouillé.
4. Case pleine largeur en bas : l'impact au sol sur la Grand-Place, onde de choc,
   pavés soulevés, beffroi derrière.

**Planche 4, « L'orbe »** (beats 11, 12, 13)

1. Il se redresse au milieu de la poussière, yeux écarquillés.
2. L'orbe au premier plan, énorme et clignotante, lui minuscule et flou derrière.
3. Grande case bas de page : il fonce droit vers le lecteur, son visage remplit la
   case, lignes de vitesse radiales.

**Règles de fabrication des planches :**

- Chaque planche se génère par **conversion**, avec la planche personnage et la
  planche décor en références, jamais en création libre. Rappeler l'anatomie à chaque
  fois : morceaux détachés, aucun bras, aucun cou.
- Onomatopées japonaises autorisées et souhaitables, elles font l'identité manga.
  Mais **aucun texte en français dans les cases** : les étiquettes « Steven » et
  « Bug » sont les seules exceptions, et il faudra vérifier leur orthographe.
- Noir et blanc intégral sur les planches de scénario.
