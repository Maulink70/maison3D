#!/usr/bin/env python3
"""Textures photo des surfaces (textures/) d'après Poly Haven (CC0) : télécharge les images 1K d'une texture et les convertit
en WebP 1024 px (couleur sRGB q86, normales q92, rugosité en niveaux de gris q80). Mettre à jour textures/LICENCE.txt.

    python3 outils/textures/convertir.py wooden_floor_01 parquet
    → textures/parquet_couleur.webp, parquet_normales.webp, parquet_rugosite.webp
    python3 outils/textures/convertir.py white_stucco enduit --blanchir
    → la couleur est ramenée au blanc (moyenne 250 par canal) : seul le grain reste, le matériau la teinte ensuite
"""
import io, json, sys, urllib.request
from pathlib import Path
from PIL import Image, ImageStat

RACINE = Path(__file__).resolve().parent.parent.parent
CARTES = [('Diffuse', 'couleur', 86, 'RGB'), ('nor_gl', 'normales', 92, 'RGB'), ('Rough', 'rugosite', 80, 'L')]


def lire(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'curl/8'})   # Poly Haven refuse l'agent urllib par défaut
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def blanchir(im, cible=250):
    """Ramène chaque canal à la moyenne `cible` : la photo ne garde que ses variations (grain), sans sa teinte."""
    canaux = []
    for ch in im.split():
        k = cible / max(1, ImageStat.Stat(ch).mean[0])
        canaux.append(ch.point(lambda v, k=k: min(255, round(v * k))))
    return Image.merge(im.mode, canaux)


def main(ident, prefixe, options=()):
    fiche = json.loads(lire(f'https://api.polyhaven.com/files/{ident}'))
    dossier = RACINE / 'textures'; dossier.mkdir(exist_ok=True)
    for carte, nom, q, mode in CARTES:
        url = fiche[carte]['1k']['jpg']['url']
        im = Image.open(io.BytesIO(lire(url))).convert(mode)
        if carte == 'Diffuse' and '--blanchir' in options:
            im = blanchir(im)
        if im.size != (1024, 1024):
            im = im.resize((1024, 1024), Image.LANCZOS)
        f = dossier / f'{prefixe}_{nom}.webp'; im.save(f, 'WEBP', quality=q, method=6)
        print(f.name, f.stat().st_size // 1024, 'Ko')
    infos = json.loads(lire(f'https://api.polyhaven.com/info/{ident}'))
    print('motif', [round(d / 1000, 3) for d in infos.get('dimensions', [])], 'm')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
