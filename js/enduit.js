// Enduit des murs en photo (15 octobre 2026, Mauro : « le côté un peu plus granuleux serait sympa », « go pour le grain léger ») :
// la peinture des murs et des plafonds de la maquette (« Material_6 » au rez, « Material_363 » à l'étage, motif « peinture » dessiné
// en code par matieres.js, coordonnées de texture déjà en mètres) reçoit le grain d'un vrai enduit, « white_stucco » de Poly Haven
// (textures/enduit_*.webp : couleur ramenée au blanc par convertir.py --blanchir, carte de normales, rugosité ; motif de 2 m).
// La couleur du matériau (teinte des murs choisie par Mauro) est gardée : seul le relief change. Rien n'est remodelé ; la lumière
// précalculée (uv1) et les murs transparents ne sont pas touchés. Toute copie de la peinture (dos des faces, murs transparents,
// copies de la lumière précalculée) garde le motif « peinture » dans ses userData : elle reçoit l'enduit aussi.
import * as THREE from 'three';
import {app} from './app.js';

export const ENDUIT={motif:'peinture', taille:2.0, dossier:'textures/', version:1, normales:0.8, rugosite:1};

let etat='', cartes=null;
export const enduitPose=()=>etat==='pose';

function charger(fichier,srgb){
  return new Promise((ok,non)=>new THREE.TextureLoader().load(ENDUIT.dossier+fichier+'?v='+ENDUIT.version,t=>{
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=Math.min(8,app.renderer.capabilities.getMaxAnisotropy());
    if(srgb) t.colorSpace=THREE.SRGBColorSpace; ok(t); },undefined,non));
}

// pose les cartes sur chaque matériau de peinture de la structure ; peut être rappelé (copies faites après le chargement)
export function poserEnduit(){
  const racine=app.model?.children[0]; if(!racine||!cartes) return 0;
  const faits=new Set();
  racine.traverse(o=>{ if(!o.isMesh||!o.material||Array.isArray(o.material)) return; const m=o.material;
    if(m.userData.motif!==ENDUIT.motif||faits.has(m)) return; faits.add(m);
    if(m.userData.enduit===ENDUIT.version&&m.normalMap===cartes.normales) return;
    const rep=(m.userData.taille||0.5)/ENDUIT.taille;   // coordonnées à « taille » m par unité → motif de l'enduit en mètres
    for(const t of [cartes.couleur,cartes.normales,cartes.rugosite]) t.repeat.set(rep,rep);
    m.map=cartes.couleur; m.bumpMap=null; m.normalMap=cartes.normales; m.normalScale.set(ENDUIT.normales,ENDUIT.normales);
    m.roughnessMap=cartes.rugosite; m.roughness=ENDUIT.rugosite; m.userData.enduit=ENDUIT.version; m.needsUpdate=true; });
  return faits.size;
}

// au chargement de la structure : les trois images sont chargées puis posées ensemble (la peinture dessinée en code reste en attendant)
export function chargerEnduit(){
  if(etat) return; etat='attente';
  Promise.all([charger('enduit_couleur.webp',true),charger('enduit_normales.webp',false),charger('enduit_rugosite.webp',false)])
    .then(([couleur,normales,rugosite])=>{ cartes={couleur,normales,rugosite}; const n=poserEnduit(); etat='pose';
      dispatchEvent(new CustomEvent('enduit',{detail:{materiaux:n}})); })
    .catch(e=>{ etat='echec'; console.warn('Enduit en photo indisponible, peinture dessinée en code gardée :',e?.message||e); });
  // copies de la peinture faites plus tard (lumière précalculée après le mobilier) : l'enduit y est reposé
  addEventListener('cuisson',()=>poserEnduit());
}
