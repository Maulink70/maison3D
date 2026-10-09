// Ce que l'on fait (Visite / Éditer), comment on regarde (Maquette / 1re personne), niveau (tout / rez / étage) et
// vitesse de marche. Les choix sont mémorisés dans le navigateur.
import * as THREE from 'three';
import {app, $, champVisite} from './app.js';
import {ETAGE_FLOOR, REZ_CUT, ROOF_CUT, ETAGE_CUT} from './config.js';
import {enterWalk} from './visite.js';
import {select, openSheet, petitEcran} from './edition.js';
import {toutOuvrir, toutesFenetres, portesAuto} from './portes.js';
import {creerCiel} from './ciel.js';
import {entrerPlan, sortirPlan, niveauPlan, stylePlan, style as styleDuPlan} from './plan.js';

const UI='maison3d-ui';
function memoriser(){ try{ localStorage.setItem(UI,JSON.stringify({edition:app.edition,vue:app.mode,niveau:app.level,vitesse:app.vitesse,plan:styleDuPlan})); }catch{} }
export function prefs(){ try{ return JSON.parse(localStorage.getItem(UI)||'{}')||{}; }catch{ return {}; } }

const AIDE={
  vo:'Visite : glisser pour tourner autour, molette ou pincement pour zoomer, deux doigts pour décaler. Touchez une porte ou une fenêtre pour l’ouvrir ou la fermer. « Aller à » cadre une pièce. Pour modifier un meuble, passez en « Éditer ».',
  vw:'Visite : glisser pour regarder, flèches, WASD (ZQSD sur clavier français) ou boutons pour marcher. Touchez le sol pour faire un pas, appui long pour vous téléporter. « Aller à » mène à la porte d’une pièce ; la vitesse se règle en bas à gauche. Molette ou pincement : zoom. Les portes s’ouvrent à votre approche (bouton « Portes auto ») ; touchez une porte ou une fenêtre pour l’ouvrir ou la fermer.',
  eo:'Éditer : touchez un meuble pour le déplacer, le tourner, changer sa couleur ou le masquer. Glisser pour tourner autour.',
  ew:'Éditer en 1re personne : touchez un meuble pour le modifier. Touchez le sol pour faire un pas, appui long pour vous téléporter.',
  vp:'Plan : glisser pour vous déplacer, molette ou pincement pour zoomer. « Architecte » : murs coupés à 1 m, meubles en contour, portes avec leur ouverture ; « Réaliste » : la maquette vue de dessus.',
  ep:'Éditer sur le plan : attrapez un meuble et faites-le glisser ; touchez-le pour le tourner, le recolorer ou le masquer dans le panneau.'
};
function majAide(){ $('hint').textContent=AIDE[(app.edition?'e':'v')+(app.mode==='walk'?'w':app.mode==='plan'?'p':'o')]; }

export function setEdition(on){
  app.edition=on; $('mo-visite').setAttribute('aria-pressed',String(!on)); $('mo-editer').setAttribute('aria-pressed',String(on));
  $('toggle-panel').hidden=!on;
  if(!on){ select(null); openSheet(false); } else openSheet(!petitEcran());
  majAide(); memoriser();
}

