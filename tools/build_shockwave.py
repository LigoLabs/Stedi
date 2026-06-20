#!/usr/bin/env python3
"""Construit le sprite-sheet du SHOCKWAVE joué au BOOM (naissance de l'orbe finale).

Source : les 121 frames PNG « Shockwave » dans `assets/smoke-export/Shockwave/`
(1920x1080, explosion d'énergie blanche en « papillon » sur fond NOIR OPAQUE, alpha=255
partout). Donc rendu ADDITIF côté jeu (le noir n'ajoute rien, seul le burst lumineux
ressort).

Sortie : `assets/fx/shockwave.webp`, bande horizontale de frames 16:9 (forme large du
burst conservée). RECOLORÉ chaud (gris -> ambre/or) en PRÉSERVANT la luminance : le noir
reste noir (indispensable en additif), seuls les éclats deviennent or.

  • SOUS-ÉCHANTILLONNAGE : 1 frame sur STEP -> bande < 16384 px (limite canvas).

Requiert Pillow + numpy. Relancer après avoir changé les frames sources.
"""
import glob
import math
import os

import numpy as np
from PIL import Image

MAX_SIDE = 4096      # limite par côté de la feuille (compat texture/mobile)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "assets", "smoke-export", "Shockwave")
OUT = os.path.join(ROOT, "assets", "fx", "shockwave.webp")   # WebP léger

FW, FH = 768, 432    # frame 16:9 HAUTE RES (dessiné très grand au boom -> il faut du détail)
STEP = 4             # 1 frame sur STEP (sous-échantillonnage ; ~30 frames suffisent pour un boom rapide)
WEBP_Q = 90          # qualite WebP

# Direction de teinte chaude, mélangée par luminance puis MULTIPLIÉE par la luminance
# -> noir conservé (additif-safe), éclats chauds (ambre quand faible, blanc-or au coeur).
TINT_LOW = np.array([1.00, 0.60, 0.26], dtype=np.float32)   # ambre (éclats faibles)
TINT_HIGH = np.array([1.00, 0.95, 0.82], dtype=np.float32)  # blanc-or (coeur brûlant)


L_FLOOR = 0.05       # en dessous : vrai noir (additif-safe, pas de voile de fond)
L_GAMMA = 0.6        # < 1 : remonte les demi-tons -> le burst « wispy » ressort mieux


def warm(im):
    rgb = np.asarray(im.convert("RGB")).astype(np.float32) / 255.0
    L = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2])
    L = np.where(L < L_FLOOR, 0.0, L)
    Lb = np.power(np.clip(L, 0, 1), L_GAMMA)[:, :, None]    # luminance boostée (brillance)
    Lt = np.clip(L, 0, 1)[:, :, None]                       # luminance brute (pour la teinte)
    tint = TINT_LOW * (1 - Lt) + TINT_HIGH * Lt
    out = np.clip(255.0 * Lb * tint, 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGB").convert("RGBA")


def main():
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
    if not files:
        raise SystemExit(f"Aucune frame trouvee dans {SRC_DIR}")
    files = files[::STEP]
    n = len(files)
    cols = max(1, min(n, MAX_SIDE // FW))     # autant de colonnes que la largeur le permet
    rows = math.ceil(n / cols)
    sw, sh = FW * cols, FH * rows
    print(f"source {Image.open(files[0]).size}  ->  frame {FW}x{FH}  x{n} frames  ->  grille {cols}x{rows} ({sw}x{sh})")
    if sw > MAX_SIDE or sh > MAX_SIDE:
        raise SystemExit(f"feuille trop grande: {sw}x{sh}px (max {MAX_SIDE}). Réduire FW/FH ou augmenter STEP.")

    sheet = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    for i, f in enumerate(files):
        fr = warm(Image.open(f)).resize((FW, FH), Image.LANCZOS)
        sheet.paste(fr, ((i % cols) * FW, (i // cols) * FH))

    sheet.save(OUT, "WEBP", quality=WEBP_Q, method=6)
    mb = os.path.getsize(OUT) / 1e6
    print(f"ecrit {OUT}  ({sw}x{sh}, {n} frames, grille {cols}x{rows}, {mb:.1f} Mo)")
    print(f"\n-> SHOCKWAVE : frames:{n}, fw:{FW}, fh:{FH}, cols:{cols}  (additif, dessiné centré 16:9)")


if __name__ == "__main__":
    main()
