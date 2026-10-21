// « Appart Base » (grand ménage du 15 octobre 2026, demande de Mauro) : l'appartement tel qu'il est, intouchable, seule base
// au départ. C'est l'ancienne variante « Projet 4 » de la base « Réalisme » (141 objets faits dans Blender, à leur place),
// gelée dans le dépôt : modele/base.json (objets : place, orientation, définition avec leur fichier modele/objets/<id>.glb ;
// meubles de la maquette SketchUp et construits en code à retirer ; portes et fenêtres de la maquette gardées en coulisses,
// masquées, pour la mécanique d'ouverture des portes et fenêtres de Blender : ouvrants3d.js). Les objets de la base sont des
// éléments d'origine (it.base, it.etat0) : une disposition ne garde que ce qui en diffère, « Tout réinitialiser » y revient,
// les alertes de passage les prennent pour référence, ils se masquent mais ne se suppriment pas. Les anciens fichiers restent
// dans Airtable (table Fichiers) ; les anciennes variantes y sont gardées, case « Supprimée ».
import {app} from './app.js';
import {creerAjout} from './ajouts.js';
import {normaliser} from './etats.js';
import {setHidden} from './edition.js';

export const FICHIER_BASE='modele/base.json';
let base=null;
export async function chargerBase(){
  try{ const r=await fetch(FICHIER_BASE,{cache:'no-store'}); base=r.ok?await r.json():null; }catch{ base=null; }
  if(!base||typeof base.objets!=='object'){ base=null; console.warn('Appart Base : '+FICHIER_BASE+' introuvable, maquette d’origine seule'); }
  return base;
}
export const baseChargee=()=>base;
export const nomBase=()=>base?.nom||'Appart Base';
export const estRetire=n=>!!base&&base.retires.includes(n);
export const estCoulisses=n=>!!base&&base.coulisses.includes(n);
// les objets de la base : [{n, e}] (e : état complet, avec sa définition a)
// (sans le décor fixe : plinthes, hors de « Mes objets 3D »)
export const objetsDeBase=()=>base?Object.entries(base.objets).filter(([,e])=>!e.decor).map(([n,e])=>({n,e})):[];
// après le mobilier de la maquette (modele.js) : portes et fenêtres de la maquette en coulisses, puis les objets de la base
export function installerBase(){
  if(!base||!app.mobilier) return 0; let n=0;
  for(const nom of base.coulisses){ const it=app.items[nom]; if(!it) continue; it.coulisses=true; setHidden(it,true); }
  for(const [nom,e] of Object.entries(base.objets)){
    if(app.items[nom]) continue;
    // decor : élément fixe (plinthes, 21 octobre 2026), ni sélectionnable ni dans la liste (creerAjout)
    const e0=normaliser(nom,e), it=creerAjout(nom,e0,!!e.decor); if(!it) continue;
    it.base=true; it.etat0=e0; n++;
  }
  return n;
}
