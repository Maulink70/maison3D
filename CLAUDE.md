# Maison3D — visite 3D de l'appartement de Mauro

Site web qui affiche l'appartement (modélisé dans SketchUp) en 3D : vue maquette, visite à la première personne, et réaménagement du mobilier. L'état actuel est un prototype (déplacer, tourner, recolorer, masquer, sauvegarde locale). La cible complète est décrite dans « Cahier des charges » plus bas.

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

## Cahier des charges (validé par Mauro le 7 octobre 2026)

### Objectif
Outil pour Mauro et sa compagne Tamara, afin de préparer le réaménagement réel de l'appartement : essayer des meubles, vérifier des dimensions, imprimer des plans, visualiser le résultat en photo réaliste. Ce n'est pas un site de présentation publique.

### Deux modes strictement séparés
- **Visite** : on regarde et on se déplace, **rien n'est modifiable**. Menu « Aller à » par pièce, déplacement au choix par toucher au sol ou en marchant, **vitesse de déplacement réglable**, portes qui s'ouvrent.
- **Éditer l'appartement** : tout ce qui touche aux meubles, objets et rendus.

Pièces : rez = salon, cuisine, chambre, salle de bain ; étage = chambre, salle de douche avec WC, dressing. À confirmer avec Mauro au moment de faire le menu « Aller à ».

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
- **Masquer un niveau** : pouvoir cacher l'étage (et tout niveau supérieur s'il y en a un jour) pour voir le rez par le haut, dans toute vue. Le prototype le fait déjà par un plan de coupe (`REZ_CUT`) ; la cible est un vrai interrupteur par niveau (afficher / masquer), en plus de la coupe.
- **Calques** activables dans toute vue : cotes, hauteurs, noms des pièces.
- Vitres transparentes (remplacer la texture « nuages » de SketchUp), murs pleins vus de l'extérieur (faces simples côté extérieur à doubler), **lumière du jour réglable** (matin, midi, soir).

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

### Hébergement
Vercel, relié à GitHub : projet « maison3d » (`prj_xamwNtiD0YBKAkVO3DebYhOWMu8y`), production **https://maison3d.vercel.app**, redéployé automatiquement à chaque push sur `main`. Dépôt privé. Site statique, rien à compiler (preset « Other », pas de build). **Vercel limite à 100 déploiements par 24 h** : regrouper les pushes, un par lot testé, jamais pour « voir si ça marche ». Vérifier les déploiements avec le connecteur Vercel.

### Environnement Claude Code (cloud « Maulink »)
- Variables d'environnement : `N8N_API_KEY` (clé API n8n « Claude », tous droits, en-tête `X-N8N-API-KEY`) et `N8N_BASE_URL` (`https://n8n.srv1123557.hstgr.cloud`). Appeler l'API REST n8n (`/api/v1/…`) par curl ; le connecteur MCP n8n ne sert qu'à lancer des workflows explicitement exposés (aucun aujourd'hui) et ne permet ni de créer ni de modifier.
- Secret réseau `Claude kie` injecté par le proxy pour `api.kie.ai` et `kieai.redpandaai.co`.
- Domaines autorisés : n8n, kie.ai, Vercel (`*.vercel.app`), Familia, CDN (jsdelivr, cdnjs, unpkg), Google Fonts, Airtable, Sketchfab, Poly Haven, GitHub. Si un domaine manque : l'ajouter dans l'environnement Maulink, puis **ouvrir une nouvelle session** (le réglage ne s'applique pas aux sessions déjà ouvertes).
- Au début de chaque session, tester les accès réseau utiles par curl avant d'annoncer quoi que ce soit.

### Ordre de construction (livrer et faire valider étape par étape)
1. **Navigation et rendu** : modes séparés, Aller à, toucher au sol, vitesse, portes, rotation libre des meubles, masquage par niveau, vitres, murs, calques, plan 2D, impression, lumière.
2. **Comptes et synchronisation** : workflows n8n + base Airtable « Maison3D », variantes nommées.
3. **Catalogue** : banques 3D, formes simples, import GLB, panneau photo, dimensions, matières, remplacement.
4. **Rendu réaliste kie.ai** : galerie de vraies photos par pièce, bouton de rendu, mode « Image » avec ajout d'un objet par trombone, historique, insertion dans Familia.

À prévoir du côté de Mauro : une base Airtable « Maison3D » (à décrire précisément avant de la créer), quelques workflows n8n (Claude Code peut les créer, n8n étant connecté), un compte Sketchfab gratuit, et ses vraies photos des pièces.

## État du projet (à mettre à jour par Claude Code à la fin de chaque livraison, avant le push)

- 8 octobre 2026 : cahier des charges validé, site prototype déployé sur https://maison3d.vercel.app, environnement Claude Code configuré. **Aucune étape commencée.** Prochaine action : plan détaillé de l'étape 1, à faire valider par Mauro.

## Problèmes connus

- Aujourd'hui on traverse les portes et les meubles ; seuls les murs bloquent.
- Noms incertains dans le modèle : `rez__element_mural` (ancien `Groupe#5`, 0,29 × 2,40 × 1,24 m contre un mur), `rez__salon` (0,69 × 2,40 × 2,07 m), `rez__cloison` (ancien `Groupe#1`). À faire confirmer par Mauro.
