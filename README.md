# Maison3D

Visite 3D de l'appartement, à ouvrir dans un navigateur :

- **Maquette** : tourner autour de l'appartement, voir le rez ou l'étage séparément.
- **Visite** : se promener à hauteur d'yeux, monter l'escalier.
- **Meubles** : toucher un meuble pour le déplacer, le tourner, changer sa couleur ou le masquer. Les changements restent dans le navigateur.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html`, `css/`, `js/` | Le site (sans compilation) |
| `modele/` | Le modèle 3D chargé par le site : la structure d'abord, puis le mobilier |
| `appartement.glb` | Le modèle 3D complet (archive, source de `modele/`) |
| `source/` | Exports d'origine de SketchUp (OBJ et STL) |
| `outils/` | Scripts de conversion SketchUp → site |
| `CLAUDE.md` | Instructions pour Claude Code |

## Continuer avec Claude Code

Ouvrir claude.ai/code, choisir le dépôt **maison3D**, puis décrire ce qu'on veut changer. Claude Code lit `CLAUDE.md` automatiquement et connaît le projet.
