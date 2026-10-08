// Point d'entrée : assemble les modules, charge le modèle, lance la boucle d'affichage
import * as THREE from 'three';
import {app} from './app.js';
import {chargerModele} from './modele.js';
import {initVues, setMode} from './vues.js';
import {initVisite, walk, regarder} from './visite.js';
import {initEdition, pick, buildList} from './edition.js';
import {initSauvegarde, restore} from './sauvegarde.js';

initVues(); initVisite(); initEdition(); initSauvegarde();

// Pointeur : glisser = regarder (visite), toucher bref = sélectionner
let pd=null;
const {canvas}=app;
canvas.addEventListener('pointerdown',e=>{ pd={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,t:performance.now(),id:e.pointerId}; });
canvas.addEventListener('pointermove',e=>{
  if(!pd||pd.id!==e.pointerId||app.mode!=='walk'||app.gizmoDrag) return;
  regarder(e.clientX-pd.lx,e.clientY-pd.ly); pd.lx=e.clientX; pd.ly=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
  if(!pd) return; const moved=Math.hypot(e.clientX-pd.x,e.clientY-pd.y), dt=performance.now()-pd.t; pd=null;
  if(moved<6&&dt<600&&!app.gizmoDrag&&app.mobilierPret) pick(e);
});

chargerModele({
  structurePrete:()=>setMode('orbit'),
  mobilierPret:()=>{ restore(); buildList(); }
});

const clock=new THREE.Clock();
app.renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),0.1);
  if(app.mode==='walk') walk(dt); else app.orbit.update();
  if(app.selBox&&app.tc.object) app.selBox.update();
  app.renderer.render(app.scene,app.camera);
});
