# Dessine, sur chaque décor peint (assets/level-N.png), les traits de collision
# de collisions.js AVEC leur numéro GLOBAL (le même que l'overlay en jeu = clé COL_ADJUST).
# Sortie : assets/_col-num-level-N.png  -> sert à positionner les orbes à la main.
import json, os, re
from PIL import Image, ImageDraw, ImageFont

ROOT   = os.path.join(os.path.dirname(__file__), '..')
ASSETS = os.path.join(ROOT, 'assets')

# --- lit window.LEVEL_COLLISIONS depuis collisions.js (le JSON entre "= " et ";") ---
src = open(os.path.join(ROOT, 'collisions.js'), encoding='utf-8').read()
data = json.loads(re.search(r'=\s*(\{.*\})\s*;', src, re.S).group(1))

def font(sz):
    for p in (r'C:\Windows\Fonts\arialbd.ttf', r'C:\Windows\Fonts\seguisb.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

gidx = 0                                            # numéro GLOBAL (continue de carte en carte)
for lv in sorted(data, key=int):
    segs = data[lv]
    im = Image.open(os.path.join(ASSETS, f'level-{lv}.png')).convert('RGBA')
    W, H = im.size
    over = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    R, FS = 26, 34
    f = font(FS)
    for g in segs:
        x0, y0 = g['x0'] * W, g['y0'] * H
        x1, y1 = g['x1'] * W, g['y1'] * H
        d.line([(x0, y0), (x1, y1)], fill=(255, 40, 40, 235), width=5)
        for (px, py) in ((x0, y0), (x1, y1)):       # coins en jaune
            d.ellipse([px - 6, py - 6, px + 6, py + 6], fill=(255, 230, 0, 255))
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        d.ellipse([mx - R, my - R, mx + R, my + R], fill=(0, 0, 0, 220),
                  outline=(255, 90, 90, 255), width=3)
        t = str(gidx)
        bb = d.textbbox((0, 0), t, font=f)
        d.text((mx - (bb[2] - bb[0]) / 2, my - (bb[3] - bb[1]) / 2 - bb[1]),
               t, font=f, fill=(255, 255, 255, 255))
        gidx += 1
    out = Image.alpha_composite(im, over).convert('RGB')
    path = os.path.join(ASSETS, f'_col-num-level-{lv}.png')
    out.save(path)
    print(f'level-{lv}: {len(segs)} traits  ->  {os.path.basename(path)}')
print('OK')
