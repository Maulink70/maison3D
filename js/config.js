// Constantes du modèle (mètres, axe vertical Y)
export const ETAGE_FLOOR=2.74, REZ_CUT=2.33, ROOF_CUT=5.15, EYE=1.6;
// Coupe basse de la vue « Étage » : le sol de la douche de l'étage est à 2,40 m dans le modèle, sous le plancher (2,74)
export const ETAGE_CUT=2.38;

// Le modèle est découpé en deux fichiers (outils/decouper_glb.mjs) : la structure s'affiche d'abord
export const FICHIERS={structure:'modele/structure.glb', mobilier:'modele/mobilier.glb'};

// Noms lisibles et catégories (fixe = non modifiable)
export const META={
  structure_rez:{l:'Structure rez',c:'fixe'}, structure_etage:{l:'Structure étage',c:'fixe'},
  'rez__escalier':{l:'Escalier',c:'fixe'}, 'rez__cloison':{l:'Cloison escalier',c:'fixe'},
  'rez__canape_salon#1':{l:'Canapé d’angle',c:'meuble'}, 'rez__tapis_salon':{l:'Tapis du salon',c:'meuble'},
  'rez__meuble_salon':{l:'Meuble bas (rouge)',c:'meuble'}, 'rez__salon':{l:'Meuble haut (dégagement)',c:'meuble'},
  'rez__Bar_cuisine':{l:'Bar de cuisine',c:'meuble'}, 'rez__armoire':{l:'Bibliothèque le long de l’escalier',c:'meuble'},
  'rez__armoire_chambre_a_coucher':{l:'Armoire chambre',c:'meuble'}, 'rez__Baignoire':{l:'Baignoire',c:'meuble'},
  'rez__Cherry':{l:'Cerise décorative',c:'meuble'}, 'rez__element_mural':{l:'Porte-fenêtre cuisine',c:'ouverture'},
  'rez__store_fenetre':{l:'Store',c:'ouverture'},
  'rez__wc':{l:'WC',c:'meuble'}, 'rez__lavabo_wc':{l:'Lavabo et meuble (WC)',c:'meuble'}, 'rez__lave_linge':{l:'Lave-linge et sèche-linge',c:'meuble'},
  'rez__cloison_reduit':{l:'Cloison du réduit',c:'fixe'},
  'rez__cuisine':{l:'Cuisine (meubles et électroménager)',c:'meuble'}, 'rez__suspension_cuisine':{l:'Suspension de l’îlot',c:'meuble'},
  'rez__tabouret_1':{l:'Tabouret de bar 1',c:'meuble'}, 'rez__tabouret_2':{l:'Tabouret de bar 2',c:'meuble'}, 'rez__tabouret_3':{l:'Tabouret de bar 3',c:'meuble'},
  'rez__table_repas':{l:'Table blanche',c:'meuble'}, 'rez__banquette':{l:'Banquette bordeaux',c:'meuble'},
  'rez__chaise_1':{l:'Chaise bordeaux 1',c:'meuble'}, 'rez__chaise_2':{l:'Chaise bordeaux 2',c:'meuble'}, 'rez__chaise_3':{l:'Chaise bordeaux 3',c:'meuble'},
  'rez__meuble_tv':{l:'Meuble TV',c:'meuble'}, 'rez__tv':{l:'Télévision',c:'meuble'}, 'rez__table_basse':{l:'Table basse en verre',c:'meuble'},
  'rez__grande_plante':{l:'Grande plante',c:'meuble'}, 'rez__plante_bibliotheque':{l:'Plante sur la bibliothèque',c:'meuble'},
  'rez__lampadaire':{l:'Lampadaire',c:'meuble'}, 'rez__lampe_buffet':{l:'Lampe du buffet',c:'meuble'},
  'rez__commode':{l:'Commode (entrée)',c:'meuble'}, 'rez__porte_entree':{l:'Porte d’entrée',c:'ouverture'}, 'rez__porte_reduit':{l:'Porte du réduit',c:'ouverture'},
  'rez__plafonnier_entree':{l:'Plafonnier (entrée)',c:'meuble'}, 'rez__plafonnier_degagement':{l:'Plafonnier (dégagement)',c:'meuble'},
  'rez__plafonnier_sdb':{l:'Plafonnier (salle de bain)',c:'meuble'}, 'rez__plafonnier_wc':{l:'Plafonnier (WC)',c:'meuble'},
  'rez__lit':{l:'Lit 180 × 200',c:'meuble'}, 'rez__chevet_1':{l:'Table de chevet 1',c:'meuble'}, 'rez__chevet_2':{l:'Table de chevet 2',c:'meuble'}, 'rez__lustre_chambre':{l:'Lustre (chambre)',c:'meuble'},
  'rez__douche':{l:'Douche à l’italienne',c:'meuble'}, 'rez__vasque_sdb':{l:'Meuble vasque et miroir',c:'meuble'},
  'rez__seche_serviettes':{l:'Sèche-serviettes',c:'meuble'}, 'rez__wc_sdb':{l:'WC (salle de bain)',c:'meuble'},
  'etage__lit_chambre_etage':{l:'Lit',c:'meuble'}, 'etage__bureau_chambre_etage':{l:'Bureau',c:'meuble'},
  'etage__wc':{l:'WC',c:'meuble'}, 'etage__bouton_wc_douche':{l:'Plaque WC',c:'meuble'},
  'etage__Douche_etage':{l:'Douche',c:'meuble'}, 'etage__barre_linge_douche':{l:'Porte-linge',c:'meuble'},
  'rez__porte_interieure_88x218':{l:'Porte salle de bain',c:'ouverture'}, 'rez__porte_interieure_88x218_2':{l:'Porte WC / buanderie',c:'ouverture'},
  'rez__porte_interieure_98_(80)':{l:'Porte chambre',c:'ouverture'}, 'rez__baie_vitree':{l:'Baie vitrée',c:'ouverture'},
  'rez__Fenetre_salon_haute':{l:'Fenêtre haute salon',c:'ouverture'}, 'rez__fenetre_salon_grande':{l:'Grande fenêtre salon',c:'ouverture'},
  'rez__fenetre_chambre_coucher':{l:'Fenêtre chambre',c:'ouverture'}, 'rez__Fenetre_salle_de_bain':{l:'Fenêtre salle de bain',c:'ouverture'},
  'etage__porte_dressing':{l:'Porte dressing',c:'ouverture'}, 'etage__porte_chambre_etage':{l:'Porte chambre',c:'ouverture'},
  'etage__porte_douche_etage':{l:'Porte salle de douche',c:'ouverture'}, 'etage__Fenetre_chambre_etage':{l:'Fenêtre chambre',c:'ouverture'},
  'etage__fenetre_douche_etage':{l:'Fenêtre douche',c:'ouverture'}, 'etage__Velux':{l:'Velux',c:'ouverture'}, 'etage__Velux_2':{l:'Velux (2)',c:'ouverture'}
};
export const CAT_LABEL={meuble:'Mobilier',ouverture:'Portes et fenêtres'};

// Matériau du sol du WC / buanderie (mosaïque bleue SketchUp, utilisée seulement là), remplacé par le carrelage réel
export const SOL_WC='Material_11';

// Garde-corps vitré au bord de la mezzanine (absent du modèle SketchUp), hauteur 1,20 m
export const GARDE_CORPS={x0:13.82, x1:16.70, z0:-21.13, z1:-21.11, h:1.20};
