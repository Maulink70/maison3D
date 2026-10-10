// Sauvegarde locale de la disposition (position x/z, rotation, masqué, couleur ; depuis l'étape 4 : taille, matières,
// objets ajoutés, sols et murs des pièces). Depuis l'étape 3, c'est la copie de secours sur l'appareil : la disposition
// partagée est dans Airtable (synchro.js).
import {app, $} from './app.js';
import {select, buildList} from './edition.js';
import {etatDe, origineDe, egaux, normaliser, appliquerEtat, estSurface} from './etats.js';
import {creerAjout, supprimerAjout} from './ajouts.js';
import {lesSurfaces, nomsSurfaces, appliquerSurface} from './revetements.js';
import {etatAlertes, appliquerAlertes} from './alertes.js';

const KEY='diolly3d-v1';
// disposition actuelle : les éléments qui ne sont pas dans leur état d'origine, les objets ajoutés, les sols et murs habillés
export function lireDisposition(){
  const d={};
  for(const it of Object.values(app.items)){ const e=etatDe(it); if(it.ajout||!egaux(it.name,e,origineDe(it.name))) d[it.name]=e; }
  for(const [n,e] of lesSurfaces()) if(e) d[n]=e;
  const ea=normaliser('alertes',etatAlertes()); if(ea) d.alertes=ea;   // alertes ignorées, gardées avec la variante
  return d;
}
// distant : changement venu d'ailleurs (autre appareil, autre variante) : ni journal local, ni renvoi au serveur
export function save(opts={}){
  try{ localStorage.setItem(KEY,JSON.stringify(lireDisposition())); if(!opts.distant) $('save-state').textContent='Enregistré dans ce navigateur.'; }
  catch{ $('save-state').textContent='Ce navigateur ne garde pas les changements.'; }
  dispatchEvent(new CustomEvent('disposition',{detail:{distant:!!opts.distant}}));   // historique (annuler / rétablir), alertes de passage, synchronisation
}
// met tout l'appartement dans la disposition d (les éléments absents de d reviennent à leur état d'origine, les objets
// ajoutés absents sont retirés). silencieux : sans évènement (reprise au chargement)
export function appliquerDisposition(d,{silencieux=false}={}){
  d=d||{}; let liste=false;
  for(const [n,e] of Object.entries(d)) if(e?.a&&!estSurface(n)&&!app.items[n]){ if(creerAjout(n,normaliser(n,e))) liste=true; }
  for(const it of Object.values(app.items)) if(it.ajout&&!d[it.name]){ supprimerAjout(it.name); liste=true; }
  for(const it of Object.values(app.items)) appliquerEtat(it,normaliser(it.name,d[it.name])||origineDe(it.name));
  for(const n of nomsSurfaces()) appliquerSurface(n,normaliser(n,d[n]));
  appliquerAlertes(normaliser('alertes',d.alertes));
  if(liste) dispatchEvent(new CustomEvent('meubles'));
  if(app.selected){ if(app.selected.hidden||!app.items[app.selected.name]) select(null); else app.selBox?.update(); }
  if(!silencieux) save({distant:true});
}
export function restore(){
  let d={}; try{ d=JSON.parse(localStorage.getItem(KEY)||'{}'); }catch{}
  appliquerDisposition(d,{silencieux:true});
}
export function initSauvegarde(){
  let armed=false;
  $('reset-all').onclick=()=>{
    if(!armed){ armed=true; $('reset-all').textContent='Confirmer la réinitialisation'; setTimeout(()=>{armed=false;$('reset-all').textContent='Tout réinitialiser';},4000); return; }
    armed=false; $('reset-all').textContent='Tout réinitialiser';
    select(null); appliquerDisposition({},{silencieux:true}); buildList();
    save(); $('save-state').textContent='Disposition d’origine rétablie (annulable).';
  };
}
