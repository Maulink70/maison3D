// Reflets des objets 3D importés (fichier, Tripo, catalogue ; demande de Mauro du 11 octobre 2026 : l'inox d'une machine à
// espresso paraissait terne, la maquette n'ayant rien à refléter). Une pièce « studio » (RoomEnvironment de three.js),
// préfiltrée une fois (PMREM), sert de reflet à leurs matériaux et à eux seuls : le reste de la maquette ne change pas.
// Seule la part « reflet » de cet environnement est gardée (shader : l'éclairage diffus qu'il ajouterait est retiré) :
// l'objet reste éclairé comme les autres meubles, le métal reflète, une surface mate gagne à peine un lustre. Les parties
// métalliques sont celles que le modèle déclare (texture « métal / brillance » des modèles PBR). Force selon la lumière du jour.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {app} from './app.js';
import {etat} from './calques.js';

const FORCE={normale:1,matin:0.85,midi:1,soir:0.65,nuit:0.2};
let env=null, force=null;
function carte(){
  if(!env){ const p=new THREE.PMREMGenerator(app.renderer), piece=new RoomEnvironment();
    env=p.fromScene(piece,0.04).texture; piece.traverse(o=>{ o.geometry?.dispose(); o.material?.dispose?.(); }); p.dispose(); }
  return env;
}
const CHUNK=THREE.ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );','');
function sansDiffus(shader){ shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',CHUNK); }
const forceDu=()=>FORCE[etat.lumiere]??1;
export const estImporte=it=>it?.ajout?.t==='glb';

// matériaux affichés d'un objet importé (une copie de matériau perd onBeforeCompile : on le remet)
export function refleter(it){
  if(!estImporte(it)) return;
  const f=forceDu();
  for(const o of it.mats){ const m=o.material;
    if(!m?.isMeshStandardMaterial) continue;
    if(m.envMap!==carte()||m.onBeforeCompile!==sansDiffus){ m.envMap=carte(); m.onBeforeCompile=sansDiffus; m.needsUpdate=true; }
    m.envMapIntensity=f; }
}
addEventListener('apparence',e=>refleter(e.detail.it));   // objet prêt, couleur, matières, comparaison
// à chaque image : force qui suit la lumière du jour (rien à faire tant qu'elle ne change pas)
export function majReflets(){
  const f=forceDu(); if(f===force) return; force=f;
  for(const it of Object.values(app.items)) if(estImporte(it)) for(const o of it.mats) if(o.material?.envMap===env&&env) o.material.envMapIntensity=f;
}
