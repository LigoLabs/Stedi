"""
Scene Blender pour l'anim de presentation Stedi.

DEUX principes, et le second est celui qui manquait :

1. AUCUNE modelisation. Les PNG peints du jeu sont poses comme des PLANS TEXTURES
   dans l'espace 3D, et c'est la CAMERA qui fabrique la perspective : quand la main
   avance vers l'objectif, elle grossit et tourne pour de vrai. Le dessin d'origine
   est conserve au pixel pres.

2. LES MAINS CHANGENT DE DESSIN. Une image plate ne peut pas changer de forme : pour
   que des doigts s'ouvrent il faut plusieurs dessins qu'on ECHANGE d'une image a
   l'autre, comme le fait deja le jeu avec SP.handFist / hand-point-up. Chaque main
   est donc un « emplacement » qui porte plusieurs etats cales sur le MEME poignet
   (voir main_plaque : l'echelle est calculee pour que la manchette fasse toujours la
   meme largeur, et l'origine de l'objet EST le poignet).

Materiau = Emission pure -> les couleurs sortent exactement comme peintes.

Lancement :
  blender --background --python scene.py -- --out <dossier> --res 512
"""
import bpy, sys, os, math
import numpy as np
from mathutils import Vector

# ---------------------------------------------------------------- arguments
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default

ASSETS = arg("--assets", r"D:\Documents\Developpement\Stedi\stedi\assets\avatar")
OUT    = arg("--out", os.path.join(os.path.dirname(__file__), "frames"))
RES    = int(arg("--res", "512"))
VAR    = arg("--variante", "A").upper()   # A, B, C ou D : la POSE (voir VARIANTES)
MODE   = arg("--mode", "pose")            # "pose" ou "entree"
ENT    = arg("--entree", "course")         # course, saut ou chute (voir ENTREES)
os.makedirs(OUT, exist_ok=True)

# Decoupage temporel RECALE sur la reference (20 images a 10 i/s, comme elle) :
#   1      depart
#   2-3    anticipation : elle claque a l'extreme en UNE image, puis TIENT
#   4-7    le fouette   : claque a l'autre extreme et TIENT quatre images, poing
#                         lance en l'air et immobile pendant que le buste balaie
#   8      l'arrivee    : PIC, la main en gros plan, doigts ouverts
#   9-12   le retour    : elle recule et se cale sur l'index, rebond amorti
#  13-20   respiration  : cycle de 8 images qui BOUCLE proprement
#
# LE POINT CLE : la reference MAINTIENT ses poses extremes (ses images 3 a 6 sont
# quasi identiques). C'est ce qui donne des temps forts. Une interpolation continue,
# elle, glisse et parait molle. On duplique donc les cles pendant les maintiens.
# FLUIDITE : la choregraphie est ecrite sur la grille de 20 images de la reference,
# puis DILATEE d'un facteur MULT a l'insertion des cles. On joue donc a 20 i/s au lieu
# de 10, pour la meme duree. Les MAINTIENS restent des maintiens (deux cles voisines
# quasi identiques s'ecartent d'autant), et ce sont les transitions rapides qui
# recuperent des images intermediaires. C'est exactement la ou ca saccadait.
# Densite d'images. La choregraphie est ecrite sur la grille de 20 images de la
# reference, puis DILATEE : les maintiens restent des maintiens, seules les transitions
# rapides gagnent des intermediaires. Le SAUT couvre une enorme distance, a MULT 2 il
# avancait de 44 px d'une image a l'autre et clignotait : on le rend a MULT 4, joue deux
# fois plus vite, donc meme duree mais des pas deux fois plus petits.
MULT        = int(arg("--mult", "2"))
def F(f):
    return (f - 1) * MULT + 1        # l'image 1 reste l'image 1

F_FIN_BURST = F(12)                  # 23
# Une POSE fait 40 images (23 de rafale + 17 de respiration bouclee). Une ARRIVEE fait
# 19 images et se termine exactement sur REPOS, l'image 1 des poses : le raccord est donc
# exact pour les 12 combinaisons.
F_TOTAL     = 40 if MODE == "pose" else F(10)
IDLE_N      = (40 - F_FIN_BURST) if MODE == "pose" else 0

# ---------------------------------------------------------------- table de pose
# Reprise VERBATIM de PP dans game.js (drawPresPose) : fractions de la hauteur du
# perso, ancrage au sol entre les pieds. Placement deja valide, on ne le reinvente pas.
H = 10.0
PP = dict(
    headH=0.445, headY=0.960, headX=0.015,
    bodyH=0.335, bodyY=0.525,
    shoeH=0.160, shoeGap=0.130,
    handH=0.270, handOpenH=0.230,
    pointX=0.250, pointY=0.790,
    openX=-0.240, openY=0.285,
)

# ---------------------------------------------------------------- scene vierge
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48              # emission pure : zero bruit, ne sert qu'a l'anticrenelage
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 1
scene.render.film_transparent = True   # fond vide -> alpha reel dans le PNG
# En ARRIVEE le cadre est 1,6 fois plus grand DANS LES DEUX SENS : il faut de la place a
# gauche pour la course, mais aussi EN HAUT pour la chute, qui sinon commence hors champ
# (image 1 vide, images 2 a 5 tranchees au ras du cadre).
# La condition du raccord est de garder la MEME ECHELLE pixel/monde : on agrandit donc le
# capteur dans la meme proportion que la resolution, et on remonte la camera de la moitie
# de ce qu'on ajoute pour que le BAS du cadre ne bouge pas.
ZOOM_ENT = 1.6
_r = RES if MODE == "pose" else int(RES * ZOOM_ENT)
scene.render.resolution_x = scene.render.resolution_y = _r
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.compression = 15
# Flou de mouvement : la reference a une image de flou dessinee sur la plus rapide.
# Cycles le fait tout seul, et il ne touche QUE ce qui bouge vite.
# 0,45 noyait le dessin sur cinq images. La reference n'a qu'UNE image filee : on garde
# un obturateur court, il ne marque que les pointes de vitesse.
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.18
scene.view_settings.view_transform = "Standard"   # pas AgX : sinon les couleurs peintes sont delavees
scene.view_settings.look = "None"

