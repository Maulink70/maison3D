// Entrée, chambre et salle de bain du rez, d'après les photos de Mauro
import * as THREE from 'three';
import {MAT, boite, cylindre, sphere, groupe, lignes, copier} from './formes.js';

// ---------- Entrée ----------
// Commode en érable contre le mur du WC (face z = -22,58), façade vers l'entrée : 2 petits tiroirs + 4 grands
function commode(){
  const g=groupe('rez__commode'), x0=12.05, x1=12.85, z0=-22.58, z1=-22.13;
  boite(g,x0,x1,0.04,0.85,z0,z1-0.018,MAT.erable);
  const f=(a,b,y0,y1)=>{ boite(g,a+0.003,b-0.003,y0+0.003,y1-0.003,z1-0.018,z1,MAT.erable,true); sphere(g,(a+b)/2,(y0+y1)/2,z1+0.012,0.011,MAT.chrome,10); };
  f(x0,(x0+x1)/2,0.68,0.84); f((x0+x1)/2,x1,0.68,0.84);
  for(let k=0;k<4;k++) f(x0,x1,0.05+k*0.1575,0.05+(k+1)*0.1575);
  for(const [x,z] of [[x0+0.04,z0+0.04],[x1-0.04,z0+0.04],[x0+0.04,z1-0.06],[x1-0.04,z1-0.06]]) boite(g,x-0.02,x+0.02,0,0.04,z-0.02,z+0.02,MAT.erable);
  return g;
}
// Porte d'entrée brun foncé à cadre blanc, sur le mur z = -21,11 (non ouvrable : le mur du modèle est plein)
function porteEntree(){
  const g=groupe('rez__porte_entree');
  boite(g,11.60,12.62,0,2.16,-21.122,-21.11,MAT.blanc);
  boite(g,11.66,12.56,0,2.10,-21.135,-21.122,MAT.porteSombre);
  boite(g,12.43,12.47,1.03,1.07,-21.16,-21.135,MAT.chrome); boite(g,12.33,12.47,1.04,1.06,-21.18,-21.16,MAT.chrome);
  return g;
}
// Porte affleurante blanche du réduit sous l'escalier, à côté de la porte d'entrée
function porteReduit(){
  const g=groupe('rez__porte_reduit');
  boite(g,12.93,13.70,0,2.02,-21.12,-21.10,MAT.blanc,true);
  boite(g,13.60,13.64,0.99,1.03,-21.14,-21.12,MAT.chrome); boite(g,13.50,13.64,1.00,1.02,-21.16,-21.14,MAT.chrome);
  return g;
}
function plafonnier(nom,x,z,yPlafond=2.40){
  const g=groupe(nom);
  cylindre(g,x,yPlafond-0.13,yPlafond,z,0.065,MAT.blanc);
  cylindre(g,x,yPlafond-0.135,yPlafond-0.13,z,0.045,MAT.lumiere);
  return g;
}

// Globe lumineux du WC / buanderie
function globeWC(){ const g=groupe('rez__plafonnier_wc'); cylindre(g,12.25,2.36,2.40,-23.45,0.01,MAT.chrome); sphere(g,12.25,2.24,-23.45,0.13,MAT.lumiere,20); return g; }

// ---------- Chambre ----------
// Lit 180 × 200 à tête de lit capitonnée beige, contre le mur nord (sous la pente du toit)
function lit(){
  const g=groupe('rez__lit'), x0=16.48, x1=18.43, zT=-27.80;
  boite(g,x0,x1,0.10,1.00,zT,zT+0.10,MAT.tissuBeige);                     // tête de lit
  boite(g,x0,x1,0.12,0.40,zT+0.10,zT+2.15,MAT.tissuBeige);                // cadre
  for(const [x,z] of [[x0+0.05,zT+0.15],[x1-0.05,zT+0.15],[x0+0.05,zT+2.10],[x1-0.05,zT+2.10]]) boite(g,x-0.03,x+0.03,0,0.12,z-0.03,z+0.03,MAT.sombre);
  boite(g,x0+0.075,x1-0.075,0.40,0.58,zT+0.12,zT+2.12,MAT.drap);          // matelas 180 × 200
  boite(g,x0+0.05,x1-0.05,0.56,0.62,zT+0.55,zT+2.14,MAT.drap);            // couette
  for(const c of [0.25,0.71]) boite(g,x0+c*(x1-x0)-0.33,x0+c*(x1-x0)+0.33,0.58,0.71,zT+0.14,zT+0.52,MAT.drap);
  return g;
}
function chevet(nom,x){
  const g=groupe(nom), z0=-27.80, z1=-27.40;
  boite(g,x-0.225,x+0.225,0.02,0.50,z0,z1-0.016,MAT.blanc);
  for(const [y0,y1] of [[0.03,0.26],[0.26,0.49]]) boite(g,x-0.222,x+0.222,y0+0.003,y1-0.003,z1-0.016,z1,MAT.blanc,true);
  cylindre(g,x+0.08,0.50,0.70,-27.62,0.008,MAT.chrome);                   // petite lampe champignon
  const abat=new THREE.Mesh(new THREE.SphereGeometry(0.09,16,8,0,Math.PI*2,0,Math.PI/2),MAT.lumiere); abat.position.set(x+0.08,0.66,-27.62); g.add(abat);
  return g;
}
// Lustre à pampilles au centre du plafond
function lustre(){
  const g=groupe('rez__lustre_chambre'), x=17.30, z=-26.25, y=2.40;
  cylindre(g,x,y-0.03,y,z,0.07,MAT.chrome); cylindre(g,x,y-0.25,y-0.03,z,0.008,MAT.chrome); sphere(g,x,y-0.27,z,0.05,MAT.chrome);
  const geo=new THREE.OctahedronGeometry(0.025);
  for(let i=0;i<24;i++){ const a=i*0.9, r=0.08+0.17*((i*7)%10)/10, h=0.28+0.25*((i*13)%10)/10;
    const p=new THREE.Mesh(geo,MAT.cristal); p.scale.y=1.8; p.position.set(x+Math.cos(a)*r,y-h,z+Math.sin(a)*r); g.add(p); }
  return g;
}

