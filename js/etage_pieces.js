// Étage meublé d'après les photos de Mauro : mezzanine (coin nuit, coin bureau), dressing, chambre, douche + WC.
// Coordonnées monde en mètres ; F = plancher de l'étage. Pan nord du toit : z = -27,03 + h / 2 (h au-dessus du plancher).
import * as THREE from 'three';
import {ETAGE_FLOOR as F} from './config.js';
import {MAT, boite, cylindre, sphere, groupe, lignes, fusionner} from './formes.js';
import {textureDe} from './matieres.js';

const std=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:0.5,...o});
const M={
  hetre:std(0xd5a46e,{roughness:0.6}), laque:std(0xf4f3f0,{roughness:0.18}), aubergine:std(0x3b2232,{roughness:0.25}),
  cuirNoir:std(0x1d1d1f,{roughness:0.45}), gris:std(0x4b4f55,{roughness:0.9}), metalGris:std(0x9a9ea3,{metalness:0.3,roughness:0.35}),
  miroir:std(0xdfe6ea,{roughness:0.05}), rougeAssise:std(0x8c2333,{roughness:0.6}), tissuNoir:std(0x1d1d1f,{roughness:0.9}),
  boitier:new THREE.MeshStandardMaterial({color:0xb9c6cf,roughness:0.05,transparent:true,opacity:0.35,depthWrite:false})
};
for(const [k,m] of Object.entries(M)) m.name='etage_'+k;
function texture(dessin,l=256,h=256){
  const c=document.createElement('canvas'); c.width=l; c.height=h; dessin(c.getContext('2d'),l,h);
  const t=textureDe(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
// Couvre-lit en patchwork rouge et rose du lit d'appoint
const patchwork=std(0xffffff,{roughness:0.9,map:texture((x,l,h)=>{
  const c=['#b8283c','#d9566b','#8f1f30','#e48a8f','#3e5a8a','#c7413a']; let s=3;
  for(let i=0;i<6;i++) for(let j=0;j<6;j++){ s=(s*16807)%2147483647; x.fillStyle=c[s%c.length]; x.fillRect(i*l/6,j*h/6,l/6,h/6); }
})});
// Rideau de douche blanc moucheté de bleu (photo « Douche + WC 1 ») : petites taches bleu foncé et bleu clair en grappes,
// un motif = 25 cm de tissu, répété
const rideau=new THREE.MeshStandardMaterial({name:'etage_rideau',roughness:0.85,side:THREE.DoubleSide,map:texture((x,l,h)=>{
  x.fillStyle='#f3f5f8'; x.fillRect(0,0,l,h); let s=11; const r=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let k=0;k<150;k++){ const cx=r()*l, cy=r()*h, n=12+r()*30;
    for(let i=0;i<n;i++){ const a=r()*Math.PI*2, d=r()*r()*22, px=cx+Math.cos(a)*d, py=cy+Math.sin(a)*d;
      x.fillStyle=r()<0.45?'#2c4f93':'#8ea9d6'; const w=1+r()*2.5, t=1+r()*2;
      for(const [ox,oy] of [[0,0],[-l,0],[l,0],[0,-h],[0,h]]) x.fillRect(px+ox,py+oy,w,t); } }
})});
rideau.map.wrapS=rideau.map.wrapT=THREE.RepeatWrapping; rideau.map.needsUpdate=true;

// Sous-groupe tourné autour de son centre (meubles posés en biais) : on dessine en coordonnées locales, face vers +z
function pivot(g,x,z,rot){ const p=new THREE.Group(); p.position.set(x,0,z); p.rotation.y=rot; g.add(p); return p; }
function poignee(g,x0,x1,y0,y1,z0,z1){ boite(g,x0,x1,y0,y1,z0,z1,MAT.chrome); }
// Applique murale : platine blanche + diffuseur lumineux, posée contre un mur (axe 'x' : mur à x constant)
function applique(nom,mur,axe,c,y,sens,l=0.30,h=0.16){
  const g=groupe(nom), e=0.07*sens;
  if(axe==='x'){ boite(g,Math.min(mur,mur+e),Math.max(mur,mur+e),y,y+h,c-l/2,c+l/2,MAT.blanc); boite(g,Math.min(mur+e,mur+e*1.15),Math.max(mur+e,mur+e*1.15),y+0.01,y+h-0.01,c-l/2+0.01,c+l/2-0.01,MAT.lumiere); }
  else { boite(g,c-l/2,c+l/2,y,y+h,Math.min(mur,mur+e),Math.max(mur,mur+e),MAT.blanc); boite(g,c-l/2+0.01,c+l/2-0.01,y+0.01,y+h-0.01,Math.min(mur+e,mur+e*1.15),Math.max(mur+e,mur+e*1.15),MAT.lumiere); }
  return g;
}

// ---------- Mezzanine : coin nuit sous le Velux ----------
// Lit d'appoint 90 × 200, tête sous la pente nord, à gauche du Velux, couvre-lit patchwork ; 93 × 224 cm hors tout,
// 58,5 cm de haut (mesuré par Mauro le 12 octobre 2026)
function litMezzanine(){
  const g=groupe('etage__lit_mezzanine'), x0=14.15, x1=15.08, z0=-26.75, z1=-24.51;
  boite(g,x0,x1,F,F+0.28,z0,z1,MAT.blanc);
  boite(g,x0+0.02,x1-0.02,F+0.28,F+0.46,z0+0.02,z1-0.02,MAT.drap);
  boite(g,x0-0.02,x1+0.02,F+0.30,F+0.49,z0+0.40,z1+0.02,patchwork);
  boite(g,x0+0.10,x1-0.10,F+0.46,F+0.585,z0+0.05,z0+0.38,MAT.drap);
  return g;
}
// Armoire en hêtre à deux portes, contre le mur est, portes vers l'ouest ; 150 × 59 × 220 cm, à 40 cm du pan nord du toit
// (mesurés par Mauro le 12 octobre 2026 ; écart pris en haut de l'armoire, là où il est le plus petit : z = -27,03 + h / 2)
function armoireMezzanine(){
  const g=groupe('etage__armoire_mezzanine'), h=2.20, x0=16.11, x1=16.70, z0=-27.03+h/2+0.40, z1=z0+1.50;
  boite(g,x0+0.02,x1,F,F+h,z0,z1,M.hetre);
  for(const [a,b] of [[z0,(z0+z1)/2],[(z0+z1)/2,z1]]) boite(g,x0,x0+0.02,F+0.06,F+h-0.02,a+0.003,b-0.003,M.hetre,'sombre');
  for(const z of [(z0+z1)/2-0.05,(z0+z1)/2+0.05]) poignee(g,x0-0.02,x0,F+0.95,F+1.15,z-0.008,z+0.008);
  return g;
}
// Fauteuil relax en cuir noir sur pied pivotant, devant l'armoire (entre elle et le lit d'appoint), tourné vers le sud :
// l'armoire mesurée (1,50 m) prend la place où il était, et il ne doit pas barrer le passage vers la porte de la chambre
function fauteuil(){
  const g=groupe('etage__fauteuil_mezzanine'), p=pivot(g,15.595,-24.70,0);
  cylindre(p,0,F,F+0.04,0,0.30,MAT.chrome); cylindre(p,0,F+0.04,F+0.30,0,0.04,MAT.chrome);   // pied en métal
  boite(p,-0.33,0.33,F+0.30,F+0.50,-0.30,0.34,M.cuirNoir);
  for(const s of [-1,1]) boite(p,s>0?0.31:-0.43,s>0?0.43:-0.31,F+0.30,F+0.64,-0.32,0.22,M.cuirNoir);
  const dos=boite(p,-0.33,0.33,F+0.48,F+1.12,-0.44,-0.24,M.cuirNoir); dos.rotation.x=-0.22;
  boite(p,-0.24,0.24,F+0.95,F+1.10,-0.40,-0.30,M.cuirNoir);
  return g;
}
// Commode blanche laquée contre le mur ouest, après le pied du lit : une porte et une colonne de cinq tiroirs ;
// 130 × 43 cm (mesurée par Mauro le 12 octobre 2026)
function commodeMezzanine(){
  const g=groupe('etage__commode_mezzanine'), x0=14.10, x1=14.53, z0=-24.41, z1=-23.11, h=0.90, zm=(z0+z1)/2;   // 10 cm après le pied du lit (Mauro)
  boite(g,x0,x1-0.018,F+0.02,F+h,z0,z1,M.laque); boite(g,x0,x1,F,F+0.02,z0+0.02,z1-0.02,M.laque);   // socle blanc
  boite(g,x1-0.018,x1,F+0.03,F+h-0.01,zm+0.003,z1-0.004,M.laque,true); poignee(g,x1,x1+0.02,F+0.45,F+0.65,zm+0.05,zm+0.065);
  for(let k=0;k<5;k++){ const a=F+0.03+k*0.172, b=a+0.172;
    boite(g,x1-0.018,x1,a+0.003,b-0.003,z0+0.004,zm-0.003,M.laque,true); poignee(g,x1,x1+0.02,b-0.05,b-0.035,(z0+zm)/2-0.08,(z0+zm)/2+0.08); }
  return g;
}

// ---------- Mezzanine : coin bureau (aile ouest, au-dessus de l'entrée) ----------
// Bureau haut à plateau blanc sur deux pieds colonnes, contre le mur ouest et le mur sud (photo calée) ; son écran est un
// élément à part (Mauro, 11 octobre 2026 : pouvoir poser autre chose sur le bureau)
const BUREAU_MEZZ={x0:11.47, x1:12.47, z0:-22.12, z1:-21.12, h:0.98};   // plateau 100 × 100 cm (mesuré par Mauro)
function bureauMezzanine(){
  const {x0,x1,z0,z1,h}=BUREAU_MEZZ, g=groupe('etage__bureau_mezzanine');
  boite(g,x0,x1,F+h,F+h+0.03,z0,z1,MAT.blanc);
  for(const z of [z0+0.12,z1-0.12]){ cylindre(g,(x0+x1)/2,F,F+h,z,0.03,M.metalGris); boite(g,x0+0.03,x1-0.03,F,F+0.03,z-0.03,z+0.03,M.metalGris); }
  return g;
}
function ecranMezzanine(){
  const {z0,z1,h}=BUREAU_MEZZ, g=groupe('etage__ecran_mezzanine'), zc=(z0+z1)/2;
  boite(g,11.58,11.70,F+h+0.03,F+h+0.04,zc-0.10,zc+0.10,MAT.noir); boite(g,11.60,11.62,F+h+0.04,F+h+0.16,zc-0.02,zc+0.02,MAT.noir);
  boite(g,11.62,11.65,F+h+0.12,F+h+0.46,zc-0.28,zc+0.28,MAT.noir); boite(g,11.65,11.651,F+h+0.135,F+h+0.445,zc-0.265,zc+0.265,MAT.verreNoir);
  return g;
}
// Tabourets hauts devant le bureau : coque blanche, et assise noire à coussin rouge
function tabouret(nom,x,z,coque,assise){
  const g=groupe(nom);
  cylindre(g,x,F,F+0.02,z,0.21,MAT.chrome); cylindre(g,x,F+0.02,F+0.66,z,0.025,MAT.chrome);
  const repose=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.01,8,32),MAT.chrome); repose.rotation.x=Math.PI/2; repose.position.set(x,F+0.32,z); repose.userData.fusion=true; g.add(repose);
  cylindre(g,x,F+0.66,F+0.74,z,0.21,coque); cylindre(g,x,F+0.74,F+0.77,z,0.19,assise);
  boite(g,x+0.10,x+0.17,F+0.74,F+1.02,z-0.17,z+0.17,coque);               // dossier côté salle (est)
  return g;
}

