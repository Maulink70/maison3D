#!/usr/bin/env python3
"""Icône « maison en trait blanc, cube en couleur, fond bleu nuit » (15 octobre 2026, Mauro : « fond bleu nuit, tu supprimes
le cadre, maison en trait blanc, cube en différentes couleurs »), d'après l'image de face du GIF animé (icones/source-anim.webp) :
le contour de la maison (traits bleus dans le GIF) et le cube avec sa flèche (traits blancs) sont découpés, agrandis en
traits nets, puis posés en blanc et dans la couleur choisie sur un fond bleu nuit (léger dégradé).

    python3 outils/icone_maison.py <couleur hex du cube> [dossier de sortie] [préfixe]     # ex. ef4444 icones icone5
Fichiers : <préfixe>-512.png et -192.png (coins arrondis transparents), favicon-64, apple-touch (180, carré plein, iOS
arrondit), -maskable-512 (carré plein, maison sur 54 % : zone sûre du lanceur Android).
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

RACINE = Path(__file__).resolve().parent.parent
SOURCE = RACINE / 'icones' / 'source-anim.webp'
NUIT_HAUT, NUIT_BAS = (26, 44, 92), (9, 18, 44)     # dégradé du fond bleu nuit
T = 1024
ECH = 4                                              # agrandissement des masques (600 px → traits nets)


def masques():
    """(maison, cube) : masques flottants 0..1 de la zone de l'icône, agrandis ECH fois, bords nets."""
    a = np.asarray(Image.open(SOURCE).convert('RGB')).astype(int)
    sat = a[:, :, 2] - a[:, :, 0]; clair = a.min(axis=2)
    bleu = (sat > 50) & (a[:, :, 2] > 70)
    et, n = ndimage.label(bleu); t = ndimage.sum(np.ones_like(et), et, range(1, n + 1))
    ordre = np.argsort(t)[::-1]; maison = et == (1 + ordre[1])          # 1er = le cadre, 2e = la maison
    y0, x0 = np.array(np.where(maison)).min(axis=1) - 12; y1, x1 = np.array(np.where(maison)).max(axis=1) + 13
    zone = np.zeros_like(maison); zone[y0:y1, x0:x1] = True
    blanc = (clair > 150) & (sat < 40) & zone & ~ndimage.binary_dilation(maison, iterations=3)
    et2, n2 = ndimage.label(blanc); t2 = ndimage.sum(np.ones_like(et2), et2, range(1, n2 + 1))
    cube = np.isin(et2, 1 + np.where(t2 > 40)[0])                        # cube + flèche (les reflets de 1 px écartés)
    am = np.clip((sat - 20) / 40, 0, 1) * ndimage.binary_dilation(maison, iterations=2)
    ac = np.clip((clair - 110) / 90, 0, 1) * ndimage.binary_dilation(cube, iterations=2)
    def net(m):
        im = Image.fromarray((m[y0:y1, x0:x1] * 255).astype('uint8'), 'L').resize(((x1 - x0) * ECH, (y1 - y0) * ECH), Image.BICUBIC)
        v = ndimage.gaussian_filter(np.asarray(im).astype(float) / 255, 2.2)   # lissé : les traits du rendu 3D sont irréguliers
        return np.clip((v - 0.42) / 0.16, 0, 1)                           # seuil doux : bord net sur ~1 px
    return net(am), net(ac)


def couleur(hexa):
    h = hexa.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def fond(coins):
    """Fond bleu nuit en dégradé vertical, coins arrondis (rayon = coins × T) ou carré plein (coins = 0)."""
    y = np.linspace(0, 1, T)[:, None, None]
    g = (np.array(NUIT_HAUT) * (1 - y) + np.array(NUIT_BAS) * y)
    rgb = np.broadcast_to(g, (T, T, 3)).astype('uint8')
    im = Image.fromarray(np.ascontiguousarray(rgb), 'RGB').convert('RGBA')
    if coins:
        m = Image.new('L', (T, T), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, T - 1, T - 1), radius=round(T * coins), fill=255); im.putalpha(m)
    return im


def icone(maison, cube, teinte, taille, part, coins):
    im = fond(coins)
    h, w = maison.shape; l = round(T * part); hh = round(h * l / w)
    def calque(m, c):
        a = Image.fromarray((m * 255).astype('uint8'), 'L').resize((l, hh), Image.LANCZOS)
        im2 = Image.new('RGBA', (l, hh), c + (255,)); im2.putalpha(a); return im2
    im.alpha_composite(calque(maison, (255, 255, 255)), ((T - l) // 2, (T - hh) // 2))
    im.alpha_composite(calque(cube, teinte), ((T - l) // 2, (T - hh) // 2))
    return im.resize((taille, taille), Image.LANCZOS)


def tout(hexa, dossier, prefixe):
    maison, cube = masques(); teinte = couleur(hexa); d = Path(dossier); d.mkdir(parents=True, exist_ok=True)
    icone(maison, cube, teinte, 512, 0.64, 0.2).save(d / f'{prefixe}-512.png', optimize=True)
    icone(maison, cube, teinte, 192, 0.64, 0.2).save(d / f'{prefixe}-192.png', optimize=True)
    icone(maison, cube, teinte, 64, 0.68, 0.2).save(d / f'{prefixe.replace("icone", "favicon")}-64.png', optimize=True)
    icone(maison, cube, teinte, 180, 0.64, 0).convert('RGB').save(d / f'apple-touch-{prefixe}.png', optimize=True)
    icone(maison, cube, teinte, 512, 0.54, 0).convert('RGB').save(d / f'{prefixe}-maskable-512.png', optimize=True)


if __name__ == '__main__':
    tout(sys.argv[1] if len(sys.argv) > 1 else 'ef4444', sys.argv[2] if len(sys.argv) > 2 else 'icones', sys.argv[3] if len(sys.argv) > 3 else 'icone5')
