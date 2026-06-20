/* ============================================================================
   « Les Lucioles de Nantes : Le Crépuscule de la Loire »
   Portfolio jouable de Steven Dieu — moteur de jeu, 100% Canvas 2D, zéro
   dépendance, zéro image. Tout est dessiné par le code.
   ----------------------------------------------------------------------------
   Tu n'as normalement PAS besoin de toucher ce fichier : tout ton contenu
   (projets, contacts) se modifie dans content.js.
   ============================================================================ */
(function () {
  'use strict';

  /* =========================================================================
     VERSION — lue depuis le ?b= de game.js dans index.html (bumpé à chaque
     déploiement). Loguée tout de suite au démarrage pour vérifier d'un coup
     d'œil, dans la console, que le cache a bien servi la dernière version.
     ========================================================================= */
  const VERSION = (function () {
    try {
      const src = (document.currentScript && document.currentScript.src) || '';
      const m = src.match(/[?&]b=(\d+)/);
      return m ? m[1] : '?';
    } catch (e) { return '?'; }
  })();
  console.log(
    '%c Les Lucioles de Nantes %c build #' + VERSION + ' ',
    'background:#3a2a66;color:#FFD24A;font-weight:bold;border-radius:3px 0 0 3px;padding:2px 6px',
    'background:#FFD24A;color:#1a1033;font-weight:bold;border-radius:0 3px 3px 0;padding:2px 6px'
  );

  /* =========================================================================
     0. OUTILS
     ========================================================================= */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  // RNG déterministe (foliage stable d'une session à l'autre)
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Couleurs : parse hex -> {r,g,b}, lerp, format
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function mixRgb(a, b, t) {
    return {
      r: Math.round(lerp(a.r, b.r, t)),
      g: Math.round(lerp(a.g, b.g, t)),
      b: Math.round(lerp(a.b, b.b, t)),
    };
  }
  const rgbStr = (c, a) => (a == null ? `rgb(${c.r},${c.g},${c.b})` : `rgba(${c.r},${c.g},${c.b},${a})`);

  /* =========================================================================
     1. PALETTE — jungle lumineuse stylisée
        (lerp "matin doux" -> "midi doré" selon la chaleur w)
     ========================================================================= */
  const DUSK = {   // état de départ : matin clair, légèrement brumeux
    skyTop: '#5FB4DC', skyMid: '#AEDDDC', skyHorizon: '#FBEAC2',
    sunCore: '#FFF8DC', sunHalo: '#FFDD96',
    foliageFar: '#8FC2B0', foliageNear: '#55AC4E', foliageShadow: '#2E7C3E',
    ground: '#988F7E', groundRim: '#A9E86A',
    avatarCore: '#FFE5B8', avatarRim: '#F2A878', hair: '#6B3FA0',
    accentGlow: '#FFD24A', projectOrb: '#5FE0C8', vignette: '#1E2C18',
    water: '#4FB0C4', waterSpec: '#C8F6FF', petal: '#C46FD8',
    stone: '#9A917F', stoneSh: '#6E6657', stoneDk: '#514B40', cloud: '#FCF7EC',
  };
  const ABLAZE = {  // état rallumé : midi doré, végétation éclatante
    skyTop: '#73C8E6', skyMid: '#CCEFC2', skyHorizon: '#FFE9A8',
    sunCore: '#FFFDEC', sunHalo: '#FFE6A6',
    foliageFar: '#A8D2B4', foliageNear: '#71D25E', foliageShadow: '#3C9A50',
    ground: '#AAA08C', groundRim: '#C9FF82',
    avatarCore: '#FFF0CE', avatarRim: '#FFC088', hair: '#8A5FC0',
    accentGlow: '#FFE07A', projectOrb: '#8FFFE0', vignette: '#28381F',
    water: '#5FC8D8', waterSpec: '#E0FCFF', petal: '#D98AE6',
    stone: '#ABA28C', stoneSh: '#7E7665', stoneDk: '#5E574A', cloud: '#FFFEF6',
  };
  const DUSK_RGB = {}, ABLAZE_RGB = {};
  for (const k in DUSK) { DUSK_RGB[k] = hexToRgb(DUSK[k]); ABLAZE_RGB[k] = hexToRgb(ABLAZE[k]); }
  // Palette courante (objets rgb), recalculée chaque frame
  const P = {};
  function updatePalette(w) { for (const k in DUSK_RGB) P[k] = mixRgb(DUSK_RGB[k], ABLAZE_RGB[k], w); }
  updatePalette(0);

  /* =========================================================================
     2. CONSTANTES DE JEU
     ========================================================================= */
  const GROUND_Y = 560;          // surface du sol principal (monde)
  const GRAVITY = 2600;
  const MOVE_SPEED = 340;
  const SPRINT_MULT = 1.7;       // vitesse en sprint (Maj/Shift)
  const LIMB_RAISE = 8;          // remonte tête+corps+mains (pieds au sol) -> jambes plus longues
  const AVATAR_LIFT = 0;         // décalage vertical global de l'avatar (0 = hauteur réelle). Le vrai réglage du « coupe le sol » se fait par plateforme via COL_ADJUST.

  // ===== Réglage manuel de la HAUTEUR des collisions, par n° GLOBAL affiché par l'overlay =====
  // Clé = numéro affiché sur le trait rouge ; valeur = décalage en px monde.
  //   valeur NÉGATIVE = MONTE la plateforme (le perso se tient plus haut) ; POSITIVE = l'ABAISSE.
  // collisions.js reste généré/intact : on ajuste ici, pas là-bas.
  const COL_ADJUST = {
    // Carte 1 (n°0-16) — remontés 10 px ; 4/10/11 montés 3 px ; 6 abaissé de 6 px au total (-10 -> -4)
    0: -2, 1: -10, 2: -10, 3: -10, 4: -3, 5: -10, 6: -4, 7: -10, 8: -9,
    9: -10, 10: -3, 11: -5, 12: -10, 13: -10, 14: -10, 15: -10, 16: -10,
    // Carte 2 (n°17-28) — « 12 » interprété comme 21 ; 27 abaissé de 2 px (-8) ; 28 monté 3 px
    17: -10, 19: -10, 20: -10, 21: -10, 22: -10, 23: -10, 24: -10, 25: -10, 26: -10, 27: -8, 28: -3,
    // Carte 3 (n°29-40) — 31/36 montés 3 px ; 37 abaissé de 2 px (-8)
    29: -10, 30: -10, 31: -4, 32: -10, 33: -10, 34: -10, 35: -10, 36: -3, 37: -7, 39: -10, 40: -10,
    // Carte 4 (n°41-46) — 45/46 montés 2 px
    41: -10, 42: -10, 43: -10, 45: -2, 46: -2,
  };
  // ===== Rallonge l'extrémité HAUTE d'un trait (le long de sa pente), par n° GLOBAL =====
  // Clé = numéro du trait ; valeur = px d'allongement vers le HAUT (extrémité la plus haute prolongée).
  const COL_EXTEND = {
    3: 3,   // rallonge le haut de la pente n°3 de 3 px
  };
  // ===== Placement MANUEL des orbes-projets, par n° GLOBAL de trait =====
  // Clé = titre EXACT du projet (content.js) ; seg = n° du trait (voir assets/_col-num-level-N.png).
  //   side : 'above' (au-dessus du trait, défaut) | 'below' (en dessous)
  //   lift : hauteur de flottaison en px (optionnel ; défaut 100 au-dessus / 80 en dessous)
  //   dx   : décalage horizontal en px (optionnel)
  // Les projets ABSENTS d'ici (Valléescope) gardent leur placement AUTO.
  const ORB_PLACEMENT = {
    'Listopia':        { seg: 5,  side: 'below' },
    'Tooda':           { seg: 24, side: 'above' },   // (échange à 3) à la place d'Aedile
    'Blinee':          { seg: 10, side: 'above' },
    'PausePump':       { seg: 19, side: 'above' },
    'Aedile (Landing)':{ seg: 27, side: 'above' },   // (échange à 3) à la place de Bernard Soria
    'Bernard Soria':   { seg: 0,  side: 'above' },   // (échange à 3) à la place de Tooda (Lille)
    'Golden Triangle': { seg: 31, side: 'above' },
    'Lacme Prod':      { seg: 36, side: 'above' },
  };
  // ===== Décalage en pixels de l'orbe ENTIÈRE, par marque (auto OU manuelle) =====
  //   dx : + = droite, - = gauche ; dy : + = bas, - = haut
  const ORB_SHIFT = {
    'Listopia':         { dy: -10 },
    'PausePump':        { dx: 90 },
    'Valléescope':      { dx: -100, dy: -15 },
    'Aedile (Landing)': { dx: -130, dy: 54 },
    'Blinee':           { dx: -180 },
    'Golden Triangle':  { dx: 30, dy: -10 },
    'Lacme Prod':       { dx: 2, dy: -100 },
  };
  // ===== Décalage VERTICAL du logo DANS l'orbe, par marque (px ; négatif = REMONTE) =====
  // Ajuste le centrage optique du logo selon la forme de chaque marque. Clé = titre EXACT (content.js).
  //   x : px (négatif = gauche, positif = droite) ; y : px (négatif = remonte, positif = descend)
  const LOGO_NUDGE = {
    'Listopia':         { y: -3 },
    'Tooda':            { y: -1 },
    'Blinee':           { y: -2 },
    'PausePump':        { y: -2 },
    'Aedile (Landing)': { y: -2, x: 1 },
    'Valléescope':      { y: -2, x: 1 },
    'Bernard Soria':    { y: -2, x: 1 },
    'Lacme Prod':       { y: -2, x: 1 },
    'Golden Triangle':  { y: -2, x: 1 },
  };
  // Logos affichés SANS rognage circulaire (laissés entiers, pas de masque rond). Clé = titre EXACT.
  const LOGO_NO_ROUND = { 'Listopia': true };
  let __SHOW_COL = false;        // overlay des collisions numérotées (calage terminé) — repasse à true, ou #dev + window.__COL=1, pour le rouvrir
  const ACCEL = 2600, FRICTION = 2400;
  const JUMP_V = 920;
  const BOUNCE_V = 1180;
  const HOVER_GRAVITY = 0.42;    // gravité réduite quand on plane
  const HOVER_MAX_FALL = 240;
  const COYOTE = 0.10, JUMP_BUFFER = 0.12;
  const STAND_W = 40, STAND_H = 52, CROUCH_H = 32;
  const MAX_JUMPS = 2;           // saut simple + double saut
  const AIR_JUMP_V = 860;        // impulsion du 2e saut (en l'air)

  // Couleurs du personnage (Steven, stylisé jeu vidéo) — fixes, non lerpées
  const CHAR = {
    skin: '#F2C49A', skinSh: '#D89E72', skinHi: '#FBDAB6',
    hair: '#3B2A1C', hairHi: '#5C4226',
    // corps "sacoche" stylisé + écharpe rouge + emblème cible
    pouch: '#412C57', pouchSh: '#2B1C3D', pouchHi: '#5A3E76',
    scarf: '#C23A28', scarfSh: '#8B2A1D',
    emblemRing: '#DAD3E6', emblemDark: '#241733',
    // gants blancs + baskets orange/blanc
    glove: '#F5F2EB', gloveSh: '#D5CFC2',
    sneaker: '#E8912E', sneakerHi: '#F8B65A', sneakerWhite: '#F3EEE3', sneakerSole: '#BDB6A6',
    shoe: '#46372C', shoeSh: '#2E241C',
    brow: '#3B2A1C', eyeWhite: '#FBFBFF', iris: '#6E93A8', pupil: '#22303A',
    mouth: '#A85A48', teeth: '#FBF7F0', stubble: 'rgba(54,38,26,0.17)',
  };

  // Version d'asset = cache-busting des IMAGES chargées à l'exécution (maps, sprites, FX).
  // Le ?b= de index.html ne couvre QUE le CSS/JS ; sans suffixe, une image remplacée
  // dans assets/ resterait en cache chez un visiteur déjà venu (le HTML no-cache ne
  // protège pas les images). À BUMPER quand on remplace un PNG du décor, au même titre
  // que le ?b= des scripts. (Les logos/captures de projets, eux, gardent leur propre URL.)
  const ASSET_VER = 10;
  const av = (src) => src + (src.indexOf('?') >= 0 ? '&' : '?') + 'b=' + ASSET_VER;

  // Sprites découpés dans l'image générée (tête, corps, main, basket). S'ils
  // chargent, ils remplacent le dessin vectoriel ; sinon fallback procédural.
  function loadSprite(src) {
    const o = { img: new Image(), ready: false };
    o.img.onload = () => { o.ready = true; };
    o.img.onerror = () => { o.ready = false; };
    o.img.src = av(src);
    return o;
  }
  const SP = {
    handFist: loadSprite('assets/avatar/hand-fist.png'),    // poing fermé — repli par défaut quand une pose n'a pas de sprite
    handThumb: loadSprite('assets/avatar/hand-thumb.png'),  // pouce levé — célébration
    shoeTip: loadSprite('assets/avatar/shoe-tip.png'),
    shoe34: loadSprite('assets/avatar/shoe-34.png'),
    shoeSplay: loadSprite('assets/avatar/shoe-splay.png'),
    handInterior: loadSprite('assets/avatar/hand-interior.png'), // poing en peau « de face » (doigts visibles) -> main DEVANT le corps
    handExterior: loadSprite('assets/avatar/hand-exterior.png'), // poing en peau « de dos » (dos de la main) -> main DERRIÈRE le corps
    handJumpL: loadSprite('assets/avatar/hand-jump-left.png'),   // main de SAUT (regard gauche)
    handJumpR: loadSprite('assets/avatar/hand-jump-right.png'),  // main de SAUT (regard droite)
    handPlaneL: loadSprite('assets/avatar/hand-plane-left.png'), // main de PLANÉ/hover (regard gauche)
    handPlaneR: loadSprite('assets/avatar/hand-plane-right.png'),// main de PLANÉ/hover (regard droite)
    headLeft: loadSprite('assets/avatar/head-left.png'),  // tête de profil regardant à GAUCHE
    headRight: loadSprite('assets/avatar/head-right.png'),// tête de profil regardant à DROITE
    bodyLeft: loadSprite('assets/avatar/body-left.png'),   // corps 3/4 marchant à GAUCHE — détouré
    bodyRight: loadSprite('assets/avatar/body-right.png'), // corps 3/4 marchant à DROITE — détouré
    orbStd: loadSprite('assets/orbs/orbe.png'),                // orbe-projet peinte (cadre or + gemmes teal)
    orbSuper: loadSprite('assets/orbs/super-orbe.png'),        // « super orbe » = projets phares (énergie qui tourbillonne)
    orbFinal: loadSprite('assets/orbs/final-orbe.png'),        // orbe FINALE majestueuse (couronne + ailes, l'avenir) = grosse orbe « ? »
    nameplate: loadSprite('assets/ui/name-portfolio.png'),     // écriteau d'identité PEINT (identité + commandes, tout est dans l'image)
    arrowNext: loadSprite('assets/ui/arrow-next-level.png'),   // flèche peinte « par ici » -> invite à rejoindre la carte suivante (bord droit, cartes 1→3)
  };

  // === FX peints (sprites blancs/gris transparents, TEINTÉS en code) pour la mise en scène ===
  const FX = {
    smoke: [loadSprite('assets/fx/smoke-1.png'), loadSprite('assets/fx/smoke-2-cut.png'), loadSprite('assets/fx/smoke-3.png')],
    ring: loadSprite('assets/fx/ring.png'),
    flare: loadSprite('assets/fx/flare.png'),
    sparkle: loadSprite('assets/fx/sparkle.png'),
    twinkle: loadSprite('assets/fx/twinkle.png'),  // étoile à 4 branches (Kenney star_04) -> LE glint universel du jeu
  };
  // Teintes FIXES de l'étoile (blanc chaud -> or doux). Volontairement indépendantes de la
  // palette LIVE : le cache de getTinted reste borné à 3 toiles (aucun churn frame par frame).
  const STAR_TINTS = ['#FFF4D6', '#FFE7A8', '#FFDA82'];

  // === FX d'IMPULSION par sprite-sheet ===
  // Bandes horizontales de frames carrées (`fw`×`fh`). Jouées une fois : un poof de fumée
  // dessinée à la main (anime smoke, teintée crème chaud) quand on s'élance du sol ; un
  // nuage pixel plat qui s'étale à l'atterrissage. `foot` = ligne de sol dans la frame
  // (fraction depuis le haut) -> ancrage sous les pieds. Se fond dans le décor peint.
  const FXA = {
    jump: { sp: loadSprite('assets/fx/jump-smoke.png'), frames: 16, fw: 192, fh: 96,  foot: 0.58, dur: 0.46 },
    land: { sp: loadSprite('assets/fx/jump-smoke.png'), frames: 16, fw: 192, fh: 96,  foot: 0.58, dur: 0.46 },   // MÊME fumée qu'au saut (juste un poof plus large à l'impact)
    // volute laterale au DEMI-TOUR brusque (course/marche -> on inverse le sens) :
    // jaillit du sol cote elan et s'enroule. Orientation par defaut = part vers la
    // DROITE ; on `flip` quand l'elan allait vers la gauche.
    turn: { sp: loadSprite('assets/fx/turn-smoke.png'), frames: 35, fw: 160, fh: 160, foot: 0.95, dur: 0.5 },
  };
  // FLASH d'energie joue 2x au CENTRE de l'orbe finale, pendant le tremblement,
  // juste avant sa naissance (recolore chaud/dore, dessine en additif tres transparent
  // pour fusionner avec les god-rays). Sprite-sheet centre sur le foyer -> dessin centre.
  const FLASH19 = { sp: loadSprite('assets/fx/flash19.png'), frames: 28, fw: 200, fh: 200 };
  // VORTEX de particules (sprite-sheet en GRILLE cols x rows) qui s'amassent vers le centre
  // puis se rejoignent à la naissance de l'orbe finale. Remplace l'ancien vortex procédural.
  // Frames HAUTE RÉS (512 px = 1:1 avec la taille de dessin virtuelle) -> net ; WebP léger.
  const PARTICLES = { sp: loadSprite('assets/fx/particles.webp'), frames: 64, fw: 512, fh: 512, cols: 8 };
  // SHOCKWAVE (sprite-sheet 16:9 en GRILLE) : explosion d'énergie jouée UNE FOIS au BOOM,
  // quand l'orbe finale surgit. Recoloré chaud, dessiné en additif (fond noir -> disparaît).
  // Frames HAUTE RÉS (768 px) car dessiné très grand ; servi en WebP (léger).
  const SHOCKWAVE = { sp: loadSprite('assets/fx/shockwave.webp'), frames: 31, fw: 768, fh: 432, cols: 5 };
  const FXA_FW = 64, FXA_FH = 64;     // dimensions par défaut d'une frame (si `fw`/`fh` absents)
  const fxAnims = [];
  function playFx(def, x, y, size, flip) {
    if (!def) return;
    fxAnims.push({ def, x, y, size, t: 0, flip: flip ? -1 : 1 });
  }
  // un poof de ce type est-il encore en train de jouer ? (fxAnims ne contient que des anims actives)
  function fxPlaying(def) { for (const f of fxAnims) if (f.def === def) return true; return false; }
  // teinte un sprite blanc en couleur (multiply + masque alpha d'origine), mis en cache par couleur
  function getTinted(sp, color) {
    if (!sp || !sp.ready || !sp.img.naturalWidth) return null;
    sp._tint = sp._tint || {};
    if (sp._tint[color]) return sp._tint[color];
    const im = sp.img, c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
    sp._tint[color] = c; return c;
  }
  // variante FLOUTÉE d'un sprite teinté (mise en cache) : les rayons nets deviennent une lumière diffuse
  // qui FOND dans la peinture au lieu de ressembler à un sprite-étoile collé. blurFrac = flou / largeur sprite.
  function getSoft(sp, color, blurFrac) {
    const base = getTinted(sp, color); if (!base) return null;
    sp._soft = sp._soft || {};
    const key = color + '|' + blurFrac;
    if (sp._soft[key]) return sp._soft[key];
    const blur = Math.max(1, Math.round(base.width * blurFrac));
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const x = c.getContext('2d'); x.filter = 'blur(' + blur + 'px)'; x.drawImage(base, 0, 0);
    sp._soft[key] = c; return c;
  }
  // variante d'un sprite avec un filtre (saturate/brightness) PRÉ-CUIT dans un canvas
  // hors-écran et mis en cache. But perf : ne JAMAIS poser ctx.filter sur le canvas
  // principal pendant la boucle (le filtre canvas de Safari/WebKit est très lent et se
  // recalcule à chaque drawImage). Rendu identique, mais zéro filtre live par frame.
  function getFiltered(sp, filter) {
    if (!sp || !sp.ready || !sp.img.naturalWidth) return null;
    sp._filt = sp._filt || {};
    if (sp._filt[filter]) return sp._filt[filter];
    const im = sp.img, c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.filter = filter; x.drawImage(im, 0, 0);
    sp._filt[filter] = c; return c;
  }

  /* =========================================================================
     3. CONTENU (depuis content.js)
     ========================================================================= */
  const C = (window.CONTENT) || {
    identity: { firstName: 'Steven', lastName: 'Dieu', birthDate: '1992-10-26', role: 'Tech Lead Java / Angular', city: 'Nantes', tagline: '' },
    projects: [], contact: { headline: 'Merci !', subtitle: '', links: [] },
  };
  function computeAge(iso) {
    if (!iso) return null;
    const b = new Date(iso + 'T00:00:00');
    if (Number.isNaN(b.getTime())) return null;     // date mal saisie -> pas d'âge
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age >= 0 ? age : null;
  }
  const AGE = computeAge(C.identity.birthDate);
  const AGE_STR = AGE != null ? `${AGE} ans · ` : '';   // fragment vide si âge invalide

  // Respect de la préférence système "réduire les animations"
  const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = rmq.matches;
  try { rmq.addEventListener('change', (e) => { reduceMotion = e.matches; }); } catch (e) { /* anciens navigateurs */ }

  /* =========================================================================
     4. CANVAS / VUE
     ========================================================================= */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // RÉSOLUTION VIRTUELLE FIXE (16:9) : tout le jeu est pensé dans ce repère, puis
  // étiré pour COUVRIR la fenêtre (style background-size:cover) -> l'image de
  // niveau remplit toujours l'écran, sans bande, quelle que soit la résolution.
  const VW = 1280, VH = 720;  // repère virtuel 16:9 — champ de vision (perso ~7% = dézoomé)
  let viewW = VW, viewH = VH, dpr = 1;
  let viewScale = 1, viewOffX = 0, viewOffY = 0, winW = VW, winH = VH;
  // Qualité adaptative : le canvas est rendu à (dpr écran × renderScale). Si le jeu rame
  // durablement (GPU modeste : portable, écran 4K…), la boucle baisse renderScale -> moins
  // de pixels à peindre chaque frame, le navigateur ré-étire l'image plein cadre (à peine
  // plus doux à l'œil, mais fluide). 1 = pleine résolution. Voir adaptQuality() / la BOUCLE.
  let renderScale = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2) * renderScale;
    winW = window.innerWidth; winH = window.innerHeight;
    canvas.width = Math.round(winW * dpr);
    canvas.height = Math.round(winH * dpr);
    canvas.style.width = winW + 'px';
    canvas.style.height = winH + 'px';
    // COUVERTURE (style background-size:cover) : on remplit TOUJOURS toute la
    // fenêtre, sans jamais de bande, en rognant un peu la dimension en trop.
    //  - paysage / large  -> pleine largeur, l'image est rognée un peu en haut/bas
    //  - portrait          -> pleine hauteur (image entière), vue plus étroite
    // viewW <= VW et viewH <= VH par construction (la carte couvre toujours l'écran).
    viewScale = Math.max(winW / VW, winH / VH);
    viewW = winW / viewScale;
    viewH = winH / viewScale;
    viewOffX = 0;
    viewOffY = 0;
  }
  window.addEventListener('resize', resize);

  /* =========================================================================
     4b. ASSETS PEINTS (images générées) — décor stylisé
     ========================================================================= */
  // Tout le décor est PEINT dans les 3 images de niveau (plus d'assets séparés).
  const ASSET_SRC = {};
  // sections de niveau peintes (image = carte), collées bout à bout
  const LEVEL_COUNT = 4;                      // Lille, Paris, Nantes + Désert (« le prochain projet »)
  for (let i = 1; i <= LEVEL_COUNT; i++) ASSET_SRC['level' + i] = 'assets/maps/level-' + i + '.webp';
  const IMG = {};
  for (const k in ASSET_SRC) { const im = new Image(); im.src = av(ASSET_SRC[k]); IMG[k] = im; }
  const imgReady = (im) => im && im.complete && im.naturalWidth > 0;

  /* --- Géométrie « image = carte » (images 1916×821, ~21:9) --- */
  const IMG_W = 1916, IMG_H = 821;
  const LV_ASPECT = IMG_W / IMG_H;            // ≈ 2.334
  const SECTION_H = 720;                       // = VH : toute l'image tient en hauteur (sol → ciel)
  const SECTION_W = Math.round(SECTION_H * LV_ASPECT);  // ≈ 1680 : carte plus large que l'écran
  const GROUND_LINE = GROUND_Y / SECTION_H;    // cale le haut de l'image à y≈0 monde
  const levelTopY = () => GROUND_Y - GROUND_LINE * SECTION_H;   // ≈ 0
  const LEVEL_W = LEVEL_COUNT * SECTION_W;
  const SAFE_BOTTOM = SECTION_H + 130;         // chute sous l'image -> réapparition

  /* =========================================================================
     5. CONSTRUCTION DU NIVEAU
     ========================================================================= */
  const rnd = mulberry32(20261026);

  // Carton d'intro par carte (ville) — affiché à l'entrée de chaque carte
  const MAP_CARDS = [
    { name: 'Lille', sub: 'Là où tout commence' },
    { name: 'Paris', sub: 'Sur les toits' },
    { name: 'Nantes', sub: 'Le Voyage, la maison' },
    { name: 'À suivre…', sub: 'Et si le prochain projet était le vôtre ?' },
  ];
  // contenu du popup spécial de l'orbe « ? » (dernière carte)
  const CTA_PROJECT = {
    icon: '❓', tag: 'À vous de jouer',
    title: 'Et si le prochain projet était le vôtre ?',
    description: 'Une idée, un poste, une envie de bâtir quelque chose ensemble ? '
      + 'Ce désert attend son histoire. La prochaine, c\'est peut-être la nôtre. Écrivez-moi, on en parle.',
    stack: [], link: 'mailto:sdieu@stediconsulting.fr', linkLabel: 'Me contacter',
  };
  const WORLD_RIGHT = LEVEL_W;
  const RIVER_X0 = 0, RIVER_X1 = -1, elephantX = -99999;   // dummies (ancien décor procédural non utilisé)

  const solids = [];     // plateformes sens-unique : {x0,y0,x1,y1,type:'oneway'}
  const orbs = [];       // projets : {x,y,r,project,collected,...}
  const props = [];      // (inutilisé)
  const MAP_SPAWN = [];        // apparition par carte (arrivée par la gauche) : {x,y}
  const MAP_SPAWN_RIGHT = [];  // ré-apparition par carte quand on REVIENT depuis la droite : {x,y}

  // y de surface d'un segment sens-unique à l'abscisse monde cx (null si hors du segment)
  function segSurfaceY(s, cx) {
    if (cx < s.x0 - 1 || cx > s.x1 + 1) return null;
    const span = s.x1 - s.x0;
    const t = span > 1 ? clamp((cx - s.x0) / span, 0, 1) : 0;
    return s.y0 + (s.y1 - s.y0) * t;
  }
  // surface de la plateforme la plus HAUTE strictement sous le sol courant (à l'abscisse cx).
  // null s'il n'y a rien dessous -> on ne peut alors PAS descendre.
  function platformBelow(cx, surfaceY) {
    let bestY = null;
    for (const s of solids) {
      if (s.type !== 'oneway') continue;
      const sy = segSurfaceY(s, cx);
      if (sy == null) continue;
      if (sy > surfaceY + 6 && (bestY === null || sy < bestY)) bestY = sy;
    }
    return bestY;
  }
  // surface AU NIVEAU des pieds OU en dessous (la plateforme sur laquelle l'ombre
  // se pose / sur laquelle on retomberait). null s'il n'y a rien -> pas d'ombre.
  function surfaceUnder(cx, feetY) {
    let bestY = null;
    for (const s of solids) {
      if (s.type !== 'oneway') continue;
      const sy = segSurfaceY(s, cx);
      if (sy == null) continue;
      if (sy >= feetY - 6 && (bestY === null || sy < bestY)) bestY = sy;
    }
    return bestY;
  }
  // carton d'intro de la carte m (nom de ville) — reste affiché ~5 s
  function showCard(m) {
    const c = MAP_CARDS[m] || MAP_CARDS[0];
    state.cardName = c.name; state.cardSub = c.sub; state.cardT = 5;
    revealChapter(c.name, c.sub);
  }
  // Titre de carte affiché dans le HUD, à DROITE du chrono (plus de carton centré).
  // Reste affiché en permanence (pas de masquage auto) ; il se met simplement à jour
  // à l'entrée de chaque carte. La transition CSS n'est qu'un fondu d'apparition.
  function revealChapter(name, sub) {
    const el = document.getElementById('chapter');
    if (!el) return;
    document.getElementById('chapterName').textContent = name || '';
    document.getElementById('chapterSub').textContent = sub || '';
    el.classList.add('is-show');
  }
  function buildLevel() {
    solids.length = 0; orbs.length = 0; props.length = 0; MAP_SPAWN.length = 0; MAP_SPAWN_RIGHT.length = 0;
    const COL = window.LEVEL_COLLISIONS || {};
    const top = levelTopY();
    let gidx = 0;                                   // numéro GLOBAL du trait (= clé COL_ADJUST + n° de l'overlay)
    for (let m = 0; m < LEVEL_COUNT; m++) {
      const segs = COL[m + 1] || [];
      const sx = m * SECTION_W;
      const baseIdx = gidx;
      const dyOf = (gi) => (COL_ADJUST[baseIdx + gi] || 0);   // décalage manuel (px monde) du trait baseIdx+gi
      // collisions : chaque ligne bleue -> plateforme sens-unique (monde) ; + ajustement manuel COL_ADJUST
      for (let gi = 0; gi < segs.length; gi++) {
        const g = segs[gi], dy = dyOf(gi);
        const sol = {
          x0: sx + g.x0 * SECTION_W, y0: top + g.y0 * SECTION_H + dy,
          x1: sx + g.x1 * SECTION_W, y1: top + g.y1 * SECTION_H + dy, type: 'oneway',
          idx: baseIdx + gi, m, gi,
        };
        // RALLONGE l'extrémité HAUTE de `ext` px vers le haut, le long de la pente (garde l'angle)
        const ext = COL_EXTEND[baseIdx + gi] || 0;
        if (ext) {
          const dyFull = sol.y1 - sol.y0;
          if (Math.abs(dyFull) < 0.001) { sol.y0 -= ext; sol.y1 -= ext; }   // horizontal : on remonte tout le trait
          else if (sol.y0 < sol.y1) { const k = ext / Math.abs(dyFull); sol.x0 += k * (sol.x0 - sol.x1); sol.y0 -= ext; }  // extrémité gauche = haute
          else { const k = ext / Math.abs(dyFull); sol.x1 += k * (sol.x1 - sol.x0); sol.y1 -= ext; }                        // extrémité droite = haute
        }
        solids.push(sol);
        gidx++;
      }
      // apparition = plateforme la plus BASSE dans les 20 % gauche de la carte
      let bestI = -1;
      for (let gi = 0; gi < segs.length; gi++) { if (segs[gi].x0 <= 0.20 && (bestI < 0 || segs[gi].y0 > segs[bestI].y0)) bestI = gi; }
      if (bestI < 0 && segs.length) bestI = 0;
      MAP_SPAWN.push(bestI >= 0
        ? { x: sx + (segs[bestI].x0 + 0.04) * SECTION_W, y: top + segs[bestI].y0 * SECTION_H + dyOf(bestI) - STAND_H }
        : { x: sx + 90, y: GROUND_Y - STAND_H });
      // ré-apparition (retour depuis la droite) = plateforme la plus BASSE touchant les 20 % droite
      let bestRI = -1;
      for (let gi = 0; gi < segs.length; gi++) { if (segs[gi].x1 >= 0.80 && (bestRI < 0 || segs[gi].y1 > segs[bestRI].y1)) bestRI = gi; }
      if (bestRI < 0 && segs.length) bestRI = segs.length - 1;
      if (bestRI >= 0) {
        const bestR = segs[bestRI];
        const fx = Math.min(bestR.x1 - 0.04, 0.92);   // près du bord droit, mais avant le seuil de la carte suivante
        const span = bestR.x1 - bestR.x0;
        const t = span > 0.001 ? clamp((fx - bestR.x0) / span, 0, 1) : 0;
        const fy = bestR.y0 + (bestR.y1 - bestR.y0) * t;
        MAP_SPAWN_RIGHT.push({ x: sx + fx * SECTION_W, y: top + fy * SECTION_H + dyOf(bestRI) - STAND_H });
      } else {
        MAP_SPAWN_RIGHT.push({ x: sx + SECTION_W - 120, y: GROUND_Y - STAND_H });
      }
    }
    placeOrbs();
  }

  // place les orbes-projets au-dessus de plateformes atteignables
  //   - projets GOLD (premium)        -> carte 0 (Lille), bien en vue
  //   - projet GOLD marqué `first`    -> au sol juste après le départ (attrapé en marchant)
  //   - autres projets                -> réparties sur les cartes suivantes (Paris, Nantes…)
  function placeOrbs() {
    const all = (C.projects && C.projects.length) ? C.projects.slice()
      : [{ title: 'Projet', tag: '', year: '', description: '', stack: [], icon: '✦', link: '' }];
    const COL = window.LEVEL_COLLISIONS || {};
    const top = levelTopY();
    const DESERT = LEVEL_COUNT - 1;                        // dernière carte (désert) = pas d'orbe-projet

    // plateformes candidates d'une carte : assez larges, hors « grand sol », triées de gauche à droite
    const cityCands = (m) => {
      const sx = m * SECTION_W, list = [];
      (COL[m + 1] || []).forEach((g) => {
        const span = g.x1 - g.x0;
        if (span < 0.10 || span > 0.70) return;            // ni trop courte, ni le sol pleine largeur
        list.push({ x: sx + (g.x0 + g.x1) / 2 * SECTION_W, surfaceY: top + (g.y0 + g.y1) / 2 * SECTION_H });
      });
      list.sort((a, b) => a.x - b.x);
      return list;
    };
    // y de surface du SOL principal (segment pleine largeur) d'une carte, à l'abscisse monde x
    const groundSurfaceAt = (m, x) => {
      const sx = m * SECTION_W; let best = null;
      (COL[m + 1] || []).forEach((g) => {
        if ((g.x1 - g.x0) < 0.60) return;                  // garde les segments « sol »
        const sy = segSurfaceY({ x0: sx + g.x0 * SECTION_W, y0: top + g.y0 * SECTION_H,
                                 x1: sx + g.x1 * SECTION_W, y1: top + g.y1 * SECTION_H }, x);
        if (sy != null && (best == null || sy > best)) best = sy;
      });
      return best != null ? best : GROUND_Y;
    };
    // fabrique une orbe-projet (lift = hauteur de flottaison au-dessus de la surface)
    let idx = 0;
    const makeOrb = (proj, x, surfaceY, lift) => {
      const premium = !!proj.premium;
      const oy = surfaceY - lift;
      orbs.push({
        x, y: oy, r: premium ? 40 : 36, baseY: oy, premium, project: proj, collected: false,   // petites orbes +30% (28->36)
        bob: rnd() * TAU, pulse: rnd() * TAU, spin: rnd() * TAU, idx: idx++,
        logo: (proj.orbLogo || proj.logo) ? loadSprite(proj.orbLogo || proj.logo) : null,   // orbLogo = emblème dédié à l'orbe (sinon logo standard)
      });
    };

    const first  = all.find((p) => p.premium && p.first);
    const gold   = all.filter((p) => p.premium && p !== first);
    const others = all.filter((p) => !p.premium);

    // 1) projet `first` (Listopia) : au sol, juste à droite du spawn -> attrapé en marchant
    const sp0 = MAP_SPAWN[0] || { x: 90 };
    const firstX = sp0.x + 240;
    if (first) makeOrb(first, firstX, groundSurfaceAt(0, firstX), 66);

    // 2) autres GOLD : répartis sur les plateformes de la carte 0, après Listopia
    const cands0 = cityCands(0).filter((c) => c.x > firstX + 160);
    gold.forEach((p, j) => {
      const c = cands0.length
        ? cands0[Math.min(cands0.length - 1, Math.floor((j + 0.5) / Math.max(1, gold.length) * cands0.length))]
        : { x: firstX + 320 + j * 280, surfaceY: groundSurfaceAt(0, firstX + 320 + j * 280) };
      makeOrb(p, c.x, c.surfaceY, 150);                    // gold = en hauteur (double saut)
    });

    // 3) autres projets : répartis sur les cartes suivantes (Paris, Nantes…)
    const cityMaps = [];
    for (let m = 1; m < DESERT; m++) cityMaps.push(m);
    const byMap = {};
    others.forEach((p, k) => {
      const m = cityMaps.length ? cityMaps[k % cityMaps.length] : 0;
      (byMap[m] = byMap[m] || []).push(p);
    });
    Object.keys(byMap).forEach((mStr) => {
      const m = +mStr, list = byMap[m], cands = cityCands(m);
      list.forEach((p, j) => {
        const c = cands.length
          ? cands[Math.min(cands.length - 1, Math.floor((j + 0.5) / list.length * cands.length))]
          : { x: m * SECTION_W + SECTION_W / 2, surfaceY: GROUND_Y };
        makeOrb(p, c.x, c.surfaceY, 84);
      });
    });

    // --- override : repositionne les orbes listées dans ORB_PLACEMENT sur leur trait ---
    for (const o of orbs) {
      const place = o.project && ORB_PLACEMENT[o.project.title];
      if (!place) continue;
      const seg = solids.find((s) => s.idx === place.seg && s.type === 'oneway');
      if (!seg) continue;
      const mx = (seg.x0 + seg.x1) / 2, my = (seg.y0 + seg.y1) / 2;
      const below = place.side === 'below';
      const lift = place.lift != null ? place.lift : (below ? 80 : 100);
      // clamp haut : l'orbe ne dépasse jamais le bord supérieur de la carte (sinon rognée)
      const oy = Math.max(below ? my + lift : my - lift, top + o.r + 14);
      o.x = mx + (place.dx || 0); o.y = oy; o.baseY = oy;
    }

    // --- grosse orbe « ? » au centre du désert (call-to-action) ---
    const dsx = DESERT * SECTION_W;
    let ground = null;
    (COL[DESERT + 1] || []).forEach((g) => { if (!ground || (g.x1 - g.x0) > (ground.x1 - ground.x0)) ground = g; });
    const cx = ground ? dsx + (ground.x0 + ground.x1) / 2 * SECTION_W : dsx + SECTION_W / 2;
    const surf = ground ? top + (ground.y0 + ground.y1) / 2 * SECTION_H : GROUND_Y;
    const oy = surf - 330;                                 // flotte haut (descendue de 30 px)
    orbs.push({
      x: cx, y: oy, r: 216, baseY: oy, premium: true, cta: true, project: CTA_PROJECT, collected: false,
      bob: rnd() * TAU, pulse: rnd() * TAU, spin: rnd() * TAU, idx: idx,
    });

    // --- décalage pixel de l'orbe ENTIÈRE par marque (s'applique aussi aux orbes AUTO) ---
    for (const o of orbs) {
      const sh = o.project && ORB_SHIFT[o.project.title];
      if (!sh) continue;
      o.x += sh.dx || 0; o.y += sh.dy || 0; o.baseY += sh.dy || 0;
    }
  }

  /* =========================================================================
     6. AVATAR — l'esprit-lumière "Luciole"
     ========================================================================= */
  const A = {
    x: 180, y: GROUND_Y - STAND_H, w: STAND_W, h: STAND_H,
    vx: 0, vy: 0, facing: 1, onGround: true,
    scaleX: 1, scaleY: 1, svx: 0, svy: 0,   // ressort squash
    breath: 0, blink: 0, blinkT: 2 + rnd() * 3,
    hand: [{ x: 0, y: 0, w: 0 }, { x: 0, y: 0, w: 0 }], foot: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    eye: { x: 0, y: 0 }, hair: 0, coyote: 0, buffer: 0, crouch: false, crouchT: 0,
    idle: 0, hover: false, jumpsLeft: MAX_JUMPS, flip: 0, lean: 0, sprint: false,
    cheer: 0, landT: 0,
    dropReq: false, dropThru: 0, dropY: 0,   // descente volontaire à travers une plateforme
    turnCd: 0,                               // anti-rafale de la volute de demi-tour
  };
  function resetAvatar() {
    const sp = MAP_SPAWN[0] || { x: 180, y: GROUND_Y - STAND_H };
    A.x = sp.x; A.y = sp.y; A.vx = 0; A.vy = 0; A.facing = 1; A.onGround = true;
    A.scaleX = A.scaleY = 1; A.svx = A.svy = 0; A.crouch = false; A.crouchT = 0; A.idle = 0;
    A.jumpsLeft = MAX_JUMPS; A.flip = 0; A.lean = 0; A.sprint = false;
    A.cheer = 0; A.landT = 0;
    A.dropReq = false; A.dropThru = 0; A.dropY = 0;
    A.lastSafeX = A.x; A.lastSafeY = A.y;
    // place les membres EXACTEMENT à leur pose de repos du jeu (profil droit) -> pas de « repositionnement »
    // au lancement / pendant le cercle du prélude (où on ne peut pas encore bouger).
    const cx = A.x + A.w / 2, cy = A.y + A.h / 2, HANDY = cy - 5;
    A.hand[0].x = cx - A.w * 0.14;  A.hand[0].y = HANDY; A.hand[0].w = 0;   // de dos, ramenée au corps
    A.hand[1].x = cx + A.w * 0.80; A.hand[1].y = HANDY; A.hand[1].w = 0;   // de face, écartée
    A.foot[0].x = cx - A.w * 0.34; A.foot[0].y = A.y + A.h - 1;
    A.foot[1].x = cx + A.w * 0.34; A.foot[1].y = A.y + A.h - 1;
  }
  A.lastSafeX = A.x; A.lastSafeY = A.y;

  /* =========================================================================
     7. ÉTAT GLOBAL & PARTICULES
     ========================================================================= */
  /* --- SCORE & CHRONO --------------------------------------------------------
     Barème SCALABLE (indépendant du nombre de projets) :

         score = (projets attrapés / total projets) × COMPLETION_POINTS − temps_ms

     - La complétion est une FRACTION : attraper 100 % des projets vaut toujours
       COMPLETION_POINTS, qu'il y en ait 2 ou 20. Ajouter un projet ne change donc
       pas l'échelle : à temps égal et complétion pleine, le score est identique.
     - La pénalité de temps est de 1 point par MILLISECONDE (TIME_PENALTY_PER_MS) :
       résolution maximale, deux runs séparés d'1 ms diffèrent d'1 point -> quasi
       aucun ex aequo.
     Le chrono n'avance QUE quand on joue vraiment (ni avant le départ, ni en
     pause/modal, ni pendant les transitions de carte). Ces constantes DOIVENT
     rester synchronisées avec api/index.js : le serveur recalcule le score à
     partir de (projets, total, temps) pour alimenter le classement mondial. */
  const COMPLETION_POINTS = 1000000;    // 100 % des projets attrapés (peu importe leur nombre)
  const TIME_PENALTY_PER_MS = 1;        // points perdus par milliseconde de jeu actif

  const state = {
    started: false, paused: false, ended: false,
    warmth: 0, warmthTarget: 0, collected: 0,
    zone: 0, cardAlpha: 0, cardName: '', cardSub: '', cardT: 0,
    freeze: 0, pendingOrb: null, shake: 0, time: 0, muted: false, volume: 0.8,
    musicMuted: false, musicVolume: 0.6,   // canal "musique" indépendant des bruitages
    map: 0, trans: null,   // carte courante (0..5) + transition "page loader" {phase,t}
    locked: false,   // verrou d'entrée pendant le balayage circulaire d'ouverture
    playMs: 0, score: 0, scoreSubmitted: false,   // chrono de jeu actif + score courant
    boss: null, bossPending: false, bossDone: false,   // mise en scène "boss" (apparition de l'orbe finale)
    speech: null,   // bulle de réplique « attrape l'orbe ! » qui s'écrit lettre par lettre après l'apparition
  };
  const TRANS_T = 0.42;    // durée d'un fondu (sortie / entrée) de transition de carte
  const particles = [];
  function spawn(x, y, vx, vy, life, size, color, blend, grav, opts) {
    const o = opts || 0;
    particles.push({ x, y, vx, vy, life, max: life, size, color, blend: blend || 'lighter', grav: grav == null ? 1 : grav,
      drag: o.drag || 0, turb: o.turb || 0, seed: o.seed || 0,
      tex: o.tex || null, rot: o.rot || 0, spin: o.spin || 0, texA: o.texA == null ? 1 : o.texA, tint: o.tint || '#d8c096',
      grow: o.grow == null ? 0.6 : o.grow, soft: o.soft || false });
  }
  function burst(x, y, n, color, spd) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, s = spd * (0.3 + rnd());
      spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, 0.6 + rnd() * 0.5, 2 + rnd() * 3, color, 'lighter', 0.4);
    }
  }
  // Nuage de POUSSIÈRE réaliste : de vrais billows de FUMÉE peinte (sprites teintés sable chaud), qui
  // gonflent, tournent lentement, décélèrent (traînée) et tourbillonnent (turbulence). Le détail vient de la texture.
  function dust(x, y, n, spd, up, grav, gold) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, s = spd * (0.12 + rnd() * rnd() * 1.15);   // biais lent -> nuage groupé, quelques-uns vont loin
      const size = 30 + rnd() * rnd() * 120;            // gros billow (le grain fin vient du sprite)
      const tex = FX.smoke[(rnd() * FX.smoke.length) | 0];
      const t = rnd();
      const tint = gold
        ? (t < 0.34 ? '#fff1cc' : t < 0.66 ? '#ffd98e' : '#f0b860')   // brume DORÉE lumineuse (apparition magique dans le ciel)
        : (t < 0.32 ? '#e2c388' : t < 0.64 ? '#b39769' : '#7e6a48');  // sable chaud (poussière du sol au tremblement)
      spawn(x + (rnd() - 0.5) * 64, y + (rnd() - 0.5) * 44,
            Math.cos(a) * s, Math.sin(a) * s - (up || 0),
            1.1 + rnd() * 1.6, size, null, 'source-over', grav == null ? 0.35 : grav,
            { drag: 1.4 + rnd() * 1.4, turb: 12 + rnd() * 20, seed: rnd() * TAU,
              tex: tex, rot: rnd() * TAU, spin: (rnd() - 0.5) * 1.2, texA: 0.10 + rnd() * 0.14 });   // fumée bien plus transparente (ne fait plus de nuages durs)
    }
  }
  // Braises dorées : petites étincelles additives qui jaillissent, retombent en arc et s'éteignent.
  function embers(x, y, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, s = spd * (0.3 + rnd());
      spawn(x + (rnd() - 0.5) * 24, y + (rnd() - 0.5) * 24,
            Math.cos(a) * s, Math.sin(a) * s - (30 + rnd() * 80),
            0.55 + rnd() * 0.8, 0.7 + rnd() * 1.7,
            rnd() < 0.5 ? 'rgba(255,221,150,0.5)' : 'rgba(240,184,96,0.45)',   // ambre chaud peu opaque (fondu, pas d'étincelle blanche)
            'lighter', 1.1, { drag: 0.7 + rnd() * 0.9, seed: rnd() * TAU });
    }
  }

  // Motes ambiantes (recyclées autour de la caméra)
  const motes = [];
  for (let i = 0; i < 70; i++) motes.push({ x: rnd(), y: rnd(), z: 0.3 + rnd() * 0.7, ph: rnd() * TAU, sp: 0.2 + rnd() * 0.5 });

  // Étoiles (ciel) — positions fixes en fraction d'écran, scintillent
  const stars = [];
  for (let i = 0; i < 70; i++) stars.push({ x: rnd(), y: rnd() * 0.6, r: 0.6 + rnd() * 1.4, ph: rnd() * TAU, sp: 0.6 + rnd() * 1.6 });

  /* =========================================================================
     8. CAMÉRA
     ========================================================================= */
  const cam = { x: 0, y: 0 };
  const GROUND_SCREEN = GROUND_LINE;   // cam.y = haut de l'image (toute l'image à l'écran)
  // Position verticale de REPOS : le sol est calé en bas de l'écran. C'est la
  // borne BASSE du pan vertical -> la caméra ne descend jamais en dessous (le
  // sol/avant-plan reste toujours visible). Le suivi vertical au saut (voir
  // updateCamera) ne fait que remonter à partir de cette valeur.
  function camRestY() {
    // Le BAS de l'image reste collé au bas de l'écran : quand la fenêtre est plus
    // large que le repère 16:9 (viewH < hauteur d'image), on ne rogne QUE le HAUT
    // (le ciel), jamais le sol/avant-plan. En portrait ou 16:9 exact, viewH ==
    // SECTION_H -> cam.y = 0 (image entière, aucun rognage).
    return Math.max(GROUND_Y - viewH * GROUND_SCREEN, levelTopY() + SECTION_H - viewH);
  }
  function updateCamera(dt) {
    // bornée à la CARTE courante : collée à gauche au début, suit au milieu, collée à droite à la fin
    const mapLeft = state.map * SECTION_W;
    const mapRight = mapLeft + SECTION_W;
    const targetX = clamp(A.x + A.w / 2 - viewW * 0.46, mapLeft, mapRight - viewW);
    cam.x += (targetX - cam.x) * Math.min(1, dt * 6);

    // --- Vertical : suivi du saut (caméra à "zone morte", façon plateforme) ---
    // Au repos le sol est calé en bas (camRestY) : c'est la borne BASSE. Quand
    // l'avatar grimpe au-delà d'une petite zone morte, la caméra remonte d'autant
    // (1:1, comme s'il poussait le haut d'une boîte de cadrage) et révèle le décor
    // du haut, SANS jamais dépasser le bord supérieur de l'image (levelTopY).
    // Sur un écran exactement 16:9 / portrait, restY == levelTopY -> aucun pan
    // possible (toute l'image est déjà visible), donc effet uniquement quand il
    // reste du décor caché en haut (écrans plus larges que 16:9).
    const restY = camRestY();
    const DEAD = 56;                              // zone morte : les petits sauts ne bougent pas la caméra
    const climb = Math.max(0, (GROUND_Y - STAND_H) - A.y);   // hauteur de la tête au-dessus de la station debout
    const reveal = Math.max(0, climb - DEAD);
    const targetY = clamp(restY - reveal, levelTopY(), restY);
    // lissage asymétrique : remonte vite avec le saut, redescend en douceur à l'atterrissage
    const k = targetY < cam.y ? 9 : 4;
    cam.y += (targetY - cam.y) * Math.min(1, dt * k);
  }

  /* =========================================================================
     9. ENTRÉES (clavier + tactile)
     ========================================================================= */
  const keys = { left: false, right: false, up: false, down: false, sprint: false };
  let jumpHeld = false;
  let hoverEmit = 0;     // accumulateur d'émission de la traînée de plané (cadence indépendante du framerate)
  function press(k) {
    if (state.locked) return;   // entrées gelées pendant l'ouverture en iris
    if (k === 'left') keys.left = true;
    else if (k === 'right') keys.right = true;
    else if (k === 'down') { keys.down = true; A.dropReq = true; }
    else if (k === 'jump') { keys.up = true; jumpHeld = true; A.buffer = JUMP_BUFFER; }
  }
  function release(k) {
    if (k === 'left') keys.left = false;
    else if (k === 'right') keys.right = false;
    else if (k === 'down') keys.down = false;
    else if (k === 'jump') {
      keys.up = false; jumpHeld = false;
      if (A.vy < -260) A.vy = -260;  // saut variable : relâcher coupe l'élan
    }
  }
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  };
  // Quand on saisit du texte (champ pseudo, recherche du classement…), le canvas
  // ne doit PAS s'approprier les touches : sur AZERTY, Z/Q/S/D correspondent aux
  // positions physiques KeyW/KeyA/KeyS/KeyD du déplacement, donc taper son nom
  // déclenchait le perso et `preventDefault` bloquait la frappe dans l'input.
  function isTextEntry(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image'].includes(t);
    }
    return el.isContentEditable === true;
  }
  window.addEventListener('keydown', (e) => {
    if (isTextEntry(e.target)) return;   // laisser la frappe filer dans le champ
    resumeAudio();
    // Agrandissement ouvert : les touches pilotent la lightbox, pas la carte derrière
    if (typeof lboxOpen === 'function' && lboxOpen()) {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); closeLightbox(); return; }
      if (carShots.length > 1 && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { e.preventDefault(); lightGo(e.code === 'ArrowRight' ? 1 : -1); return; }
      return;   // tant que l'agrandissement est ouvert, le reste du clavier est ignoré
    }
    // Raccourci « try-hard » : P relance la run de zéro, mais UNIQUEMENT quand on joue
    // vraiment (perso libre, en train de bouger). Pas pendant une pause/modal/projets,
    // l'écran de fin, le verrou (balayage / intro boss), une transition de carte, ni la
    // saisie d'un pseudo (déjà filtrée tout en haut par isTextEntry).
    if (e.code === 'KeyP') {
      if (state.started && !state.paused && !state.ended && !state.locked && !state.trans) {
        e.preventDefault();
        resetRun();
      }
      return;
    }
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (state.paused) { e.preventDefault(); closeModal(); }
      else if (!state.started && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
        e.preventDefault();
        // Entrée : depuis l'accueil -> on enchaîne sur le prélude ; depuis le prélude -> on lance
        if (coverOv && !coverOv.hidden) coverToPrelude(); else startGame();
      }
      return;
    }
    // piège à focus : Tab tourne en boucle dans la modal ouverte
    if (state.paused && e.code === 'Tab') {
      const f = Array.from(modalOv.querySelectorAll('.modal__close, #modalLink:not([hidden])'));
      if (f.length) {
        e.preventDefault();
        let idx = f.indexOf(document.activeElement);
        idx = (idx + (e.shiftKey ? -1 : 1) + f.length) % f.length;
        f[idx].focus();
      }
      return;
    }
    // carrousel : flèches gauche/droite quand la modal est ouverte (plusieurs captures)
    if (state.paused && carShots.length > 1 && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      e.preventDefault(); carGo(carIdx + (e.code === 'ArrowRight' ? 1 : -1)); return;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {   // sprint
      if (state.started && !state.paused && !state.locked) keys.sprint = true;
      return;
    }
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();                          // le canvas s'approprie ces touches
    if (state.paused || !state.started) return;  // pas d'input pendant pause / avant démarrage
    if (!e.repeat) press(k);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { keys.sprint = false; return; }
    const k = KEYMAP[e.code];
    if (k) release(k);
  });
  // Réinitialise les entrées si la fenêtre/onglet perd le focus (évite les touches "collées")
  function clearInput() {
    keys.left = keys.right = keys.up = keys.down = keys.sprint = false;
    jumpHeld = false; A.buffer = 0; A.hover = false; A.dropReq = false;
  }
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInput(); pauseMusicForTab(); }
    else resumeMusicForTab();
  });

  // Tactile
  function bindTouch() {
    document.querySelectorAll('.touch__btn').forEach((btn) => {
      const act = btn.dataset.act;
      const on = (e) => { e.preventDefault(); resumeAudio(); press(act); btn.classList.add('is-on'); };
      const off = (e) => { e.preventDefault(); release(act); btn.classList.remove('is-on'); };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false });
      btn.addEventListener('mousedown', on);
      btn.addEventListener('mouseup', off);
      btn.addEventListener('mouseleave', off);
    });
  }

  /* =========================================================================
     10. AUDIO (petits bips synthétisés, optionnels)
     ========================================================================= */
  let actx = null, masterGain = null;
  let boomBuffer = null, boomLoading = false;   // bruitage MP3 de naissance de l'orbe (décodé)
  // charge + décode assets/audio/boom-appear.mp3 dans un AudioBuffer (joué via le bus SFX)
  function loadBoomSound() {
    if (boomBuffer || boomLoading || !actx) return;
    boomLoading = true;
    fetch(av('assets/audio/boom-appear.mp3'))
      .then((r) => r.arrayBuffer())
      .then((buf) => actx.decodeAudioData(buf))
      .then((decoded) => { boomBuffer = decoded; })
      .catch(() => { boomLoading = false; });   // réessaiera au prochain resumeAudio
  }
  function resumeAudio() {
    if (state.muted) return;
    try {
      if (!actx) {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = actx.createGain();
        masterGain.gain.value = state.muted ? 0 : state.volume;
        masterGain.connect(actx.destination);
      }
      if (actx.state === 'suspended') actx.resume();
      loadBoomSound();                           // précharge le bruitage de naissance
    } catch (e) { /* pas d'audio, tant pis */ }
  }
  // applique le volume / mute au nœud maître (rampe douce)
  function applyVolume() {
    if (masterGain && actx) {
      try { masterGain.gain.setTargetAtTime(state.muted ? 0 : state.volume, actx.currentTime, 0.015); } catch (e) { /* ignore */ }
    }
  }
  function blip(freq, dur, type, vol) {
    if (state.muted || !actx || !masterGain) return;
    // onglet masqué OU contexte audio pas en lecture (suspendu / en cours de reprise) -> on DROPPE :
    // sinon le son s'empile sur un contexte suspendu et sort en rafale dès qu'il reprend.
    if (document.hidden || actx.state !== 'running') return;
    try {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, actx.currentTime);
      g.gain.linearRampToValueAtTime(vol || 0.08, actx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(masterGain);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  // Son de NAISSANCE de l'orbe finale : joue le bruitage fourni assets/audio/boom-appear.mp3
  // (décodé dans boomBuffer) via le bus SFX -> respecte le volume/mute des bruitages.
  function bossBirthSound() {
    if (state.muted || !actx || !masterGain) return;
    // masqué OU contexte pas en lecture -> on NE LANCE PAS (et pas de rattrapage au réveil) :
    // si le moment du boom est passé pendant l'absence, il est simplement ignoré.
    if (document.hidden || actx.state !== 'running') return;
    if (!boomBuffer) { loadBoomSound(); return; }   // pas encore décodé : on tente le chargement, pas de son cette fois
    try {
      const src = actx.createBufferSource(), g = actx.createGain();
      g.gain.value = 0.45;                           // MP3 mixé fort -> on l'atténue pour coller au volume des autres bruitages
      src.buffer = boomBuffer;
      src.connect(g); g.connect(masterGain);
      src.start();
    } catch (e) { /* ignore */ }
  }

  /* ----- MUSIQUE D'AMBIANCE (canal séparé des bruitages) -------------------
     Deux <audio> : l'intro joue une fois au lancement, puis on enchaîne
     automatiquement sur la boucle (jouée en continu, à l'infini).
     Le volume/mute est piloté par state.musicVolume / state.musicMuted,
     totalement indépendant du canal bruitages (state.volume / state.muted). */
  // NB : `$` (raccourci getElementById) n'est défini que plus bas dans le fichier ;
  // ici (section 10, tôt dans l'IIFE) on passe donc par document.getElementById directement.
  const bgIntro = document.getElementById('bgIntro'), bgLoop = document.getElementById('bgLoop');
  const bgBoss = document.getElementById('bgBoss');   // musique du dernier niveau ("boss")
  const bgEnd = document.getElementById('bgEnd');     // musique de fin (orbe finale cueillie -> remerciement/classement)
  // "The Last Stand" est masterisé plus fort que la boucle d'ambiance : on l'atténue
  // pour qu'il reste au même ressenti sonore que la musique habituelle (et ne domine pas).
  const BOSS_MUSIC_GAIN = 0.6;
  // La musique de fin est elle aussi masterisée fort : même atténuation pour la caler
  // sur le niveau de l'intro/boucle (ne pas « assassiner les oreilles » sur l'écran de fin).
  const END_MUSIC_GAIN = 0.55;
  let musicStarted = false, musicWired = false;
  const GESTURES = ['pointerdown', 'keydown', 'touchstart', 'click'];
  // Fondus musicaux pilotés par la boucle de jeu (frame-synced) : se mettent en pause
  // avec l'onglet et reprennent proprement (pas de volume figé à mi-chemin).
  const _fades = [];          // { el, to, rate (vol/s), keep }
  function fadingEl(el) { return _fades.some((f) => f.el === el); }
  function applyMusicVolume() {
    const v = state.musicMuted ? 0 : state.musicVolume;
    [bgIntro, bgLoop, bgBoss, bgEnd].forEach((el) => {
      if (!el || fadingEl(el)) return;          // un fondu en cours pilote déjà le volume
      const g = (el === bgBoss) ? BOSS_MUSIC_GAIN : (el === bgEnd) ? END_MUSIC_GAIN : 1;
      try { el.volume = v * g; } catch (e) { /* ignore */ }
    });
  }
  // Lance un fondu de volume d'un <audio> vers `to` en `dur` secondes (pas de coupure sèche).
  // opts.keep = piste active : on la (re)lance et on ne la met jamais en pause.
  // opts.restart = repart du début.
  function fadeAudio(el, to, dur, opts) {
    if (!el) return;
    opts = opts || {};
    for (let i = _fades.length - 1; i >= 0; i--) if (_fades[i].el === el) _fades.splice(i, 1);
    if (opts.keep || to > 0.001) {              // (re)démarre la lecture si besoin, fondu d'entrée depuis 0
      if (opts.restart) { try { el.currentTime = 0; } catch (e) { /* ignore */ } }
      if (el.paused) { try { el.volume = 0; } catch (e) { /* ignore */ } try { el.play().catch(() => {}); } catch (e) { /* ignore */ } }
    }
    const rate = Math.abs(to - el.volume) / Math.max(0.05, dur);
    _fades.push({ el, to: clamp(to, 0, 1), rate: rate || 2, keep: !!opts.keep });
  }
  // Avance les fondus en cours (appelé chaque frame depuis update()).
  function tickFades(dt) {
    for (let i = _fades.length - 1; i >= 0; i--) {
      const f = _fades[i];
      let v = f.el.volume;
      v = (v < f.to) ? Math.min(f.to, v + f.rate * dt) : Math.max(f.to, v - f.rate * dt);
      try { f.el.volume = clamp(v, 0, 1); } catch (e) { /* ignore */ }
      if (Math.abs(v - f.to) < 0.001) {
        try { f.el.volume = f.to; } catch (e) { /* ignore */ }
        if (!f.keep && f.to <= 0.001) { try { f.el.pause(); } catch (e) { /* ignore */ } }
        _fades.splice(i, 1);
      }
    }
  }
  // Choisit la musique selon la carte et fait un CROSSFADE (sortie en fondu + entrée).
  // Dernier niveau -> "The Last Stand" ; sinon -> musique d'ambiance (boucle).
  const MUSIC_FADE = 0.9;     // durée du fondu (s)
  let _musicMode = 'ambient';
  function applyMapMusic(map) {
    const mode = (map === LEVEL_COUNT - 1) ? 'boss' : 'ambient';
    if (mode === _musicMode) return;            // pas de changement d'ambiance -> rien à faire
    _musicMode = mode;
    const target = state.musicMuted ? 0 : state.musicVolume;
    if (mode === 'boss') {                       // « bim » : l'ambiance descend, le boss entre (un peu plus vif)
      fadeAudio(bgIntro, 0, MUSIC_FADE);
      fadeAudio(bgLoop, 0, MUSIC_FADE);
      fadeAudio(bgBoss, target * BOSS_MUSIC_GAIN, MUSIC_FADE * 0.55, { keep: true });
    } else {                                     // retour : le boss descend, la musique classique reprend
      fadeAudio(bgBoss, 0, MUSIC_FADE);
      fadeAudio(bgLoop, target, MUSIC_FADE, { keep: true });
    }
  }
  function wireMusic() {
    if (musicWired || !bgIntro || !bgLoop) return;
    musicWired = true;
    // fin de l'intro -> on lance la boucle (en continu). On (re)pose le volume : après un
    // « Rejouer », la boucle avait été baissée à 0, sinon elle reprendrait muette.
    bgIntro.addEventListener('ended', () => {
      try { bgLoop.currentTime = 0; bgLoop.volume = state.musicMuted ? 0 : state.musicVolume; bgLoop.play().catch(() => {}); } catch (e) { /* ignore */ }
    });
    // intro introuvable/illisible -> on bascule direct sur la boucle (volume rétabli aussi)
    bgIntro.addEventListener('error', () => {
      try { bgLoop.volume = state.musicMuted ? 0 : state.musicVolume; bgLoop.play().catch(() => {}); } catch (e) { /* ignore */ }
    });
  }
  function startMusic() {
    if (!bgIntro || !bgLoop) return;
    wireMusic(); applyMusicVolume();
    if (musicStarted) return;
    const p = bgIntro.play();
    if (p && p.then) {
      p.then(() => { musicStarted = true; unbindMusicUnlock(); })
       .catch(() => { /* autoplay bloqué : on réessaiera au 1er geste utilisateur */ });
    } else { musicStarted = true; unbindMusicUnlock(); }
  }
  // L'autoplay sonore est bloqué tant que l'utilisateur n'a pas interagi :
  // on démarre donc la musique au tout premier geste (clic, touche, tactile).
  function onFirstGesture() { startMusic(); }
  function bindMusicUnlock() { GESTURES.forEach((ev) => document.addEventListener(ev, onFirstGesture, { passive: true })); }
  function unbindMusicUnlock() { GESTURES.forEach((ev) => document.removeEventListener(ev, onFirstGesture, { passive: true })); }
  // Onglet en arrière-plan -> on met la musique en pause (les <audio> HTML continuent
  // sinon, car requestAnimationFrame est gelé mais pas la lecture audio). On mémorise
  // les pistes actives pour relancer EXACTEMENT celles-ci au retour sur l'onglet.
  let _musicResume = [];
  function pauseMusicForTab() {
    _musicResume = [];
    [bgIntro, bgLoop, bgBoss, bgEnd].forEach((el) => {
      if (el && !el.paused) { _musicResume.push(el); try { el.pause(); } catch (e) { /* ignore */ } }
    });
  }
  function resumeMusicForTab() {
    _musicResume.forEach((el) => { try { el.play().catch(() => {}); } catch (e) { /* ignore */ } });
    _musicResume = [];
  }

  /* =========================================================================
     11. COLLISIONS
     ========================================================================= */
  function overlap(a, s) {
    return a.x < s.x + s.w && a.x + a.w > s.x && a.y < s.y + s.h && a.y + a.h > s.y;
  }

  /* =========================================================================
     12. MISE À JOUR
     ========================================================================= */
  function update(dt) {
    state.time += dt;

    // chaleur lissée vers la cible
    state.warmth += (state.warmthTarget - state.warmth) * Math.min(1, dt * 2.2);
    updatePalette(state.warmth);

    // chrono "card" de zone (fondu doux)
    if (state.cardT > 0) state.cardT -= dt;
    state.cardAlpha += ((state.cardT > 0 ? 1 : 0) - state.cardAlpha) * Math.min(1, dt * 3.2);

    // motes
    for (const m of motes) m.ph += dt * m.sp;

    // particules
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (p.drag) { const d = p.drag * dt; p.vx -= p.vx * d; p.vy -= p.vy * d; }   // traînée : décélère comme une vraie poussière
      p.vy += GRAVITY * 0.18 * p.grav * dt;
      if (p.turb) { p.vx += Math.sin(state.time * 2.4 + p.seed) * p.turb * dt; p.vy += Math.cos(state.time * 1.9 + p.seed * 1.7) * p.turb * dt * 0.6; }   // turbulence : ça tourbillonne
      if (p.spin) p.rot += p.spin * dt;     // rotation lente du sprite de fumée
      if (p.tex && p.grow) p.size = Math.max(0.5, p.size + p.size * p.grow * dt);   // la fumée gonfle ; les motes non (grow<=0)
      p.x += p.vx * dt; p.y += p.vy * dt;
    }

    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 60);

    // FX d'impulsion (poof de saut / nuage d'atterrissage) : avance le chrono de la bande
    for (let i = fxAnims.length - 1; i >= 0; i--) {
      const f = fxAnims[i];
      f.t += dt;
      if (f.t >= f.def.dur) fxAnims.splice(i, 1);
    }

    // anneaux d'onde au sol : vieillis ici avec le vrai dt (et non au rendu)
    for (let i = props.length - 1; i >= 0; i--) {
      const p = props[i];
      if (p.type === 'ring') { p.t += dt; if (p.t >= p.life) props.splice(i, 1); }
    }

    // orbes : animation + émission de lucioles (ici, pas au rendu -> stable quel que soit le framerate)
    for (const o of orbs) {
      o.bob += dt; o.pulse += dt * 2; o.spin += dt;
      if (o.collecting) { o.collT += dt; if (o.collT >= 0.75) o.collecting = false; }   // chrono de l'anim de disparition (plus lent)
      if (!reduceMotion && !o.collected && o.x > cam.x - 60 && o.x < cam.x + viewW + 60 &&
          Math.sin(o.pulse * 0.7) > 0.3 && rnd() < 6 * dt) {
        const oy = o.baseY + Math.sin(o.bob * 1.5) * 8;
        spawn(o.x + (rnd() - 0.5) * 60, oy + (rnd() - 0.5) * 60, (rnd() - 0.5) * 10, (rnd() - 0.5) * 10, 0.8, 1.5, rgbStr(DUSK.waterSpec), 'lighter', 0);
      }
    }

    tickFades(dt);   // fondus musicaux (crossfade entrée/sortie de niveau) — chaque frame

    // mise en scène "boss" (apparition de l'orbe finale) : tourne même quand les
    // entrées sont gelées -> AVANT le verrou ci-dessous (state.locked est posé par elle).
    if (state.boss) tickBoss(dt);
    if (state.speech) tickSpeech(dt);   // bulle d'invite finale : la frappe continue même main rendue au joueur

    if (!state.started || state.paused || state.ended || state.locked) { breatheIdle(dt); return; }

    // --- transition « page loader » entre cartes (gel du gameplay) ---
    if (state.trans) {
      state.trans.t += dt;
      if (state.trans.phase === 'out' && state.trans.t >= TRANS_T) {
        const dir = state.trans.dir || 1;            // +1 = carte suivante, -1 = carte précédente
        state.map += dir;
        if (state.map >= LEVEL_COUNT) { state.trans = null; endGame(); return; }
        if (state.map < 0) state.map = 0;            // garde-fou (on ne déclenche le retour que si map > 0)
        // réapparition : à GAUCHE si on avance, à DROITE (là d'où l'on vient) si on revient
        const sp = (dir < 0 ? MAP_SPAWN_RIGHT[state.map] : MAP_SPAWN[state.map])
          || { x: state.map * SECTION_W + 90, y: GROUND_Y - A.h };
        A.x = sp.x; A.y = sp.y; A.vx = 0; A.vy = 0;
        A.onGround = true; A.jumpsLeft = MAX_JUMPS; A.lastSafeX = A.x; A.lastSafeY = A.y;
        // caméra cadrée sur le perso, bornée à la nouvelle carte (collée à gauche en avant, à droite en retour)
        const mapL = state.map * SECTION_W;
        cam.x = clamp(A.x + A.w / 2 - viewW * 0.46, mapL, mapL + SECTION_W - viewW);
        // crossfade musical à CHAQUE entrée/sortie du dernier niveau (fondu, pas de coupure)
        applyMapMusic(state.map);
        // dernière carte (1re visite) -> on arme la mise en scène "boss" : pas de carte
        // tout de suite, orbe cachée (la musique est déjà gérée par applyMapMusic).
        if (state.map === LEVEL_COUNT - 1 && !state.bossDone) {
          state.bossPending = true;
          const cta = orbs.find((o) => o.cta);
          if (cta) cta.scale = 0;
        } else {
          showCard(state.map);
        }
        state.trans.phase = 'in'; state.trans.t = 0;
      } else if (state.trans.phase === 'in' && state.trans.t >= TRANS_T) {
        state.trans = null;
        // le wipe est terminé : on lance la séquence (entrées gelées ~3 s)
        if (state.bossPending) {
          state.bossPending = false;
          state.boss = { t: 0, shake: 0, boomed: false, zoom: 1, flash: 0 };
          state.locked = true;
        }
      }
      breatheIdle(dt); updateCamera(dt);
      return;
    }

    // --- CHRONO DE JEU ACTIF : on n'arrive ici que quand on joue réellement
    // (démarré, ni en pause/modal, ni verrouillé, ni en transition). On n'affiche
    // QUE le temps ; le score est calculé à la fin, à partir de ce chrono.
    state.playMs += dt * 1000;
    paintTimer();

    // (la capture d'orbe ouvre désormais la carte instantanément, voir collectOrb :
    //  plus de gel/ralenti "collect" ici.)

    /* ---- entrées -> mouvement horizontal (+ SPRINT sur Maj) ---- */
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    A.crouch = keys.down && A.onGround;
    A.sprint = keys.sprint && !A.crouch && dir !== 0;
    const spd = MOVE_SPEED * (A.crouch ? 0.35 : (A.sprint ? SPRINT_MULT : 1));
    const target = dir * spd;
    if (dir !== 0) { A.vx += Math.sign(target - A.vx) * ACCEL * dt; if ((target - A.vx) * dir < 0) A.vx = target; A.facing = dir; }
    else { const f = FRICTION * dt; if (Math.abs(A.vx) <= f) A.vx = 0; else A.vx -= Math.sign(A.vx) * f; }

    // demi-tour brusque au sol : on inverse l'input alors qu'on file encore dans
    // l'autre sens -> volute laterale qui jaillit du sol, cote elan (comme un derapage).
    // Marche pour la GAUCHE comme la DROITE via le flip du sprite.
    if (A.turnCd > 0) A.turnCd -= dt;
    if (A.onGround && dir !== 0 && A.turnCd <= 0 &&
        Math.sign(A.vx) === -dir && Math.abs(A.vx) > MOVE_SPEED * 0.55) {
      const m = Math.sign(A.vx);   // sens de l'elan = cote ou la fumee derape
      playFx(FXA.turn, A.x + A.w / 2 + m * 95, A.y + A.h, 76, m < 0);   // ~95px a l'ecart du perso
      A.turnCd = 0.45;             // une seule volute par demi-tour
      if (!reduceMotion) blip(220, 0.12, 'sine', 0.05);
    }

    // inclinaison du corps selon la vitesse (penché en avant en pleine course)
    A.lean += (clamp(A.vx / (MOVE_SPEED * SPRINT_MULT), -1, 1) * 0.2 - A.lean) * Math.min(1, dt * 8);

    // traînée de sprint : afterimages + poussière aux pieds
    if (A.sprint && !reduceMotion && Math.abs(A.vx) > MOVE_SPEED * 1.05) {
      if (rnd() < 20 * dt) spawn(A.x + A.w / 2 - A.facing * 8, A.y + A.h * 0.55, -A.facing * 50, -8, 0.32, 3, rgbStr(P.accentGlow), 'lighter', 0.05);
      if (A.onGround && rnd() < 16 * dt) spawn(A.x + A.w / 2 - A.facing * 12, A.y + A.h, -A.facing * 90, -40, 0.4, 2, rgbStr(P.groundRim), 'lighter', 0.5);
    }

    if (A.crouch) A.crouchT += dt; else A.crouchT = 0;

    /* ---- descente volontaire : flèche du bas -> traverser la plateforme s'il y en
       a une EN DESSOUS (sinon, rien : on reste sur place, on ne tombe pas dans le vide) ---- */
    if (A.dropThru > 0) A.dropThru -= dt;
    if (A.dropReq) {
      A.dropReq = false;
      if (A.onGround) {
        const fcx = A.x + A.w / 2, surf = A.y + A.h;
        if (platformBelow(fcx, surf) !== null) {   // une plateforme existe plus bas -> on descend
          A.dropThru = 0.22;                        // fenêtre où l'on ignore la plateforme quittée
          A.dropY = surf;                           // niveau du sol que l'on quitte
          A.onGround = false; A.coyote = 0;
          A.crouch = false; A.crouchT = 0;
          if (A.vy < 30) A.vy = 30;                 // léger élan vers le bas
          burst(fcx, surf, 6, rgbStr(P.foliageNear), 70);
          blip(300, 0.10, 'sine', 0.05);
        }
      }
    }

    /* ---- saut (simple + DOUBLE saut + coyote + buffer + saut chargé) ---- */
    A.coyote = A.onGround ? COYOTE : Math.max(0, A.coyote - dt);
    if (A.onGround) A.jumpsLeft = MAX_JUMPS;
    if (A.buffer > 0) A.buffer -= dt;
    const canGround = A.coyote > 0;
    if (A.buffer > 0 && (canGround || A.jumpsLeft > 0)) {
      if (canGround) {                                   // 1er saut (depuis le sol)
        const charged = A.crouchT > 0.16;
        A.vy = -JUMP_V * (charged ? 1.22 : 1);
        A.jumpsLeft = MAX_JUMPS - 1;
        A.scaleX = 0.82; A.scaleY = 1.22; A.svx = 0; A.svy = 0;
        if (!fxPlaying(FXA.land)) playFx(FXA.jump, A.x + A.w / 2, A.y + A.h, charged ? 128 : 106, A.facing < 0);   // poof à l'élan, SAUF si un poof d'atterrissage joue encore (évite la superposition moche)
        blip(charged ? 540 : 440, 0.18, 'triangle', 0.06);
      } else {                                           // double saut (en l'air) : pirouette + poof
        A.vy = -AIR_JUMP_V;
        A.jumpsLeft--;
        A.flip = -A.facing * TAU;   // salto AVANT (dans le sens du déplacement) : l'angle remonte de −TAU vers 0 -> rotation horaire à droite
        A.scaleX = 0.9; A.scaleY = 1.12; A.svx = 0; A.svy = 0;
        playFx(FXA.jump, A.x + A.w / 2, A.y + A.h, 96, A.facing < 0);   // poof au double saut (en l'air -> jamais en conflit avec un poof d'atterrissage)
        blip(640, 0.16, 'sine', 0.06);
      }
      A.onGround = false; A.coyote = 0; A.buffer = 0;
    }
    if (A.flip !== 0) { A.flip += (0 - A.flip) * Math.min(1, dt * 8); if (Math.abs(A.flip) < 0.03) A.flip = 0; }

    /* ---- plané (hover) ---- */
    A.hover = jumpHeld && !A.onGround && A.vy > 30;
    let g = GRAVITY * (A.hover ? HOVER_GRAVITY : 1);
    A.vy += g * dt;
    if (A.hover && A.vy > HOVER_MAX_FALL) A.vy = HOVER_MAX_FALL;
    // Traînée de plané = POUSSIÈRE DE LUCIOLES : des glints de lumière nets (étoile + sparkle fin),
    // épars et brillants (cœur blanc-chaud, additif), qui s'égrènent DERRIÈRE le perso, montent
    // doucement et scintillent en s'éteignant. Pas un nuage diffus (l'ancien effet faisait un « pet »).
    if (A.hover) {
      hoverEmit += dt;
      const PERIOD = 0.038;                                  // ~26/s : dense mais lisible (Steven veut + visible)
      while (hoverEmit >= PERIOD) {
        hoverEmit -= PERIOD;
        const back = -A.facing;                             // côté opposé au regard = derrière
        const px = A.x + A.w / 2 + back * (10 + rnd() * 26) + (rnd() - 0.5) * 8;   // nettement derrière, pas sous les pieds
        const py = A.y + A.h * (0.3 + rnd() * 0.55);                                // le long du corps
        const fine = rnd() < 0.35;                          // mélange : sparkle fin / belle étoile (majorité d'étoiles)
        spawn(px, py,
          back * (6 + rnd() * 18) + (rnd() - 0.5) * 10,      // dérive lente vers l'arrière
          -(10 + rnd() * 24),                               // FLOTTE vers le haut (ne tombe pas)
          0.45 + rnd() * 0.45,                              // vie un peu plus longue -> traînée plus lisible
          fine ? 14 + rnd() * 9 : 22 + rnd() * 12,          // paillettes PLUS GROSSES
          0, 'lighter', 0.03,                               // quasi sans gravité
          { tex: fine ? FX.sparkle : FX.twinkle,
            tint: STAR_TINTS[(rnd() * 3) | 0],              // teintes étoile fixes (blanc chaud -> or), cohérent partout
            texA: 0.7 + rnd() * 0.3, grow: -0.8, drag: 1.3,             // rétrécit en s'éteignant
            rot: rnd() * TAU, spin: (rnd() - 0.5) * 3 });
      }
    }

    /* ---- hitbox accroupie (pas de plafond : plateformes sens-unique) ---- */
    const wantH = A.crouch ? CROUCH_H : STAND_H;
    if (wantH !== A.h) { const feet = A.y + A.h; A.h = wantH; A.y = feet - wantH; }

    /* ---- déplacement + collisions ---- */
    // X : les plateformes sens-unique ne bloquent pas latéralement
    A.x += A.vx * dt;
    // Y : on tombe, puis on se pose sur la plateforme sous les pieds (traversable par en dessous)
    const wasGround = A.onGround;
    A.onGround = false;
    A.y += A.vy * dt;
    {
      const cx = A.x + A.w / 2, feet = A.y + A.h, prevFeet = feet - A.vy * dt;
      let bestY = null;
      for (const s of solids) {
        if (s.type !== 'oneway') continue;
        const sy = segSurfaceY(s, cx);
        if (sy == null) continue;
        if (A.dropThru > 0 && sy <= A.dropY + 6) continue;   // descente : on traverse la plateforme quittée
        const tol = wasGround ? 16 : 1.5;     // colle aux pentes/marches quand au sol
        if (A.vy >= -0.5 && prevFeet <= sy + tol && feet >= sy - 14) {
          if (bestY === null || sy < bestY) bestY = sy;   // plateforme la plus haute sous les pieds
        }
      }
      if (bestY !== null) {
        if (!wasGround && A.vy > 300) onLand(A.vy);
        A.y = bestY - A.h; A.vy = 0; A.onGround = true; A.lastSafeX = A.x; A.lastSafeY = A.y;
      }
    }

    /* ---- chute sous la carte -> réapparition douce ---- */
    if (A.y > SAFE_BOTTOM) {
      A.x = A.lastSafeX; A.y = A.lastSafeY - 8; A.vx = 0; A.vy = 0;
      burst(A.x + A.w / 2, A.y + A.h, 14, rgbStr(P.accentGlow), 140);
      state.shake = 6;
    }

    /* ---- ressort squash & stretch ---- */
    const targetSX = 1, targetSY = 1;
    A.svx += (targetSX - A.scaleX) * 220 * dt; A.svx *= 0.82; A.scaleX += A.svx * dt;
    A.svy += (targetSY - A.scaleY) * 220 * dt; A.svy *= 0.82; A.scaleY += A.svy * dt;
    if (A.crouch) { A.scaleX = lerp(A.scaleX, 1.25, Math.min(1, dt * 12)); A.scaleY = lerp(A.scaleY, 0.7, Math.min(1, dt * 12)); }

    /* ---- aperçu d'anim : marche/course sur place (temporaire, piloté par _anim-preview.html) ---- */
    if (window.__WALK != null) {
      A.vx = window.__WALK * MOVE_SPEED; A.facing = window.__WALK < 0 ? -1 : 1;
      A.onGround = true; A.vy = 0; A.x = 200; A.crouch = false;
    }

    /* ---- membres à ressort (mains/pieds qui traînent) ---- */
    updateLimbs(dt);

    /* ---- yeux : regardent l'orbe non collecté le plus proche ---- */
    let look = { x: A.facing, y: -0.1 }, best = 1e9;
    for (const o of orbs) {
      if (o.collected) continue;
      const dx = o.x - (A.x + A.w / 2), dy = o.y - (A.y + 18), d = Math.hypot(dx, dy);
      if (d < 280 && d < best) { best = d; look = { x: dx / d, y: dy / d }; }
    }
    A.eye.x += (look.x - A.eye.x) * Math.min(1, dt * 8);
    A.eye.y += (look.y - A.eye.y) * Math.min(1, dt * 8);

    // clignement + respiration
    breatheIdle(dt);
    A.idle = (Math.abs(A.vx) < 6 && A.onGround) ? A.idle + dt : 0;

    /* ---- collecte d'orbes ---- */
    for (const o of orbs) {
      if (o.collected) continue;
      const cx = A.x + A.w / 2, cy = A.y + A.h / 2;
      if (Math.hypot(cx - o.x, cy - o.baseY) < o.r + 30) collectOrb(o);
    }

    /* ---- (les cartons de ville s'affichent à l'entrée de chaque carte) ---- */

    /* ---- bornes de la carte : bord droit = carte suivante, bord gauche = carte précédente ---- */
    const mapLeft = state.map * SECTION_W;
    const mapRight = mapLeft + SECTION_W;
    if (A.x < mapLeft) { A.x = mapLeft; if (A.vx < 0) A.vx = 0; }   // mur dur (1re carte) / contact avant retour
    const lastMap = state.map >= LEVEL_COUNT - 1;
    if (lastMap) {
      // dernière carte (désert) : bord droit = simple MUR, AUCUN écran de fin auto.
      // La partie se termine uniquement en attrapant la grosse orbe « ? ».
      if (A.x + A.w > mapRight) { A.x = mapRight - A.w; if (A.vx > 0) A.vx = 0; }
    } else if (!state.trans && (A.x + A.w / 2) > mapRight - 56) {
      state.trans = { phase: 'out', t: 0, dir: 1 };          // carte suivante
    }
    if (!state.trans && state.map > 0 && (A.x + A.w / 2) < mapLeft + 56) state.trans = { phase: 'out', t: 0, dir: -1 }; // carte précédente

    updateCamera(dt);
  }

  function breatheIdle(dt) {
    A.breath += dt * 2.4;
    A.blinkT -= dt;
    if (A.blinkT <= 0) { A.blink = 0.14; A.blinkT = 2.4 + rnd() * 3.5; }
    if (A.blink > 0) A.blink -= dt;
    if (A.cheer > 0) A.cheer -= dt;     // pouce levé (ramassage)
    if (A.landT > 0) A.landT -= dt;     // pieds en écart (atterrissage)
  }

  /* =========================================================================
     MISE EN SCÈNE "BOSS" — apparition de l'orbe finale (dernier niveau)
     Séquence ~3 s, entrées gelées :
       1) TREMBLEMENT  : toute la carte tremble (intensité croissante), orbe cachée
       2) APPARITION   : l'orbe surgit PETITE
       3) GROSSISSEMENT: elle grossit d'un seul coup (overshoot) + boom + carte
       4) STABILISATION: l'overshoot se calme, le tremblement retombe
       5) PAUSE        : court temps mort, puis on rend la main au joueur
     ========================================================================= */
  // Durées (s) des étapes de la mise en scène — total ≈ 6,3 s.
  const BOSS_T = { zoom: 1.6, tremor: 2.0, flash: 1.2, hop: 0.22, dust: 1.15, settle: 0.7, hold: 0.6 };
  function tickBoss(dt) {
    const b = state.boss; if (!b) return;
    b.t += dt;
    if (b.ring != null && b.ring < 1) b.ring = Math.min(1, b.ring + dt / 0.85);   // onde de choc dorée du boom (plus lente, s'estompe en douceur)
    if (b.flareT != null && b.flareT < 1) b.flareT = Math.min(1, b.flareT + dt / 0.5);   // flare doré du boom
    if (b.shockT != null && b.shockT < 1) b.shockT = Math.min(1, b.shockT + dt / 0.8);   // SHOCKWAVE du boom (explosion d'énergie, ~0,8 s)
    const t = b.t;
    const cta = orbs.find((o) => o.cta);
    const ease = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);   // démarrage vif, fin douce
    const Z = BOSS_T.zoom, TR = Z + BOSS_T.tremor, FL = TR + BOSS_T.flash, HOP = FL + BOSS_T.hop,
          DU = HOP + BOSS_T.dust, SE = DU + BOSS_T.settle, HO = SE + BOSS_T.hold;

    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 1.7);   // le bloom chaud s'estompe en douceur


    // cadrage : on centre l'orbe à l'écran pendant toute la mise en scène
    if (cta) {
      const mapL = state.map * SECTION_W;
      const tx = clamp(cta.x - viewW / 2, mapL, mapL + SECTION_W - viewW);
      cam.x += (tx - cam.x) * Math.min(1, dt * 4);
    }

    if (t < Z) {
      // 1) ZOOM / DÉZOOM vers le centre — calme et inquiétant, orbe invisible
      const k = t / Z;
      b.zoom = 1 + Math.sin(k * Math.PI) * 0.55;          // 1 -> 1,55 -> 1
      b.shake = 0;
      if (cta) cta.scale = 0;
      // glimmer doré d'anticipation au centre
      if (cta && rnd() < 9 * dt) spawn(cta.x + (rnd() - 0.5) * 80, cta.baseY + (rnd() - 0.5) * 80, (rnd() - 0.5) * 16, (rnd() - 0.5) * 16, 0.7, 2.2, rgbStr(P.accentGlow), 'lighter', 0);
    } else if (t < TR) {
      // 2) TREMBLEMENT DE TERRE — intensité croissante (les vieux nuages de poussière au sol ont été retirés)
      const k = (t - Z) / BOSS_T.tremor;
      b.zoom = 1 + k * 0.12;                              // léger resserrement pendant que ça tremble
      b.shake = 3 + k * 15;                               // 3 -> 18 px
      if (cta) cta.scale = 0;
      if (rnd() < 12 * dt) blip(34 + rnd() * 26, 0.22, 'sawtooth', 0.05);   // grondement grave
    } else if (t < FL) {
      // 2bis) FLASH D'ÉNERGIE — l'overlay « Flash 19 » joue DEUX FOIS au centre de
      //       l'orbe (encore invisible) pendant que la terre tremble encore : montée
      //       de tension juste avant la naissance. Le dessin est dans drawBossFlash19.
      const loopDur = BOSS_T.flash / 2;
      const local = t - TR;
      const inLoop = local - Math.floor(local / loopDur) * loopDur;
      const pulse = Math.sin(clamp(inLoop / loopDur, 0, 1) * Math.PI);   // 0 -> 1 -> 0, pic au coeur du flash
      b.zoom = 1.12 + pulse * 0.04;                       // resserrement qui palpite avec le flash
      b.shake = 10 + pulse * 16;                          // ça tremble, et ça pulse à chaque flash
      if (cta) cta.scale = 0;                             // l'orbe n'apparaît pas encore
      if (rnd() < 10 * dt) blip(30 + rnd() * 22, 0.2, 'sawtooth', 0.045);          // grondement continu
    } else if (t < HOP) {
      // 3) "HOP" — la boule surgit d'un coup, gros impact + onde de poussière
      const k = ease((t - FL) / BOSS_T.hop);
      if (cta) cta.scale = 1.35 * k;
      if (!b.boomed) {
        b.boomed = true; b.shake = 30; b.flash = 0.30; b.zoom = 1.18; b.ring = 0; b.flareT = 0; b.shockT = 0; b.flareRot = rnd() * TAU;   // bloom chaud + souffle + flare + shockwave
        if (cta) {
          embers(cta.x, cta.baseY, 36, 220);                             // quelques braises ambrées (pas un feu d'artifice)
          burst(cta.x, cta.baseY, 18, rgbStr(P.sunHalo), 170);            // fines étincelles ambrées, discrètes
          for (let i = 0; i < 24; i++) mote(cta.x, cta.baseY, cta.r * 1.5);   // pollen lumineux libéré par la naissance
        }
        bossBirthSound();                                  // « boom » chaud et majestueux de la naissance
        showCard(state.map);                               // la carte « À suivre… » paraît à l'impact
      }
    } else if (t < DU) {
      // 4) RÉSOLUTION — l'orbe se cale (overshoot -> 1), motes dorées qui s'élèvent, le jour revient
      const k = (t - HOP) / BOSS_T.dust;
      if (cta) cta.scale = 1.35 + (1.0 - 1.35) * ease(k);
      b.shake = 14 * (1 - k);
      b.zoom = 1 + (1 - k) * 0.12;
      if (cta && rnd() < 28 * dt) mote(cta.x, cta.baseY + cta.r * 0.2, cta.r * 1.7);   // motes dorées qui montent autour de l'orbe née
    } else if (t < SE) {
      // 5) STABILISATION — l'orbe baigne dans ses rayons ; la réplique de fin
      //    commence à s'écrire : elle FAIT PARTIE de l'animation (pas liée au perso).
      if (cta) cta.scale = 1; b.shake = 0; b.zoom = 1;
      if (!b.spoke) { b.spoke = true; startCtaSpeech(); }
      if (cta && rnd() < 14 * dt) mote(cta.x, cta.baseY + cta.r * 0.1, cta.r * 1.6);
    } else {
      // 6) DIALOGUE — fin de l'animation : on RESTE verrouillé tant que la réplique
      //    n'a pas été tapée, LUE, puis estompée. Ensuite seulement on rend la main.
      if (cta) cta.scale = 1; b.shake = 0; b.zoom = 1; b.flash = 0;
      if (!b.spoke) { b.spoke = true; startCtaSpeech(); }   // garde-fou si on a sauté la phase 5
      if (cta && rnd() < 8 * dt) mote(cta.x, cta.baseY, cta.r * 1.5);
      if (!state.speech || state.speech.gone) {             // réplique lue + disparue -> FIN
        state.speech = null; state.boss = null; state.bossDone = true; state.locked = false;
      }
    }
  }

  /* =========================================================================
     DIALOGUE DE FIN — « attrape vite cette orbe ! »
     Pop-up de CINÉMATIQUE (pas liée au perso) qui FAIT PARTIE de l'animation :
     pendant que l'orbe « ? » baigne dans ses rayons, une réplique s'écrit lettre
     par lettre dans un cartouche centré. À la fin de l'animation, on laisse le
     temps de LIRE, puis le dialogue s'estompe et la main est rendue au joueur.
     Cycle : frappe -> lecture (SPEECH_READ) -> fondu de sortie (SPEECH_FADE).
     ========================================================================= */
  const CTA_SPEECH = 'Mais… mais… Attrape vite cette orbe !\nEt si elle cachait un dernier projet ?';
  const SPEECH_CPS = 30;     // lettres révélées par seconde
  const SPEECH_READ = 2.6;   // s de lecture une fois la phrase complète
  const SPEECH_FADE = 0.55;  // s de disparition du dialogue
  function startCtaSpeech() {
    state.speech = { full: CTA_SPEECH, n: 0, in: 0, hold: 0, out: 0, done: false, gone: false };
  }
  function tickSpeech(dt) {
    const s = state.speech; if (!s) return;
    s.in = Math.min(1, s.in + dt / 0.30);                 // fondu + glisse d'apparition du cartouche
    if (s.n < s.full.length) {                            // 1) FRAPPE lettre par lettre
      const before = Math.floor(s.n);
      s.n = Math.min(s.full.length, s.n + dt * SPEECH_CPS);
      const now = Math.floor(s.n);
      if (now > before) {                                 // « tic » doux de machine à écrire (jamais sur un blanc)
        const c = s.full[now - 1];
        if (c && c !== ' ' && c !== '…' && c !== '\n' && now % 2 === 0) blip(540 + (now % 4) * 35, 0.045, 'sine', 0.014);
      }
      if (s.n >= s.full.length) s.done = true;
    } else if (s.hold < SPEECH_READ) {                    // 2) TEMPS DE LECTURE
      s.hold += dt;
    } else if (s.out < 1) {                               // 3) FONDU DE SORTIE
      s.out = Math.min(1, s.out + dt / SPEECH_FADE);
      if (s.out >= 1) s.gone = true;
    }
  }

  function updateLimbs(dt) {
    const cx = A.x + A.w / 2, cy = A.y + A.h / 2;
    const dir = A.facing;
    const air = !A.onGround, rising = air && A.vy < 0;
    const moving = Math.min(1, Math.abs(A.vx) / MOVE_SPEED);     // 0..1
    const gait = Math.min(1, moving / 0.28);                     // plein balancement DÈS la marche
    // cadence du balancier (course posée) — accélérée de 5 % (× 1.05) ; bras + pieds partagent la phase (synchro)
    const phase = state.time * (6.5 + moving * 5) * 1.05;
    const idle = Math.sin(A.breath * 1.7) * (1 - gait);         // respiration au repos seulement
    const fdir = A.vx < 0 ? -1 : 1;                              // sens du déplacement
    const gY = A.y + A.h;
    // DÉCALAGE directionnel : en course, mains+pieds glissent vers l'AVANT (sens du déplacement)
    // pour rester centrés sous le corps/la tête de profil (qui « penchent » dans le sens).
    const lead = fdir * A.w * 0.13 * gait;

    // MAINS : vrai BALANCIER de profil — une main part LOIN DEVANT le corps, l'autre LOIN DERRIÈRE
    // (bien écartées du torse), elles se croisent en PLONGEANT sous le sweat au passage. Au repos :
    // mains basses aux hanches. Poignet retardé (rotation = π/2 − w) -> les poings « pendent ».
    const REACH = 23;                                                  // AMPLITUDE avant/arrière du balancier de marche (réduite encore de 3 px : bras moins écartés du corps)
    const HANDY = cy - 5;                                              // hauteur des mains (remontées encore ~3 px)
    const DIP = 13;                                                    // plongée au croisement -> passe SOUS le sweat (jamais collé au torse)
    const hand = (i) => {
      const ph = phase + i * Math.PI, sgn = i === 0 ? -1 : 1;
      // SAUT/CHUTE/PLANE : main « de dos » à −26 px, main « de face » à +32 px (légèrement asymétrique).
      // Rendu RIGIDE par le snap plus bas -> zéro retard ; offsets constants par rapport au corps.
      if (air) {
        const sideA = (sgn * A.facing < 0) ? 0.65 : 0.80;   // dos 0.65*40=26 px / face 0.80*40=32 px
        return { x: cx + A.w * sideA * sgn, y: HANDY + 3, t: 0 };
      }
      const s = Math.sin(ph);
      const t = 1.05 * gait * s;                                       // angle du poignet (pour la rotation)
      // au REPOS : la main « de dos » (côté DOS, devant le corps) est ramenée SUR le corps ; l'autre (de face, arrière-plan) garde sa position écartée ; en MARCHE : ±0.30 (balancier)
      const idleSide = (sgn * A.facing < 0) ? 0.14 : 0.80;   // de dos ramenée au corps ; de face rapprochée du ventre (~3 px)
      const side = A.w * (idleSide * (1 - gait) + 0.30 * gait) * sgn;
      const x = cx + side + lead + fdir * REACH * gait * s;           // LOIN devant (s>0) / LOIN derrière (s<0) — passe devant puis derrière le corps
      const y = HANDY - 4 * gait + DIP * gait * (1 - Math.abs(s)) + idle * 1.2 * sgn;  // EN COURSE : remontées de 4 px ; bas/centre = plonge sous le sweat ; extrêmes = hanches
      return { x, y, t };
    };
    const hT = [hand(0), hand(1)];

    // PIEDS : grande FOULÉE AMPLE — bien écartés du corps (un loin devant, un loin derrière).
    const foot = (i) => {
      const ph = phase + i * Math.PI, sgn = i === 0 ? -1 : 1;
      const side = A.w * (0.34 * (1 - gait) + 0.12 * gait) * sgn;          // écart latéral (pas collés au centre)
      if (air) return { x: cx + A.w * 0.34 * sgn, y: gY - 1 };  // saut/chute : MÊME écart latéral + même hauteur qu'au REPOS
      const c = Math.cos(ph), swing = Math.max(0, c);                      // swing>0 = pied en l'air
      const lift = swing * 27 * gait;                                      // lever ample EN MARCHE ; nul à l'arrêt (pieds immobiles au repos)
      const x = cx + side + lead + fdir * (36 * gait * Math.sin(ph) + swing * 12 * gait);  // décalé dans le sens + grande foulée
      return { x, y: gY - 1 - lift };
    };
    const fT = [foot(0), foot(1)];
    // ressort de POSITION (réactif au sol, suit bien le bras) + ressort de POIGNET qui TRAÎNE
    // derrière l'angle du bras (wk < hk) -> le poing arrive en retard puis se redresse (fouetté).
    const hk = 38, fk = 22, wk = 13;   // hk élevé au sol -> le balancier atteint vraiment ses extrêmes
    for (let i = 0; i < 2; i++) {
      if (air) {
        // EN L'AIR : pose RIGIDE, collée au corps. Le ressort traînait derrière un corps
        // qui monte/avance vite (retard ≈ vitesse / k) -> mains « à 50 px ». On COLLE
        // les membres à leur cible : offset constant par rapport au corps, zéro retard.
        A.hand[i].x = hT[i].x; A.hand[i].y = hT[i].y; A.hand[i].w = hT[i].t;
        A.foot[i].x = fT[i].x; A.foot[i].y = fT[i].y;
        continue;
      }
      A.hand[i].x += (hT[i].x - A.hand[i].x) * Math.min(1, dt * hk);
      A.hand[i].y += (hT[i].y - A.hand[i].y) * Math.min(1, dt * hk);
      A.hand[i].w += (hT[i].t - A.hand[i].w) * Math.min(1, dt * wk);     // poignet retardé (follow-through)
      A.foot[i].x += (fT[i].x - A.foot[i].x) * Math.min(1, dt * fk);
      A.foot[i].y += (fT[i].y - A.foot[i].y) * Math.min(1, dt * fk);
    }
    A.hair += ((-A.vx * 0.05 - (A.crouch ? 6 : 0)) - A.hair) * Math.min(1, dt * 10);
  }

  function onLand(vy) {
    A.scaleX = 1.28; A.scaleY = 0.72; A.svx = A.svy = 0;
    A.landT = 0.22;                    // pieds en écart bref à l'impact
    state.shake = Math.min(4.5, vy / 240);   // atterrissage : secousse discrète (avant : max 10, vy/110 -> trop violent)
    // nuage de poussière plat qui s'étale : plus large quand on tombe de haut
    playFx(FXA.land, A.x + A.w / 2, A.y + A.h, Math.min(168, 112 + vy / 12), rnd() < 0.5);   // largeur du poof : plus large quand on tombe de haut
    blip(220, 0.12, 'sine', 0.05);
  }

  function collectOrb(o) {
    o.collected = true;                // -> résidu immédiat (pas d'anim de disparition : masquée par la carte)
    if (o.cta) state.speech = null;    // l'orbe finale est cueillie : la bulle d'invite s'efface
    state.collected++;
    state.warmthTarget = clamp(state.collected / orbs.length, 0, 1);
    state.shake = 6;
    blip(880, 0.18, 'triangle', 0.07); setTimeout(() => blip(1180, 0.16, 'sine', 0.05), 90);
    A.scaleX = 0.7; A.scaleY = 1.3; A.svx = A.svy = 0;
    updateHUD();   // met à jour le compteur de projets (les points ne sont révélés qu'à la fin)
    // Ouverture INSTANTANÉE, à la frame même du contact. Avant : gel de 0,78 s en
    // ralenti (dt *= 0.25) avant la popup, ce qui donnait une impression de bug.
    if (o.cta) endGame(); else openModal(o);
  }

  /* =========================================================================
     13. RENDU
     ========================================================================= */
  function clearAndSky() {
    // efface toute la fenêtre réelle + bandes sombres (letterbox du repère virtuel)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, winW, winH);
    ctx.fillStyle = '#0c170a'; ctx.fillRect(0, 0, winW, winH);
    // repère VIRTUEL (VWxVH) centré (contain)
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, dpr * viewOffX, dpr * viewOffY);
    // ciel de secours bleu, assorti au ciel des images de niveau peintes
    const g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, '#4ea0d8'); g.addColorStop(0.6, '#8fcdec'); g.addColorStop(1, '#c8e9f2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
  }

  // décor « image = carte » : les 6 sections peintes collées bout à bout
  function drawLevelImages() {
    const top = levelTopY();
    const i0 = Math.max(0, Math.floor((cam.x - 40) / SECTION_W));
    const i1 = Math.min(LEVEL_COUNT - 1, Math.floor((cam.x + viewW + 40) / SECTION_W));
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    // remplissage sous les images (si l'écran descend plus bas) : vert sombre
    ctx.fillStyle = '#24331c';
    ctx.fillRect(cam.x - 40, top + SECTION_H - 2, viewW + 80, 500);
    for (let i = i0; i <= i1; i++) {
      const im = IMG['level' + (i + 1)];
      if (imgReady(im)) ctx.drawImage(im, i * SECTION_W, top, SECTION_W, SECTION_H);
    }
    ctx.restore();
  }

  // position du soleil à l'écran (réutilisée par le bloom)
  function sunPos() { return { x: viewW * 0.76 - cam.x * 0.03, y: viewH * 0.22 + Math.sin(state.time * 0.25) * 3 }; }

  function drawSun() {
    const m = sunPos(), R = lerp(46, 56, state.warmth);
    ctx.globalCompositeOperation = 'lighter';
    // grand halo de lumière diffuse
    for (let i = 4; i >= 1; i--) {
      const hr = R * (1.5 + i * 1.1);
      const g = ctx.createRadialGradient(m.x, m.y, R * 0.5, m.x, m.y, hr);
      g.addColorStop(0, rgbStr(P.sunHalo, 0.12)); g.addColorStop(1, rgbStr(P.sunHalo, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, hr, 0, TAU); ctx.fill();
    }
    // rayons doux qui tournent lentement
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(state.time * 0.04);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      const rg = ctx.createLinearGradient(0, -R * 1.2, 0, -R * 4.5);
      rg.addColorStop(0, rgbStr(P.sunHalo, 0.10)); rg.addColorStop(1, rgbStr(P.sunHalo, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-R * 0.5, -R * 1.2); ctx.lineTo(0, -R * 4.6); ctx.lineTo(R * 0.5, -R * 1.2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    // disque
    const dg = ctx.createRadialGradient(m.x - R * 0.28, m.y - R * 0.28, R * 0.2, m.x, m.y, R);
    dg.addColorStop(0, '#ffffff'); dg.addColorStop(0.6, rgbStr(P.sunCore)); dg.addColorStop(1, rgbStr(P.sunHalo));
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, TAU); ctx.fill();
  }

  // nuages doux peints, dérivant lentement
  function softCloud(cx, cy, s, alpha) {
    const L = [[0, 0, 1], [-0.7, 0.12, 0.62], [0.72, 0.1, 0.6], [-0.3, -0.22, 0.5], [0.34, -0.2, 0.46], [1.25, 0.18, 0.4], [-1.2, 0.2, 0.36]];
    for (const p of L) {
      const r = p[2] * s, x = cx + p[0] * s, y = cy + p[1] * s;
      const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.2, x, y, r);
      g.addColorStop(0, rgbStr(P.cloud, alpha)); g.addColorStop(1, rgbStr(P.cloud, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }
  function drawClouds() {
    const span = viewW + 600;
    for (let i = 0; i < 12; i++) {           // peu de nuages, bien répartis
      const c = stars[i];
      const px = ((c.x * span + state.time * (5 + c.r * 5) - cam.x * 0.05) % span + span) % span - 300;
      const py = viewH * (0.05 + (i / 12) * 0.32);
      softCloud(px, py, 30 + c.r * 24, 0.42 + c.r * 0.16);
    }
  }

  // bruit déterministe 0..1 (pour varier sans jitter brouillon)
  function hashNoise(n) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

  // canopée stylisée "nuage de feuilles" en cel-shading 2 tons + liseré lune
  function leafCloud(cx, cy, r, lo, hi, rim) {
    const L = [[0, 0, 1], [-0.72, 0.16, 0.64], [0.74, 0.12, 0.6], [-0.34, -0.42, 0.56], [0.36, -0.38, 0.5]];
    ctx.fillStyle = lo;
    for (const p of L) { ctx.beginPath(); ctx.arc(cx + p[0] * r, cy + p[1] * r, p[2] * r, 0, TAU); ctx.fill(); }
    if (hi) { ctx.fillStyle = hi; for (const p of L) { ctx.beginPath(); ctx.arc(cx + p[0] * r + r * 0.2, cy + p[1] * r - r * 0.22, p[2] * r * 0.62, 0, TAU); ctx.fill(); } }
    if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx + r * 0.18, cy - r * 0.1, r * 1.0, Math.PI * 1.1, Math.PI * 1.72); ctx.stroke(); }
  }

  // crête d'herbe à festons RÉGULIERS (propre) + liseré net
  function grassTop(x, w, topY, lo, hi, rim) {
    const step = 26, bump = 9;
    ctx.beginPath();
    ctx.moveTo(x, topY + 24); ctx.lineTo(x, topY);
    for (let xx = x; xx < x + w - 0.1; xx += step) ctx.quadraticCurveTo(xx + step / 2, topY - bump, Math.min(xx + step, x + w), topY);
    ctx.lineTo(x + w, topY + 24); ctx.closePath();
    const g = ctx.createLinearGradient(0, topY - bump, 0, topY + 24);
    g.addColorStop(0, hi); g.addColorStop(1, lo);
    ctx.fillStyle = g; ctx.fill();
    if (rim) {
      ctx.strokeStyle = rim; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = rim; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(x, topY);
      for (let xx = x; xx < x + w - 0.1; xx += step) ctx.quadraticCurveTo(xx + step / 2, topY - bump, Math.min(xx + step, x + w), topY);
      ctx.stroke(); ctx.shadowBlur = 0;
    }
  }

  // collines douces (ancrées sur l'horizon, parallaxe horizontale)
  function drawHills(par, dyAbove, amp, wl, ph, color, rimAlpha) {
    const base = (GROUND_Y - cam.y) - dyAbove, off = cam.x * par;
    const crest = (sx) => base - (0.5 + 0.5 * Math.sin((sx + off) / wl + ph)) * amp - (0.5 + 0.5 * Math.sin((sx + off) / (wl * 0.43) + ph * 1.7)) * amp * 0.4;
    ctx.beginPath(); ctx.moveTo(0, viewH + 4); ctx.lineTo(0, crest(0));
    for (let sx = 0; sx <= viewW; sx += 16) ctx.lineTo(sx, crest(sx));
    ctx.lineTo(viewW, viewH + 4); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    if (rimAlpha) { ctx.strokeStyle = rgbStr(P.groundRim, rimAlpha); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, crest(0)); for (let sx = 0; sx <= viewW; sx += 16) ctx.lineTo(sx, crest(sx)); ctx.stroke(); }
  }

  // arbre luxuriant (tronc effilé + canopée cel-shadée à 3 amas)
  function drawTree(x, baseY, scale, seed) {
    const h = 170 * scale, tw = 14 * scale;
    const tg = ctx.createLinearGradient(x - tw, 0, x + tw, 0);
    tg.addColorStop(0, rgbStr(P.stoneDk)); tg.addColorStop(0.5, rgbStr(P.stoneSh)); tg.addColorStop(1, rgbStr(P.stoneDk));
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(x - tw, baseY);
    ctx.quadraticCurveTo(x - tw * 0.5, baseY - h * 0.6, x - tw * 0.3, baseY - h);
    ctx.lineTo(x + tw * 0.3, baseY - h);
    ctx.quadraticCurveTo(x + tw * 0.5, baseY - h * 0.6, x + tw, baseY);
    ctx.closePath(); ctx.fill();
    const cr = 66 * scale, cy = baseY - h - 6 * scale, cx = x + (seed % 7 - 3);
    leafCloud(cx, cy + cr * 0.32, cr, rgbStr(P.foliageShadow), 0, 0);                                  // base sombre
    leafCloud(cx - cr * 0.1, cy, cr * 0.86, rgbStr(P.foliageShadow), rgbStr(P.foliageNear), 0);         // milieu 2 tons
    leafCloud(cx + cr * 0.15, cy - cr * 0.3, cr * 0.6, rgbStr(P.foliageNear), rgbStr(P.groundRim, 0.85), rgbStr(P.groundRim, 0.4)); // sommet éclairé
  }

  function drawFarCanopy() {
    // jungle lointaine brumeuse (perspective atmosphérique) : 3 couches de plus
    // en plus claires/bleutées vers le fond, stylisées.
    const haze = (t) => rgbStr(mixRgb(P.foliageFar, P.skyMid, t));
    drawHills(0.08, 42, 58, 340, 0.7, haze(0.6), 0);
    drawHills(0.14, 20, 80, 280, 1.3, haze(0.32), 0);
    drawHills(0.22, 0, 56, 205, 4.1, haze(0.04), 0.12);
  }

  function drawElephant() {
    // Grand Éléphant des Machines de l'île — horizontal en parallaxe (0.35x),
    // mais ancré verticalement sur l'horizon pour qu'il "domine" la scène.
    const sx = elephantX - cam.x * 0.35;
    if (sx < -360 || sx > viewW + 360) return;
    const by = viewH * 0.70;                 // ligne des pieds, fixe à l'écran
    const sil = rgbStr(mixRgb(P.foliageFar, { r: 38, g: 22, b: 40 }, 0.45), 0.97);
    const rim = rgbStr(P.sunHalo, 0.7);
    const win = rgbStr(P.accentGlow, 0.85);
    ctx.save(); ctx.translate(sx, by);

    // vapeur qui s'élève de la cheminée
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const t = (state.time * 0.18 + i * 0.27) % 1;
      ctx.fillStyle = rgbStr(P.sunCore, (1 - t) * 0.16);
      ctx.beginPath(); ctx.arc(70 + Math.sin(t * 6 + i) * 10, -300 - t * 150, 14 + t * 34, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = sil;

    // pattes articulées
    const lp = Math.sin(state.time * 0.7);
    [-95, -35, 45, 105].forEach((lx, i) => { roundRect(lx + (i % 2 ? lp : -lp) * 4, -150, 40, 152, 14); ctx.fill(); });
    // corps massif
    ctx.beginPath(); ctx.ellipse(20, -210, 165, 100, 0, 0, TAU); ctx.fill();
    // tête
    ctx.beginPath(); ctx.ellipse(-150, -225, 78, 80, 0, 0, TAU); ctx.fill();
    // trompe enroulée
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = sil; ctx.lineWidth = 34;
    ctx.beginPath(); ctx.moveTo(-205, -235);
    ctx.bezierCurveTo(-265, -210, -250, -90, -210, -55);
    ctx.bezierCurveTo(-190, -38, -165, -55, -178, -78); ctx.stroke();
    // défense
    ctx.strokeStyle = rgbStr(P.sunCore, 0.8); ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-200, -175); ctx.quadraticCurveTo(-220, -150, -210, -120); ctx.stroke();
    // oreille qui bat
    ctx.fillStyle = sil;
    const ear = Math.sin(state.time * 0.9) * 0.12;
    ctx.save(); ctx.translate(-120, -220); ctx.rotate(ear);
    ctx.beginPath(); ctx.ellipse(0, 0, 52, 64, 0.25, 0, TAU); ctx.fill(); ctx.restore();
    // œil chaud
    ctx.fillStyle = win; ctx.beginPath(); ctx.arc(-175, -235, 5, 0, TAU); ctx.fill();

    // nacelle / howdah à étages
    ctx.fillStyle = sil;
    roundRect(-70, -360, 200, 95, 12); ctx.fill();   // pont principal
    roundRect(-20, -440, 110, 90, 10); ctx.fill();   // cabine haute
    roundRect(30, -510, 44, 78, 6); ctx.fill();       // cheminée
    // rambarde de la terrasse
    ctx.strokeStyle = rim; ctx.lineWidth = 3;
    for (let x = -64; x <= 124; x += 22) { ctx.beginPath(); ctx.moveTo(x, -360); ctx.lineTo(x, -376); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-66, -376); ctx.lineTo(126, -376); ctx.stroke();
    // hublots éclairés
    ctx.fillStyle = win;
    for (let x = -45; x <= 110; x += 38) { ctx.beginPath(); ctx.arc(x, -315, 7, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(35, -400, 9, 0, TAU); ctx.fill();
    // engrenages qui tournent (flanc)
    drawGear(95, -200, 30, state.time * 0.7, rim);
    drawGear(135, -175, 18, -state.time * 1.1, rim);
    // liseré chaud sur le dos
    ctx.strokeStyle = rim; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(20, -210, 165, 100, 0, Math.PI * 1.04, Math.PI * 1.98); ctx.stroke();

    ctx.restore();
  }

  function drawGear(x, y, r, rot, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, a2 = a + TAU / 16;
      ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
      ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // colonne de ruine en pierre (fond) — chapiteau cassé, mousse, liane
  function drawRuinBg(x, baseY, scale) {
    const w = 44 * scale, h = (150 + (x | 0) % 40) * scale, topY = baseY - h;
    ctx.save(); roundRect(x - w / 2, topY, w, h + 8, 5); ctx.clip();
    stoneBody(x - w / 2 - 2, topY, w + 4, h + 12);
    ctx.restore();
    // sommet cassé en biais
    ctx.fillStyle = rgbStr(P.stoneSh);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, topY + 2);
    ctx.quadraticCurveTo(x, topY - 12 * scale, x + w / 2, topY + 6);
    ctx.lineTo(x + w / 2, topY + 12); ctx.lineTo(x - w / 2, topY + 12);
    ctx.closePath(); ctx.fill();
    // mousse + liane sur la ruine
    mossDrape(x - w / 2, w, topY + 2);
    vineHang(x + w / 2 - 8, topY + 28, 34 * scale);
  }

  function drawMidTrees() {
    const baseY = GROUND_Y - cam.y - 2;       // racine sur l'horizon
    const par = 0.35, off = cam.x * par;
    const x0 = off - 200, x1 = off + viewW + 200;
    for (let wx = Math.floor(x0 / 250) * 250; wx < x1; wx += 250) {
      if (Math.abs(wx - elephantX) < 240) continue;   // place pour l'éléphant
      if (hashNoise(wx * 1.7 + 3) > 0.76) drawRuinBg(wx - off, baseY, 0.86 + hashNoise(wx) * 0.4);
      else drawTree(wx - off, baseY, 0.9 + hashNoise(wx) * 0.55, wx | 0);
    }
  }

  function drawRiver() {
    if (cam.x > RIVER_X1 + 200 || cam.x + viewW < RIVER_X0 - 200) return;
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    const wy = GROUND_Y + 8;
    const x0 = RIVER_X0 - 60, x1 = RIVER_X1 + 60, ww = x1 - x0, depth = 270;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, wy, ww, depth); ctx.clip();
    if (imgReady(IMG.water)) {
      // eau PEINTE : texture tuilée qui défile doucement
      const th = depth, tw = IMG.water.naturalWidth * (th / IMG.water.naturalHeight);
      const scroll = (state.time * 12) % tw;
      for (let xx = x0 - tw; xx < x1 + tw; xx += tw) ctx.drawImage(IMG.water, xx - scroll, wy, tw, th);
    } else {
      const g = ctx.createLinearGradient(0, wy, 0, wy + 230);
      g.addColorStop(0, '#8fe6ea'); g.addColorStop(0.28, '#4fbcd4'); g.addColorStop(1, '#2b6f9e');
      ctx.fillStyle = g; ctx.fillRect(x0, wy, ww, depth);
    }
    // reflet de ciel près de la surface + ondulations
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createLinearGradient(0, wy, 0, wy + 56);
    sg.addColorStop(0, 'rgba(255,255,255,0.28)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(x0, wy, ww, 56);
    for (let i = 0; i < 5; i++) {
      const ry = wy + 18 + i * 28, phase = state.time * 1.2 + i;
      ctx.strokeStyle = 'rgba(231,255,255,' + (0.12 - i * 0.02) + ')'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = x0; x < x1; x += 18) { const yy = ry + Math.sin(x * 0.045 + phase) * 3.2; x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    ctx.restore();
  }

  function drawPlatform(s) {
    if (s.type === 'floor') return drawFloorImg(s);
    if (s.type === 'bough') return drawBoughImg(s);
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    if (s.type === 'lily') drawLily(s);
    else if (s.type === 'bounce') drawBounce(s);
    ctx.restore();
  }

  // pierre texturée (joints de blocs)
  function stoneBody(x, topY, w, h) {
    const g = ctx.createLinearGradient(0, topY, 0, topY + h);
    g.addColorStop(0, rgbStr(P.stone)); g.addColorStop(0.5, rgbStr(P.stoneSh)); g.addColorStop(1, rgbStr(P.stoneDk));
    ctx.fillStyle = g; ctx.fillRect(x, topY, w, h);
    ctx.strokeStyle = rgbStr(P.stoneDk, 0.45); ctx.lineWidth = 2;
    let row = 0;
    for (let yy = topY + 44; yy < topY + h; yy += 44, row++) {
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
      for (let xx = x + ((row % 2) ? 110 : 54); xx < x + w; xx += 112) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, Math.min(yy + 44, topY + h)); ctx.stroke(); }
    }
    // ombre douce juste sous la mousse
    ctx.fillStyle = rgbStr(P.stoneDk, 0.22); ctx.fillRect(x, topY, w, 10);
  }

  // mousse verte épaisse drapée sur le rebord (signature graphique peinte)
  function mossDrape(x, w, topY) {
    const step = 32;
    const g = ctx.createLinearGradient(0, topY - 14, 0, topY + 30);
    g.addColorStop(0, rgbStr(P.foliageNear)); g.addColorStop(1, rgbStr(P.foliageShadow));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    for (let xx = x; xx < x + w - 0.1; xx += step) ctx.quadraticCurveTo(xx + step / 2, topY - 13, Math.min(xx + step, x + w), topY);
    ctx.lineTo(x + w, topY + 8);
    for (let xx = x + w; xx > x + 0.1; xx -= step) {
      const lobe = topY + 18 + ((((xx - x) / step) | 0) % 3 === 0 ? 12 : 0);
      ctx.quadraticCurveTo(xx - step / 2, lobe, Math.max(xx - step, x), topY + 8);
    }
    ctx.closePath(); ctx.fill();
    // liseré clair lumineux sur la crête
    ctx.strokeStyle = rgbStr(P.groundRim); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = rgbStr(P.groundRim); ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(x, topY);
    for (let xx = x; xx < x + w - 0.1; xx += step) ctx.quadraticCurveTo(xx + step / 2, topY - 13, Math.min(xx + step, x + w), topY);
    ctx.stroke(); ctx.shadowBlur = 0;
    // touffes d'herbe qui dépassent
    ctx.strokeStyle = rgbStr(P.foliageNear); ctx.lineWidth = 2.4;
    for (let xx = x + 18; xx < x + w - 6; xx += step * 1.5) {
      for (let b = -1; b <= 1; b++) { ctx.beginPath(); ctx.moveTo(xx + b * 4, topY - 5); ctx.quadraticCurveTo(xx + b * 7, topY - 20, xx + b * 9 + 2, topY - 27); ctx.stroke(); }
    }
  }

  // liane pendante avec feuilles (sous les plateformes / rebords)
  function vineHang(vx, vy, len) {
    const sway = Math.sin(state.time * 1.1 + vx * 0.05) * 6;
    ctx.strokeStyle = rgbStr(P.foliageShadow); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(vx, vy); ctx.quadraticCurveTo(vx + sway * 0.5, vy + len * 0.5, vx + sway, vy + len); ctx.stroke();
    ctx.fillStyle = rgbStr(P.foliageNear, 0.92);
    for (let k = 1; k <= 3; k++) { const t = k / 3.3, lx = vx + sway * t, ly = vy + len * t; ctx.save(); ctx.translate(lx, ly); ctx.rotate(k % 2 ? 0.7 : -0.7); ctx.beginPath(); ctx.ellipse(5, 0, 7, 3.4, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    // bourgeon au bout
    ctx.fillStyle = rgbStr(P.foliageNear); ctx.beginPath(); ctx.arc(vx + sway, vy + len, 3, 0, TAU); ctx.fill();
  }

  function drawFloor(s) {
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    const x = Math.max(s.x, cam.x - 60), w = Math.min(s.x + s.w, cam.x + viewW + 60) - x;
    if (w <= 0) { ctx.restore(); return; }
    stoneBody(x, s.y + 6, w, 340);
    mossDrape(x, w, s.y);
    ctx.restore();
  }

  function drawBough(s) {
    const x = s.x, y = s.y, w = s.w;
    // bloc de pierre arrondi
    ctx.save();
    roundRect(x, y + 4, w, s.h + 26, 12); ctx.clip();
    stoneBody(x - 2, y + 4, w + 4, s.h + 34);
    ctx.restore();
    // lianes sous la plateforme
    vineHang(x + 18, y + s.h + 22, 34 + (x | 0) % 22);
    vineHang(x + w - 22, y + s.h + 22, 28 + (x | 0) % 18);
    // mousse drapée sur le dessus
    mossDrape(x, w, y);
  }

  function drawLily(s) {
    const cx = s.x + s.w / 2, cy = s.y;
    // si un nénuphar PEINT est fourni (assets/lilypad.png), on l'utilise
    if (imgReady(IMG.lily)) {
      const tw = s.w * 1.18, scale = tw / IMG.lily.naturalWidth, h = IMG.lily.naturalHeight * scale;
      ctx.drawImage(IMG.lily, cx - tw / 2, cy + 6 - h * 0.46, tw, h);   // surface du pad ~ s.y
      return;
    }
    // fallback procédural propre
    const g = ctx.createRadialGradient(cx - s.w * 0.16, cy - 4, 2, cx, cy + 3, s.w * 0.5);
    g.addColorStop(0, '#5fc24e'); g.addColorStop(1, '#2f7a3a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, s.w * 0.5, s.w * 0.26, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,60,30,0.5)'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx + i * s.w * 0.17, cy + 4 - s.w * 0.2 + Math.abs(i) * 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(180,255,150,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, s.w * 0.5, s.w * 0.26, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ff9ecf'; ctx.beginPath(); ctx.arc(cx + s.w * 0.22, cy, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe07a'; ctx.beginPath(); ctx.arc(cx + s.w * 0.22, cy, 1.8, 0, TAU); ctx.fill();
  }

  function drawBounce(s) {
    const cx = s.x + s.w / 2, cy = s.y;
    const pulse = 1 + Math.sin(state.time * 4) * 0.06;
    // tige
    ctx.strokeStyle = rgbStr(P.foliageNear); ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx, cy + 40); ctx.lineTo(cx, cy); ctx.stroke();
    // cloche lumineuse
    ctx.save(); ctx.translate(cx, cy); ctx.scale(pulse, pulse);
    const g = ctx.createRadialGradient(0, -4, 2, 0, -4, 34);
    g.addColorStop(0, rgbStr(P.petal)); g.addColorStop(1, rgbStr(P.hair, 0.7));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-34, 2); ctx.quadraticCurveTo(0, -34, 34, 2); ctx.quadraticCurveTo(0, 14, -34, 2); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgbStr(P.accentGlow, 0.3); ctx.beginPath(); ctx.arc(0, -2, 30, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function drawProps(layer) {
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (p.x < cam.x - 120 || p.x > cam.x + viewW + 120) continue;
      if (p.type === 'ring') {                     // vieilli dans update(), dessiné une seule fois
        if (layer !== 'front') continue;
        const k = p.t / p.life;
        ctx.strokeStyle = rgbStr(P.groundRim, (1 - k) * 0.6); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 6 + k * 46, (6 + k * 46) * 0.35, 0, 0, TAU); ctx.stroke();
        continue;
      }
      if (layer === 'back' && p.type === 'exotic') drawExotic(p);
      if (layer === 'back' && p.type === 'bush') drawBush(p);
      if (layer === 'back' && p.type === 'rock') drawRock(p);
      if (layer === 'front' && p.type === 'fern') drawFern(p);
      if (layer === 'front' && p.type === 'tuft' && !p.hidden) drawTuft(p);
      if (layer === 'front' && p.type === 'mushroom') drawMushroom(p);
      if (layer === 'front' && p.type === 'flower') drawFlower(p);
    }
    ctx.restore();
  }

  function drawMushroom(p) {
    const x = p.x, baseY = p.y, h = p.h, capW = h * 0.95;
    // pied
    ctx.fillStyle = '#F3ECD8';
    ctx.beginPath(); ctx.moveTo(x - h * 0.22, baseY); ctx.quadraticCurveTo(x - h * 0.16, baseY - h * 0.7, x - h * 0.18, baseY - h);
    ctx.lineTo(x + h * 0.18, baseY - h); ctx.quadraticCurveTo(x + h * 0.16, baseY - h * 0.7, x + h * 0.22, baseY); ctx.closePath(); ctx.fill();
    // chapeau (rouge/orangé, dégradé)
    const cy = baseY - h;
    const g = ctx.createLinearGradient(0, cy - capW * 0.55, 0, cy + 4);
    g.addColorStop(0, '#FF7A4D'); g.addColorStop(1, '#E0452E');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - capW, cy + 2); ctx.quadraticCurveTo(x, cy - capW * 0.85, x + capW, cy + 2); ctx.quadraticCurveTo(x, cy + capW * 0.34, x - capW, cy + 2); ctx.fill();
    // points blancs
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    [[-0.4, -0.18, 0.13], [0.28, -0.28, 0.11], [0.02, -0.46, 0.1], [0.5, -0.02, 0.08], [-0.66, 0.02, 0.07]].forEach((d) => { ctx.beginPath(); ctx.arc(x + d[0] * capW, cy + d[1] * capW, d[2] * capW, 0, TAU); ctx.fill(); });
  }

  function drawRock(p) {
    const x = p.x, baseY = p.y, r = p.r;
    const g = ctx.createLinearGradient(0, baseY - r, 0, baseY + 2);
    g.addColorStop(0, rgbStr(P.stone)); g.addColorStop(1, rgbStr(P.stoneDk));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - r, baseY); ctx.quadraticCurveTo(x - r * 0.9, baseY - r, x - r * 0.1, baseY - r * 0.95);
    ctx.quadraticCurveTo(x + r * 0.95, baseY - r * 0.85, x + r, baseY); ctx.closePath(); ctx.fill();
    // calotte de mousse
    ctx.fillStyle = rgbStr(P.foliageNear, 0.9);
    ctx.beginPath(); ctx.moveTo(x - r * 0.78, baseY - r * 0.55); ctx.quadraticCurveTo(x, baseY - r * 1.05, x + r * 0.78, baseY - r * 0.5);
    ctx.quadraticCurveTo(x + r * 0.4, baseY - r * 0.62, x, baseY - r * 0.6); ctx.quadraticCurveTo(x - r * 0.4, baseY - r * 0.6, x - r * 0.78, baseY - r * 0.55); ctx.fill();
  }

  function drawFern(p) {
    const x = p.x, baseY = p.y, h = p.h, dir = p.dir || 1;
    const sway = Math.sin(state.time * 0.8 + p.sway) * 0.12;
    // plusieurs frondes en éventail
    for (let i = -2; i <= 2; i++) {
      const ang = -Math.PI / 2 + i * 0.42 * dir + sway;
      const len = h * (1 - Math.abs(i) * 0.13);
      ctx.save(); ctx.translate(x, baseY); ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, rgbStr(P.foliageShadow)); g.addColorStop(1, rgbStr(P.foliageNear));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.16, len, 0); ctx.quadraticCurveTo(len * 0.5, len * 0.16, 0, 0); ctx.fill();
      // foliole nervure
      ctx.strokeStyle = rgbStr(P.foliageShadow, 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.9, 0); ctx.stroke();
      ctx.restore();
    }
  }

  function drawBush(p) {
    leafCloud(p.x, p.y - p.r * 0.42, p.r, rgbStr(P.foliageShadow), rgbStr(P.foliageNear, 0.92), rgbStr(P.groundRim, 0.32));
  }

  function drawExotic(p) {
    const sway = Math.sin(state.time * 0.9 + p.sway) * 6;
    const bx = p.x, by = p.y, tx = bx + sway, ty = by - p.h;
    // tige courbe
    ctx.strokeStyle = rgbStr(P.foliageShadow); ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sway * 0.5 - 12, by - p.h * 0.5, tx, ty); ctx.stroke();
    // grandes feuilles le long de la tige
    ctx.fillStyle = rgbStr(P.foliageNear, 0.92);
    for (let t = 0.28; t < 0.85; t += 0.28) {
      const lx = lerp(bx, tx, t), ly = lerp(by, ty, t);
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(lx, ly); ctx.rotate(s * 0.7); ctx.beginPath(); ctx.ellipse(s * 14, 0, 20, 7, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    }
    // tête florale exotique
    if (p.kind === 0) {                          // grande fleur à pétales recourbés
      ctx.fillStyle = rgbStr(P.petal);
      for (let i = 0; i < 7; i++) { ctx.save(); ctx.translate(tx, ty); ctx.rotate(i / 7 * TAU + state.time * 0.1);
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(11, -22, 0, -36); ctx.quadraticCurveTo(-11, -22, 0, 4); ctx.fill(); ctx.restore(); }
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgbStr(P.accentGlow, 0.5); ctx.beginPath(); ctx.arc(tx, ty, 12, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgbStr(P.sunHalo); ctx.beginPath(); ctx.arc(tx, ty, 7, 0, TAU); ctx.fill();
    } else if (p.kind === 1) {                   // grappe de bulbes pendants
      for (let i = 0; i < 5; i++) { const dx = (i - 2) * 10, dy = Math.abs(i - 2) * 7;
        ctx.fillStyle = rgbStr(P.petal); ctx.beginPath(); ctx.ellipse(tx + dx, ty + dy, 7, 12, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(tx + dx - 2, ty + dy - 4, 2.4, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = rgbStr(P.accentGlow, 0.85); ctx.beginPath(); ctx.arc(tx + dx, ty + dy + 9, 1.6, 0, TAU); ctx.fill(); }
    } else {                                     // éventail de pétales pointus (violet)
      for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(tx, ty); ctx.rotate(-1.25 + i * 0.5);
        const grd = ctx.createLinearGradient(0, 0, 0, -46); grd.addColorStop(0, rgbStr(P.petal)); grd.addColorStop(1, rgbStr(P.hair));
        ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(-5, 2); ctx.quadraticCurveTo(0, -48, 5, 2); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = rgbStr(P.accentGlow); ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.fill();
    }
  }

  function drawTuft(p) {
    const dx = (A.x + A.w / 2) - p.x;
    const bend = clamp(40 / (Math.abs(dx) + 8), 0, 1) * Math.sign(dx) * -18 + Math.sin(state.time + p.seed) * 3;
    ctx.strokeStyle = rgbStr(P.foliageNear); ctx.lineWidth = 3 * p.scale; ctx.lineCap = 'round';
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath(); ctx.moveTo(p.x + b * 6, p.y);
      ctx.quadraticCurveTo(p.x + b * 8 + bend * 0.5, p.y - 14 * p.scale, p.x + b * 5 + bend, p.y - 26 * p.scale);
      ctx.stroke();
    }
  }

  function drawFlower(p) {
    const sway = Math.sin(state.time * 1.2 + p.sway) * 5;
    const tx = p.x + sway, ty = p.y - p.h;
    ctx.strokeStyle = rgbStr(P.foliageNear); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + sway * 0.5, p.y - p.h * 0.5, tx, ty); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgbStr(P.accentGlow, 0.25); ctx.beginPath(); ctx.arc(tx, ty, 14, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgbStr(P.petal);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + state.time * 0.2; ctx.beginPath(); ctx.ellipse(tx + Math.cos(a) * 7, ty + Math.sin(a) * 7, 5, 8, a, 0, TAU); ctx.fill(); }
    ctx.fillStyle = rgbStr(P.accentGlow); ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.fill();
  }

  function drawCrown(cx, cy, w, fill, stroke) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, w * 0.26);
    ctx.lineTo(-w * 0.5, -w * 0.1);
    ctx.lineTo(-w * 0.24, w * 0.04);
    ctx.lineTo(0, -w * 0.34);
    ctx.lineTo(w * 0.24, w * 0.04);
    ctx.lineTo(w * 0.5, -w * 0.1);
    ctx.lineTo(w * 0.5, w * 0.26);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = stroke;
    [-w * 0.5, 0, w * 0.5].forEach((px) => { ctx.beginPath(); ctx.arc(px, -w * 0.13, 1.6, 0, TAU); ctx.fill(); });
    ctx.restore();
  }

  // étoile à 4 branches (brillance) remplie sur (x,y), rayon s
  function spark4(x, y, s) {
    const i = s * 0.26;
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + i, y - i); ctx.lineTo(x + s, y); ctx.lineTo(x + i, y + i);
    ctx.lineTo(x, y + s); ctx.lineTo(x - i, y + i); ctx.lineTo(x - s, y); ctx.lineTo(x - i, y - i);
    ctx.closePath(); ctx.fill();
  }

  // poussière d'étoiles : grains qui orbitent dans des SENS ALÉATOIRES. Rendu commun « orbe présent » / « résidu ».
  // front=true -> grains devant l'orbe, false -> derrière, null -> tous (résidu : pas d'orbe à masquer).
  function drawDust(o, oy, dia, rxf, ryf, front, amul) {
    amul = amul == null ? 1 : amul;
    // la grosse orbe finale garde des grains de la MÊME TAILLE que les orbes-projets, mais en plus grand NOMBRE (densité ∝ taille)
    const sc = (o.cta ? 40 : dia) / 90;
    const nb = o.cta ? Math.round((o.premium ? 14 : 10) * o.r / 24) : (o.premium ? 14 : 10);
    const rx = dia * rxf, ry = dia * ryf;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < nb; i++) {
      const h1 = Math.sin((i + 1) * 12.9898) * 43758.5453, h2 = Math.sin((i + 1) * 78.233) * 43758.5453;
      const dir = (h1 - Math.floor(h1)) < 0.5 ? -1 : 1;           // sens aléatoire par grain
      const spd = 0.25 + 0.6 * (h2 - Math.floor(h2));             // vitesse aléatoire
      const a = i * 1.7 + dir * o.spin * spd, s = Math.sin(a);
      if (front != null && (s >= 0) !== front) continue;
      const rr = 0.6 + 0.5 * ((i * 3) % 11) / 11;
      const br = 1 + 0.12 * Math.sin(o.bob * 0.7 + i * 2.1);
      const x = o.x + Math.cos(a) * rx * rr * br, y = oy + s * ry * rr * br;
      const depth = front == null ? 0.85 : 0.45 + 0.55 * (0.5 + 0.5 * s);
      const tw = 0.5 + 0.5 * Math.sin(o.pulse * 0.5 + i * 2.3);
      const al = (0.09 + 0.22 * tw) * depth * amul;
      const ms = (1.0 + 0.9 * depth) * sc;
      // ÉTOILE qui orbite (remplace les 2 ronds ambre) : taille ∝ profondeur, scintille via tw
      drawStar(x, y, Math.max(9, ms * 7), al * 2.4, a * 1.3 + i, i % 3);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // VORTEX de particules (sprite « Particles ») : un champ de particules dorées s'amasse
  // de tous les sens vers le centre puis se REJOINT à la naissance de l'orbe (au HOP).
  // Remplace l'ancien vortex procédural drawGatherStars (gardé plus bas, mais plus appelé).
  // Dessiné en additif -> le fond noir des frames disparaît, seules les particules ressortent.
  function drawGatherParticles(o) {
    const b = state.boss; if (!b) return;
    const sp = PARTICLES.sp; if (!sp || !sp.ready || !sp.img.naturalWidth) return;
    const HOP = BOSS_T.zoom + BOSS_T.tremor + BOSS_T.flash + BOSS_T.hop;
    const gp = clamp(b.t / HOP, 0, 1);
    if (gp >= 1) return;                                    // après la naissance : plus d'afflux
    const fr = Math.min(PARTICLES.frames - 1, (gp * PARTICLES.frames) | 0);   // convergence calée sur la naissance
    const sx = (fr % PARTICLES.cols) * PARTICLES.fw, sy = ((fr / PARTICLES.cols) | 0) * PARTICLES.fh;   // position dans la grille
    const sz = o.r * 2.4;                                   // champ resserré autour du coeur (réduit ~70%)
    const fadeIn = clamp(gp / 0.08, 0, 1);                  // apparition douce au tout début
    // source-over (et non additif) : le sprite a un vrai canal alpha (fond transparent).
    // L'additif accumulait jusqu'au blanc sur le champ dense -> ici l'or reste de l'or.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.85 * fadeIn;
    ctx.drawImage(sp.img, sx, sy, PARTICLES.fw, PARTICLES.fh, o.x - sz / 2, o.baseY - sz / 2, sz, sz);
    ctx.globalAlpha = 1;
  }

  // [LEGACY, plus appelé] ancien vortex procédural (grains + traits). Remplacé par
  // drawGatherParticles (sprite « Particles »). Conservé pour référence / retour arrière.
  function drawGatherStars(o, cx, cy) {
    const b = state.boss; if (!b) return;
    const HOP = BOSS_T.zoom + BOSS_T.tremor + BOSS_T.flash + BOSS_T.hop;
    const gp = clamp(b.t / HOP, 0, 1);
    if (gp >= 1) return;                                   // après l'apparition : plus d'afflux
    ctx.globalCompositeOperation = 'lighter';
    const N = 220, outerR = o.r * 3.6, gsc = 40 / 90;      // vortex dense (Steven l'a validé) : plein de petits grains qui spiralent
    for (let i = 0; i < N; i++) {
      const r1 = Math.sin((i + 1) * 12.9898) * 43758.5453, r2 = Math.sin((i + 1) * 78.233) * 43758.5453,
            r3 = Math.sin((i + 1) * 37.719) * 43758.5453, r4 = Math.sin((i + 1) * 51.13) * 43758.5453;
      const f1 = r1 - Math.floor(r1), f2 = r2 - Math.floor(r2), f3 = r3 - Math.floor(r3), f4 = r4 - Math.floor(r4);
      const s0 = f3 * 0.78;                                 // entrée échelonnée -> afflux continu
      const prog = clamp((gp - s0) / (1 - s0), 0, 1);
      if (prog <= 0.001) continue;
      const e = 1 - Math.pow(1 - prog, 2.2);                // accélère en arrivant au centre
      const wind = e * 5.2;                                 // s'enroule de plus en plus en spiralant vers le coeur
      const ang = f1 * TAU + wind + b.t * 0.9;              // VORTEX : tout tourne dans le MÊME sens (bras de spirale)
      const rad = outerR * (1 - e) * (0.55 + 0.6 * f4);
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad * 0.92;
      const tw = 0.55 + 0.45 * Math.sin(b.t * 9 + i * 1.3);
      const al = (0.2 + 0.8 * prog) * tw, ms = (0.7 + 0.5 * prog) * gsc;
      // traînée INCURVÉE : LE TRAIT qui file vers le centre (là d'où l'étoile vient, un poil plus loin / moins enroulé)
      const ang2 = f1 * TAU + wind * 0.84 + b.t * 0.9, rad2 = rad * 1.18;
      const x2 = cx + Math.cos(ang2) * rad2, y2 = cy + Math.sin(ang2) * rad2 * 0.92;
      ctx.strokeStyle = `rgba(255,240,195,${(al * 0.42).toFixed(3)})`; ctx.lineWidth = Math.max(0.5, ms * 0.9);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();   // le TRAIT du tourbillon (à garder)
      ctx.fillStyle = `rgba(255,255,245,${al.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, ms, 0, TAU); ctx.fill();
    }
    // coeur lumineux qui se densifie à mesure que les étoiles s'amassent
    const cr = o.r * (0.4 + 0.7 * gp), ca = 0.12 + 0.5 * gp * gp;
    const hg = ctx.createRadialGradient(cx, cy, 1, cx, cy, cr);
    hg.addColorStop(0, rgbStr(P.accentGlow, ca)); hg.addColorStop(0.6, rgbStr(P.accentGlow, ca * 0.4)); hg.addColorStop(1, rgbStr(P.accentGlow, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // onde de choc dorée propre à l'apparition de l'orbe finale (remplace la projection de terre)
  function drawBossRing(o) {
    const b = state.boss; if (!b || b.ring == null || b.ring >= 1) return;
    const rp = b.ring, e = 1 - Math.pow(1 - rp, 1.8);        // s'étale plus doucement
    const rr = o.r * (0.7 + 2.4 * e);                        // rayon du sprite d'anneau, plus contenu
    const cnv = getSoft(FX.ring, rgbStr(P.accentGlow), 0.03);   // anneau FLOUTÉ -> souffle diffus, pas un cerceau net
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - rp) * (1 - rp) * 0.20;            // souffle de lumière à peine perceptible, qui s'évanouit
    if (cnv) { ctx.drawImage(cnv, o.x - rr, o.baseY - rr, rr * 2, rr * 2); }
    else { ctx.lineWidth = o.r * 0.04; ctx.strokeStyle = rgbStr(P.accentGlow); ctx.beginPath(); ctx.arc(o.x, o.baseY, rr, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // flare doré (sprite de rayons FLOUTÉ) qui jaillit au boom, grossit puis s'estompe : lumière diffuse, pas un sprite-étoile net
  function drawBossFlare(o) {
    const b = state.boss; if (!b || b.flareT == null || b.flareT >= 1) return;
    const cnv = getSoft(FX.flare, rgbStr(P.sunHalo), 0.045);
    if (!cnv) return;
    const ft = b.flareT, pop = ft < 0.18 ? ft / 0.18 : 1;
    const sz = o.r * (1.4 + 3.0 * (1 - Math.pow(1 - ft, 2)));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - ft) * (1 - ft) * pop * 0.32;     // impulsion de naissance discrète, sans coup de projecteur
    ctx.save(); ctx.translate(o.x, o.baseY); ctx.rotate(b.flareRot || 0);
    ctx.drawImage(cnv, -sz / 2, -sz / 2, sz, sz); ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // SHOCKWAVE (sprite-sheet 16:9, recoloré chaud) : explosion d'énergie jouée UNE FOIS
  // au boom, quand l'orbe surgit. Additif (fond noir -> disparaît). Le burst s'étale et
  // s'estompe DANS les frames ; léger fondu de sortie en plus pour fondre dans la lumière.
  function drawBossShockwave(o) {
    const b = state.boss; if (!b || b.shockT == null || b.shockT >= 1) return;
    const sp = SHOCKWAVE.sp; if (!sp || !sp.ready || !sp.img.naturalWidth) return;
    const p = b.shockT;
    const fr = Math.min(SHOCKWAVE.frames - 1, (p * SHOCKWAVE.frames) | 0);
    const sx = (fr % SHOCKWAVE.cols) * SHOCKWAVE.fw, sy = ((fr / SHOCKWAVE.cols) | 0) * SHOCKWAVE.fh;   // position dans la grille
    const w = o.r * 8.0, h = w * SHOCKWAVE.fh / SHOCKWAVE.fw;   // 16:9, rayonne bien au-delà de l'orbe
    const fade = p > 0.6 ? clamp((1 - p) / 0.4, 0, 1) : 1;      // fondu de sortie discret
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7 * fade;
    ctx.drawImage(sp.img, sx, sy, SHOCKWAVE.fw, SHOCKWAVE.fh, o.x - w / 2, o.baseY - h / 2, w, h);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // une LECTURE en boucle du flash sur une fenêtre [t0,t1] : `loops` passages, taille
  // `sz`, opacité `alpha`. Sprite-sheet déjà recoloré chaud -> additif + transparent.
  function flash19Window(o, sp, t0, t1, loops, sz, alpha) {
    const b = state.boss; if (b.t < t0 || b.t >= t1) return;
    const loopDur = (t1 - t0) / loops;
    const local = b.t - t0;
    const inLoop = local - Math.floor(local / loopDur) * loopDur;
    const fr = Math.min(FLASH19.frames - 1, ((inLoop / loopDur) * FLASH19.frames) | 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.img, fr * FLASH19.fw, 0, FLASH19.fw, FLASH19.fh, o.x - sz / 2, o.baseY - sz / 2, sz, sz);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // FLASH d'énergie « Flash 19 » au CENTRE de l'orbe finale, en additif très transparent
  // (fusionne avec la lumière dorée). Deux temps :
  //   • 3 flashs PENDANT L'ASPIRATION, en DÉGRADÉ de taille (tout petit -> petit ->
  //     ~60% de l'ancienne taille), calés sur le vortex de particules
  //   • 2 grands flashs juste avant la naissance (phase 2bis de tickBoss)
  function drawBossFlash19(o) {
    const b = state.boss; if (!b) return;
    const sp = FLASH19.sp; if (!sp || !sp.ready || !sp.img.naturalWidth) return;
    const TR = BOSS_T.zoom + BOSS_T.tremor, FL = TR + BOSS_T.flash;
    const e = TR / 3;                                    // chaque éclair occupe un tiers de l'aspiration
    flash19Window(o, sp, 0,      e,     1, o.r * 0.95, 0.42);   // 1er : tout petit
    flash19Window(o, sp, e,      2 * e, 1, o.r * 1.50, 0.42);   // 2e : un peu plus gros
    flash19Window(o, sp, 2 * e,  TR,    1, o.r * 2.05, 0.42);   // 3e : ~60% de l'ancien (3.4)
    flash19Window(o, sp, TR, FL, 2, o.r * 2.05, 0.42);  // 4e + 5e (avant la naissance) : MÊME taille que le 3e
  }

  // ===== « NAISSANCE DE LUMIÈRE » : courbes d'intensité de chaque temps de l'apparition finale =====
  function bossCharge() {            // le monde se concentre/s'assombrit (0 -> 1 au boom -> 0) : profondeur + focus
    const b = state.boss; if (!b) return 0;
    const HOP = BOSS_T.zoom + BOSS_T.tremor + BOSS_T.flash + BOSS_T.hop, DU = HOP + BOSS_T.dust;
    if (b.t < HOP) return Math.pow(clamp(b.t / HOP, 0, 1), 1.4);          // le monde retient son souffle
    return clamp(1 - (b.t - HOP) / (DU - HOP), 0, 1);                     // puis la lumière revient (re-warm)
  }
  function bossPillar() {            // colonne de lumière : pré-lueur pendant le vortex -> plein éclat à la naissance -> s'efface
    const b = state.boss; if (!b) return 0;
    const TR = BOSS_T.zoom + BOSS_T.tremor, HOP = TR + BOSS_T.flash + BOSS_T.hop, DU = HOP + BOSS_T.dust;
    if (b.t < TR) return clamp((b.t - (TR - 1.0)) / 1.0, 0, 1) * 0.42;    // la colonne descend pendant le tourbillon
    if (b.t < HOP) return 0.42 + 0.58 * clamp((b.t - TR) / (HOP - TR), 0, 1);
    return clamp(1 - (b.t - HOP) / (DU - HOP), 0, 1);
  }
  function bossRays() {              // god rays : baignent l'orbe APRÈS la naissance, persistants jusqu'à la fin
    const b = state.boss; if (!b) return 0;
    const HOP = BOSS_T.zoom + BOSS_T.tremor + BOSS_T.flash + BOSS_T.hop;
    if (b.t < HOP) return 0;
    const up = clamp((b.t - HOP) / 0.45, 0, 1);
    // les rayons RESTENT tant que le dialogue de fin est à l'écran, puis s'effacent
    // AVEC lui (suivent son fondu de sortie) ; repli sur le minutage fixe si pas de réplique.
    const s = state.speech;
    let out;
    if (s) out = 1 - (s.out || 0);
    else { const HO = HOP + BOSS_T.dust + BOSS_T.settle + BOSS_T.hold; out = clamp(1 - (b.t - (HO - 0.5)) / 0.5, 0, 1); }
    return up * out;
  }
  // colonne de lumière verticale d'où naît l'orbe (calque DERRIÈRE l'orbe)
  function drawBossPillar(o) {
    const pil = bossPillar(); if (pil <= 0.01) return;
    const w = o.r * (0.45 + 0.5 * pil), h = o.r * 7.5;
    ctx.globalCompositeOperation = 'lighter';
    ctx.save(); ctx.translate(o.x, o.baseY); ctx.scale(1, h / w);          // un disque étiré -> faisceau vertical doux
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, w);
    g.addColorStop(0, rgbStr(P.sunHalo, 0.40 * pil));      // ambre (plus de coeur quasi-blanc sunCore)
    g.addColorStop(0.45, rgbStr(P.sunHalo, 0.18 * pil));
    g.addColorStop(1, rgbStr(P.sunHalo, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
  // god rays derrière l'orbe née : une LUEUR radiale chaude douce (qui assoit l'orbe dans la lumière)
  // + le sprite de rayons FLOUTÉ qui tourne lentement -> ça se fond, plus de sprite-étoile net derrière l'orbe.
  function drawBossRays(o) {
    const r = bossRays(); if (r <= 0.01) return;
    ctx.globalCompositeOperation = 'lighter';
    // 1) halo radial chaud diffus : le coeur de la lumière, sans aucune forme d'étoile
    const hr = o.r * 3.4;
    const hg = ctx.createRadialGradient(o.x, o.baseY, o.r * 0.3, o.x, o.baseY, hr);
    hg.addColorStop(0, rgbStr(P.sunHalo, r * 0.22));
    hg.addColorStop(0.5, rgbStr(P.accentGlow, r * 0.10));
    hg.addColorStop(1, rgbStr(P.accentGlow, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(o.x, o.baseY, hr, 0, TAU); ctx.fill();
    // 2) rayons très FLOUTÉS, faibles, qui tournent lentement -> ils se noient dans le halo (lumière peinte)
    const cnv = getSoft(FX.flare, rgbStr(P.sunHalo), 0.07);
    if (cnv) {
      const sz = o.r * 4.6 * (1 + 0.03 * Math.sin(state.time * 1.4));
      ctx.globalAlpha = r * 0.16;
      ctx.save(); ctx.translate(o.x, o.baseY); ctx.rotate(state.boss.t * 0.05);
      ctx.drawImage(cnv, -sz / 2, -sz / 2, sz, sz); ctx.restore();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // étoile dorée qui s'élève doucement autour de l'orbe née (mêmes étoiles que partout : mix
  // belle étoile / sparkle fin), monte avec une légère turbulence puis scintille en s'éteignant.
  function mote(x, y, r) {
    const big = rnd() < 0.4;
    spawn(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r * 0.6, (rnd() - 0.5) * 22, -(20 + rnd() * 40),
      1.4 + rnd() * 1.4, big ? 22 + rnd() * 14 : 14 + rnd() * 10, 0, 'lighter', -0.04,
      { tex: big ? FX.twinkle : FX.sparkle, tint: STAR_TINTS[(rnd() * 3) | 0],
        texA: 0.6 + rnd() * 0.3, grow: -0.3, drag: 0.7, turb: 6, rot: rnd() * TAU, spin: (rnd() - 0.5) * 2 });
  }

  function drawOrbs() {
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    for (const o of orbs) {
      if (o.x < cam.x - 120 || o.x > cam.x + viewW + 120) continue;
      const bob = Math.sin(o.bob * 1.5) * 8;
      const oy = o.baseY + bob;
      if (o.cta && state.boss) drawBossPillar(o);                   // colonne de lumière (calque le plus en arrière)
      if (o.cta && state.boss) drawGatherParticles(o);             // VORTEX de particules (sprite) qui s'amassent vers le coeur avant la naissance
      if (o.cta && state.boss) drawBossFlash19(o);                  // FLASH d'énergie (joué 2x) au centre, juste avant la naissance
      if (o.cta && state.boss) drawBossRays(o);                     // god rays persistants une fois l'orbe née
      if (o.cta && state.boss) drawBossRing(o);                     // onde de choc dorée (sprite anneau) au boom
      if (o.cta && state.boss) drawBossShockwave(o);                // SHOCKWAVE (explosion d'énergie) au boom
      if (o.cta && state.boss) drawBossFlare(o);                    // flare doré (sprite de rayons) au boom
      if (o.collected) {
        if (o.collecting) {
          // ---- disparition en VAGUES : grosse explosion -> retour au centre -> 2e explosion (50% plus petite)
          //      -> les grains se posent sur leurs positions résiduelles. Effet de vague, sans rupture. ----
          const t = clamp(o.collT / 0.75, 0, 1);
          const prem = o.premium, diaBase = o.r * 2 * (prem ? 0.75 : 0.78);
          const rx = diaBase * 0.80, ry = diaBase * 0.42, nb = prem ? 20 : 14, msc = diaBase / 90;
          const eo = (x) => 1 - Math.pow(1 - x, 3), ei = (x) => x * x * x;
          // rayon en VAGUES (× géométrie live) : 1(live) -> 2.6 -> 0(centre) -> 1.3(50%) -> 0.5(résidu)
          let W;
          if (t < 0.20) W = 1 + 1.6 * eo(t / 0.20);                       // vague 1 (grosse)
          else if (t < 0.42) W = 2.6 * (1 - ei((t - 0.20) / 0.22));       // retour au centre
          else if (t < 0.60) W = 1.3 * eo((t - 0.42) / 0.18);            // vague 2 (50% plus petite)
          else W = 1.3 + (0.5 - 1.3) * eo((t - 0.60) / 0.40);            // se pose sur les positions résiduelles
          // 1) l'orbe : petit ressaut puis rétraction totale vers le centre
          const sprite = prem ? SP.orbSuper : SP.orbStd;
          const osc2 = t < 0.14 ? 1 + 0.14 * (t / 0.14) : Math.max(0, 1.14 * (1 - (t - 0.14) / 0.34));
          if (sprite && sprite.ready && sprite.img.naturalWidth > 0 && osc2 > 0.02) {
            const diaC = diaBase * osc2;
            const bakedC = getFiltered(sprite, 'saturate(0.8) brightness(0.92)') || sprite.img;   // pré-cuit (pas de ctx.filter live)
            ctx.save(); ctx.globalAlpha = Math.min(1, (1 - t) * 1.8) * 0.9;
            ctx.drawImage(bakedC, o.x - diaC / 2, oy - diaC / 2, diaC, diaC);
            ctx.restore();
          }
          // 2) masse d'éclat (grains transitoires, petits et constants) qui suit la vague et se dissipe
          const massA = Math.max(0, 1 - t * 1.25) * 0.4;
          if (massA > 0.01) {
            ctx.globalCompositeOperation = 'lighter';
            const burstN = nb * 2;
            for (let i = 0; i < burstN; i++) {
              const h1 = Math.sin((i + 1) * 12.9898) * 43758.5453, h2 = Math.sin((i + 1) * 78.233) * 43758.5453, h3 = Math.sin((i + 1) * 37.719) * 43758.5453;
              const dir = (h1 - Math.floor(h1)) < 0.5 ? -1 : 1, spd = 0.2 + 0.5 * (h2 - Math.floor(h2));
              const a = i * 0.97 + dir * o.spin * spd * 0.5, rr = 0.45 + 0.85 * (h3 - Math.floor(h3));
              const x = o.x + Math.cos(a) * rx * W * rr, y = oy + Math.sin(a) * ry * W * rr, ms = 0.8 * msc;
              // étoiles transitoires de la vague de capture (remplace les 2 ronds ambre)
              drawStar(x, y, Math.max(8, ms * 7), massA * 2.4, a * 1.4 + i, i % 3);
            }
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          }
          // 3) les grains de BASE suivent la vague et se posent EXACTEMENT sur le résidu (W finit à 0.5)
          drawDust(o, oy, diaBase, 0.80 * W, 0.42 * W, null);
          continue;
        }
        // résidu : « il y avait un orbe ici » — MÊME poussière d'étoiles mais resserrée, sens aléatoires
        const prem = o.premium, diaB = o.r * 2 * (prem ? 0.75 : 0.78);
        ctx.globalCompositeOperation = 'lighter';                       // petit halo fantôme pour marquer l'emplacement
        const rgl = ctx.createRadialGradient(o.x, oy, 1, o.x, oy, diaB * 0.46);
        rgl.addColorStop(0, rgbStr(P.accentGlow, 0.15 + Math.sin(o.pulse) * 0.04)); rgl.addColorStop(1, rgbStr(P.accentGlow, 0));
        ctx.fillStyle = rgl; ctx.beginPath(); ctx.arc(o.x, oy, diaB * 0.46, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        drawDust(o, oy, diaB, 0.40, 0.21, null);                        // amas resserré qui orbite (= arrivée de la vague)
        continue;
      }
      // échelle d'apparition (mise en scène "boss") : 1 par défaut, 0 = orbe pas encore là
      const osc = o.scale == null ? 1 : o.scale;
      if (osc <= 0.001) continue;
      if (osc !== 1) { ctx.save(); ctx.translate(o.x, oy); ctx.scale(osc, osc); ctx.translate(-o.x, -oy); }
      // (lucioles émises dans update(), indépendamment du framerate)
      const prem = o.premium;
      const pulse = 1 + Math.sin(o.pulse) * (prem ? 0.08 : 0.06);
      const dia = o.r * 2 * (o.cta ? 0.825 : (prem ? 0.825 : 0.936)) * pulse;   // phares +10% (0.75→0.825), normales +20% (0.78→0.936) ; finale inchangée

      // poussière d'étoiles décorative autour de l'orbe RETIRÉE (demande de Steven) :
      // on garde seulement le halo chaud ; plus aucune étoile qui orbite devant/derrière.

      // halo chaud doux : l'orbe rayonne dans la peinture (les lucioles sont émises dans update)
      // falloff en 3 paliers -> coeur dense + longue traînée douce (lumière peinte, pas un disque net)
      ctx.globalCompositeOperation = 'lighter';
      const HR = (o.r + (prem ? 24 : 18)) * pulse;
      const hg = ctx.createRadialGradient(o.x, oy, 2, o.x, oy, HR);
      hg.addColorStop(0, rgbStr(P.accentGlow, prem ? 0.44 : 0.36));
      hg.addColorStop(0.45, rgbStr(P.accentGlow, prem ? 0.19 : 0.15));
      hg.addColorStop(1, rgbStr(P.accentGlow, 0));
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(o.x, oy, HR, 0, TAU); ctx.fill();
      // halo qui DÉTACHE l'orbe du décor peint, version feutrée (plus de cerne « chrome ») :
      // un bloom CRÈME (pas blanc pur, pour fusionner avec la palette chaude), étalé en plusieurs
      // paliers très progressifs, + un soulèvement de bord LARGE et doux. En 'screen' : reste
      // lumineux sur fond sombre sans brûler en anneau dur sur le ciel clair.
      if (!o.cta) {
        ctx.globalCompositeOperation = 'screen';
        const rs = dia / 2, sh = 0.9 + 0.1 * Math.sin(o.pulse);   // léger battement avec la pulsation de l'orbe
        // 1) bloom progressif : coeur crème qui s'éteint doucement vers l'extérieur, SANS anneau
        const W2 = rs * 2.14;
        const bloom = ctx.createRadialGradient(o.x, oy, rs * 0.35, o.x, oy, W2);
        bloom.addColorStop(0.00, `rgba(255,250,236,${(0.30 * sh).toFixed(3)})`);
        bloom.addColorStop(0.42, `rgba(255,247,229,${(0.15 * sh).toFixed(3)})`);
        bloom.addColorStop(0.72, `rgba(255,244,223,${(0.045 * sh).toFixed(3)})`);
        bloom.addColorStop(1.00, 'rgba(255,244,223,0)');
        ctx.fillStyle = bloom; ctx.beginPath(); ctx.arc(o.x, oy, W2, 0, TAU); ctx.fill();
        // 2) soulèvement de bord feutré : pic discret (alpha bas) pile au bord du sprite, puis
        //    long fondu vers l'extérieur en deux paliers -> le bord se dissout, aucun cerne net.
        const W1 = rs * 1.44;
        const edge = ctx.createRadialGradient(o.x, oy, rs * 0.45, o.x, oy, W1);
        edge.addColorStop(0.00, 'rgba(255,252,243,0)');
        edge.addColorStop(0.50, 'rgba(255,252,243,0)');
        edge.addColorStop(0.72, `rgba(255,252,243,${(0.10 * sh).toFixed(3)})`);
        edge.addColorStop(0.88, `rgba(255,252,243,${(0.04 * sh).toFixed(3)})`);
        edge.addColorStop(1.00, 'rgba(255,252,243,0)');
        ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(o.x, oy, W1, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // sprite peint : « super orbe » pour les phares, orbe standard sinon (placeholder pour la finale)
      const sp = o.cta ? SP.orbFinal : (prem ? SP.orbSuper : SP.orbStd);
      if (sp && sp.ready && sp.img.naturalWidth > 0) {
        // ajustement colorimétrique PRÉ-CUIT (cache) au lieu d'un ctx.filter live par
        // orbe/frame -> fluide sur Safari (filtre canvas WebKit très lent). Rendu identique.
        const fAdj = o.cta ? 'saturate(0.95) brightness(0.98)'    // orbe FINALE : on garde sa majesté
                           : 'saturate(0.8) brightness(0.92)';    // orbes-projets : tonifiées pour fondre dans le décor
        const baked = getFiltered(sp, fAdj) || sp.img;
        ctx.save();
        ctx.globalAlpha = o.cta ? 1 : 0.9;
        ctx.drawImage(baked, o.x - dia / 2, oy - dia / 2, dia, dia);
        ctx.restore();
      } else {                                                // fallback doré si le PNG manque
        const cg = ctx.createRadialGradient(o.x - 6, oy - 8, 2, o.x, oy, o.r * pulse);
        cg.addColorStop(0, '#FFFDF0'); cg.addColorStop(0.5, rgbStr(P.accentGlow)); cg.addColorStop(1, rgbStr(P.sunHalo));
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(o.x, oy, o.r * pulse, 0, TAU); ctx.fill();
      }
      // logo posé pile sur le disque central (géométrie mesurée par sprite) ; pas sur la grosse orbe « ? »
      if (!o.cta) {
        const disc = prem ? { dx: 0, dy: -0.015, box: 0.245 } : { dx: -0.02, dy: 0.0, box: 0.203 };  // icône réduite de 30%
        const nudge = LOGO_NUDGE[o.project && o.project.title] || {};                                  // calage du logo par marque {x,y}
        const lcx = o.x + disc.dx * dia + (nudge.x || 0), lcy = oy + disc.dy * dia + 3 + (nudge.y || 0), lbox = disc.box * dia;  // + descendue de 3 px, + calage par marque
        const hasLogo = o.logo && o.logo.ready && o.logo.img && o.logo.img.naturalWidth > 0;
        if (hasLogo) {
          const im = o.logo.img, s = Math.min(lbox / im.naturalWidth, lbox / im.naturalHeight);
          const round = !LOGO_NO_ROUND[o.project && o.project.title];                       // certaines marques : pas de masque rond
          ctx.save();
          if (round) { ctx.beginPath(); ctx.arc(lcx, lcy, lbox / 2, 0, TAU); ctx.clip(); }   // logo rogné en ROND (débordements masqués)
          ctx.drawImage(im, lcx - im.naturalWidth * s / 2, lcy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
          ctx.restore();
        } else {
          ctx.font = `${Math.round(lbox * 0.74)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(o.project.icon || '✦', lcx, lcy);
        }
      }
      // grains DEVANT l'orbe RETIRÉS aussi (voir plus haut) : orbe sans étoiles décoratives.
      if (osc !== 1) ctx.restore();    // ferme la transformation d'échelle d'apparition
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // orientation de repos par pose (le ballant dynamique est ajouté par l'appelant)
  const HAND_ROT = { handOpen: 0.75, handFist: 0.15, handPoint: 0.0, handThumb: 0.0, handPalm: 1.3, handRelax: 0.45 };
  const FIST_ANCHOR = { fistFwd: 0.72, fistBack: 0.54 };  // position du POING dans le sprite (gauche->droite)
  function drawHand(x, y, cx, pose, angle) {
    const sp = SP[pose] || SP.handFist;
    // mains de SAUT / PLANÉ : sprites déjà orientés gauche/droite -> dessin direct, sans miroir ni rotation
    if (pose === 'handJumpL' || pose === 'handJumpR' || pose === 'handPlaneL' || pose === 'handPlaneR') {
      if (sp.ready) {
        const plane = (pose === 'handPlaneL' || pose === 'handPlaneR');
        const hh = plane ? 18 : 28, hw = hh * sp.img.width / sp.img.height;  // plané = main large/plate ; saut = main qui pend
        ctx.save(); ctx.translate(x, y);
        ctx.drawImage(sp.img, -hw / 2, -hh / 2, hw, hh);
        ctx.restore();
        return;
      }
    }
    const profile = (pose === 'handInterior' || pose === 'handExterior');
    if (profile && sp.ready) {                            // poing en peau (de face / de dos) — orienté selon le sens, miroir auto
      const dir = A.vx < -5 ? -1 : (A.vx > 5 ? 1 : A.facing);
      const img = sp.img;
      const hh = 30, hw = hh * img.width / img.height;     // poings en peau un peu plus gros (détail des doigts visible)
      ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
      ctx.rotate(angle || 0);                             // rotation du poignet (pendule + follow-through)
      ctx.drawImage(img, -hw / 2, -hh / 2, hw, hh);       // ancré au CENTRE du poing sur (x,y)
      ctx.restore();
      return;
    }
    const side = (x < cx) ? -1 : 1;                       // main de gauche = miroir
    const a = (angle == null) ? (HAND_ROT[pose] || 0) : angle;
    if (sp.ready) {                                       // sprite découpé dans l'image
      const hw = 20, hh = hw * sp.img.height / sp.img.width;
      ctx.save(); ctx.translate(x, y); ctx.scale(side, 1); ctx.rotate(a);
      ctx.drawImage(sp.img, -hw / 2, -hh / 2, hw, hh);
      ctx.restore();
      return;
    }
    // gant blanc stylisé : 4 doigts + manchette (pas une simple boule)
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = CHAR.gloveSh;
    ctx.beginPath(); ctx.ellipse(0, 2, 8.6, 8, 0, 0, TAU); ctx.fill();        // base / ombre
    // doigts (4 bosses) sur le dessus
    ctx.fillStyle = CHAR.glove;
    ctx.beginPath();
    ctx.ellipse(-5, -3.6, 2.3, 3.3, 0, 0, TAU);
    ctx.ellipse(-1.7, -5, 2.4, 3.7, 0, 0, TAU);
    ctx.ellipse(1.7, -5, 2.4, 3.7, 0, 0, TAU);
    ctx.ellipse(5, -3.6, 2.3, 3.3, 0, 0, TAU);
    ctx.fill();
    // paume
    ctx.beginPath(); ctx.ellipse(0, 1, 8, 6.6, 0, 0, TAU); ctx.fill();
    // manchette (cuff)
    ctx.fillStyle = CHAR.gloveSh;
    ctx.beginPath(); ctx.ellipse(0, 6.6, 6.8, 2.7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = CHAR.glove;
    ctx.beginPath(); ctx.ellipse(0, 5.3, 6.8, 2.2, 0, 0, TAU); ctx.fill();
    // reflet
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath(); ctx.ellipse(-2.6, -0.8, 2.6, 1.8, -0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawShoe(x, y, cx, pose) {
    // TOUJOURS bout vers l'AVANT (sens du perso) — les deux pieds, même à l'arrêt (perso de profil)
    const side = A.vx < -5 ? -1 : (A.vx > 5 ? 1 : A.facing);
    const shoeMap = { tip: SP.shoeTip, s34: SP.shoe34, splay: SP.shoeSplay };
    const sp = shoeMap[pose];
    if (sp && sp.ready) {                                 // sprite découpé dans l'image
      const sw = 20, sh = sw * sp.img.height / sp.img.width;
      ctx.save(); ctx.translate(x, y); ctx.scale(side, 1);
      ctx.drawImage(sp.img, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();
      return;
    }
    // basket orange/blanc stylisée
    ctx.save(); ctx.translate(x, y); ctx.scale(side, 1);
    // semelle blanche
    ctx.fillStyle = CHAR.sneakerSole;
    ctx.beginPath(); ctx.ellipse(1, 4, 12, 3.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = CHAR.sneakerWhite;
    ctx.beginPath(); ctx.ellipse(1, 2.6, 12, 3, 0, 0, TAU); ctx.fill();
    // corps orange
    ctx.fillStyle = CHAR.sneaker;
    ctx.beginPath();
    ctx.moveTo(-9.5, 1.5);
    ctx.quadraticCurveTo(-10.5, -5, -2.5, -5.8);
    ctx.quadraticCurveTo(6.5, -6.2, 11.5, -1);
    ctx.quadraticCurveTo(13, 1.8, 9, 2.2);
    ctx.lineTo(-8.5, 2.2);
    ctx.closePath(); ctx.fill();
    // bout blanc (toe cap)
    ctx.fillStyle = CHAR.sneakerWhite;
    ctx.beginPath(); ctx.ellipse(9.5, 0.6, 4.4, 3.1, 0, 0, TAU); ctx.fill();
    // reflet orange clair
    ctx.fillStyle = CHAR.sneakerHi;
    ctx.beginPath(); ctx.ellipse(-0.5, -3.6, 5.2, 1.6, -0.12, 0, TAU); ctx.fill();
    // œillet sombre
    ctx.fillStyle = CHAR.shoeSh;
    ctx.beginPath(); ctx.arc(-2.5, -1.2, 1.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawHair(hr, hy, f) {
    ctx.fillStyle = CHAR.hair;
    ctx.lineJoin = 'round';
    // calotte : laisse voir un peu de front (cheveux coiffés vers le haut)
    ctx.beginPath();
    ctx.moveTo(-hr * 0.96, hy - hr * 0.12);
    ctx.quadraticCurveTo(-hr * 1.04, hy - hr * 0.95, -hr * 0.15, hy - hr * 1.02);
    ctx.quadraticCurveTo(hr * 0.62, hy - hr * 1.06, hr * 0.98, hy - hr * 0.3);
    ctx.quadraticCurveTo(hr * 0.7, hy - hr * 0.6, hr * 0.25, hy - hr * 0.62);
    ctx.quadraticCurveTo(-hr * 0.25, hy - hr * 0.66, -hr * 0.96, hy - hr * 0.12);
    ctx.closePath(); ctx.fill();
    // pics ébouriffés (pointus, légèrement courbés)
    const spikes = [-0.78, -0.5, -0.22, 0.06, 0.34, 0.62, 0.86];
    spikes.forEach((sx, i) => {
      const bx = sx * hr, by = hy - hr * (0.86 + (i % 2) * 0.05);
      const tipx = bx + f * hr * 0.2 + (i - 3) * 0.8;
      const tipy = by - hr * (0.55 + (i % 3) * 0.16);
      ctx.beginPath();
      ctx.moveTo(bx - hr * 0.13, by + 3);
      ctx.quadraticCurveTo(bx, by - hr * 0.12, tipx, tipy);
      ctx.quadraticCurveTo(bx + hr * 0.06, by - hr * 0.12, bx + hr * 0.13, by + 3);
      ctx.closePath(); ctx.fill();
    });
    // reflet
    ctx.fillStyle = CHAR.hairHi;
    ctx.beginPath(); ctx.ellipse(-hr * 0.25, hy - hr * 0.62, hr * 0.32, hr * 0.14, -0.5, 0, TAU); ctx.fill();
  }

  function drawAvatar() {
    ctx.save(); ctx.translate(-cam.x, -cam.y - AVATAR_LIFT);   // remonte TOUT l'avatar de AVATAR_LIFT px (ombre recompensée plus bas)
    const cx = A.x + A.w / 2, cy = A.y + A.h / 2;
    const bob = A.onGround ? Math.sin(A.breath) * 1.5 : 0;
    const f = A.facing;

    // OMBRE PORTÉE sur la plateforme en dessous : "collée" au sol, elle RÉTRÉCIT
    // DE L'EXTÉRIEUR VERS L'INTÉRIEUR (son bord se contracte vers le centre) à mesure
    // que le perso s'élève en sautant, et disparaît s'il n'y a aucune plateforme dessous.
    {
      const feet = A.y + A.h;
      const sy = surfaceUnder(cx, feet);     // surface où l'ombre se pose (null = rien dessous)
      if (sy != null) {
        const FADE = 150;                                  // au-delà de cette hauteur, ombre disparue
        const k = clamp((sy - feet) / FADE, 0, 1);         // 0 au sol -> 1 en l'air
        const shrink = 1 - k;                              // 1 au sol -> 0 en l'air (le bord rentre vers le centre)
        if (shrink > 0.02) {
          const rx = 34 * shrink, ry = 7 * shrink;         // l'ellipse se contracte vers le centre — bien OVALE (large + aplatie), pas ronde
          const alpha = 0.38 * (0.55 + 0.45 * shrink);     // ombre douce mais toujours visible (atténuée en montant)
          ctx.save();
          ctx.translate(cx, sy + 3);                       // l'ombre suit le décalage global (AVATAR_LIFT) -> remonte avec l'avatar
          ctx.scale(1, ry / rx);                           // cercle du dégradé -> ellipse posée au sol
          const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, rx);
          g.addColorStop(0,    `rgba(0,0,0,${alpha})`);    // centre
          g.addColorStop(0.65, `rgba(0,0,0,${alpha})`);
          g.addColorStop(1,    'rgba(0,0,0,0)');           // bord extérieur doux
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }
    }

    // pose selon l'état (priorité : célébration > hover > saut > course > marche > repos)
    const running = A.onGround && Math.abs(A.vx) > MOVE_SPEED * 0.55;
    const walking = A.onGround && Math.abs(A.vx) > 20;
    const handPose =                                            // état générique (rotation/HAND_ROT) ; sprite réel par main -> poseFor
      (A.cheer > 0) ? 'handThumb' :
      !A.onGround ? 'handPoint' :
      running ? 'handFist' :
      walking ? 'handOpen' : 'handRelax';
    const footPose = (i) => {
      if (A.landT > 0) return 'splay';
      if (!A.onGround) return 'tip';
      if (!walking) return 's34';
      const mv = Math.min(1, Math.abs(A.vx) / MOVE_SPEED);
      const ph = state.time * (10 + mv * 8) + i * Math.PI;    // même cadence que le cycle des pieds
      return (Math.cos(ph) > 0.15) ? 'tip' : 's34';           // pointe à l'envol, à plat à l'appui
    };

    // ballant DYNAMIQUE des mains : la rotation bascule avec la foulée (va-et-vient réaliste)
    const moving = Math.min(1, Math.abs(A.vx) / MOVE_SPEED);
    const gphase = state.time * (10 + moving * 8);
    const fdir = A.vx < 0 ? -1 : 1;
    const rockAmp = handPose === 'handFist' ? 0.85 : handPose === 'handOpen' ? 0.5 : 0;
    // poings en peau (de face/de dos) au sol en état NORMAL (repos/marche/course) ; poses spéciales sinon (saut/hover/joie)
    const groundNormal = A.onGround && A.cheer <= 0;
    // orientation des poings en peau : knuckles vers l'AVANT + léger tilt de poignet (suit le balancier)
    const handAngle = (i) => groundNormal
      ? (0.1 - A.hand[i].w * 0.7)
      : (HAND_ROT[handPose] || 0) + Math.sin(gphase + i * Math.PI) * moving * rockAmp;
    // PROFONDEUR (z-order) : le membre en AVANT (sens du déplacement) passe DEVANT le corps,
    // celui en arrière passe DERRIÈRE — et ça s'alterne au fil de la foulée.
    // Z-ORDER FIXE (perso de profil) : la main du côté ARRIÈRE (opposé au sens) passe TOUJOURS
    // DEVANT le corps ; la main du côté AVANT (sens du perso) passe TOUJOURS DERRIÈRE. Miroir auto via A.facing.
    const handFront = (i) => ((i === 0 ? -1 : 1) * A.facing) < 0;
    const footFront = (i) => (A.foot[i].x - cx) * fdir >= 0;
    // au sol : poing « de face » (interior) du côté du regard, « de dos » (exterior) de l'autre.
    // en l'air : sprite SPÉCIFIQUE par main (gauche -> _left, droite -> _right) ; MONTE = saut, DESCEND = plané.
    const poseFor = (i) => {
      if (groundNormal) return (((i === 0 ? -1 : 1) * A.facing > 0) ? 'handInterior' : 'handExterior');
      if (A.cheer > 0) return 'handThumb';
      if (!A.onGround) return (A.vy < 0)
        ? (i === 0 ? 'handJumpL' : 'handJumpR')      // va de bas en haut -> main de SAUT
        : (i === 0 ? 'handPlaneL' : 'handPlaneR');   // va de haut en bas (chute/plané) -> main de PLANÉ
      return handPose;
    };
    const drawFoot = (i) => drawShoe(A.foot[i].x, A.foot[i].y, cx, footPose(i));
    const drawHnd = (i) => {
      const fx = A.hand[i].x + ((groundNormal && handFront(i)) ? (cx - A.hand[i].x) * 0.22 : 0);  // au SOL seulement : main devant ramenée vers le corps
      drawHand(fx, A.hand[i].y, cx, poseFor(i), handAngle(i));
    };
    // bob couplé : ~1 quand un pied passe au niveau du corps (le corps monte / la tête descend)
    const gaitUp = Math.min(1, moving / 0.4) * Math.abs(Math.cos(gphase));

    // 1) membres DERRIÈRE le corps
    for (let i = 0; i < 2; i++) if (!footFront(i)) drawFoot(i);
    for (let i = 0; i < 2; i++) if (!handFront(i)) drawHnd(i);

    // --- tête + corps (squash & stretch + pirouette du double saut) ---
    ctx.save();
    ctx.translate(cx, cy + bob - 3 * gaitUp - LIMB_RAISE);   // remonté (jambes longues) ; MONTE encore quand un pied passe au niveau du corps
    ctx.scale(A.scaleX, A.scaleY);
    ctx.rotate(A.flip + A.lean);   // pirouette (double saut) + inclinaison (course)

    const headR = A.w * 0.43, headY = -A.h * 0.24;
    const topY = headY + headR * 0.5, botY = A.h * 0.5, bw = A.w * 0.52;

    // CORPS — TOUJOURS de profil (jamais de face, façon Rayman Origins) ; sens = dernier déplacement (profil DROIT par défaut)
    const bodyDir = (A.vx < -5 ? -1 : (A.vx > 5 ? 1 : f));
    let bodyImg = null;
    if (bodyDir < 0 && SP.bodyLeft.ready) bodyImg = SP.bodyLeft.img;
    else if (SP.bodyRight.ready) bodyImg = SP.bodyRight.img;       // défaut : profil droit ; sinon torse vectoriel ci-dessous
    if (bodyImg) {
      const bH = headR * 1.7, bW = bH * bodyImg.width / bodyImg.height;   // vrai torse (sweat) bien visible
      ctx.drawImage(bodyImg, -bW / 2, -13, bW, bH);
    } else {
    // torse stylisé : large en haut (épaules), effilé vers le bas, détaché de la tête
    const yt = botY * 0.27, yb = botY * 0.80;        // haut / bas du torse
    const Wt = bw * 1.02, Wb = bw * 0.32;            // large en haut, étroit en bas
    // capuche rouge (derrière l'épaule droite, dépasse un peu)
    ctx.fillStyle = CHAR.scarf;
    ctx.beginPath();
    ctx.moveTo(Wt * 0.12, yt + 1);
    ctx.quadraticCurveTo(Wt * 0.55, yt - 6, Wt * 0.86, yt + 1);
    ctx.quadraticCurveTo(Wt * 0.70, yt + 7, Wt * 0.18, yt + 6);
    ctx.closePath(); ctx.fill();
    // torse violet (effilé vers le bas)
    const pg = ctx.createLinearGradient(0, yt - 4, 0, yb + 4);
    pg.addColorStop(0, CHAR.pouchHi); pg.addColorStop(1, CHAR.pouchSh);
    ctx.fillStyle = pg; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-Wt * 0.42, yt);
    ctx.quadraticCurveTo(0, yt - 5, Wt * 0.42, yt);          // épaules dômées
    ctx.quadraticCurveTo(Wt, yt + 2, Wt * 0.82, yt + 7);     // épaule droite large
    ctx.quadraticCurveTo(Wt * 0.5, yb - 3, Wb, yb);          // effilement
    ctx.quadraticCurveTo(0, yb + 4, -Wb, yb);                // bas arrondi étroit
    ctx.quadraticCurveTo(-Wt * 0.5, yb - 3, -Wt * 0.82, yt + 7);
    ctx.quadraticCurveTo(-Wt, yt + 2, -Wt * 0.42, yt);
    ctx.closePath(); ctx.fill();
    // reflet épaule gauche + ombre basse
    ctx.globalAlpha = 0.4; ctx.fillStyle = CHAR.pouchHi;
    ctx.beginPath(); ctx.ellipse(-Wt * 0.4, yt + 5, Wt * 0.24, 3.4, -0.3, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.fillStyle = CHAR.pouchSh;
    ctx.beginPath(); ctx.ellipse(0, yb - 2, Wb * 1.5, 2.4, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // anneau blanc sur le torse (emblème cible)
    const emY = yt + 6;
    ctx.strokeStyle = CHAR.emblemRing; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, emY, 4.2, 0, TAU); ctx.stroke();
    ctx.fillStyle = CHAR.emblemDark; ctx.beginPath(); ctx.arc(0, emY, 2.1, 0, TAU); ctx.fill();
    }

    // TÊTE — TOUJOURS de PROFIL (jamais de face, façon Rayman Origins) ; sens = dernier déplacement (profil DROIT par défaut)
    const headProfileDir = (A.vx < -5 ? -1 : (A.vx > 5 ? 1 : f));
    let headImg = null, headFlip = 1;
    if (headProfileDir < 0 && SP.headLeft.ready) { headImg = SP.headLeft.img; headFlip = 1; }
    else if (SP.headRight.ready) { headImg = SP.headRight.img; headFlip = 1; }   // défaut : profil droit ; sinon visage vectoriel ci-dessous
    if (headImg) {
      const hh = headR * 2.0, hw = hh * (headImg.width / headImg.height);  // taille d'origine restaurée
      const hcy = headY - 14 + 5 * gaitUp;              // écart tête↔corps ; DESCEND quand le corps monte
      const headDX = f * headR * 0.55 - (walking ? f : 0);   // décalée vers le sens ; EN MARCHE : 1 px à contre-sens (droite -> 1px gauche, etc.)
      ctx.save();
      ctx.translate(headDX, 0);
      ctx.scale(headFlip, 1);                           // profil déjà orienté ; tête de face suit le regard G/D
      ctx.drawImage(headImg, -hw / 2, hcy - hh * 0.5, hw, hh);
      ctx.restore();
      // léger rim light chaud pour fondre dans la scène
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgbStr(P.accentGlow, 0.15); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(headDX, hcy, hh * 0.33, Math.PI * 1.12, Math.PI * 1.74); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else {
    const hg = ctx.createRadialGradient(-headR * 0.3, headY - headR * 0.3, 2, 0, headY, headR * 1.35);
    hg.addColorStop(0, CHAR.skinHi); hg.addColorStop(1, CHAR.skin);
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, headY, headR * 0.92, headR, 0, 0, TAU); ctx.fill();
    // oreille (côté opposé au regard)
    ctx.fillStyle = CHAR.skin;
    ctx.beginPath(); ctx.ellipse(-f * headR * 0.9, headY + 1, 3, 4.8, 0, 0, TAU); ctx.fill();

    // BARBE DE 3 JOURS (clippée au visage)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, headY, headR * 0.92, headR, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = CHAR.stubble;
    ctx.beginPath(); ctx.ellipse(0, headY + headR * 0.52, headR * 0.92, headR * 0.6, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, headY + headR * 0.2, headR * 0.4, headR * 0.16, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // CHEVEUX
    drawHair(headR, headY, f);

    // SOURCILS
    const eo = headR * 0.4, ebY = headY - headR * 0.16;
    ctx.strokeStyle = CHAR.brow; ctx.lineWidth = 1.9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-eo - 3, ebY); ctx.quadraticCurveTo(-eo, ebY - 2.5, -eo + 4, ebY - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(eo - 4, ebY - 1); ctx.quadraticCurveTo(eo, ebY - 2.5, eo + 3, ebY); ctx.stroke();

    // YEUX
    const eyY = headY - headR * 0.02;
    for (let s = -1; s <= 1; s += 2) {
      const exx = s * eo + A.eye.x * 2;
      ctx.fillStyle = CHAR.eyeWhite;
      ctx.beginPath(); ctx.ellipse(exx, eyY + A.eye.y * 1.2, 3.3, A.blink > 0 ? 0.7 : 3.9, 0, 0, TAU); ctx.fill();
      if (A.blink <= 0) {
        ctx.fillStyle = CHAR.iris;
        ctx.beginPath(); ctx.arc(exx + A.eye.x * 1.6, eyY + A.eye.y * 2, 2.1, 0, TAU); ctx.fill();
        ctx.fillStyle = CHAR.pupil;
        ctx.beginPath(); ctx.arc(exx + A.eye.x * 1.8, eyY + A.eye.y * 2, 1, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(exx + A.eye.x * 1.6 - 0.7, eyY + A.eye.y * 2 - 0.7, 0.5, 0, TAU); ctx.fill();
      }
    }
    // NEZ
    ctx.strokeStyle = CHAR.skinSh; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f * 1.4, eyY + 3); ctx.lineTo(f * 2.4, eyY + 6.5); ctx.stroke();
    // BOUCHE — grand sourire (avec dents) au sol, "o" en saut
    const mY = headY + headR * 0.52;
    if (!A.onGround) {
      ctx.fillStyle = CHAR.mouth;
      ctx.beginPath(); ctx.ellipse(0, mY, 2.6, 3.2, 0, 0, TAU); ctx.fill();
    } else if (A.crouch) {
      ctx.strokeStyle = CHAR.mouth; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-3, mY); ctx.lineTo(3, mY); ctx.stroke();
    } else {
      ctx.fillStyle = CHAR.mouth;
      ctx.beginPath();
      ctx.moveTo(-5.5, mY - 1.5);
      ctx.quadraticCurveTo(0, mY + 4.6, 5.5, mY - 1.5);
      ctx.quadraticCurveTo(0, mY + 1.4, -5.5, mY - 1.5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = CHAR.teeth;
      ctx.beginPath();
      ctx.moveTo(-4, mY - 0.9);
      ctx.quadraticCurveTo(0, mY + 1.2, 4, mY - 0.9);
      ctx.quadraticCurveTo(0, mY + 0.1, -4, mY - 0.9);
      ctx.closePath(); ctx.fill();
    }

    // rim light chaud
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgbStr(P.accentGlow, 0.22); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, headY, headR, Math.PI * 1.12, Math.PI * 1.74); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();

    // 3) membres DEVANT le corps (dessinés après -> passent devant)
    for (let i = 0; i < 2; i++) if (footFront(i)) drawFoot(i);
    for (let i = 0; i < 2; i++) if (handFront(i)) drawHnd(i);
    ctx.restore();
  }

  // ÉTOILE / luciole : LE glint universel du jeu (sprite Kenney star_04, teinté chaud).
  // Toutes les particules-points passent désormais par là (Steven : « ces étoiles partout » -
  // traînée de plané, lucioles d'orbe, étincelles de pancarte, gerbes de capture, motes de fond).
  // Le composite ('lighter' additif) est posé par l'appelant. Renvoie false si le sprite n'est
  // pas encore chargé -> l'appelant peut retomber sur un petit rond.
  const _starCache = {};   // étoile teintée PRÉ-RÉDUITE (96px) par teinte -> pas de downscale 512px par grain
  function drawStar(x, y, size, alpha, rot, ti) {
    const tint = STAR_TINTS[(ti | 0) % STAR_TINTS.length];
    let c = _starCache[tint];
    if (!c) {
      const big = getTinted(FX.twinkle, tint);
      if (!big) return false;            // sprite pas encore chargé -> on réessaiera la frame suivante
      const S = 96; c = document.createElement('canvas'); c.width = c.height = S;
      c.getContext('2d').drawImage(big, 0, 0, S, S);
      _starCache[tint] = c;
    }
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.drawImage(c, -size / 2, -size / 2, size, size); ctx.restore();
    return true;
  }

  function drawParticles() {
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    let cur = 'lighter'; ctx.globalCompositeOperation = cur;
    for (const p of particles) {
      if (p.blend !== cur) { cur = p.blend; ctx.globalCompositeOperation = cur; }
      if (p.tex) {                                     // sprite de FUMÉE peint, teinté en code (fondu d'entrée + sortie)
        const cnv = getTinted(p.tex, p.tint);
        if (cnv) {
          const fin = clamp((p.max - p.life) / (p.max * 0.18), 0, 1);
          ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * fin * p.texA;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.drawImage(cnv, -p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
        }
        continue;
      }
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.soft) {                                    // pollen lumineux : bord TRÈS flou (dégradé additif), pas un disque dur
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, p.color); g.addColorStop(0.5, rgbStr(P.sunHalo, 0)); g.addColorStop(1, rgbStr(P.sunHalo, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      } else if (p.blend === 'source-over') {          // poussière fine : bord DOUX (dégradé)
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, p.color); g.addColorStop(0.55, p.color); g.addColorStop(1, 'rgba(210,180,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      } else {
        // ÉTOILE additive (remplace l'ancien rond dur) : ~3.6x le rayon du point, rotation/teinte variées
        const a = clamp(p.life / p.max, 0, 1);
        if (!drawStar(p.x, p.y, Math.max(8, p.size * 3.6), a * 0.95, p.rot || (p.x * 0.7 + p.y * 0.3), (p.x + p.y) | 0)) {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    drawFxAnims();
    ctx.restore();
  }

  // Bandes de poussière pixel jouées image par image (poof de saut / nuage d'arrivée).
  // Appelée DANS drawParticles (repère caméra déjà posé). Fondu doux en fin d'anim.
  function drawFxAnims() {
    if (!fxAnims.length) return;
    ctx.globalCompositeOperation = 'source-over';
    for (const f of fxAnims) {
      const def = f.def, sp = def.sp;
      if (!sp || !sp.ready || !sp.img.naturalWidth) continue;
      const FW = def.fw || FXA_FW, FH = def.fh || FXA_FH;
      const p = clamp(f.t / def.dur, 0, 1);
      const fr = Math.min(def.frames - 1, (p * def.frames) | 0);
      const sz = f.size;
      const dw = sz, dh = sz * FH / FW;   // `size` = LARGEUR du poof ; hauteur déduite du ratio de frame (frames larges = fumée 2 côtés)
      const fade = p > 0.72 ? clamp((1 - p) / 0.28, 0, 1) : 1;   // fondu de sortie discret
      ctx.globalAlpha = (f.def===FXA.land ? 0.68 : 0.6) * fade;   // poussière douce qui se fond au décor
      ctx.save();
      ctx.translate(f.x - dw / 2, f.y - dh * def.foot);   // centré sur (x), ancré sous les pieds (foot = part du sol dans la frame)
      if (f.flip < 0) { ctx.translate(dw, 0); ctx.scale(-1, 1); }
      ctx.drawImage(sp.img, fr * FW, 0, FW, FH, 0, 0, dw, dh);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes() {
    ctx.globalCompositeOperation = 'lighter';
    const density = 0.4 + state.warmth * 0.6;
    for (const m of motes) {
      const x = ((m.x * viewW + state.time * 8 * m.z - cam.x * 0.2 * m.z) % (viewW + 80) + viewW + 80) % (viewW + 80) - 40;
      const y = (m.y * viewH + Math.sin(m.ph) * 20) % viewH;
      const a = (0.2 + Math.sin(m.ph) * 0.2) * density;
      // petites étoiles de fond qui flottent et scintillent (rotation animée via m.ph)
      drawStar(x, y, Math.max(7, m.z * 5), a * 1.2, m.ph + m.x * 6, (m.x * 97) | 0);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // grande feuille (frond) façon jungle, avec nervure
  function bigLeaf(x, y, len, ang, col, vein) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.42, -len * 0.34, len, -len * 0.02);
    ctx.quadraticCurveTo(len * 0.42, len * 0.32, 0, 0);
    ctx.closePath(); ctx.fill();
    if (vein) { ctx.strokeStyle = vein; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.04, len * 0.92, -len * 0.02); ctx.stroke(); }
    ctx.restore();
  }

  function drawForeground() {
    // premier plan : grandes feuilles sombres qui encadrent le bas (jungle).
    ctx.save(); ctx.translate(-cam.x * 1.3, -cam.y * 1.15);
    const dark = rgbStr(mixRgb(P.foliageShadow, P.vignette, 0.42), 0.98);
    const vein = rgbStr(P.foliageNear, 0.3);
    const baseY = GROUND_Y + 200;
    const x0 = cam.x * 1.3 - 280, x1 = x0 + viewW + 560;
    for (let x = Math.floor(x0 / 660) * 660; x < x1; x += 660) {
      const s = Math.sin(state.time * 0.6 + x) * 0.05;
      bigLeaf(x - 24, baseY, 150, -1.78 + s, dark, vein);
      bigLeaf(x, baseY, 178, -1.42 + s, dark, vein);
      bigLeaf(x + 30, baseY + 6, 162, -1.08 + s, dark, vein);
      bigLeaf(x + 64, baseY + 14, 138, -0.72 + s, dark, vein);
    }
    ctx.restore();
  }

  function drawWarmBloom() {
    // lueur dorée globale qui monte avec la chaleur : "tu as rallumé le monde"
    if (state.warmth < 0.02) return;
    ctx.globalCompositeOperation = 'soft-light';
    const m = sunPos(), sx = m.x, sy = m.y;
    const g = ctx.createRadialGradient(sx, sy, viewH * 0.1, sx, sy, viewH * 1.1);
    g.addColorStop(0, rgbStr(P.accentGlow, 0.55 * state.warmth));
    g.addColorStop(1, rgbStr(P.accentGlow, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.34, viewW / 2, viewH / 2, viewH * 0.92);
    g.addColorStop(0, rgbStr(P.vignette, 0));
    g.addColorStop(1, rgbStr(P.vignette, 0.3 - state.warmth * 0.14));   // douce, scène de jour
    ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
    // « Le monde retient son souffle » : la scène se concentre doucement sur l'orbe à naître,
    // puis la lumière revient. Brun chaud (pas d'indigo froid) -> reste DANS la peinture du désert.
    const bc = bossCharge();
    if (bc > 0.01) {
      const cx = viewW / 2, cy = viewH * 0.42;                          // foyer un peu haut (l'orbe est en hauteur)
      const g2 = ctx.createRadialGradient(cx, cy, viewH * 0.10, cx, cy, viewH * 0.98);
      g2.addColorStop(0, 'rgba(38,22,10,0)');
      g2.addColorStop(0.5, `rgba(38,22,10,${(0.12 * bc).toFixed(3)})`);
      g2.addColorStop(1, `rgba(26,14,6,${(0.46 * bc).toFixed(3)})`);
      ctx.fillStyle = g2; ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  // --- helpers du panneau d'identité (style « Mes projets » : parchemin + or) ---
  function npStar(sx, sy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (TAU / 5);
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      const a2 = a + TAU / 10;
      ctx.lineTo(sx + Math.cos(a2) * r * 0.46, sy + Math.sin(a2) * r * 0.46);
    }
    ctx.closePath();
  }
  function npShield(sx, sy, s) {            // bouclier doré + luciole (hauteur ≈ s)
    ctx.save(); ctx.translate(sx, sy); ctx.scale(s / 60, s / 60); ctx.translate(-28, -30);
    ctx.beginPath();
    ctx.moveTo(28, 2); ctx.lineTo(52, 9); ctx.lineTo(52, 30);
    ctx.bezierCurveTo(52, 46, 40, 55, 28, 58); ctx.bezierCurveTo(16, 55, 4, 46, 4, 30);
    ctx.lineTo(4, 9); ctx.closePath();
    ctx.fillStyle = '#3a2a14'; ctx.fill();
    const gg = ctx.createLinearGradient(0, 2, 0, 58);
    gg.addColorStop(0, '#FCE7A8'); gg.addColorStop(0.5, '#E0B05A'); gg.addColorStop(1, '#A6742F');
    ctx.lineWidth = 3.4; ctx.strokeStyle = gg; ctx.stroke();
    const lg = ctx.createRadialGradient(28, 30, 0, 28, 30, 16);
    lg.addColorStop(0, 'rgba(255,255,255,1)'); lg.addColorStop(0.4, 'rgba(255,231,154,0.9)'); lg.addColorStop(1, 'rgba(202,162,62,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(28, 31, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(28, 29, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function npKey(kx, ky, kw, kh, glyph, label) {   // ticket parchemin + liseré or
    roundRect(kx, ky, kw, kh, 7);
    const g = ctx.createLinearGradient(0, ky, 0, ky + kh);
    g.addColorStop(0, '#efe0bb'); g.addColorStop(1, '#dcc493');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#ad8038'; ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center'; ctx.font = '800 11px Quicksand, sans-serif'; ctx.fillStyle = '#58360f';
    ctx.fillText(glyph, kx + 15, ky + kh / 2);
    ctx.textAlign = 'left'; ctx.font = '600 11px Quicksand, sans-serif'; ctx.fillStyle = '#6b4a1e';
    ctx.fillText(label, kx + 28, ky + kh / 2);
    ctx.textBaseline = 'alphabetic';
  }

  function drawNameplate() {
    if (cam.x > 1300) return;
    const sp = SP.nameplate;
    if (!sp || !sp.ready) return;          // l'écriteau est une image peinte (identité + commandes) ; rien à dessiner tant qu'elle n'est pas chargée
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    const cx = 695, cy = 250;
    const float = 0;                       // pancarte FIXE (plus de flottement)
    const iw = sp.img.naturalWidth || 500, ih = sp.img.naturalHeight || 500;
    // Taille FIXE (indépendante de la résolution de l'image source) : l'image est en haute
    // résolution -> downscalée donc nette. Une seule valeur à régler pour + / - grand.
    const DW = 288;                               // largeur en px monde
    const DH = DW * ih / iw;
    const dx = cx - DW / 2, dy = cy - DH / 2 + float;
    // halo doux derrière l'écriteau (proportionnel à la taille)
    const hr = DW * 0.62;
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(cx, cy + float, 10, cx, cy + float, hr);
    hg.addColorStop(0, rgbStr(P.accentGlow, 0.12)); hg.addColorStop(1, rgbStr(P.accentGlow, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy + float, hr, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // l'écriteau peint (nom, rôle, lieu, commandes : tout est dans l'image)
    ctx.save(); ctx.shadowColor = 'rgba(28,16,4,0.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
    ctx.drawImage(sp.img, dx, dy, DW, DH); ctx.restore();
    // Nuage de poussière d'étoiles qui FLOTTE autour de l'écriteau, calqué sur la poussière d'orbe
    // (drawDust) : orbite ELLIPTIQUE (pas un carré), rayons variés + respiration = effet nuage,
    // profondeur (avant clair / arrière faible), halo doux + coeur, alpha bas et varié -> subtil.
    ctx.globalCompositeOperation = 'lighter';
    const NB = 28;
    const ox = cx, oy = cy + float;                      // centre de l'écriteau
    const rx = DW * 0.55, ry = DH * 0.46;                // rayons de l'orbite elliptique (vertical réduit : ne monte plus trop haut)
    const scd = DW / 300;                                // grains fins
    for (let i = 0; i < NB; i++) {
      const h1 = Math.sin((i + 1) * 12.9898) * 43758.5453, a1 = h1 - Math.floor(h1);
      const h2 = Math.sin((i + 1) * 78.233) * 43758.5453, a2 = h2 - Math.floor(h2);
      const dir = a1 < 0.5 ? -1 : 1;
      const spd = 0.25 + 0.6 * a2;                        // vitesse angulaire variée
      const a = i * 1.7 + dir * state.time * 0.28 * spd;  // angle qui tourne lentement
      const s = Math.sin(a);
      const rr = 0.66 + 0.5 * a1 + 0.07 * Math.sin(state.time * 0.6 + i * 2.1);  // rayon varié + respiration (nuage)
      const gx = ox + Math.cos(a) * rx * rr;
      const gy = oy + s * ry * rr;
      const depth = 0.45 + 0.55 * (0.5 + 0.5 * s);        // avant (s>0) plus clair, arrière plus faible
      const tw = 0.5 + 0.5 * Math.sin(state.time * 1.6 + i * 2.3);
      const al = (0.15 + 0.42 * tw) * depth;              // alpha bas et varié -> subtil
      const ms = (1.0 + 0.9 * depth) * scd;
      // ÉTOILE qui orbite autour de l'écriteau (mêmes étoiles que partout, remplace les 2 ronds ambre)
      drawStar(gx, gy, Math.max(9, ms * 7), al * 2.2, a * 1.3 + i, i % 3);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Touche de contrôle façon Lille : plaque de pierre + liseré or gravé (Vieille Bourse),
  // glyphe incisé, label en serif. 100 % dessiné -> parfaitement net.
  function keyCap(cx, cy, glyph, label, s) {
    s = s || 1;
    ctx.save(); ctx.translate(cx, cy);
    ctx.font = `800 ${17 * s}px Quicksand, sans-serif`;
    const w = Math.max(46 * s, ctx.measureText(glyph).width + 22 * s), h = 38 * s, r = 9 * s;
    // plaque pierre (avec ombre portée douce)
    ctx.save();
    ctx.shadowColor = 'rgba(50,28,8,0.40)'; ctx.shadowBlur = 9 * s; ctx.shadowOffsetY = 3 * s;
    roundRect(-w / 2, -h / 2, w, h, r);
    const sg = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    sg.addColorStop(0, '#f6ead0'); sg.addColorStop(0.55, '#e6d2a6'); sg.addColorStop(1, '#cdb079');
    ctx.fillStyle = sg; ctx.fill();
    ctx.restore();
    // liseré or double (baroque)
    roundRect(-w / 2, -h / 2, w, h, r);
    ctx.lineWidth = 2.3 * s; ctx.strokeStyle = '#a9772f'; ctx.stroke();
    roundRect(-w / 2 + 3 * s, -h / 2 + 3 * s, w - 6 * s, h - 6 * s, Math.max(1.5, r - 2.5 * s));
    ctx.lineWidth = Math.max(0.7, s); ctx.strokeStyle = 'rgba(214,170,72,0.85)'; ctx.stroke();
    // glyphe gravé (highlight clair décalé en bas = incisé dans la pierre)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,250,234,0.6)'; ctx.fillText(glyph, 0, 1.3 * s);
    ctx.fillStyle = '#5a3c20'; ctx.fillText(glyph, 0, 0);
    // label sous la plaque (serif)
    ctx.font = `italic 600 ${14 * s}px Fraunces, Georgia, serif`;
    ctx.fillStyle = '#f3e3bf'; ctx.fillText(label, 0, h / 2 + 15 * s);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawChapterCard() {
    // Le titre de carte (Lille, Paris…) est désormais affiché dans le HUD, à droite du
    // chrono (voir revealChapter + .hud__chapter). Plus de carton centré sur le canvas.
  }

  // utilitaire rounded rect
  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- DÉCOR PEINT (images générées) ---------- */
  const STONE_FILL = '#6c7052';                 // remplissage pierre sous la bande de sol

  // tuile une image horizontalement avec parallaxe (coordonnées écran)
  function tileImageH(img, scaledH, topY, parX) {
    const scale = scaledH / img.naturalHeight, tileW = img.naturalWidth * scale;
    let off = (-cam.x * parX) % tileW; if (off > 0) off -= tileW;
    for (let x = off; x < viewW + tileW; x += tileW) ctx.drawImage(img, x, topY, tileW, scaledH);
  }

  function drawBgImageLayers() {
    if (imgReady(IMG.sky)) {
      const s = Math.max(viewW / IMG.sky.naturalWidth, viewH / IMG.sky.naturalHeight);
      const w = IMG.sky.naturalWidth * s, h = IMG.sky.naturalHeight * s;
      let off = (-cam.x * 0.03) % w; if (off > 0) off -= w;
      for (let x = off; x < viewW; x += w) ctx.drawImage(IMG.sky, x, viewH - h, w, h);
    }
    const horizon = GROUND_Y - cam.y;
    if (imgReady(IMG.far)) { const H = viewH * 0.40; tileImageH(IMG.far, H, horizon + 24 - H, 0.16); }
    if (imgReady(IMG.mid)) { const H = viewH * 0.44; tileImageH(IMG.mid, H, horizon + 46 - H, 0.34); }
  }

  function drawForegroundImg() {
    if (!imgReady(IMG.fg)) return;
    const H = viewH * 0.34;
    tileImageH(IMG.fg, H, viewH - H + 12, 1.15);
  }

  // sprite peint ancré en bas-centre (coordonnées monde)
  function drawSpriteImg(img, wx, baseY, targetH, flip) {
    if (!imgReady(img)) return;
    const scale = targetH / img.naturalHeight, w = img.naturalWidth * scale;
    ctx.save(); ctx.translate(wx - cam.x, baseY - cam.y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -targetH, w, targetH);
    ctx.restore();
  }

  function drawVineImg(wx, wy, targetH) {
    if (!imgReady(IMG.vine)) return;
    const scale = targetH / IMG.vine.naturalHeight, w = IMG.vine.naturalWidth * scale;
    ctx.save(); ctx.translate(wx - cam.x, wy - cam.y);
    ctx.rotate(Math.sin(state.time * 0.9 + wx * 0.03) * 0.05);
    ctx.drawImage(IMG.vine, -w / 2, 0, w, targetH);
    ctx.restore();
  }

  const GROUND_SURF = 0.43;       // fraction de l'image ground.png = la surface (où on marche)
  const GROUND_CROP = 0.83;   // on ignore la bande crème du bas de ground.png (0.83->1.0)
  const STONE_SY = 0.68, STONE_SH = 0.13;   // bande de PIERRE pure de l'image (pour le remplissage)
  function drawFloorImg(s) {
    if (!imgReady(IMG.ground)) return drawFloor(s);
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    const g = IMG.ground, NW = g.naturalWidth, NH = g.naturalHeight;
    const scaledH = 178, tileW = NW * (scaledH / NH);
    const topY = s.y - scaledH * GROUND_SURF;              // herbe à GROUND_Y
    const drawnH = scaledH * GROUND_CROP;                  // hauteur affichée (sans crème)
    const stoneBottom = topY + drawnH;
    const vx0 = Math.max(s.x, cam.x - tileW - 40), vx1 = Math.min(s.x + s.w, cam.x + viewW + 40);
    if (vx1 <= vx0) { ctx.restore(); return; }
    const start = s.x + Math.floor((vx0 - s.x) / tileW) * tileW;
    // 1) PIERRE pure tuilée sous le sol, jusqu'en bas de l'écran
    const sY = NH * STONE_SY, sH = NH * STONE_SH, bandH = sH * (scaledH / NH);
    const fillBottom = cam.y + viewH + 80;
    for (let y = stoneBottom - 1; y < fillBottom; y += bandH)
      for (let x = start; x < vx1; x += tileW)
        ctx.drawImage(g, 0, sY, NW, sH, x, y, tileW, bandH);
    // 2) la tuile (herbe + pierre, SANS la crème) par-dessus
    for (let x = start; x < vx1; x += tileW)
      ctx.drawImage(g, 0, 0, NW, NH * GROUND_CROP, x, topY, tileW, drawnH);
    ctx.restore();
  }

  function drawBoughImg(s) {
    if (!imgReady(IMG.ground)) { ctx.save(); ctx.translate(-cam.x, -cam.y); drawBough(s); ctx.restore(); return; }
    const g = IMG.ground, NW = g.naturalWidth, NH = g.naturalHeight;
    const scaledH = 150, tileW = NW * (scaledH / NH);
    const topY = s.y - scaledH * GROUND_SURF, drawnH = scaledH * GROUND_CROP;
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    // plateforme = bloc d'herbe+pierre peint (sans crème), clippé arrondi
    ctx.save(); ctx.beginPath(); roundRect(s.x, topY, s.w, drawnH, 16); ctx.clip();
    for (let x = Math.floor(s.x / tileW) * tileW; x < s.x + s.w + tileW; x += tileW)
      ctx.drawImage(g, 0, 0, NW, NH * GROUND_CROP, x, topY, tileW, drawnH);
    ctx.restore();
    ctx.restore();
    drawVineImg(s.x + 22, s.y + s.h + 6, 70);
    drawVineImg(s.x + s.w - 26, s.y + s.h + 2, 56);
  }

  function drawPropsImg(layer) {
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (p.type === 'ring') {
        if (layer !== 'front') continue;
        ctx.save(); ctx.translate(-cam.x, -cam.y);
        const k = p.t / p.life; ctx.strokeStyle = rgbStr(P.groundRim, (1 - k) * 0.6); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 6 + k * 46, (6 + k * 46) * 0.35, 0, 0, TAU); ctx.stroke();
        ctx.restore(); continue;
      }
      if (p.x < cam.x - 320 || p.x > cam.x + viewW + 320) continue;
      if (layer === 'back' && p.type === 'tree') drawSpriteImg([IMG.tree, IMG.tree2, IMG.tree3][p.variant || 0], p.x, GROUND_Y + 8, p.h, p.flip);
      else if (layer === 'back' && p.type === 'ruin') drawSpriteImg(IMG.ruin, p.x, GROUND_Y + 10, p.h, p.flip);
      else if (layer === 'front' && p.type === 'bush') drawSpriteImg(IMG.bush, p.x, GROUND_Y + 12, p.h, p.flip);
      else if (layer === 'front' && p.type === 'mushroom') drawSpriteImg(IMG.mushroom, p.x, GROUND_Y + 10, p.h, p.flip);
    }
  }

  // Flèche « niveau suivant » : repère peint qui flotte près du bord droit des
  // cartes 1→3 et invite le joueur à continuer vers la carte suivante. Apparaît en
  // fondu dans le dernier tiers de la carte. Jamais sur la dernière carte (désert).
  function drawNextLevelArrow() {
    if (state.map >= LEVEL_COUNT - 1) return;        // dernière carte : pas de « suite »
    if (state.trans) return;                          // pas pendant une transition de carte
    const sp = SP.arrowNext;
    if (!sp || !sp.ready || !sp.img.naturalWidth) return;
    const mapRight = state.map * SECTION_W + SECTION_W;
    const distToEdge = mapRight - (A.x + A.w / 2);
    // apparaît dès qu'on approche du bord droit (autour du milieu de la carte), en fondu progressif
    const appear = clamp((760 - distToEdge) / 220, 0, 1);
    if (appear <= 0.001) return;
    // position monde : flotte près du bord droit, à hauteur de tête
    const baseX = mapRight - 128, baseY = GROUND_Y - 160;
    // animation : BALAYAGE directionnel vers la droite (sens de la sortie) — la flèche
    // pousse vite vers la droite puis revient lentement, comme un geste « la sortie, par ici ».
    // C'est un repère d'orientation VOULU : il joue MÊME en « mouvement réduit » (comme la
    // mise en scène boss / l'apparition des lettres du prélude), sinon il n'indiquerait plus
    // rien. Le mouvement est lent et doux pour rester confortable.
    const T = 1.4, p = (state.time % T) / T;
    let travel;
    if (p < 0.4) { const s = p / 0.4; travel = lerp(-12, 30, 1 - Math.pow(1 - s, 3)); }   // pousse vers la droite (easeOut)
    else { const s = (p - 0.4) / 0.6; travel = lerp(30, -12, s * s * (3 - 2 * s)); }       // revient lentement (smoothstep)
    const cx = baseX + travel;
    const cy = baseY;                                    // hauteur fixe : balayage purement horizontal (pas de ballottement vertical)
    const pulse = 0.80 + Math.sin(state.time * 2.4) * 0.12;
    const w = 130, h = w * (sp.img.naturalHeight / sp.img.naturalWidth);
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    // halo chaud doux : fond la flèche dans la peinture (palette live, qui se réchauffe)
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.7);
    hg.addColorStop(0, rgbStr(P.accentGlow, 0.20 * appear)); hg.addColorStop(1, rgbStr(P.accentGlow, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, w * 0.7, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = appear * pulse;
    ctx.drawImage(sp.img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  function render() {
    // tremblement d'écran (désactivé si "réduire les animations")
    let sx = 0, sy = 0;
    if (!reduceMotion && state.shake > 0.2) { sx = (rnd() - 0.5) * state.shake; sy = (rnd() - 0.5) * state.shake; }
    // tremblement de la mise en scène "boss" : effet voulu et ponctuel -> joué même en
    // mouvement réduit (comme l'apparition des lettres du prélude).
    if (state.boss && state.boss.shake > 0.2) { sx += (rnd() - 0.5) * state.boss.shake; sy += (rnd() - 0.5) * state.boss.shake; }
    clearAndSky();
    ctx.save(); ctx.translate(sx, sy);
    ctx.beginPath(); ctx.rect(-2, -2, viewW + 4, viewH + 4); ctx.clip();   // pas de débordement dans les bandes
    // zoom de la mise en scène "boss" : agrandit tout le monde autour de l'orbe finale
    if (state.boss && state.boss.zoom && Math.abs(state.boss.zoom - 1) > 0.001) {
      const cz = orbs.find((o) => o.cta);
      if (cz) { const fx = cz.x - cam.x, fy = cz.baseY - cam.y; ctx.translate(fx, fy); ctx.scale(state.boss.zoom, state.boss.zoom); ctx.translate(-fx, -fy); }
    }
    drawLevelImages();        // décor = 3 cartes peintes (tout est dedans)
    if (__SHOW_COL || window.__COL) {       // débogage : traits de collision NUMÉROTÉS (calage des hauteurs)
      ctx.save(); ctx.translate(-cam.x, -cam.y);
      ctx.strokeStyle = 'rgba(255,40,40,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const s of solids) {
        if (s.type !== 'oneway') continue;
        ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
        const mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.beginPath(); ctx.arc(mx, my, 12, 0, TAU); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,80,80,0.95)';
        ctx.beginPath(); ctx.arc(mx, my, 12, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(String(s.idx), mx, my);
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,40,40,0.9)';
      }
      ctx.restore();
    }
    // Écran de fin : on garde le décor peint (joli fond flouté derrière les cartes) mais
    // on n'affiche plus AUCUN objet de jeu au premier plan (avatar, orbes, particules…).
    // Sinon l'esprit, figé là où l'on a attrapé l'orbe finale, transparaît dans l'écart
    // entre les deux cartes de contact (la « silhouette parasite » signalée à l'écran de fin).
    if (!state.ended) {
      drawNameplate();
      drawOrbs();
      drawNextLevelArrow();     // flèche « par ici » près du bord droit (cartes 1→3)
      drawParticles();
      drawAvatar();             // perso par-dessus tout le décor
      drawMotes();
    }
    ctx.restore();
    drawWarmBloom();
    drawVignette();
    drawBossFlash();          // éclair blanc-doré à l'impact du "boss"
    drawSpeechBubble();       // bulle d'invite « attrape l'orbe ! » au-dessus de l'esprit
    drawChapterCard();
    drawTransition();         // « page loader » par-dessus tout
  }

  // Découpe un texte en lignes (retour à la ligne par MOTS) tenant dans maxW.
  // La police doit déjà être posée sur ctx (measureText).
  function wrapSpeech(text, maxW) {
    const lines = [];
    for (const seg of text.split('\n')) {        // « \n » = saut de ligne FORCÉ (respecté avant le wrap)
      const words = seg.split(' '); let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);                  // chaque segment ajoute au moins sa dernière ligne
    }
    return lines;
  }

  // DIALOGUE de fin en BULLE DE CRI (« attrape vite cette orbe ! »), dessiné dans le
  // repère VIRTUEL (toujours net, jamais déformé par le zoom "boss"). Indépendant du
  // perso, SANS queue : contour en PICS (style cri de BD), posé SOUS L'ORBE et centré.
  // RESPONSIVE : typo + largeur s'adaptent à la largeur VISIBLE (étroite en mobile
  // portrait) pour rester lisible. Texte qui s'écrit lettre par lettre ; parchemin
  // chaud + liseré doré. Apparaît (s.in) puis s'estompe (s.out) à la fin de l'animation.
  function drawSpeechBubble() {
    const s = state.speech; if (!s) return;
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, dpr * viewOffX, dpr * viewOffY);

    // échelle RESPONSIVE : en vue étroite (mobile portrait) la bulle se resserre
    const narrow = viewW < 640;
    const FS = narrow ? 17 : 22, LH = narrow ? 23 : 30;
    const PADX = narrow ? 18 : 30, PADY = narrow ? 14 : 22, DEPTH = narrow ? 14 : 20;
    const MARGIN = 16;
    // largeur de retour à la ligne bornée pour que la bulle (PICS compris) tienne TOUJOURS dans le cadre
    const MAXW = Math.min(540, viewW - 2 * MARGIN - 2 * PADX - 2 * DEPTH);
    ctx.font = `800 ${FS}px Quicksand, system-ui, sans-serif`;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    // gabarit STABLE : on wrappe le texte COMPLET (la bulle ne « saute » pas pendant la frappe)
    // MOBILE (narrow) : pas de retour à la ligne FORCÉ entre les deux phrases — elles
    // s'enchaînent en continu et se replient naturellement selon la largeur visible.
    // (Desktop garde le « \n » qui sépare proprement les deux répliques.)
    const speechText = narrow ? s.full.replace(/\n/g, ' ') : s.full;
    const lines = wrapSpeech(speechText, MAXW);
    let tw = 0; for (const ln of lines) tw = Math.max(tw, ctx.measureText(ln).width);
    const bw = Math.ceil(tw) + PADX * 2;
    const bh = lines.length * LH + PADY * 2;

    // posée SOUS L'ORBE finale (centrée), clampée pour rester dans le cadre visible
    const orb = orbs.find((o) => o.cta);
    const anchorY = orb ? (orb.baseY - cam.y) + orb.r * 0.86 : viewH * 0.6;   // bord BAS de l'orbe
    const bx = Math.round((viewW - bw) / 2);
    let by = Math.round(anchorY + 12);
    by = Math.min(by, viewH - bh - DEPTH - 12);    // ne déborde pas en bas (mobile)
    by = Math.max(by, Math.round(viewH * 0.46));   // reste sous l'orbe, jamais trop haut
    const cx = bx + bw / 2, cy = by + bh / 2;

    // entrée : pop d'échelle + fondu ; sortie : fondu (s.out)
    const ein = 1 - Math.pow(1 - s.in, 3);
    const alpha = Math.min(1, s.in * 1.25) * (1 - (s.out || 0));
    if (alpha <= 0.01) return;
    const pop = reduceMotion ? 1 : 0.82 + 0.18 * ein;
    // garde-fou : si jamais la bulle (PICS compris) dépasse la largeur visible, on la
    // resserre uniformément pour qu'elle tienne TOUJOURS (centrée) -> lisible en mobile.
    const fit = Math.min(1, (viewW - 2 * MARGIN) / (bw + 2 * DEPTH));

    // tracé « cri » : contour en PICS (dents) tout autour du bloc texte (DEPTH défini plus haut)
    function shoutPath() {
      const edges = [
        { x0: bx, y0: by, x1: bx + bw, y1: by },
        { x0: bx + bw, y0: by, x1: bx + bw, y1: by + bh },
        { x0: bx + bw, y0: by + bh, x1: bx, y1: by + bh },
        { x0: bx, y0: by + bh, x1: bx, y1: by },
      ];
      ctx.beginPath(); let started = false;
      for (const e of edges) {
        const len = Math.hypot(e.x1 - e.x0, e.y1 - e.y0);
        const n = Math.max(2, Math.round(len / 36));
        for (let i = 0; i < n; i++) {
          const tv = i / n, tt = (i + 0.5) / n;
          const vx = e.x0 + (e.x1 - e.x0) * tv, vy = e.y0 + (e.y1 - e.y0) * tv;   // creux (sur le bord)
          if (!started) { ctx.moveTo(vx, vy); started = true; } else ctx.lineTo(vx, vy);
          const mx = e.x0 + (e.x1 - e.x0) * tt - cx, my = e.y0 + (e.y1 - e.y0) * tt - cy;   // pointe poussée dehors
          const l = Math.hypot(mx, my) || 1;
          ctx.lineTo(cx + mx + mx / l * DEPTH, cy + my + my / l * DEPTH);
        }
      }
      ctx.closePath();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy); ctx.scale(pop * fit, pop * fit); ctx.translate(-cx, -cy);

    // halo chaud additif : fond la bulle dans la peinture (palette live)
    // le rectangle de remplissage DOIT couvrir tout le dégradé (rayon haloR) sinon son bord
    // tronque le halo encore visible -> un « trait » horizontal net flottait au-dessus de la bulle.
    ctx.globalCompositeOperation = 'lighter';
    const haloR = bw * 0.7;
    const hg = ctx.createRadialGradient(cx, cy, 8, cx, cy, haloR);
    hg.addColorStop(0, rgbStr(P.accentGlow, 0.18 * alpha)); hg.addColorStop(1, rgbStr(P.accentGlow, 0));
    ctx.fillStyle = hg; ctx.fillRect(cx - haloR, cy - haloR, haloR * 2, haloR * 2);
    ctx.globalCompositeOperation = 'source-over';

    // ombre portée douce + parchemin chaud
    ctx.save();
    ctx.shadowColor = 'rgba(40,22,8,0.32)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    shoutPath();
    const pg = ctx.createLinearGradient(0, by, 0, by + bh);
    pg.addColorStop(0, 'rgba(255,250,236,0.985)'); pg.addColorStop(1, 'rgba(255,235,198,0.985)');
    ctx.fillStyle = pg; ctx.fill();
    ctx.restore();

    // double liseré doré (pics francs, fondus dans le décor doré)
    shoutPath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = rgbStr(P.sunHalo, 0.95); ctx.stroke();
    ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();

    // texte révélé lettre par lettre (gabarit déjà wrappé), chaque ligne centrée
    const shownCount = Math.floor(s.n);
    let acc = 0;
    ctx.fillStyle = '#5a3c20';                              // encre brune chaude (= étiquettes du jeu)
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const lineLen = ln.length + (i < lines.length - 1 ? 1 : 0);   // +1 pour l'espace mangé par le wrap
      const reveal = clamp(shownCount - acc, 0, ln.length);
      const lw = ctx.measureText(ln).width;
      const lx = Math.round(bx + (bw - lw) / 2);
      const ty = by + PADY + FS + i * LH - 4;
      if (reveal > 0) ctx.fillText(ln.slice(0, reveal), lx, ty);
      // glint lumineux sur la dernière lettre en cours d'écriture (point « vivant »)
      if (!s.done && shownCount >= acc && shownCount < acc + ln.length) {
        const gx = lx + ctx.measureText(ln.slice(0, reveal)).width + 3;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgbStr(P.sunHalo, 0.9);
        ctx.beginPath(); ctx.arc(gx, ty - FS * 0.32, 2.6, 0, TAU); ctx.fill();
        ctx.restore();
      }
      acc += lineLen;
    }
    ctx.restore();
  }

  // « montée de lumière » à la naissance de l'orbe : bloom radial chaud additif centré sur l'orbe,
  // plutôt qu'un wash blanc plein écran. La lumière monte dans la peinture, elle ne la blanchit pas.
  function drawBossFlash() {
    if (!state.boss || !state.boss.flash || state.boss.flash <= 0.01) return;
    const f = clamp(state.boss.flash, 0, 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = winW / 2, cy = winH * 0.42;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, winH * 0.9);
    g.addColorStop(0, rgbStr(P.sunHalo, f * 0.5));
    g.addColorStop(0.5, rgbStr(P.accentGlow, f * 0.22));
    g.addColorStop(1, rgbStr(P.accentGlow, 0));
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.fillRect(0, 0, winW, winH);
    ctx.globalCompositeOperation = prev;
  }

  // Transition entre cartes : fondu sombre + spinner « Chargement… »
  function drawTransition() {
    if (!state.trans) return;
    const tr = state.trans;
    const a = clamp(tr.phase === 'out' ? tr.t / TRANS_T : 1 - tr.t / TRANS_T, 0, 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#0c170a'; ctx.fillRect(0, 0, winW, winH);
    const cA = clamp((a - 0.4) / 0.6, 0, 1);
    if (cA > 0) {
      ctx.globalAlpha = cA;
      const cx = winW / 2, cy = winH / 2;
      ctx.strokeStyle = 'rgba(120,230,170,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const ang = state.time * 7;
      ctx.beginPath(); ctx.arc(cx, cy - 16, 20, ang, ang + Math.PI * 1.4); ctx.stroke();
      ctx.fillStyle = '#eafff0'; ctx.textAlign = 'center';
      ctx.font = '600 22px Quicksand, system-ui, sans-serif';
      ctx.fillText('Chargement…', cx, cy + 34);
      ctx.fillStyle = 'rgba(190,235,205,0.75)';
      ctx.font = '500 15px Quicksand, system-ui, sans-serif';
      const dir = tr.dir || 1;
      const off = tr.phase === 'out' ? (dir > 0 ? 2 : 0) : 1;   // carte de destination (1-based)
      const dest = clamp(state.map + off, 1, LEVEL_COUNT);
      ctx.fillText('Carte ' + dest + ' / ' + LEVEL_COUNT, cx, cy + 60);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  /* =========================================================================
     14. BOUCLE
     ========================================================================= */
  // --- Qualité adaptative : baisse la résolution de rendu si ça rame durablement ---
  // UNIQUEMENT à la baisse (pas de remontée) -> zéro oscillation. Réagit en ~1-2 s de
  // lag soutenu et ignore les à-coups ponctuels (changement d'onglet, GC, décodage image).
  const Q_STEPS = [1, 0.85, 0.72, 0.6, 0.5];   // paliers de renderScale (0.5 = 1/4 des pixels)
  let qIdx = 0, slowStreak = 0, qCooldown = 0;
  function adaptQuality(rawDt) {
    if (!state.started || state.paused || state.ended || state.locked) { slowStreak = 0; return; }
    if (qCooldown > 0) qCooldown -= rawDt;
    // frame « lente » = sous ~45 fps ; on ignore les gros à-coups (> 100 ms = onglet/GC, pas un vrai régime)
    if (rawDt > 1 / 45 && rawDt < 0.1) slowStreak++;
    else slowStreak = Math.max(0, slowStreak - 2);
    if (slowStreak >= 45 && qIdx < Q_STEPS.length - 1 && qCooldown <= 0) {
      qIdx++; renderScale = Q_STEPS[qIdx]; resize();   // moins de pixels dès la frame suivante
      slowStreak = 0; qCooldown = 3;                   // laisse 3 s pour re-mesurer le nouveau régime
    }
  }

  let last = 0;
  function frame(t) {
    const now = t / 1000;
    let dt = last ? now - last : 0; last = now;
    const rawDt = dt;          // vrai temps de frame (AVANT clamp) -> mesure de perf pour adaptQuality
    dt = Math.min(dt, 1 / 30); // clamp pour éviter les sauts après onglet en pause
    // Crochet de test (#dev) : gèle update+render mais laisse rAF tourner -> capture
    // déterministe d'une frame d'anim. Aucun effet en prod (window.__freezeLoop indéfini).
    if (window.__freezeLoop) { requestAnimationFrame(frame); return; }
    adaptQuality(rawDt);
    update(dt);
    render();
    refreshCollectionVis();   // affiche/masque la collection (desktop, hors overlays) au gré de l'état
    requestAnimationFrame(frame);
  }

  /* =========================================================================
     15. INTERFACE (DOM) : démarrage, modal, contact, HUD
     ========================================================================= */
  const $ = (id) => document.getElementById(id);
  const preludeOv = $('prelude'), modalOv = $('modal'), contactOv = $('contact'), hud = $('hud'), touch = $('touch');

  function isTouch() {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches
      || (window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);
  }

  // Balayage circulaire « gun-barrel 007 » : un rond LUMINEUX se forme sur le perso,
  // reste posé ~1 s (statique, pour bien le montrer), puis grandit d'un coup jusqu'à
  // effacer tout l'overlay -> le jeu (déjà rendu derrière) apparaît. Carton à la fin.
  // Réglages :
  const WIPE_IN = 0.45;      // s — apparition : le rond se forme sur le perso
  const WIPE_HOLD = 0.85;    // s — pause statique sur le perso (-15 %)
  const WIPE_GROW = 1.06;    // s — agrandissement final plein écran (+15 % plus rapide)
  function circleWipe(el, done) {
    // centre = position écran du perso (monde -> px CSS fenêtre)
    const ax = viewOffX + (A.x + A.w / 2 - cam.x) * viewScale;
    const ay = viewOffY + (A.y + A.h / 2 - cam.y) * viewScale - 10;   // -10 px : rond un peu plus haut
    const R = Math.hypot(Math.max(ax, winW - ax), Math.max(ay, winH - ay)) + 40;  // jusqu'au coin le plus loin
    const r0 = Math.max(53, A.h * viewScale * 1.254);  // rond posé sur le perso (+10 % de plus : le contient en entier)
    const feather = 2;                                 // bord net (façon 007)

    // anneau lumineux visible, posé au bord du trou (par-dessus l'overlay)
    const ring = document.createElement('div');
    ring.className = 'intro-ring';
    ring.style.cssText = 'position:fixed;border-radius:50%;pointer-events:none;z-index:36;'
      + 'border:3px solid rgba(255,226,130,.95);'
      + 'box-shadow:0 0 26px 7px rgba(255,210,74,.55), inset 0 0 20px rgba(255,210,74,.45);';
    document.body.appendChild(ring);

    const setMask = (r) => {
      const m = `radial-gradient(circle ${r}px at ${ax}px ${ay}px, rgba(0,0,0,0) 0 ${Math.max(0, r - feather)}px, #000 ${r}px)`;
      el.style.webkitMaskImage = m; el.style.maskImage = m;
    };
    const setRing = (r) => {
      ring.style.width = ring.style.height = (2 * r) + 'px';
      ring.style.left = (ax - r) + 'px'; ring.style.top = (ay - r) + 'px';
    };
    const finish = () => {
      el.hidden = true;
      el.style.webkitMaskImage = el.style.maskImage = '';
      ring.remove();
      if (done) done();
    };

    const rStart = Math.max(8, r0 * 0.15);             // tout petit point de départ
    const easeOut = (p) => 1 - Math.pow(1 - p, 3);      // démarrage vif, fin douce
    const smooth = (p) => p * p * (3 - 2 * p);          // smoothstep

    setMask(rStart); setRing(rStart);                  // le rond part minuscule et se forme
    let t0 = null;
    const step = (ts) => {
      if (t0 == null) t0 = ts;
      const t = (ts - t0) / 1000;
      let r, done2 = false;
      if (t < WIPE_IN) {                                // 1) APPARITION : le rond se forme sur le perso
        r = lerp(rStart, r0, easeOut(t / WIPE_IN));
      } else if (t < WIPE_IN + WIPE_HOLD) {            // 2) PAUSE ~1 s : statique sur le perso
        r = r0;
      } else {                                          // 3) AGRANDISSEMENT final -> plein écran
        const p = Math.min(1, (t - WIPE_IN - WIPE_HOLD) / WIPE_GROW);
        const e = smooth(p);
        r = lerp(r0, R, e);
        ring.style.opacity = String(1 - e);            // l'anneau s'estompe en s'ouvrant
        done2 = p >= 1;
      }
      setMask(r); setRing(r);
      if (done2) { finish(); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Met en pause les vidéos de poussière de l'intro (accueil + prélude) : une fois le
  // jeu lancé ces écrans sont masqués, inutile de continuer à décoder du 1080p en boucle
  // par-dessus le rendu canvas 60 fps. Sans effet si les vidéos sont absentes.
  function freezeDust() {
    document.querySelectorAll('.prelude__dust').forEach((v) => { try { v.pause(); } catch (e) {} });
  }

  function startGame() {
    if (state.started) return;
    state.started = true;
    freezeDust();                        // l'intro est finie -> on libère le décodage vidéo
    state.locked = true;                 // entrées gelées pendant le balayage
    state.playMs = 0; state.score = 0; state.scoreSubmitted = false; _lastSec = -1;   // chrono à zéro
    $('progress').hidden = false;        // compteur de progression visible dès le jeu lancé
    $('timer').hidden = false;           // chrono visible juste à droite des projets
    state.map = 0; state.trans = null;
    resumeAudio();
    updateHUD();
    // le rond s'ouvre sur le perso et efface le prélude ; les contrôles tactiles
    // n'apparaissent qu'à la fin du balayage (quand on peut vraiment jouer)
    circleWipe(preludeOv, () => {
      state.locked = false;
      if (isTouch()) touch.hidden = false;
      setTimeout(() => showCard(0), 500);   // le titre « Lille » apparaît juste APRÈS l'ouverture du cercle
    });
  }

  // Raccourci de test (#boss dans l'URL) : démarre direct sur le désert et rejoue la
  // mise en scène "boss" à chaque rafraîchissement. Sans effet en prod (pas de hash).
  function startAtBoss() {
    const last = LEVEL_COUNT - 1;
    state.started = true; state.locked = true; state.trans = null; state.map = last;
    state.playMs = 0; state.score = 0; state.scoreSubmitted = false; _lastSec = -1;
    state.warmth = 1; state.warmthTarget = 1;                 // palette dorée du désert
    $('progress').hidden = false; $('timer').hidden = false;
    // perso au point d'apparition du désert
    const sp = MAP_SPAWN[last] || { x: last * SECTION_W + 90, y: GROUND_Y - A.h };
    A.x = sp.x; A.y = sp.y; A.vx = 0; A.vy = 0; A.onGround = true; A.jumpsLeft = MAX_JUMPS;
    A.lastSafeX = A.x; A.lastSafeY = A.y;
    const mapL = last * SECTION_W;
    cam.x = clamp(A.x + A.w / 2 - viewW * 0.46, mapL, mapL + SECTION_W - viewW);
    cam.y = camRestY();
    $('cover').hidden = true; preludeOv.hidden = true;        // on saute l'accueil + le prélude
    freezeDust();                                             // pas de décodage vidéo pendant le jeu
    hud.hidden = false;
    if (isTouch()) touch.hidden = false;
    // arme + lance la séquence (orbe cachée, musique boss, entrées gelées)
    const cta = orbs.find((o) => o.cta);
    if (cta) cta.scale = 0;
    state.bossDone = false; state.bossPending = false; state.speech = null;
    state.boss = { t: 0, shake: 0, boomed: false, zoom: 1, flash: 0 };
    _musicMode = 'ambient'; applyMapMusic(last);   // force le crossfade vers "The Last Stand"
    resumeAudio(); updateHUD();
  }

  // Raccourci de test (#start dans l'URL) : démarre direct sur la 1re carte (Lille),
  // en sautant l'accueil ET le prélude. Réservé au local (voir le garde isLocal() à l'init).
  function startAtGame() {
    if (state.started) return;
    state.started = true; state.locked = false; state.trans = null; state.map = 0;
    state.playMs = 0; state.score = 0; state.scoreSubmitted = false; _lastSec = -1;
    state.warmth = 0; state.warmthTarget = 0;                 // palette de départ (dusk de Lille)
    $('progress').hidden = false; $('timer').hidden = false;
    resetAvatar();                                            // perso au point d'apparition de la carte 0
    cam.x = 0; cam.y = camRestY();
    $('cover').hidden = true; preludeOv.hidden = true;        // on saute l'accueil + le prélude
    freezeDust();                                             // pas de décodage vidéo pendant le jeu
    hud.hidden = false;
    if (isTouch()) touch.hidden = false;
    resumeAudio(); updateHUD();
    showCard(0);                                              // titre « Lille »
  }

  // Réinitialisation « try-hard » (touche P en plein jeu) : on recommence la run depuis le
  // tout début (Lille), perso au départ, chrono + score + orbes + collection remis à zéro,
  // SANS repasser par l'accueil ni l'écran de fin et SANS balayage -> retour INSTANTANÉ pour
  // enchaîner les tentatives. Appelée seulement quand on joue vraiment (garde dans le keydown).
  function resetRun() {
    state.map = 0; state.trans = null;
    state.warmth = 0; state.warmthTarget = 0; state.collected = 0; state.zone = 0;   // palette dusk de Lille
    state.freeze = 0; state.pendingOrb = null; state.shake = 0; state.cardAlpha = 0; state.cardT = 0;
    state.playMs = 0; state.score = 0; state.scoreSubmitted = false; _lastSec = -1;  // chrono + score à zéro
    state.boss = null; state.bossPending = false; state.bossDone = false; state.speech = null;  // mise en scène boss rejouable
    resetCollection();                                          // cases « cartes à collectionner » revidées
    orbs.forEach((o) => { o.collected = false; o.scale = 1; });  // toutes les orbes ré-affichées (cta ré-armée à l'entrée du désert)
    particles.length = 0; fxAnims.length = 0;
    for (let i = props.length - 1; i >= 0; i--) if (props[i].type === 'ring') props.splice(i, 1);
    clearInput();                                               // pas de touche « collée » après le reset
    resetAvatar();                                              // perso au point d'apparition de Lille
    cam.x = 0; cam.y = camRestY();
    applyMapMusic(0);   // si l'on revenait du boss -> crossfade vers l'ambiance ; déjà en ville -> no-op
    updateHUD();
    showCard(0);                                                // bandeau « Lille » : confirme que la run repart de zéro
    burst(A.x + A.w / 2, A.y + A.h / 2, 22, '#e9d4a2', 220);    // petit éclat chaud de confirmation au départ
  }

  // nombre d'orbes-projets réellement attrapables sur la carte courante (exclut l'orbe « ? » finale)
  function projectOrbCount() { let n = 0; for (const o of orbs) if (!o.cta) n++; return n; }

  // Comptes à l'échelle de TOUTE la partie (les orbes sont reconstruites carte par carte,
  // donc on ne peut pas se fier au seul tableau `orbs` courant) :
  //  - total      = nombre total de projets du portfolio (source = content.js)
  //  - caught     = projets réellement attrapés, en retirant l'orbe finale « ? »
  //    (state.collected est cumulatif sur toute la partie et inclut l'orbe « ? »).
  function totalProjects() { return (C && C.projects && C.projects.length) ? C.projects.length : 0; }
  function caughtProjects() {
    let cta = 0; for (const o of orbs) if (o.cta && o.collected) cta++;   // 1 dès que l'orbe finale est cueillie
    return Math.max(0, state.collected - cta);
  }

  // score courant = (projets attrapés / total) × COMPLETION_POINTS − temps_ms (jamais négatif)
  // Indépendant du nombre de projets (complétion = fraction) et fin à la milliseconde.
  function scoreNow() {
    const total = totalProjects();
    const completion = total > 0 ? Math.min(1, caughtProjects() / total) : 1;
    return Math.max(0, Math.round(completion * COMPLETION_POINTS - state.playMs * TIME_PENALTY_PER_MS));
  }
  // Groupe les milliers avec une VRAIE espace (la fine espace insécable de fr-FR,
  // U+202F, est quasi invisible) : « 971 967 » bien lisible. Le non-rognage/anti-retour
  // à la ligne est géré en CSS (white-space:nowrap + word-spacing).
  function fmtScore(n) { return Math.round(n).toLocaleString('fr-FR').replace(/[  \s]/g, ' '); }

  // chrono affiché dans le HUD : temps de jeu actif, format m:ss
  function fmtTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60), s = total % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }
  let _timerEl = null, _lastSec = -1;
  function paintTimer() {
    const sec = Math.floor(state.playMs / 1000);
    if (sec === _lastSec) return;          // ne redessine qu'au changement de seconde
    _lastSec = sec;
    if (!_timerEl) _timerEl = $('timerText');
    if (_timerEl) _timerEl.textContent = fmtTime(state.playMs);
  }

  function updateHUD() {
    $('progressText').textContent = `${state.collected} / ${projectOrbCount()}`;
    paintTimer();
  }

  /* --- COLLECTION « cartes à collectionner » (desktop) : une case par projet, en bas à
     droite. À la fermeture de la fiche d'un projet attrapé, sa carte vole se ranger dans
     sa case (à son numéro de collection). Masquée en mobile / derrière tout overlay. --- */
  const collectionEl = $('collection');
  let collSlots = [];
  const isDesktopColl = () => !!(window.matchMedia && window.matchMedia('(min-width: 821px)').matches);
  function buildCollectionTray() {
    if (!collectionEl) return;
    const list = (C && C.projects) || [];
    collectionEl.innerHTML = ''; collSlots = [];
    list.forEach((p, i) => {
      const slot = document.createElement('div');
      slot.className = 'collslot' + (p.premium ? ' collslot--gold' : '');
      slot.dataset.idx = String(i);
      const num = document.createElement('span');
      num.className = 'collslot__num';
      num.textContent = String(i + 1).padStart(2, '0');
      slot.appendChild(num);
      if (p.logo) {
        const img = document.createElement('img');
        img.className = 'collslot__logo'; img.alt = ''; img.src = p.logo;   // préchargé, révélé seulement quand rempli
        slot.appendChild(img);
      }
      // clic / Entrée / Espace sur une case PLEINE -> ré-ouvre la fiche du projet
      slot.addEventListener('click', () => reopenProject(i));
      slot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); reopenProject(i); }
      });
      collectionEl.appendChild(slot);
      collSlots.push(slot);
    });
  }
  // une case pleine devient un « bouton » (focusable + libellé) ; vide = inerte
  function setSlotInteractive(slot, p, on) {
    if (on) {
      slot.tabIndex = 0; slot.setAttribute('role', 'button');
      slot.title = (p && p.title) || '';
      slot.setAttribute('aria-label', (p && p.title) ? 'Revoir la fiche : ' + p.title : 'Revoir la fiche');
    } else {
      slot.removeAttribute('tabindex'); slot.removeAttribute('role');
      slot.removeAttribute('title'); slot.removeAttribute('aria-label');
    }
  }
  function resetCollection() {
    collSlots.forEach((s) => { s.classList.remove('collslot--filled', 'collslot--pop'); setSlotInteractive(s, null, false); });
  }
  function fillSlot(idx, pulse) {
    const slot = collSlots[idx]; if (!slot) return;
    slot.classList.add('collslot--filled');
    setSlotInteractive(slot, (C.projects || [])[idx], true);   // case pleine -> cliquable pour rouvrir la fiche
    if (pulse) { slot.classList.remove('collslot--pop'); void slot.offsetWidth; slot.classList.add('collslot--pop'); }
  }
  // ré-ouvre la fiche d'un projet déjà attrapé depuis sa case (re-consultation, PAS une re-collecte)
  function reopenProject(idx) {
    const slot = collSlots[idx];
    if (!slot || !slot.classList.contains('collslot--filled')) return;   // case vide : rien
    const p = (C.projects || [])[idx]; if (!p) return;
    if (modalOv.hidden) openModal({ project: p, premium: !!p.premium });
  }
  let _collVisShown = null;
  function refreshCollectionVis() {
    if (!collectionEl) return;
    const cover = $('cover');
    const anyOverlay = !modalOv.hidden || !contactOv.hidden || !preludeOv.hidden
      || !projectsOv.hidden || (cover && !cover.hidden) || (typeof lboxOpen === 'function' && lboxOpen());
    const show = !!(state.started && !state.ended && isDesktopColl() && !anyOverlay);
    if (show === _collVisShown) return;            // n'écrit le DOM qu'au changement
    _collVisShown = show; collectionEl.hidden = !show;
  }
  // la « carte » (logo du projet) vole de la fiche (fromRect) vers sa case, puis la remplit
  function flyCardToSlot(o, fromRect) {
    const list = (C && C.projects) || [];
    const idx = list.indexOf(o.project);
    if (idx < 0) return;                           // orbe finale « ? » / projet hors collection
    const slot = collSlots[idx]; if (!slot) return;
    const toRect = slot.getBoundingClientRect();
    if (!isDesktopColl() || !fromRect || !toRect.width) { fillSlot(idx, true); return; }
    const fly = document.createElement('div');
    fly.className = 'collfly' + (o.project.premium ? ' collfly--gold' : '');
    if (o.project.logo) {
      const img = document.createElement('img'); img.alt = ''; img.src = o.project.logo; fly.appendChild(img);
    } else {
      const ic = document.createElement('span'); ic.className = 'collfly__ic'; ic.textContent = o.project.icon || '✦'; fly.appendChild(ic);
    }
    fly.style.left = toRect.left + 'px'; fly.style.top = toRect.top + 'px';
    fly.style.width = toRect.width + 'px'; fly.style.height = toRect.height + 'px';
    document.body.appendChild(fly);
    const dx = (fromRect.left + fromRect.width / 2) - (toRect.left + toRect.width / 2);
    const dy = (fromRect.top + fromRect.height / 2) - (toRect.top + toRect.height / 2);
    const startScale = Math.max(2.2, Math.min(7, (fromRect.height * 0.55) / toRect.height));
    const done = () => { fly.remove(); fillSlot(idx, true); };
    if (typeof fly.animate === 'function') {
      const a = fly.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${startScale}) rotate(-7deg)`, opacity: 0 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(${startScale * 0.5}) rotate(-3deg)`, opacity: 1, offset: 0.18 },
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      ], { duration: 660, easing: 'cubic-bezier(.5,.02,.3,1)', fill: 'both' });
      a.onfinish = done; a.oncancel = done;
    } else done();
  }

  /* --- Carrousel de captures d'écran (modal projet) --- */
  let carShots = [], carIdx = 0;
  function buildCarousel(shots) {
    const wrap = $('modalCarousel'), track = $('carouselTrack'), dots = $('carouselDots'), ph = $('modalArtPh');
    const art = $('modalArt');
    if (art) art.style.removeProperty('--shot-ratio');   // recalculé d'après la 1re capture
    carShots = (Array.isArray(shots) ? shots : []).filter(Boolean);
    track.innerHTML = ''; dots.innerHTML = ''; carIdx = 0;
    if (!carShots.length) { wrap.hidden = true; if (ph) ph.hidden = false; return; }   // pas de captures -> vignette logo
    wrap.hidden = false; if (ph) ph.hidden = true;
    carShots.forEach((src, i) => {
      const slide = document.createElement('div'); slide.className = 'carousel__slide';
      const img = document.createElement('img'); img.alt = `Capture ${i + 1}`; img.loading = 'lazy'; img.decoding = 'async';   // decode hors thread principal -> plus de gel a l'ouverture de la carte
      img.onerror = () => { slide.classList.add('carousel__slide--broken'); };
      if (i === 0 && art) {   // cadre au ratio EXACT de la capture -> zéro bande, zéro rognage
        img.addEventListener('load', () => { if (img.naturalWidth) art.style.setProperty('--shot-ratio', img.naturalWidth + ' / ' + img.naturalHeight); });
      }
      img.src = src; slide.appendChild(img); track.appendChild(slide);
      if (i === 0 && art && img.complete && img.naturalWidth) art.style.setProperty('--shot-ratio', img.naturalWidth + ' / ' + img.naturalHeight);
      const dot = document.createElement('button'); dot.type = 'button'; dot.className = 'carousel__dot';
      dot.setAttribute('role', 'tab'); dot.setAttribute('aria-label', `Capture ${i + 1}`);
      dot.addEventListener('click', () => carGo(i)); dots.appendChild(dot);
    });
    wrap.classList.toggle('carousel--single', carShots.length < 2);   // 1 seule capture -> pas de flèches/points
    carGo(0);
  }
  function carGo(i) {
    if (!carShots.length) return;
    carIdx = (i % carShots.length + carShots.length) % carShots.length;
    $('carouselTrack').style.transform = `translateX(${-carIdx * 100}%)`;
    Array.from($('carouselDots').children).forEach((d, k) => d.classList.toggle('is-active', k === carIdx));
  }
  $('carouselPrev').addEventListener('click', () => carGo(carIdx - 1));
  $('carouselNext').addEventListener('click', () => carGo(carIdx + 1));

  /* --- Agrandissement (lightbox) : clic sur un carrousel -> capture en grand
     PAR-DESSUS la pop-up. Générique : marche pour le carrousel de la carte projet
     ET pour celui de la fiche « Tous mes projets ». On lui passe la liste des
     captures + l'index courant + un callback de synchro (pour que le carrousel
     d'origine montre la capture vue quand on referme). --- */
  const lightOv = $('lightbox'), lightImg = $('lightboxImg'), lightCount = $('lightboxCount');
  let lbShots = [], lbIdx = 0, lbSync = null, lbLastFocus = null;
  function lboxOpen() { return lightOv && !lightOv.hidden; }
  function lightRefresh() {
    if (!lbShots.length) return;
    lightImg.src = lbShots[lbIdx];
    lightImg.alt = `Capture ${lbIdx + 1}`;
    if (lightCount) lightCount.textContent = lbShots.length > 1 ? `${lbIdx + 1} / ${lbShots.length}` : '';
    lightOv.classList.toggle('lightbox--single', lbShots.length < 2);
  }
  function openLightbox(shots, idx, sync) {
    const list = (Array.isArray(shots) ? shots : []).filter(Boolean);
    if (!list.length || lboxOpen()) return;
    lbShots = list;
    lbIdx = ((idx | 0) % list.length + list.length) % list.length;
    lbSync = (typeof sync === 'function') ? sync : null;
    lbLastFocus = document.activeElement;       // pour rendre le focus à la fermeture
    lightRefresh();
    lightOv.hidden = false;
    const cb = $('lightboxClose'); if (cb) cb.focus();
  }
  function closeLightbox() {
    if (!lboxOpen()) return;
    lightOv.hidden = true;
    lightImg.removeAttribute('src');
    lbShots = []; lbSync = null;
    // focus de retour là où il était avant l'agrandissement (croix de la carte / vignette)
    try { if (lbLastFocus && document.contains(lbLastFocus)) lbLastFocus.focus(); } catch (e) { /* ignore */ }
    lbLastFocus = null;
  }
  function lightGo(d) {
    if (!lbShots.length) return;
    lbIdx = (lbIdx + d) % lbShots.length; if (lbIdx < 0) lbIdx += lbShots.length;
    lightRefresh();
    if (lbSync) { try { lbSync(lbIdx); } catch (e) { /* synchro best-effort */ } }
  }
  // carrousel de la carte projet (jeu)
  $('carouselTrack').addEventListener('click', () => { if (carShots.length) openLightbox(carShots, carIdx, (k) => carGo(k)); });
  $('lightboxClose').addEventListener('click', closeLightbox);
  $('lightboxPrev').addEventListener('click', () => lightGo(-1));
  $('lightboxNext').addEventListener('click', () => lightGo(1));
  // clic sur le fond (hors image, hors boutons) -> fermer
  lightOv.addEventListener('click', (e) => { if (e.target === lightOv || e.target.classList.contains('lightbox__stage')) closeLightbox(); });

  // Reflet holographique de la carte : un halo lumineux suit le curseur sur
  // l'illustration. Piloté par des variables CSS -> reste actif même en
  // « mouvement réduit » (où l'animation de balayage, elle, est coupée).
  const artEl = $('modalArt');
  if (artEl) {
    artEl.addEventListener('pointermove', (e) => {
      const r = artEl.getBoundingClientRect();
      artEl.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100) + '%');
      artEl.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100) + '%');
      artEl.style.setProperty('--glow', '1');
    });
    artEl.addEventListener('pointerleave', () => artEl.style.setProperty('--glow', '0'));
  }

  let lastFocus = null;
  let _modalOrb = null;   // orbe-projet dont la fiche est ouverte (-> vol vers sa case à la fermeture)
  function openModal(o) {
    state.paused = true; state.pendingOrb = null; state.freeze = 0;
    _modalOrb = o;
    // perso FIGÉ pendant la fiche : update() sort en avance quand on est en pause, donc
    // A.vx n'est plus freiné alors que state.time continue d'avancer -> drawAvatar le ferait
    // « courir sur place ». On coupe la vitesse + l'état de course pour qu'il reste immobile.
    A.vx = 0; A.vy = 0; A.crouch = false; A.sprint = false;
    const p = o.project;
    const premium = !!(o.premium || p.premium);   // carte « GOLD » (orbe doré)
    // logo du site (sinon emoji de secours)
    const iconEl = $('modalIcon'), logoEl = $('modalLogo');
    iconEl.textContent = p.icon || '✦';
    iconEl.classList.toggle('modal__icon--gold', premium);
    if (p.logo) {
      logoEl.alt = p.title || '';
      logoEl.onload = () => { logoEl.hidden = false; iconEl.hidden = true; };
      logoEl.onerror = () => { logoEl.hidden = true; iconEl.hidden = false; };
      logoEl.src = p.logo;
      const ok = logoEl.complete && logoEl.naturalWidth > 0;   // déjà en cache ?
      logoEl.hidden = !ok; iconEl.hidden = ok;
    } else { logoEl.hidden = true; iconEl.hidden = false; logoEl.removeAttribute('src'); }
    $('modalTag').textContent = p.tag || '';   // catégorie en sous-titre (se masque si vide)
    $('modalTitle').textContent = p.title || '';
    $('modalYear').textContent = p.year || '';
    $('modalDesc').textContent = p.description || '';
    $('modalDesc').hidden = !p.description;
    const stack = $('modalStack'); stack.innerHTML = '';
    (p.stack || []).slice(0, 4).forEach((s) => { const li = document.createElement('li'); li.textContent = s; stack.appendChild(li); });
    // Attributs « carte à collectionner » : coût en orbes, rareté, numéro de série
    const costEl = $('modalCost');
    if (costEl) {
      costEl.innerHTML = '';
      costEl.classList.toggle('modal__cost--gold', premium);
      // Pastille ronde : logo du projet (emoji de secours si le logo manque/échoue)
      const costFallback = () => {
        costEl.innerHTML = '';
        const ic = document.createElement('span');
        ic.className = 'modal__costicon';
        ic.textContent = p.icon || '✦';
        costEl.appendChild(ic);
      };
      if (p.logo) {
        const img = document.createElement('img');
        img.className = 'modal__costlogo';
        img.alt = '';
        img.onerror = costFallback;
        img.src = p.logo;
        costEl.appendChild(img);
      } else costFallback();
    }
    const rarEl = $('modalRarity');
    if (rarEl) rarEl.textContent = premium ? '★★★★★' : '★★★★☆';
    const setEl = $('modalSetNum');
    if (setEl) {
      const list = C.projects || [], idx = list.indexOf(p), pad = (n) => String(n).padStart(2, '0');
      setEl.textContent = idx >= 0 ? `N° ${pad(idx + 1)} / ${pad(list.length)}` : '';
    }
    buildCarousel(p.shots);                                   // captures d'écran (carrousel)
    const link = $('modalLink');
    if (p.link) { link.hidden = false; link.href = p.link; link.textContent = (p.linkLabel || 'Voir le projet') + ' ↗'; }
    else link.hidden = true;
    // ----- APPARITION DE LA CARTE : grandit depuis le centre -----
    // Pilotée en JS (Web Animations API) plutôt qu'en CSS : la règle globale
    // « prefers-reduced-motion » fige toutes les animations CSS (popIn/overlayIn),
    // ce qui faisait apparaître la carte d'un coup. La WAAPI y est insensible
    // (même choix que le prélude). Repli vector : popIn CSS sur les vieux nav.
    const card = modalOv.querySelector('.modal__card');
    const waapi = typeof card.animate === 'function';
    if (waapi) { card.style.animation = 'none'; modalOv.style.animation = 'none'; }
    card.style.transformOrigin = 'center center';          // grandit depuis le milieu
    modalOv.hidden = false;
    if (waapi) {
      card.getAnimations().forEach((a) => a.cancel());     // évite l'empilement à chaque ouverture
      modalOv.getAnimations().forEach((a) => a.cancel());
      modalOv.animate([{ opacity: 0 }, { opacity: 1 }],    // voile sombre en fondu doux
        { duration: 340, easing: 'ease-out', fill: 'both' });
      card.animate([                                       // grandit POSÉMENT depuis le centre, éclat chaud, léger rebond
        { opacity: 0, transform: 'scale(.25)', filter: 'brightness(1.5) saturate(1.1)' },
        { opacity: 1, offset: .72, transform: 'scale(1.03)', filter: 'brightness(1.12)' },
        { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' },
      ], { duration: 720, easing: 'cubic-bezier(.32,.5,.35,1)', fill: 'both' });
    }
    // accessibilité : focus dans la modal (le HUD reste actif -> son + projets toujours dispo)
    lastFocus = document.activeElement;
    const closeBtn = modalOv.querySelector('.modal__close');
    if (closeBtn) closeBtn.focus();
    refreshCollectionVis();   // la collection se cache derrière la fiche
  }

  function closeModal() {
    if (modalOv.hidden) return;
    closeLightbox();        // referme un éventuel agrandissement posé par-dessus
    const flyOrb = _modalOrb; _modalOrb = null;
    const card = modalOv.querySelector('.modal__card');
    const fromRect = card ? card.getBoundingClientRect() : null;   // position de la carte AVANT de masquer
    modalOv.hidden = true;
    state.paused = false;
    A.scaleX = 1.15; A.scaleY = 0.9;     // petit rebond joyeux à la reprise
    blip(520, 0.12, 'sine', 0.05);
    // on restaure le focus là où il était (ou sur un repère stable)
    try { (lastFocus && document.contains(lastFocus) ? lastFocus : $('muteBtn')).focus(); } catch (e) { /* ignore */ }
    refreshCollectionVis();   // la collection réapparaît (case visible pour recevoir la carte)
    if (flyOrb && flyOrb.project) flyCardToSlot(flyOrb, fromRect);   // la carte vole se ranger dans sa case
  }

  /* -------------------------------------------------------------------------
     FERMER LA FICHE EN SECOUANT LE TÉLÉPHONE (mobile : pas de clavier).
     On exige une VRAIE secousse : plusieurs à-coups francs et rapprochés
     (va-et-vient), pas un simple déplacement ni une rotation lente. La croix
     « ✕ » de la carte reste un filet (notamment si la permission iOS est
     refusée). Le texte d'aide est adapté plus bas (setupShakeToClose).
     ------------------------------------------------------------------------- */
  let _motionAsked = false, _motionOn = false;
  function attachMotion() {
    if (_motionOn) return;
    _motionOn = true;
    let lx = null, ly = null, lz = null, lastFire = 0;
    const jolts = [];        // horodatages des à-coups francs
    const JOLT = 16;         // m/s² : seuil d'un à-coup (mouvement vif, pas un glissement)
    const NEED = 3;          // nombre d'à-coups...
    const WIN = 1000;        // ...dans cette fenêtre glissante (ms) -> impose le va-et-vient
    const COOLDOWN = 1200;   // anti-rebond après une fermeture
    window.addEventListener('devicemotion', (e) => {
      if (modalOv.hidden) { jolts.length = 0; lx = null; return; }   // n'agit QUE carte ouverte
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a || a.x == null) return;
      const now = performance.now();
      if (lx !== null) {
        const d = Math.abs(a.x - lx) + Math.abs(a.y - ly) + Math.abs(a.z - lz);
        if (d > JOLT) {
          jolts.push(now);
          while (jolts.length && now - jolts[0] > WIN) jolts.shift();
          if (jolts.length >= NEED && now - lastFire > COOLDOWN) {
            lastFire = now; jolts.length = 0;
            try { if (navigator.vibrate) navigator.vibrate(28); } catch (e2) { /* vibration optionnelle */ }
            closeModal();
          }
        }
      }
      lx = a.x; ly = a.y; lz = a.z;
    });
  }
  // iOS 13+ : la permission « capteurs de mouvement » DOIT être demandée dans un geste utilisateur.
  function ensureMotionPermission() {
    if (_motionAsked) return;
    _motionAsked = true;
    const DM = window.DeviceMotionEvent;
    if (DM && typeof DM.requestPermission === 'function') {
      DM.requestPermission().then((res) => { if (res === 'granted') attachMotion(); })
        .catch(() => { /* refus : la croix « ✕ » reste disponible */ });
    } else {
      attachMotion();   // Android / navigateurs sans portail de permission
    }
  }
  function setupShakeToClose() {
    if (!isTouch()) return;   // desktop : on garde l'astuce clavier Échap / Entrée
    const r = $('modalResume');
    if (r) { r.innerHTML = '<span class="shake-em">Secoue ton téléphone</span> pour reprendre'; r.hidden = false; }
    // on réclame la permission au 1er geste utilisateur (clic « Jouer » ou tout premier appui)
    ['coverPlay', 'preludeBtn'].forEach((id) => {
      const el = $(id); if (el) el.addEventListener('click', ensureMotionPermission);
    });
    window.addEventListener('pointerdown', ensureMotionPermission, { once: true });
  }

  function endGame() {
    state.ended = true;
    // MUSIQUE DE FIN : « The Last Stand » (et toute autre ambiance) sort en fondu, la
    // piste de fin entre par-dessus (depuis le début). Crossfade, jamais de coupure sèche.
    _musicMode = 'end';
    const _endTarget = state.musicMuted ? 0 : state.musicVolume;
    fadeAudio(bgIntro, 0, MUSIC_FADE);
    fadeAudio(bgLoop, 0, MUSIC_FADE);
    fadeAudio(bgBoss, 0, MUSIC_FADE);
    fadeAudio(bgEnd, _endTarget * END_MUSIC_GAIN, MUSIC_FADE, { keep: true, restart: true });
    // écran de fin FUSIONNÉ : remerciement + message « et si le prochain projet était le vôtre ? » + contact
    $('contactKicker').textContent = C.contact.headline || 'Merci d\'avoir joué !';
    $('contactTitle').innerHTML = CTA_PROJECT.title.replace(' était', '<br>était');   // sur deux lignes (chaîne fixe, sûre)
    $('contactSubtitle').textContent = CTA_PROJECT.description;  // « Une idée, un poste… écrivez-moi. »
    const ul = $('contactLinks'); ul.innerHTML = '';
    (C.contact.links || []).forEach((l) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      // allowlist de schémas : on n'attache un href que s'il est sûr
      const href = (l.href || '').trim();
      if (/^(https?:|mailto:|tel:)/i.test(href)) {
        a.href = href;
        if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      }
      // texte injecté en toute sécurité (textContent), avec valeurs par défaut
      const mk = (cls, txt) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; return s; };
      a.append(mk('ci', l.icon || '•'), mk('cl', l.label || ''), mk('cv', l.value || ''));
      li.appendChild(a); ul.appendChild(li);
    });
    prepareScoreUI();          // score final + formulaire pseudo + chargement du classement
    // HUD laissé VISIBLE à l'écran de fin (son + « Mes projets » + « Classement » restent
    // accessibles) ; le cas « on est à la fin » est géré dans openLeaderboard/openProjects/closeFull.
    contactOv.hidden = false;
    // vue modale : on amène le focus sur le dialogue (parité avec #modal / #projets)
    try { contactOv.focus({ preventScroll: true }); } catch (e) { /* focus non critique */ }
    // geyser de lucioles
    for (let i = 0; i < 60; i++)
      spawn(A.x + A.w / 2 + (rnd() - 0.5) * 120, GROUND_Y, (rnd() - 0.5) * 120, -200 - rnd() * 300, 1 + rnd(), 2 + rnd() * 3, rgbStr(P.accentGlow), 'lighter', 0.5);
    blip(660, 0.3, 'sine', 0.07); setTimeout(() => blip(990, 0.4, 'triangle', 0.06), 150);
  }

  /* =========================================================================
     CLASSEMENT MONDIAL (API)
     -------------------------------------------------------------------------
     - En prod (Vercel) : l'API est same-origin sous "/api".
     - En dev local (jeu servi par python sur un autre port) : l'API Express
       tourne sur le port 8792. Surcharge possible via window.STEDI_API.
     Tout est en dégradation propre : si l'API est injoignable, l'écran de fin
     reste utilisable, seul le classement disparaît.
     ========================================================================= */
  const API_BASE = (function () {
    try {
      if (window.STEDI_API) return String(window.STEDI_API).replace(/\/+$/, '');
      const h = location.hostname;
      if ((h === 'localhost' || h === '127.0.0.1') && location.port && location.port !== '8792') {
        return `${location.protocol}//${h}:8792/api`;
      }
    } catch (e) { /* file:// : pas d'API, dégradation propre */ }
    return '/api';
  })();

  async function apiJSON(path, opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs;            // surcharge : en local on échoue VITE pour basculer sur la démo
    const fetchOpts = Object.assign({}, opts); delete fetchOpts.timeoutMs;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs || (isLocal() ? 1000 : 7000));
    try {
      const res = await fetch(API_BASE + path, Object.assign(
        { signal: ctrl.signal, headers: { 'Content-Type': 'application/json' } }, fetchOpts));
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
      return data;
    } finally { clearTimeout(to); }
  }

  function ordinalFr(n) { return n === 1 ? '1er' : (n + 'ᵉ'); }

  function renderLeaderboard(top, you) {
    const board = $('leaderboard'), list = $('lbList');
    if (!board || !list) return;
    list.innerHTML = '';
    if (!top || !top.length) {
      const li = document.createElement('li');
      li.className = 'leaderboard__empty';
      li.textContent = 'Sois le premier à inscrire un score !';
      list.appendChild(li);
    } else {
      let youMarked = false;
      top.slice(0, 10).forEach((row, i) => {   // carte : top 10 (la liste paginée complète est dans la vue « Classement »)
        const li = document.createElement('li');
        li.className = 'lb-row';
        if (!youMarked && you && row.name === you.name && row.score === you.score) { li.classList.add('lb-row--you'); youMarked = true; }
        const r = document.createElement('span'); r.className = 'lb-row__rank'; r.textContent = '#' + (row.rank != null ? row.rank : (i + 1));
        const nm = document.createElement('span'); nm.className = 'lb-row__name'; nm.textContent = row.name;
        const sc = document.createElement('span'); sc.className = 'lb-row__score'; sc.textContent = fmtScore(row.score) + ' pts';
        li.append(r, nm, sc);
        list.appendChild(li);
      });
    }
    const youEl = $('lbYou');
    if (youEl) {
      if (you && you.rank) {
        const inTop = you.rank <= (top ? top.length : 0) && you.rank <= 10;
        youEl.hidden = false;
        youEl.textContent = inTop
          ? `Tu es ${ordinalFr(you.rank)} 🎉`
          : `Toi : ${ordinalFr(you.rank)}, ${fmtScore(you.score)} pts`;
      } else youEl.hidden = true;
    }
    board.hidden = false;
  }

  // loader du mini-classement (carte de fin) : même esprit que la vue complète
  function showMiniLbLoader(on) {
    const body = document.querySelector('.contact__body--rank');
    if (body) body.classList.toggle('is-loading', !!on);
    const ld = $('lbMiniLoader'); if (ld) ld.hidden = !on;
    if (on) {                              // pendant le chargement, la liste laisse la place au loader
      const board = $('leaderboard'); if (board) board.hidden = true;
      const youEl = $('lbYou'); if (youEl) youEl.hidden = true;
    }
  }

  async function loadLeaderboard() {
    showMiniLbLoader(true);
    try {
      const data = await apiJSON('/leaderboard?limit=10', { method: 'GET' });
      showMiniLbLoader(false);
      renderLeaderboard(data.top, null);
    } catch (e) {
      if (isLocal()) {                     // démo locale : on montre le loader un court instant (parité vue complète)
        await new Promise((r) => setTimeout(r, 350));
        showMiniLbLoader(false);
        renderLeaderboard(mockFull().slice(0, 10), null);
        return;
      }
      showMiniLbLoader(false);
      const board = $('leaderboard');
      if (board) board.hidden = true;      // hors-ligne (prod) : on masque simplement le classement
    }
  }

  // Prépare l'écran de fin : score final + formulaire réarmé (vue « cartes »).
  function prepareScoreUI() {
    state.score = scoreNow();
    lastYou = null;                                                   // nouvelle partie : aucun score envoyé pour l'instant
    $('contactFull').hidden = true; $('contactDeck').hidden = false; $('contactFooter').hidden = false;  // on (re)part toujours sur la vue « cartes »
    $('finalScore').textContent = fmtScore(state.score);

    const form = $('lbForm'), input = $('pseudoInput'), btn = $('lbSubmit'), hint = $('lbHint');
    if (form) form.hidden = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Valider'; }
    if (hint) hint.textContent = '';
    if (input) {
      input.disabled = false;
      try { input.value = localStorage.getItem('stedi_pseudo') || ''; } catch (e) { /* localStorage off */ }
    }
    loadLeaderboard();
  }

  async function submitScore() {
    if (state.scoreSubmitted) return;
    const input = $('pseudoInput'), btn = $('lbSubmit'), hint = $('lbHint');
    const name = ((input && input.value) || '').trim();
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    if (hint) hint.textContent = 'Envoi…';
    try {
      const data = await apiJSON('/scores', {
        method: 'POST',
        body: JSON.stringify({ name, projects: caughtProjects(), total: totalProjects(), timeMs: Math.round(state.playMs) }),
      });
      state.scoreSubmitted = true;
      try { if (data.name) localStorage.setItem('stedi_pseudo', data.name); } catch (e) { /* localStorage off */ }
      $('finalScore').textContent = fmtScore(data.score);   // score serveur = autorité
      if (input) input.disabled = true;
      if (btn) { btn.disabled = true; btn.textContent = 'Enregistré ✓'; }
      if (hint) hint.textContent = '';
      lastYou = { name: data.name, score: data.score };
      renderLeaderboard(data.top, { name: data.name, score: data.score, rank: data.rank });
      blip(880, 0.16, 'triangle', 0.06);
    } catch (e) {
      // Score refusé par le serveur (anti-triche : temps physiquement impossible).
      const why = (e && e.message) || '';
      if (why === 'too_fast') {
        state.scoreSubmitted = false;
        if (input) input.disabled = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Valider'; }
        if (hint) hint.textContent = 'Temps trop court pour être valide, score non enregistré.';
        return;
      }
      if (isLocal()) {                               // démo locale : on insère le joueur dans le jeu de test pour tout tester
        const nm = (name || 'Toi').slice(0, 24);
        lastYou = { name: nm, score: state.score };
        const all = mockFull();
        const found = all.find((r) => r.name === nm && r.score === state.score);
        state.scoreSubmitted = true;
        if (input) input.disabled = true;
        if (btn) { btn.disabled = true; btn.textContent = 'Enregistré ✓'; }
        if (hint) hint.textContent = '';
        renderLeaderboard(all.slice(0, 10), { name: nm, score: state.score, rank: found ? found.rank : all.length });
        blip(880, 0.16, 'triangle', 0.06);
        return;
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Réessayer'; }
      if (hint) hint.textContent = 'Classement indisponible pour le moment. Ton score reste affiché.';
    }
  }

  /* --- CLASSEMENT COMPLET : vue plein écran (recherche + pagination) ---------
     En local (l'API ne tourne pas), on bascule sur un jeu de DÉMO : ainsi tout
     est testable (liste, pagination, recherche, envoi de score). ------------- */
  const LB_PAGE = 10;
  let lbPage = 0, lbTotal = 0, lbQuery = '', lastYou = null;
  let lbCache = {};       // clé `${q}|${offset}` -> { top, total } : évite de re-fetcher une page déjà vue
  let lbReq = 0;          // id de requête : on ignore les réponses périmées (course pagination/recherche)
  let lbSearchTimer = 0;  // anti-rebond de la recherche
  function isLocal() {
    try { return /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:'; }
    catch (e) { return false; }
  }
  function lbMock() {
    const first = ['Mira','Tib','Lou','Naël','Eva','Yann','Sacha','Inès','Tom','Léa','Hugo','Jade','Noé','Lina','Maël','Zoé','Axel','Romy','Élio','Nina','Gabin','Suzy','Owen','Lila','Aaron','Manon','Ezra','Anna','Ravi','Sira','Théo','Maya','Liam','Rose','Adam','Kenzo','Élise','Marius','Soren','Alba','Noah','Iris','Téo','Wendy','Otis','Cléa'];
    const last = ['L.','M.','R.','D.','B.','G.','F.','V.','C.','P.','S.','T.','N.','A.','H.','J.'];
    return first.map((n, i) => {
      // temps croissants avec des ms variées -> scores tous distincts (test « pas d'ex aequo »)
      const timeMs = 26000 + i * 3100 + ((i * 877) % 1000);
      return {
        name: n + ' ' + last[i % last.length],
        score: Math.max(0, Math.round(COMPLETION_POINTS - timeMs)),   // complétion 100 % − temps_ms
        projects: 9,
        timeMs,
      };
    }).sort((a, b) => b.score - a.score);
  }
  // rang de COMPÉTITION (ex aequo = même rang), aligné sur l'API (db.addScore)
  function withRanks(arr) {
    return arr.slice().sort((a, b) => b.score - a.score)
      .map((r, _i, a) => ({ ...r, rank: a.filter((x) => x.score > r.score).length + 1 }));
  }
  function mockFull() {
    let all = lbMock();
    if (lastYou) all = all.concat([{ name: lastYou.name, score: lastYou.score, projects: caughtProjects(), timeMs: Math.round(state.playMs) }]);
    return withRanks(all);
  }
  function lbRowEl(row, rank, markYou) {
    const li = document.createElement('li');
    li.className = 'lb-row' + (markYou ? ' lb-row--you' : '');
    const r = document.createElement('span'); r.className = 'lb-row__rank'; r.textContent = '#' + rank;
    const nm = document.createElement('span'); nm.className = 'lb-row__name'; nm.textContent = row.name;
    const sc = document.createElement('span'); sc.className = 'lb-row__score'; sc.textContent = fmtScore(row.score) + ' pts';
    li.append(r, nm, sc);
    return li;
  }
  // récupère UNE page (10) depuis le back. En local (API absente), on sert directement
  // la démo paginée (petit délai pour montrer le loader, sans attendre un timeout réseau).
  async function fetchLbPage(offset, q) {
    if (isLocal()) {
      await new Promise((r) => setTimeout(r, 350));
      let all = mockFull();
      if (q) { const low = q.toLowerCase(); all = all.filter((r) => r.name.toLowerCase().includes(low)); }
      return { top: all.slice(offset, offset + LB_PAGE), total: all.length };
    }
    const path = `/leaderboard?limit=${LB_PAGE}&offset=${offset}` + (q ? `&q=${encodeURIComponent(q)}` : '');
    const data = await apiJSON(path, { method: 'GET' });
    return { top: data.top || [], total: (data.total != null ? data.total : (data.top || []).length) };
  }
  function showLbLoader(on) {
    const ld = $('lbLoader'); if (ld) ld.hidden = !on;
    // pendant le chargement on RETIRE les noms (liste masquée) ; le loader prend sa place (hauteur figée par le panneau)
    const list = $('lbFullList'); if (list) { list.style.display = on ? 'none' : ''; list.setAttribute('aria-busy', on ? 'true' : 'false'); }
    const em = $('lbFullEmpty'); if (em && on) em.hidden = true;   // pas de message « vide » pendant le chargement
  }
  // charge la page demandée (depuis le cache si déjà vue, sinon fetch « 10 par 10 » avec loader)
  async function loadFullPage(page) {
    lbPage = Math.max(0, page);
    const offset = lbPage * LB_PAGE;
    const key = lbQuery + '|' + offset;
    const myReq = ++lbReq;   // invalide tout fetch en vol, MÊME sur un cache-hit (anti-course)
    if (lbCache[key]) { showLbLoader(false); renderFullData(lbCache[key]); return; }
    showLbLoader(true);
    let data;
    try { data = await fetchLbPage(offset, lbQuery); }
    catch (e) { if (myReq === lbReq) { showLbLoader(false); renderFullError(); } return; }
    if (myReq !== lbReq) return;                       // réponse périmée : l'utilisateur a déjà changé de page/recherche
    lbCache[key] = data; showLbLoader(false); renderFullData(data);
  }
  function renderFullData(data) {
    const top = data.top || [];
    lbTotal = data.total || 0;
    const pages = Math.max(1, Math.ceil(lbTotal / LB_PAGE));
    if (lbPage >= pages) lbPage = pages - 1;
    const list = $('lbFullList'); list.innerHTML = '';
    let youMarked = false;   // on ne surligne qu'UNE ligne (homonymes au même score)
    top.forEach((row, i) => {
      const isYou = !youMarked && lastYou && row.name === lastYou.name && row.score === lastYou.score;
      if (isYou) youMarked = true;
      list.appendChild(lbRowEl(row, row.rank != null ? row.rank : (lbPage * LB_PAGE + i + 1), isYou));
    });
    const em = $('lbFullEmpty'); if (em) { em.hidden = lbTotal > 0; em.textContent = 'Aucun nom ne correspond à ta recherche.'; }
    $('lbPageInfo').textContent = (lbTotal ? (lbPage + 1) : 0) + ' / ' + pages;
    const prev = $('lbPrev'), next = $('lbNext'), ae = document.activeElement;
    prev.disabled = lbPage <= 0;
    next.disabled = lbPage >= pages - 1;
    // a11y : si le bouton qui avait le focus vient d'être désactivé, on déplace le focus (sinon il retombe sur <body>)
    try {
      if (ae === next && next.disabled) (prev.disabled ? $('lbSearch') : prev).focus({ preventScroll: true });
      else if (ae === prev && prev.disabled) (next.disabled ? $('lbSearch') : next).focus({ preventScroll: true });
    } catch (e) { /* focus non critique */ }
    const st = $('lbFullStatus'); if (st) st.textContent = lbTotal ? (lbTotal + ' joueur' + (lbTotal > 1 ? 's' : '')) : 'Aucun résultat';
  }
  function renderFullError() {
    const list = $('lbFullList'); if (list) { list.innerHTML = ''; list.style.opacity = ''; }
    const em = $('lbFullEmpty'); if (em) { em.hidden = false; em.textContent = 'Classement indisponible pour le moment.'; }
    $('lbPageInfo').textContent = '0 / 0';
    $('lbPrev').disabled = true; $('lbNext').disabled = true;
  }
  let lbFromHud = false;   // true = classement ouvert via le bouton du HUD (en cours de partie) -> à la fermeture on revient au jeu, pas aux cartes de fin
  function openFull() {
    $('contactDeck').hidden = true; $('contactFooter').hidden = true;
    $('contactFull').hidden = false;
    contactOv.setAttribute('aria-labelledby', 'lbFullTitle');
    lbQuery = ''; lbCache = {}; const s = $('lbSearch'); if (s) s.value = '';
    loadFullPage(0);
    try { $('lbSearch').focus({ preventScroll: true }); } catch (e) { /* focus non critique */ }
  }
  // classement « n'importe où » : ouvre la vue plein écran par-dessus le jeu (sans écran de fin)
  function openLeaderboard() {
    if (!modalOv.hidden) closeModal();              // évite l'empilement avec un popup projet
    if (!projectsOv.hidden) closeProjects();        // ni avec la vue « Mes projets »
    if (typeof openAudioPanel === 'function') openAudioPanel(false);
    if (state.ended) {
      // déjà sur l'écran de fin : on ouvre la vue classement PAR-DESSUS les cartes
      // (fermeture -> retour aux cartes, exactement comme le bouton « Classement » du footer).
      lbFromHud = false;
      openFull();
      return;
    }
    lbFromHud = true;
    state.paused = true;                            // on fige le jeu pendant la lecture
    // l'overlay contact est en z-index 30 (sous l'accueil 38 / le prélude 35 / les projets 45) :
    // ouvert depuis le HUD il doit passer AU-DESSUS de ces écrans, sinon il s'affiche derrière.
    contactOv.style.zIndex = '50';
    contactOv.hidden = false;
    openFull();
  }
  function closeFull() {
    $('contactFull').hidden = true;
    $('contactDeck').hidden = false; $('contactFooter').hidden = false;   // toujours prêt pour le vrai écran de fin
    contactOv.setAttribute('aria-labelledby', 'contactTitle');
    lbCache = {};   // on repart frais à la réouverture (le classement est vivant en prod)
    const fromHud = lbFromHud; lbFromHud = false;
    // ouvert depuis le HUD EN COURS DE PARTIE -> on referme tout et on reprend le jeu.
    // À l'écran de fin (state.ended), on revient TOUJOURS aux cartes (jamais coincé sur la map).
    if (fromHud && !state.ended) {
      contactOv.hidden = true;
      contactOv.style.zIndex = '';   // on rend l'overlay à son z-index normal (écran de fin)
      state.paused = false;
      try { $('lbBtn').focus({ preventScroll: true }); } catch (e) { /* focus non critique */ }
      return;
    }
    try { $('lbOpenFull').focus({ preventScroll: true }); } catch (e) { /* focus non critique */ }
  }
  function onLbSearch() {
    const v = (($('lbSearch') && $('lbSearch').value) || '').trim();
    clearTimeout(lbSearchTimer);
    lbSearchTimer = setTimeout(() => {
      if (v === lbQuery) return;
      lbQuery = v; lbCache = {}; loadFullPage(0);   // nouvelle recherche : page 1, cache vidé
    }, 300);
  }

  function replay() {
    if (!state.ended) return;            // garde anti double-clic : on n'enchaîne qu'UN seul « Rejouer » à la fois
    const endCard = contactOv.querySelector('.contact__deck');
    const footer = $('contactFooter');
    if (endCard) endCard.style.visibility = 'hidden';   // cartes + boutons se FERMENT tout de suite au clic
    if (footer) footer.style.visibility = 'hidden';
    state.ended = false; state.paused = false; state.map = 0; state.trans = null;
    state.warmth = 0; state.warmthTarget = 0; state.collected = 0; state.zone = 0;
    state.freeze = 0; state.pendingOrb = null; state.shake = 0; state.time = 0;  // reset complet du cycle
    resetCollection();   // collection vidée : nouvelle partie -> cases à re-remplir
    state.playMs = 0; state.score = 0; state.scoreSubmitted = false; _lastSec = -1; // chrono + score remis à zéro
    state.boss = null; state.bossPending = false; state.bossDone = false; state.speech = null;   // mise en scène "boss" rejouable
    // « Rejouer » : on relance la musique comme au tout premier lancement -> l'intro repart de 0, puis enchaîne sur la boucle.
    _musicMode = 'ambient';
    const _mt = state.musicMuted ? 0 : state.musicVolume;
    fadeAudio(bgBoss, 0, MUSIC_FADE);                                       // "The Last Stand" sort en fondu
    fadeAudio(bgEnd, 0, MUSIC_FADE);                                        // coupe la musique de fin si elle tournait
    fadeAudio(bgLoop, 0, MUSIC_FADE);                                       // coupe la boucle si elle tournait
    fadeAudio(bgIntro, _mt, MUSIC_FADE, { keep: true, restart: true });     // l'intro reprend depuis le début
    orbs.forEach((o) => { o.collected = false; o.scale = 1; });             // orbes ré-affichées en grand
    particles.length = 0; fxAnims.length = 0;
    for (let i = props.length - 1; i >= 0; i--) if (props[i].type === 'ring') props.splice(i, 1);
    resetAvatar();
    cam.x = 0; cam.y = camRestY();
    updateHUD();
    touch.hidden = true;   // masque les contrôles tactiles pendant le balayage
    state.locked = true;   // (le jeu est déjà "started") -> on rejoue après le balayage
    circleWipe(contactOv, () => {
      if (endCard) endCard.style.visibility = '';   // restaure cartes + boutons pour la prochaine fin de partie
      if (footer) footer.style.visibility = '';
      state.locked = false;
      if (isTouch()) touch.hidden = false;   // réapparaissent quand on peut jouer
      setTimeout(() => showCard(0), 500);    // le titre apparaît juste après le cercle
    });
  }

  // Croix des cartes de fin : RETOUR à l'écran d'accueil (prélude « L'épopée… »), prêt à
  // rejouer via « Jouer ». (Le bouton « Rejouer » du footer, lui, relance directement.)
  function backToPrelude() {
    if (!state.ended) return;
    // reset COMPLET de la partie (même base que replay), mais on s'arrête sur le prélude
    state.ended = false; state.started = false; state.paused = false; state.locked = false;
    state.map = 0; state.trans = null;
    state.warmth = 0; state.warmthTarget = 0; state.collected = 0; state.zone = 0;
    state.freeze = 0; state.pendingOrb = null; state.shake = 0; state.time = 0;
    resetCollection();
    state.playMs = 0; state.score = 0; state.scoreSubmitted = false; _lastSec = -1;
    state.boss = null; state.bossPending = false; state.bossDone = false; state.speech = null;
    // musique : retour à l'ambiance d'intro (depuis le début)
    _musicMode = 'ambient';
    const _mt = state.musicMuted ? 0 : state.musicVolume;
    fadeAudio(bgBoss, 0, MUSIC_FADE); fadeAudio(bgEnd, 0, MUSIC_FADE); fadeAudio(bgLoop, 0, MUSIC_FADE);
    fadeAudio(bgIntro, _mt, MUSIC_FADE, { keep: true, restart: true });
    orbs.forEach((o) => { o.collected = false; o.scale = 1; });
    particles.length = 0; fxAnims.length = 0;
    for (let i = props.length - 1; i >= 0; i--) if (props[i].type === 'ring') props.splice(i, 1);
    resetAvatar();
    cam.x = 0; cam.y = camRestY();
    updateHUD();
    // on referme l'écran de fin et on rouvre le prélude
    const deck = contactOv.querySelector('.contact__deck'); if (deck) deck.style.visibility = '';
    const footer = $('contactFooter'); if (footer) footer.style.visibility = '';
    $('contactFull').hidden = true; $('contactDeck').hidden = false; $('contactFooter').hidden = false;
    contactOv.setAttribute('aria-labelledby', 'contactTitle');
    contactOv.hidden = true; contactOv.style.zIndex = '';
    touch.hidden = true;
    $('progress').hidden = true; $('timer').hidden = true;   // pas encore en jeu
    // efface le bandeau « chapitre » (sinon « À suivre… / Et si le prochain projet… » reste affiché sur l'accueil)
    const ch = $('chapter'); if (ch) ch.classList.remove('is-show');
    $('chapterName').textContent = ''; $('chapterSub').textContent = '';
    state.cardName = ''; state.cardSub = ''; state.cardT = 0;
    hud.hidden = false;                                      // barre HUD visible comme sur le prélude normal
    // poussière féérique du prélude réveillée (figée au lancement du jeu)
    preludeOv.querySelectorAll('.prelude__dust').forEach((v) => { try { v.play(); } catch (e) { /* lecture optionnelle */ } });
    const pin = preludeOv.querySelector('.prelude__inner'); if (pin) pin.style.opacity = '1';   // contenu visible (sécurité)
    preludeOv.hidden = false;
    try { $('preludeBtn').focus({ preventScroll: true }); } catch (e) { /* focus non critique */ }
  }

  // câblage des boutons
  $('preludeBtn').addEventListener('click', startGame);   // « Jouer » (prélude) -> iris + jeu direct
  $('replayBtn').addEventListener('click', replay);
  // envoi du score au classement mondial (écran de fin)
  const lbForm = $('lbForm');
  if (lbForm) lbForm.addEventListener('submit', (e) => { e.preventDefault(); submitScore(); });
  // --- écran de fin : croix d'angle (= retour accueil) + vue « classement complet » (recherche + pagination) ---
  // La croix des cartes ramène à l'écran d'accueil (prélude) ; le bouton « Rejouer » du footer relance direct.
  // La vue classement se referme par « Retour », sa propre croix, ou Échap -> retour aux cartes.
  contactOv.querySelectorAll('[data-close-contact]').forEach((el) => el.addEventListener('click', backToPrelude));
  $('lbFullClose').addEventListener('click', closeFull);
  $('lbOpenFull').addEventListener('click', () => { lbFromHud = false; openFull(); });   // depuis l'écran de fin -> retour aux cartes
  if ($('lbBtn')) $('lbBtn').addEventListener('click', openLeaderboard);                 // bouton du HUD -> classement « n'importe où »
  $('lbBack').addEventListener('click', closeFull);
  // clic EN DEHORS de la pop up « Classement » -> on referme quoi qu'il arrive
  // (retour aux cartes de fin, ou reprise du jeu si elle a été ouverte depuis le HUD).
  contactOv.addEventListener('click', (e) => {
    // UNIQUEMENT le fond de l'overlay (pas un bouton enfant : sinon le clic qui OUVRE la
    // vue via « Classement » remonterait jusqu'ici et la refermerait aussitôt).
    if (!$('contactFull').hidden && e.target === contactOv) closeFull();
  });
  $('lbSearch').addEventListener('input', onLbSearch);
  $('lbPrev').addEventListener('click', () => loadFullPage(lbPage - 1));
  $('lbNext').addEventListener('click', () => loadFullPage(lbPage + 1));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('contactFull').hidden) closeFull();   // vue classement -> retour aux cartes
  });

  // --- Vue « Mes projets » : accès direct à tous les projets, sans jouer ---
  const projectsOv = $('projects');
  const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let projectsBuilt = false;
  function buildProjectsView() {
    if (projectsBuilt) return;
    const list = $('projectsGrid'); list.innerHTML = '';
    (C.projects || []).forEach((p) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'prow' + (p.premium ? ' prow--premium' : '');
      const orbInner = p.logo
        ? `<img src="${escHtml(p.logo)}" alt="" onerror="this.closest('.prow__orb').textContent='${escHtml(p.icon || '✦')}'">`
        : escHtml(p.icon || '✦');
      // slug du projet (dossier assets/projets/<slug>/) -> permet de cibler un projet précis en CSS
      const slug = (p.logo || '').replace(/.*\/projets\//, '').split('/')[0] || '';
      row.innerHTML =
        `<span class="prow__orb"${slug ? ` data-project="${escHtml(slug)}"` : ''}>${orbInner}</span>`
        + `<span class="prow__meta"><h3 class="prow__title">${escHtml(p.title || '')}</h3>`
        + `<p class="prow__tag">${escHtml(p.tag || 'Projet')}</p></span>`
        + `<span class="prow__go" aria-hidden="true">›</span>`;
      row.addEventListener('click', () => showProjectDetail(p));
      list.appendChild(row);
    });
    const sub = $('projectsSub');
    if (sub) sub.textContent = `${(C.projects || []).length} projets`;
    projectsBuilt = true;
  }
  // Carrousel de captures autonome pour la fiche projet du panneau
  // (mêmes classes .carousel que la carte à collectionner -> rendu identique).
  function pdetailCarouselHTML(shots) {
    const list = (shots || []).filter(Boolean);
    if (!list.length) return '';
    const slides = list.map((s, i) =>
      `<div class="carousel__slide"><img src="${escHtml(s)}" alt="Capture ${i + 1}" loading="lazy" decoding="async" onerror="this.closest('.carousel__slide').classList.add('carousel__slide--broken')"></div>`
    ).join('');
    const dots = list.map((_, i) =>
      `<button type="button" class="carousel__dot" role="tab" aria-label="Capture ${i + 1}"></button>`
    ).join('');
    return `<div class="carousel pdetail__carousel${list.length < 2 ? ' carousel--single' : ''}">`
      + `<div class="carousel__viewport"><div class="carousel__track">${slides}</div></div>`
      + `<button class="carousel__nav carousel__nav--prev" type="button" aria-label="Capture précédente">‹</button>`
      + `<button class="carousel__nav carousel__nav--next" type="button" aria-label="Capture suivante">›</button>`
      + `<div class="carousel__dots" role="tablist" aria-label="Captures d'écran">${dots}</div>`
      + `</div>`;
  }
  // Branche flèches / points sur le carrousel de la fiche (index local, état isolé de la modal de jeu).
  function wirePdetailCarousel(root) {
    const car = root.querySelector('.pdetail__carousel');
    if (!car) return;
    const track = car.querySelector('.carousel__track');
    const dots = Array.from(car.querySelectorAll('.carousel__dot'));
    const n = car.querySelectorAll('.carousel__slide').length;
    if (!n) return;
    let i = 0;
    const first = car.querySelector('.carousel__slide img');   // cadre au ratio EXACT de la 1re capture
    const ratio = () => { if (first && first.naturalWidth) car.style.setProperty('--shot-ratio', first.naturalWidth + ' / ' + first.naturalHeight); };
    if (first) { if (first.complete && first.naturalWidth) ratio(); else first.addEventListener('load', ratio); }
    const go = (k) => {
      i = (k % n + n) % n;
      track.style.transform = `translateX(${-i * 100}%)`;
      dots.forEach((d, j) => d.classList.toggle('is-active', j === i));
    };
    car.querySelector('.carousel__nav--prev').addEventListener('click', () => go(i - 1));
    car.querySelector('.carousel__nav--next').addEventListener('click', () => go(i + 1));
    dots.forEach((d, j) => d.addEventListener('click', () => go(j)));
    // clic sur la capture -> agrandissement (lightbox) ; flèches synchronisées avec la fiche
    const shots = Array.from(car.querySelectorAll('.carousel__slide img')).map((im) => im.getAttribute('src'));
    track.addEventListener('click', () => { if (shots.length) openLightbox(shots, i, (k) => go(k)); });
    go(0);
  }
  // clic sur un projet -> on RESTE dans le panneau, le détail montre TOUTES ses infos
  function showProjectDetail(p) {
    const list = C.projects || [];
    const idx = list.indexOf(p);
    const pad = (n) => String(n).padStart(2, '0');
    const meta = [p.tag, p.year].filter(Boolean).map(escHtml).join(' · ') || 'Projet';
    const stack = (p.stack || []).map((s) => `<li>${escHtml(s)}</li>`).join('');
    const shots = pdetailCarouselHTML(p.shots);
    const orbInner = p.logo
      ? `<img src="${escHtml(p.logo)}" alt="" onerror="this.closest('.pdetail__orb').textContent='${escHtml(p.icon || '✦')}'">`
      : escHtml(p.icon || '✦');
    // slug du projet (dossier assets/projets/<slug>/) -> permet de cibler un projet précis en CSS
    const slug = (p.logo || '').replace(/.*\/projets\//, '').split('/')[0] || '';
    const link = p.link
      ? `<a class="pdetail__link" href="${escHtml(p.link)}" target="_blank" rel="noopener noreferrer">${escHtml(p.linkLabel || 'Voir le projet')} ↗</a>`
      : '';
    const d = $('projDetail');
    d.innerHTML =
      `<button class="projects__back" type="button">‹ Tous les projets</button>`
      + `<div class="pdetail__scroll">`
      + `<div class="pdetail__hero">`
      + `<span class="pdetail__orb${p.premium ? ' pdetail__orb--gold' : ''}"${slug ? ` data-project="${escHtml(slug)}"` : ''}>${orbInner}</span>`
      + `<h3 class="pdetail__title">${escHtml(p.title || '')}</h3>`
      + `<p class="pdetail__meta">${meta}</p>`
      + (p.premium ? `<span class="pdetail__badge">★ Projet phare</span>` : '')
      + `</div>`
      + shots
      + (stack ? `<ul class="pdetail__stack">${stack}</ul>` : '')
      + link
      + (idx >= 0 ? `<p class="pdetail__num">N° ${pad(idx + 1)} / ${pad(list.length)}</p>` : '')
      + (p.description ? `<p class="pdetail__desc">${escHtml(p.description)}</p>` : '')
      + `</div>`;
    d.querySelector('.projects__back').addEventListener('click', showProjectList);
    wirePdetailCarousel(d);
    $('projView').hidden = true;
    d.hidden = false;
  }
  function showProjectList() {
    $('projDetail').hidden = true;
    const v = $('projView'); if (v) v.hidden = false;
  }
  function openProjects() {
    if (!modalOv.hidden) closeModal();                 // évite l'empilement avec un popup projet
    if (!contactOv.hidden) closeFull();                // ni avec le classement (ouvert depuis le HUD) -> une SEULE pop up à la fois
    buildProjectsView(); projectsOv.hidden = false; state.paused = true;
    if (typeof openAudioPanel === 'function') openAudioPanel(false);
  }
  function closeProjects() { projectsOv.hidden = true; showProjectList(); if (!state.ended) state.paused = false; }
  function toggleProjects() { if (projectsOv.hidden) openProjects(); else closeProjects(); }
  $('projectsBtn').addEventListener('click', toggleProjects);
  projectsOv.querySelectorAll('[data-close-projects]').forEach((el) => el.addEventListener('click', closeProjects));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !projectsOv.hidden && !lboxOpen()) closeProjects(); });
  // --- contrôle du son : clic sur le bouton -> popover à 2 canaux (Musique + Bruitages) ---
  const audioWrap = $('audioWrap'), audioPanel = $('audioPanel');
  const musicMuteBtn = $('musicMute'), musicSlider = $('musicSlider');
  const sfxMuteBtn = $('sfxMute'), sfxSlider = $('sfxSlider');
  // remplace l'emoji du bouton par l'icône peinte (assets/ui). `kind` = suffixe de fichier :
  // '' -> volume/mute (générique), '-musique' et '-bruitage' -> icônes dédiées par canal.
  function setAudioIcon(el, on, kind) {
    if (!el) return;
    let img = el.querySelector('img.audio-ic');
    if (!img) { el.textContent = ''; img = document.createElement('img'); img.className = 'audio-ic'; img.alt = ''; img.setAttribute('aria-hidden', 'true'); el.appendChild(img); }
    const src = 'assets/ui/' + (on ? 'volume' : 'mute') + (kind || '') + '.png';
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  }
  function setSlider(el, vol, muted) {
    if (!el) return;
    el.value = String(Math.round(vol * 100));
    el.style.setProperty('--vol', Math.round((muted ? 0 : vol) * 100) + '%');
  }
  function updateAudioUI() {
    // bouton d'en-tête : muet seulement si TOUT est coupé (musique ET bruitages)
    const sfxOff = state.muted || state.volume <= 0.001;
    const musOff = state.musicMuted || state.musicVolume <= 0.001;
    setAudioIcon($('muteBtn'), !(sfxOff && musOff));   // bouton d'en-tête : coupé seulement si TOUT est muet
    setAudioIcon(sfxMuteBtn, !sfxOff, '-bruitage');   // canal bruitages -> icônes dédiées (volume-bruitage / mute-bruitage)
    setAudioIcon(musicMuteBtn, !musOff, '-musique');  // canal musique   -> icônes dédiées (volume-musique / mute-musique)
    setSlider(sfxSlider, state.volume, state.muted);
    setSlider(musicSlider, state.musicVolume, state.musicMuted);
  }
  function saveAudioPrefs() {
    try {
      localStorage.setItem('stedi.muted', String(state.muted));
      localStorage.setItem('stedi.volume', String(state.volume));
      localStorage.setItem('stedi.musicMuted', String(state.musicMuted));
      localStorage.setItem('stedi.musicVolume', String(state.musicVolume));
    } catch (e) { /* ignore */ }
  }
  function openAudioPanel(open) {
    if (!audioPanel) return;
    audioPanel.hidden = !open;
    $('muteBtn').setAttribute('aria-expanded', String(open));
  }
  $('muteBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    openAudioPanel(audioPanel && audioPanel.hidden);
    resumeAudio(); startMusic();
  });
  // canal MUSIQUE
  if (musicSlider) musicSlider.addEventListener('input', () => {
    state.musicVolume = clamp(Number(musicSlider.value) / 100, 0, 1);
    if (state.musicVolume > 0 && state.musicMuted) state.musicMuted = false;
    startMusic(); applyMusicVolume(); updateAudioUI(); saveAudioPrefs();
  });
  if (musicMuteBtn) musicMuteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.musicMuted = !state.musicMuted;
    if (!state.musicMuted) startMusic();
    applyMusicVolume(); updateAudioUI(); saveAudioPrefs();
  });
  // canal BRUITAGES (effets synthétisés)
  if (sfxSlider) sfxSlider.addEventListener('input', () => {
    state.volume = clamp(Number(sfxSlider.value) / 100, 0, 1);
    if (state.volume > 0 && state.muted) state.muted = false;
    resumeAudio(); applyVolume(); updateAudioUI(); saveAudioPrefs();
  });
  if (sfxMuteBtn) sfxMuteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.muted = !state.muted;
    if (!state.muted) resumeAudio();
    applyVolume(); updateAudioUI(); saveAudioPrefs();
  });
  document.addEventListener('click', (e) => {   // clic en dehors -> ferme le popover
    if (audioWrap && !audioWrap.contains(e.target)) openAudioPanel(false);
  });
  modalOv.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));

  /* =========================================================================
     14b. ÉCRAN D'ACCUEIL (#cover) : son master + projets + transition "feuille"
     L'accueil précède le prélude. On y propose un gros interrupteur de son
     (coupe d'un coup musique + bruitages), un accès direct aux projets, et le
     bouton « Jouer » qui aspire l'accueil vers le centre puis expire le prélude.
     ========================================================================= */
  const coverOv = $('cover');
  // « son master » = état combiné des 2 canaux (musique + bruitages)
  function masterAudioOn() {
    const sfxOn = !state.muted && state.volume > 0.001;
    const musOn = !state.musicMuted && state.musicVolume > 0.001;
    return sfxOn || musOn;
  }
  function setMasterAudio(on) {
    if (on) {
      state.muted = false; state.musicMuted = false;
      if (state.volume <= 0.001) state.volume = 0.8;          // remonte un volume à zéro pour vraiment entendre
      if (state.musicVolume <= 0.001) state.musicVolume = 0.6;
      // NB : on NE démarre PAS la musique ici. Sur l'accueil, ce bouton ne fait que
      // régler la préférence ; le son ne se lance qu'au clic sur « Jouer » (coverToPrelude).
    } else {
      state.muted = true; state.musicMuted = true;
    }
    applyVolume(); applyMusicVolume(); updateAudioUI(); updateCoverSound(); saveAudioPrefs();
  }
  function updateCoverSound() {
    const btn = $('coverSound'); if (!btn) return;
    const on = masterAudioOn();
    btn.classList.toggle('is-off', !on);
    btn.setAttribute('aria-pressed', String(on));
    const ic = $('coverSoundIc'), ti = $('coverSoundTitle'), hi = $('coverSoundHint');
    if (ic) setAudioIcon(ic, on);
    if (ti) ti.textContent = on ? 'Son activé' : 'Son coupé';
    if (hi) hi.textContent = on
      ? 'Il y a une musique et des bruitages. Clique pour couper.'
      : 'Tout est muet. Clique pour réactiver le son.';
  }
  const cs = $('coverSound');
  if (cs) cs.addEventListener('click', (e) => { e.preventDefault(); setMasterAudio(!masterAudioOn()); });

  // Transition accueil -> prélude : un CERCLE plein écran se REFERME vers son centre
  // (iris qui se ferme) et masque tout l'accueil ; à la fin, le prélude apparaît et
  // « L'épopée de Steven Dieu » s'écrit (faerieReveal).
  let coverGone = false;
  function animateEl(el, frames, opts) {        // garde-fou si l'API manque
    if (el && el.animate) { try { return el.animate(frames, opts); } catch (e) { /* ignore */ } }
    return null;
  }
  function coverToPrelude() {
    if (coverGone || !coverOv) return;
    coverGone = true;
    resumeAudio(); startMusic();                 // geste utilisateur : on débloque l'audio

    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const maxR = Math.round(Math.hypot(cx, cy) + 40);

    // le prélude est prêt DERRIÈRE (fond affiché tout de suite), texte caché jusqu'à la fin
    preludeOv.style.animation = 'none';          // neutralise l'anim de conteneur (figée en reduce)
    preludeOv.style.opacity = '1';
    preludeOv.hidden = false;
    hud.hidden = false;                          // le HUD réapparaît avec le prélude
    preludeOv.querySelectorAll('.prelude__bg, .prelude__scrim').forEach((el) => {
      el.style.animation = 'none'; el.style.opacity = '1';   // fond instantané (pas de fondu pendant l'iris)
    });
    const inner = preludeOv.querySelector('.prelude__inner');
    if (inner) inner.style.opacity = '0';        // texte masqué pendant la fermeture du cercle

    // pas de scrollbar pendant la transition
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    coverOv.style.overflow = 'hidden';

    // CERCLE qui se referme : plein écran -> point central, masquant l'accueil
    coverOv.style.clipPath = `circle(${maxR}px at ${cx}px ${cy}px)`;
    void coverOv.offsetWidth;
    const DUR = 420;
    const iris = animateEl(coverOv, [
      { clipPath: `circle(${maxR}px at ${cx}px ${cy}px)` },
      { clipPath: `circle(0px at ${cx}px ${cy}px)` },
    ], { duration: DUR, easing: 'cubic-bezier(.55,.06,.68,.19)', fill: 'forwards' });

    // bordure dorée lumineuse qui chevauche le bord du cercle (même look que l'ouverture du jeu)
    const ring = document.createElement('div');
    ring.style.cssText = 'position:fixed;border-radius:50%;pointer-events:none;z-index:39;'
      + 'border:3px solid rgba(255,226,130,.95);'
      + 'box-shadow:0 0 26px 7px rgba(255,210,74,.55), inset 0 0 20px rgba(255,210,74,.45);';
    ring.style.width = ring.style.height = (2 * maxR) + 'px';
    ring.style.left = (cx - maxR) + 'px'; ring.style.top = (cy - maxR) + 'px';
    document.body.appendChild(ring);
    animateEl(ring, [
      { width: (2 * maxR) + 'px', height: (2 * maxR) + 'px', left: (cx - maxR) + 'px', top: (cy - maxR) + 'px' },
      { width: '0px', height: '0px', left: cx + 'px', top: cy + 'px' },
    ], { duration: DUR, easing: 'cubic-bezier(.55,.06,.68,.19)', fill: 'forwards' });

    let done = false;
    const finish = () => {
      if (done) return; done = true;
      coverOv.hidden = true;
      coverOv.style.clipPath = '';
      if (ring && ring.parentNode) ring.parentNode.removeChild(ring);
      coverOv.style.overflow = '';
      document.documentElement.style.overflow = prevOverflow;
      if (inner) inner.style.opacity = '1';      // la zone de texte redevient visible
      faerieReveal();                            // écriture de « L'épopée de Steven Dieu »
    };
    if (iris) iris.onfinish = finish;
    setTimeout(finish, DUR + 120);               // filet de sécurité si onfinish ne se déclenche pas
  }
  const cp = $('coverPlay');
  if (cp) cp.addEventListener('click', coverToPrelude);
  const cpr = $('coverProjects');
  if (cpr) cpr.addEventListener('click', openProjects);

  /* --- Chargement discret du décor sur le bouton « Jouer » de l'accueil ---------
     Les maps en haute qualité sont lourdes ; sans précharge elles peuvent « pop »
     en cours de jeu. Tant que le décor (maps + sprites + FX) n'est pas en mémoire,
     « ▶ Jouer » devient « Chargement… X% » (inactif) avec une fine barre dorée ;
     dès que tout est prêt il redevient « ▶ Jouer ». Si tout est déjà en cache,
     aucun loader n'apparaît (pas de clignotement). Filet de 8 s pour ne jamais
     bloquer même si un asset traîne ou échoue (404 -> compte quand même). */
  function decorImages() {
    const list = [];
    for (const k in IMG) if (IMG[k]) list.push(IMG[k]);                 // maps level-1..4
    for (const k in SP) if (SP[k] && SP[k].img) list.push(SP[k].img);   // avatar, orbes, écriteau…
    FX.smoke.forEach((s) => { if (s && s.img) list.push(s.img); });
    [FX.ring, FX.flare, FX.sparkle].forEach((s) => { if (s && s.img) list.push(s.img); });
    for (const k in FXA) if (FXA[k].sp && FXA[k].sp.img) list.push(FXA[k].sp.img);  // poofs saut/atterrissage/demi-tour
    if (FLASH19.sp && FLASH19.sp.img) list.push(FLASH19.sp.img);                    // flash d'énergie de l'orbe finale
    // NB: le vortex de particules (PARTICLES, ~5 Mo) n'est PAS dans ce préchargement
    // bloquant : il ne sert qu'au boss (dernière carte) et se charge en arrière-plan.
    return list;
  }
  /* --- Écran de chargement (#loader) : fond noir + orbe + cadre doré tournant --------
     Premier écran montré à l'utilisateur. L'orbe (petite, chargée en premier via le
     <img> du HTML) trône au centre ; le cadre « loader.png » (même design que l'orbe)
     TOURNE autour d'elle pendant le préchargement de tout le décor. Le mouvement est
     piloté en JS (rAF) -> insensible à prefers-reduced-motion. Le % avance linéairement
     et l'écran reste au moins MIN_SHOW_MS (anti-clignotement) ; dès que le décor est prêt
     ET le délai écoulé, fondu de sortie -> l'accueil apparaît. Si tout est déjà en cache :
     pas de splash. Filet de 8 s pour ne jamais bloquer. */
  function setupBootLoader() {
    const el = $('loader'); if (!el) return;
    const imgs = decorImages();
    const total = imgs.length || 1;
    const ring = el.querySelector('.loader__ring-img');
    const orb = el.querySelector('.loader__orb');
    const pctEl = el.querySelector('.loader__pct');

    let settled = 0, realDone = false, ready = false, startAt = 0, rafId = 0;
    const MIN_SHOW_MS = 2000;                         // durée mini d'affichage de l'écran de chargement
    // secteur conique de départ = nul -> le cadre est invisible tant que rien n'est révélé
    const maskFor = (deg) => 'conic-gradient(#000 0deg ' + deg.toFixed(2) + 'deg, transparent ' + deg.toFixed(2) + 'deg 360deg)';
    if (ring) { ring.style.webkitMaskImage = maskFor(0); ring.style.maskImage = maskFor(0); }

    const hide = () => {                              // fondu de sortie -> révèle l'accueil derrière
      if (ready) return; ready = true;
      if (rafId) cancelAnimationFrame(rafId);
      const gone = () => { el.hidden = true; el.style.display = 'none'; };
      // WAAPI : un fondu d'opacité joue même en mouvement réduit (comme l'iris de l'accueil)
      if (el.animate) {
        const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: 'ease', fill: 'forwards' });
        a.onfinish = gone; setTimeout(gone, 480);    // filet si onfinish ne se déclenche pas
      } else gone();
    };

    const tick = (now) => {
      const elapsed = now - startAt;
      let pct = Math.min(100, (elapsed / MIN_SHOW_MS) * 100);
      if (!realDone) pct = Math.min(pct, 95);          // pas de faux 100% figé tant que le décor charge
      if (ring) { const m = maskFor(pct * 3.6); ring.style.webkitMaskImage = m; ring.style.maskImage = m; }  // le cadre se dévoile selon le %
      if (orb) orb.style.transform = 'translate(-50%,-50%) scale(' + (1 + 0.05 * Math.sin(elapsed / 360)).toFixed(3) + ')';  // respiration douce
      if (pctEl) pctEl.textContent = Math.round(pct) + '%';
      if (realDone && elapsed >= MIN_SHOW_MS) { hide(); return; }
      rafId = requestAnimationFrame(tick);
    };
    const markDone = () => { realDone = true; };       // tout le décor est chargé (ou en erreur 404)
    const bump = () => { settled++; if (settled >= total) markDone(); };

    imgs.forEach((im) => {
      if (im.complete) settled++;                      // déjà chargé (cache)
      else { im.addEventListener('load', bump, { once: true }); im.addEventListener('error', bump, { once: true }); }
    });

    if (settled >= total) { el.hidden = true; el.style.display = 'none'; return; }   // tout en cache -> pas de splash
    startAt = performance.now();
    rafId = requestAnimationFrame(tick);
    setTimeout(() => { markDone(); }, 8000);           // filet de sécurité : débloque la fin (le tick fera la sortie)
  }
  setupBootLoader();

  /* =========================================================================
     15b. RÉVÉLATION FÉÉRIQUE DU PRÉLUDE (split text "maison", zéro dépendance)
     Découpe le titre + l'histoire en lettres qui se matérialisent une à une
     (poussière dorée floue). Délais en cascade ; mouvement réduit = instantané.
     ========================================================================= */
  function faerieReveal() {
    if (!preludeOv) return;
    const rm = false;   // effet lettres TOUJOURS actif (prioritaire sur "réduire les animations")
    function split(el, start, stagger, dur) {
      const nodes = Array.from(el.childNodes);
      let label = '';
      for (const n of nodes) label += (n.nodeType === 3) ? n.nodeValue : ' ';   // <br> -> espace
      el.textContent = '';
      el.setAttribute('role', 'img');          // a11y : lu d'un bloc, pas lettre par lettre
      el.setAttribute('aria-label', label.replace(/\s+/g, ' ').trim());
      let t = start;
      const mkChar = (parent, ch) => {
        const s = document.createElement('span');
        s.className = 'char';
        s.textContent = ch;
        s.style.setProperty('animation-delay', Math.round(t) + 'ms', 'important');
        s.style.setProperty('animation-duration', dur + 'ms', 'important');
        parent.appendChild(s);
        t += stagger;
      };
      for (const node of nodes) {
        if (node.nodeType === 3) {              // noeud texte -> MOTS insécables de lettres
          for (const tok of node.nodeValue.split(/( )/)) {   // coupe sur l'espace normal seulement
            if (tok === '') continue;
            if (tok === ' ') { el.appendChild(document.createTextNode(' ')); continue; }  // espace = point de coupure
            const w = document.createElement('span');
            w.className = 'word';                // mot insécable (le &nbsp; y reste collé)
            for (const ch of tok) mkChar(w, ch);
            el.appendChild(w);
          }
          continue;
          /* eslint-disable */
          for (const ch of node.nodeValue) {
            if (ch === ' ' || ch === ' ') { el.appendChild(document.createTextNode(ch)); continue; }
            const s = document.createElement('span');
            s.className = 'char';
            s.textContent = ch;
            s.style.setProperty('animation-delay', Math.round(t) + 'ms', 'important');
            s.style.setProperty('animation-duration', dur + 'ms', 'important');
            el.appendChild(s);
            t += stagger;
          }
        } else {
          el.appendChild(node.cloneNode(true)); // <br>, etc.
        }
      }
      el.classList.add('is-split');
      return t;
    }
    // entrée en IMPULSION AMPLE (pop + rebond) ; !important pour jouer même en mode réduit
    const popIn = (el, ms) => {
      if (!el) return;
      el.style.setProperty('animation-name', 'preludePop', 'important');
      el.style.setProperty('animation-duration', '560ms', 'important');
      el.style.setProperty('animation-timing-function', 'cubic-bezier(.2,.8,.25,1)', 'important');
      el.style.setProperty('animation-fill-mode', 'both', 'important');
      el.style.setProperty('animation-delay', Math.round(ms) + 'ms', 'important');
    };
    const kicker = preludeOv.querySelector('.prelude__kicker');
    const title = preludeOv.querySelector('.prelude__title');
    const sub = preludeOv.querySelector('.prelude__sub');
    const lines = preludeOv.querySelectorAll('.prelude__line');
    const orbhint = preludeOv.querySelector('.prelude__orbhint');
    const btn = preludeOv.querySelector('.prelude__btn');

    let t = 50;
    if (kicker) t = split(kicker, t, 13, 320);          // « Bienvenue dans »
    if (title)  t = split(title, t * 0.85, 15, 380);    // titre
    if (sub)    t = split(sub, t * 0.85, 7, 300);       // sous-titre (Tech Lead Java / Angular…)
    let ts = Math.max(t * 0.9, 260);                    // l'histoire enchaîne
    lines.forEach((ln) => { ts = split(ln, ts, 4, 340) + 30; });  // +30 ms entre les lignes
    // cascade finale : orbe -> bouton Jouer (chacun en impulsion ample, ~140 ms d'écart)
    popIn(orbhint, ts);            // l'aperçu de l'orbe entre AUSSI dans l'apparition
    popIn(btn, ts + 140);          // …puis le bouton Jouer en dernier
  }

  /* =========================================================================
     16. INIT
     ========================================================================= */
  // titre de l'écran de démarrage (textContent + espace insécable littéral U+00A0)
  // = `${C.identity.firstName || ''} ${C.identity.lastName || ''}`;
  $('preludeSub').textContent = `${C.identity.role} · ${AGE_STR}${C.identity.city}`;

  // Image de fond du prélude : si elle manque (404), on la retire proprement.
  // Remplace l'ancien `onerror="this.remove()"` inline (supprimé pour garder une
  // CSP stricte sans `script-src 'unsafe-inline'`). On couvre aussi le cas où
  // l'erreur a déjà eu lieu avant l'exécution de ce script (image en bas de page).
  document.querySelectorAll('.prelude__bg').forEach((img) => {
    const drop = () => img.remove();
    if (img.complete && img.naturalWidth === 0) drop();
    else img.addEventListener('error', drop);
  });

  // préférence de son persistée (bruitages + musique : volume + mute)
  try {
    const sv = localStorage.getItem('stedi.volume');
    if (sv !== null && !isNaN(parseFloat(sv))) state.volume = clamp(parseFloat(sv), 0, 1);
    if (localStorage.getItem('stedi.muted') === 'true') state.muted = true;
    const mv = localStorage.getItem('stedi.musicVolume');
    if (mv !== null && !isNaN(parseFloat(mv))) state.musicVolume = clamp(parseFloat(mv), 0, 1);
    if (localStorage.getItem('stedi.musicMuted') === 'true') state.musicMuted = true;
  } catch (e) { /* stockage indisponible */ }
  updateAudioUI();
  updateCoverSound();   // l'interrupteur de l'accueil reflète la préférence persistée
  applyMusicVolume();
  // IMPORTANT : on ne lance NI ne pré-arme la musique au chargement. Le son ne démarre
  // qu'au clic sur « Jouer » (coverToPrelude) -> rien ne joue tant qu'on est sur l'accueil.

  resize();
  buildLevel();
  resetAvatar();
  cam.x = 0; cam.y = camRestY();
  bindTouch();
  setupShakeToClose();   // mobile : fermer la fiche projet en secouant (remplace Échap / Entrée)
  buildCollectionTray(); // collection « cartes à collectionner » (desktop, en bas à droite)
  updateHUD();
  hud.hidden = true;   // HUD masqué pendant l'accueil ; réapparaît à l'entrée dans le prélude
  // NB : faerieReveal() n'est PLUS appelé ici : il l'est au moment où le prélude
  // « expire » depuis l'accueil (coverToPrelude), pour que les lettres s'animent à ce moment-là.
  requestAnimationFrame(frame);

  // Raccourcis de test, réservés au LOCAL (isLocal()) : sans effet en prod (ignorés).
  //   #start -> démarre direct sur la 1re carte (Lille), saute l'accueil + le prélude.
  //   #boss  -> démarre direct sur le désert et rejoue la mise en scène "boss".
  // (clique une fois pour le son si l'autoplay le bloque).
  if (isLocal()) {
    if (location.hash === '#start') startAtGame();
    else if (location.hash === '#boss') startAtBoss();
  }

  // Crochet de test (uniquement avec #dev dans l'URL) — sans effet en prod.
  if (location.hash === '#dev') window.__dev = {
    state, A, orbs, cam, solids, keys, fxAnims,   // fxAnims : poofs saut/atterrissage/demi-tour en cours
    setWarmth(v) { state.warmthTarget = v; },
    step(dt, n) { for (let i = 0; i < (n || 1); i++) update(dt || 1 / 60); },   // pas manuel (test physique)
    render,                                                                     // peint 1 frame à la demande (capture headless : rAF gelé si onglet masqué)
    collect(o) { collectOrb(o || orbs.find((x) => !x.cta && !x.collected)); },  // attrape un orbe-projet (test score)
    scoreNow, endGame,                                                          // test du score / écran de fin
    quality(i) { if (i != null) { qIdx = clamp(i | 0, 0, Q_STEPS.length - 1); renderScale = Q_STEPS[qIdx]; resize(); } return { qIdx, renderScale, steps: Q_STEPS, w: canvas.width, h: canvas.height }; },  // qualité adaptative : force/lit le palier
  };

})();
