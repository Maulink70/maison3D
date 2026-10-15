#!/usr/bin/env python3
"""Icônes de l'application (icones/icone4-*) et animation de chargement (icones/chargement.webp) d'après le GIF animé
de Mauro (15 octobre 2026 : cadre bleu arrondi en 3D, maison et cube blancs dedans, qui tourne sur un fond sombre avec son
reflet au sol ; 600 × 600 px, 50 images, 2 s).

Icônes : l'image de face du GIF (première image), découpée au bord extérieur du cadre bleu (hors du cadre : transparent ;
l'intérieur garde le fond sombre du GIF, comme dans l'animation). Fichiers : icone4-512.png et icone4-192.png (« any »),
favicon4-64.png, apple-touch-icon4.png (180 px, opaque, fond sombre du GIF : iOS arrondit lui-même), icone4-maskable-512.png
(fond sombre plein, icône sur 72 % de la largeur dans la zone sûre du lanceur Android). Nouveaux noms de fichiers à chaque
changement d'icône (cache des icônes de sw.js, application installée).

Animation : chargement.webp, WebP animé **transparent** (Mauro : « il faudrait qu'il soit en fond transparent lorsqu'il apparaît
au centre de l'écran ») : chaque image du GIF est détourée comme l'icône (cadre bleu, maison, intérieur sombre ; sans le fond
ni le reflet au sol), une image sur deux (25 images de 80 ms : même vitesse), cadrage carré centré sur l'axe de rotation,
256 px, qualité 82 (≈ 100 Ko au lieu de 3,2 Mo) ; affichée au milieu de l'écran pendant le chargement des éléments
(js/chargement.js), avec une ombre portée en CSS.

    python3 outils/icone_anim.py <animation.gif>        # le GIF n'est pas dans le dépôt (3 Mo) ; sa première image y est :
    python3 outils/icone_anim.py                        # icones/source-anim.webp (icônes seulement)
"""
import sys
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFilter

RACINE = Path(__file__).resolve().parent.parent
ICONES = RACINE / 'icones'
SOURCE_F0 = ICONES / 'source-anim.webp'     # première image du GIF (de face), gardée pour refaire les icônes
FOND = (48, 53, 60)                          # fond sombre du GIF (haut de l'image)
T = 1024                                     # taille de travail des icônes


def image_de_face(gif):
    if gif:
        im = Image.open(gif); im.seek(0); return im.convert('RGB')
    return Image.open(SOURCE_F0).convert('RGB')


YC = 298.5                                   # ligne du milieu de l'icône dans le GIF (axe de rotation vertical : haut et bas symétriques)


def masque(im):
    """Alpha de l'icône seule dans une image du GIF : cadre bleu et traits blancs de la maison, intérieur du cadre gardé
    (fond sombre du GIF), sans le fond ni le reflet au sol. Le reflet touche le bas du cadre et il est bleu lui aussi :
    on le coupe par symétrie, le bas de l'icône étant, colonne par colonne, le miroir de son haut autour de YC."""
    a = np.asarray(im).astype(int)
    sat = a[:, :, 2] - a[:, :, 0]; clair = a.min(axis=2)
    m = (sat > 60) & (a[:, :, 2] > 80) | (clair > 185)                 # bleu du cadre, blanc de la maison et du cube
    m[445:, :] = False                                                  # sous l'icône : seulement le reflet
    ys = np.arange(m.shape[0])[:, None]
    haut = np.where(m.any(axis=0), m.argmax(axis=0), 0)                 # première ligne de l'icône, par colonne
    m &= ys <= (2 * YC - haut + 3)[None, :]                             # … et sa symétrique : le reflet est dessous
    mi = Image.fromarray((m * 255).astype('uint8'), 'L').filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    ImageDraw.floodfill(mi, (0, 0), 128)                                # l'extérieur, depuis un coin
    ext = np.asarray(mi) == 128
    etiq, n = ndimage.label(~ext)                                       # le cadre et son intérieur : le plus gros morceau
    tailles = ndimage.sum(np.ones_like(etiq), etiq, range(1, n + 1))
    dedans = etiq == (1 + int(np.argmax(tailles)))
    return Image.fromarray((dedans * 255).astype('uint8'), 'L').filter(ImageFilter.GaussianBlur(0.7))


