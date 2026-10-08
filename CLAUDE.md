# Maison3D — visite 3D de l'appartement de Mauro

Site web qui affiche l'appartement (modélisé dans SketchUp) en 3D : vue maquette, visite à la première personne, et réaménagement du mobilier. L'état actuel est un prototype (déplacer, tourner, recolorer, masquer, sauvegarde locale). La cible complète est décrite dans « Cahier des charges » plus bas.

## Règles de travail avec Mauro (à respecter strictement)

- **Toujours répondre en français.**
- **Ne jamais modifier, committer, pousser ni déployer sans son accord explicite.** D'abord discuter, proposer la ou les meilleures solutions, lui demander s'il est d'accord, et n'agir qu'après son « go ».
- Il veut des **explications concrètes, étape par étape, clic par clic** (il est sur Windows et sur une tablette Android, novice en administration serveur).
- Avant d'annoncer qu'une modification fonctionne, la tester (voir « Tester » plus bas).

## Structure du dépôt

```
index.html            La page (structure HTML, importmap, charge css/app.css et js/main.js)
css/app.css           Styles (tokens clair/sombre sur :root, mise en page téléphone)
js/                   Code en modules ES, sans build :
  main.js             point d'entrée : assemble les modules, pointeur, boucle d'affichage
  app.js              scène, caméra, contrôles, état partagé `app` (exposé en window.maison3d pour les tests)
  config.js           constantes, META (libellés/catégories), fichiers du modèle, garde-corps
  modele.js           chargement progressif + corrections faites au chargement
  formes.js           briques communes des éléments construits en code : matériaux, boîtes, cylindres, plantes,
                      copie d'un élément du modèle, plafonds, fusion des pièces par matériau (moins d'appels de dessin)
  etagere.js          bibliothèque le long de l'escalier, reconstruite en code d'après la photo de Mauro
  buanderie.js        WC / buanderie du rez (vide dans le modèle) : WC, lavabo, lave-linge + sèche-linge, sol carrelé
  rez_structure.js    escalier en marches + réduit dessous, muret rampant, cloison du réduit, pan sud du toit, tableau électrique
  rez_cuisine.js      cuisine équipée, tabourets, suspension, table, banquette, chaises
  rez_salon.js        meuble TV, TV, table basse, plantes, lampadaire, lampe du buffet
  rez_pieces.js       entrée (commode, porte d'entrée, porte du réduit), chambre (lit, chevets, lustre),
                      salle de bain (douche, vasque, sèche-serviettes, WC dans le renfoncement), plafonniers
  etage_structure.js  étage : sol de la douche remonté, porte de la douche rouverte, carrelage de la douche, lames de pin sous le pan sud, mur aubergine du dressing
  etage_pieces.js     meubles de l'étage : mezzanine (coin nuit, coin bureau), dressing, chambre, douche + WC, appliques
  vues.js             modes maquette/visite et niveaux tout/rez/étage
  visite.js           marche à la première personne (collisions, escalier, pavé, clavier)
  edition.js          sélection, outils meuble, liste du panneau
  sauvegarde.js       localStorage (clé diolly3d-v1)
modele/
  structure.glb       Murs, sols, escalier, cloison (~0,45 Mo) : affichés en premier
  mobilier.glb        Meubles, portes, fenêtres (~9,5 Mo) : chargés ensuite
appartement.glb       Modèle complet (archive, source de modele/ via outils/decouper_glb.mjs) — plus chargé par le site
vercel.json           En-tête X-Robots-Tag noindex (site non indexé)
source/
  diolly_def2_OBJ.zip Export OBJ d'origine depuis SketchUp (OBJ + MTL + 268 textures, 80 Mo décompressé)
  diolly_def2.stl     Export STL (sans couleurs ni objets séparés — inutile pour le site, gardé pour archive)
outils/
  filtrer_obj.py      Étape 1 : retire les objets décoratifs lourds, regroupe les maillages par meuble
  corriger_glb.mjs    Étape 3 : murs de l'étage roses -> blancs, renommage d'objets
  decouper_glb.mjs    Étape 4 : découpe appartement.glb en modele/structure.glb + modele/mobilier.glb
  package.json        Dépendances Node des outils
```

Le fichier source SketchUp (.skp) n'est pas dans le dépôt ; Mauro l'a sur son ordinateur.

## Technique du site

