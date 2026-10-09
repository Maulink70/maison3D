// Sauvegarde locale de la disposition (position x/z, rotation, masqué, couleur)
import {app, $} from './app.js';
import {select, paint, resetItem, buildList} from './edition.js';

const KEY='diolly3d-v1';
export function save(){
  const d={}; for(const it of Object.values(app.items)){
    const moved=!it.g.position.equals(it.home)||it.g.rotation.y!==0;
    if(moved||it.hidden||it.color) d[it.name]={x:it.g.position.x,z:it.g.position.z,r:it.g.rotation.y,h:it.hidden,c:it.color};
  }
  try{ localStorage.setItem(KEY,JSON.stringify(d)); $('save-state').textContent='Enregistré dans ce navigateur.'; }
  catch{ $('save-state').textContent='Ce navigateur ne garde pas les changements.'; }
  dispatchEvent(new CustomEvent('disposition'));   // historique (annuler / rétablir), alertes de passage
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
