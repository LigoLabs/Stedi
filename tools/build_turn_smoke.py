#!/usr/bin/env python3
"""Construit le sprite-sheet du FX de derapage (changement de direction brutal).

Source : les 35 frames PNG « Anime Smoke Element 10 » exportees dans
`assets/smoke-export/Anime Smoke Element 10/` (1024x576, fond transparent).

Sortie : `assets/fx/turn-smoke.png`, une bande horizontale de frames CARREES
(format attendu par le systeme FXA de game.js : drawImage(sp, fr*FW, 0, FW, FH...)).

Demarche :
  1. union des bounding-box alpha de toutes les frames -> on recadre serre, en
     gardant la position relative de la fumee stable d'une frame a l'autre.
  2. on pose ce crop dans un canevas CARRE, centre en X, BASE calee vers le bas
     (la volute jaillit du sol au niveau des pieds).
  3. resize -> FRAME px et assemblage en bande.
  4. on imprime `foot` (ligne de sol dans la frame) a reporter dans FXA.turn.

Requiert Pillow + numpy. Relancer apres avoir change les frames sources.
"""
import glob
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "assets", "smoke-export", "Anime Smoke Element 10")
OUT = os.path.join(ROOT, "assets", "fx", "turn-smoke.png")

FRAME = 160          # cote d'une frame dans la bande
MARGIN = 0.06        # marge transparente autour du contenu (fraction du cote)
ALPHA_MIN = 8        # seuil alpha pour considerer un pixel « plein »


def main():
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
    if not files:
        raise SystemExit(f"Aucune frame trouvee dans {SRC_DIR}")

    frames = [Image.open(f).convert("RGBA") for f in files]
    W, H = frames[0].size

    # 1. union des bbox alpha
    l, t, r, b = W, H, 0, 0
    for im in frames:
        a = np.asarray(im)[:, :, 3]
        ys, xs = np.where(a > ALPHA_MIN)
        if xs.size == 0:
            continue
        l = min(l, int(xs.min())); r = max(r, int(xs.max()) + 1)
        t = min(t, int(ys.min())); b = max(b, int(ys.max()) + 1)
    cw, ch = r - l, b - t
    print(f"union bbox = ({l},{t})-({r},{b})  taille {cw}x{ch}")

    # 2. canevas carre : cote = max(cw, ch) + marge ; base du contenu calee en bas
    side = int(round(max(cw, ch) * (1 + 2 * MARGIN)))
    pad = int(round(max(cw, ch) * MARGIN))
    ox = (side - cw) // 2          # centre horizontal
    oy = side - ch - pad           # base proche du bas (marge en dessous)
    foot = (oy + ch) / side        # ligne de sol = bas du contenu, en fraction
    print(f"frame carree = {side}px  offset=({ox},{oy})  foot={foot:.3f}")

    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for i, im in enumerate(frames):
        crop = im.crop((l, t, r, b))
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(crop, (ox, oy), crop)
        sq = sq.resize((FRAME, FRAME), Image.LANCZOS)
        sheet.paste(sq, (i * FRAME, 0))

    sheet.save(OUT)
    print(f"ecrit {OUT}  ({sheet.size[0]}x{sheet.size[1]}, {len(frames)} frames)")
    print(f"\n-> FXA.turn : frames:{len(frames)}, fw:{FRAME}, fh:{FRAME}, "
          f"foot:{foot:.2f}, dur:0.5")


if __name__ == "__main__":
    main()
