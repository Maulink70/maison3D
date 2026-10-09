// Salon du rez, compléments d'après les photos (canapé, tapis et bibliothèque sont dans le modèle ; le buffet est refait ici)
import * as THREE from 'three';
import {MAT, boite, cylindre, sphere, groupe} from './formes.js';

// Meuble TV bas, crème, devant la partie fixe de la baie (mur sud, face intérieure z = -14,34)
function meubleTV(){
  const g=groupe('rez__meuble_tv'), x0=16.10, x1=18.10, z1=-14.37, z0=z1-0.45;
  boite(g,x0,x1,0.05,0.45,z0,z1,MAT.creme);
  boite(g,x0+0.04,x1-0.04,0,0.05,z0+0.04,z1-0.04,MAT.cremeFonce);
  const w=(x1-x0)/3; for(let i=0;i<3;i++) boite(g,x0+i*w+0.004,x0+(i+1)*w-0.004,0.07,0.43,z0-0.015,z0,MAT.creme,true);
  return g;
}
function television(){
  const g=groupe('rez__tv'), cx=17.10, z=-14.60;
  boite(g,cx-0.62,cx+0.62,0.53,1.25,z-0.025,z+0.025,MAT.noir);
  boite(g,cx-0.60,cx+0.60,0.55,1.23,z-0.027,z-0.025,MAT.verreNoir);
  boite(g,cx-0.04,cx+0.04,0.45,0.53,z-0.02,z+0.02,MAT.inox); boite(g,cx-0.20,cx+0.20,0.45,0.46,z-0.12,z+0.10,MAT.inox);   // pied en aluminium
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
// Grande plante près de la baie, côté porte coulissante : aloe vera dans un gros pot blanc (précisé par Mauro),
// rosette de feuilles charnues bleu-vert, les extérieures longues et couchées, celles du cœur courtes et dressées
function grandePlante(){
  const g=groupe('rez__grande_plante'), x=14.95, z=-15.12, hPot=0.42, n=17;
  cylindre(g,x,0,hPot,z,0.19,MAT.potBlanc,0.23,28);
  cylindre(g,x,hPot-0.04,hPot-0.02,z,0.215,MAT.terre,0.215,28);
  for(let i=0;i<n;i++){
    const t=i/(n-1), az=i*2.399, inc=0.9-0.75*t, long=1.3*(0.6-0.12*t), larg=1.3*(0.085-0.03*t), r=0.06*(1-t);   // 30 % plus grande (Mauro)
    feuilleAloe(g,x+Math.sin(az)*r,hPot-0.03,z+Math.cos(az)*r,az,inc,long,larg,i%4?MAT.aloe:MAT.aloeClair);
  }
  return g;
}
// Feuille d'aloe : deux tronçons de section triangulaire aplatie, la pointe plus inclinée que la base (feuille arquée)
function feuilleAloe(g,x,y,z,az,inc,long,larg,mat){
  const base=new THREE.Vector3(x,y,z);
  for(const [l,r0,r1,i] of [[long*0.55,larg,larg*0.65,inc],[long*0.45,larg*0.65,0.004,Math.min(1.45,inc+0.35)]]){
    const d=new THREE.Vector3(Math.sin(i)*Math.sin(az),Math.cos(i),Math.sin(i)*Math.cos(az));
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,l,3,1),mat);
    m.rotation.set(i,az,0,'YXZ'); m.scale.set(1,1,0.6); m.position.copy(base).addScaledVector(d,l/2);
    m.userData.fusion=true; g.add(m); base.addScaledVector(d,l*0.97);
  }
}
// Plante posée sur le caisson bas de la bibliothèque (côté salon) : plante à feuilles (précisé par Mauro)
function planteBibliotheque(){
  const g=groupe('rez__plante_bibliotheque'), x=14.18, y0=1.19, z=-17.85, hPot=0.18;
  cylindre(g,x,y0,y0+hPot,z,0.088,MAT.potBordeaux,0.11);
  for(let i=0;i<22;i++){
    const az=i*2.399, t=(i%7)/6, h=0.12+0.30*((i*5)%11)/10, d=0.04+0.10*t;
    // tige, puis feuille ovale inclinée vers l'extérieur (feuilles en deçà du muret de l'escalier)
    const tige=new THREE.Vector3(x+Math.sin(az)*d*0.6,y0+hPot+h,z+Math.cos(az)*d*0.6);
    const s=new THREE.Mesh(new THREE.CylinderGeometry(0.003,0.004,1,4),MAT.feuille);
    const pied=new THREE.Vector3(x,y0+hPot-0.01,z), v=tige.clone().sub(pied);
    s.scale.y=v.length(); s.position.copy(pied).addScaledVector(v,0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());
    s.userData.fusion=true; g.add(s);
    const f=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),i%3?MAT.feuille:MAT.feuilleClaire);
    const lg=0.075+0.03*t; f.scale.set(lg*0.45,0.008,lg); f.rotation.set(-0.25-0.5*t,az,0,'YXZ');
    f.position.set(tige.x+Math.sin(az)*lg*0.8,tige.y+0.01,tige.z+Math.cos(az)*lg*0.8); f.userData.fusion=true; g.add(f);
  }
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

