// Murs transparents (livraison 9) : case « Murs transparents » du menu « Calques », en vue maquette seulement (en
// 1re personne et sur le plan, les murs restent pleins). Murs à 30 %, sols, plafonds et meubles opaques.
// Les maillages de la structure mêlent murs, sols et plafonds : au premier usage, chacun est séparé en deux géométries qui
// partagent ses sommets (seuls les index diffèrent) : faces horizontales ou peu pentues (sols, plafonds, pan sud du toit),
// gardées opaques, et faces à plus de 45° (murs, muret, cloisons, pan nord du toit), mises dans un maillage à 30 %
// d'opacité vu des deux côtés, qui n'arrête pas les touchers (on sélectionne un meuble derrière un mur). La visite, le
// plan et les calques gardent la géométrie complète (copies faites au chargement, userData.geoComplete pour le plan).
import * as THREE from 'three';
import {app} from './app.js';
import {etat} from './calques.js';

const EXCLUS=['rez__escalier','rez__decor_entree','etage__garde_corps'], OPACITE=0.3;
let prets=null, actif=false;
const exclu=o=>{ for(;o;o=o.parent) if(EXCLUS.includes(o.name)) return true; return false; };
const clones=new Map();
function transparent(m){
  let c=clones.get(m.uuid);
  if(!c){ c=m.clone(); c.transparent=true; c.opacity=OPACITE; c.depthWrite=false; c.side=THREE.DoubleSide; c.polygonOffset=false; clones.set(m.uuid,c); }
  return c;
}
function preparer(){
  prets=[];
  const racine=app.model.children[0], liste=[]; if(!racine) return;
  racine.traverse(o=>{ if(o.isMesh&&!o.userData.dos&&!o.userData.vitre&&!o.userData.murTransparent&&!Array.isArray(o.material)&&!o.material.transparent&&!exclu(o)) liste.push(o); });
  const A=new THREE.Vector3(), B=new THREE.Vector3(), C=new THREE.Vector3();
  for(const o of liste){
    o.updateMatrixWorld(true);
    const g=o.geometry, pos=g.attributes.position, idx=g.index, n=idx?idx.count:pos.count, h=[], v=[];
    for(let k=0;k<n;k+=3){
      const a=idx?idx.getX(k):k, b=idx?idx.getX(k+1):k+1, c=idx?idx.getX(k+2):k+2;
      A.fromBufferAttribute(pos,a).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(pos,b).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(pos,c).applyMatrix4(o.matrixWorld);
      B.sub(A).cross(C.sub(A)); const L=B.length();
      (L>1e-12&&Math.abs(B.y/L)<0.7?v:h).push(a,b,c);
    }
    if(!v.length) continue;
    if(!g.boundingSphere) g.computeBoundingSphere();
    const geo=ix=>{ const r=new THREE.BufferGeometry(); for(const [k,at] of Object.entries(g.attributes)) r.setAttribute(k,at); r.setIndex(ix);
      r.boundingSphere=g.boundingSphere.clone(); return r; };
    const mur=new THREE.Mesh(geo(v),transparent(o.material)); mur.name='mur_transparent'; mur.raycast=()=>{}; mur.userData.murTransparent=true; mur.visible=false;
    o.add(mur); o.userData.geoComplete=g;
    prets.push({o,dos:o.children.find(c=>c.userData.dos),complete:g,horizontal:geo(h),mur});
  }
}
function appliquer(oui){
  if(oui&&!prets) preparer(); actif=oui; if(!prets) return;
  for(const p of prets){ const geo=oui?p.horizontal:p.complete; p.o.geometry=geo; if(p.dos) p.dos.geometry=geo; p.mur.visible=oui; }
}
// À chaque image : transparents si la case est cochée et qu'on est en maquette
export function majTransparence(){
  const voulu=!!etat.murs&&app.mode==='orbit'&&app.model.children.length>0;
  if(voulu!==actif) appliquer(voulu);
}
export const mursTransparents=()=>actif;