// ---------- Dressing ----------
// Armoires laquées blanches en L dans l'angle sud-ouest : 2 portes le long du mur sud, 5 portes le long du
// mur ouest dont 2 à miroir ; hauteur 2,25 m (le plafond descend à 2,34 m côté porte). Grand côté 2,70 m depuis l'angle,
// profondeur 64 cm (mesurés par Mauro le 12 octobre 2026)
function armoiresDressing(){
  const g=groupe('etage__armoires_dressing'), h=2.25, p=0.64, xo=11.31, zs=-22.83, zn=zs-2.70;
  boite(g,xo,xo+p-0.02,F,F+h,zn,zs,M.laque);                          // corps le long du mur ouest (angle compris)
  boite(g,xo+p-0.02,12.90,F,F+h,zs-p+0.02,zs,M.laque);                // corps le long du mur sud
  const xf=xo+p, l=(zs-p-zn)/5, portes=[M.laque,M.miroir,M.miroir,M.laque,M.laque].map((m,i)=>[zs-p-i*l,zs-p-(i+1)*l,m]);
  for(const [a,b,m] of portes){ boite(g,xf-0.02,xf,F+0.02,F+h-0.01,b+0.003,a-0.003,m,true); poignee(g,xf,xf+0.02,F+1.00,F+1.25,a-0.06,a-0.045); }
  const zf=zs-p, xm=(xf+12.90)/2;
  for(const [a,b] of [[xf,xm],[xm,12.90]]){ boite(g,a+0.003,b-0.003,F+0.02,F+h-0.01,zf,zf+0.02,M.laque,true); poignee(g,b-0.06,b-0.045,F+1.00,F+1.25,zf-0.02,zf); }
  return g;
}
// Buffet bas laqué aubergine contre le mur est : 2 × 4 tiroirs à bandeaux alu, sur petits pieds ; 160 × 41,5 × 90 cm
// (mesuré par Mauro le 12 octobre 2026), à 1,54 m du mur de la porte du dressing (z = -22,83)
function buffetDressing(){
  const g=groupe('etage__buffet_dressing'), x0=13.555, x1=13.97, z1=-22.83-1.54, z0=z1-1.60, y0=F+0.06, y1=F+0.90, zm=(z0+z1)/2, hd=(y1-y0)/4;
  boite(g,x0+0.02,x1,y0,y1,z0,z1,M.aubergine);
  for(const [a,b] of [[z0,zm],[zm,z1]]) for(let k=0;k<4;k++){ const ya=y0+k*hd;
    boite(g,x0,x0+0.02,ya+0.004,ya+hd-0.004,a+0.004,b-0.004,M.aubergine); boite(g,x0-0.005,x0,ya+hd-0.03,ya+hd-0.015,a+0.03,b-0.03,MAT.chrome); }
  for(const [x,z] of [[x0+0.05,z0+0.05],[x1-0.05,z0+0.05],[x0+0.05,z1-0.05],[x1-0.05,z1-0.05]]) cylindre(g,x,F,y0,z,0.015,MAT.chrome);
  return g;
}
// Portant à vêtements chromé devant le Velux
function portant(){
  const g=groupe('etage__portant_dressing'), z=-26.05;
  for(const x of [12.80,13.40]){ cylindre(g,x,F+0.08,F+1.60,z,0.012,MAT.chrome); boite(g,x-0.012,x+0.012,F+0.06,F+0.08,z-0.25,z+0.25,MAT.chrome);
    for(const dz of [-0.24,0.24]) sphere(g,x,F+0.03,z+dz,0.03,MAT.sombre); }
  boite(g,12.80,13.40,F+1.59,F+1.61,z-0.01,z+0.01,MAT.chrome);
  return g;
}

