// Cuisine et coin repas du rez, d'après les photos (le modèle n'avait que l'îlot)
import * as THREE from 'three';
import {MAT, boite, cylindre, groupe} from './formes.js';

// Mur du fond de la cuisine : z = -24,93, de x = 15,00 (cloison du dégagement) à 19,44 (mur de la porte-fenêtre)
const MUR=-24.93, BAS=-24.33, HAUT=-24.58;

function poignee(g,x0,x1,y,z){ boite(g,x0,x1,y-0.006,y+0.006,z,z+0.025,MAT.inox); }

function meubles(){
  const g=groupe('rez__cuisine');
  // colonne frigo-congélateur (ouest) et colonne fours (est)
  for(const [x0,x1] of [[15.00,15.62],[18.80,19.44]]){
    boite(g,x0,x1,0,2.25,MUR,BAS-0.02,MAT.boisCuisine);
  }
  boite(g,15.003,15.617,0.02,1.40,BAS-0.02,BAS,MAT.boisCuisine,'sombre'); poignee(g,15.55,15.57,1.0,BAS);
  boite(g,15.003,15.617,1.42,2.23,BAS-0.02,BAS,MAT.boisCuisine,'sombre');
  boite(g,18.803,19.437,0.02,0.85,BAS-0.02,BAS,MAT.boisCuisine,'sombre');
  boite(g,18.85,19.39,0.87,1.46,BAS-0.02,BAS+0.005,MAT.verreNoir); boite(g,18.85,19.39,1.40,1.46,BAS,BAS+0.01,MAT.inox);
  boite(g,18.803,19.437,1.48,2.23,BAS-0.02,BAS,MAT.boisCuisine,'sombre');
  // meubles bas : plinthe, caissons, tiroirs à poignées barres, plan en granit noir
  boite(g,15.62,18.80,0,0.10,MUR,BAS-0.06,MAT.plinthe);
  boite(g,15.62,18.80,0.10,0.88,MUR,BAS-0.02,MAT.boisCuisine);
  for(const [x0,x1,tiroirs] of [[15.62,16.22,2],[16.22,16.82,1],[16.82,17.82,2],[17.82,18.32,2],[18.32,18.80,2]]){
    const h=(0.86-0.12)/tiroirs;
    for(let k=0;k<tiroirs;k++){ const y0=0.12+k*h; boite(g,x0+0.003,x1-0.003,y0+0.003,y0+h-0.003,BAS-0.02,BAS,MAT.boisCuisine,'sombre'); poignee(g,x0+0.08,x1-0.08,y0+h-0.05,BAS); }
  }
  boite(g,15.62,18.80,0.88,0.92,MUR,BAS+0.03,MAT.granit);
  // évier inox et robinet col de cygne, plaque de cuisson
  boite(g,16.00,16.62,0.918,0.924,-24.82,-24.42,MAT.inox);
  cylindre(g,16.31,0.92,1.24,-24.86,0.014,MAT.chrome); boite(g,16.30,16.32,1.22,1.25,-24.86,-24.66,MAT.chrome); cylindre(g,16.31,1.12,1.24,-24.66,0.011,MAT.chrome);
  boite(g,16.95,17.70,0.92,0.926,-24.86,-24.37,MAT.verreNoir);
  // crédence en verre noir, meubles hauts à portes vitrées dépolies (2 rangs), niche de la hotte
  boite(g,15.62,18.80,0.92,1.45,MUR,MUR+0.01,MAT.verreNoir);
  for(const [x0,x1,n] of [[15.62,16.82,2],[17.82,18.80,2]]){
    boite(g,x0,x1,1.45,2.25,MUR,HAUT-0.02,MAT.boisCuisine);
    const w=(x1-x0)/n;
    for(let i=0;i<n;i++) for(const [y0,y1] of [[1.45,1.85],[1.85,2.25]]){
      const a=x0+i*w;
      boite(g,a+0.004,a+w-0.004,y0+0.004,y1-0.004,HAUT-0.02,HAUT,MAT.boisCuisine,'sombre');
      boite(g,a+0.05,a+w-0.05,y0+0.06,y1-0.05,HAUT,HAUT+0.004,MAT.depoli);
      poignee(g,a+0.08,a+w-0.08,y0+0.03,HAUT);
    }
  }
  boite(g,16.82,17.82,1.85,1.87,MUR,HAUT,MAT.boisCuisine);                     // tablette de la niche
  boite(g,17.00,17.70,1.55,1.61,MUR,-24.43,MAT.inox);                           // hotte
  boite(g,17.20,17.50,1.61,1.85,MUR,-24.73,MAT.inox);
  boite(g,15.00,19.44,2.25,2.40,MUR,-24.55,MAT.blanc);                          // retombée au plafond
  return g;
}

