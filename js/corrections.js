// Défauts du modèle SketchUp relevés par l'audit du 8 octobre 2026 (sols, fenêtres, seuil de la baie, porte
// d'entrée), corrigés au chargement : le fichier 3D n'est pas modifié
import * as THREE from 'three';
import {uvMonde} from './formes.js';

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

// Ouverture de la porte d'entrée dans le mur z = -21,11 (le modèle n'a qu'un mur plein) : x 11,62 → 12,60, 2,14 m
export const ENTREE={x0:11.62, x1:12.60, h:2.14, zInt:-21.108, zExt:-20.908};

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
  if(mur) rez.traverse(o=>{ if(o.isMesh&&o.material===mur) neutraliser(o,pts=>pts.every(q=>q.x>12.6&&q.x<19.7&&q.y>-0.005&&q.y<0.085&&q.z>-14.35&&q.z<-14.13)); });
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
