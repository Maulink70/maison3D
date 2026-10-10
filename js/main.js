// Point d'entrée : assemble les modules, charge le modèle, lance la boucle d'affichage
import * as THREE from 'three';
import {app, $, css, champVisite} from './app.js';
import {chargerModele} from './modele.js';
import {initVues, demarrerVues} from './vues.js';
import {initVisite, walk, regarder, teleporter, solSous} from './visite.js';
import {initEdition, toucher, viser, buildList, select} from './edition.js';
import {initSauvegarde, restore} from './sauvegarde.js';
import {majPortes} from './portes.js';
import {initAller, majCadrage} from './aller.js';
import {majCouvercles} from './coupes.js';
import {initPlan, majPlan, camPlan} from './plan.js';
import {initCalques, majCalques} from './calques.js';
import {initMesure, majMesures, mesureToucher} from './mesure.js';
import {initImpression} from './impression.js';
import {majTransparence} from './transparence.js';
import {initIsoler, isolementActif, rendreIsole} from './isoler.js';
import {initCameras} from './cameras.js';
import {initHistorique, demarrerHistorique} from './historique.js';
import {initAlertes, majAlertes} from './alertes.js';
import {majLumiere} from './lumiere.js';
import {majLampes} from './lampes.js';
import {eclatActif, rendreEclate, suivreEclat} from './eclate.js';
import {initIcones} from './icones.js';
import {initCompte, initPorte} from './compte.js';
import {initSynchro, demarrerSynchro} from './synchro.js';
import {initVariantes} from './variantes.js';
import {initComparer, comparaisonActive, rendreComparaison} from './comparer.js';
import {initPartage} from './partage.js';
import {initObjets} from './objets.js';
import {initRevetements, majRevetements} from './revetements.js';
import {initGalerie} from './galerie.js';
import {initCalage, majCalage, calageActif, fovCalage, zoomCalage, toucherCalage} from './calage.js';

initIcones(); initCompte(); initSynchro(); initVariantes(); initComparer(); initVues(); initVisite(); initEdition(); initSauvegarde(); initAller(); initPlan(); initCalques(); initMesure(); initImpression(); initIsoler(); initCameras(); initHistorique(); initPartage(); initAlertes(); initObjets(); initRevetements(); initGalerie(); initCalage();

// Cercle posé au sol pendant un appui long (point de téléportation)
const marque=new THREE.Mesh(new THREE.RingGeometry(0.16,0.25,40),new THREE.MeshBasicMaterial({color:new THREE.Color(css('--accent')||'#2c5a86'),transparent:true,opacity:0.9,depthTest:false,side:THREE.DoubleSide}));
marque.rotation.x=-Math.PI/2; marque.renderOrder=10; marque.visible=false; marque.raycast=()=>{}; app.scene.add(marque);

// Zoom en 1re personne : molette (PC) ou pincement à deux doigts (tablette) ; on change le champ de vision
// (champVisite : 35° à 95° en largeur), on ne bouge pas : zoomer en arrière montre plus de la pièce
const {canvas}=app;
// calage d'une photo (calage.js) : le zoom règle l'angle de vue de la photo
canvas.addEventListener('wheel',e=>{ if(app.mode!=='walk') return; e.preventDefault(); const k=Math.exp(e.deltaY*0.0012); if(calageActif()) zoomCalage(fovCalage()*k); else champVisite(app.fovVisite*k); },{passive:false});
const doigts=new Map(); let pince=null;
const ecart=()=>{ const [a,b]=[...doigts.values()]; return Math.hypot(a.x-b.x,a.y-b.y); };
canvas.addEventListener('pointerdown',e=>{ doigts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(doigts.size===2&&app.mode==='walk') pince={d:ecart(),fov:calageActif()?fovCalage():app.fovVisite}; });
canvas.addEventListener('pointermove',e=>{ if(!doigts.has(e.pointerId)) return; doigts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pince&&doigts.size===2){ const f=pince.fov*pince.d/Math.max(20,ecart()); if(calageActif()) zoomCalage(f); else champVisite(f); } });
for(const t of ['pointerup','pointercancel']) canvas.addEventListener(t,e=>{ doigts.delete(e.pointerId); if(doigts.size<2) pince=null; });

