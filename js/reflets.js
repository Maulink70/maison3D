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
import {filtreLumiere} from './curseurs.js';
import {estEcran} from './ecrans.js';

let force=null;
const DEFAUT=THREE.Material.prototype.onBeforeCompile;
const CHUNK=THREE.ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );','');
function sansDiffus(shader){ shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',CHUNK); }
const forceDu=()=>(FORCE[etat.lumiere]??1)*filtreLumiere(etat.lumiere);   // filtre du menu « Lumière » (curseurs.js)
export const estImporte=it=>it?.ajout?.t==='glb';
export const RUGOSITE_MIN=0.35;
// Pierre polie (le granit noir de la cuisine, matière Blender « Granit_Noir ») : le soir et la nuit, l'environnement « studio » est presque
// éteint (FORCE de realiste.js : 0,65 et 0,2) et les 5 spots LED s'y reflètent en petits points nets au lieu de gros halos mous (Mauro,
// 15 octobre 2026 : « les reflets donnent pas bien du tout ») ; de jour, 0,35 comme tout le reste. Seule la pierre polie descend sous
// 0,35 : le 16 octobre 2026, un plancher de 0,12 posé sur toutes les matières importées faisait briller chaque source en point net sur
// les vitres des fenêtres, les chromes, la vitre du four, les miroirs, les écrans (Mauro : « des reflets très mal placés »).
export const PIERRE_POLIE=/granit|granite|marbre|marble|quartz|pierre/i, RUGOSITE_PIERRE={soir:0.22,nuit:0.18};
// écrans éteints (ecrans.js, 21 octobre 2026) : verre lisse, le reflet de la pièce s'y voit ; allumés, 0,35 comme le reste
const rugositeMin=m=>(PIERRE_POLIE.test(m.userData?.nom||'')&&RUGOSITE_PIERRE[etat.lumiere])||(estEcran(m)&&!m.userData.ecranAllume&&RUGOSITE_ECRAN)||RUGOSITE_MIN;
export const RUGOSITE_ECRAN=0.12;
let rugoDernier=null;

// matériaux affichés d'un objet importé (une copie de matériau perd onBeforeCompile : on le remet)
export function refleter(it){
  if(!estImporte(it)) return;
  const f=forceDu(), reel=renduReel();
  for(const o of it.mats){ const m=o.material;
    if(!m?.isMeshStandardMaterial) continue;
    // rendu réaliste : l'environnement « studio » se reflétait trop net sur les matières très lisses (granit noir de l'îlot,
    // audit du 15 octobre 2026, « Corrige » de Mauro) : rugosité d'au moins RUGOSITE_MIN, la valeur d'origine remise en rendu normal
    if(reel){ if(m.envMap===carte()||m.onBeforeCompile===sansDiffus){ m.envMap=null; m.onBeforeCompile=DEFAUT; m.envMapIntensity=1; m.needsUpdate=true; }
      const r0=m.userData.rugosite0??m.roughness, rm=rugositeMin(m);
      if(r0<rm){ m.userData.rugosite0=r0; m.roughness=rm; } else if(m.userData.rugosite0!==undefined) m.roughness=m.userData.rugosite0; continue; }
    if(m.userData.rugosite0!==undefined){ m.roughness=m.userData.rugosite0; delete m.userData.rugosite0; }
    if(m.envMap!==carte()||m.onBeforeCompile!==sansDiffus){ m.envMap=carte(); m.onBeforeCompile=sansDiffus; m.needsUpdate=true; }
    m.envMapIntensity=f; }
}
addEventListener('apparence',e=>refleter(e.detail.it));   // objet prêt, couleur, matières, comparaison
addEventListener('rendu',()=>{ force=null; for(const it of Object.values(app.items)) refleter(it); });   // rendu normal ↔ réaliste
// à chaque image : force qui suit la lumière du jour (rien à faire tant qu'elle ne change pas)
export function majReflets(){
  if(etat.lumiere!==rugoDernier){ rugoDernier=etat.lumiere; for(const it of Object.values(app.items)) refleter(it); }   // jour ↔ soir ↔ nuit : rugosité minimale de la pierre polie
  const f=forceDu(); if(f===force) return; force=f;
  for(const it of Object.values(app.items)) if(estImporte(it)) for(const o of it.mats) if(o.material?.envMap===carte()) o.material.envMapIntensity=f;
}
