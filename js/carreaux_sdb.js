// Carreaux de pierre de la salle de bain du rez en photo (20 octobre 2026, textures préparées dans Blender par la session
// BLENDER d'après la photo « Salle de bain 3 », lot « salle de bain du rez » envoyé par Mauro). Deux jeux d'images de
// 1,20 × 0,60 m (2 × 2 carreaux de 60 × 30 cm posés en largeur, joints de 3 mm) : murs (carrelerMursSdb de rez_pieces.js)
// et sol (matériau « Material_10 » du modèle, rangée du bas décalée d'un demi-carreau). Couleur en gris neutre autour de
// 0,5 linéaire, teintée par la couleur du matériau ; carte de normales (relief) et rugosité. Elles remplacent le carreau
// dessiné en code (texturesCarreauPierre) ; tant qu'elles ne sont pas arrivées, le matériau garde son aspect d'avant.
import * as THREE from 'three';
import {app} from './app.js';
import {uvMetres} from './matieres.js';

export const CARREAUX_SDB={dossier:'textures/', version:1, L:1.20, H:0.60, normales:0.8,
  // le gris de la photo est à 0,5 linéaire, celui du carreau dessiné en code à ~0,79 : la teinte est remontée d'autant
  gain:1.55,
  // sol : gris foncé du modèle gardé (Mauro, 12 octobre 2026), même clarté moyenne que la texture SketchUp
  sol:{nom:'Material_10', teinte:0x56575a}};
const jeux={};
function charger(type){
  if(jeux[type]) return jeux[type];
  const un=(f,srgb)=>new Promise((ok,non)=>new THREE.TextureLoader().load(CARREAUX_SDB.dossier+'sdb_'+type+'_'+f+'.webp?v='+CARREAUX_SDB.version,t=>{
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=Math.min(8,app.renderer?.capabilities.getMaxAnisotropy()||1);
    if(srgb) t.colorSpace=THREE.SRGBColorSpace; ok(t); },undefined,non));
  return jeux[type]=Promise.all([un('couleur',true),un('relief',false),un('rugosite',false)]);
}
// Pose les images sur les matériaux (teinte : couleur voulue, multipliée par le gain)
export function habillerCarreaux(mats,type){
  return charger(type).then(([couleur,relief,rugosite])=>{
    // les dos des faces (doublerFaces de modele.js) ont une copie du matériau : habillée de même
    const teintes=new Map(mats); app.scene.traverse(o=>{ if(o.isMesh&&o.userData.dos&&teintes.has(o.parent?.material)) mats.push([o.material,teintes.get(o.parent.material)]); });
    for(const [m,teinte] of mats){ m.map=couleur; m.normalMap=relief; m.normalScale.set(CARREAUX_SDB.normales,CARREAUX_SDB.normales);
      m.bumpMap=null; m.roughnessMap=rugosite; m.roughness=1; m.metalness=0;
      m.color.set(teinte).multiplyScalar(CARREAUX_SDB.gain); m.userData.carreauxPhoto=type; m.needsUpdate=true; }
    dispatchEvent(new CustomEvent('carreaux-sdb',{detail:{type,materiaux:mats.length}}));
    return mats.length;
  }).catch(e=>{ console.warn('Carreaux de la salle de bain en photo indisponibles :',e?.message||e); return 0; });
}
// Sol de la salle de bain : coordonnées de texture en mètres (u = x / 1,20, v = z / 0,60), appelé à structurePrete avant
// preparerStructure() de cuisson.js (comme les parquets : mêmes sommets, l'empreinte de la lumière précalculée reste juste)
export function poserSolSdb(){
  const racine=app.model?.children[0]; if(!racine) return 0;
  const {L,H,sol}=CARREAUX_SDB, mats=new Map();
  racine.traverse(o=>{ if(!o.isMesh||o.userData.dos||!o.material||Array.isArray(o.material)||o.material.name!==sol.nom) return;
    uvMetres(o,1); const uv=o.geometry.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)/L,uv.getY(i)/H);
    for(const c of o.children) if(c.userData.dos) c.geometry=o.geometry;
    mats.set(o.material,sol.teinte); });
  if(mats.size) habillerCarreaux([...mats],'sol');
  return mats.size;
}
