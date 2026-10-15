// Ombres portées du soleil en direct (audit du 15 octobre 2026, « ok » de Mauro) : case « Ombres du soleil (plus lent) »
// dans le menu du bouton « Réaliste » de la barre (sous les ombres de contact ; Mauro, 15 octobre 2026 : « dans l'icône
// Réaliste »), décochée d'office (coûteuse sur tablette).
// Le soleil de lumiere.js (app.lumieres.sun) projette une carte d'ombres de 2048 px sur toute la maison (caméra d'ombre
// orthographique centrée sur l'appartement, dans la direction du soleil) ; murs, sols, toits et meubles portent et
// reçoivent les ombres, les vitres et ce qui est transparent n'en portent pas. Rien n'est changé tant que la case est
// décochée : les matériaux ne sont recompilés qu'à la première activation. Choix gardé sur l'appareil (clé maison3d-ombres).
import * as THREE from 'three';
import {app} from './app.js';

const CLE='maison3d-ombres';
let actif=false, prepare=false, sale=true;
const CENTRE=new THREE.Vector3(15.4,1.5,-21.2);   // centre de la maison
const DIST=60;                                   // distance du soleil au centre (m)

try{ actif=!!JSON.parse(localStorage.getItem(CLE)||'false'); }catch{}
const transparent=m=>!m||m.depthWrite===false||(m.transparent&&m.opacity<0.95);
// qui porte et reçoit l'ombre : tout ce qui est dessiné, sauf le dehors (ciel), les vitres et les objets transparents
function marquer(){
  app.scene.traverse(o=>{ if(!o.isMesh||o.name==='ciel') return;
    if(o.parent?.name==='ciel'||estDehors(o)) return;
    const mats=[].concat(o.material), opaque=mats.some(m=>!transparent(m));
    o.castShadow=opaque&&!o.userData.collider&&o.name!=='alerte'; o.receiveShadow=true; });
  sale=false;
}
function estDehors(o){ for(let p=o.parent;p;p=p.parent) if(p.name==='ciel') return true; return false; }
function regler(){
  const r=app.renderer, sun=app.lumieres.sun;
  r.shadowMap.enabled=actif; r.shadowMap.type=THREE.PCFSoftShadowMap; sun.castShadow=actif;
  if(!actif){ app.scene.traverse(o=>{ if(o.isMesh&&o.material){ [].concat(o.material).forEach(m=>{ m.needsUpdate=true; }); } }); return; }
  if(!prepare){ prepare=true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.03;
    const c=sun.shadow.camera; c.left=-11; c.right=11; c.top=11; c.bottom=-11; c.near=1; c.far=DIST*2.5; c.updateProjectionMatrix();
    sun.target.position.copy(CENTRE); app.scene.add(sun.target); }
  sale=true;
}
export const ombresSoleil=()=>actif;
// appelé à chaque image par main.js : garde le soleil pointé sur la maison et marque les nouveaux maillages.
// lumiere.js pose le soleil à une position absolue (direction depuis l'origine, cible à l'origine) ; une fois la cible
// mise au centre de la maison, on le remet à DIST m du centre dans la même direction, que les ombres soient actives ou
// non (la direction de la lumière ne change donc jamais) ; une position inconnue = lumiere.js vient d'en poser une autre
const dir=new THREE.Vector3(), posee=new THREE.Vector3(NaN,NaN,NaN);
export function majOmbres(){
  if(!prepare) return;
  const sun=app.lumieres.sun;
  if(!sun.position.equals(posee)){ dir.copy(sun.position); if(dir.y<2) dir.y=2; dir.normalize(); sun.position.copy(CENTRE).addScaledVector(dir,DIST); posee.copy(sun.position); }
  if(actif&&sale) marquer();
}
export function initOmbres(){
  for(const ev of ['objet-pret','meubles','apparence','mobilier']) addEventListener(ev,()=>{ sale=true; });
  const c=document.getElementById('cq-soleil'); if(!c) return; c.checked=actif;
  c.onchange=()=>{ actif=c.checked; try{ localStorage.setItem(CLE,JSON.stringify(actif)); }catch{} regler(); };
  if(actif) regler();
}
