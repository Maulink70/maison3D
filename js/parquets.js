// Parquets en photo (15 octobre 2026, phase 2 du lot « réalisme » réduite aux parquets par Mauro : « Faisons que les
// parquets uniquement », après un essai avant / après sur le salon). Tous les sols en parquet de la maquette (salon, cuisine,
// entrée, dégagement, chambre, mezzanine, dressing, chambre de l'étage, parquet refait sous l'armoire du dégagement)
// partagent le matériau « Material_7 » de SketchUp (texture de 619 × 1024 px, lames larges, orangée). Au chargement de la
// structure, il reçoit une vraie photo de parquet : « wooden_floor_01 » de Poly Haven (CC0, textures/LICENCE.txt), lames
// étroites à joints décalés, teinte miel, motif de 1,99 m, couleur + normales + rugosité en WebP 1024 px (≈ 290 Ko en tout,
// cache d'abord par sw.js). Les coordonnées de texture sont recalculées en mètres (uvMetres de matieres.js) : les lames sont
// continues d'une pièce à l'autre et à la même échelle partout ; le dos de chaque sol (doublerFaces) reprend la géométrie.
// Fait avant preparerStructure() de cuisson.js : la géométrie non indexée a les mêmes sommets dans le même ordre, l'empreinte
// de la lumière précalculée reste juste et uv1 se pose dessus. Les images arrivent après : la texture SketchUp reste le temps
// du chargement, les trois cartes sont posées ensemble (jamais de sol noir).
import * as THREE from 'three';
import {app} from './app.js';
import {uvMetres} from './matieres.js';

export const PARQUET={nom:'Material_7', taille:1.99, dossier:'textures/', version:1, teinte:0xffffff, rugosite:1, normales:0.8};
let etat='';   // '' | 'attente' | 'pose' | 'echec'
export const parquetsPoses=()=>etat==='pose';

function charger(fichier,srgb){
  return new Promise((ok,non)=>new THREE.TextureLoader().load(PARQUET.dossier+fichier+'?v='+PARQUET.version,t=>{
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=Math.min(8,app.renderer.capabilities.getMaxAnisotropy());
    if(srgb) t.colorSpace=THREE.SRGBColorSpace; ok(t); },undefined,non));
}
// appelé à structurePrete (main.js), avant preparerStructure() de cuisson.js ; renvoie le nombre de matériaux habillés
export function poserParquets(){
  const racine=app.model?.children[0]; if(!racine) return 0;
  const mats=new Set();
  racine.traverse(o=>{ if(!o.isMesh||o.userData.dos||!o.material||Array.isArray(o.material)||o.material.name!==PARQUET.nom) return;
    uvMetres(o,PARQUET.taille);
    for(const c of o.children) if(c.userData.dos) c.geometry=o.geometry;
    mats.add(o.material); });
  if(!mats.size) return 0;
  etat='attente';
  Promise.all([charger('parquet_couleur.webp',true),charger('parquet_normales.webp',false),charger('parquet_rugosite.webp',false)]).then(([couleur,normales,rugosite])=>{
    for(const m of mats){ m.map=couleur; m.normalMap=normales; m.normalScale.set(PARQUET.normales,PARQUET.normales); m.roughnessMap=rugosite;
      m.roughness=PARQUET.rugosite; m.metalness=0; m.color.set(PARQUET.teinte); m.needsUpdate=true; }
    etat='pose'; dispatchEvent(new CustomEvent('parquets',{detail:{materiaux:mats.size}}));
  }).catch(e=>{ etat='echec'; console.warn('Parquet en photo indisponible, texture SketchUp gardée :',e?.message||e); });
  return mats.size;
}
