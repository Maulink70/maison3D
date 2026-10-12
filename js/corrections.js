// Défauts du modèle SketchUp relevés par l'audit du 8 octobre 2026 (sols, fenêtres, seuil de la baie, porte
// d'entrée), corrigés au chargement : le fichier 3D n'est pas modifié
import * as THREE from 'three';
import {uvMonde, enFlottants} from './formes.js';
import {VELUX, VELUX_BAS, VELUX_HAUT, VELUX_MONTEE} from './fenetres.js';

// Neutralise les triangles dont les trois sommets (coordonnées monde) répondent au test ; renvoie leur nombre
function neutraliser(o,test){
  o.updateMatrixWorld(true);
  const g=o.geometry, p=g.attributes.position;
  if(!g.index) g.setIndex([...Array(p.count).keys()]);
  const idx=g.index; let n=0;
  for(let t=0;t<idx.count;t+=3){
    const pts=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,idx.getX(t+k)).applyMatrix4(o.matrixWorld));
    if(test(pts)){ const a=idx.getX(t); idx.setX(t+1,a); idx.setX(t+2,a); n++; }
  }
  idx.needsUpdate=true; return n;
}
const centre=pts=>pts.reduce((c,q)=>c.add(q),new THREE.Vector3()).divideScalar(3);
const auSol=(pts,y=0)=>pts.every(q=>Math.abs(q.y-y)<0.01);
function boiteMonde(o){ return new THREE.Box3().setFromObject(o); }