// recadrer : remettre la caméra sur tout le niveau (non pour « Aller à », qui cadre la pièce lui-même)
export function setLevel(l,recadrer=true){
  const {renderer,orbit,camera,CENTER}=app;
  app.level=l; for(const k of ['all','rez','etage']) $('l-'+k).setAttribute('aria-pressed',String(k===l));
  dispatchEvent(new CustomEvent('niveau'));
  if(app.mode==='walk'){ enterWalk(l==='etage'?'etage':'rez'); memoriser(); return; }
  if(app.mode==='plan'){ niveauPlan(l,recadrer); memoriser(); return; }
  // Rez : coupe sous le plafond. Étage : coupe sous le toit et sous le plancher, le rez disparaît
  const plans=[];
  if(l==='rez') plans.push(new THREE.Plane(new THREE.Vector3(0,-1,0),REZ_CUT));
  if(l==='etage') plans.push(new THREE.Plane(new THREE.Vector3(0,-1,0),ROOF_CUT),new THREE.Plane(new THREE.Vector3(0,1,0),-ETAGE_CUT));
  renderer.clippingPlanes=plans;
  if(!recadrer){ memoriser(); return; }
  if(l==='all'){ orbit.target.copy(CENTER); camera.position.set(CENTER.x+11,14,CENTER.z+13); }
  else { const y=l==='rez'?0.4:ETAGE_FLOOR+0.4; orbit.target.set(CENTER.x,y,CENTER.z); camera.position.set(CENTER.x+3,y+15,CENTER.z+6); }
  orbit.update(); memoriser();
}
export function setMode(m){
  sortirPlan();   // matériaux, fond et coupes de la maquette remis avant de régler la nouvelle vue
  app.mode=m; for(const k of ['orbit','walk','plan']) $('m-'+k).setAttribute('aria-pressed',String(k===m));
  $('l-all').disabled=m!=='orbit'; $('pad').hidden=m!=='walk'; $('vitesse-box').hidden=m!=='walk'; $('plan-style').hidden=m!=='plan';
  app.orbit.enabled=m==='orbit';
  // 1re personne : ciel et sol dehors, champ de vision propre (zoom par molette ou pincement)
  (app.ciel||creerCiel()).visible=m==='walk';
  if(m==='walk') champVisite(); else { app.camera.fov=50; app.camera.updateProjectionMatrix(); }
  if(m==='walk') enterWalk(app.level==='etage'?'etage':'rez');
  else if(m==='plan'){ // plan : un niveau à la fois (rez si « Tout »)
    const l=app.level==='etage'?'etage':'rez'; app.level=l; for(const k of ['all','rez','etage']) $('l-'+k).setAttribute('aria-pressed',String(k===l));
    entrerPlan(l); dispatchEvent(new CustomEvent('niveau')); }
  else setLevel(app.level==='all'||!app.level?'all':app.level);
  if(app.selected) select(app.selected.name);   // bouton « Déplacer » selon la vue
  majAide(); memoriser();
}
// Vitesse de marche : facteur 0,5 à 2, affiché en km/h (1 = 1,5 m/s = 5,4 km/h)
function majVitesse(v){ app.vitesse=Math.min(2,Math.max(0.5,+v||1)); $('vitesse').value=String(app.vitesse);
  $('vitesse-val').textContent=(5.4*app.vitesse).toFixed(1).replace('.',',')+' km/h'; }
// Boutons « Ouvrir les portes » / « Fermer les portes » ; « Portes auto : oui / non » (ouverture à l'approche en 1re personne) ;
// « Ouvrir les fenêtres » / « Fermer les fenêtres » (jamais d'automatisme pour les fenêtres)
function majPortesBouton(){ $('portes').setAttribute('aria-pressed',String(app.toutOuvert)); $('portes').textContent=app.toutOuvert?'Fermer les portes':'Ouvrir les portes';
  $('auto').setAttribute('aria-pressed',String(app.portesAuto)); $('auto').textContent='Portes auto : '+(app.portesAuto?'oui':'non');
  $('fenetres').setAttribute('aria-pressed',String(!!app.fenetresOuvertes)); $('fenetres').textContent=app.fenetresOuvertes?'Fermer les fenêtres':'Ouvrir les fenêtres'; }

export function initVues(){
  $('mo-visite').onclick=()=>setEdition(false); $('mo-editer').onclick=()=>setEdition(true);
  $('m-orbit').onclick=()=>setMode('orbit'); $('m-walk').onclick=()=>{ if(app.level==='all') app.level='rez'; setMode('walk'); };
  $('m-plan').onclick=()=>setMode('plan');
  $('ps-archi').onclick=()=>{ stylePlan('archi'); memoriser(); }; $('ps-reel').onclick=()=>{ stylePlan('reel'); memoriser(); };
  $('l-all').onclick=()=>setLevel('all'); $('l-rez').onclick=()=>setLevel('rez'); $('l-etage').onclick=()=>setLevel('etage');
  $('portes').onclick=()=>{ toutOuvrir(!app.toutOuvert); majPortesBouton(); };
  $('auto').onclick=()=>{ portesAuto(!app.portesAuto); majPortesBouton(); };
  $('fenetres').onclick=()=>{ toutesFenetres(!app.fenetresOuvertes); majPortesBouton(); };
  $('vitesse').oninput=e=>{ majVitesse(e.target.value); memoriser(); };
  majPortesBouton(); majVitesse(1);
}
// Au chargement : reprend les derniers choix (Visite et Maquette la première fois)
export function demarrerVues(){
  const p=prefs(); majVitesse(p.vitesse); stylePlan(p.plan); setEdition(!!p.edition);
  if(p.niveau==='rez'||p.niveau==='etage') app.level=p.niveau;
  setMode(p.vue==='walk'||p.vue==='plan'?p.vue:'orbit');
}
