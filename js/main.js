// Point d'entrée : assemble les modules, charge le modèle, lance la boucle d'affichage
import * as THREE from 'three';
import {app, css} from './app.js';
import {chargerModele} from './modele.js';
import {initVues, demarrerVues} from './vues.js';
import {initVisite, walk, regarder, teleporter, solSous} from './visite.js';
import {initEdition, toucher, viser, buildList} from './edition.js';
import {initSauvegarde, restore} from './sauvegarde.js';
import {majPortes} from './portes.js';

initVues(); initVisite(); initEdition(); initSauvegarde();

// Cercle posé au sol pendant un appui long (point de téléportation)
const marque=new THREE.Mesh(new THREE.RingGeometry(0.16,0.25,40),new THREE.MeshBasicMaterial({color:new THREE.Color(css('--accent')||'#2c5a86'),transparent:true,opacity:0.9,depthTest:false,side:THREE.DoubleSide}));
marque.rotation.x=-Math.PI/2; marque.renderOrder=10; marque.visible=false; marque.raycast=()=>{}; app.scene.add(marque);

// Pointeur : glisser = regarder (1re personne) ; toucher bref = porte, sol ou meuble selon le mode ;
// appui long sur le sol (1re personne) = téléportation au relâcher
let pd=null;
const {canvas}=app;
const fin=()=>{ if(pd) clearTimeout(pd.minuterie); marque.visible=false; pd=null; };
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(pd){ pd.multi=true; clearTimeout(pd.minuterie); marque.visible=false; pd.tele=null; return; }
  pd={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,t:performance.now(),id:e.pointerId};
  if(app.mode==='walk'&&app.mobilierPret) pd.minuterie=setTimeout(()=>{
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
  else if(!pd.drag&&!pd.multi&&dt<600&&!app.gizmoDrag&&app.mobilierPret) toucher(e);
  fin();
});
canvas.addEventListener('pointercancel',fin);

chargerModele({
  structurePrete:()=>demarrerVues(),
  mobilierPret:()=>{ restore(); buildList(); }
});

const clock=new THREE.Clock();
app.renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),0.1);
  if(app.mode==='walk') walk(dt); else app.orbit.update();
  majPortes(dt);
  if(app.selBox&&app.tc.object) app.selBox.update();
  app.renderer.render(app.scene,app.camera);
});
