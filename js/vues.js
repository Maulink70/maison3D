// Modes (maquette / visite) et niveaux (tout / rez / étage)
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR, REZ_CUT, ROOF_CUT} from './config.js';
import {enterWalk} from './visite.js';

export function setLevel(l){
  const {renderer,orbit,camera,CENTER}=app;
  app.level=l; for(const k of ['all','rez','etage']) $('l-'+k).setAttribute('aria-pressed',String(k===l));
  if(app.mode==='walk'){ enterWalk(l==='etage'?'etage':'rez'); return; }
  const cut=l==='rez'?REZ_CUT:l==='etage'?ROOF_CUT:null;
  renderer.clippingPlanes=cut?[new THREE.Plane(new THREE.Vector3(0,-1,0),cut)]:[];
  if(l==='all'){ orbit.target.copy(CENTER); camera.position.set(CENTER.x+11,14,CENTER.z+13); }
  else { const y=l==='rez'?0.4:ETAGE_FLOOR+0.4; orbit.target.set(CENTER.x,y,CENTER.z); camera.position.set(CENTER.x+3,y+15,CENTER.z+6); }
  orbit.update();
}
export function setMode(m){
  app.mode=m; $('m-orbit').setAttribute('aria-pressed',String(m==='orbit')); $('m-walk').setAttribute('aria-pressed',String(m==='walk'));
  $('l-all').disabled=m==='walk'; $('pad').hidden=m!=='walk';
  app.orbit.enabled=m==='orbit';
  $('hint').textContent=m==='orbit'
    ?'Glisser pour tourner autour, molette ou pincement pour zoomer, clic droit ou deux doigts pour décaler. Touchez un meuble pour le modifier.'
    :'Glisser pour regarder autour. Avancez avec les flèches, ZQSD ou les boutons. L’escalier se monte en marchant dessus. Touchez un meuble pour le modifier.';
  if(m==='walk') enterWalk(app.level==='etage'?'etage':'rez');
  else setLevel(app.level==='all'||!app.level?'all':app.level);
}
export function initVues(){
  $('m-orbit').onclick=()=>setMode('orbit'); $('m-walk').onclick=()=>{ if(app.level==='all') app.level='rez'; setMode('walk'); };
  $('l-all').onclick=()=>setLevel('all'); $('l-rez').onclick=()=>setLevel('rez'); $('l-etage').onclick=()=>setLevel('etage');
}