// ---------- Chambre de l'étage ----------
// Lit 160 × 200 sur cadre bas en hêtre, tête contre la pente nord, couette gris anthracite ; 166 × 211 cm hors tout, 50 cm
// de haut (mesuré par Mauro le 12 octobre 2026), même centre
function litChambre(){
  const g=new THREE.Group(), x0=17.32, x1=18.98, z0=-26.75, z1=-24.64;
  boite(g,x0,x1,F+0.06,F+0.26,z0,z1,M.hetre);
  for(const [x,z] of [[x0+0.05,z0+0.05],[x1-0.05,z0+0.05],[x0+0.05,z1-0.05],[x1-0.05,z1-0.05]]) boite(g,x-0.03,x+0.03,F,F+0.06,z-0.03,z+0.03,M.hetre);
  boite(g,x0+0.03,x1-0.03,F+0.26,F+0.46,z0+0.03,z1-0.03,MAT.drap);
  boite(g,x0-0.01,x1+0.01,F+0.29,F+0.50,z0+0.50,z1+0.01,M.gris);
  for(const [a,b] of [[x0+0.08,x0+0.74],[x1-0.74,x1-0.08]]) boite(g,a,b,F+0.46,F+0.58,z0+0.06,z0+0.42,MAT.drap);
  return g;
}
// Deux tables de chevet identiques en mélaminé brun clair, de part et d'autre du lit (à droite du lit, Mauro précise le
// 9 octobre 2026 que le meuble blanc pris pour un climatiseur mobile est le même chevet que celui de gauche)
function chevetChambre(nom,x0){
  const g=groupe(nom);
  boite(g,x0,x0+0.435,F,F+0.35,-26.55,-26.15,MAT.boisBrunClair,true);   // mélaminé brun clair, 43,5 × 35 cm (Mauro)
  return g;
}
// Étagère ouverte en hêtre contre le mur ouest, à côté de la porte ; 50 cm de large, 1,46 m de haut (mesurée par Mauro le
// 12 octobre 2026), à 27 cm du cadre de la porte (ouverture z = -23,86)
function etagereChambre(){
  const g=groupe('etage__etagere_chambre'), x0=16.78, x1=17.13, z1=-23.86-0.27, z0=z1-0.50, h=1.46, e=0.02;
  boite(g,x0,x0+e,F,F+h,z0,z1,M.hetre);
  for(const z of [z0,z1-e]) boite(g,x0,x1,F,F+h,z,z+e,M.hetre);
  for(const y of [0,0.365,0.73,1.095,h-e]) boite(g,x0,x1,F+y,F+y+e,z0+e,z1-e,M.hetre);
  // porte vitrée devant les deux rangées du bas (précisé par Mauro) : cadre en hêtre, vitre, bouton chromé
  const yb=F+0.005, yh=F+0.745, c=0.045;
  for(const [a,b] of [[z0,z0+c],[z1-c,z1]]) boite(g,x1,x1+e,yb,yh,a,b,M.hetre);
  for(const [a,b] of [[yb,yb+c],[yh-c,yh]]) boite(g,x1,x1+e,a,b,z0+c,z1-c,M.hetre);
  boite(g,x1+0.008,x1+0.012,yb+c,yh-c,z0+c,z1-c,MAT.verre);
  sphere(g,x1+e+0.012,F+0.375,z1-0.075,0.012,MAT.chrome,10);
  return g;
}
// Écran et tour d'ordinateur sur le bureau noir (plateau du modèle à 0,77 m) : deux éléments à part
function ecranChambre(){
  const g=groupe('etage__ecran_chambre'), y=F+0.77, zc=-23.69;
  boite(g,19.08,19.26,y,y+0.01,zc-0.12,zc+0.12,MAT.noir); boite(g,19.15,19.18,y+0.01,y+0.14,zc-0.03,zc+0.03,MAT.noir);
  boite(g,19.10,19.14,y+0.10,y+0.46,zc-0.31,zc+0.31,MAT.noir); boite(g,19.099,19.10,y+0.115,y+0.445,zc-0.295,zc+0.295,MAT.verreNoir);
  return g;
}
function ordinateurChambre(){
  const g=groupe('etage__ordinateur_chambre'), y=F+0.77;
  boite(g,18.86,19.30,y,y+0.48,-23.20,-22.98,M.boitier);                                    // boîtier transparent
  boite(g,18.90,19.26,y+0.03,y+0.45,-23.17,-23.01,MAT.sombre); boite(g,18.95,19.20,y+0.20,y+0.34,-23.16,-23.02,MAT.chrome);   // carte et ventilateur
  return g;
}
// Chaise de bureau noire à piètement étoile, tournée vers le bureau (est)
function chaiseBureau(){
  const g=groupe('etage__chaise_bureau'), p=pivot(g,18.30,-23.65,Math.PI/2);
  for(let k=0;k<5;k++){ const a=k*Math.PI*2/5, b=boite(p,-0.02,0.02,F+0.04,F+0.07,0,0.32,MAT.noir); b.position.set(Math.sin(a)*0.16,F+0.055,Math.cos(a)*0.16); b.rotation.y=a;
    sphere(p,Math.sin(a)*0.31,F+0.03,Math.cos(a)*0.31,0.03,MAT.noir); }
  cylindre(p,0,F+0.07,F+0.45,0,0.03,MAT.chrome);
  boite(p,-0.26,0.26,F+0.45,F+0.55,-0.24,0.26,M.tissuNoir);
  const dos=boite(p,-0.25,0.25,F+0.55,F+1.30,-0.30,-0.22,M.tissuNoir); dos.rotation.x=-0.10;
  for(const s of [-1,1]){ boite(p,s*0.28-0.03,s*0.28+0.03,F+0.55,F+0.75,-0.05,-0.01,MAT.noir); boite(p,s*0.28-0.04,s*0.28+0.04,F+0.75,F+0.78,-0.15,0.15,MAT.noir); }
  return g;
}