# ---------------------------------------------------------------- mesures des PNG
def mesure(fichier):
    """Boite du contenu + largeur et centre de la MANCHETTE (les 6 % du bas).

    C'est la manchette qui sert de reference pour raccorder des dessins differents :
    c'est la seule partie commune a toutes les mains, et c'est le poignet.

    On lit les pixels via l'API de Blender (PIL n'est pas embarque dans Blender).
    Attention : img.pixels range les lignes du BAS vers le HAUT, d'ou le retournement.
    """
    img = bpy.data.images.load(os.path.join(ASSETS, fichier), check_existing=True)
    Wimg, Himg = img.size
    buf = np.empty(Wimg * Himg * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    a = buf.reshape(Himg, Wimg, 4)[::-1, :, 3] * 255.0
    ys, xs = np.where(a > 40)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    cw = x1 - x0 + 1
    bande = a[y1 - max(1, int((y1 - y0 + 1) * 0.06)):y1 + 1]
    cols = np.where(bande.max(axis=0) > 40)[0]
    return dict(Wimg=Wimg, Himg=Himg, x0=x0, y0=y0, x1=x1, y1=y1, cw=cw,
                manche=int(cols[-1] - cols[0]), manche_cx=float((cols[0] + cols[-1]) / 2))

# ---------------------------------------------------------------- fabrique de plans
def _materiau(nom, img):
    mat = bpy.data.materials.new(nom + "_mat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
    tex.interpolation = "Cubic"; tex.extension = "CLIP"
    emi = nt.nodes.new("ShaderNodeEmission"); emi.inputs["Strength"].default_value = 1.0
    tra = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tex.outputs["Color"], emi.inputs["Color"])
    nt.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    nt.links.new(tra.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emi.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat

def _plan(nom, fichier, w, h, ox, oz):
    """Plan debout dans XZ (normale vers -Y = vers la camera), decale de (ox, oz)."""
    img = bpy.data.images.load(os.path.join(ASSETS, fichier), check_existing=True)
    img.alpha_mode = "STRAIGHT"
    me = bpy.data.meshes.new(nom)
    me.from_pydata([(-w/2 + ox, 0, oz), (w/2 + ox, 0, oz),
                    (w/2 + ox, 0, h + oz), (-w/2 + ox, 0, h + oz)], [], [(0, 1, 2, 3)])
    me.update()
    uv = me.uv_layers.new(name="UV")
    for i, co in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[i].uv = co
    ob = bpy.data.objects.new(nom, me)
    scene.collection.objects.link(ob)
    ob.data.materials.append(_materiau(nom, img))
    ob.visible_shadow = False
    return ob

def plaque(nom, fichier, hauteur):
    """Piece simple, ancree en BAS-CENTRE (tete, buste, chaussures)."""
    img = bpy.data.images.load(os.path.join(ASSETS, fichier), check_existing=True)
    return _plan(nom, fichier, hauteur * img.size[0] / img.size[1], hauteur, 0.0, 0.0)

def main_plaque(nom, fichier, manche_monde):
    """Etat de main, cale sur le POIGNET.

    L'echelle est choisie pour que la manchette fasse toujours `manche_monde` de large,
    et l'origine de l'objet est placee au centre-bas de cette manchette. Consequence :
    on peut echanger deux dessins de main d'une image a l'autre, la main ne saute pas
    et la rotation se fait bien autour du poignet.
    """
    m = mesure(fichier)
    frac = m["manche"] / m["cw"]                       # part de la manchette dans le contenu
    w = manche_monde * m["Wimg"] / (m["cw"] * frac)    # largeur du plan entier
    h = w * m["Himg"] / m["Wimg"]
    ox = -(m["manche_cx"] - m["Wimg"] / 2) / m["Wimg"] * w      # recentrer sur la manchette
    oz = -h * (1 - (m["y1"] + 1) / m["Himg"])                   # poser le bas du contenu a 0
    return _plan(nom, fichier, w, h, ox, oz)

# ---------------------------------------------------------------- pieces fixes
# Y = profondeur (plus grand = plus loin). L'ordre de dessin du jeu
# (chaussures, main ouverte, corps, tete, index) devient un etagement en profondeur.
OBJ = {
    "shoeL": plaque("shoeL", "pres-shoe-l.png", PP["shoeH"] * H),
    "shoeR": plaque("shoeR", "pres-shoe-r.png", PP["shoeH"] * H),
    "body":  plaque("body",  "pres-body.png",   PP["bodyH"] * H),
    "head":  plaque("head",  "pres-head.png",   PP["headH"] * H),
}
REPOS = {
    "shoeL": (-PP["shoeGap"] * H, 0.30, 0.0),
    "shoeR": ( PP["shoeGap"] * H, 0.10, 0.0),
    "body":  ( 0.0,               0.00, (PP["bodyY"] - PP["bodyH"]) * H),
    "head":  ( PP["headX"] * H,  -0.18, (PP["headY"] - PP["headH"]) * H),
}

# ---------------------------------------------------------------- mains a etats
# Largeur de manchette visee : on la deduit des tailles deja validees dans le jeu,
# pour que les mains gardent exactement la taille que Steven a approuvee.
def manche_visee(fichier, hauteur_jeu):
    m = mesure(fichier)
    contenu_h = hauteur_jeu * (m["y1"] - m["y0"] + 1) / m["Himg"]
    contenu_w = contenu_h * m["cw"] / (m["y1"] - m["y0"] + 1)
    return contenu_w * m["manche"] / m["cw"]

MANCHE_POINT = manche_visee("pres-hand-point.png", PP["handH"]     * H)
MANCHE_OPEN  = manche_visee("pres-hand-open.png",  PP["handOpenH"] * H)

# Les etats de main et leurs pistes sont propres a chaque variante (voir VARIANTES).

def emplacement(nom, etats, manche, piste, cles):
    """Une main = un objet vide anime + un plan par etat, parentes dessus.

    Le vide porte TOUTE l'animation (trajectoire, rotation). Les etats heritent, donc
    ils sont interchangeables sans retoucher la choregraphie.
    """
    vide = bpy.data.objects.new(nom + "Ctl", None)
    scene.collection.objects.link(vide)
    plans = {}
    for cle, fichier in etats.items():
        p = main_plaque(nom + "_" + cle, fichier, manche)
        p.parent = vide
        plans[cle] = p
    # visibilite : une cle a chaque bascule, interpolation CONSTANTE (pas de fondu)
    for f, actif in piste:
        for cle, p in plans.items():
            p.hide_render = p.hide_viewport = (cle != actif)
            p.keyframe_insert("hide_render", frame=F(f))
            p.keyframe_insert("hide_viewport", frame=F(f))
    for p in plans.values():
        for fc in fcurves_de(p):
            for kp in fc.keyframe_points:
                kp.interpolation = "CONSTANT"
    return vide

# ---------------------------------------------------------------- acces aux fcurves
# Blender 5 range les fcurves dans des actions a calques (action.fcurves a disparu).
def fcurves_de(ob):
    ad = ob.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            cb = strip.channelbag(ad.action_slot)
            if cb:
                out.extend(cb.fcurves)
    return out

# ---------------------------------------------------------------- camera
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 40.0            # assez large pour que l'avancee vers l'objectif se VOIE
cam_data.sensor_width = 36.0
cam_data.sensor_fit = "VERTICAL"
# PIEGE : en sensor_fit VERTICAL, Blender prend sensor_HEIGHT pour le champ vertical, pas
# sensor_width. Sa valeur par defaut est 24 mm : le perso passait a 76 % de la hauteur du
# cadre au lieu de 50 %, ce qui annulait le recul de camera. On force donc la valeur.
_ech = 1.0 if MODE == "pose" else ZOOM_ENT
cam_data.sensor_height = 36.0 * _ech
cam_data.clip_start = 0.05
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
# Camera RECULEE a 22 et abaissee a 6,5. Dans la reference le personnage n'occupe que
# la moitie de la hauteur de l'image : c'est CE vide qui permet a la main de venir en
# gros plan sans passer sur la figure. A 14 il en remplissait 80 %, le gros plan n'avait
# nulle part ou aller. A 22 il en occupe 48 %, comme la reference.
# Le bas du cadre reste a la meme altitude quel que soit le mode : en arrivee on remonte
# la camera de tout ce qu'on ajoute en haut. Demi-champ = (36*ech/2)/40 * 22.
_demi = (36.0 * _ech / 2) / 40.0 * 22.0
cam.location = (0.0, -22.0, (6.5 - 9.9) + _demi)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam

# ==========================================================================
#  CHOREGRAPHIES
#  Trois propositions, ecrites sur la grille de 20 images de la reference puis
#  dilatees par F(). Elles changent d'AXE et de POSE FINALE, pas de details :
#    A  Le ressort   detente VERTICALE, les pieds decollent, finit POUCE LEVE
#    B  L'accueil    balayage HORIZONTAL en arc, finit PAUME OUVERTE vers la fiche
#    C  La double    explosion verticale symetrique, LES DEUX POINGS en l'air
#
#  Format des cles : frame, x, y, z, roulis, lacet, tangage, echelleX, echelleZ
#  y NEGATIF = vers la camera. Le ROULIS des mains est en grande partie ignore : il
#  est recalcule par la contrainte d'alignement des bras (voir plus bas), la valeur
#  donnee ici n'est qu'un petit flechissement de poignet ajoute par-dessus.
# ==========================================================================
def C(f, x, y, z, roll=0, yaw=0, pitch=0, sx=1.0, sz=1.0):
    return dict(f=F(f), loc=(x, y, z), rot=(pitch, roll, yaw), scl=(sx, 1.0, sz))

BODY_H = PP["bodyH"] * H
# ECART TETE-BUSTE. Le perso est a membres FLOTTANTS : dans le jeu, drawAvatar lui donne
# un ecart tete-corps explicite de 14 px qui respire avec la foulee. La tete ne se pose
# donc pas sur le col, elle plane au-dessus. Valeur NEGATIVE = ecart ; positive = menton
# enfonce dans le col. Effet de bord agreable : avec un ecart, le probleme du jour au cou
# pendant le fouette disparait, il n y a plus de raccord a cacher.
COL = float(arg("--col", "-0.40"))      # enfoncement du menton dans le col (mesure : la machoire couvre a 0,53)

VARIANTES = {

# ---------------------------------------------------------------- A : LE RESSORT
"A": dict(
  titre="Le ressort, detente verticale, pouce leve",
  # Il s'ecrase tres bas, se detend d'un coup vers le haut, les chaussures decollent,
  # puis la main fonce a l'objectif et se cale POUCE LEVE.
  BODY=[
    ( 1,  0.00, 2.30,   0, 1.00, 1.00),
    ( 2,  0.00, 1.55,   0, 1.28, 0.68),   # accroupi tres bas
    ( 3,  0.00, 1.52,   0, 1.29, 0.67),   # TIENT
    ( 4,  0.00, 3.55,   0, 0.84, 1.22),   # detente : il monte et s'etire
    ( 5,  0.10, 3.70,   4, 0.86, 1.20),   # TIENT en l'air
    ( 7,  0.10, 3.55,   4, 0.88, 1.16),   # TIENT
    ( 8,  0.05, 2.85,   2, 1.06, 0.95),   # il redescend
    (10,  0.00, 2.40,   0, 1.01, 1.00),   # reception
    (12,  0.00, 2.30,   0, 1.00, 1.00),
  ],
  HEAD=[
    ( 1,  0.15,  0.00,   0,   0),
    ( 2,  0.15, -0.20,   0,   0),
    ( 3,  0.15, -0.20,   0,   0),
    ( 4,  0.15,  0.15,  -6,  -8),
    ( 5,  0.18,  0.15,  -8, -10),
    ( 7,  0.18,  0.15,  -8, -10),
    ( 8,  0.16,  0.05,  -4,  -5),
    (10,  0.15,  0.00,  -1,  -2),
    (12,  0.15,  0.00,   0,   0),
  ],
  ETATS_POINT={"poing": "hand-fist.png", "pouce": "hand-thumb.png"},
  PISTE_POINT=[(1, "poing"), (7, "pouce")],
  ETATS_OPEN={"poing": "hand-fist.png"},
  PISTE_OPEN=[(1, "poing")],
  CHOREO={
    "hPoint": [
        C( 1,  1.60,  2.60, 3.30,   0, -40,  10),
        C( 2,  1.30,  2.20, 2.10,   0, -30,   8),   # il se ramasse encore plus bas
        C( 3,  1.30,  2.20, 2.10,   0, -30,   8),   # TIENT
        C( 4,  2.60,  1.00, 7.90,   6, -20,   4),   # propulse vers le haut
        C( 5,  2.80,  0.60, 8.30,   6, -16,   2),   # TIENT
        C( 7,  2.70, -2.00, 7.90,   4, -10,   0),
        C( 8,  1.90,-14.00, 7.40,  -6,   8,  -8),   # PIC : le pouce en gros plan
        C( 9,  2.10, -9.00, 7.30,  -4,   4,  -6),
        C(10,  2.20, -5.00, 7.15,  -2,   2,  -4),
        C(12,  2.30, -2.20, 7.00,   0,   0,  -2),   # tenu, pouce leve
    ],
    "hOpen": [
        C( 1, -2.20, 0.55, 3.30,   0, 0,  0),
        C( 2, -1.90, 0.75, 2.40,   8, 0,  6),
        C( 3, -1.90, 0.75, 2.40,   8, 0,  6),
        C( 4, -2.90, 0.45, 4.60, -10, 0, -6),   # emportee par la detente
        C( 5, -3.00, 0.45, 4.90, -12, 0, -7),
        C( 7, -2.95, 0.46, 4.80, -11, 0, -6),
        C( 8, -2.60, 0.50, 3.90,  -6, 0, -3),
        C(10, -2.30, 0.55, 3.45,  -2, 0,  0),
        C(12, -2.20, 0.55, 3.30,   0, 0,  0),
    ],
    "shoeL": [
        C( 1, -1.34, 0.30, 0.00,   0, 0, 0),
        C( 2, -1.28, 0.30, 0.00,   0, 0, 0),
        C( 3, -1.28, 0.30, 0.00,   0, 0, 0),
        C( 4, -1.40, 0.30, 0.85,  -8, 0, 0),   # elles decollent
        C( 5, -1.42, 0.30, 1.00, -10, 0, 0),
        C( 7, -1.42, 0.30, 0.95, -10, 0, 0),
        C( 8, -1.38, 0.30, 0.30,  -4, 0, 0),
        C(10, -1.34, 0.30, 0.00,   0, 0, 0),
        C(12, -1.34, 0.30, 0.00,   0, 0, 0),
    ],
    "shoeR": [
        C( 1,  1.34, 0.10, 0.00,   0, 0, 0),
        C( 2,  1.28, 0.10, 0.00,   0, 0, 0),
        C( 3,  1.28, 0.10, 0.00,   0, 0, 0),
        C( 4,  1.40, 0.10, 0.80,   9, 0, 0),
        C( 5,  1.42, 0.10, 0.95,  11, 0, 0),
        C( 7,  1.42, 0.10, 0.90,  11, 0, 0),
        C( 8,  1.38, 0.10, 0.28,   4, 0, 0),
        C(10,  1.34, 0.10, 0.00,   0, 0, 0),
        C(12,  1.34, 0.10, 0.00,   0, 0, 0),
    ],
  },
),

# ---------------------------------------------------------------- B : L'ACCUEIL
"B": dict(
  titre="Le coucou, main levee qui salue, poing ferme a gauche",
  # Il se tasse a gauche, ramene la main, puis la LEVE a hauteur de visage et fait
  # coucou : trois balancements. Le coucou est une rotation de POIGNET, donc il passe
  # par le flechissement ajoute par-dessus la contrainte d'alignement : le bras reste
  # correctement dirige vers l'epaule pendant que la main balance. La main gauche reste
  # POING FERME le long du corps, ca lui donne un point d'appui au lieu de flotter.
  BODY=[
    ( 1,  0.00, 2.30,   0, 1.00, 1.00),
    ( 2, -0.55, 2.22, -13, 1.07, 0.93),   # il se tasse a gauche
    ( 3, -0.56, 2.22, -13, 1.07, 0.93),   # TIENT
    ( 4,  0.35, 2.36,  10, 0.97, 1.05),   # il se redresse vers le joueur
    ( 5,  0.45, 2.38,  13, 0.96, 1.06),   # TIENT
    ( 7,  0.40, 2.37,  11, 0.97, 1.05),   # TIENT
    ( 8,  0.32, 2.35,   9, 0.99, 1.03),
    (10,  0.18, 2.32,   5, 1.00, 1.01),
    (12,  0.10, 2.30,   3, 1.00, 1.00),   # il reste legerement tourne vers la fiche
  ],
  HEAD=[
    ( 1,  0.15,  0.00,   0,   0),
    ( 2,  0.05, -0.12,   8,  12),
    ( 3,  0.05, -0.12,   8,  12),
    ( 4,  0.22,  0.06, -10, -16),   # il regarde le joueur en saluant
    ( 5,  0.24,  0.06, -12, -18),
    ( 7,  0.22,  0.05, -10, -16),
    ( 8,  0.20,  0.03,  -8, -14),
    (10,  0.18,  0.00,  -5,  -8),
    (12,  0.16,  0.00,  -4,  -6),
  ],
  ETATS_POINT={"poing": "hand-fist.png", "large": "pres-hand-open.png"},
  PISTE_POINT=[(1, "poing"), (4, "large")],
  ETATS_OPEN={"poing": "hand-fist.png"},
  PISTE_OPEN=[(1, "poing")],
  CHOREO={
    # Le poignet monte a hauteur de visage et y reste ; c'est le FLECHISSEMENT (colonne
    # roulis) qui alterne de +26 a -26 et fabrique le salut. Trois allers-retours.
    "hPoint": [
        C( 1,  1.60,  2.60, 3.30,   0, -40,  10),
        C( 2,  1.20,  1.40, 2.40,   0, -24,   8),   # ramenee bas, poing ferme
        C( 3,  1.20,  1.40, 2.40,   0, -24,   8),   # TIENT
        C( 4,  2.10, -3.00, 7.30,  30, -10,  -2),   # elle monte ET fonce, elle s'ouvre
        # A partir d'ici le POIGNET NE BOUGE PLUS : seul le flechissement alterne, de
        # -34 a +34 degres. C'est ca, un coucou. Amplitude totale du balayage : 68
        # degres, en gros plan, donc parfaitement lisible.
        C( 5,  2.30,-10.50, 7.55, -34,   4,  -6),   # PIC, salut 1
        C( 6,  2.30,-10.60, 7.60,  34,   4,  -6),   # salut 2
        C( 7,  2.30,-10.50, 7.55, -34,   4,  -6),   # salut 3
        C( 8,  2.35,-10.00, 7.60,  32,   4,  -6),   # salut 4
        C( 9,  2.55, -7.00, 7.60, -28,   3,  -5),   # elle recule en saluant encore
        C(10,  2.80, -4.20, 7.60,  20,   2,  -4),
        C(12,  2.95, -2.20, 7.60,  -6,   0,  -2),   # tenue, main levee
    ],
    "hOpen": [
        C( 1, -2.20, 0.55, 3.30,   0, 0,  0),
        C( 2, -1.95, 0.75, 2.90,   6, 0,  4),   # poing ferme, ramene contre la hanche
        C( 3, -1.95, 0.75, 2.90,   6, 0,  4),
        C( 4, -2.20, 0.45, 3.10,  -5, 0, -3),
        C( 5, -2.25, 0.45, 3.15,  -6, 0, -3),
        C( 7, -2.20, 0.46, 3.10,  -5, 0, -3),
        C( 8, -2.15, 0.50, 3.18,  -4, 0, -2),
        C(10, -2.10, 0.55, 3.25,  -2, 0,  0),
        C(12, -2.20, 0.55, 3.30,   0, 0,  0),   # tenue, poing le long du corps
    ],
    "shoeL": [
        C( 1, -1.34, 0.30, 0.00,  0, 0, 0),
        C( 2, -1.40, 0.30, 0.00,  5, 0, 0),
        C( 3, -1.40, 0.30, 0.00,  5, 0, 0),
        C( 4, -1.28, 0.30, 0.04, -5, 0, 0),
        C( 7, -1.28, 0.30, 0.03, -5, 0, 0),
        C(10, -1.33, 0.30, 0.00, -2, 0, 0),
        C(12, -1.34, 0.30, 0.00,  0, 0, 0),
    ],
    "shoeR": [
        C( 1,  1.34, 0.10, 0.00,  0, 0, 0),
        C( 2,  1.26, 0.10, 0.03,  6, 0, 0),
        C( 3,  1.26, 0.10, 0.03,  6, 0, 0),
        C( 4,  1.44, 0.10, 0.00, -5, 0, 0),
        C( 7,  1.44, 0.10, 0.00, -5, 0, 0),
        C(10,  1.37, 0.10, 0.00, -2, 0, 0),
        C(12,  1.34, 0.10, 0.00,  0, 0, 0),
    ],
  },
),

# ---------------------------------------------------------------- C : LA DOUBLE
"C": dict(
  titre="La double, explosion verticale symetrique, les deux poings",
  # Il s'ecrase au maximum, EXPLOSE vers le haut, les DEUX poings partent en l'air et
  # les pieds decollent franchement. Il retombe, encaisse, et garde un poing leve.
  BODY=[
    ( 1,  0.00, 2.30,   0, 1.00, 1.00),
    ( 2,  0.00, 1.45,   0, 1.30, 0.64),   # accroupi extreme
    ( 3,  0.00, 1.42,   0, 1.31, 0.63),   # TIENT
    ( 4,  0.00, 4.20,   0, 0.80, 1.26),   # EXPLOSION
    ( 5,  0.00, 4.45,   0, 0.82, 1.24),   # TIENT en l'air
    ( 7,  0.00, 4.20,   0, 0.85, 1.20),   # TIENT
    ( 8,  0.00, 3.00,   0, 1.10, 0.92),   # reception, il encaisse
    (10,  0.00, 2.42,   0, 1.03, 0.99),   # rebond
    (12,  0.00, 2.30,   0, 1.00, 1.00),
  ],
  HEAD=[
    ( 1,  0.15,  0.00,   0,   0),
    ( 2,  0.15, -0.25,   0,   0),
    ( 3,  0.15, -0.25,   0,   0),
    ( 4,  0.15,  0.20,   0,   0),
    ( 5,  0.15,  0.22,   0,   0),
    ( 7,  0.15,  0.22,   0,   0),
    ( 8,  0.15, -0.05,   0,   0),
    (10,  0.15,  0.02,   0,   0),
    (12,  0.15,  0.00,   0,   0),
  ],
  ETATS_POINT={"poing": "hand-fist.png"},
  PISTE_POINT=[(1, "poing")],
  ETATS_OPEN={"poing": "hand-fist.png"},
  PISTE_OPEN=[(1, "poing")],
  CHOREO={
    "hPoint": [
        C( 1,  1.60,  2.60, 3.30,   0, -40,  10),
        C( 2,  1.10,  2.20, 1.90,   0, -24,   8),   # les deux poings au ras du sol
        C( 3,  1.10,  2.20, 1.90,   0, -24,   8),   # TIENT
        C( 4,  2.20,  1.00, 8.60,   4, -14,   2),   # propulse en l'air
        C( 5,  2.30,  0.60, 9.00,   4, -10,   0),   # TIENT
        C( 7,  2.25, -1.50, 8.80,   2,  -6,   0),
        C( 8,  1.70,-13.00, 7.80,  -6,   8,  -8),   # PIC : le poing vers l'objectif
        C( 9,  1.95, -8.00, 7.60,  -4,   4,  -6),
        C(10,  2.10, -4.50, 7.30,  -2,   2,  -4),
        C(12,  2.20, -2.20, 7.10,   0,   0,  -2),   # tenu, poing leve
    ],
    "hOpen": [
        C( 1, -2.20, 0.55, 3.30,   0, 0,  0),
        C( 2, -1.10, 0.75, 1.90,   0, 0,  8),
        C( 3, -1.10, 0.75, 1.90,   0, 0,  8),
        C( 4, -2.20, 0.45, 8.60,   4, 0,  2),   # l'autre poing monte aussi
        C( 5, -2.30, 0.45, 9.00,   4, 0,  0),
        C( 7, -2.25, 0.46, 8.80,   2, 0,  0),
        C( 8, -2.40, 0.50, 6.00,  -4, 0, -4),   # il redescend
        C(10, -2.30, 0.55, 4.20,  -2, 0, -2),
        C(12, -2.20, 0.55, 3.30,   0, 0,  0),   # revient le long du corps
    ],
    "shoeL": [
        C( 1, -1.34, 0.30, 0.00,   0, 0, 0),
        C( 2, -1.20, 0.30, 0.00,   0, 0, 0),
        C( 3, -1.20, 0.30, 0.00,   0, 0, 0),
        C( 4, -1.45, 0.30, 1.60, -14, 0, 0),   # decollage franc
        C( 5, -1.48, 0.30, 1.85, -16, 0, 0),
        C( 7, -1.46, 0.30, 1.70, -15, 0, 0),
        C( 8, -1.38, 0.30, 0.35,  -5, 0, 0),
        C(10, -1.34, 0.30, 0.00,   0, 0, 0),
        C(12, -1.34, 0.30, 0.00,   0, 0, 0),
    ],
    "shoeR": [
        C( 1,  1.34, 0.10, 0.00,   0, 0, 0),
        C( 2,  1.20, 0.10, 0.00,   0, 0, 0),
        C( 3,  1.20, 0.10, 0.00,   0, 0, 0),
        C( 4,  1.45, 0.10, 1.55,  15, 0, 0),
        C( 5,  1.48, 0.10, 1.80,  17, 0, 0),
        C( 7,  1.46, 0.10, 1.65,  16, 0, 0),
        C( 8,  1.38, 0.10, 0.32,   5, 0, 0),
        C(10,  1.34, 0.10, 0.00,   0, 0, 0),
        C(12,  1.34, 0.10, 0.00,   0, 0, 0),
    ],
  },
),
# ---------------------------------------------------------------- D : LE V
"D": dict(
  titre="Le V de victoire, le fouette de la reference",
  # C'est la choregraphie la plus proche du GIF de reference : il se ramasse VERS la
  # main, la lance en l'air ou elle reste FIXE, se jette du cote oppose pendant que le
  # buste balaie dessous, puis la main revient en gros plan et se cale sur le V.
  # La main en V est fabriquee a partir de pres-hand-point.png (voir fabrique_v.py) :
  # le dessin d'origine est conserve intact, on glisse un doigt de plus derriere lui.
  BODY=[
    ( 1,  0.00, 2.30,   0, 1.00, 1.00),
    ( 2,  0.80, 1.95,  26, 1.20, 0.80),   # il se ramasse VERS la main : elan
    ( 3,  0.78, 1.96,  25, 1.19, 0.81),   # TIENT
    ( 4, -0.90, 2.45, -30, 0.88, 1.15),   # il se jette du cote OPPOSE pendant que la
    ( 5, -0.92, 2.46, -31, 0.88, 1.15),   # main part : ca degage la droite pour elle
    ( 7, -0.88, 2.44, -29, 0.89, 1.14),   # TIENT
    ( 8, -0.45, 2.38, -14, 1.04, 0.97),   # contre-mouvement, ca degage le visage
    (10, -0.15, 2.33,  -5, 1.00, 1.01),   # rebond
    (12,  0.00, 2.30,   0, 1.00, 1.00),
  ],
  HEAD=[
    ( 1,  0.15,  0.00,   0,   0),
    ( 2,  0.20, -0.15, -14, -18),
    ( 3,  0.20, -0.15, -14, -18),   # TIENT
    ( 4,  0.10,  0.05,  10,  20),
    ( 5,  0.10,  0.05,  10,  20),   # TIENT
    ( 7,  0.10,  0.05,  10,  20),   # TIENT
    ( 8,  0.14,  0.02,   6,  10),
    (10,  0.15,  0.00,   2,   3),
    (12,  0.15,  0.00,   0,   0),
  ],
  # Main en V : VRAI DESSIN fourni par Steven (stedi-main-v.png), importe par
  # importe_v.py puis accorde en teinte par accorde_v.py. Les tentatives d assemblage a
  # partir des pieces existantes ont toutes echoue : sur une image plate on ne peut pas
  # separer les phalanges repliees de la masse de la main, donc les doigts ajoutes
  # passaient forcement DERRIERE tout le poing au lieu d en sortir.
  ETATS_POINT={"poing": "hand-fist.png", "v": "pres-hand-v.png"},
  PISTE_POINT=[(1, "poing"), (7, "v")],
  ETATS_OPEN={"poing": "hand-fist.png"},
  PISTE_OPEN=[(1, "poing")],
  CHOREO={
    "hPoint": [
        C( 1,  1.60,  2.60, 3.30,   0, -40,  10),   # poing le long du corps
        C( 2,  3.40,  4.50, 7.20,  10, -70,  22),   # LANCE en une image
        C( 3,  3.55,  4.45, 7.60,  10, -68,  21),   # il TIENT en l'air, bien a droite,
        C( 5,  3.60,  4.30, 7.80,   8, -60,  18),   # pendant que le buste balaie a gauche
        C( 6,  2.90, -1.00, 7.70,   6, -34,   8),   # il repart vers l'objectif
        C( 7,  2.20, -7.00, 7.50,   2, -14,   0),   # il fonce, les doigts s'ouvrent en V
        C( 8,  1.60,-14.00, 7.40,  -8,   9,  -9),   # PIC : gros plan
        C( 9,  1.85, -9.00, 7.20,  -5,   4,  -7),
        C(10,  2.05, -5.00, 7.05,  -3,   2,  -5),
        C(12,  2.20, -2.20, 6.90,   0,   0,  -2),   # tenue, index leve
    ],
    "hOpen": [
        C( 1, -2.20, 0.55, 3.30,   0, 0,  0),
        C( 2, -1.70, 0.75, 2.50,  12, 0, 10),   # poing ferme, rentre pres du corps
        C( 3, -1.70, 0.75, 2.50,  12, 0, 10),   # TIENT
        C( 4, -3.60, 0.45, 2.30, -14, 0, -8),   # jete en dehors, bas : la tete part a
        C( 5, -3.62, 0.45, 2.28, -14, 0, -8),   # gauche, il faut lui laisser la place
        C( 7, -3.55, 0.46, 2.32, -13, 0, -7),   # TIENT
        C( 8, -3.00, 0.50, 2.80,  -8, 0, -4),
        C(10, -2.50, 0.55, 3.10,  -3, 0,  0),
        C(12, -2.20, 0.55, 3.30,   0, 0,  0),   # tenue, poing le long du corps
    ],
    "shoeL": [
        C( 1, -1.34, 0.30, 0.00,  0, 0, 0),
        C( 2, -1.24, 0.30, 0.00,  5, 0, 0),
        C( 3, -1.24, 0.30, 0.00,  5, 0, 0),
        C( 4, -1.46, 0.30, 0.10, -6, 0, 0),
        C( 7, -1.45, 0.30, 0.09, -6, 0, 0),
        C( 9, -1.38, 0.30, 0.01, -2, 0, 0),
        C(12, -1.34, 0.30, 0.00,  0, 0, 0),
    ],
    "shoeR": [
        C( 1,  1.34, 0.10, 0.00,  0, 0, 0),
        C( 2,  1.26, 0.10, 0.04,  6, 0, 0),
        C( 3,  1.26, 0.10, 0.04,  6, 0, 0),
        C( 4,  1.48, 0.10, 0.00, -5, 0, 0),
        C( 7,  1.47, 0.10, 0.00, -5, 0, 0),
        C( 9,  1.39, 0.10, 0.00, -2, 0, 0),
        C(12,  1.34, 0.10, 0.00,  0, 0, 0),
    ],
  },
),

# ---------------------------------------------------------------- E : LE DOIGT
"E": dict(
  titre="L index leve : le mouvement de D, avec l index a la place du V",
  # Le mouvement que Steven a retenu : il se ramasse VERS la
  # main, la lance en l'air ou elle reste FIXE, se jette du cote oppose pendant que le
  # buste balaie dessous, puis la main revient en gros plan et se cale sur le V.
    BODY=[
    ( 1,  0.00, 2.30,   0, 1.00, 1.00),
    ( 2,  0.80, 1.95,  26, 1.20, 0.80),   # il se ramasse VERS la main : elan
    ( 3,  0.78, 1.96,  25, 1.19, 0.81),   # TIENT
    ( 4, -0.90, 2.45, -30, 0.88, 1.15),   # il se jette du cote OPPOSE pendant que la
    ( 5, -0.92, 2.46, -31, 0.88, 1.15),   # main part : ca degage la droite pour elle
    ( 7, -0.88, 2.44, -29, 0.89, 1.14),   # TIENT
    ( 8, -0.45, 2.38, -14, 1.04, 0.97),   # contre-mouvement, ca degage le visage
    (10, -0.15, 2.33,  -5, 1.00, 1.01),   # rebond
    (12,  0.00, 2.30,   0, 1.00, 1.00),
  ],
  HEAD=[
    ( 1,  0.15,  0.00,   0,   0),
    ( 2,  0.20, -0.15, -14, -18),
    ( 3,  0.20, -0.15, -14, -18),   # TIENT
    ( 4,  0.10,  0.05,  10,  20),
    ( 5,  0.10,  0.05,  10,  20),   # TIENT
    ( 7,  0.10,  0.05,  10,  20),   # TIENT
    ( 8,  0.14,  0.02,   6,  10),
    (10,  0.15,  0.00,   2,   3),
    (12,  0.15,  0.00,   0,   0),
  ],
  # Main en V : VRAI DESSIN fourni par Steven (stedi-main-v.png), importe par
  # importe_v.py puis accorde en teinte par accorde_v.py. Les tentatives d assemblage a
  # partir des pieces existantes ont toutes echoue : sur une image plate on ne peut pas
  # separer les phalanges repliees de la masse de la main, donc les doigts ajoutes
  # passaient forcement DERRIERE tout le poing au lieu d en sortir.
  # SEULE difference avec D : le DESSIN de la main. Meme choregraphie au keyframe
  # pres, meme timing, memes maintiens, meme poing lance et tenu en l'air. Le systeme
  # d'etats permet d'echanger l'image a la 7e cle sans toucher au mouvement.
  ETATS_POINT={"poing": "hand-fist.png", "index": "pres-hand-point.png"},
  PISTE_POINT=[(1, "poing"), (7, "index")],
  ETATS_OPEN={"poing": "hand-fist.png"},
  PISTE_OPEN=[(1, "poing")],
  CHOREO={
    "hPoint": [
        C( 1,  1.60,  2.60, 3.30,   0, -40,  10),   # poing le long du corps
        C( 2,  3.40,  4.50, 7.20,  10, -70,  22),   # LANCE en une image
        C( 3,  3.55,  4.45, 7.60,  10, -68,  21),   # il TIENT en l'air, bien a droite,
        C( 5,  3.60,  4.30, 7.80,   8, -60,  18),   # pendant que le buste balaie a gauche
        C( 6,  2.90, -1.00, 7.70,   6, -34,   8),   # il repart vers l'objectif
        C( 7,  2.20, -7.00, 7.50,   2, -14,   0),   # il fonce, l index sort
        C( 8,  1.60,-14.00, 7.40,  -8,   9,  -9),   # PIC : gros plan
        C( 9,  1.85, -9.00, 7.20,  -5,   4,  -7),
        C(10,  2.05, -5.00, 7.05,  -3,   2,  -5),
        C(12,  2.20, -2.20, 6.90,   0,   0,  -2),   # tenue, index leve
    ],
    "hOpen": [
        C( 1, -2.20, 0.55, 3.30,   0, 0,  0),
        C( 2, -1.70, 0.75, 2.50,  12, 0, 10),   # poing ferme, rentre pres du corps
        C( 3, -1.70, 0.75, 2.50,  12, 0, 10),   # TIENT
        C( 4, -3.60, 0.45, 2.30, -14, 0, -8),   # jete en dehors, bas : la tete part a
        C( 5, -3.62, 0.45, 2.28, -14, 0, -8),   # gauche, il faut lui laisser la place
        C( 7, -3.55, 0.46, 2.32, -13, 0, -7),   # TIENT
        C( 8, -3.00, 0.50, 2.80,  -8, 0, -4),
        C(10, -2.50, 0.55, 3.10,  -3, 0,  0),
        C(12, -2.20, 0.55, 3.30,   0, 0,  0),   # tenue, poing le long du corps
    ],
    "shoeL": [
        C( 1, -1.34, 0.30, 0.00,  0, 0, 0),
        C( 2, -1.24, 0.30, 0.00,  5, 0, 0),
        C( 3, -1.24, 0.30, 0.00,  5, 0, 0),
        C( 4, -1.46, 0.30, 0.10, -6, 0, 0),
        C( 7, -1.45, 0.30, 0.09, -6, 0, 0),
        C( 9, -1.38, 0.30, 0.01, -2, 0, 0),
        C(12, -1.34, 0.30, 0.00,  0, 0, 0),
    ],
    "shoeR": [
        C( 1,  1.34, 0.10, 0.00,  0, 0, 0),
        C( 2,  1.26, 0.10, 0.04,  6, 0, 0),
        C( 3,  1.26, 0.10, 0.04,  6, 0, 0),
        C( 4,  1.48, 0.10, 0.00, -5, 0, 0),
        C( 7,  1.47, 0.10, 0.00, -5, 0, 0),
        C( 9,  1.39, 0.10, 0.00, -2, 0, 0),
        C(12,  1.34, 0.10, 0.00,  0, 0, 0),
    ],
  },
),



}

# TORSION : le buste ne se contente plus de basculer dans le plan de l'ecran, il se
# VRILLE. Le lacet est pris proportionnel au roulis (quand on penche, on se tord), et un
# leger tangage suit l'ecrasement (quand on se ramasse, on pique vers l'avant). Ces deux
# rotations n'existent qu'en 3D : c'est exactement ce que la reference obtient en
# redessinant, et qu'on ne peut pas simuler en deplacant des images plates.
TORSION = 0.45      # part du roulis reportee en lacet
PIQUE   = 18.0      # degres de tangage pour un ecrasement complet

# ---------------------------------------------------------------- les arrivees
exec(open(os.path.join(os.path.dirname(__file__), "entrees.txt"), encoding="utf-8").read())

if MODE == "entree":
    if ENT not in ENTREES:
        raise SystemExit("arrivee inconnue : %s (attendu %s)" % (ENT, ", ".join(ENTREES)))
    E = ENTREES[ENT]
    BODY   = [tuple(t) for t in E["BODY"]]
    HEAD   = [tuple(t) for t in E["HEAD"]]
    CHOREO = dict(E["CHOREO"])
    CHOREO["body"] = [C(f, x, 0.0, z, roll, -roll * TORSION, (1.0 - sz) * PIQUE, sx, sz)
                      for (f, x, z, roll, sx, sz) in BODY]
    ETATS_POINT = {"poing": "hand-fist.png"}
    PISTE_POINT = [(1, "poing")]
    ETATS_OPEN  = {"poing": "hand-fist.png"}
    PISTE_OPEN  = [(1, "poing")]
    print("ARRIVEE %s : %s" % (ENT, E["titre"]))
    OBJ["hPoint"] = emplacement("hPoint", ETATS_POINT, MANCHE_POINT, PISTE_POINT, CHOREO["hPoint"])
    OBJ["hOpen"]  = emplacement("hOpen",  ETATS_OPEN,  MANCHE_OPEN,  PISTE_OPEN,  CHOREO["hOpen"])

if MODE == "pose" and VAR not in VARIANTES:
    raise SystemExit("variante inconnue : %s (attendu A, B, C, D ou E)" % VAR)
if MODE == "pose":
    V      = VARIANTES[VAR]
    BODY   = V["BODY"]
    HEAD   = V["HEAD"]
    CHOREO = dict(V["CHOREO"])
    CHOREO["body"] = [C(f, x, 0.0, z, roll, -roll * TORSION, (1.0 - sz) * PIQUE, sx, sz)
                      for (f, x, z, roll, sx, sz) in BODY]
    ETATS_POINT = V["ETATS_POINT"]; PISTE_POINT = V["PISTE_POINT"]
    ETATS_OPEN  = V["ETATS_OPEN"];  PISTE_OPEN  = V["PISTE_OPEN"]
    print("VARIANTE %s : %s" % (VAR, V["titre"]))
    OBJ["hPoint"] = emplacement("hPoint", ETATS_POINT, MANCHE_POINT, PISTE_POINT, CHOREO["hPoint"])
    OBJ["hOpen"]  = emplacement("hOpen",  ETATS_OPEN,  MANCHE_OPEN,  PISTE_OPEN,  CHOREO["hOpen"])

# RACINE : elle porte le deplacement d'ensemble (traverser, sauter, tomber). Le buste,
# les chaussures et les deux mains en heritent. La TETE n'est pas parentee : elle est
# recollee en coordonnees monde par le calage, qui lit matrix_world et voit la racine.
racine = bpy.data.objects.new("racine", None)
scene.collection.objects.link(racine)
for nom in ("body", "shoeL", "shoeR", "hPoint", "hOpen"):
    OBJ[nom].parent = racine
if MODE == "entree":
    for (f, dx, dz) in ENTREES[ENT]["DEPL"]:
        racine.location = (dx, 0.0, dz)
        racine.keyframe_insert("location", frame=F(f))
    for fc in fcurves_de(racine):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"

scene.frame_start, scene.frame_end = 1, F_TOTAL

# DECALAGE TEMPOREL (overlap). Une piece qui claque exactement en meme temps que les
# autres donne un pantin. Dans la reference elles se suivent : les pieds poussent, le
# buste suit, la tete traine, les mains arrivent en dernier. On retarde donc chaque
# piece de quelques images. Tout se resynchronise sur la DERNIERE cle, sinon la pose
# tenue serait floue.
# Retards exprimes sur la grille MULT 2, mis a l'echelle : le decalage doit representer
# la meme DUREE quelle que soit la densite d'images.
DECALAGE = {nom: round(v * MULT / 2) for nom, v in {
    "shoeL": 0, "shoeR": 0,     # les pieds poussent en premier
    "body":  1,                 # le buste suit
    "head":  2,                 # la tete traine (via headOff, plus bas)
    "hPoint": 3, "hOpen": 3,    # les mains arrivent en dernier
}.items()}
F_DERNIERE = F(12) if MODE == "pose" else F(10)   # le rendez-vous commun

def retard(f, d):
    """Retarde une cle, sauf la derniere qui reste le point de rendez-vous."""
    if f >= F_DERNIERE:
        return F_DERNIERE
    return min(F_DERNIERE - 1, f + d)

def pose(ob, k, d=0):
    fd = retard(k["f"], d)
    ob.location = k["loc"]
    ob.rotation_euler = tuple(math.radians(a) for a in k["rot"])
    ob.scale = k["scl"]
    ob.keyframe_insert("location", frame=fd)
    ob.keyframe_insert("rotation_euler", frame=fd)
    ob.keyframe_insert("scale", frame=fd)

for nom, cles in CHOREO.items():
    for k in cles:
        pose(OBJ[nom], k, DECALAGE.get(nom, 0))

# Le decalage de la tete vit sur un objet vide : Blender l'interpole en douceur, et on
# le relit ensuite image par image pour recoller la tete sur le buste.
headOff = bpy.data.objects.new("headOff", None)
scene.collection.objects.link(headOff)
for (f, dx, dz, roll, yaw) in HEAD:
    headOff.location = (dx, 0.0, dz)
    headOff.rotation_euler = (0.0, math.radians(roll), math.radians(yaw))
    fd = retard(F(f), DECALAGE["head"])
    headOff.keyframe_insert("location", frame=fd)
    headOff.keyframe_insert("rotation_euler", frame=fd)

# ---------------------------------------------------------------- respiration bouclee
# 8 images formant un cycle sinusoidal COMPLET : la derniere se raccorde a la premiere
# sans couture, donc la boucle de repos tourne indefiniment dans le jeu.
SOUFFLE = {
    "body":   (0.075, 0.030, 0.6,  0.00),
    "hOpen":  (0.130, 0.055, 2.6,  0.75),
    "hPoint": (0.110, 0.070, 1.8,  0.45),
    "shoeL":  (0.014, 0.010, 0.9,  0.15),   # a peine : ils sont poses, mais pas morts
    "shoeR":  (0.012, 0.009, 0.8,  0.60),
}
TENUE = {nom: cles[-1] for nom, cles in CHOREO.items()}

for i in range(1, IDLE_N + 1):   # boucle vide en mode arrivee (IDLE_N = 0)
    f = F_FIN_BURST + i
    ph_base = 2 * math.pi * i / IDLE_N
    for nom, (dz, dx, dr, dephase) in SOUFFLE.items():
        k = TENUE[nom]
        ph = ph_base + 2 * math.pi * dephase
        s, c = math.sin(ph), math.cos(ph)
        ob = OBJ[nom]
        ob.location = (k["loc"][0] + dx * c, k["loc"][1], k["loc"][2] + dz * s)
        ob.rotation_euler = (
            math.radians(k["rot"][0]), math.radians(k["rot"][1] + dr * s), math.radians(k["rot"][2]))
        ob.scale = k["scl"]
        ob.keyframe_insert("location", frame=f)
        ob.keyframe_insert("rotation_euler", frame=f)
        ob.keyframe_insert("scale", frame=f)
    ph = ph_base + 2 * math.pi * 0.30
    hf, hdx, hdz, hroll, hyaw = HEAD[-1]
    headOff.location = (hdx + 0.040 * math.cos(ph), 0.0, hdz + 0.055 * math.sin(ph))
    headOff.rotation_euler = (0.0, math.radians(hroll + 1.4 * math.sin(ph)), math.radians(hyaw))
    headOff.keyframe_insert("location", frame=f)
    headOff.keyframe_insert("rotation_euler", frame=f)

# ---------------------------------------------------------------- lissage
for ob in [OBJ["body"], OBJ["shoeL"], OBJ["shoeR"], OBJ["hPoint"], OBJ["hOpen"], headOff]:
    for fc in fcurves_de(ob):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"

# ---------------------------------------------------------------- calage de la tete
# On recolle la tete sur le haut du buste a CHAQUE image, pas seulement aux cles :
# entre deux cles, Blender interpole la position du buste et son ecrasement avec des
# courbes differentes, et la tete derivait de plus que l'emboitement du col, ce qui
# ouvrait un trou au cou. matrix_world contient deja position + roulis + ecrasement.
tete, buste = OBJ["head"], OBJ["body"]
cales = []
for f in range(1, F_TOTAL + 1):
    scene.frame_set(f)
    bpy.context.view_layer.update()
    M = buste.matrix_world
    sommet = M @ Vector((0.0, 0.0, BODY_H))
    axe = (M.to_3x3() @ Vector((0.0, 0.0, 1.0))).normalized()
    ancre = sommet - COL * axe
    e = M.to_euler()
    cales.append((f, ancre.x + headOff.location.x, ancre.z + headOff.location.z,
                  e.y * 0.5 + headOff.rotation_euler.y,
                  e.z * 0.6 + headOff.rotation_euler.z))   # elle suit la vrille du buste
for f, x, z, roll, yaw in cales:
    tete.location = (x, REPOS["head"][1], z)
    tete.rotation_euler = (0.0, roll, yaw)
    tete.keyframe_insert("location", frame=f)
    tete.keyframe_insert("rotation_euler", frame=f)
for fc in fcurves_de(tete):
    for kp in fc.keyframe_points:
        kp.interpolation = "LINEAR"

# ---------------------------------------------------------------- calage des bras
# LA REGLE : le personnage n'a pas de bras dessines, mais le spectateur en deduit un.
# Si on trace un trait de l'epaule au poignet, l'axe manchette->doigts de la main DOIT
# etre couche sur ce trait. Sinon la main donne l'impression d'un bras qui part dans le
# sol ou dans le vide, quelle que soit sa position.
#
# On l'impose donc a chaque image plutot que de l'approcher a la main :
#   direction voulue = normalise(poignet - epaule)
#   la main tournee de theta autour de Y envoie son axe local +Z sur (sin0, cos0)
#   => theta = atan2(d.x, d.z)
# Le roulis choregraphie n'est plus qu'un flechissement de poignet ajoute par-dessus.
#
# Les epaules sont accrochees au BUSTE (repere local, origine bas-centre, hauteur 3.35) :
# mesure du sweat, la carrure utile est a 2,85 de haut pour un demi-ecart de 1,00.
EPAULE = {"hPoint": Vector((1.00, 0.0, 2.85)), "hOpen": Vector((-1.00, 0.0, 2.85))}
bras = {}
for nom in ("hPoint", "hOpen"):
    ctl = OBJ[nom]
    calc = []
    for f in range(1, F_TOTAL + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        ep = buste.matrix_world @ EPAULE[nom]
        po = ctl.matrix_world.translation.copy()
        d = po - ep
        theta = math.atan2(d.x, d.z)                    # aligne l'axe de la main sur le bras
        calc.append((f, theta + ctl.rotation_euler.y, ep.copy(), po))
    bras[nom] = calc
    for f, roll, ep, po in calc:
        ctl.rotation_euler.y = roll
        ctl.keyframe_insert("rotation_euler", frame=f)
    for fc in fcurves_de(ctl):
        if fc.data_path == "rotation_euler" and fc.array_index == 1:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"

# Trace de controle : on exporte epaule et poignet en pixels pour pouvoir dessiner le
# trait par-dessus le rendu et verifier l'alignement a l'oeil.
from bpy_extras.object_utils import world_to_camera_view
import json
trace = {}
for f in range(1, F_TOTAL + 1):
    scene.frame_set(f)
    bpy.context.view_layer.update()
    pts = {}
    for nom in ("hPoint", "hOpen"):
        ep = buste.matrix_world @ EPAULE[nom]
        po = OBJ[nom].matrix_world.translation
        for cle, p in (("epaule", ep), ("poignet", po)):
            v = world_to_camera_view(scene, cam, p)
            pts[nom + "_" + cle] = [v.x * RES, (1 - v.y) * RES]
    trace[str(f)] = pts
with open(os.path.join(os.path.dirname(OUT.rstrip("/\\")) or ".", "bras.json"), "w") as fh:
    json.dump(trace, fh)

# ---------------------------------------------------------------- rendu
scene.render.filepath = os.path.join(OUT, "f")
bpy.ops.render.render(animation=True)
print("RENDU OK ->", OUT, F_TOTAL, "images, boucle de repos a partir de", F_FIN_BURST + 1)
print("  manchette visee : point %.3f  open %.3f" % (MANCHE_POINT, MANCHE_OPEN))
