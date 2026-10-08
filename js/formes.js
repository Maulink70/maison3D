// Briques communes aux meubles et éléments construits en code (d'après les photos de Mauro)
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const std=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:0.5,...o});
// Pas de reflets d'environnement dans la scène : les « métaux » restent peu métalliques, sinon ils sortent noirs
export const MAT={
  blanc:std(0xf3f3f1,{roughness:0.4}), creme:std(0xeee6d4), mur:std(0xebe6db,{roughness:0.8}),
  boisCuisine:std(0xc8955c,{roughness:0.55}), chene:std(0xc28a4f,{roughness:0.55}), erable:std(0xe0c79c,{roughness:0.6}),
  granit:std(0x141516,{roughness:0.22}), verreNoir:std(0x0e1013,{roughness:0.12}), depoli:std(0xcdd6d2,{roughness:0.3}),
  inox:std(0xc3c7cb,{metalness:0.3,roughness:0.3}), chrome:std(0xd2d6db,{metalness:0.3,roughness:0.22}),
  sombre:std(0x26292d,{roughness:0.4}), noir:std(0x121314,{roughness:0.3}), plinthe:std(0x2c2c2c,{roughness:0.8}),
  cuir:std(0x6f1f2b,{roughness:0.55}), cuirClair:std(0x86283a,{roughness:0.5}),
  tissuBeige:std(0xcdbfa9,{roughness:0.9}), drap:std(0xf1ede5,{roughness:0.9}),
  pierre:std(0x4b4e52,{roughness:0.75}), briqueSombre:std(0x4a4440,{roughness:0.85}), carrelageGris:std(0x8f8b86,{roughness:0.7}),
  porteSombre:std(0x3a2a22,{roughness:0.6}),
  ceramique:std(0xfafaf8,{roughness:0.2}), feuille:std(0x3d7a37,{roughness:0.7}), feuilleClaire:std(0x6a9a3c,{roughness:0.7}),
  potBordeaux:std(0x6c1c2a,{roughness:0.5}), potBlanc:std(0xe9e9e6,{roughness:0.5}),
  lumiere:std(0xfff7e6,{emissive:0xfff1d6,emissiveIntensity:0.55,roughness:0.6}),
  verre:new THREE.MeshStandardMaterial({color:0xdcebf0,transparent:true,opacity:0.22,roughness:0.05,side:THREE.DoubleSide,depthWrite:false}),
  cristal:new THREE.MeshStandardMaterial({color:0xeef4f8,transparent:true,opacity:0.55,roughness:0.05})
};
export const TRAIT=new THREE.LineBasicMaterial({color:0xb5ad9c});
const TRAIT_SOMBRE=new THREE.LineBasicMaterial({color:0x5a4a3a});

// Boîte alignée sur les axes, en coordonnées monde (mètres). contour : arêtes dessinées (portes, tiroirs)
export function boite(parent,x0,x1,y0,y1,z0,z1,mat,contour=false){
  const geo=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0), m=new THREE.Mesh(geo,mat);
  m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); m.userData.fusion=true; parent.add(m);
  if(contour){ const l=new THREE.LineSegments(new THREE.EdgesGeometry(geo),contour==='sombre'?TRAIT_SOMBRE:TRAIT); l.raycast=()=>{}; l.userData.fusion=true; m.add(l); }
  return m;
}
// Cylindre vertical (pieds, lampes, pots)
export function cylindre(parent,x,y0,y1,z,r,mat,r2=r,seg=20){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,y1-y0,seg),mat); m.position.set(x,(y0+y1)/2,z); m.userData.fusion=true; parent.add(m); return m;
}
export function sphere(parent,x,y,z,r,mat,seg=16){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,seg,Math.max(6,seg/2)),mat); m.position.set(x,y,z); m.userData.fusion=true; parent.add(m); return m; }
// Lignes horizontales sur une façade : persiennes, grilles. axe = 'z' (façade tournée vers ±z) ou 'x'
export function lignes(parent,a0,a1,y0,y1,plan,pas,axe='z'){
  const pts=[]; for(let y=y0+pas/2;y<y1;y+=pas) pts.push(...(axe==='z'?[a0,y,plan,a1,y,plan]:[plan,y,a0,plan,y,a1]));
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  const l=new THREE.LineSegments(g,TRAIT); l.raycast=()=>{}; l.userData.fusion=true; parent.add(l); return l;
}
export function groupe(nom){ const g=new THREE.Group(); g.name=nom; return g; }