// Coordonnées de texture d'un sol : u et v sont des fonctions affines de x et z, retrouvées sur un triangle existant
// (le plus proche du point « pres » s'il est donné : l'appareillage raccorde alors avec le sol voisin)
function repereUV(o,pres=null){
  const g=o.geometry, p=g.attributes.position, uv=g.attributes.uv, idx=g.index; if(!uv) return null;
  let meilleur=null, dMin=Infinity;
  for(let t=0;t<idx.count;t+=3){
    const k=[0,1,2].map(i=>idx.getX(t+i)), pts=k.map(i=>new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));
    if(!auSol(pts)) continue;
    const m=new THREE.Matrix3().set(pts[0].x,pts[0].z,1, pts[1].x,pts[1].z,1, pts[2].x,pts[2].z,1);
    if(Math.abs(m.determinant())<1e-4) continue;
    const c=centre(pts), d=pres?Math.hypot(c.x-pres[0],c.z-pres[1]):0;
    if(d<dMin){ dMin=d; meilleur={k,inv:m.invert()}; if(!pres) break; }
  }
  if(!meilleur) return null;
  const {k,inv}=meilleur, cu=new THREE.Vector3(...k.map(i=>uv.getX(i))).applyMatrix3(inv), cv=new THREE.Vector3(...k.map(i=>uv.getY(i))).applyMatrix3(inv);
  return (x,z)=>[cu.x*x+cu.y*z+cu.z, cv.x*x+cv.y*z+cv.z];
}
// Rectangle de sol (y constant) avec le matériau et l'appareillage d'un sol existant
function dalle(source,x0,x1,z0,z1,y=0,pres=null){
  const f=repereUV(source,pres), g=new THREE.BufferGeometry(), c=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  g.setAttribute('position',new THREE.Float32BufferAttribute(c.flatMap(([x,z])=>[x,y,z]),3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(c.flatMap(()=>[0,1,0]),3));
  if(f) g.setAttribute('uv',new THREE.Float32BufferAttribute(c.flatMap(([x,z])=>f(x,z)),2));
  g.setIndex([0,2,1,0,3,2]);
  return new THREE.Mesh(g,source.material);
}

// Face de mur plane (contour x/y dans le plan z = zMur, trous éventuels), visible des deux côtés
function faceMur(contour,zMur,mat,trous=[]){
  const v2=c=>c.map(([x,y])=>new THREE.Vector2(x,y)), s=new THREE.Shape(v2(contour));
  for(const t of trous) s.holes.push(new THREE.Path(v2(t)));
  const g=new THREE.ShapeGeometry(s); g.translate(0,0,zMur);
  const m=mat.clone(); m.side=THREE.DoubleSide;
  return new THREE.Mesh(g,m);
}

// Pièces d'un triangle (coordonnées monde) privé du rectangle r = {x0, x1, y0, y1} (mesuré en x et y ; z suit le plan du
// triangle) : quatre polygones convexes (Sutherland-Hodgman), dans le sens du triangle
function triangleMoinsRect(P,r){
  const n=new THREE.Vector3().subVectors(P[1],P[0]).cross(new THREE.Vector3().subVectors(P[2],P[0])), d=n.dot(P[0]);
  const zDe=(x,y)=>(d-n.x*x-n.y*y)/n.z;
  const couper=(poly,k,v,garde)=>{ const out=[]; for(let i=0;i<poly.length;i++){ const A=poly[i], B=poly[(i+1)%poly.length], ia=garde(A[k],v), ib=garde(B[k],v);
    if(ia) out.push(A); if(ia!==ib){ const t=(v-A[k])/(B[k]-A[k]); out.push([A[0]+t*(B[0]-A[0]),A[1]+t*(B[1]-A[1])]); } } return out; };
  const inf=(a,v)=>a<=v, sup=(a,v)=>a>=v, T=P.map(q=>[q.x,q.y]), milieu=couper(couper(T,0,r.x0,sup),0,r.x1,inf);
  const morceaux=[couper(T,0,r.x0,inf),couper(T,0,r.x1,sup),couper(milieu,1,r.y0,inf),couper(milieu,1,r.y1,sup)], tris=[];
  for(const m of morceaux) for(let i=1;i+1<m.length;i++){ const t=[m[0],m[i],m[i+1]];
    if(Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[2][0]-t[0][0])*(t[1][1]-t[0][1]))<1e-7) continue;
    tris.push(t.map(([x,y])=>new THREE.Vector3(x,y,zDe(x,y)))); }
  return tris;
}
// Perce un rectangle dans les faces planes d'un maillage (test : le triangle est-il dans le plan voulu ?) : triangles
// touchés neutralisés, refaits sans le rectangle dans un maillage frère (même matériau)
function percer(o,test,r){
  o.updateMatrixWorld(true); const nouveaux=[]; let n=0;
  neutraliser(o,pts=>{ if(!test(pts)) return false;
    const xs=pts.map(q=>q.x), ys=pts.map(q=>q.y);
    if(Math.max(...xs)<=r.x0+1e-4||Math.min(...xs)>=r.x1-1e-4||Math.max(...ys)<=r.y0+1e-4||Math.min(...ys)>=r.y1-1e-4) return false;
    nouveaux.push(...triangleMoinsRect(pts,r)); n++; return true; });
  if(nouveaux.length) o.parent.attach(maillage(nouveaux,o.material));
  return n;
}
// Maillage d'une liste de triangles en coordonnées monde (coordonnées de texture posées ensuite, ou par uv(q))
function maillage(tris,mat,uv=null){
  const g=new THREE.BufferGeometry(), pts=tris.flat();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pts.flatMap(q=>[q.x,q.y,q.z]),3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(pts.flatMap(q=>uv?uv(q):[0,0]),2));
  g.computeVertexNormals(); return new THREE.Mesh(g,mat);
}
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
// Coordonnées de texture d'un mur à z constant : u et v fonctions affines de x et y, retrouvées sur un triangle existant
function repereUVMur(o,zMur){
  const g=o.geometry, p=g.attributes.position, uv=g.attributes.uv, idx=g.index; if(!uv) return null;
  for(let t=0;t<idx.count;t+=3){
    const k=[0,1,2].map(i=>idx.getX(t+i)), pts=k.map(i=>new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));
    if(!pts.every(q=>Math.abs(q.z-zMur)<0.003)) continue;
    const m=new THREE.Matrix3().set(pts[0].x,pts[0].y,1, pts[1].x,pts[1].y,1, pts[2].x,pts[2].y,1);
    if(Math.abs(m.determinant())<1e-4) continue;
    const inv=m.invert(), cu=new THREE.Vector3(...k.map(i=>uv.getX(i))).applyMatrix3(inv), cv=new THREE.Vector3(...k.map(i=>uv.getY(i))).applyMatrix3(inv);
    return q=>[cu.x*q.x+cu.y*q.y+cu.z, cv.x*q.x+cv.y*q.y+cv.z];
  }
  return null;
}