// Pointeur : glisser = regarder (1re personne) ; toucher bref = porte, sol ou meuble selon le mode ;
// appui long sur le sol (1re personne) = téléportation au relâcher
let pd=null;
const fin=()=>{ if(pd) clearTimeout(pd.minuterie); marque.visible=false; pd=null; };
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(pd){ pd.multi=true; clearTimeout(pd.minuterie); marque.visible=false; pd.tele=null; return; }
  pd={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,t:performance.now(),id:e.pointerId};
  if(app.mode==='walk'&&app.mobilierPret&&!app.mesure) pd.minuterie=setTimeout(()=>{
    if(!pd||pd.drag||pd.multi) return; const h=viser(pd.x,pd.y);
    if(h&&solSous(h.point)!==null){ pd.tele=h.point.clone(); marque.position.set(h.point.x,h.point.y+0.02,h.point.z); marque.visible=true; }
  },550);
});
canvas.addEventListener('pointermove',e=>{
  if(!pd||pd.id!==e.pointerId) return;
  if(!pd.drag&&Math.hypot(e.clientX-pd.x,e.clientY-pd.y)>8){ pd.drag=true; clearTimeout(pd.minuterie); marque.visible=false; pd.tele=null; }
  if(pd.drag&&app.mode==='walk'&&!app.gizmoDrag&&!pd.multi) regarder(e.clientX-pd.lx,e.clientY-pd.ly);
  pd.lx=e.clientX; pd.ly=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
  if(!pd||pd.id!==e.pointerId) return;
  const dt=performance.now()-pd.t;
  if(pd.tele) teleporter(pd.tele);
  else if(!pd.drag&&!pd.multi&&dt<600&&!app.gizmoDrag&&app.mobilierPret&&!eclatActif()&&!comparaisonActive()){ if(app.mesure) mesureToucher(e.clientX,e.clientY); else if(calageActif()) toucherCalage(e); else toucher(e); }   // vue éclatée : rien à toucher
  fin();
});
canvas.addEventListener('pointercancel',fin);

// Application installable (étape 2) : service worker (cache du modèle, sw.js) ; bouton « Installer l'application »
// quand le navigateur le propose (Chrome, Edge, Samsung Internet), caché une fois installée
if('serviceWorker' in navigator&&location.protocol!=='file:') addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
let proposition=null;
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); proposition=e; $('installer').hidden=false; });
addEventListener('appinstalled',()=>{ proposition=null; $('installer').hidden=true; });
$('installer').onclick=async()=>{ if(!proposition) return; proposition.prompt(); await proposition.userChoice.catch(()=>{}); proposition=null; $('installer').hidden=true; };

// on n'entre (et la maquette ne se charge) qu'une fois connecté (écran d'entrée, compte.js)
initPorte(()=>chargerModele({
  structurePrete:()=>demarrerVues(),
  mobilierPret:()=>{ restore(); buildList(); demarrerHistorique(); demarrerSynchro(); }
}));

const clock=new THREE.Clock(), barre=document.querySelector('.bar');
// rendu de l'image : pièce isolée (plusieurs passes), vue éclatée ou rendu simple ; comparaison de deux variantes
// (barre ou fondu) : ce rendu est fait pour chacune
function rendreBase(cam){ if(isolementActif()) rendreIsole(cam); else if(eclatActif()) rendreEclate(cam); else app.renderer.render(app.scene,cam); }
function rendre(){
  const cam=app.mode==='plan'?camPlan:app.camera;
  if(comparaisonActive()) rendreComparaison(cam,rendreBase); else rendreBase(cam);
}
app.renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),0.1);
  if(app.mode==='walk') walk(dt); else if(app.mode==='plan') majPlan(dt); else { majCadrage(dt); suivreEclat(); app.orbit.update(); }
  majPortes(dt); majCouvercles(); majTransparence(); majRevetements(); majAlertes(); majLumiere(); majLampes();
  if(app.selected&&eclatActif()) select(null);   // vue éclatée : pas de sélection (la poignée suivrait mal le meuble soulevé)
  if(app.selBox&&app.tc.object) app.selBox.update();
  majCalques(); majMesures();
  const bas=barre.getBoundingClientRect().bottom-$('app').getBoundingClientRect().top;
  $('bandeaux').style.top=(bas+8)+'px';   // bandeaux sous la barre, même sur téléphone
  $('panel').style.top=innerWidth>760?(bas+10)+'px':'';   // panneau des meubles sous la barre (qui peut tenir sur 2 lignes)
  majCalage();   // après les bandeaux : cadre de la photo sous eux, caméra à l'angle de vue de la photo
  rendre();
});