// ---------- Douche + WC ----------
// Meuble vasque d'après la photo calée « Douche + WC 1 » (13 octobre 2026) : contre le mur sud, 54,5 cm le long du mur et
// 70 cm de profondeur (mesures de Mauro ; largeur et profondeur étaient inversées), caisson suspendu à deux tiroirs sans
// poignée sur la face nord, plateau en bois, grande vasque blanche posée devant, tablette derrière (savon, mouchoirs),
// mitigeur sur la plage arrière ; miroir sur le mur sud jusqu'à la vitre de la douche, réglette sous le plafond en pente
function vasqueDouche(){
  const g=groupe('etage__vasque_douche'), x0=17.725, x1=18.27, z0=-21.89, z1=-21.19, xm=(x0+x1)/2;
  boite(g,x0,x1,F+0.40,F+0.785,z0+0.02,z1,MAT.chene);                                   // caisson, de 40 à 78,5 cm
  boite(g,x0+0.003,x1-0.003,F+0.403,F+0.597,z0,z0+0.02,MAT.chene,'sombre');              // tiroir du bas
  boite(g,x0+0.003,x1-0.003,F+0.603,F+0.782,z0,z0+0.02,MAT.chene,'sombre');              // tiroir du haut
  boite(g,x0,x1,F+0.785,F+0.82,z0,z1,MAT.chene);                                          // plateau de 3,5 cm
  const v0=xm-0.25, v1=xm+0.25, w0=z0+0.02, w1=w0+0.47, y0=F+0.82, y1=F+0.97, e=0.015;   // vasque 50 × 47 × 15 cm
  boite(g,v0,v1,y0,y0+0.035,w0,w1,MAT.ceramique);
  boite(g,v0,v1,y0,y1,w0,w0+e,MAT.ceramique); boite(g,v0,v1,y0,y1,w1-0.09,w1,MAT.ceramique);
  boite(g,v0,v0+e,y0,y1,w0,w1,MAT.ceramique); boite(g,v1-e,v1,y0,y1,w0,w1,MAT.ceramique);
  cylindre(g,xm,y0+0.035,y0+0.04,w0+0.19,0.022,MAT.chrome);                             // bonde
  const zr=w1-0.045;                                                                      // mitigeur : corps, bec, manette
  cylindre(g,xm,y1,y1+0.17,zr,0.018,MAT.chrome);
  boite(g,xm-0.012,xm+0.012,y1+0.13,y1+0.155,zr-0.14,zr,MAT.chrome);
  boite(g,xm-0.006,xm+0.006,y1+0.17,y1+0.18,zr-0.01,zr+0.07,MAT.chrome);
  boite(g,17.62,18.55,F+0.92,F+1.74,z1-0.006,z1,M.miroir);                               // miroir (plafond à 1,90 m au mur)
  boite(g,17.70,18.47,F+1.79,F+1.83,z1-0.07,z1,MAT.chrome); boite(g,17.72,18.45,F+1.785,F+1.79,z1-0.06,z1-0.02,MAT.lumiere);
  return g;
}
// Rideau de douche (élément à part, modifiable) : tringle blanche le long de la face nord de la douche, de la vitre au mur
// est, embout rond côté vitre ; au repos, replié contre la vitre comme sur la photo. Il se tire jusqu'au mur du fond et se
// replie (toucher en Visite, bouton du panneau en Éditer) : le tissu s'étire depuis la vitre (échelle de son pivot, ce qui
// reste juste si sa matière change) et les anneaux s'écartent le long de la tringle
export const rideaux=[];
export const rideauDe=nom=>rideaux.find(r=>r.nom===nom);
export function basculerRideau(r){ r.cible=!r.cible; }
export function majRideaux(dt){ for(const r of rideaux){ const but=r.cible?1:0; if(r.t===but) continue;
  r.t+=Math.max(-1.6*dt,Math.min(1.6*dt,but-r.t)); r.poser(r.t); } }
