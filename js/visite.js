// Visite à la première personne : marche (flèches, ZQSD, pavé), glisser jusqu'au point touché,
// téléportation par appui long, obstacles (murs, muret, fenêtres, portes fermées), étage suivi automatiquement
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR, EYE} from './config.js';
import {obstaclesPortes} from './portes.js';

let yaw=Math.PI, pitch=0, groundY=0, cible=null, vitesse=0;
export const keys={fwd:0,back:0,left:0,right:0};

function majNiveau(floor){
  if(app.level===floor) return;
  app.level=floor; for(const k of ['all','rez','etage']) $('l-'+k).setAttribute('aria-pressed',String(k===floor));
  dispatchEvent(new CustomEvent('niveau'));
}
export function enterWalk(floor){
  const {camera,renderer}=app;
  app.level=null; majNiveau(floor); renderer.clippingPlanes=[]; cible=null;
  if(floor==='etage'){ groundY=ETAGE_FLOOR; camera.position.set(15.2,groundY+EYE,-24.4); yaw=-Math.PI/2; }
  else { groundY=0; camera.position.set(18.4,EYE,-19.0); yaw=Math.PI-0.52; }   // près du buffet, regard vers la baie
  pitch=-0.05; camera.rotation.set(pitch,yaw,0,'YXZ');
}

export function regarder(dx,dy){ yaw-=dx*0.005; pitch-=dy*0.005; pitch=Math.max(-1.3,Math.min(1.3,pitch)); }

const rc=new THREE.Raycaster(), down=new THREE.Vector3(0,-1,0), o=new THREE.Vector3();
function visible(x){ while(x){ if(!x.visible) return false; x=x.parent; } return true; }
// Meubles visibles (le glisser s'arrête devant eux ; la marche au clavier les traverse encore : livraison 3)
function meubles(){ return Object.values(app.items).filter(i=>i.meta.c==='meuble'&&!i.hidden).flatMap(i=>i.mats).filter(visible); }
// Obstacle sur le trajet ? Trois rayons : bas (muret de l'escalier, ~95 cm au-dessus des marches), mi-hauteur, tête.
// marge : distance gardée devant l'obstacle ; avecMeubles : les meubles arrêtent aussi
function bloque(v,marge=0.28,avecMeubles=false){
  const {camera,colliders,fenetres}=app, len=v.length(), d=v.clone().normalize();
  const autres=[...obstaclesPortes(),...fenetres.filter(visible),...(avecMeubles?meubles():[])];
  for(const h of [0.45,1.0,EYE+0.05]){
    rc.set(o.set(camera.position.x,groundY+h,camera.position.z),d); rc.far=len+marge;
    if(rc.intersectObjects(colliders,false).length||rc.intersectObjects(autres,false).length) return true;
  }
  return false;
}
function avancer(v,marge,avecMeubles){ if(!v.length()||bloque(v,marge,avecMeubles)) return false; app.camera.position.add(v); return true; }

// Après une téléportation : on s'écarte des murs et des meubles trop proches (40 cm), pour ne pas avoir le nez dessus
function degager(){
  const {camera,colliders,fenetres}=app, obst=[...colliders,...obstaclesPortes(),...fenetres.filter(visible),...meubles()], pousse=new THREE.Vector3();
  for(let k=0;k<12;k++){ const a=k*Math.PI/6, d=new THREE.Vector3(Math.sin(a),0,Math.cos(a));
    for(const h of [0.45,1.0,EYE]){ rc.set(o.set(camera.position.x,groundY+h,camera.position.z),d); rc.far=0.4;
      const hit=rc.intersectObjects(obst,false)[0]; if(hit){ pousse.addScaledVector(d,-(0.4-hit.distance)); break; } } }
  if(pousse.length()>0.4) pousse.setLength(0.4);
  if(pousse.length()>0.01&&!bloque(pousse,0.05)) camera.position.add(pousse);
}

// Hauteur du sol sous un point (null si aucun sol praticable : meuble, mur…)
export function solSous(p){
  rc.set(o.set(p.x,p.y+0.3,p.z),down); rc.far=1.0;
  const h=rc.intersectObjects(app.floors,false)[0];
  return h&&Math.abs(h.point.y-p.y)<0.08?h.point.y:null;
}
// Toucher bref sur le sol : on y glisse en douceur (accélération, 1,6 m/s au plus, ralentissement à l'arrivée) ;
// arrêt à 55 cm d'un mur, d'une porte fermée ou d'un meuble
export function glisserVers(p){ const y=solSous(p); if(y===null) return false; cible=new THREE.Vector3(p.x,y,p.z); vitesse=0; return true; }
// Appui long sur le sol : téléportation (même dans une autre pièce visible, ou en bas depuis la mezzanine)
export function teleporter(p){
  const y=solSous(p); if(y===null) return false;
  cible=null; app.camera.position.x=p.x; app.camera.position.z=p.z; groundY=y; app.camera.position.y=y+EYE;
  degager(); majNiveau(y>ETAGE_FLOOR-0.8?'etage':'rez'); return true;
}

export function walk(dt){
  const {camera,floors}=app;
  const f=keys.fwd-keys.back, s=keys.right-keys.left;
  if(f||s){
    cible=null;
    const fw=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)), rt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const mv=fw.multiplyScalar(f).add(rt.multiplyScalar(s)).normalize().multiplyScalar(1.5*dt);
    if(!avancer(mv)){ avancer(new THREE.Vector3(mv.x,0,0)) || avancer(new THREE.Vector3(0,0,mv.z)); }
  } else if(cible){
    const d=new THREE.Vector3(cible.x-camera.position.x,0,cible.z-camera.position.z), dist=d.length();
    if(dist<0.03) cible=null;
    else { vitesse=Math.min(1.6,0.3+dist*1.3,vitesse+2.5*dt); const pas=Math.min(dist,vitesse*dt);
      if(!avancer(d.setLength(pas),0.55,true)) cible=null; }
  }
  rc.set(o.set(camera.position.x,groundY+0.75,camera.position.z),down); rc.far=4;
  const h=rc.intersectObjects(floors,false)[0];
  if(h) groundY+= (h.point.y-groundY)*Math.min(1,dt*10);
  camera.position.y=groundY+EYE;
  camera.rotation.set(pitch,yaw,0,'YXZ');
  majNiveau(groundY>ETAGE_FLOOR-0.8?'etage':'rez');
}
export function enMouvement(){ return !!cible; }

const KEYMAP={KeyW:'fwd',ArrowUp:'fwd',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
export function initVisite(){
  addEventListener('keydown',e=>{ if(app.mode!=='walk'||e.target.tagName==='INPUT') return; const k=KEYMAP[e.code]; if(k){keys[k]=1;e.preventDefault();} });
  addEventListener('keyup',e=>{ const k=KEYMAP[e.code]; if(k) keys[k]=0; });
  addEventListener('blur',()=>{for(const k in keys) keys[k]=0;});
  const pad=$('pad');
  pad.addEventListener('contextmenu',e=>e.preventDefault());   // appui long : pas de menu du navigateur
  for(const b of pad.querySelectorAll('button')){
    const k=b.dataset.k;
    const on=e=>{e.preventDefault();keys[k]=1;b.classList.add('active');b.setPointerCapture?.(e.pointerId);};
    const off=()=>{keys[k]=0;b.classList.remove('active');};
    b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off); b.addEventListener('pointercancel',off); b.addEventListener('lostpointercapture',off);
  }
}
