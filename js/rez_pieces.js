// Entrée, chambre et salle de bain du rez, d'après les photos de Mauro
import * as THREE from 'three';
import {MAT, boite, cylindre, sphere, groupe, lignes, copier, prisme, enFlottants} from './formes.js';
import {texturesCarreauPierre} from './matieres.js';
import {couper} from './buanderie.js';
import {ENTREE, percer} from './corrections.js';
import {app} from './app.js';

// ---------- Entrée ----------
// Commode en érable contre le mur du WC (face z = -22,58), façade vers l'entrée : 2 petits tiroirs + 4 grands ;
// 96 cm de long, à 48,5 cm du mur ouest de l'entrée (mesurés par Mauro le 12 octobre 2026)
function commode(){
  const g=groupe('rez__commode'), x0=11.45+0.485, x1=x0+0.96, z0=-22.58, z1=-22.13;
  boite(g,x0,x1,0.04,0.85,z0,z1-0.018,MAT.erable);
  const f=(a,b,y0,y1)=>{ boite(g,a+0.003,b-0.003,y0+0.003,y1-0.003,z1-0.018,z1,MAT.erable,true); sphere(g,(a+b)/2,(y0+y1)/2,z1+0.012,0.011,MAT.chrome,10); };
  f(x0,(x0+x1)/2,0.68,0.84); f((x0+x1)/2,x1,0.68,0.84);
  for(let k=0;k<4;k++) f(x0,x1,0.05+k*0.1575,0.05+(k+1)*0.1575);
  for(const [x,z] of [[x0+0.04,z0+0.04],[x1-0.04,z0+0.04],[x0+0.04,z1-0.06],[x1-0.04,z1-0.06]]) boite(g,x-0.02,x+0.02,0,0.04,z-0.02,z+0.02,MAT.erable);
  return g;
}
// Porte d'entrée brun foncé, ouvrable vers l'entrée (battant dans portes.js ; le mur est percé dans corrections.js) :
// dormant blanc dans l'épaisseur du mur, chambranles des deux côtés, seuil en pierre
function porteEntree(){
  const g=groupe('rez__porte_entree'), {x0,x1,h,zInt,zExt}=ENTREE;
  boite(g,x0,x0+0.04,0,h,zInt,zExt,MAT.blanc); boite(g,x1-0.04,x1,0,h,zInt,zExt,MAT.blanc); boite(g,x0,x1,h-0.04,h,zInt,zExt,MAT.blanc);
  for(const [a,b] of [[zInt-0.012,zInt],[zExt,zExt+0.012]]){
    boite(g,x0-0.06,x0,0,h+0.06,a,b,MAT.blanc); boite(g,x1,x1+0.06,0,h+0.06,a,b,MAT.blanc); boite(g,x0-0.06,x1+0.06,h,h+0.06,a,b,MAT.blanc);
  }
  boite(g,x0+0.04,x1-0.04,0,0.012,zInt,zExt,MAT.pierre);
  return g;
}
// Porte blanche du réduit sous l'escalier, à côté de la porte d'entrée : affleurante, sans cadre ni chambranle (photo
// « Entrée 1 ») ; le battant ouvrable est posé dans ce groupe par portes.js
function porteReduit(){ return groupe('rez__porte_reduit'); }
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
// Lit 180 × 200, tête de lit et cadre en tissu bleu, linge bleu clair (d'après Mauro), contre le mur nord (sous la pente du toit) ;
// 200 × 210 cm hors tout, dessus du matelas à 68 cm (mesuré par Mauro le 12 octobre 2026), même centre
// 22 cm plus à l'est que dans la première version (12 octobre 2026 : trois photos calées de la chambre concordent)
function lit(){
  const g=groupe('rez__lit'), x0=16.675, x1=18.675, zT=-27.80, zP=zT+2.10;
  boite(g,x0,x1,0.10,1.00,zT,zT+0.10,MAT.tissuBeige);                     // tête de lit
  boite(g,x0,x1,0.12,0.48,zT+0.10,zP,MAT.tissuBeige);                     // cadre
  for(const [x,z] of [[x0+0.05,zT+0.15],[x1-0.05,zT+0.15],[x0+0.05,zP-0.05],[x1-0.05,zP-0.05]]) boite(g,x-0.03,x+0.03,0,0.12,z-0.03,z+0.03,MAT.sombre);
  boite(g,x0+0.10,x1-0.10,0.48,0.68,zT+0.11,zP-0.02,MAT.lingeMarine);     // matelas 180 × 200
  boite(g,x0+0.05,x1-0.05,0.66,0.72,zT+0.55,zP-0.01,MAT.lingeMarine);     // couette
  for(const c of [0.25,0.71]) boite(g,x0+c*(x1-x0)-0.33,x0+c*(x1-x0)+0.33,0.68,0.81,zT+0.14,zT+0.52,MAT.lingeMarine);
  return g;
}
// Chevets 48 cm de large, 60 cm de haut (mesurés par Mauro)
function chevet(nom,x){
  const g=groupe(nom), z0=-27.80, z1=-27.40;
  boite(g,x-0.24,x+0.24,0.02,0.60,z0,z1-0.016,MAT.laqueCreme);
  for(const [y0,y1] of [[0.03,0.315],[0.315,0.59]]) boite(g,x-0.237,x+0.237,y0+0.003,y1-0.003,z1-0.016,z1,MAT.laqueCreme,true);
  return g;
}
// Petite lampe champignon posée sur le chevet : un élément à part (Mauro, 11 octobre 2026 : pouvoir poser autre chose)
function lampeChevet(nom,x){
  const g=groupe(nom);
  cylindre(g,x+0.08,0.60,0.80,-27.62,0.008,MAT.chrome);   // posée sur le chevet (60 cm)
  const abat=new THREE.Mesh(new THREE.SphereGeometry(0.09,16,8,0,Math.PI*2,0,Math.PI/2),MAT.lumiere); abat.position.set(x+0.08,0.76,-27.62); g.add(abat);
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
// Douche à l'italienne à droite de la baignoire, 165 × 98 cm (relevé de Mauro, 12 octobre 2026) : paroi vitrée posée
// sur le rebord de la baignoire, collée au mur nord et taillée selon la pente (73 cm côté mur, coude 2 cm sous le plafond,
// horizontale ensuite, 97 cm de long) ; mur du fond en plaquettes de pierre sombre jusqu'à la pente et au plafond ;
// bandeau lumineux de 1,23 m sous le plafond ; colonne de douche, mitigeur à 1,22 m, pommeau tourné vers le lavabo (ouest).
// Dans la douche, la pente est plus raide que le pan du toit au-dessus de la baignoire : elle rejoint le plafond à
// z = -27,37 et non -27,23 (photo « Salle de bain 2 » calée, bandeau de 123 cm mesuré par Mauro) ; voir penteDouche()
export const pentePanNord=y=>-27.799+(y-1.26)*0.50088;               // pan nord du toit (face intérieure) : z selon la hauteur
const DOUCHE={x0:13.757, x1:14.748, zMur:-27.799, yGenou:1.26, zPlafond:-27.37};
function douche(){
  const g=groupe('rez__douche'), {zMur,zPlafond}=DOUCHE, z1=-26.829, yb=0.525, yh=2.38;   // rebord de la baignoire à 52,5 cm
  prisme(g,'x',13.745,13.757,[[zMur,yb],[z1,yb],[z1,yh],[zPlafond,yh],[zMur,1.24]],MAT.verre);
  prisme(g,'x',14.72,14.748,[[zMur,0],[-26.108,0],[-26.108,2.40],[zPlafond,2.40],[zMur,DOUCHE.yGenou]],MAT.briqueSombre);
  boite(g,14.70,14.72,2.37,2.39,-27.355,-26.125,MAT.lumiere);                            // bandeau lumineux
  const xc=14.70, zc=-27.22;
  cylindre(g,xc,1.00,2.20,zc,0.012,MAT.chrome);
  boite(g,xc-0.06,xc,1.19,1.25,zc-0.07,zc+0.07,MAT.chrome);                             // mitigeur thermostatique
  boite(g,xc-0.30,xc,2.18,2.20,zc-0.005,zc+0.005,MAT.chrome); cylindre(g,xc-0.32,2.17,2.19,zc,0.12,MAT.chrome);
  return g;
}
// Murs de la salle de bain carrelés jusqu'au plafond (relevé de Mauro du 12 octobre 2026 et ses photos) : grands carreaux
// d'aspect pierre de 60 × 30 cm posés en largeur, gris clair sur le mur ouest (vasque, bout de la baignoire), beige sur
// le mur du sèche-serviettes, dans le renfoncement du WC et sur le mur de la porte, gris foncé sur le mur en face de la
// baignoire et sous la pente du toit dans la douche. Le mur nord sous la fenêtre (bande sombre) et le fond de la douche
// (plaquettes) sont à part. Chaque face de peinture du bord de la pièce, tournée vers l'intérieur, est découpée à la
// pièce et recopiée 2 mm devant, comme la faïence du WC / buanderie
const ZONES_SDB=[[11.31,-27.80,14.75,-26.11],[11.31,-26.11,13.00,-25.01],[12.19,-25.01,13.00,-24.28]];
const TEINTES_SDB={clair:0xa29d94, beige:0xc2b6a2, fonce:0x5d6166};
function teinteMur(n,c){                          // n : normale tournée vers la pièce, c : centre de la face
  if(n.x>0.7) return c.x<11.5?'clair':'beige';    // mur ouest ; côté ouest du renfoncement du WC
  if(n.x<-0.7) return c.x>14.6?null:'beige';      // mur de la porte, côté est du renfoncement ; pas le fond de la douche
  if(n.z<-0.7) return c.z<-25.6?'fonce':'beige';  // mur en face de la baignoire ; mur du sèche-serviettes, fond du renfoncement
  return null;                                    // mur nord : bande sombre du modèle
}
// Pente de la douche : le pan du toit du modèle y est retiré (percé de x 13,757 à 14,748) ; la pente carrelée est posée
// par carrelerMursSdb, la peinture complète le reste : plafond plat jusqu'à z = -27,37, et la joue verticale (côté
// baignoire, contre la vitre) entre la pente du modèle et celle de la douche
function penteDouche(rez){
  const {x0,x1,zMur,yGenou,zPlafond}=DOUCHE; let mat=null;
  rez.traverse(o=>{ if(!o.isMesh||o.material.name!=='Material_6'||o.userData.dos) return; mat=mat||o.material;
    percer(o,pts=>pts.every(q=>Math.abs(q.z-pentePanNord(q.y))<0.004),{x0,x1,y0:yGenou-0.001,y1:2.401}); });
  if(!mat) return null;
  const zModele=pentePanNord(2.40), pos=[
    x0,2.40,zPlafond, x1,2.40,zPlafond, x1,2.40,zModele,   x0,2.40,zPlafond, x1,2.40,zModele, x0,2.40,zModele,   // plafond (vers le bas)
    x0,yGenou,zMur, x0,2.40,zModele, x0,2.40,zPlafond];                                                       // joue (vers l'ouest)
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(pos.length/3*2).fill(0),2)); geo.computeVertexNormals();
  return {geo,mat};
}
export function carrelerMursSdb(root){
  const rez=root.getObjectByName('structure_rez'); if(!rez) return;
  const {map,bump}=texturesCarreauPierre(), lots={};
  const peinture=penteDouche(rez);
  const n=new THREE.Vector3(), e=new THREE.Vector3(), c=new THREE.Vector3(), M=0.02;
  const v=[0,1,2].map(()=>new THREE.Vector3());
  rez.traverse(o=>{ if(!o.isMesh||o.material.name!=='Material_6'||o.userData.dos) return;
    o.updateMatrixWorld(true);
    let g=enFlottants(o.geometry); if(g.index) g=g.toNonIndexed(); g.applyMatrix4(o.matrixWorld);
    const p=g.attributes.position;
    for(let i=0;i+2<p.count;i+=3){ v.forEach((q,k)=>q.fromBufferAttribute(p,i+k));
      n.subVectors(v[1],v[0]).cross(e.subVectors(v[2],v[0])); if(n.lengthSq()<1e-10) continue; n.normalize();
      if(Math.abs(n.y)>0.3) continue;
      for(const [x0,z0,x1,z1] of ZONES_SDB){
        let poly=v.map(q=>q.clone());
        for(const [axe,val,sens] of [['x',x0-M,1],['x',x1+M,-1],['z',z0-M,1],['z',z1+M,-1]]){ poly=couper(poly,axe,val,sens); if(poly.length<3) break; }
        if(poly.length<3) continue;
        c.set(0,0,0); for(const q of poly) c.add(q); c.multiplyScalar(1/poly.length);
        if(c.x>11.30&&c.x<13.78&&c.z>-27.81&&c.z<-26.82&&c.y<0.6) continue;       // faces du tablier de la baignoire
        if(c.x>11.70&&c.x<13.15&&c.y>1.2&&c.z<-27.2) continue;                     // ébrasement peint de la fenêtre
        // côté peint vers la pièce, ou dos vers la pièce (face unique vue par son dos) ; la pente seulement par-dessous
        for(const sg of [1,-1]){ const cx=c.x+sg*n.x*0.05, cz=c.z+sg*n.z*0.05; if(!(cx>x0&&cx<x1&&cz>z0&&cz<z1)) continue;
          const ni=n.clone().multiplyScalar(sg), t=teinteMur(ni,c); if(!t) continue;
          const l=lots[t]||(lots[t]={pos:[],nor:[],uv:[]}), lat=Math.abs(n.x)>Math.abs(n.z);
          for(let k=1;k+1<poly.length;k++) for(const q of sg>0?[poly[0],poly[k],poly[k+1]]:[poly[0],poly[k+1],poly[k]]){
            l.pos.push(q.x+ni.x*0.002,q.y+ni.y*0.002,q.z+ni.z*0.002); l.nor.push(ni.x,ni.y,ni.z);
            l.uv.push((lat?q.z:q.x)/0.60,q.y/0.30); } }
      } } });
  // pente de la douche, carrelée en gris foncé, rangées le long de la pente
  const {x0,x1,zMur,yGenou,zPlafond}=DOUCHE, L=Math.hypot(2.40-yGenou,zPlafond-zMur), ny=-(zPlafond-zMur)/L, nz=(2.40-yGenou)/L;
  // mur nord de la douche plat du sol au genou, 2 mm devant le mur (le modèle y avait un retrait de 20 cm jusqu'à 0,89 m,
  // coin blanc vu par Mauro), puis la pente : joints alignés
  const fo=lots.fonce||(lots.fonce={pos:[],nor:[],uv:[]}), z=zMur+0.002;
  const quad=(coin,n)=>{ for(const k of [0,1,2,0,2,3]){ const [x,y,zz,v]=coin[k]; fo.pos.push(x,y,zz); fo.nor.push(...n); fo.uv.push(x/0.60,v/0.30); } };
  quad([[x0,0,z,0],[x1,0,z,0],[x1,yGenou,z,yGenou],[x0,yGenou,z,yGenou]],[0,0,1]);
  quad([[x0,yGenou,z,yGenou],[x1,yGenou,z,yGenou],[x1,2.40,zPlafond,yGenou+L],[x0,2.40,zPlafond,yGenou+L]],[0,ny,nz]);
  rez.updateMatrixWorld(true); const inv=rez.matrixWorld.clone().invert();
  if(peinture){ const m=new THREE.Mesh(peinture.geo,peinture.mat); m.applyMatrix4(inv); rez.add(m); }
  for(const [t,l] of Object.entries(lots)){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(l.pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(l.nor,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(l.uv,2));
    const mat=new THREE.MeshStandardMaterial({color:TEINTES_SDB[t],map,bumpMap:bump,bumpScale:1.2,roughness:0.35}); mat.name='carrelage_sdb_'+t;
    const m=new THREE.Mesh(g,mat); m.name='rez__carrelage_sdb_'+t; m.applyMatrix4(inv); rez.add(m);
  }
}
// Meuble vasque en chêne suspendu contre le mur ouest (x = 11,31), collé au mur sud (sèche-serviettes), à 18 cm de la
// baignoire ; grande vasque blanche, miroir et réglette centrés sur le meuble. 160 × 56 cm, dessus à 69 cm, miroir de 84 cm
// (mesurés par Mauro le 12 octobre 2026)
function vasque(){
  const g=groupe('rez__vasque_sdb'), x0=11.31, z1=-25.01, z0=z1-1.60, xf=11.87, zm=(z0+z1)/2;
  boite(g,x0,xf-0.018,0.29,0.69,z0,z1,MAT.chene);
  for(const [y0,y1] of [[0.29,0.49],[0.49,0.69]]) boite(g,xf-0.018,xf,y0+0.004,y1-0.004,z0+0.004,z1-0.004,MAT.chene,'sombre');
  const v0=11.33, v1=11.86, w0=zm-0.425, w1=zm+0.425, y0=0.69, y1=0.84, e=0.02;
  boite(g,v0,v1,y0,y0+0.04,w0,w1,MAT.ceramique); boite(g,v0,v0+0.09,y0,y1,w0,w1,MAT.ceramique); boite(g,v1-e,v1,y0,y1,w0,w1,MAT.ceramique);
  boite(g,v0,v1,y0,y1,w0,w0+e,MAT.ceramique); boite(g,v0,v1,y0,y1,w1-e,w1,MAT.ceramique);
  cylindre(g,11.37,y1,y1+0.17,zm,0.014,MAT.chrome); boite(g,11.36,11.47,y1+0.14,y1+0.16,zm-0.01,zm+0.01,MAT.chrome);
  boite(g,x0,x0+0.006,1.05,1.75,zm-0.42,zm+0.42,new THREE.MeshStandardMaterial({color:0xdde6ea,roughness:0.06}));
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
// WC suspendu dans le renfoncement du mur sud (x 12,19 → 13,00, fond à z = -24,28), adossé à un coffrage à mi-hauteur
// (seulement dans le renfoncement) en plaquettes de pierre sombre, dessus en pierre claire (photo « Salle de bain 3 »,
// 12 octobre 2026) ; copie du WC de l'étage
function wcSdb(root){
  const g=groupe('rez__wc_sdb'), x0=12.188, x1=12.998, zFond=-24.278, zF=-24.48, xc=(x0+x1)/2;
  boite(g,x0,x1,0,1.15,zF,zFond,MAT.briqueSombre); boite(g,x0,x1,1.15,1.17,zF-0.02,zFond,MAT.pierreClaire);
  const cuvette=root.getObjectByName('etage__wc'), plaque=root.getObjectByName('etage__bouton_wc_douche');
  // à l'étage le WC est adossé au mur z = -21,39 et regarde vers -z, comme ici (adossé au coffrage z = -24,48)
  if(cuvette) g.add(copier(cuvette,new THREE.Vector3(17.179,2.74,-21.39),new THREE.Vector3(xc,0,zF),0));
  if(plaque) g.add(copier(plaque,new THREE.Vector3(17.175,2.74,-21.423),new THREE.Vector3(xc,0,zF),0));
  return g;
}

export function construirePieces(root){
  return [commode(), porteEntree(), porteReduit(), aspirateur(), sacsTri(), plafonnier('rez__plafonnier_entree',12.40,-21.85), plafonnier('rez__plafonnier_degagement',13.65,-24.00),
    lit(), chevet('rez__chevet_1',16.42), chevet('rez__chevet_2',18.93), lampeChevet('rez__lampe_chevet_1',16.42), lampeChevet('rez__lampe_chevet_2',18.93), lustre(),
    douche(), vasque(), secheServiettes(), wcSdb(root), plafonnier('rez__plafonnier_sdb',12.40,-25.60), globeWC()];
}