// Fenêtre de la salle de bain du rez : dans le modèle, de 0,89 à 1,26 m dans le mur carrelé de la baignoire (z = -28,00) ;
// en réalité au-dessus du carrelage, de 1,26 à 1,87 m, dans le pan nord du toit (photos calées, 11 octobre 2026).
// L'ancien trou est carrelé (au nu du mur), le pan du toit (face intérieure, peau extérieure) est percé, avec un ébrasement intérieur
// (dessus, côtés) et une petite lucarne dehors (joues, toit) ; la fenêtre elle-même est refaite par fenetres.js
export const FEN_SDB={x0:11.738, x1:13.093, y0:1.26, y1:1.87, yAncien:0.89, zMur:-27.998, zInt:-27.799};
const zPenteInt=y=>-27.799+(y-1.26)*0.50088, zPenteExt=y=>-28.166+(y-1.26)*0.5;   // pan nord : face intérieure, peau extérieure
function fenetreSalleDeBain(rez,mur,carrelage){
  const F=FEN_SDB, faceDe=(pts,n)=>{ const v=new THREE.Vector3().subVectors(pts[1],pts[0]).cross(new THREE.Vector3().subVectors(pts[2],pts[0])).normalize(); return v.dot(n)>0.99; };
  let murs=[]; rez.traverse(o=>{ if(o.isMesh&&o.material===mur) murs.push(o); });
  // 1. ancien trou : la face cachée à z = -27,799 (1,26 → 1,55 m) partirait dans la nouvelle fenêtre : neutralisée
  for(const o of murs) neutraliser(o,pts=>pts.every(q=>Math.abs(q.z-F.zInt)<0.002&&q.y>F.y0-0.002&&q.y<1.552&&q.x>F.x0-0.002)&&faceDe(pts,V(0,0,1)));
  //    carrelage au nu du mur (z = -27,799, comme à gauche et à droite : le creux de l'ancienne fenêtre reste fermé dans le mur,
  //    son tableau gardé ; au fond, il ouvrait l'épaisseur du mur ouest, que le plan comptait alors comme une pièce), peinture dehors
  const rect=(x0,x1,y0,y1,z,sens)=>sens>0?[[V(x0,y0,z),V(x1,y0,z),V(x1,y1,z)],[V(x0,y0,z),V(x1,y1,z),V(x0,y1,z)]]:[[V(x0,y0,z),V(x1,y1,z),V(x1,y0,z)],[V(x0,y0,z),V(x0,y1,z),V(x1,y1,z)]];
  const uv=carrelage?repereUVMur(carrelage,F.zInt):null;
  if(carrelage) carrelage.parent.attach(maillage(rect(11.308,F.x1,F.yAncien,F.y0,F.zInt,1),carrelage.material,uv));   // depuis le mur ouest de la pièce : mur plat, comme sur la photo
  rez.attach(maillage(rect(F.x0,F.x1,F.yAncien,F.y0,F.zMur,-1),mur));
  // 2. pan du toit percé : face intérieure et peau extérieure (jusqu'au toit de la lucarne, 2 mm au-dessus du cadre)
  const r={x0:F.x0,x1:F.x1,y0:F.y0,y1:F.y1}, rExt={...r,y1:F.y1+0.002};
  const dansPlan=(f)=>pts=>pts.every(q=>Math.abs(q.z-f(q.y))<0.004);
  for(const o of murs){ percer(o,dansPlan(zPenteInt),r); percer(o,dansPlan(zPenteExt),rExt); }
  // 3. ébrasement intérieur : dessus (horizontal, vers le bas) et côtés (triangles), de la fenêtre à la face du pan
  const zH=zPenteInt(F.y1), tris=[
    [V(F.x0,F.y1,F.zInt),V(F.x0,F.y1,zH),V(F.x1,F.y1,zH)],[V(F.x0,F.y1,F.zInt),V(F.x1,F.y1,zH),V(F.x1,F.y1,F.zInt)],
    [V(F.x0,F.y0,F.zInt),V(F.x0,F.y1,F.zInt),V(F.x0,F.y1,zH)], [V(F.x1,F.y0,F.zInt),V(F.x1,F.y1,zH),V(F.x1,F.y1,F.zInt)]];
  // 4. lucarne : joues (sous et au-dessus du croisement de la peau extérieure avec le plan de la fenêtre), toit débordant de 2 cm
  const yT=F.y1+0.002, yX=1.26+(F.zMur+28.166)/0.5, zT=zPenteExt(yT);
  for(const [x,s] of [[F.x0,-1],[F.x1,1]]){
    const bas=[V(x,F.y0,zPenteExt(F.y0)),V(x,F.y0,F.zMur),V(x,yX,F.zMur)], haut=[V(x,yX,F.zMur),V(x,yT,F.zMur),V(x,yT,zT)];
    for(const t of [bas,haut]) tris.push(faceDe(t,V(s,0,0))?t:[t[0],t[2],t[1]]); }
  tris.push([V(F.x0-0.02,yT,F.zMur-0.02),V(F.x1+0.02,yT,zT),V(F.x1+0.02,yT,F.zMur-0.02)],[V(F.x0-0.02,yT,F.zMur-0.02),V(F.x0-0.02,yT,zT),V(F.x1+0.02,yT,zT)]);
  rez.attach(maillage(tris,mur));
}

