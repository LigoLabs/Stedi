#!/usr/bin/env python3
"""Construit le sprite-sheet du VORTEX de particules (remplace le vortex procédural).

Source : les 151 frames PNG « Particles » dans `assets/smoke-export/Particles/`
(1920x1080, champ de particules dorées sur fond NOIR qui CONVERGENT vers le centre).

Sortie : `assets/fx/particles.webp`, bande horizontale de frames CARRÉES centrées sur
le foyer de convergence. Dessinée en additif (`lighter`) côté jeu -> le fond noir
disparaît, seules les particules lumineuses ressortent.

Choix :
  • SOUS-ÉCHANTILLONNAGE : 151 frames -> ~76 (1 sur 2).
  • GRILLE (et non bande 1 rangée) : pour garder des frames HAUTE RÉSOLUTION (384 px)
    sans dépasser la limite ~4096 px par côté, on dispose les frames en grille carrée
    `cols x rows`. La source est très fine -> downscaler à 192 px la rendait molle ;
    384 px ≈ la taille de dessin -> net.
  • CADRAGE : carré plein-hauteur (1080) centré horizontalement -> capte le coeur
    dense du tourbillon ; les particules les plus lointaines sont rognées (hors orbe
    de toute façon).

Requiert Pillow + numpy. Relancer après avoir changé les frames sources.
"""
import glob
import math
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "assets", "smoke-export", "Particles")
OUT = os.path.join(ROOT, "assets", "fx", "particles.webp")   # WebP : ~5x plus léger que PNG (cf. maps)
WEBP_Q = 92          # qualité WebP (assez haut pour garder les fines particules)

FRAME = 512          # côté d'une frame : 1:1 avec la taille de dessin virtuelle (~518 px) -> net
TARGET = 64          # nb de frames (échantillonnage régulier) ; 8x8 @512 = 4096² (max texture)
MAX_SIDE = 4096      # limite par côté de la feuille (compat mobile/texture)

# Les particules sources sont d'un ambre TERNE/SOMBRE (rgb~59,37,19) : invisibles en
# additif sur le ciel clair du désert. On les REBRILLE en or riche (l'alpha = la forme),
# pour qu'elles ressortent. Rampe par densité (alpha) : or chaud -> blanc-or au coeur.
# Or RICHE/SATURÉ (pas blanc-or) : dessiné en source-over, il faut que ça contraste sur
# le ciel pâle du désert -> on reste dans l'ambre/or franc, jamais proche du blanc.
GOLD_LOW = np.array([255, 138, 48], dtype=np.float32)    # particule isolée : ambre profond
GOLD_HIGH = np.array([255, 198, 104], dtype=np.float32)  # coeur dense : or franc


ALPHA_FLOOR = 16     # en dessous : fond -> totalement transparent (tue le rectangle de fond)


def brighten(im):
    arr = np.asarray(im).astype(np.float32)
    a8 = arr[:, :, 3]
    a8 = np.where(a8 < ALPHA_FLOOR, 0.0, a8)             # fond quasi-transparent -> vraiment 0
    a = (a8 / 255.0)[:, :, None]
    inten = np.power(a, 0.5)                              # densité -> 0..1 (adoucie)
    rgb = GOLD_LOW * (1 - inten) + GOLD_HIGH * inten
    out = np.dstack([rgb, a8])
    return Image.fromarray(out.astype(np.uint8))


def radial_mask(size):
    """Dégradé radial [0..1] : 1 au centre, fondu vers 0 au bord -> disque doux
    (supprime la limite CARRÉE de la frame). Corners à 0."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2.0
    d = np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / (size / 2.0)   # 0 centre, 1 au bord médian
    m = np.clip((1.0 - d) / (1.0 - 0.82), 0.0, 1.0)            # plein jusqu'à 0.82, fondu jusqu'au bord
    return m * m * (3 - 2 * m)                                  # smoothstep


def main():
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
    if not files:
        raise SystemExit(f"Aucune frame trouvee dans {SRC_DIR}")
    # échantillonnage RÉGULIER de TARGET frames sur tout le clip (mieux qu'un pas fixe)
    L = len(files)
    n = min(TARGET, L)
    files = [files[round(i * (L - 1) / (n - 1))] for i in range(n)]

    im0 = Image.open(files[0]).convert("RGBA")
    W, H = im0.size
    side = min(W, H)                 # carré plein-hauteur
    ox = (W - side) // 2             # centré horizontalement
    oy = (H - side) // 2

    cols = math.ceil(math.sqrt(n))   # grille ~carrée
    rows = math.ceil(n / cols)
    sw, sh = FRAME * cols, FRAME * rows
    print(f"source {W}x{H}  ->  crop {side}px  x{n} frames  ->  grille {cols}x{rows} ({sw}x{sh})")
    if sw > MAX_SIDE or sh > MAX_SIDE:
        raise SystemExit(f"feuille trop grande: {sw}x{sh}px (max {MAX_SIDE}). Réduire FRAME ou augmenter STEP.")

    mask = radial_mask(FRAME)                            # estompe les bords -> plus de carré
    sheet = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    for i, f in enumerate(files):
        im = brighten(Image.open(f).convert("RGBA"))
        crop = im.crop((ox, oy, ox + side, oy + side)).resize((FRAME, FRAME), Image.LANCZOS)
        arr = np.asarray(crop).astype(np.float32)
        arr[:, :, 3] *= mask                             # alpha fondu en disque doux
        crop = Image.fromarray(arr.astype(np.uint8))
        sheet.paste(crop, ((i % cols) * FRAME, (i // cols) * FRAME))

    sheet.save(OUT, "WEBP", quality=WEBP_Q, method=6)
    mb = os.path.getsize(OUT) / 1e6
    print(f"ecrit {OUT}  ({sw}x{sh}, {n} frames, {mb:.1f} Mo, q{WEBP_Q})")
    print(f"\n-> PARTICLES : frames:{n}, fw:{FRAME}, fh:{FRAME}, cols:{cols}  (dessine centré)")


if __name__ == "__main__":
    main()
