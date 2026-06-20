"""Produit les planches DEFINITIVES pour le jeu, avec les metadonnees de calage.

RECADRAGE PAR IMAGE. Une case commune a toutes les images gaspille enormement : sur
l'arrivee, le perso traverse le cadre, donc la boite qui contient TOUTES les positions
fait 643x923 alors qu'a chaque instant il n'occupe que ~330x340. On recadre donc chaque
image sur SA propre boite, on prend la plus grande comme taille de case, et on retient un
decalage PAR IMAGE. La texture passe ainsi de 11,9 a 2,6 megapixels sur l'arrivee.

Ce que le jeu doit savoir pour poser un sprite au bon endroit :
  R        taille du cadre de rendu d'origine (carre)
  hf       hauteur du perso, en fraction de R      -> donne l'echelle
  ff       ligne de pieds (z=0), en fraction de R  -> donne le calage vertical
  fw, fh   taille d'une case ; cols ; frames
  off      decalage (ox, oy) de CHAQUE image dans le cadre d'origine

Calcul de tirage, pour un perso de PRES_H * PRES_SCALE pixels a l'ecran :
  D      = hauteurVoulue / hf        taille qu'aurait le cadre ENTIER
  gauche = stageX - D/2              le monde x=0 est au centre du cadre
  haut   = feetY  - ff * D
  la case i se dessine en (gauche + ox[i]*D/R, haut + oy[i]*D/R), taille (fw*D/R, fh*D/R)
"""
from PIL import Image
import sys, os, glob, json

DST = r"D:/Documents/Developpement/Stedi/stedi/assets/avatar"
QUAL = int(sys.argv[1]) if len(sys.argv) > 1 else 82
MARGE = 5

# hauteur du perso et ligne de pieds, en fraction du cadre de rendu (geometrie camera :
# objectif 40 mm, capteur 36 mm vertical, recul 22 ; voir scene.py)
GEO = {640: dict(hf=0.50505, ff=0.82394), 1024: dict(hf=0.31563, ff=0.89268)}

def planche(src, nom, cols, fps):
    fs = sorted(glob.glob(os.path.join(src, "*.png")))
    ims = [Image.open(f).convert("RGBA") for f in fs]
    R = ims[0].width
    boites = []
    for im in ims:
        b = im.getbbox() or (0, 0, 1, 1)
        boites.append((max(0, b[0] - MARGE), max(0, b[1] - MARGE),
                       min(R, b[2] + MARGE), min(R, b[3] + MARGE)))
    fw = max(b[2] - b[0] for b in boites)
    fh = max(b[3] - b[1] for b in boites)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGBA", (fw * cols, fh * rows), (0, 0, 0, 0))
    off = []
    for i, (im, b) in enumerate(zip(ims, boites)):
        # la case a une taille FIXE : on centre la boite de l'image dedans et on ajuste
        # le decalage en consequence, ce qui evite un cas particulier par image
        ox = b[0] - (fw - (b[2] - b[0])) // 2
        oy = b[1] - (fh - (b[3] - b[1])) // 2
        ox = max(0, min(R - fw, ox)); oy = max(0, min(R - fh, oy))
        sheet.paste(im.crop((ox, oy, ox + fw, oy + fh)), ((i % cols) * fw, (i // cols) * fh))
        off.append([ox, oy])
    out = os.path.join(DST, nom + ".webp")
    sheet.save(out, format="WEBP", quality=QUAL, method=6)
    print("%-18s %4dx%-4d  %2d cases de %3dx%-3d  %5.2f Mpx  %6.1f Ko" %
          (nom + ".webp", sheet.width, sheet.height, len(ims), fw, fh,
           sheet.width * sheet.height / 1e6, os.path.getsize(out) / 1024))
    return dict(frames=len(ims), fw=fw, fh=fh, cols=cols, R=R, fps=fps, off=off, **GEO[R])

# CADENCES DIFFERENTES. Le saut couvre une enorme distance : a 20 i/s il avancait de
# 44 px d'une image a l'autre et clignotait. Il est donc rendu a densite DOUBLE et joue a
# 40 i/s : meme duree, pas deux fois plus petits. La pose, elle, bouge peu et reste a
# 20 i/s. Le raccord n'en souffre pas, il ne depend que de l'etat de la derniere image.
m = {"saut": planche("entree-saut", "pres-saut", 7, 40),
     "pose": planche("frames-E", "pres-pose", 8, 20)}
json.dump(m, open("planches.json", "w"), indent=1)
print()
for k, v in m.items():
    print("%s : %d images a %d i/s, case %dx%d sur %d colonnes, cadre %d"
          % (k, v["frames"], v["fps"], v["fw"], v["fh"], v["cols"], v["R"]))