def detourer(im):
    """L'image RGBA de l'icône, pleine taille : alpha = masque ; au bord, la couleur est débarrassée du fond du GIF
    (fond estimé ligne par ligne, loin de l'icône), pour ne pas laisser de liseré sombre sur un fond clair."""
    alpha = np.asarray(masque(im)).astype(float) / 255
    rgb = np.asarray(im).astype(float)
    fond = np.concatenate([rgb[:, 100:150], rgb[:, 450:500]], axis=1).mean(axis=1)   # couleur du fond par ligne
    a = alpha[:, :, None]; bord = (alpha > 0.02) & (alpha < 0.98)
    pur = np.clip((rgb - (1 - a) * fond[:, None, :]) / np.maximum(a, 0.02), 0, 255)
    rgb = np.where(bord[:, :, None], pur, rgb)
    out = np.dstack([rgb, alpha * 255]).round().astype('uint8')
    return Image.fromarray(out, 'RGBA')


def decouper(im):
    """L'icône seule (RGBA), recadrée à son contenu."""
    rgba = detourer(im)
    return rgba.crop(rgba.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())


def poser(icone, taille, part, fond=None):
    """L'icône (découpée) sur `part` de la largeur d'un carré de `taille` px ; `fond` = couleur pleine (None = transparent)."""
    im = Image.new('RGBA', (T, T), fond + (255,) if fond else (0, 0, 0, 0))
    l = round(T * part); h = round(icone.height * l / icone.width)
    ic = icone.resize((l, h), Image.LANCZOS)
    im.alpha_composite(ic, ((T - l) // 2, (T - h) // 2))
    return im.resize((taille, taille), Image.LANCZOS)


def animation(gif, sortie, taille=256, pas=2, duree=80, qualite=82, marge=6):
    """WebP animé transparent : chaque image du GIF détourée, cadrage carré commun centré sur l'axe de rotation."""
    im = Image.open(gif); images = []
    for i in range(0, im.n_frames, pas):
        im.seek(i); images.append(detourer(im.convert('RGB')))
    boites = [x.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox() for x in images]
    x0, y0 = min(b[0] for b in boites), min(b[1] for b in boites); x1, y1 = max(b[2] for b in boites), max(b[3] for b in boites)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; r = max(x1 - x0, y1 - y0) / 2 + marge
    cadre = (round(cx - r), round(cy - r), round(cx + r), round(cy + r))
    images = [x.crop(cadre).resize((taille, taille), Image.LANCZOS) for x in images]
    images[0].save(sortie, 'WEBP', save_all=True, append_images=images[1:], duration=duree, loop=0, quality=qualite, method=6)
    return len(images), sortie.stat().st_size, cadre


def main():
    gif = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    f0 = image_de_face(gif)
    if gif: f0.save(SOURCE_F0, 'WEBP', quality=90, method=6)
    icone = decouper(f0)
    poser(icone, 512, 0.96).save(ICONES / 'icone4-512.png', optimize=True)
    poser(icone, 192, 0.96).save(ICONES / 'icone4-192.png', optimize=True)
    poser(icone, 64, 0.96).save(ICONES / 'favicon4-64.png', optimize=True)
    poser(icone, 180, 0.84, fond=FOND).convert('RGB').save(ICONES / 'apple-touch-icon4.png', optimize=True)
    poser(icone, 512, 0.72, fond=FOND).convert('RGB').save(ICONES / 'icone4-maskable-512.png', optimize=True)
    print('icônes :', icone.size, 'px découpés')
    if gif:
        n, o, cadre = animation(gif, ICONES / 'chargement.webp')
        print('animation :', n, 'images,', round(o / 1024), 'Ko, cadre', cadre)


if __name__ == '__main__':
    main()
