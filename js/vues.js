// Ce que l'on fait (Visite / Éditer), comment on regarde (Maquette / 1re personne) et niveau (tout / rez / étage).
// Les choix sont mémorisés dans le navigateur.
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR, REZ_CUT, ROOF_CUT, ETAGE_CUT} from './config.js';
import {enterWalk} from './visite.js';
import {select, openSheet, petitEcran} from './edition.js';
import {toutOuvrir} from './portes.js';

const UI='maison3d-ui';
function memoriser(){ try{ localStorage.setItem(UI,JSON.stringify({edition:app.edition,vue:app.mode,niveau:app.level})); }catch{} }
export function prefs(){ try{ return JSON.parse(localStorage.getItem(UI)||'{}')||{}; }catch{ return {}; } }

const AIDE={
  vo:'Visite : glisser pour tourner autour, molette ou pincement pour zoomer, deux doigts pour décaler. Touchez une porte pour l’ouvrir ou la fermer. Pour modifier un meuble, passez en « Éditer ».',
  vw:'Visite : glisser pour regarder, flèches, ZQSD ou boutons pour marcher. Touchez le sol pour y aller, appui long pour vous y téléporter. Les portes s’ouvrent à votre approche ; touchez-les pour les ouvrir ou les fermer.',
  eo:'Éditer : touchez un meuble pour le déplacer, le tourner, changer sa couleur ou le masquer. Glisser pour tourner autour.',
  ew:'Éditer en 1re personne : touchez un meuble pour le modifier. Touchez le sol pour y aller, appui long pour vous y téléporter.'
};
function majAide(){ $('hint').textContent=AIDE[(app.edition?'e':'v')+(app.mode==='walk'?'w':'o')]; }

export function setEdition(on){
  app.edition=on; $('mo-visite').setAttribute('aria-pressed',String(!on)); $('mo-editer').setAttribute('aria-pressed',String(on));
  $('toggle-panel').hidden=!on;
  if(!on){ select(null); openSheet(false); } else openSheet(!petitEcran());
  majAide(); memoriser();
}

export function setLevel(l){
  const {renderer,orbit,camera,CENTER}=app;
  app.level=l; for(const k of ['all','rez','etage']) $('l-'+k).setAttribute('aria-pressed',String(k===l));
  dispatchEvent(new CustomEvent('niveau'));
  if(app.mode==='walk'){ enterWalk(l==='etage'?'etage':'rez'); memoriser(); return; }
  // Rez : coupe sous le plafond. Étage : coupe sous le toit et sous le plancher, le rez disparaît
  const plans=[];
  if(l==='rez') plans.push(new THREE.Plane(new THREE.Vector3(0,-1,0),REZ_CUT));
  if(l==='etage') plans.push(new THREE.Plane(new THREE.Vector3(0,-1,0),ROOF_CUT),new THREE.Plane(new THREE.Vector3(0,1,0),-ETAGE_CUT));
  renderer.clippingPlanes=plans;
  if(l==='all'){ orbit.target.copy(CENTER); camera.position.set(CENTER.x+11,14,CENTER.z+13); }
  else { const y=l==='rez'?0.4:ETAGE_FLOOR+0.4; orbit.target.set(CENTER.x,y,CENTER.z); camera.position.set(CENTER.x+3,y+15,CENTER.z+6); }
  orbit.update(); memoriser();
}
export function setMode(m){
  app.mode=m; $('m-orbit').setAttribute('aria-pressed',String(m==='orbit')); $('m-walk').setAttribute('aria-pressed',String(m==='walk'));
  $('l-all').disabled=m==='walk'; $('pad').hidden=m!=='walk';
  app.orbit.enabled=m==='orbit';
  if(m==='walk') enterWalk(app.level==='etage'?'etage':'rez');
  else setLevel(app.level==='all'||!app.level?'all':app.level);
  majAide(); memoriser();
}
// Bouton « Tout ouvrir » : les portes restent ouvertes ; « Portes auto » : elles s'ouvrent et se ferment seules
function majPortesBouton(){ $('portes').setAttribute('aria-pressed',String(app.toutOuvert)); $('portes').textContent=app.toutOuvert?'Portes auto':'Tout ouvrir'; }

export function initVues(){
  $('mo-visite').onclick=()=>setEdition(false); $('mo-editer').onclick=()=>setEdition(true);
  $('m-orbit').onclick=()=>setMode('orbit'); $('m-walk').onclick=()=>{ if(app.level==='all') app.level='rez'; setMode('walk'); };
  $('l-all').onclick=()=>setLevel('all'); $('l-rez').onclick=()=>setLevel('rez'); $('l-etage').onclick=()=>setLevel('etage');
  $('portes').onclick=()=>{ toutOuvrir(!app.toutOuvert); majPortesBouton(); };
  majPortesBouton();
}
// Au chargement : reprend les derniers choix (Visite et Maquette la première fois)
export function demarrerVues(){
  const p=prefs(); setEdition(!!p.edition);
  if(p.niveau==='rez'||p.niveau==='etage') app.level=p.niveau;
  setMode(p.vue==='walk'?'walk':'orbit');
}
