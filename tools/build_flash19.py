#!/usr/bin/env python3
"""Construit le sprite-sheet du FLASH d'energie joue au centre de l'orbe finale.

Source : les 28 frames PNG « Combined Flash FX Overlay 19 » dans
`assets/smoke-export/Combined Flash FX Overlay 19/` (480x270, fond transparent,
eclats de lumiere bleu-blanc qui jaillissent d'un foyer central).

Sortie : `assets/fx/flash19.webp`, bande horizontale de frames CARREES, CENTREES
sur le foyer de l'explosion (-> dessine centre sur l'orbe, foot 0.5).

Deux traitements :
  1. RECOLORATION chaud/dore : l'effet d'origine est bleu ; la naissance de
     l'orbe finale est une lumiere DOREE. On remappe par luminance vers un degrade
     ambre -> or -> blanc (alpha d'origine conserve), pour que ca FUSIONNE avec les
     god-rays chauds au lieu de jurer en bleu froid.
  2. CADRAGE carre centre sur le barycentre lumineux (pondere par l'alpha), cote =
     2x la portee max des eclats -> le foyer reste au centre de la frame.

Requiert Pillow + numpy. Relancer apres avoir change les frames sources.
"""
import glob
import math
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "assets", "smoke-export", "Combined Flash FX Overlay 19")
OUT = os.path.join(ROOT, "assets", "fx", "flash19.webp")   # WebP léger (cf. maps)

FRAME = 448          # cote d'une frame (HAUTE RES ~ taille de dessin -> net ; source ~480px)
MARGIN = 0.08        # marge autour des eclats (fraction de la portee)
ALPHA_MIN = 6        # seuil alpha pour les pixels « pleins »
WEBP_Q = 92          # qualite WebP

# degrade chaud applique par luminance (0 -> 1) : ambre profond -> or -> blanc chaud
WARM = np.array([
    [255, 138, 54],    # L ~ 0.0  : ambre
    [255, 200, 104],   # L ~ 0.5  : or
    [255, 250, 232],   # L ~ 1.0  : blanc chaud
], dtype=np.float32)


def warm_recolor(arr):
    """arr : HxWx4 uint8 (RGBA bleu) -> HxWx4 uint8 recolore chaud, alpha conserve."""
    rgb = arr[:, :, :3].astype(np.float32)
    a = arr[:, :, 3:4].astype(np.float32)
    lum = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]) / 255.0
    lum = np.clip(lum, 0, 1)
    # interpolation lineaire dans la rampe a 3 points
    seg = np.clip(lum * 2.0, 0, 2.0)
    i0 = np.clip(np.floor(seg).astype(int), 0, 1)
    frac = (seg - i0)[:, :, None]
    c0 = WARM[i0]
    c1 = WARM[i0 + 1]
    out = c0 * (1 - frac) + c1 * frac
    return np.dstack([out, a[:, :, 0]]).astype(np.uint8)


def main():
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
    if not files:
        raise SystemExit(f"Aucune frame trouvee dans {SRC_DIR}")
    frames = [np.asarray(Image.open(f).convert("RGBA")) for f in files]

    # barycentre lumineux (pondere alpha) + portee max, sur l'ensemble des frames
    sx = sy = sw = 0.0
    for arr in frames:
        a = arr[:, :, 3].astype(np.float32)
        ys, xs = np.nonzero(a > ALPHA_MIN)
        if xs.size == 0:
            continue
        w = a[ys, xs]
        sx += float((xs * w).sum()); sy += float((ys * w).sum()); sw += float(w.sum())
    cx, cy = sx / sw, sy / sw
    reach = 0.0
    for arr in frames:
        a = arr[:, :, 3]
        ys, xs = np.nonzero(a > ALPHA_MIN)
        if xs.size == 0:
            continue
        d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).max()
        reach = max(reach, float(d))
    side = int(round(2 * reach * (1 + MARGIN)))
    foot = 0.5
    print(f"foyer=({cx:.0f},{cy:.0f})  portee={reach:.0f}  frame carree={side}px  foot={foot}")

    n = len(frames)
    cols = math.ceil(math.sqrt(n))            # grille ~carree (frames HD -> pas en 1 rangee)
    rows = math.ceil(n / cols)
    sheet = Image.new("RGBA", (FRAME * cols, FRAME * rows), (0, 0, 0, 0))
    half = side / 2.0
    for i, arr in enumerate(frames):
        warm = Image.fromarray(warm_recolor(arr), "RGBA")
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(warm, (int(round(half - cx)), int(round(half - cy))), warm)
        sq = sq.resize((FRAME, FRAME), Image.LANCZOS)
        sheet.paste(sq, ((i % cols) * FRAME, (i // cols) * FRAME))

    sheet.save(OUT, "WEBP", quality=WEBP_Q, method=6)
    mb = os.path.getsize(OUT) / 1e6
    print(f"ecrit {OUT}  ({sheet.size[0]}x{sheet.size[1]}, {n} frames, grille {cols}x{rows}, {mb:.1f} Mo)")
    print(f"\n-> FLASH19 : frames:{n}, fw:{FRAME}, fh:{FRAME}, cols:{cols}  (dessine centre, foot 0.5)")


if __name__ == "__main__":
    main()