// Plante stylisée : pot + feuilles en lames rayonnantes (hauteur totale h)
export function plante(parent,x,y0,z,{pot=0.12,hPot=0.2,h=0.7,feuilles=14,matPot=MAT.potBordeaux,lame=0.035}={}){
  cylindre(parent,x,y0,y0+hPot,z,pot*0.8,matPot,pot);
  const base=y0+hPot, geo=new THREE.ConeGeometry(lame,h-hPot,4);
  for(let i=0;i<feuilles;i++){
    const a=i*2.399, inc=0.25+0.55*((i*37)%10)/10, l=(h-hPot)*(0.75+0.25*((i*53)%7)/7);
    const f=new THREE.Mesh(geo,i%3?MAT.feuille:MAT.feuilleClaire); f.scale.set(1,l/(h-hPot),0.35);
    f.position.set(x+Math.sin(a)*Math.sin(inc)*l/2,base+Math.cos(inc)*l/2,z+Math.cos(a)*Math.sin(inc)*l/2);
    f.rotation.set(Math.cos(a)*inc,0,-Math.sin(a)*inc,'XYZ'); f.userData.fusion=true; parent.add(f);
  }
}

// Regroupe les pièces d'un meuble construit en code : une seule géométrie par matériau (beaucoup moins
// d'appels de dessin, important sur tablette). Seules les pièces marquées userData.fusion sont concernées.
export function fusionner(racine){
  racine.updateMatrixWorld(true);
  const inv=racine.matrixWorld.clone().invert(), lots=new Map(), pieces=[];
  racine.traverse(o=>{
    if(!o.userData.fusion) return;
    const ligne=o.isLineSegments, k=(ligne?'l':'m')+o.material.uuid;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    for(const a of Object.keys(g.attributes)) if(!(ligne?['position']:['position','normal','uv']).includes(a)) g.deleteAttribute(a);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));
    if(!lots.has(k)) lots.set(k,{mat:o.material,ligne,geos:[]});
    lots.get(k).geos.push(g); pieces.push(o);
  });
  for(const o of pieces) o.removeFromParent();
  for(const {mat,ligne,geos} of lots.values()){
    const g=mergeGeometries(geos,false), m=ligne?new THREE.LineSegments(g,mat):new THREE.Mesh(g,mat);
    if(ligne) m.raycast=()=>{};
    racine.add(m);
  }
  return racine;
}

// Copie un élément du modèle et le pose ailleurs : point d'appui d'origine → point d'appui voulu, puis rotation
export function copier(source,appuiOrigine,appuiCible,rotY){
  const c=source.clone(true); c.traverse(o=>{ if(o.isMesh) o.userData={}; });
  const pivot=new THREE.Group(); pivot.position.copy(appuiOrigine); pivot.updateMatrixWorld(true);
  pivot.attach(c); pivot.position.copy(appuiCible); pivot.rotation.y=rotY;
  return pivot;
}

// Surface plane visible seulement du dessous (plafonds) : quatre coins dans l'ordre du contour
export function plafond(coins,mat){
  const g=new THREE.BufferGeometry(), p=coins.flat();
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); g.setIndex([0,1,2,0,2,3]); g.computeVertexNormals();
  if(g.attributes.normal.getY(0)>0){ g.setIndex([0,2,1,0,3,2]); g.computeVertexNormals(); }
  return new THREE.Mesh(g,mat);
}
