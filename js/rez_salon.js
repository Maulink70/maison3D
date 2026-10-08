// Salon du rez, compléments d'après les photos (canapé, tapis, buffet et bibliothèque sont déjà dans le modèle)
import {MAT, boite, cylindre, sphere, groupe, plante} from './formes.js';

// Meuble TV bas, crème, devant la partie fixe de la baie (mur sud, face intérieure z = -14,34)
function meubleTV(){
  const g=groupe('rez__meuble_tv'), x0=16.10, x1=18.10, z1=-14.37, z0=z1-0.45;
  boite(g,x0,x1,0.05,0.45,z0,z1,MAT.creme);
  boite(g,x0+0.04,x1-0.04,0,0.05,z0+0.04,z1-0.04,MAT.plinthe);
  const w=(x1-x0)/3; for(let i=0;i<3;i++) boite(g,x0+i*w+0.004,x0+(i+1)*w-0.004,0.07,0.43,z0-0.015,z0,MAT.creme,true);
  return g;
}
function television(){
  const g=groupe('rez__tv'), cx=17.10, z=-14.60;
  boite(g,cx-0.62,cx+0.62,0.53,1.25,z-0.025,z+0.025,MAT.noir);
  boite(g,cx-0.60,cx+0.60,0.55,1.23,z-0.027,z-0.025,MAT.verreNoir);
  boite(g,cx-0.04,cx+0.04,0.45,0.53,z-0.02,z+0.02,MAT.sombre); boite(g,cx-0.20,cx+0.20,0.45,0.46,z-0.12,z+0.10,MAT.sombre);
  return g;
}
// Table basse : plateau en verre sur cadre chromé, sur le tapis
function tableBasse(){
  const g=groupe('rez__table_basse'), x0=17.25, x1=18.25, z0=-16.85, z1=-16.25;
  boite(g,x0,x1,0.38,0.395,z0,z1,MAT.verre);
  for(const [a,b] of [[x0+0.04,z0+0.04],[x1-0.04,z0+0.04],[x0+0.04,z1-0.04],[x1-0.04,z1-0.04]]) boite(g,a-0.012,a+0.012,0,0.38,b-0.012,b+0.012,MAT.chrome);
  boite(g,x0+0.03,x1-0.03,0.36,0.375,z0+0.03,z0+0.05,MAT.chrome); boite(g,x0+0.03,x1-0.03,0.36,0.375,z1-0.05,z1-0.03,MAT.chrome);
  return g;
}
// Grande plante (yucca) près de la baie, côté porte coulissante
function grandePlante(){
  const g=groupe('rez__grande_plante');
  cylindre(g,14.95,0.06,0.36,-14.95,0.17,MAT.potBlanc,0.2);
  for(const [dx,dz,h] of [[0,0,1.05],[0.06,0.04,0.85],[-0.05,0.05,0.7]]){
    cylindre(g,14.95+dx,0.36,0.36+h,-14.95+dz,0.03,MAT.boisCuisine,0.025);
    plante(g,14.95+dx,0.36+h-0.05,-14.95+dz,{pot:0.001,hPot:0.001,h:0.65,feuilles:16,lame:0.03});
  }
  return g;
}
// Plante posée sur le caisson bas de la bibliothèque (côté salon)
function planteBibliotheque(){
  const g=groupe('rez__plante_bibliotheque');
  plante(g,14.18,1.19,-17.85,{pot:0.11,hPot:0.18,h:0.65,feuilles:16,lame:0.03});   // feuilles en deçà du muret de l'escalier
  return g;
}
// Lampadaire blanc au bout de la bibliothèque, côté entrée
function lampadaire(){
  const g=groupe('rez__lampadaire'), x=14.45, z=-20.95;
  cylindre(g,x,0,0.02,z,0.14,MAT.inox);
  for(const dx of [-0.03,0.03]) cylindre(g,x+dx,0.02,1.85,z,0.006,MAT.inox);
  boite(g,x-0.12,x+0.12,1.0,1.75,z-0.055,z+0.055,MAT.lumiere);
  return g;
}
// Lampe à poser sur le buffet (pied argenté, abat-jour blanc)
function lampeBuffet(){
  const g=groupe('rez__lampe_buffet'), x=19.12, z=-20.85, y=0.925;
  sphere(g,x,y+0.12,z,0.11,MAT.chrome); cylindre(g,x,y+0.22,y+0.32,z,0.012,MAT.chrome);
  cylindre(g,x,y+0.30,y+0.52,z,0.19,MAT.lumiere,0.13);
  return g;
}

export function construireSalon(){
  return [meubleTV(),television(),tableBasse(),grandePlante(),planteBibliotheque(),lampadaire(),lampeBuffet()];
}
