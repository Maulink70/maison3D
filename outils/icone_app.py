#!/usr/bin/env python3
"""Icônes de l'application (icones/icone3-*) d'après le dessin de Mauro (icones/source-icone.webp, 15 octobre 2026 :
maison bleue à contour sombre et cube 3D blanc dans un cadre bleu arrondi, intérieur blanc).

Mauro : « avec une bordure plus fine et faire en sorte qu'elle puisse bien se voir sur mon smartphone et son fond »
(fond d'écran bleu : l'ancienne icône toute bleue s'y voyait mal). Le dessin de la maison est repris tel quel (découpé
dans son image), le cadre est redessiné plus fin (3,5 % de la largeur au lieu de 8 %), l'intérieur reste blanc.

Fichiers : icone3-512.png et icone3-192.png (« any » : coins transparents hors du cadre arrondi), favicon3-64.png,
apple-touch-icon3.png (180 px, opaque : coins bleus, iOS arrondit lui-même), icone3-maskable-512.png (fond blanc plein,
cadre et maison dans la zone sûre : le lanceur Android découpe l'icône à sa forme, rond ou « squircle »).
Nouveaux noms de fichiers à chaque changement d'icône (cache des icônes de sw.js, application installée).

    python3 outils/icone_app.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent
ICONES = RACINE / 'icones'
SOURCE = ICONES / 'source-icone.webp'
MAISON = (300, 330, 1700, 1670)     # boîte du dessin de la maison dans l'image source (2000 px)
BLEU = (90, 160, 232)               # cadre (couleur relevée dans l'image de Mauro)
BLANC = (255, 255, 255)
T = 2048                            # taille de travail (réduite ensuite)


def maison(largeur):
    """Le dessin de la maison (sur fond blanc), à la largeur demandée."""
    im = Image.open(SOURCE).convert('RGB').crop(MAISON)
    h = round(im.height * largeur / im.width)
    return im.resize((largeur, h), Image.LANCZOS)


def arrondi(d, boite, rayon, couleur):
    d.rounded_rectangle(boite, radius=rayon, fill=couleur)


def icone(taille, bord, rayon, maison_l, fond=None, cadre=(0, 0, T, T)):
    """Cadre bleu arrondi (épaisseur `bord`) à intérieur blanc, maison centrée dedans ; `fond` = couleur hors du cadre
    (None = transparent)."""
    im = Image.new('RGBA', (T, T), fond + (255,) if fond else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = cadre
    arrondi(d, (x0, y0, x1 - 1, y1 - 1), rayon, BLEU + (255,))
    arrondi(d, (x0 + bord, y0 + bord, x1 - 1 - bord, y1 - 1 - bord), max(1, rayon - bord), BLANC + (255,))
    m = maison(maison_l)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    im.paste(m, (cx - m.width // 2, cy - m.height // 2))
    return im.resize((taille, taille), Image.LANCZOS)


def main():
    bord, rayon = round(T * 0.035), round(T * 0.175)      # cadre fin (3,5 %), coins comme l'image de Mauro (17,5 %)
    maison_l = round(T * 0.76)
    icone(512, bord, rayon, maison_l).save(ICONES / 'icone3-512.png', optimize=True)
    icone(192, bord, rayon, maison_l).save(ICONES / 'icone3-192.png', optimize=True)
    icone(64, bord, rayon, maison_l).save(ICONES / 'favicon3-64.png', optimize=True)
    icone(180, bord, rayon, maison_l, fond=BLEU).convert('RGB').save(ICONES / 'apple-touch-icon3.png', optimize=True)
    # maskable : fond blanc plein ; cadre sur 72 % de la largeur (coins à peine hors du cercle sûr de 80 %), maison dedans
    c0, c1 = round(T * 0.14), round(T * 0.86)
    icone(512, round(T * 0.025), round(T * 0.13), round(T * 0.55), fond=BLANC, cadre=(c0, c0, c1, c1)).convert('RGB') \
        .save(ICONES / 'icone3-maskable-512.png', optimize=True)
    for f in sorted(ICONES.glob('*3*.png')):
        print(f.name, f.stat().st_size, 'octets')


if __name__ == '__main__':
    main()