// Ouverture de la porte d'entrée dans le mur z = -21,11 (le modèle n'a qu'un mur plein) : x 11,60 → 12,62, 2,15 m ;
// battant de 94,5 × 211 cm (mesuré par Mauro le 12 octobre 2026), dormant de 4 cm : ouverture de 1,025 m, même centre
export const ENTREE={x0:11.5975, x1:12.6225, h:2.15, zInt:-21.108, zExt:-20.908};

// Ouverture des Velux dans le pan nord (87,5 × 133 cm, épaisseur du toit comprise) : ses sommets sont montés avec les Velux
// (bas du cadre à 85 cm du sol, mesuré par Mauro ; fenetres.js monte le cadre et la doublure d'autant)
function monterVelux(etage){
  const w=new THREE.Vector3().subVectors(VELUX_HAUT,VELUX_BAS).normalize(), nv=new THREE.Vector3(1,0,0).cross(w);
  const centres=VELUX.map(v=>new THREE.Vector3((v.x[0]+v.x[1])/2,(VELUX_BAS.y+VELUX_HAUT.y)/2,(VELUX_BAS.z+VELUX_HAUT.z)/2));
  const d=new THREE.Vector3(), dans=q=>centres.some(c=>{ d.subVectors(q,c); const n=d.dot(nv); return Math.abs(d.x)<0.45&&Math.abs(d.dot(w))<0.70&&n>-0.12&&n<0.40; });
  let n=0;
  etage.traverse(o=>{ if(!o.isMesh) return; o.updateMatrixWorld(true);
    const p=o.geometry.attributes.position, inv=o.matrixWorld.clone().invert(), q=new THREE.Vector3(); let geo=null;
    for(let i=0;i<p.count;i++){ q.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld); if(!dans(q)) continue;
      if(!geo) geo=o.geometry=enFlottants(o.geometry);   // positions compressées en entiers dans le modèle
      q.add(VELUX_MONTEE).applyMatrix4(inv); geo.attributes.position.setXYZ(i,q.x,q.y,q.z); n++; }
    if(geo){ geo.computeBoundingBox(); geo.computeBoundingSphere(); } });
  return n;
}

