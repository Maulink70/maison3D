# Cuisson de la lumière (lumière précalculée)

La lumière du ciel qui entre par les fenêtres et rebondit dans l'appartement est calculée **une fois** dans Blender
(Cycles) sur la structure telle que le site la construit (murs, sols, plafonds, toit, escalier, cadres des portes et des
fenêtres de la maquette ; pas les meubles, qui bougent), puis posée sur ces faces par le site (`js/cuisson.js`,
« lightMap » de three.js). Résultat dans `cuisson/` à la racine du site :

- `lumiere.webp` : l'atlas (2048 × 2048, sRGB, ≈ 0,3 Mo), une seule texture pour toute la structure ;
- `lumiere_uv.bin` : les coordonnées (u, v) de chaque sommet, Uint16, dans l'ordre des maillages du site ;
- `lumiere.json` : la fiche (version, `intensite` = force de la lumière cuite, empreinte de chaque maillage).

Rien n'est remodelé : le site vérifie chaque maillage (nombre de sommets et empreinte des coordonnées) avant d'y poser
l'atlas. **Après toute modification de la structure** (`corrections.js`, `rez_structure.js`, `etage_structure.js`,
`buanderie.js`, `fenetres.js`, `portes.js`, carrelages, `structure.glb`…), un maillage qui ne correspond plus reste sans
lumière cuite (avertissement dans la console : « n maillage(s) sans cuisson ») : il faut **recuire**.

## Recuire (depuis une session Claude Code, ou un PC avec Node, Playwright et Blender)

1. Servir le site en local : `python3 -m http.server 8000` à la racine du dépôt.
2. Exporter la structure telle que le site la construit (Chromium sans écran, API simulée des tests) :
   `SITE=http://localhost:8000/ MOCK=<chemin>/mock_api.mjs PLAYWRIGHT=<chemin>/node_modules/playwright node outils/cuisson/exporter_structure.mjs <dossier export>`
   → `structure.bin` (positions) et `maillages.json` (ordre, empreintes).
3. Cuire dans Blender (bpy en module Python : `pip install bpy`, ou Blender lui-même) :
   `python3 outils/cuisson/cuire.py <dossier export> cuisson --taille 2048 --echantillons 64 --intensite 2`
   (ou `blender -b --python outils/cuisson/cuire.py -- <dossier export> cuisson …`). Quelques minutes sur 4 cœurs.
   Options : `--version` (sinon la date), `--marge` (pixels autour des îlots, 8), `--angle` (dépliage, 66°), `--flou` (1),
   `--sans-soudage` (sommets non soudés : plus d'îlots, à éviter).
4. Vérifier dans le site (console : aucun avertissement « sans cuisson »), puis publier `cuisson/` avec le lot.

`intensite` dans `lumiere.json` se règle sans recuire (force de la lumière cuite ; `FORCE` de `js/cuisson.js` la module
selon la lumière du jour, et l'ambiance baisse de 40 % quand la cuisson est active, `BAISSE_AMBIANCE`).

## Comment c'est fait

`cuire.py` : un seul maillage Blender avec tous les triangles (axe Z vertical), sommets confondus soudés (1e-5 m) pour que
les faces d'un même plan forment des îlots d'un seul tenant, « Smart UV Project » (îlots emballés dans l'atlas), matière
grise mate (albédo 0,75 pour les rebonds), ciel blanc uniforme (strength 1), Cycles sur le processeur, cuisson DIFFUSE
directe + indirecte sans la couleur (6 rebonds), puis : chaque coin de triangle d'origine retrouve son uv par la face de
même centre et de même normale (les faces dégénérées retirées par le soudage restent à u = v = 0), gain (99,5e centile → 1),
flou 3 × 3, gris moyen hors des îlots (mipmaps), sRGB, WebP. Les vitres, les battants, les ouvrants, les dos des faces et
les meubles ne sont pas exportés : les fenêtres et les portes sont des trous par où le ciel entre.
