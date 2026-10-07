# Maison3D — visite 3D de l'appartement de Mauro

Site web statique qui affiche l'appartement (modélisé dans SketchUp) en 3D : vue maquette, visite à la première personne, et réaménagement du mobilier (déplacer, tourner, recolorer, masquer).

## Règles de travail avec Mauro (à respecter strictement)

- **Toujours répondre en français.**
- **Ne jamais modifier, committer, pousser ni déployer sans son accord explicite.** D'abord discuter, proposer la ou les meilleures solutions, lui demander s'il est d'accord, et n'agir qu'après son « go ».
- Il veut des **explications concrètes, étape par étape, clic par clic** (il est sur Windows et sur une tablette Android, novice en administration serveur).
- Avant d'annoncer qu'une modification fonctionne, la tester (voir « Tester » plus bas).

## Structure du dépôt

```
index.html            Le site complet (HTML + CSS + JS dans un seul fichier)
appartement.glb       Le modèle 3D optimisé chargé par le site (~9,9 Mo, compression meshopt)
source/
  diolly_def2_OBJ.zip Export OBJ d'origine depuis SketchUp (OBJ + MTL + 268 textures, 80 Mo décompressé)
  diolly_def2.stl     Export STL (sans couleurs ni objets séparés — inutile pour le site, gardé pour archive)
outils/
  filtrer_obj.py      Étape 1 : retire les objets décoratifs lourds, regroupe les maillages par meuble
  corriger_glb.mjs    Étape 3 : murs de l'étage roses -> blancs, renommage d'objets
  package.json        Dépendances Node des outils
```

Le fichier source SketchUp (.skp) n'est pas dans le dépôt ; Mauro l'a sur son ordinateur.

## Technique du site

- Pas de build, pas de framework : `index.html` charge **three.js 0.169.0** depuis jsDelivr via une `importmap` (OrbitControls, TransformControls, GLTFLoader, meshopt_decoder).
- Coordonnées en **mètres**, axe vertical **Y**. Le modèle est à des coordonnées absolues (x ≈ 11 à 19,7 ; z ≈ −28,2 à −14,1).
- Deux niveaux : **rez** (sol à y = 0, plafond ~2,40) et **étage** (sol à y = 2,74, toit jusqu'à 5,80).
  - Constantes dans le code : `ETAGE_FLOOR=2.74`, `REZ_CUT=2.33` (coupe de la vue « Rez »), `ROOF_CUT=5.15` (coupe de la vue « Étage »), `EYE=1.6` (hauteur des yeux).
- Le GLB contient 36 nœuds de premier niveau, un par élément. Préfixes : `structure_rez`, `structure_etage`, `rez__…`, `etage__…`.
- L'objet `META` dans `index.html` donne pour chaque nœud un libellé français et une catégorie :
  - `fixe` : non sélectionnable (structures, escalier, cloison). Sert de sol et de murs pour la visite.
  - `meuble` : mobilier modifiable.
  - `ouverture` : portes, fenêtres, Velux, store (modifiables aussi).
- Au chargement, chaque meuble est placé dans un `THREE.Group` dont l'origine est au centre-bas de sa boîte englobante, pour pouvoir le tourner sur lui-même.
- **Visite** : caméra première personne. Les murs bloquent via des rayons contre des copies `DoubleSide` des maillages `fixe` (sauf l'escalier). La hauteur suit le sol par un rayon vers le bas (structures + escalier), ce qui permet de monter l'escalier en marchant.
- **Sauvegarde** : la disposition (position x/z, rotation, masqué, couleur) est gardée dans le `localStorage` du navigateur, clé `diolly3d-v1`. Rien n'est partagé entre appareils.
- Interface en français, thème clair et sombre (tokens CSS sur `:root`), adaptée au téléphone (le panneau devient une feuille en bas, pavé de déplacement tactile).

## Pipeline de conversion (si le modèle SketchUp change)

SketchUp gratuit n'exporte pas en KMZ/GLB. Mauro exporte en **OBJ** (zip avec MTL et textures). Ensuite :

```bash
cd outils && npm install
unzip ../source/diolly_def2_OBJ.zip -d /tmp/obj
python3 filtrer_obj.py /tmp/obj/diolly_def2_obj/diolly_def2.obj /tmp/obj/diolly_def2_obj/filtered.obj
cd /tmp/obj/diolly_def2_obj && npx --prefix <chemin>/outils obj2gltf -i filtered.obj -o raw.glb
G=<chemin>/outils/node_modules/.bin/gltf-transform
$G dedup raw.glb a.glb && $G prune a.glb a.glb && $G weld a.glb a.glb
$G resize a.glb c.glb --width 1024 --height 1024
$G webp c.glb d.glb --quality 80
$G meshopt d.glb opt.glb
node <chemin>/outils/corriger_glb.mjs opt.glb appartement.glb
```

- `filtrer_obj.py` : la liste `DROP` contient les objets décoratifs supprimés (machine Nespresso, coupe de fruits, livres, magazines, téléphones et vases de l'étagère, personnage « Chris » de SketchUp). Résultat : 269 560 → 160 184 triangles.
- Les noms d'objets de l'OBJ suivent la hiérarchie SketchUp : `mesh_N_ROOT__Groupe#12__<meuble>__<sous-objet>_Layer0_<couleur>`. `Groupe#12` = rez, `Groupe#45` = étage.
- Si de nouveaux meubles apparaissent, les ajouter dans `META` de `index.html`.

## Tester

Le site doit être servi en HTTP (pas en `file://`, à cause des modules ES et du chargement du GLB) :

```bash
npx serve .        # ou : python3 -m http.server 8000
```

Pour un test automatisé sans écran : Playwright + Chromium avec `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, attendre que `#loading` soit caché, puis faire une capture.

## Historique

- Un prototype a d'abord été publié comme artefact claude.ai. Là-bas, les `.glb` ne sont pas servis et les URI `data:` sont bloquées par la CSP. Le modèle y était donc découpé en JSON + `geometrie.txt` (base64) + textures `.webp`, et reconstruit en GLB dans la page. **Ce contournement n'est pas nécessaire ici** : le dépôt utilise le GLB directement.

## Problèmes connus et idées (à discuter avec Mauro avant de faire)

1. Menu « Aller à » (Salon, Cuisine, Chambre, Salle de bain, Chambre étage, Douche, Dressing) pour se téléporter dans une pièce en mode Visite.
2. Toucher le sol pour s'y déplacer en mode Visite.
3. Portes qui s'ouvrent au toucher ; aujourd'hui on traverse les portes et les meubles (seuls les murs bloquent).
4. Vitres : la texture « nuages » de SketchUp donne des vitres floues. Remplacer par un matériau verre transparent.
5. Certaines faces SketchUp n'ont qu'un côté : les murs extérieurs disparaissent vus du dehors (effet maison de poupée, pratique en maquette).
6. Catalogue de meubles à ajouter (fichiers GLB de meubles, par exemple sous licence CC0).
7. Déploiement : Vercel, Netlify ou GitHub Pages (site statique, rien à compiler). Mauro a des comptes Vercel et Netlify connectés.
8. Noms incertains : `rez__element_mural` (ancien `Groupe#5`, 0,29 × 2,40 × 1,24 m contre un mur), `rez__salon` (0,69 × 2,40 × 2,07 m), `rez__cloison` (ancien `Groupe#1`). À faire confirmer par Mauro.