function rideauDouche(){
  const g=groupe('etage__rideau_douche'), xv=18.60, xm=19.435, zr=-22.03, yt=F+2.00;
  const tige=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,xm-xv,12),MAT.blanc);
  tige.rotation.z=Math.PI/2; tige.position.set((xv+xm)/2,yt,zr); tige.userData.fusion=true; g.add(tige);
  const embout=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.016,24),MAT.blanc);
  embout.rotation.z=Math.PI/2; embout.position.set(xv+0.008,yt,zr); embout.userData.fusion=true; g.add(embout);
  const r={nom:'etage__rideau_douche', t:0, cible:false}, anneaux=[];
  for(let i=0;i<10;i++){ const a=new THREE.Mesh(new THREE.TorusGeometry(0.018,0.003,6,16),MAT.blanc);
    a.rotation.y=Math.PI/2; a.position.set(xv+0.035+i*0.015,yt-0.012,zr); a.userData.rideau=r; g.add(a); anneaux.push(a); }
  // tissu replié : 0,95 m de tissu serré sur 17 cm, plis de 3,5 à 5 cm, du dessous des anneaux au fond du bac
  const n=11, w0=0.17, haut=yt-0.03, bas=F+0.12, geo=new THREE.PlaneGeometry(1,1,n*8,12), p=geo.attributes.position, uv=geo.attributes.uv;
  for(let i=0;i<p.count;i++){ const u=p.getX(i)+0.5, v=p.getY(i)+0.5, amp=0.035+0.015*(1-v);
    p.setXYZ(i,u*w0,bas+v*(haut-bas),Math.sin(u*n*Math.PI)*amp+0.012*(1-v)*Math.sin(v*5));
    uv.setXY(i,u*0.95/0.25,v*(haut-bas)/0.25); }
  geo.computeVertexNormals();
  const pli=new THREE.Group(); pli.position.set(xv+0.03,0,zr); g.add(pli);
  const tissu=new THREE.Mesh(geo,rideau); tissu.userData.rideau=r; pli.add(tissu);
  const L=xm-0.01-(xv+0.03);                                                   // tiré : jusqu'au mur du fond
  r.poser=t=>{ pli.scale.set(1+t*(L/w0-1),1,1-0.45*t);
    anneaux.forEach((a,i)=>{ a.position.x=xv+0.035+i*(0.015+t*((L-0.02)/9-0.015)); }); };
  rideaux.push(r);
  return g;
}