// Tabouret de bar : pieds métal, assise bois, dossier à barreaux tourné vers le salon
function tabouret(nom,x,z){
  const g=groupe(nom), s=0.17;
  for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) cylindre(g,x+dx*0.15,0,0.64,z+dz*0.15,0.011,MAT.inox);
  boite(g,x-s,x+s,0.64,0.67,z-s,z+s,MAT.boisCuisine);
  for(const dx of [-0.15,0.15]) cylindre(g,x+dx,0.67,0.98,z+0.15,0.011,MAT.inox);
  for(const y of [0.80,0.96]) boite(g,x-0.15,x+0.15,y-0.01,y+0.01,z+0.145,z+0.155,MAT.inox);
  boite(g,x-0.15,x+0.15,0.30,0.315,z-0.155,z-0.145,MAT.inox);
  return g;
}

// Longue suspension au-dessus de l'îlot
function suspension(){
  const g=groupe('rez__suspension_cuisine');
  boite(g,16.25,17.95,1.78,1.82,-23.30,-23.18,MAT.inox);
  boite(g,16.30,17.90,1.775,1.78,-23.28,-23.20,MAT.lumiere);
  for(const x of [16.55,17.65]) cylindre(g,x,1.82,2.40,-23.24,0.003,MAT.sombre);
  return g;
}

// Coin repas : table blanche (plateau en verre opaque), longue banquette bordeaux côté cuisine, 3 chaises bordeaux côté salon
function table(){
  const g=groupe('rez__table_repas'), x0=15.95, x1=17.75, z0=-21.15, z1=-20.25;
  boite(g,x0,x1,0.72,0.75,z0,z1,MAT.verreOpaque);                          // plateau en verre opaque
  boite(g,x0+0.06,x1-0.06,0.66,0.72,z0+0.06,z1-0.06,MAT.inox);
  for(const [x,z] of [[x0+0.07,z0+0.07],[x1-0.07,z0+0.07],[x0+0.07,z1-0.07],[x1-0.07,z1-0.07]]) boite(g,x-0.025,x+0.025,0,0.66,z-0.025,z+0.025,MAT.inox);
  return g;
}
function banquette(){
  const g=groupe('rez__banquette'), x0=15.90, x1=17.85, z0=-21.85, z1=-21.45;
  boite(g,x0,x1,0.08,0.38,z0,z1,MAT.cuir); boite(g,x0,x1,0.38,0.46,z0,z1,MAT.cuirClair);
  for(const x of [x0+0.08,x1-0.08]) boite(g,x-0.03,x+0.03,0,0.08,z0+0.05,z1-0.05,MAT.inox);
  return g;
}
function chaise(nom,x,z){
  const g=groupe(nom), s=0.22;
  for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) cylindre(g,x+dx*0.19,0,0.42,z+dz*0.19,0.012,MAT.inox);
  boite(g,x-s,x+s,0.42,0.48,z-s,z+s,MAT.cuir);
  boite(g,x-s,x+s,0.48,0.95,z+s-0.06,z+s,MAT.cuir);   // dossier côté salon, la chaise regarde la table
  return g;
}

export function construireCuisine(){
  return [meubles(), tabouret('rez__tabouret_1',16.45,-22.45), tabouret('rez__tabouret_2',17.15,-22.45), tabouret('rez__tabouret_3',17.85,-22.45),
    suspension(), table(), banquette(), chaise('rez__chaise_1',16.30,-20.00), chaise('rez__chaise_2',16.85,-20.00), chaise('rez__chaise_3',17.40,-20.00)];
}
