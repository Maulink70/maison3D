// Reflets des objets 3D importés (fichier, Tripo, catalogue ; demande de Mauro du 11 octobre 2026 : l'inox d'une machine à
// espresso paraissait terne, la maquette n'ayant rien à refléter). Une pièce « studio » (RoomEnvironment de three.js),
// préfiltrée une fois (PMREM), sert de reflet à leurs matériaux et à eux seuls : le reste de la maquette ne change pas.
// Seule la part « reflet » de cet environnement est gardée (shader : l'éclairage diffus qu'il ajouterait est retiré) :
// l'objet reste éclairé comme les autres meubles, le métal reflète, une surface mate gagne à peine un lustre. Les parties
// métalliques sont celles que le modèle déclare (texture « métal / brillance » des modèles PBR). Force selon la lumière du jour.
// En rendu réaliste (realiste.js, 14 octobre 2026), toute la maquette reçoit cet environnement, diffus compris : les objets
// importés le prennent alors comme les autres (plus de reflet propre, sinon ils seraient plus sombres que le reste).
import * as THREE from 'three';
import {app} from './app.js';
import {etat} from './calques.js';
import {environnement as carte, FORCE, renduReel} from './realiste.js';

let force=null;
const DEFAUT=THREE.Material.prototype.onBeforeCompile;
const CHUNK=THREE.ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );','');
function sansDiffus(shader){ shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',CHUNK); }
const forceDu=()=>FORCE[etat.lumiere]??1;
export const estImporte=it=>it?.ajout?.t==='glb';
export const RUGOSITE_MIN=0.35;

// matériaux affichés d'un objet importé (une copie de matériau perd onBeforeCompile : on le remet)
export function refleter(it){
  if(!estImporte(it)) return;
  const f=forceDu(), reel=renduReel();
  for(const o of it.mats){ const m=o.material;
    if(!m?.isMeshStandardMaterial) continue;
    // rendu réaliste : l'environnement « studio » se reflétait trop net sur les matières très lisses (granit noir de l'îlot,
    // audit du 15 octobre 2026, « Corrige » de Mauro) : rugosité d'au moins RUGOSITE_MIN, la valeur d'origine remise en rendu normal
    if(reel){ if(m.envMap===carte()||m.onBeforeCompile===sansDiffus){ m.envMap=null; m.onBeforeCompile=DEFAUT; m.envMapIntensity=1; m.needsUpdate=true; }
      if(m.roughness<RUGOSITE_MIN){ if(m.userData.rugosite0===undefined) m.userData.rugosite0=m.roughness; m.roughness=RUGOSITE_MIN; } continue; }
    if(m.userData.rugosite0!==undefined){ m.roughness=m.userData.rugosite0; delete m.userData.rugosite0; }
    if(m.envMap!==carte()||m.onBeforeCompile!==sansDiffus){ m.envMap=carte(); m.onBeforeCompile=sansDiffus; m.needsUpdate=true; }
    m.envMapIntensity=f; }
}
addEventListener('apparence',e=>refleter(e.detail.it));   // objet prêt, couleur, matières, comparaison
addEventListener('rendu',()=>{ force=null; for(const it of Object.values(app.items)) refleter(it); });   // rendu normal ↔ réaliste
// à chaque image : force qui suit la lumière du jour (rien à faire tant qu'elle ne change pas)
export function majReflets(){
  const f=forceDu(); if(f===force) return; force=f;
  for(const it of Object.values(app.items)) if(estImporte(it)) for(const o of it.mats) if(o.material?.envMap===carte()) o.material.envMapIntensity=f;
}
