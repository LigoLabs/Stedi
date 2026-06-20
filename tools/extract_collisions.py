# Extrait les lignes bleues (#00a2e8) des calques "level-X - plateforme.png"
# et génère collisions.js (segments normalisés) + des PNG de debug.
# Préserve les COINS des lignes brisées (escaliers) via Douglas-Peucker.
import numpy as np
from PIL import Image, ImageDraw
import json, os, sys

sys.setrecursionlimit(100000)
ASSETS = os.path.join(os.path.dirname(__file__), '..', 'assets')
ROOT   = os.path.join(os.path.dirname(__file__), '..')
TARGET = np.array([0, 162, 232])     # #00a2e8
TOL    = 72                          # distance RGB max
MIN_LEN_FRAC = 0.006                 # longueur mini d'un sous-segment (fraction de largeur)
DP_EPS = 2.2                         # tolérance Douglas-Peucker (px) : préserve les coins
GAP    = 18                          # pont max (colonnes) au-dessus d'une occlusion (feuilles)

def _perp(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    return abs(dy * px - dx * py + bx * ay - by * ax) / (L2 ** 0.5)

def dp(pts, eps):
    if len(pts) < 3:
        return pts[:]
    a, b = pts[0], pts[-1]
    dmax, idx = -1, 0
    for i in range(1, len(pts) - 1):
        d = _perp(pts[i], a, b)
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return dp(pts[:idx + 1], eps)[:-1] + dp(pts[idx:], eps)
    return [a, b]

def extract(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(int)
    H, W, _ = a.shape
    mask = np.sqrt(((a - TARGET) ** 2).sum(axis=2)) < TOL
    raw = []          # chaque trait = liste ordonnée de points (x, y_top)
    active = []
    def close(seg):
        if len(seg['pts']) >= 4:
            raw.append(seg['pts'])
    for x in range(W):
        col = np.where(mask[:, x])[0]
        tops = []
        if len(col):
            start = prev = col[0]
            for y in col[1:]:
                if y - prev > 4:
                    tops.append(start); start = y
                prev = y
            tops.append(start)
        used = [False] * len(active)
        new_active = []
        for yt in tops:
            best, bestd = -1, 999
            for i, seg in enumerate(active):
                if used[i]:
                    continue
                if x - seg['x'] <= GAP and abs(seg['y'] - yt) <= 4:
                    d = abs(seg['y'] - yt)
                    if d < bestd:
                        bestd, best = d, i
            if best >= 0:
                seg = active[best]; used[best] = True
                seg['pts'].append((x, yt)); seg['x'] = x; seg['y'] = yt
                new_active.append(seg)
            else:
                new_active.append({'x': x, 'y': yt, 'pts': [(x, yt)]})
        for i, seg in enumerate(active):
            if not used[i]:
                if x - seg['x'] <= GAP:
                    new_active.append(seg)
                else:
                    close(seg)
        active = new_active
    for seg in active:
        close(seg)
    # chaque trait -> polyligne simplifiée (coins préservés) -> sous-segments
    segs = []
    for pts in raw:
        simp = dp(pts, DP_EPS)
        for i in range(len(simp) - 1):
            (x0, y0), (x1, y1) = simp[i], simp[i + 1]
            if abs(x1 - x0) >= MIN_LEN_FRAC * W:
                segs.append((x0, y0, x1, y1))
    return segs, W, H

BRIDGE_MAX = 145   # trou horizontal max ponté entre 2 marches de même niveau (px)
def bridge_flats(segs):
    """Ponte les marches quasi-horizontales au même niveau séparées par un petit trou
    (vide peint / occlusion par les feuilles) -> surface continue, pas de chute."""
    flat = sorted([s for s in segs if abs(s[3] - s[1]) <= 6], key=lambda s: s[0])
    out = list(segs)
    for a in flat:
        ay = (a[1] + a[3]) / 2
        best = None
        for b in flat:
            gap = b[0] - a[2]
            if gap < 2 or gap > BRIDGE_MAX:
                continue
            if abs((b[1] + b[3]) / 2 - ay) > 8:
                continue
            if best is None or b[0] < best[0]:
                best = b
        if best is not None:
            out.append((a[2], a[3], best[0], best[1]))
    return out

allsegs = {}
for lv in (1, 2, 3, 4):
    segs, W, H = extract(os.path.join(ASSETS, f'level-{lv} - plateforme.png'))
    segs = bridge_flats(segs)
    allsegs[lv] = [{'x0': round(x0 / W, 5), 'y0': round(y0 / H, 5),
                    'x1': round(x1 / W, 5), 'y1': round(y1 / H, 5)} for (x0, y0, x1, y1) in segs]
    print(f'level-{lv}: {len(segs)} sous-segments')
    dec = Image.open(os.path.join(ASSETS, f'level-{lv}.png')).convert('RGB')
    d = ImageDraw.Draw(dec)
    for (x0, y0, x1, y1) in segs:
        d.line([(x0, y0), (x1, y1)], fill=(255, 0, 0), width=3)
        d.ellipse([x0 - 3, y0 - 3, x0 + 3, y0 + 3], fill=(255, 255, 0))   # coins en jaune
        d.ellipse([x1 - 3, y1 - 3, x1 + 3, y1 + 3], fill=(255, 255, 0))
    dec.save(os.path.join(ASSETS, f'_debug_col{lv}.png'))

with open(os.path.join(ROOT, 'collisions.js'), 'w', encoding='utf-8') as f:
    f.write('// Généré par tools/extract_collisions.py — segments de plateformes (sens unique)\n')
    f.write('// normalisés en fractions de l\'image (x0,y0)->(x1,y1). NE PAS éditer à la main.\n')
    f.write('window.LEVEL_COLLISIONS = ' + json.dumps(allsegs, separators=(',', ':')) + ';\n')
print('collisions.js écrit.')