export function construireEtage(root){
  rideaux.length=0;
  // lit de la chambre : le lit du modèle (orienté est-ouest, couvre-lit à motifs) est remplacé
  const lit=root.getObjectByName('etage__lit_chambre_etage');
  if(lit){ const vieux=[]; lit.traverse(o=>{ if(o.isMesh) vieux.push(o); }); for(const o of vieux) o.removeFromParent();
    const nouveau=fusionner(litChambre()); lit.updateMatrixWorld(true); lit.attach(nouveau); }
  // douche : la vitre côté lavabo est gardée ; le bloc « rideau » bleu pâle du modèle et sa barre (Material_376) sont retirés,
  // le rideau est un élément à part, avec sa tringle
  const douche=root.getObjectByName('etage__Douche_etage');
  if(douche){ const bloc=[]; douche.traverse(o=>{ if(o.isMesh&&(o.material.name==='Material_377'||o.material.name==='Material_376')) bloc.push(o); }); for(const o of bloc) o.removeFromParent(); }
  return [litMezzanine(), armoireMezzanine(), fauteuil(), commodeMezzanine(),
    bureauMezzanine(), ecranMezzanine(), tabouret('etage__tabouret_mezzanine_1',12.78,-21.45,MAT.blanc,MAT.blanc), tabouret('etage__tabouret_mezzanine_2',12.73,-22.25,MAT.blanc,MAT.blanc),
    applique('etage__spot_mezzanine_1',14.10,'x',-23.76,F+1.90,1,0.08,0.08), applique('etage__spot_mezzanine_2',16.70,'x',-23.95,F+1.90,-1,0.08,0.08),
    applique('etage__applique_bureau',-22.75,'z',11.85,F+1.70,1,0.20,0.20), applique('rez__applique_escalier',12.87,'x',-18.22,2.80,1,0.18,0.26),
    armoiresDressing(), buffetDressing(), portant(), applique('etage__applique_dressing',13.97,'x',-23.80,F+1.80,-1,0.32,0.18),
    chevetChambre('etage__chevet_chambre',16.85), chevetChambre('etage__chevet_chambre_2',19.00), etagereChambre(), ecranChambre(), ordinateurChambre(), chaiseBureau(), applique('etage__applique_chambre',19.44,'x',-23.75,F+1.95,-1,0.36,0.12),
    vasqueDouche(), rideauDouche()];
}
