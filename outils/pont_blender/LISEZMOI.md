# Pont Blender de Maison3D

Ce petit programme relie l'application Maison3D à Blender, sur le PC de Mauro.

Dans l'application, menu **« + » → « Créer avec Blender… »**, on peut :

- créer un objet **à partir de zéro**, d'après une description ;
- le créer **d'après une ou plusieurs images** : une photo, une image collée, un produit de la liste « Produits », une image de « Créer avec l'IA » ;
- **modifier un objet 3D** ajouté, ou **refaire un meuble de la maquette**.

La demande part dans une file d'attente, sur n8n (workflow « Maison3D Blender »). Ce programme la prend, lance Claude Code sans fenêtre, avec la consigne `consigne_blender.md`. Claude Code modélise l'objet dans Blender, par Blender MCP. Le programme envoie ensuite le modèle (.glb) et une image d'aperçu à l'application. Là, la fenêtre « Fichier 3D » s'ouvre : on vérifie les dimensions, puis « Ajouter ».

Rien n'est payé en crédits. Seul l'abonnement Claude de Mauro est utilisé.

## Ce qu'il faut sur le PC

1. **Blender ouvert**, avec l'extension **Blender MCP** connectée (comme pour la session Claude Code « BLENDER »).
2. **Claude Code** installé et connecté au compte de Mauro. La commande `claude` doit marcher dans une invite de commandes.
3. **Python 3** (3.9 ou plus récent). Aucune bibliothèque à installer.

## Installation (une fois)

1. Ce dossier est dans le dépôt : `outils/pont_blender`. Sur le PC, mettez le dépôt à jour (`git pull` dans `D:\ClaudeCode\maison3D`), puis ouvrez le dossier `D:\ClaudeCode\maison3D\outils\pont_blender` dans l'Explorateur.
2. Ouvrez une invite de commandes dans ce dossier : cliquez dans la barre d'adresse de l'Explorateur, tapez `cmd`, puis Entrée.
3. Tapez `py -3 pont_blender.py --connexion` puis Entrée. Donnez votre nom (`mauro`) et votre mot de passe Maison3D. Seul le jeton de connexion est gardé, valable un an. Le mot de passe, lui, n'est jamais enregistré.
4. Ouvrez `pont_blender.json` avec le Bloc-notes. Il a été créé à l'étape 3. Réglez deux lignes :
   - `"dossier_blender": "C:\\Users\\mauro\\Desktop\\Maison3D\\Blender"`. C'est le dossier où Claude Code travaille d'habitude avec Blender MCP. Ses scripts servent d'exemples. Mettez bien les doubles barres `\\`.
   - `"agent": "PC portable"`. C'est le nom affiché dans l'application.
5. Tapez `py -3 pont_blender.py --verifier`. La commande vérifie la connexion à n8n, Claude Code et Blender MCP. Elle doit finir par « Tout est prêt. ».

## Utilisation

- Double-cliquez sur **« Lancer le pont Blender.bat »** et laissez la fenêtre noire ouverte. Gardez aussi Blender ouvert.
- Dans l'application, la pastille de la fenêtre « Créer avec Blender » devient verte : « allumé et prêt (Blender) ».
- Pour arrêter le pont : Ctrl+C dans la fenêtre noire, ou fermez-la. Les demandes faites pendant ce temps attendent dans la file. Elles partent dès que le pont est relancé.
- **Pour un démarrage automatique** avec Windows : touche Windows + R, tapez `shell:startup`, puis Entrée. Dans le dossier qui s'ouvre, faites un clic droit → « Nouveau » → « Raccourci », vers « Lancer le pont Blender.bat ».

## Bon à savoir

- **Une demande à la fois.** Les autres attendent leur tour, et l'application affiche leur place dans la file.
- **Chaque demande travaille dans une scène neuve** de Blender (`M3D_…`), supprimée à la fin. Rien d'autre n'est touché dans le fichier ouvert. Évitez quand même de faire travailler la session « BLENDER » au même moment.
- **Où sont les fichiers d'une demande.** Ils sont gardés dans `travail\<numéro>` : images reçues, consigne, `resultat.glb`, `apercu.png`, `infos.json`. Le journal est dans `pont_blender.log`.
- **Ce que Claude Code a le droit d'utiliser.** Seulement les outils Blender, la lecture et l'écriture de fichiers (réglage `"outils"`). Il n'a pas le droit de lancer de commandes.
- **Limites.** Une demande est arrêtée après 45 minutes (réglage `"minutes_max"`). Le serveur accepte 40 demandes par jour au plus.
- **Essai sans Blender.** `py -3 pont_blender.py --simuler` renvoie une simple boîte aux dimensions demandées, pour vérifier le chemin application → PC → application.
- **Changer la consigne.** Modifiez `consigne_blender.md`. Les mots entre `{{…}}` sont remplacés à chaque demande.
