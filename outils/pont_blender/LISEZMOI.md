# Pont Blender de Maison3D

Ce petit programme relie l'application Maison3D à Blender, sur le PC de Mauro.

Dans l'application, menu **« + » → « Créer avec Blender… »**, on peut :

- créer un objet **à partir de zéro**, d'après une description ;
- le créer **d'après une ou plusieurs images** : une photo, une image collée, un produit de la liste « Produits », une image de « Créer avec l'IA » ;
- **modifier un objet 3D** ajouté, ou **refaire un meuble de la maquette**.

La demande part dans une file d'attente, sur n8n (workflow « Maison3D Blender »). Ce programme la prend. Si Blender est fermé, il l'ouvre. Il lance ensuite Claude Code sans fenêtre, avec la consigne `consigne_blender.md`. Claude Code modélise l'objet dans Blender, par Blender MCP. Le programme envoie ensuite le modèle (.glb) et une image d'aperçu à l'application. Là, la fenêtre « Fichier 3D » s'ouvre : on vérifie les dimensions, puis « Ajouter ».

Le programme copie aussi le modèle dans le Drive, dans le dossier de sa pièce : `Maison 3D/Objets 3D/Rez/Salon/tabouret_chene.glb`. Un nom déjà pris reçoit `_2`, `_3`… : rien n'est écrasé. La pièce est choisie dans la fenêtre « Créer avec Blender ». Par défaut, c'est celle de l'objet modifié ou remplacé, celle de la photo, ou celle où l'on se trouve. Les portes, fenêtres, stores et rideaux vont dans « Portes-fenêtres-stores » (rez) ou « Portes-fenêtres » (étage).

Rien n'est payé en crédits. Seul l'abonnement Claude de Mauro est utilisé.

**Ajout aux plans Blender** : chaque objet fini est aussi ajouté, avec ses vraies matières, à `meubles_rez.blend` (pièces du rez, et portes, fenêtres et stores du rez) ou à `meubles_etage.blend` (étage). Ces deux fichiers sont dans le dossier `dossier_blender`. L'objet est rangé dans la collection « Créés depuis l’application / <pièce> », sous un repère vide qui porte son nom :
- **Place** : à sa vraie place si on la connaît (objet remplacé, photo calée) et si le repère du plan est réglé (`repere_plans`) ; sinon au milieu de la pièce, ou au centre du plan, à placer à la main.
- **Sauvegarde** : avant chaque ajout, une copie du plan est faite dans `sauvegardes_pont` (les 5 dernières sont gardées).
- **Plan ouvert** : si le plan est ouvert dans une fenêtre Blender, rien n'y est écrit. L'objet attend dans `travail\plans_en_attente.json` et il est ajouté dès que le plan est fermé. L'application l'indique : « Plan Blender : en attente… », puis « Ajouté à meubles_rez.blend ».
- **Objet ajouté à la main** (plan ouvert, par la session BLENDER) : mettez `"fait": true` à sa ligne dans `plans_en_attente.json`. Sinon il est reconnu à la propriété `m3d_id` du repère, et il n'est jamais ajouté deux fois.

## Ce qu'il faut sur le PC

1. **Blender** installé avec l'extension **« MCP for Blender »** activée. Elle démarre son serveur toute seule à l'ouverture de Blender. Le pont a **son propre Blender** : une deuxième fenêtre, sans fichier, ouverte à la première demande et réservée au pont (port 9877). Votre Blender (port 9876) n'est jamais utilisé par le pont : si celui du pont plante, votre travail n'est pas touché, et le pont rouvre le sien et reprend la demande. Le Blender du pont se ferme seul après 10 minutes sans demande.
2. **Claude Code** installé et connecté au compte de Mauro. La commande `claude` doit marcher dans une invite de commandes.
3. **Python 3** (3.9 ou plus récent). Aucune bibliothèque à installer.
4. **Google Drive pour ordinateur** (lecteur `G:`), pour la copie dans le Drive. S'il ne tourne pas, la demande se termine quand même, sans copie. La raison s'affiche dans l'application.

## Installation (une fois)

1. Ce dossier est dans le dépôt : `outils/pont_blender`. Sur le PC, mettez le dépôt à jour (`git pull` dans `D:\ClaudeCode\maison3D`), puis ouvrez le dossier `D:\ClaudeCode\maison3D\outils\pont_blender` dans l'Explorateur.
2. Ouvrez une invite de commandes dans ce dossier : cliquez dans la barre d'adresse de l'Explorateur, tapez `cmd`, puis Entrée.
3. Tapez `py -3 pont_blender.py --connexion` puis Entrée. Donnez votre nom (`mauro`) et votre mot de passe Maison3D. Seul le jeton de connexion est gardé, valable un an. Le mot de passe, lui, n'est jamais enregistré.
4. Ouvrez `pont_blender.json` avec le Bloc-notes. Il a été créé à l'étape 3. Réglez deux lignes :
   - `"dossier_blender": "C:\\Users\\mauro\\Desktop\\Maison3D\\Blender"`. C'est le dossier où Claude Code travaille d'habitude avec Blender MCP. Ses scripts servent d'exemples. Mettez bien les doubles barres `\\`.
   - `"agent": "PC portable"`. C'est le nom affiché dans l'application.
