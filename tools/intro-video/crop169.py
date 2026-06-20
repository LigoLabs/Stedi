#!/usr/bin/env python3
"""Recadre en 16:9 les images cles telechargees depuis ChatGPT.

gpt-image rend du 1536x1024 (3:2). Seedance et le jeu travaillent en 16:9.
Ce script rogne au centre (en hauteur si l'image est trop haute, en largeur
sinon), puis redimensionne en 1536x864 et ecrit dans un sous-dossier `169/`.

    python tools/intro-video/crop169.py D:\\Downloads\\intro
    python tools/intro-video/crop169.py D:\\Downloads\\intro --biais 0.35

`--biais` decale le recadrage vertical : 0 = garde le haut, 0.5 = centre
(defaut), 1 = garde le bas. Utile quand l'action est haute dans le cadre.
"""
import argparse
import pathlib
import sys

from PIL import Image

CIBLE_W, CIBLE_H = 1536, 864
RATIO = CIBLE_W / CIBLE_H
EXT = {".png", ".jpg", ".jpeg", ".webp"}


def recadre(im: Image.Image, biais: float) -> Image.Image:
    w, h = im.size
    if w / h > RATIO:                      # trop large : on rogne les cotes
        nw = round(h * RATIO)
        x = (w - nw) // 2
        im = im.crop((x, 0, x + nw, h))
    else:                                  # trop haute : on rogne haut/bas
        nh = round(w / RATIO)
        y = round((h - nh) * biais)
        im = im.crop((0, y, w, y + nh))
    return im.resize((CIBLE_W, CIBLE_H), Image.LANCZOS)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("dossier", help="dossier contenant les images clés")
    ap.add_argument("--biais", type=float, default=0.5,
                    help="0 = garde le haut, 0.5 = centre, 1 = garde le bas")
    a = ap.parse_args()

    src = pathlib.Path(a.dossier)
    if not src.is_dir():
        print(f"dossier introuvable : {src}")
        return 1

    dst = src / "169"
    dst.mkdir(exist_ok=True)

    n = 0
    for f in sorted(src.iterdir()):
        if f.suffix.lower() not in EXT or f.parent == dst:
            continue
        with Image.open(f) as im:
            out = recadre(im.convert("RGB"), max(0.0, min(1.0, a.biais)))
        cible = dst / (f.stem + ".png")
        out.save(cible)
        print(f"{f.name} -> {cible.relative_to(src)}  ({out.size[0]}x{out.size[1]})")
        n += 1

    print(f"\n{n} image(s) recadrée(s) dans {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
