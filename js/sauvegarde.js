// Sauvegarde locale de la disposition (position x/z, rotation, masqué, couleur ; depuis l'étape 4 : taille, matières,
// objets ajoutés, sols et murs des pièces). Depuis l'étape 3, c'est la copie de secours sur l'appareil : la disposition
// partagée est dans Airtable (synchro.js).
import {app, $} from './app.js';
import {select, buildList} from './edition.js';
import {etatDe, origineDe, egaux, normaliser, appliquerEtat, estSurface} from './etats.js';
import {creerAjout, supprimerAjout} from './ajouts.js';
import {lesSurfaces, nomsSurfaces, appliquerSurface} from './revetements.js';
import {etatAlertes, appliquerAlertes} from './alertes.js';
import {appel} from './api.js';
import {lesVariantes, varianteCourante, nouvelleListe} from './synchro.js';

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
// « Tout réinitialiser » (demande de Mauro du 10 octobre 2026 : ne rien perdre) : d'abord une copie de sauvegarde de la
// variante affichée (« Sauvegarde de « X » (10/10 14:32) », dans le menu des variantes), puis la disposition d'origine
async function copieDeSecours(){
  const v=varianteCourante(), d=lireDisposition(); if(!v||v.fixe||!Object.keys(d).length) return {ok:true,nom:null};
  const t=new Date(), deux=n=>String(n).padStart(2,'0');
  const nom=`Sauvegarde de « ${v.nom} » (${deux(t.getDate())}/${deux(t.getMonth()+1)} ${deux(t.getHours())}:${deux(t.getMinutes())})`.slice(0,80);
  const liste=lesVariantes().filter(x=>!x.fixe), ordre=liste.reduce((m,x)=>Math.max(m,x.ordre||0),0)+1;
  const r=await appel('variante',{op:'creer',nom,disposition:d,ordre});
  if(!r.ok) return {ok:false,horsLigne:r.horsLigne};
  nouvelleListe([...liste,{...r.variante,disposition:d}]); return {ok:true,nom};
}
export function initSauvegarde(){
  let armed=false;
  $('reset-all').onclick=async()=>{
    if(!armed){ armed=true; $('reset-all').textContent='Confirmer la réinitialisation'; setTimeout(()=>{armed=false;$('reset-all').textContent='Tout réinitialiser';},4000); return; }
    armed=false; $('reset-all').textContent='Tout réinitialiser'; $('reset-all').disabled=true;
    $('save-state').textContent='Copie de sauvegarde de la variante…';
    const c=await copieDeSecours(); $('reset-all').disabled=false;
    if(!c.ok){ $('save-state').textContent=c.horsLigne?'Hors connexion : la copie de sauvegarde n’a pas pu être faite, rien n’a été réinitialisé.':'La copie de sauvegarde a échoué : rien n’a été réinitialisé.'; return; }
    select(null); appliquerDisposition({},{silencieux:true}); buildList();
    save(); $('save-state').textContent='Disposition d’origine rétablie (annulable)'+(c.nom?' ; copie de sauvegarde : '+c.nom:'')+'.';
  };
}
