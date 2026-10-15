#!/usr/bin/env python3
"""Icônes de l'application (icones/icone4-*) et animation de chargement (icones/chargement.webp) d'après le GIF animé
de Mauro (15 octobre 2026 : cadre bleu arrondi en 3D, maison et cube blancs dedans, qui tourne sur un fond sombre avec son
reflet au sol ; 600 × 600 px, 50 images, 2 s).

Icônes : l'image de face du GIF (première image), découpée au bord extérieur du cadre bleu (hors du cadre : transparent ;
l'intérieur garde le fond sombre du GIF, comme dans l'animation). Fichiers : icone4-512.png et icone4-192.png (« any »),
favicon4-64.png, apple-touch-icon4.png (180 px, opaque, fond sombre du GIF : iOS arrondit lui-même), icone4-maskable-512.png
(fond sombre plein, icône sur 72 % de la largeur dans la zone sûre du lanceur Android). Nouveaux noms de fichiers à chaque
changement d'icône (cache des icônes de sw.js, application installée).

Animation : chargement.webp, WebP animé (toutes les navigateurs actuels), une image sur deux du GIF (25 images de 80 ms :
même vitesse), recadrée autour du cadre et de son reflet, 320 px, qualité 80 (≈ 60 Ko au lieu de 3,2 Mo pour le GIF) ;
affichée au milieu de l'écran pendant le chargement des éléments (js/chargement.js).

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


def decouper(im):
    """L'icône seule (RGBA) : tout ce qui est à l'intérieur du bord extérieur du cadre bleu."""
    a = np.asarray(im).astype(int)
    bleu = (a[:, :, 2] - a[:, :, 0] > 60) & (a[:, :, 2] > 80)          # le cadre (bleu clair à bleu sombre) ; le reflet au sol, moins saturé, est écarté
    m = Image.fromarray((bleu * 255).astype('uint8'), 'L')
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))   # petits trous du bruit fermés
    ImageDraw.floodfill(m, (0, 0), 128)                                 # l'extérieur, depuis un coin
    ext = np.asarray(m) == 128
    etiq, n = ndimage.label(~ext)                                       # le cadre et son intérieur : le plus gros morceau
    tailles = ndimage.sum(np.ones_like(etiq), etiq, range(1, n + 1))    # (le bas de l'épaisseur du cadre, détaché, est écarté)
    dedans = etiq == (1 + int(np.argmax(tailles)))
    alpha = Image.fromarray((dedans * 255).astype('uint8'), 'L').filter(ImageFilter.GaussianBlur(0.7))
    rgba = im.convert('RGBA'); rgba.putalpha(alpha)
    x0, y0, x1, y1 = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    return rgba.crop((x0, y0, x1, y1))


def poser(icone, taille, part, fond=None):
    """L'icône (découpée) sur `part` de la largeur d'un carré de `taille` px ; `fond` = couleur pleine (None = transparent)."""
    im = Image.new('RGBA', (T, T), fond + (255,) if fond else (0, 0, 0, 0))
    l = round(T * part); h = round(icone.height * l / icone.width)
    ic = icone.resize((l, h), Image.LANCZOS)
    im.alpha_composite(ic, ((T - l) // 2, (T - h) // 2))
    return im.resize((taille, taille), Image.LANCZOS)


def animation(gif, sortie, taille=320, pas=2, duree=80, qualite=80, cadre=(80, 118, 520, 558)):
    im = Image.open(gif); images = []
    for i in range(0, im.n_frames, pas):
        im.seek(i); images.append(im.convert('RGB').crop(cadre).resize((taille, taille), Image.LANCZOS))
    images[0].save(sortie, 'WEBP', save_all=True, append_images=images[1:], duration=duree, loop=0, quality=qualite, method=6)
    return len(images), sortie.stat().st_size


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
        n, o = animation(gif, ICONES / 'chargement.webp')
        print('animation :', n, 'images,', round(o / 1024), 'Ko')


if __name__ == '__main__':
    main()
