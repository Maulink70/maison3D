// Scène, caméra, contrôles et état partagé entre les modules
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

export const $=id=>document.getElementById(id);
export const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export const fmt=v=>v.toFixed(2).replace('.',',');

const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
const scene=new THREE.Scene();
function applyTheme(){scene.background=new THREE.Color(css('--scene')||'#dfe3e6');}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

scene.add(new THREE.HemisphereLight(0xffffff,0xd9d3c9,2.1));   // sol clair : plafonds blancs, pas gris
const sun=new THREE.DirectionalLight(0xffffff,1.3); sun.position.set(30,40,10); scene.add(sun);
const fill=new THREE.DirectionalLight(0xffffff,0.5); fill.position.set(-20,15,-30); scene.add(fill);

const camera=new THREE.PerspectiveCamera(50,1,0.05,300);
const CENTER=new THREE.Vector3(15.4,1.4,-21.1);
const orbit=new OrbitControls(camera,canvas);
orbit.target.copy(CENTER); orbit.enableDamping=true; orbit.maxDistance=60; orbit.minDistance=2;
orbit.maxPolarAngle=Math.PI*0.495;
camera.position.set(CENTER.x+11,14,CENTER.z+13);

const tc=new TransformControls(camera,canvas);
tc.setMode('translate'); tc.showY=false; tc.setSize(0.9);
scene.add(tc.getHelper?tc.getHelper():tc);

// Tout le modèle (structure puis mobilier) est rangé sous ce groupe
const model=new THREE.Group(); model.name='appartement'; scene.add(model);

export const app={
  canvas, renderer, scene, camera, orbit, tc, CENTER, model,
  mode:'orbit', level:'all', gizmoDrag:false,
  items:{}, selected:null, selBox:null,
  colliders:[], floors:[],   // copies DoubleSide des éléments fixes : murs (visite) et sols (hauteur)
  fenetres:[], portes:[], battants:[], toutOuvert:false, portesAuto:true,   // fenêtres et battants : obstacles qui suivent l'élément
  edition:false,             // Visite (rien n'est modifiable) ou Éditer
  fovVisite:85,              // zoom de la 1re personne : champ de vision horizontal en degrés (35 à 95)
  vitesse:1,                 // vitesse de marche réglable : facteur de 0,5 à 2 (1 = 1,5 m/s au clavier et au pavé)
  mobilierPret:false
};

// Champ de vision en 1re personne : réglé en largeur (35° à 95°, 85° au départ) puis converti en hauteur selon la forme
// de l'écran, au plus 75° : au-delà la perspective se déforme (le zoom réglait la hauteur jusqu'à 100°, soit ~137° en
// largeur sur un écran de PC ; corrigé le 9 octobre 2026 à la demande de Mauro)
export function champVisite(h=app.fovVisite){
  app.fovVisite=THREE.MathUtils.clamp(h,35,95); if(app.mode!=='walk') return;
  const v=2*Math.atan(Math.tan(app.fovVisite*Math.PI/360)/camera.aspect)*180/Math.PI;
  camera.fov=Math.min(75,v); camera.updateProjectionMatrix();
}
function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();champVisite();}
window.addEventListener('resize',resize); resize();

// Accès pour les tests automatisés
window.maison3d=app;