- Pas de build, pas de framework : `index.html` charge **three.js 0.169.0** depuis jsDelivr via une `importmap` (OrbitControls, TransformControls, GLTFLoader, meshopt_decoder), puis `js/main.js` (modules ES natifs).
- **Chargement progressif** : `modele/structure.glb` d'abord (l'écran de chargement disparaît), puis `modele/mobilier.glb` avec l'indicateur `#charge`. Tant que le mobilier n'est pas là, rien n'est sélectionnable (`app.mobilierPret`).
- **Corrections faites au chargement** (le fichier 3D n'est pas modifié, `js/modele.js`) : vitres « nuages » de SketchUp (matériaux transparents texturés) remplacées par un verre clair ; dos des faces de la structure ajouté en `BackSide` + `polygonOffset` pour que les murs soient pleins vus de l'extérieur (un `DoubleSide` simple fait scintiller les sols, SketchUp y superposant deux faces dos à dos) ; **garde-corps vitré** de la mezzanine (1,20 m, absent du modèle, `GARDE_CORPS` dans `config.js`) ajouté en boîte de verre, qui bloque la visite ; **bibliothèque le long de l'escalier** (`rez__armoire`) : la carcasse SketchUp (ouverte, à faces simples, d'aspect fragmenté) est remplacée par un meuble construit en code (`js/etagere.js`) d'après la photo de Mauro, trois caissons de 1,09 / 1,06 / 1,06 m × 0,45 m, hauteurs 2,36 / 1,97 / 1,19 m (du haut de l'escalier vers le salon), tiroirs, niches, portes et étagères ; la rangée de livres du modèle est gardée, l'emprise est inchangée ; **WC / buanderie du rez** (`js/buanderie.js`, d'après 4 photos de Mauro, pièce vide dans le modèle) : WC suspendu sur le coffrage x = 11,45 (copie du WC de l'étage et de sa plaque, tournée de −90°), lavabo 50 × 40 cm sur meuble à persiennes + miroir contre le pilier (face z = −24,20), colonne lave-linge + sèche-linge 60 × 60 × 171 cm dans la niche nord-ouest, sol en carrelage anthracite 30 × 30 cm (le matériau `SOL_WC` de la mosaïque bleue n'est utilisé que là ; UV recalculés). Ces trois meubles sont créés en code et apparaissent dans la liste comme les autres.
- **Rez entièrement meublé d'après les photos de Mauro** (« étape 0 », 8 octobre 2026, 37 photos du Drive) : tout est construit en code dans les modules `rez_*.js` (coordonnées monde en mètres, relevées sur le plan et les photos), chaque élément est un nœud nommé `rez__…` ajouté à la racine du mobilier avant la création des meubles, donc sélectionnable, déplaçable, masquable et recolorable comme les autres ; libellés dans `META`. Structure corrigée : l'**escalier** du modèle était un bloc plein (aucun espace dessous) → 14 marches + contremarches en pierre grise, nez alu, sous-face rampante (`ESC` dans `rez_structure.js`) ; le mur escalier/bibliothèque de 3,72 m (`rez__cloison`) est en réalité un **muret rampant** ≈ 95 cm au-dessus des nez de marche ; **réduit** sous l'escalier fermé par une cloison (z = −21,10) et sa porte blanche affleurante ; **pan sud du toit** (absent du modèle) de 2,74 m au-dessus de la baie au faîte 5,80 m (z = −25,5), visible seulement par-dessous pour garder la vue maquette ouverte ; **porte d'entrée** brun foncé posée sur le mur (non ouvrable, le mur est plein). Le buffet (`rez__meuble_salon`) passe du rouge vif au bordeaux (`TEINTES` dans `modele.js`, matériau partagé avec la cerise : cloné pour le buffet seul) ; la machine à café du bar (`rez__Bar_cuisine`, `Material_52`) passe du rouge au noir. **Salle de bain corrigée d'après les annotations de Mauro** : le WC suspendu est dans le renfoncement du mur sud, à côté de la porte (x 12,19 → 13,00, z −25,01 → −24,28, renfoncement déjà présent dans le modèle), adossé à un coffrage en plaquettes grises de 1,15 m limité au renfoncement ; le sèche-serviettes (48 × 90 cm, de 0,95 à 1,85 m, mesures estimées sur photo) est sur le mur sud, juste à l'ouest du renfoncement, tourné vers la baignoire ; le meuble vasque va de la baignoire au mur sud (1,77 m), vasque, miroir et réglette centrés dessus ; la colonne de douche est sur le mur en plaquettes, côté pente du toit, pommeau tourné vers le lavabo (ouest). Lumière hémisphérique à sol clair (`0xd9d3c9`) : les plafonds sortent blancs et non gris. Les pièces construites sont **fusionnées par matériau** (`fusionner()` dans `formes.js`) : 895 → 533 appels de dessin.
- **Étage meublé d'après les photos de Mauro** (étape 0, 8 octobre 2026, 15 photos du dossier Drive « Photos ETAGE ») : modules `etage_structure.js` (structure) et `etage_pieces.js` (meubles `etage__…`, libellés dans `META`). Structure : le sol de la douche + WC, à 2,40 m dans le modèle, est recouvert d'un sol carrelé bleu ardoise à 2,74 m (ajouté aux sols de la visite) ; la face du mur ouest de la douche (x = 16,78) bouchait l'ouverture de la porte, ses triangles sont neutralisés au chargement (`ouvrirPorteDouche`) ; murs de la douche : la texture « marbre » du modèle (`Material_364`) devient le carrelage des photos, carreaux gris clair de 25 cm et frise noire à 1,80 m (`carrelerDouche`, texture posée en coordonnées monde) ; lames de pin sous le pan sud du toit dans la chambre, la douche et le dressing (le pan nord, très raide, reste blanc) ; mur sud du dressing aubergine. Meubles : mezzanine (commode blanche, lit d'appoint 90 × 200 patchwork sous le Velux, armoire en hêtre, fauteuil noir, deux appliques), coin bureau de l'aile ouest (bureau haut blanc + écran, tabouret blanc et tabouret noir, applique), dressing (armoires laquées blanches en L de 2,25 m dont 2 portes miroir, buffet bas aubergine, portant, applique), chambre (lit 140 × 200 tête au nord à la place du lit du modèle, chevet, climatiseur mobile, étagère en hêtre, écran + ordinateur sur le bureau noir du modèle, chaise de bureau, applique), douche + WC (meuble vasque, miroir et réglette ; la vitre du modèle côté lavabo est gardée, elle monte jusqu'au plafond en pente ; le bloc bleu du modèle est remplacé par un rideau côté fenêtre, fermé du mur est à la vitre), applique de l'escalier. Pan nord : z = −27,03 + h / 2 (h au-dessus du plancher) ; les meubles hauts en tiennent compte. 534 → 596 appels de dessin.
- Remplacer un élément du modèle : un nœud GLB à une seule primitive est un `Mesh` et non un `Group` ; le retirer et poser un `Group` du même nom à sa place (`remplacer()` dans `rez_structure.js`), ne pas vider ses enfants.
- Coordonnées en **mètres**, axe vertical **Y**. Le modèle est à des coordonnées absolues (x ≈ 11 à 19,7 ; z ≈ −28,2 à −14,1).
- Deux niveaux : **rez** (sol à y = 0, plafond ~2,40) et **étage** (sol à y = 2,74, toit jusqu'à 5,80).
  - Constantes dans le code : `ETAGE_FLOOR=2.74`, `REZ_CUT=2.33` (coupe de la vue « Rez »), `ROOF_CUT=5.15` (coupe haute de la vue « Étage »), `ETAGE_CUT=2.38` (coupe basse de la vue « Étage » : le rez disparaît ; sous 2,40 car le sol de la douche de l'étage est à 2,40 dans le modèle), `EYE=1.6` (hauteur des yeux). La sélection ignore ce qui est hors des plans de coupe.
- Le GLB contient 36 nœuds de premier niveau, un par élément. Préfixes : `structure_rez`, `structure_etage`, `rez__…`, `etage__…`.
- L'objet `META` dans `js/config.js` donne pour chaque nœud un libellé français et une catégorie :
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
node <chemin>/outils/decouper_glb.mjs appartement.glb <chemin>/modele
```

- `filtrer_obj.py` : la liste `DROP` contient les objets décoratifs supprimés (machine Nespresso, coupe de fruits, livres, magazines, téléphones et vases de l'étagère, personnage « Chris » de SketchUp). Résultat : 269 560 → 160 184 triangles.
- Les noms d'objets de l'OBJ suivent la hiérarchie SketchUp : `mesh_N_ROOT__Groupe#12__<meuble>__<sous-objet>_Layer0_<couleur>`. `Groupe#12` = rez, `Groupe#45` = étage.
- Si de nouveaux meubles apparaissent, les ajouter dans `META` de `js/config.js` (et dans `STRUCTURE` de `outils/decouper_glb.mjs` s'ils sont fixes).

## Tester

Le site doit être servi en HTTP (pas en `file://`, à cause des modules ES et du chargement du GLB) :

```bash
npx serve .        # ou : python3 -m http.server 8000
```

Les tests de marche en navigateur sans écran sont lents (peu d'images par seconde, déplacement plafonné par image) : faire marcher jusqu'à une condition plutôt qu'un temps fixe.

Pour un test automatisé sans écran : Playwright + Chromium avec `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, attendre que `#loading` soit caché (structure affichée) puis que `window.maison3d.mobilierPret` soit vrai (meubles chargés), puis faire une capture. `window.maison3d` donne accès à la caméra, aux contrôles et aux meubles ; les modules peuvent être importés dans la page (`await import('/js/visite.js')`) pour piloter la marche.

## Historique

- Un prototype a d'abord été publié comme artefact claude.ai. Là-bas, les `.glb` ne sont pas servis et les URI `data:` sont bloquées par la CSP. Le modèle y était donc découpé en JSON + `geometrie.txt` (base64) + textures `.webp`, et reconstruit en GLB dans la page. **Ce contournement n'est pas nécessaire ici** : le dépôt utilise le GLB directement.

## Cahier des charges (validé par Mauro le 7 octobre 2026)

### Objectif
Outil pour Mauro et sa compagne Tamara, afin de préparer le réaménagement réel de l'appartement : essayer des meubles, vérifier des dimensions, imprimer des plans, visualiser le résultat en photo réaliste. Ce n'est pas un site de présentation publique.

### Deux modes strictement séparés
- **Visite** : on regarde et on se déplace, **rien n'est modifiable**. Menu « Aller à » par pièce, déplacement au choix par toucher au sol ou en marchant, **vitesse de déplacement réglable**, portes qui s'ouvrent.
- **Éditer l'appartement** : tout ce qui touche aux meubles, objets et rendus.

Pièces validées par Mauro le 8 octobre 2026 (emprises intérieures mesurées dans le modèle, coupe à 1 m ; rectangles x0, z0 → x1, z1 en mètres) :

| Niveau | Pièce | Emprise | Surface |
|---|---|---|---|
| Rez | Salon (double hauteur, escalier compris) | 12,87 −21,11 → 19,44 −14,34 | 44,5 m² |
| Rez | Cuisine | 15,00 −24,93 → 19,44 −21,11 + 13,82 −22,58 → 15,00 −21,11 | 18,7 m² |
| Rez | Entrée (porte d'entrée dans le mur z = −21,11 entre x 11,45 et 12,67, sous la fenêtre à store de l'étage ; non modélisée) | 11,45 −22,58 → 13,82 −21,11 | 3,5 m² |
| Rez | Dégagement (couloir devant la chambre, avec le meuble haut `rez__salon`) | 13,08 −24,93 → 14,87 −22,58 | 4,2 m² |
| Rez | Chambre | 14,88 −27,80 → 19,44 −25,01 + 13,08 −26,03 → 14,88 −25,01 | 14,6 m² |
| Rez | Salle de bain | 11,31 −27,80 → 14,75 −26,11 + 11,31 −26,11 → 13,00 −25,01 | 7,7 m² |
| Rez | WC / buanderie (WC, petit lavabo, lave-linge et sèche-linge) | 11,31 −24,20 → 13,00 −22,66 + 11,31 −24,93 → 12,11 −24,20 | 3,2 m² |
| Étage | Mezzanine (ouverte sur le salon, garde-corps vitré de 1,20 m) | 14,10 −26,53 → 16,70 −21,11 + 11,45 −22,75 → 14,10 −21,11 | 18,4 m² |
| Étage | Dressing | 11,31 −26,53 → 13,97 −22,83 | 9,8 m² |
| Étage | Chambre étage | 16,78 −26,53 → 19,44 −22,83 | 9,8 m² |
| Étage | Douche + WC | 16,78 −22,75 → 19,44 −21,19 | 4,1 m² |

« Aller à » en 1re personne : arrivée à la porte de chaque pièce, regard vers l'intérieur (points proposés sur le plan validé : salon 16,6 −20,4 regard vers la baie ; cuisine 16,0 −21,45 regard vers le bar ; entrée 11,75 −21,4 regard vers l'est ; dégagement 13,6 −22,9 ; chambre 13,65 −25,5 regard vers l'est ; salle de bain 12,4 −25,5 ; WC 12,5 −23,1 regard vers l'ouest ; mezzanine 13,3 −21,6 ; dressing 13,45 −23,3 ; chambre étage 17,15 −23,4 et douche 17,2 −22,3 regard vers l'est).

### Meubles et objets de décoration (même traitement pour les deux)
- Déplacer, **tourner par pas de 90° ou librement** (poignée de rotation continue, affichage de l'angle en degrés, saisie possible d'un angle exact), masquer, recolorer, choisir une **matière** (bois, tissu, métal…).
- **Modifier les dimensions** d'un meuble en saisissant des mesures exactes.
- **Remplacer** un meuble par un autre au même endroit.
- Ajouter depuis quatre sources :
  1. **Catalogue** de banques 3D gratuites via API (Sketchfab, Poly Haven…).
  2. **Formes simples paramétrables** : boîte, table, étagère, avec dimensions saisies.
  3. **Import manuel** d'un fichier 3D (GLB) que Mauro a téléchargé lui-même.
  4. **Panneau photo** : photo d'un meuble prise sur un site marchand + dimensions saisies → boîte aux bonnes mesures avec la photo plaquée sur la face avant et la couleur dominante sur les autres faces. Suffit pour juger encombrement et allure. Pas de conversion photo → vrai objet 3D (trop lourd à créer soi-même ; service externe seulement si un jour le panneau photo ne suffit plus).

### Vues et calques
- Vue maquette, visite à la première personne, **plan 2D vu de dessus par niveau**.
- **Masquer un niveau** : pouvoir cacher le rez ou l'étage (et tout niveau supérieur s'il y en a un jour) pour travailler sur un seul niveau, dans toute vue. Le prototype le fait déjà par des plans de coupe (`REZ_CUT` pour la vue « Rez », `ROOF_CUT` et `ETAGE_CUT` pour la vue « Étage », qui montre l'étage seul) ; la cible est un vrai interrupteur par niveau (afficher / masquer), en plus de la coupe.
- **Isoler une pièce** : choisir une pièce (salon, chambre…) et tout le reste disparaît ou devient transparent, la caméra se cadre sur la pièce, pour la modifier sans gêne. Nécessite de définir les pièces (emprise au sol de chacune) dans le code.
- **Murs transparents** : en vue maquette, murs à environ 30 % d'opacité pour voir derrière sans couper.
- **Vue éclatée** : un curseur sépare les niveaux verticalement (et peut écarter les murs de la dalle) pour comprendre l'ensemble.
- **Caméras mémorisées** : enregistrer des points de vue nommés (« salon depuis la porte ») pour y revenir en un clic, et refaire les rendus kie.ai sous le même angle d'une variante à l'autre.
- **Vraie photo en fond** : afficher la photo réelle de la pièce derrière la 3D, caméra calée dessus, pour vérifier que le modèle correspond et préparer le rendu réaliste.
- **Calques** activables dans toute vue : cotes, hauteurs, noms des pièces, surfaces.
- Vitres transparentes (remplacer la texture « nuages » de SketchUp), murs pleins vus de l'extérieur (faces simples côté extérieur à doubler), **lumière du jour réglable** (matin, midi, soir ; en dernier, c'est du confort).

### Aide à la décision
- **Alertes de passage** : un meuble qui chevauche un mur ou un autre meuble passe en rouge ; signaler un passage inférieur à 70–80 cm et une porte qui ne peut plus s'ouvrir (débattement).
- **Règle de mesure** : deux points cliqués donnent la distance, en 3D et sur le plan 2D.
- **Surfaces** : surface au sol de chaque pièce, et surface libre restante une fois meublée.
- **Comparaison de variantes** : deux variantes côte à côte ou en fondu (« Actuel » / « Projet 1 »).
- **Historique et annuler / rétablir** : chaque modification est journalisée (qui, quand, quoi), avec annulation.
- Plus tard, si besoin : liste des meubles d'une variante exportable en tableau (nom, dimensions, matière, lien marchand, prix saisi, total).

### Impression
En PDF ou image : plan 2D par niveau avec cotes ; n'importe quelle vue 3D à l'écran avec ses calques actifs ; fiche d'un meuble (dimensions, couleur, matière, position).

### Rendu réaliste par kie.ai (Nano Banana Pro)
But : voir la pièce **en vrai** avec le nouveau meuble, en complément de la 3D qui sert à la mesure.
- Mauro fournit de **vraies photos** de chaque pièce (galerie par pièce, stockée avec le projet).
- Dans l'éditeur, on place le meuble, on cale la caméra 3D sur l'angle de la vraie photo, puis bouton **« Rendu réaliste »**.
- **Mode « Image »**, distinct de l'édition 3D : on modifie la photo, pas la maquette. Dans ce mode, un **trombone ou un bouton « Ajouter un objet »** permet d'importer une image prise sur Internet (fichier, ou collage depuis le presse-papiers), de saisir ses dimensions, et de lancer directement le processus de rendu décrit ci-dessus (placement approximatif sur la photo, confirmation, appel kie.ai). Résultat dans l'historique de la pièce et dans Familia, comme les autres rendus.
- Le site envoie à kie.ai : la vraie photo de la pièce, la photo du meuble (site marchand), la capture 3D qui montre l'emplacement et l'échelle, et un prompt du type « insère ce meuble à cet endroit, à cette taille, sans changer le reste ». Modèle : `nano-banana-pro`, qui accepte plusieurs images de référence.
- **Toujours demander confirmation avant chaque rendu** (chaque appel consomme des crédits kie.ai).
- **Historique des rendus** conservé : pour chaque pièce, on fait défiler les rendus précédents avec une petite flèche, rien n'est écrasé.
- Chaque rendu est aussi **inséré automatiquement dans la galerie « Familia »**, l'autre projet de Mauro (dépôt GitHub `Maulink70/Familia`, site `https://familia-azure.vercel.app`, galerie de ses créations kie.ai, originaux sur son Google Drive). Familia prévoit déjà ce cas pour les outils extérieurs, **sans rien modifier dans son code** : au lancement de la tâche kie.ai, passer `callBackUrl = https://familia-azure.vercel.app/api/callback?x=<clé externe>&src=maison3d&t=<titre>`. Quand la tâche se termine, kie.ai appelle cette adresse et Familia enregistre le média lui-même (modèle lu dans la tâche). La clé externe est dérivée du mot de passe de Familia (`externalKey()` dans `lib/callback.js` de Familia : SHA-256 de `familia-externe:<empreinte du mot de passe>`, 32 premiers caractères) ; Mauro la fournira, elle sera stockée dans n8n, jamais dans la page. La tâche doit être lancée sur le Market kie.ai (`/api/v1/jobs/createTask`), avec la même clé kie.ai que Familia. Si le paramètre `src` n'est pas reconnu par Familia, le média sera quand même enregistré ; adapter le libellé (« créé depuis Maison3D ») est une petite modification de `lib/finish.js` côté Familia, à faire valider par Mauro. Solution de repli : `POST /api/import` de Familia (`{url, ext, model, title, prompt, details}`), mais elle exige le cookie de session de la galerie, donc moins pratique depuis n8n.
- L'appel kie.ai passe par n8n (voir ci-dessous), jamais directement depuis la page. Le skill `kie-ai-media` de Mauro documente l'API (commande `market`, modèle `nano-banana-pro`, envoi des images par `upload`).

### Comptes et données
- **Un compte par personne** (Mauro, Tamara).
- Aménagements **synchronisés** entre PC et tablette, avec **plusieurs variantes nommées** (« Actuel », « Projet 1 »…).
- Stockage dans **Airtable**, derrière **n8n** sur le VPS Hostinger de Mauro (`srv1123557.hstgr.cloud`). Le site ne parle qu'à n8n (webhooks). n8n vérifie l'utilisateur, puis lit et écrit dans Airtable. Les clés d'API (Airtable, Sketchfab, kie.ai) restent dans n8n, **jamais dans la page**.
- Le `localStorage` actuel (clé `diolly3d-v1`) sera remplacé par cette synchronisation ; il peut rester comme cache hors ligne.

### Technique attendue
- **Application installable** (PWA) sur la tablette et le PC, comme Familia : manifeste, icône, service worker pour le cache du modèle.
- **Chargement progressif** : afficher d'abord la structure (murs, sols), puis les meubles, pour une ouverture rapide. Pas de mode hors ligne complet (non souhaité).
- **Le modèle SketchUp ne sera plus la source** : une fois l'application en place, Mauro ne retournera plus dans SketchUp ; les modifications se font dans l'application. Le pipeline OBJ → GLB reste documenté pour archive, mais aucune fonction d'import SketchUp n'est à prévoir.

### Hébergement
Vercel, relié à GitHub : projet « maison3d » (`prj_xamwNtiD0YBKAkVO3DebYhOWMu8y`), production **https://maison3d.vercel.app**, redéployé automatiquement à chaque push sur `main`. Dépôt privé. Site statique, rien à compiler (preset « Other », pas de build). **Vercel limite à 100 déploiements par 24 h** : regrouper les pushes, un par lot testé, jamais pour « voir si ça marche ». Vérifier les déploiements avec le connecteur Vercel.

### Environnement Claude Code (cloud « Maulink »)
- Variables d'environnement : `N8N_API_KEY` (clé API n8n « Claude », tous droits, en-tête `X-N8N-API-KEY`) et `N8N_BASE_URL` (`https://n8n.srv1123557.hstgr.cloud`). Appeler l'API REST n8n (`/api/v1/…`) par curl ; le connecteur MCP n8n ne sert qu'à lancer des workflows explicitement exposés (aucun aujourd'hui) et ne permet ni de créer ni de modifier.
- Secret réseau `Claude kie` injecté par le proxy pour `api.kie.ai` et `kieai.redpandaai.co`.
- Domaines autorisés : n8n, kie.ai, Vercel (`*.vercel.app`), Familia, CDN (jsdelivr, cdnjs, unpkg), Google Fonts, Airtable, Sketchfab, Poly Haven, GitHub. Si un domaine manque : l'ajouter dans l'environnement Maulink, puis **ouvrir une nouvelle session** (le réglage ne s'applique pas aux sessions déjà ouvertes).
- Au début de chaque session, tester les accès réseau utiles par curl avant d'annoncer quoi que ce soit.

### Ordre de construction (livrer et faire valider étape par étape)
1. **Navigation et vues** : modes séparés, Aller à, toucher au sol, vitesse, portes, rotation libre des meubles, masquage par niveau, isoler une pièce, murs transparents, caméras mémorisées, vitres, murs pleins, calques, plan 2D, règle de mesure, surfaces, chargement progressif, impression.
2. **Aide à la décision et confort** : alertes de passage, annuler / rétablir et historique local, vue éclatée, application installable (PWA), lumière du jour.
3. **Comptes et synchronisation** : workflows n8n + base Airtable « Maison3D », variantes nommées, comparaison de variantes, historique partagé (qui, quand, quoi).
4. **Catalogue** : banques 3D, formes simples, import GLB, panneau photo, dimensions, matières, remplacement.
5. **Rendu réaliste kie.ai** : galerie de vraies photos par pièce, vraie photo en fond de la 3D, bouton de rendu, mode « Image » avec ajout d'un objet par trombone, historique des rendus, insertion dans Familia.
6. **Assistant** (idée de Mauro du 8 octobre 2026, à préciser avant de la planifier) : un panneau de conversation où l'on demande en langage courant, par exemple « ajoute une armoire dans le salon à la place de la télévision ». L'assistant repère la pièce et le meuble visé, puis propose : joindre une photo de référence (panneau photo de l'étape 4, éventuellement suivi d'un rendu réaliste de l'étape 5), ou générer directement le meuble (forme paramétrable à des dimensions proposées et modifiables, ou recherche dans le catalogue ; plus tard, si besoin, génération 3D par un service externe payant). Il montre le résultat et n'applique rien sans confirmation (annulable comme toute modification). Le modèle de langage est appelé par n8n, clé d'API dans n8n, jamais dans la page. Il s'appuie sur les fonctions des étapes 4 et 5, d'où sa place après elles.

### Décisions de Mauro pour l'étape 1 (formulaire du 8 octobre 2026)
- **Publication** : chaque livraison est testée par Claude Code, décrite à Mauro, puis publiée sur `main` après son « go » (production maison3d.vercel.app). Le site reste ouvert (pas de code d'accès) jusqu'aux comptes de l'étape 3, mais non indexé.
- **Modes et vues** : les 3 vues (Maquette, 1re personne, Plan 2D) existent dans les 2 modes. En Visite rien n'est modifiable ; en Éditer on modifie depuis n'importe quelle vue.
- **Toucher au sol** : glissement doux (~1 s) jusqu'au point touché, arrêt devant un obstacle.
- **Collisions en visite** : murs, portes fermées **et meubles** bloquent ; prévoir une sécurité anti-coincement (on peut toujours reculer).
- **Portes** : toucher une porte l'ouvre ou la ferme (charnières déduites de la poignée, Mauro corrige) + bouton « Tout ouvrir / Tout fermer ». En Éditer, toucher sélectionne ; ouverture par un bouton du panneau.
- **Isoler une pièce** : le reste en fantôme pâle ou masqué, au choix par un bouton.
- **Murs transparents** : un interrupteur (tous les murs ~30 %, sols et meubles opaques).
- **Plan 2D** : deux styles au choix (plan d'architecte / vue de dessus réaliste).
- **Cotes** : quatre familles (dimensions des pièces, longueur des murs, meuble sélectionné avec distances aux murs, portes et fenêtres), chacune activable, et chaque cote masquable individuellement (toutes, certaines, une seule).
- **Impression** : format, orientation et échelle choisis au moment d'imprimer (A4/A3, ajustée + barre 1 m, ou exacte 1:50 / 1:100), PDF.
- **Tablette** : le prototype y est fluide.
- **Priorité** : Visite, puis Mesurer, puis Voir clair, puis Meubles.

### Plan de l'étape 1 en 12 livraisons (validé le 8 octobre 2026)
1. **Fondations** : chargement progressif, vitres transparentes, murs pleins vus de l'extérieur, garde-corps vitré de la mezzanine, « élément mural » = porte-fenêtre cuisine, site non indexé, code en modules.
2. **Modes, vues et « Aller à »** : barre Visite | Éditer et Maquette | 1re personne | Plan 2D, Visite non modifiable, pièces dans le code (`js/pieces.js`), menu « Aller à » (maquette : cadrage ; 1re personne : arrivée à la porte), mode et vue mémorisés.
3. **Se déplacer en visite** : toucher au sol, curseur de vitesse, collisions meubles, anti-coincement.
4. **Portes qui s'ouvrent** : 6 portes intérieures, toucher, « Tout ouvrir », portes fermées bloquantes (demander à Mauro des photos des portes pour le sens).
5. **Plan 2D** : deux styles, glisser / pincer, déplacement des meubles en Éditer, porte d'entrée dessinée.
6. **Calques et surfaces** : noms, surfaces (au sol et libre), hauteurs, cotes (voir Décisions).
7. **Règle de mesure** : deux touchers, en 3D et sur le plan, aimantation aux coins, mesures gardées.
8. **Impression** : plan 2D avec calques, vue 3D, fiche meuble, PDF.
9. **Niveaux et murs transparents** : interrupteurs Rez / Étage dans toutes les vues, murs à ~30 %.
10. **Isoler une pièce** : cadrage, fantôme ou masqué, « Tout afficher ».
11. **Rotation libre** : poignée, angle en degrés, saisie, ±90°, aimantation 15° désactivable, aussi sur le plan.
12. **Caméras mémorisées** : nom, liste, retour animé, renommer, supprimer (navigateur jusqu'à l'étape 3).

Photos réelles : dans le Google Drive de Mauro, dossier **« Maison 3D / Photos »** (`13u-1gPDtdr8MTUpvwRI2HNvoHUSHfCn1`), sous-dossiers « Photos REZ » et « Photos ETAGE », nommées par pièce (`salon (3).jpg`, `cuisine.jpg`…), **jamais dans le dépôt** (tout le dépôt est publié sur le site public). Lecture : `download_file_content` du connecteur Google Drive renvoie un JSON base64 trop gros, enregistré dans un fichier `tool-results/…` ; le décoder en Python (dossier temporaire), puis réduire les images avant de les regarder. Utiles avant la livraison 4 : une photo par porte (côté charnières, sens d'ouverture). Ces photos servent à la modélisation de base ; Mauro fera plus tard de plus belles photos pour l'avant / après du mode « Image » (étape 5).

### Étape 0 : modèle fidèle (ajoutée le 8 octobre 2026 à la demande de Mauro, avant la livraison 2)
Rendre la maquette conforme à la réalité pièce par pièce, d'après les photos : Claude Code modélise, envoie des comparaisons photo / maquette, Mauro entoure en vert ce qu'il garde et en rouge ce qu'il supprime, Claude Code corrige. Les dimensions exactes viendront ensuite d'un **formulaire de relevé des mesures** (une ligne par mur et par meuble, valeur actuelle pré-remplie, à remplir sur la tablette mètre en main). Décisions : figurent les meubles, l'électroménager, les luminaires et la TV, plus la grande plante du salon et la plante sur la bibliothèque (pas d'autres plantes ni de petits objets) ; lit 180 × 200 ; 3 chaises bordeaux + la banquette ; salle de bain : baignoire sous la fenêtre, douche à l'italienne à sa droite (côté chambre), meuble vasque contre le mur ouest, sèche-serviettes à gauche du miroir sur le mur sud (tourné vers la baignoire), WC suspendu dans le renfoncement à côté de la porte ; à côté de la porte d'entrée, une porte donne sur un réduit sous l'escalier. Ordre : rez (fait le 8 octobre, annoté par Mauro et corrigé le même jour), puis étage (modélisé, validé et publié le 8 octobre), puis relevé des mesures, puis livraison 2.

À prévoir du côté de Mauro : une base Airtable « Maison3D » (à décrire précisément avant de la créer), quelques workflows n8n (Claude Code peut les créer, n8n étant connecté), un compte Sketchfab gratuit, et ses vraies photos des pièces.

## État du projet (à mettre à jour par Claude Code à la fin de chaque livraison, avant le push)

- 8 octobre 2026 : cahier des charges validé et complété (aide à la décision, vues, technique), ordre de construction en cinq étapes, site prototype déployé sur https://maison3d.vercel.app, environnement Claude Code configuré.
- 8 octobre 2026 : formulaire de questions rempli par Mauro, découpage des pièces et plan de l'étape 1 en 12 livraisons validés (voir Cahier des charges). **Étape 1, livraison 1 (fondations) publiée**, à faire tester par Mauro : chargement progressif (maquette visible en ~2 s au lieu de ~11 s sur une connexion 4G simulée), vitres claires, murs pleins vus de l'extérieur, garde-corps vitré de la mezzanine, bibliothèque le long de l'escalier refaite d'après photo, WC / buanderie meublé d'après photos, porte-fenêtre cuisine, libellés des portes, site non indexé, code découpé en modules. Puis, le même jour, **étape 0 pour le rez** publiée : toutes les pièces du rez meublées et la structure corrigée d'après 41 photos (voir Technique du site), 67 éléments dans la liste, tests automatiques verts (chargement, dispositions enregistrées, sélection, garde-corps, montée et descente de l'escalier, cloison du réduit, téléphone). Prochaine action : annotations vert / rouge de Mauro sur les comparaisons photo / maquette du rez, puis photos et modélisation de l'étage.
- 8 octobre 2026 : annotations de Mauro sur le rez (comparaisons publiées en page privée claude.ai) : tout validé sauf trois points, **corrigés et publiés** : machine à café du bar noire, WC de la salle de bain dans son renfoncement avec coffrage limité au renfoncement, sèche-serviettes sur le mur sud tourné vers la baignoire. Le bouton « Étage » montre désormais l'étage seul (coupe aussi sous le plancher, sélection limitée à ce qui est visible). Tests automatiques verts (21, dont les nouvelles vérifications). Idée d'assistant notée (étape 6). Prochaine action : photos de l'étage par Mauro (avec une photo par porte, côté charnières), puis modélisation de l'étage.
- 8 octobre 2026 (suite) : deux corrections de la salle de bain validées par Mauro (meuble vasque jusqu'au mur, pommeau tourné vers le lavabo) et **étage modélisé d'après 15 photos** (voir Technique du site), page de comparaison photo / maquette publiée en page privée claude.ai pour ses annotations. 89 éléments dans la liste, 23 tests automatiques verts (dont sol et entrée de la douche de l'étage, lit 140 × 200), tests de marche rendus indépendants de la vitesse d'affichage. **Rien n'est publié** : à la demande de Mauro, tout part en production une fois l'étage validé. Prochaine action : annotations vert / rouge de l'étage, corrections, puis un seul push sur `main` ; ensuite photos des portes (côté charnières) pour la livraison 4 et formulaire de relevé des mesures.
- 8 octobre 2026 (suite) : **étage validé par Mauro** avec deux retouches faites : carrelage gris clair à frise dans la douche (à la place du « marbre »), vitre côté lavabo remise (elle monte jusqu'au plafond en pente) et rideau fermé côté fenêtre. 23 tests automatiques verts (six passages de suite). **Publié** (rez + étage en un seul push, après le « go » de Mauro), 89 éléments dans la liste. Étape 0 terminée pour la modélisation. Prochaines actions : contrôle du poids et de la fluidité sur la tablette, photos des portes (côté charnières) pour la livraison 4, formulaire de relevé des mesures, puis livraison 2.

## Problèmes connus

- En visite, on traverse encore les portes et les meubles ; seuls les murs, le garde-corps et la cloison du réduit bloquent (corrigé aux livraisons 3 et 4). Départ de la visite au rez déplacé près du buffet (18,4 / −19,0), l'ancien point tombait dans la banquette.
- Le modèle SketchUp n'avait ni toit ni plafond au-dessus du salon ni pan sud au-dessus de l'étage : le pan sud est ajouté au chargement (plan unique, visible de l'intérieur seulement). Le pan nord (raide, ≈ 63°, avec les Velux) est celui du modèle.
- La porte d'entrée n'existe pas dans le modèle : elle est posée sur le mur plein (non ouvrable). Les murs carrelés (WC, salle de bain) restent lisses ; les stores des fenêtres ne sont pas représentés.
- Étage revu d'après photos et validé par Mauro. Défauts du modèle corrigés au chargement : sol de la douche à 2,40 m (recouvert à 2,74 m, bande de seuil comprise), face de mur bouchant la porte de la douche. Un point bleu de 2 pixels reste visible au pied du chambranle nord de cette porte, en gros plan seulement (jour dans le modèle).
- Aucun tableau ni petit objet n'est modélisé (choix de Mauro, pour garder le chargement léger). **À faire à la fin de l'étape 0 : contrôle du poids et de la fluidité**, sur la tablette de Mauro (8 octobre 2026 : modèle 0,45 + 9,5 Mo, ~165 000 triangles, 597 appels de dessin).
- Résolu le 8 octobre 2026 : `rez__element_mural` = grande porte-fenêtre de la cuisine (vitre identique aux fenêtres) ; `rez__salon` = meuble haut du dégagement ; `rez__cloison` = cloison le long de l'escalier.
- `appartement.glb` (racine) est gardé en archive ; le déplacer dans `source/` a été bloqué par le garde-fou de la session (action jugée destructive), à refaire avec l'accord de Mauro si on veut ranger.