export function corrigerStructure(root){
  root.updateMatrixWorld(true);
  const rez=root.getObjectByName('structure_rez'), etage=root.getObjectByName('structure_etage'), ajouts=new THREE.Group();
  ajouts.name='structure_corrections';
  let carrelageSdb=null, mur=null, parquet=null;
  rez?.traverse(o=>{ if(!o.isMesh) return;
    if(o.material.name==='Material_10') carrelageSdb=o;
    if(o.material.name==='Material_7'&&!parquet) parquet=o;
    if(o.material.name==='Material_6'&&!mur) mur=o.material;
  });
  // 1. Carrelage de la salle de bain : SketchUp l'a découpé en grands triangles, dont un passe sous le parquet
  //    de la chambre (même hauteur : plaques grises qui scintillent) ; on garde ce qui est dans la salle de bain
  if(carrelageSdb){
    neutraliser(carrelageSdb,pts=>auSol(pts)&&(centre(pts).x>14.95||pts.every(q=>q.z>-26.115&&q.z<-26.02)&&Math.max(...pts.map(q=>q.x))>15));
    // 2. Pas de sol sous la baignoire (on le verrait en la déplaçant) : dalle dans le même carrelage
    ajouts.add(dalle(carrelageSdb,11.308,13.769,-27.799,-26.828,0));
    //    Le long du mur nord carrelé (niche de la baignoire et de la douche, z = -28,00), le sol s'arrêtait 8 à 20 cm
    //    avant le mur : bande blanche au pied du carrelage (audit des carrelages du 9 octobre 2026)
    ajouts.add(dalle(carrelageSdb,11.308,14.75,-27.999,-27.79,0));
  }
  // 2 bis. Dégagement : sous l'armoire, pas de parquet mais une face blanche (peinture des murs), 0,3 mm au-dessus du
  //    parquet voisin : tache blanche qui scintille si on déplace l'armoire ; remplacée par du parquet raccordé à celui du dégagement
  if(parquet) ajouts.add(dalle(parquet,14.15,14.87,-24.93,-22.78,0,[14.0,-23.9]));
  if(rez) rez.traverse(o=>{ if(o.isMesh&&o.material.name==='Material_6') neutraliser(o,pts=>auSol(pts)&&pts.every(q=>q.x>13.0&&q.x<14.9&&q.z>-24.95&&q.z<-22.75)
    &&new THREE.Vector3().subVectors(pts[1],pts[0]).cross(new THREE.Vector3().subVectors(pts[2],pts[0])).y>0); });
  // 3. Sol bleu de la douche de l'étage tracé à 2,40 m sur toute l'emprise du bâtiment (remplacé par le sol à 2,74 m)
  etage?.traverse(o=>{ if(o.isMesh&&o.material.name==='Material_367'){ const b=boiteMonde(o); if(b.max.y-b.min.y<0.02) o.userData.retirer=true; } });
  // 4. Seuil en bois de la baie : boîte sans face côté pièce, cadre de la baie enfoncé dedans (refait avec la baie)
  rez?.traverse(o=>{ if(o.isMesh&&o.material.name==='Material_13'){ const b=boiteMonde(o); if(b.max.y<0.1&&b.min.z>-14.4) o.userData.retirer=true; } });
  const aRetirer=[]; root.traverse(o=>{ if(o.userData.retirer) aRetirer.push(o); }); for(const o of aRetirer) o.removeFromParent();
  //    ses faces blanches internes (à 8 cm, vues à travers le bas de la vitre) partent avec lui
  //    (sur la largeur de la baie seulement, x 12,88 → 18,60 : plus loin, c'était le bas du mur, fente de 4 cm sur la pelouse,
  //    vue par Mauro le 9 octobre 2026)
  if(mur) rez.traverse(o=>{ if(o.isMesh&&o.material===mur) neutraliser(o,pts=>pts.every(q=>q.x>12.6&&q.x<18.60&&q.y>-0.005&&q.y<0.085&&q.z>-14.35&&q.z<-14.13)); });
  // 4 bis. Fenêtre de la salle de bain remontée au-dessus du carrelage (photos calées)
  if(rez&&mur) fenetreSalleDeBain(rez,mur,carrelageSdb);
  // 5. Porte d'entrée : on perce le mur (ses deux faces) et on les refait autour de l'ouverture
  if(rez&&mur){
    const E=ENTREE, dans=(pts,z,xa,xb,yb)=>pts.every(q=>Math.abs(q.z-z)<0.004&&q.x>xa-0.005&&q.x<xb+0.005&&q.y>-0.005&&q.y<yb+0.005);
    // face intérieure : rectangle 11,45 → 12,87 sur 2,40 m ; face extérieure : 11,11 → 12,67 sur 4,64 m, percée
    // aussi de la fenêtre à store de l'étage (11,46 → 12,53, de 3,60 à 4,32 m)
    let n=0; rez.traverse(o=>{ if(o.isMesh&&o.material===mur) n+=neutraliser(o,pts=>dans(pts,E.zInt,11.448,12.869,2.40)||dans(pts,E.zExt,11.108,12.668,4.642)); });
    if(n){
      ajouts.add(faceMur([[11.448,0],[E.x0,0],[E.x0,E.h],[E.x1,E.h],[E.x1,0],[12.869,0],[12.869,2.40],[11.448,2.40]],E.zInt,mur));
      ajouts.add(faceMur([[11.108,0],[E.x0,0],[E.x0,E.h],[E.x1,E.h],[E.x1,0],[12.668,0],[12.668,4.642],[11.108,4.642]],E.zExt,mur,
        [[[11.458,3.60],[12.533,3.60],[12.533,4.32],[11.458,4.32]]]));
    }
  }
  // 6. Velux montés de 7,6 cm (bas du cadre à 85 cm du sol, mesuré par Mauro le 12 octobre 2026) : leur ouverture dans le toit aussi
  if(etage) ajouts.userData.veluxMontes=monterVelux(etage);
  return ajouts;
}

