// Isoler une pièce (livraison 10) : dans « Aller à », en maquette, choix « Isoler » : la vue se cadre sur la pièce et la
// maquette ne montre qu'elle (avec l'épaisseur de ses murs), le reste de l'appartement en pâle ou masqué. Bandeau sous la
// barre : pièce isolée, « Pâle | Masqué » (choix mémorisé), « Tout afficher ». Changer de vue ou de niveau rend tout.
// Rendu en plusieurs passes (rendreIsole, appelé par main.js) : la pièce rectangle par rectangle (coupes verticales
// 35 cm au-delà de chaque rectangle, pour garder ses murs), puis, en pâle, tout le reste avec un matériau blanc
// transparent qui ne s'affiche que devant ce qui est déjà dessiné (test de profondeur strict : la pièce n'est pas voilée).
// Les calques ne montrent que la pièce ; on ne sélectionne que ce qui est dans la pièce.
import * as THREE from 'three';
import {app, $} from './app.js';
import {PIECES} from './pieces.js';

const E=0.35, CLE='maison3d-isoler';
export const isolement={piece:null,reste:'pale'};
try{ const r=localStorage.getItem(CLE); if(r==='masque'||r==='pale') isolement.reste=r; }catch{}
const fantome=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.2,depthWrite:false,depthFunc:THREE.LessDepth});
let plans=[];
const pieceIsolee=()=>PIECES.find(p=>p.id===isolement.piece);
export const isolementActif=()=>!!isolement.piece&&app.mode==='orbit';

// un point (mètres) est-il dans la pièce isolée (rectangles + 35 cm) ?
export function dansIsolement(p){
  if(!isolementActif()) return true; const q=pieceIsolee(); if(!q) return true;
  return q.rects.some(r=>p.x>=r[0]-E&&p.x<=r[2]+E&&p.z>=r[1]-E&&p.z<=r[3]+E);
}
export function isoler(id){
  const p=PIECES.find(q=>q.id===id); if(!p) return;
  isolement.piece=id;
  plans=p.rects.map(r=>[new THREE.Plane(new THREE.Vector3(1,0,0),-(r[0]-E)),new THREE.Plane(new THREE.Vector3(-1,0,0),r[2]+E),
    new THREE.Plane(new THREE.Vector3(0,0,1),-(r[1]-E)),new THREE.Plane(new THREE.Vector3(0,0,-1),r[3]+E)]);
  majBandeau();
}
export function toutAfficher(){ isolement.piece=null; plans=[]; majBandeau(); }
function reste(r){ isolement.reste=r; try{ localStorage.setItem(CLE,r); }catch{} majBandeau(); }
function majBandeau(){
  const b=$('bandeau-isole'), p=pieceIsolee(); b.hidden=!p||app.mode!=='orbit'; if(b.hidden) return;
  $('isole-texte').textContent='Pièce isolée : '+p.nom;
  $('isole-pale').setAttribute('aria-pressed',String(isolement.reste==='pale')); $('isole-masque').setAttribute('aria-pressed',String(isolement.reste==='masque'));
}
// la pièce, rectangle par rectangle, puis le reste en pâle
// (après la 1re passe, ni effacement ni fond : un fond de couleur efface l'image à chaque rendu, même sans autoClear)
export function rendreIsole(cam){
  const {renderer,scene}=app, base=renderer.clippingPlanes, ac=renderer.autoClear, fond=scene.background;
  try{
    for(const b of plans){ renderer.clippingPlanes=[...base,...b]; renderer.render(scene,cam); renderer.autoClear=false; scene.background=null; }
    if(isolement.reste==='pale'){ renderer.clippingPlanes=base; scene.overrideMaterial=fantome; renderer.render(scene,cam); }
  } finally { scene.overrideMaterial=null; scene.background=fond; renderer.clippingPlanes=base; renderer.autoClear=ac; }
}
export function initIsoler(){
  $('isole-pale').onclick=()=>reste('pale'); $('isole-masque').onclick=()=>reste('masque'); $('isole-fin').onclick=toutAfficher;
  // changer de niveau ou de vue rend tout l'appartement (« Aller à » isole après son propre changement de niveau)
  addEventListener('niveau',()=>{ if(isolement.piece) toutAfficher(); });
}
