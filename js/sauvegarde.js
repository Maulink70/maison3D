// Sauvegarde locale de la disposition (position x/z, rotation, masqué, couleur). Depuis l'étape 3, c'est la copie
// de secours sur l'appareil : la disposition partagée est dans Airtable (synchro.js).
import {app, $} from './app.js';
import {select, paint, resetItem, setHidden, buildList} from './edition.js';

const KEY='diolly3d-v1';
// disposition actuelle : les éléments qui ne sont pas à leur place d'origine
export function lireDisposition(){
  const d={}; for(const it of Object.values(app.items)){
    const moved=!it.g.position.equals(it.home)||it.g.rotation.y!==0;
    if(moved||it.hidden||it.color) d[it.name]={x:it.g.position.x,z:it.g.position.z,r:it.g.rotation.y,h:!!it.hidden,c:it.color||null};
  }
  return d;
}
// distant : changement venu d'ailleurs (autre appareil, autre variante) : ni journal local, ni renvoi au serveur
export function save(opts={}){
  try{ localStorage.setItem(KEY,JSON.stringify(lireDisposition())); if(!opts.distant) $('save-state').textContent='Enregistré dans ce navigateur.'; }
  catch{ $('save-state').textContent='Ce navigateur ne garde pas les changements.'; }
  dispatchEvent(new CustomEvent('disposition',{detail:{distant:!!opts.distant}}));   // historique (annuler / rétablir), alertes de passage, synchronisation
}
// met tout l'appartement dans la disposition d (les éléments absents de d reviennent à leur place d'origine)
export function appliquerDisposition(d){
  d=d||{};
  for(const it of Object.values(app.items)){
    const v=d[it.name];
    if(!v){ if(!it.g.position.equals(it.home)||it.g.rotation.y!==0||it.hidden||it.color) resetItem(it); continue; }
    it.g.position.x=+v.x; it.g.position.z=+v.z; it.g.rotation.set(0,+v.r||0,0);
    if((it.color||null)!==(v.c||null)) paint(it,v.c||null);
    if(!!it.hidden!==!!v.h) setHidden(it,!!v.h);
  }
  if(app.selected){ if(app.selected.hidden) select(null); else app.selBox?.update(); }
  save({distant:true});
}
export function restore(){
  let d={}; try{ d=JSON.parse(localStorage.getItem(KEY)||'{}'); }catch{}
  for(const [n,v] of Object.entries(d)){ const it=app.items[n]; if(!it) continue;
    it.g.position.x=v.x; it.g.position.z=v.z; it.g.rotation.y=v.r||0; if(v.c) paint(it,v.c); if(v.h){it.hidden=true;it.g.visible=false;} }
}
export function initSauvegarde(){
  let armed=false;
  $('reset-all').onclick=()=>{
    if(!armed){ armed=true; $('reset-all').textContent='Confirmer la réinitialisation'; setTimeout(()=>{armed=false;$('reset-all').textContent='Tout réinitialiser';},4000); return; }
    armed=false; $('reset-all').textContent='Tout réinitialiser';
    select(null); for(const it of Object.values(app.items)) resetItem(it); buildList();
    save(); $('save-state').textContent='Disposition d’origine rétablie (annulable).';
  };
}