// Fenêtres de l'étage (chambre, douche) : un panneau de bois opaque recouvre exactement la vitre ; on le retire
export function retirerPanneauxSurVitres(root){
  root.updateMatrixWorld(true);
  const vitres=[]; root.traverse(o=>{ if(o.isMesh&&o.userData.vitre) vitres.push(o); });
  const retirer=[];
  for(const v of vitres){
    const bv=boiteMonde(v);
    v.parent.traverse(o=>{
      if(!o.isMesh||o===v||o.userData.vitre||o.material.transparent) return;
      const g=o.geometry, n=(g.index?g.index.count:g.attributes.position.count)/3, b=boiteMonde(o);
      if(n<=4&&b.min.distanceTo(bv.min)<0.005&&b.max.distanceTo(bv.max)<0.005) retirer.push(o);
    });
  }
  for(const o of retirer) o.removeFromParent();
  return retirer.length;
}

// Seuil de la baie refait : bande de 2 cm sous le cadre, dans le bois du cadre, sur toute la profondeur du mur
export function seuilBaie(root){
  const baie=root.getObjectByName('rez__baie_vitree'); if(!baie) return;
  let bois=null; baie.traverse(o=>{ if(o.isMesh&&o.material.name==='Material_297'&&!bois) bois=o.material; });
  if(!bois) return;
  const geo=new THREE.BoxGeometry(18.588-12.888,0.02,0.236); geo.translate((12.888+18.588)/2,0.01,-14.229);
  const g=new THREE.Mesh(uvMonde(geo),bois); g.name='rez__baie_seuil';
  baie.updateMatrixWorld(true); baie.attach(g);
}