5. Tapez `py -3 pont_blender.py --verifier`. La commande vérifie la connexion à n8n, Claude Code et Blender MCP. Elle doit finir par « Tout est prêt. ».

## Mettre à jour

Dans `D:\ClaudeCode\maison3D`, faites `git pull`. Fermez ensuite la fenêtre noire du pont, puis relancez « Lancer le pont Blender.bat ». Les nouveaux réglages s'ajoutent tout seuls à `pont_blender.json`, et vos valeurs sont gardées.

## Réglages (`pont_blender.json`)

- `blender_a_part` : `true` (conseillé) pour que le pont ait son propre Blender ; `false` pour qu'il travaille dans le vôtre.
- `port_pont` : port de Blender MCP dans le Blender du pont, 9877. Claude Code le reçoit par la variable `BLENDER_PORT`. Votre `mcp_blender.json` ne doit donc pas fixer le port.
- `fermer_apres_min` : le Blender du pont se ferme après ce nombre de minutes sans demande (10 ; 0 = jamais).
- `ouvrir_blender` : sert seulement avec `blender_a_part` à `false` : `true` pour ouvrir Blender s'il est fermé.
- `blender_exe` : chemin de `blender.exe`. Vide = cherché dans `C:\Program Files\Blender Foundation`.
- `fichier_blender` : fichier .blend à ouvrir, seulement avec `blender_a_part` à `false`. Vide = la scène de départ.
- `port_blender` : port de l'extension dans votre Blender, 9876.
- `dossier_drive` : dossier « Objets 3D » du Drive. Vide = cherché tout seul (`G:\Mon Drive\Maison 3D\Objets 3D`). `"non"` = pas de copie.
- `dossiers_pieces` : à remplir seulement si un dossier de pièce change de nom, par exemple `{"salon": "Rez/Séjour"}`.
- `dossier_miroir` : une copie de plus sur le PC, au même rangement. Vide = aucune.
- `ajouter_aux_plans` : `true` pour ajouter chaque objet au plan de son niveau.
- `plans` : `{"rez": "chemin", "etage": "chemin"}`. Vide = `meubles_rez.blend` et `meubles_etage.blend` du `dossier_blender`.
- `repere_plans` : `{"rez": [ox, oz, sol], "etage": [...]}`, pour passer des coordonnées du site (x, z en mètres) à celles du plan : X = x − ox, Y = −(z − oz). Vide = objets posés au centre du plan.
- `plans_intervalle` : toutes les combien de secondes le pont regarde si un plan en attente est fermé (60).
- `py -3 pont_blender.py --verifier` affiche le Blender trouvé et le dossier du Drive.

## Utilisation

- Double-cliquez sur **« Lancer le pont Blender.bat »** et laissez la fenêtre noire ouverte. Pas besoin d'ouvrir Blender : le pont ouvre le sien à la première demande. Une fenêtre Blender vide apparaît alors : laissez-la travailler et ne vous en servez pas.
- Dans l'application, la pastille de la fenêtre « Créer avec Blender » devient verte : « allumé et prêt (Blender) ».
- Pour arrêter le pont : Ctrl+C dans la fenêtre noire, ou fermez-la. Les demandes faites pendant ce temps attendent dans la file. Elles partent dès que le pont est relancé.
- **Pour un démarrage automatique** avec Windows : touche Windows + R, tapez `shell:startup`, puis Entrée. Dans le dossier qui s'ouvre, faites un clic droit → « Nouveau » → « Raccourci », vers « Lancer le pont Blender.bat ».

## Bon à savoir

- **Une demande à la fois.** Les autres attendent leur tour, et l'application affiche leur place dans la file.
- **Chaque demande travaille dans une scène neuve** de Blender (`M3D_…`), affichée pendant le travail puis supprimée à la fin. Rien n'est enregistré. Avec le Blender à part, vous et la session « BLENDER » pouvez continuer à travailler dans votre Blender pendant ce temps.
- **Où sont les fichiers d'une demande.** Ils sont gardés dans `travail\<numéro>` : images reçues, consigne, `resultat.glb`, `apercu.png`, `infos.json`. Le journal est dans `pont_blender.log`.
- **Ce que Claude Code a le droit d'utiliser.** Seulement les outils Blender, la lecture et l'écriture de fichiers (réglage `"outils"`). Il n'a pas le droit de lancer de commandes.
- **Limites.** Une demande est arrêtée après 45 minutes (réglage `"minutes_max"`). Le serveur accepte 40 demandes par jour au plus.
- **Essai sans Blender.** `py -3 pont_blender.py --simuler` renvoie une simple boîte aux dimensions demandées, pour vérifier le chemin application → PC → application.
- **Changer la consigne.** Modifiez `consigne_blender.md`. Les mots entre `{{…}}` sont remplacés à chaque demande.