// Buffet bas laqué bordeaux et crème, contre le mur est (refait le 9 octobre 2026 d'après la photo de Mauro : une face
// crème du modèle doublait la façade, « couleurs à double en haut à droite », et les façades ne suivaient pas la photo).
// Vu de face (dos au mur x = 19,44, de gauche à droite = de z -21,22 à -19,42) : en haut, abattant crème sur 71 % de la
// largeur puis deux tiroirs bordeaux ; en bas, deux tiroirs bordeaux sur 40 % puis abattant crème ; dessus et côtés
// bordeaux, façades en applique de 19 mm, joints de 3 mm, poignées alu en barre près du haut de chaque façade, pieds luge
// chromés. Emprise et hauteur du modèle (1,80 × 0,57 m, 92,5 cm).
export function construireBuffet(bordeaux,creme){
  const g=new THREE.Group(), xf=18.868, xc=18.887, xd=19.438, za=-21.224, zb=-19.424, y0=0.08, yh=0.90, yt=0.925, L=zb-za, j=0.0015;
  boite(g,xc,xd,y0,yh,za,zb,bordeaux); boite(g,xf,xd,yh,yt,za,zb,bordeaux);                 // caisson, dessus
  const ym=(y0+yh)/2, poignee=(z,y)=>{ boite(g,xf-0.022,xf-0.006,y-0.008,y+0.008,z-0.08,z+0.08,MAT.inox);   // barre
    for(const k of [-1,1]) boite(g,xf-0.022,xf,y-0.006,y+0.006,z+k*0.07-0.006,z+k*0.07+0.006,MAT.inox); };
  const facade=(z0,z1,ya,yb,mat)=>{ boite(g,xf,xc,ya+j,yb-j,z0+j,z1-j,mat); poignee((z0+z1)/2,yb-0.045); };
  const zh=za+0.71*L, zbas=za+0.40*L, yq=(ym+yh)/2, yr=(y0+ym)/2;
  facade(za,zh,ym,yh,creme); facade(zh,zb,yq,yh,bordeaux); facade(zh,zb,ym,yq,bordeaux);          // rangée du haut
  facade(za,zbas,yr,ym,bordeaux); facade(za,zbas,y0,yr,bordeaux); facade(zbas,zb,y0,ym,creme);    // rangée du bas
  for(const z of [za+0.10,zb-0.10]){                                                            // pieds luge
    boite(g,xf+0.03,xd-0.03,0,0.012,z-0.02,z+0.02,MAT.chrome);
    for(const x of [xf+0.03,xd-0.042]) boite(g,x,x+0.012,0,y0,z-0.02,z+0.02,MAT.chrome); }
  return g;
}

export function construireSalon(){
  return [meubleTV(),television(),tableBasse(),grandePlante(),planteBibliotheque(),lampadaire(),lampeBuffet()];
}