// ---------- Salle de bain ----------
// Douche à l'italienne à droite de la baignoire : paroi vitrée, mur en plaquettes de pierre sombre, ciel de pluie
function douche(){
  const g=groupe('rez__douche');
  boite(g,13.785,13.797,0.02,2.00,-27.78,-26.84,MAT.verre);                              // paroi vitrée fixe
  boite(g,14.72,14.75,0,2.39,-27.10,-26.11,MAT.briqueSombre); boite(g,14.72,14.75,0,1.40,-27.78,-27.10,MAT.briqueSombre);
  lignes(g,-27.78,-26.11,0.03,1.38,14.719,0.075,'x');
  boite(g,14.70,14.72,2.37,2.39,-27.05,-26.15,MAT.lumiere);                              // bandeau lumineux
  cylindre(g,14.24,0.90,2.02,-27.33,0.012,MAT.chrome);                                    // colonne de douche
  boite(g,14.17,14.31,1.08,1.14,-27.36,-27.30,MAT.chrome);
  boite(g,14.235,14.245,2.00,2.02,-27.33,-27.05,MAT.chrome); cylindre(g,14.24,1.99,2.01,-27.0,0.12,MAT.chrome);
  return g;
}
// Meuble vasque en chêne suspendu contre le mur ouest (x = 11,31), grande vasque blanche, miroir et réglette
function vasque(){
  const g=groupe('rez__vasque_sdb'), x0=11.31, z0=-26.78, z1=-25.83, xf=11.81;
  boite(g,x0,xf-0.018,0.40,0.80,z0,z1,MAT.chene);
  for(const [y0,y1] of [[0.40,0.60],[0.60,0.80]]) boite(g,xf-0.018,xf,y0+0.004,y1-0.004,z0+0.004,z1-0.004,MAT.chene,'sombre');
  const v0=11.33, v1=11.80, w0=z0+0.05, w1=z1-0.05, y0=0.80, y1=0.95, e=0.02;
  boite(g,v0,v1,y0,y0+0.04,w0,w1,MAT.ceramique); boite(g,v0,v0+0.09,y0,y1,w0,w1,MAT.ceramique); boite(g,v1-e,v1,y0,y1,w0,w1,MAT.ceramique);
  boite(g,v0,v1,y0,y1,w0,w0+e,MAT.ceramique); boite(g,v0,v1,y0,y1,w1-e,w1,MAT.ceramique);
  cylindre(g,11.37,y1,y1+0.17,(z0+z1)/2,0.014,MAT.chrome); boite(g,11.36,11.47,y1+0.14,y1+0.16,(z0+z1)/2-0.01,(z0+z1)/2+0.01,MAT.chrome);
  boite(g,x0,x0+0.006,1.05,1.75,z0,z1,new THREE.MeshStandardMaterial({color:0xdde6ea,roughness:0.06}));
  boite(g,x0,x0+0.09,1.80,1.84,-26.62,-25.99,MAT.chrome); boite(g,x0+0.06,x0+0.09,1.795,1.80,-26.60,-26.01,MAT.lumiere);
  return g;
}
// Sèche-serviettes chromé entre la vasque et le WC
function secheServiettes(){
  const g=groupe('rez__seche_serviettes'), x=11.36, z0=-25.75, z1=-25.30;
  for(const z of [z0,z1]) cylindre(g,x,0.30,1.60,z,0.014,MAT.chrome);
  for(let y=0.40;y<1.6;y+=0.12) boite(g,x-0.01,x+0.01,y-0.01,y+0.01,z0,z1,MAT.chrome);
  return g;
}
// WC suspendu sur un muret carrelé à mi-hauteur, contre le mur sud près de la porte (copie du WC de l'étage)
function wcSdb(root){
  const g=groupe('rez__wc_sdb');
  boite(g,11.31,12.95,0,1.15,-25.21,-25.01,MAT.carrelageGris); boite(g,11.31,12.97,1.15,1.17,-25.23,-25.01,MAT.carrelageGris);
  const cuvette=root.getObjectByName('etage__wc'), plaque=root.getObjectByName('etage__bouton_wc_douche');
  // à l'étage le WC est adossé au mur z = -21,39 et regarde vers -z, comme ici (adossé au muret z = -25,21)
  if(cuvette) g.add(copier(cuvette,new THREE.Vector3(17.179,2.74,-21.39),new THREE.Vector3(12.15,0,-25.21),0));
  if(plaque) g.add(copier(plaque,new THREE.Vector3(17.175,2.74,-21.423),new THREE.Vector3(12.15,0,-25.21),0));
  return g;
}

export function construirePieces(root){
  return [commode(), porteEntree(), porteReduit(), plafonnier('rez__plafonnier_entree',12.40,-21.85), plafonnier('rez__plafonnier_degagement',13.95,-23.70),
    lit(), chevet('rez__chevet_1',16.20), chevet('rez__chevet_2',18.71), lustre(),
    douche(), vasque(), secheServiettes(), wcSdb(root), plafonnier('rez__plafonnier_sdb',12.40,-25.60), globeWC()];
}
