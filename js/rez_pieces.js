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
// Porte blanche du réduit sous l'escalier, à côté de la porte d'entrée : chambranle ici, battant ouvrable dans portes.js
function porteReduit(){
  const g=groupe('rez__porte_reduit'), z0=-21.135, z1=-21.10;
  boite(g,12.87,12.93,0,2.10,z0,z1,MAT.blanc); boite(g,13.70,13.766,0,2.10,z0,z1,MAT.blanc); boite(g,12.87,13.766,2.04,2.10,z0,z1,MAT.blanc);
  return g;
}
// Dans le réduit (x 12,87 → 13,77, du mur z = -21,03 vers le nord, plafond rampant) : aspirateur traîneau contre le
// mur ouest, près de la porte, et 3 sacs de tri (emballages, papier, verre) au fond
const tissu=c=>new THREE.MeshStandardMaterial({color:c,roughness:0.85});
function aspirateur(){
  const g=groupe('rez__aspirateur'), rouge=new THREE.MeshStandardMaterial({color:0x8e1f27,roughness:0.4});
  boite(g,12.92,13.20,0.05,0.20,-20.96,-20.58,rouge); boite(g,12.94,13.18,0.20,0.25,-20.90,-20.62,MAT.sombre);
  for(const [x,z,r] of [[12.915,-20.66,0.07],[13.205,-20.66,0.07],[13.06,-20.92,0.03]]){ const m=cylindre(g,x,0,0.03,z,r,MAT.noir); m.rotation.z=Math.PI/2; m.position.y=r; }
  cylindre(g,12.95,0.07,0.92,-20.99,0.017,MAT.inox);                                  // tube debout dans l'angle
  boite(g,12.90,13.20,0,0.05,-21.02,-20.97,MAT.sombre);                               // brosse au sol
  const tuyau=new THREE.CatmullRomCurve3([[13.06,0.18,-20.96],[13.08,0.35,-21.0],[13.02,0.75,-21.0],[12.97,0.92,-20.99]].map(p=>new THREE.Vector3(...p)));
  const t=new THREE.Mesh(new THREE.TubeGeometry(tuyau,16,0.018,8),MAT.sombre); t.userData.fusion=true; g.add(t);
  return g;
}
function sacsTri(){
  const g=groupe('rez__sacs_tri'), z0=-20.02, z1=-19.72;
  [0xd9ae2b,0x2f5f9e,0x3f7f3a].forEach((c,i)=>{
    const x0=12.89+i*0.29, x1=x0+0.28, m=tissu(c);
    boite(g,x0,x1,0,0.42,z0,z1,m);                                                              // sac ouvert : fond plein,
    boite(g,x0,x0+0.012,0.42,0.52,z0,z1,m); boite(g,x1-0.012,x1,0.42,0.52,z0,z1,m);            // bords relevés
    boite(g,x0,x1,0.42,0.52,z0,z0+0.012,m); boite(g,x0,x1,0.42,0.52,z1-0.012,z1,m);
    boite(g,x0+0.012,x1-0.012,0.42,0.47,z0+0.012,z1-0.012,MAT.sombre);                         // contenu
    for(const z of [z0-0.008,z1+0.008]) boite(g,x0+0.08,x1-0.08,0.62,0.645,z-0.004,z+0.004,m); // anses
    for(const z of [z0-0.008,z1+0.008]) for(const x of [x0+0.08,x1-0.08]) boite(g,x-0.012,x+0.012,0.50,0.645,z-0.004,z+0.004,m);
  });
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
  // colonne contre le mur en plaquettes, au début de la pente du toit ; le pommeau est tourné vers le lavabo (ouest)
  const xc=14.70, zc=-27.12;
  cylindre(g,xc,0.90,2.02,zc,0.012,MAT.chrome);
  boite(g,xc-0.06,xc,1.08,1.14,zc-0.07,zc+0.07,MAT.chrome);                             // mitigeur thermostatique
  boite(g,xc-0.30,xc,2.00,2.02,zc-0.005,zc+0.005,MAT.chrome); cylindre(g,xc-0.32,1.99,2.01,zc,0.12,MAT.chrome);
  return g;
}
// Meuble vasque en chêne suspendu contre le mur ouest (x = 11,31), de la baignoire jusqu'au mur sud ;
// grande vasque blanche, miroir et réglette centrés sur le meuble
function vasque(){
  const g=groupe('rez__vasque_sdb'), x0=11.31, z0=-26.78, z1=-25.01, xf=11.81, zm=(z0+z1)/2;
  boite(g,x0,xf-0.018,0.40,0.80,z0,z1,MAT.chene);
  for(const [y0,y1] of [[0.40,0.60],[0.60,0.80]]) boite(g,xf-0.018,xf,y0+0.004,y1-0.004,z0+0.004,z1-0.004,MAT.chene,'sombre');
  const v0=11.33, v1=11.80, w0=zm-0.425, w1=zm+0.425, y0=0.80, y1=0.95, e=0.02;
  boite(g,v0,v1,y0,y0+0.04,w0,w1,MAT.ceramique); boite(g,v0,v0+0.09,y0,y1,w0,w1,MAT.ceramique); boite(g,v1-e,v1,y0,y1,w0,w1,MAT.ceramique);
  boite(g,v0,v1,y0,y1,w0,w0+e,MAT.ceramique); boite(g,v0,v1,y0,y1,w1-e,w1,MAT.ceramique);
  cylindre(g,11.37,y1,y1+0.17,zm,0.014,MAT.chrome); boite(g,11.36,11.47,y1+0.14,y1+0.16,zm-0.01,zm+0.01,MAT.chrome);
  boite(g,x0,x0+0.006,1.05,1.75,zm-0.475,zm+0.475,new THREE.MeshStandardMaterial({color:0xdde6ea,roughness:0.06}));
  boite(g,x0,x0+0.09,1.80,1.84,zm-0.315,zm+0.315,MAT.chrome); boite(g,x0+0.06,x0+0.09,1.795,1.80,zm-0.295,zm+0.295,MAT.lumiere);
  return g;
}
// Sèche-serviettes chromé à gauche du miroir, sur le mur sud (z = -25,01), tourné vers la baignoire
function secheServiettes(){
  const g=groupe('rez__seche_serviettes'), x0=11.45, x1=11.93, z=-25.06;
  for(const x of [x0,x1]) cylindre(g,x,0.95,1.85,z,0.014,MAT.chrome);
  for(let y=1.00;y<1.85;y+=0.12) boite(g,x0,x1,y-0.01,y+0.01,z-0.01,z+0.01,MAT.chrome);
  for(const x of [x0,x1]) for(const y of [1.05,1.75]) boite(g,x-0.008,x+0.008,y-0.008,y+0.008,z,-25.008,MAT.chrome);
  return g;
}
// WC suspendu dans le renfoncement du mur sud (x 12,19 → 13,00, fond à z = -24,28), adossé à un coffrage
// à mi-hauteur en plaquettes grises (seulement dans le renfoncement) ; copie du WC de l'étage
function wcSdb(root){
  const g=groupe('rez__wc_sdb'), x0=12.188, x1=12.998, zFond=-24.278, zF=-24.48, xc=(x0+x1)/2;
  boite(g,x0,x1,0,1.15,zF,zFond,MAT.carrelageGris); boite(g,x0,x1,1.15,1.17,zF-0.02,zFond,MAT.carrelageGris);
  const cuvette=root.getObjectByName('etage__wc'), plaque=root.getObjectByName('etage__bouton_wc_douche');
  // à l'étage le WC est adossé au mur z = -21,39 et regarde vers -z, comme ici (adossé au coffrage z = -24,48)
  if(cuvette) g.add(copier(cuvette,new THREE.Vector3(17.179,2.74,-21.39),new THREE.Vector3(xc,0,zF),0));
  if(plaque) g.add(copier(plaque,new THREE.Vector3(17.175,2.74,-21.423),new THREE.Vector3(xc,0,zF),0));
  return g;
}

export function construirePieces(root){
  return [commode(), porteEntree(), porteReduit(), aspirateur(), sacsTri(), plafonnier('rez__plafonnier_entree',12.40,-21.85), plafonnier('rez__plafonnier_degagement',13.95,-23.70),
    lit(), chevet('rez__chevet_1',16.20), chevet('rez__chevet_2',18.71), lustre(),
    douche(), vasque(), secheServiettes(), wcSdb(root), plafonnier('rez__plafonnier_sdb',12.40,-25.60), globeWC()];
}
