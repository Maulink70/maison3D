// Visite à la première personne
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR, EYE} from './config.js';

let yaw=Math.PI, pitch=0, groundY=0;
export const keys={fwd:0,back:0,left:0,right:0};

export function enterWalk(floor){
  const {camera,renderer}=app;
  for(const k of ['all','rez','etage']) $('l-'+k).setAttribute('aria-pressed',String(k===floor));
  app.level=floor; renderer.clippingPlanes=[];
  if(floor==='etage'){ groundY=ETAGE_FLOOR; camera.position.set(15.2,groundY+EYE,-24.4); yaw=-Math.PI/2; }
  else { groundY=0; camera.position.set(18.4,EYE,-19.0); yaw=Math.PI-0.52; }   // près du buffet, regard vers la baie
  pitch=-0.05; camera.rotation.set(pitch,yaw,0,'YXZ');
}

export function regarder(dx,dy){ yaw-=dx*0.005; pitch-=dy*0.005; pitch=Math.max(-1.3,Math.min(1.3,pitch)); }

const rc=new THREE.Raycaster(), down=new THREE.Vector3(0,-1,0);
export function walk(dt){
  const {camera,colliders,floors}=app;
  const f=keys.fwd-keys.back, s=keys.right-keys.left;
  if(f||s){
    const fw=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)), rt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const mv=fw.multiplyScalar(f).add(rt.multiplyScalar(s)).normalize().multiplyScalar(1.5*dt);
    const tryMove=v=>{ const len=v.length(); if(!len) return false;
      rc.set(new THREE.Vector3(camera.position.x,groundY+1.0,camera.position.z),v.clone().normalize()); rc.far=len+0.28;
      if(rc.intersectObjects(colliders,false).length) return false; camera.position.add(v); return true; };
    if(!tryMove(mv)){ tryMove(new THREE.Vector3(mv.x,0,0)) || tryMove(new THREE.Vector3(0,0,mv.z)); }
  }
  rc.set(new THREE.Vector3(camera.position.x,groundY+0.75,camera.position.z),down); rc.far=4;
  const h=rc.intersectObjects(floors,false)[0];
  if(h) groundY+= (h.point.y-groundY)*Math.min(1,dt*10);
  camera.position.y=groundY+EYE;
  camera.rotation.set(pitch,yaw,0,'YXZ');
}

const KEYMAP={KeyW:'fwd',ArrowUp:'fwd',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
export function initVisite(){
  addEventListener('keydown',e=>{ if(app.mode!=='walk'||e.target.tagName==='INPUT') return; const k=KEYMAP[e.code]; if(k){keys[k]=1;e.preventDefault();} });
  addEventListener('keyup',e=>{ const k=KEYMAP[e.code]; if(k) keys[k]=0; });
  addEventListener('blur',()=>{for(const k in keys) keys[k]=0;});
  for(const b of document.querySelectorAll('#pad button')){
    const k=b.dataset.k;
    const on=e=>{e.preventDefault();keys[k]=1;b.classList.add('active');b.setPointerCapture?.(e.pointerId);};
    const off=()=>{keys[k]=0;b.classList.remove('active');};
    b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off); b.addEventListener('pointercancel',off); b.addEventListener('lostpointercapture',off);
  }
}
