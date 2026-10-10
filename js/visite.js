// Visite à la première personne : marche (flèches, WASD / ZQSD selon le clavier, pavé), un pas vers le point touché,
// téléportation par appui long, obstacles (murs, muret, fenêtres, portes fermées, meubles), étage suivi automatiquement
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR, EYE} from './config.js';
import {obstaclesPortes} from './portes.js';

let yaw=Math.PI, pitch=0, groundY=0, cible=null, vitesse=0;
let hauteur=EYE, roulis=0;   // calage d'une photo (calage.js) : hauteur des yeux et inclinaison de côté réglables
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

// « Aller à » : arrivée au point (x, z) d'un niveau, regard vers (vx, vz) ; on s'écarte d'un mur ou d'un meuble trop proche
export function allerA(x,z,floor,vx,vz,incl=-0.05){
  const {camera,renderer}=app;
  renderer.clippingPlanes=[]; cible=null; groundY=floor==='etage'?ETAGE_FLOOR:0;
  camera.position.set(x,groundY+EYE,z); yaw=Math.atan2(-(vx-x),-(vz-z)); pitch=incl;
  camera.rotation.set(pitch,yaw,0,'YXZ'); degager(); majNiveau(floor);
}

// Caméras mémorisées (cameras.js) : où l'on est et où l'on regarde, et y revenir
export function etatVisite(){ const c=app.camera.position; return {x:c.x,y:groundY,z:c.z,yaw,pitch,fov:app.fovVisite}; }
export function reprendreVisite(e){
  const {camera,renderer}=app; renderer.clippingPlanes=[]; cible=null; groundY=e.y;
  camera.position.set(e.x,groundY+EYE,e.z); yaw=e.yaw; pitch=e.pitch; camera.rotation.set(pitch,yaw,0,'YXZ');
  majNiveau(groundY>ETAGE_FLOOR-0.8?'etage':'rez');
}
// Calage d'une photo (étape 5, calage.js) : position et orientation exactes de la prise de vue, réglées finement
export function etatCalage(){ const c=app.camera.position; return {x:c.x,y:c.y,z:c.z,sol:groundY,yaw,pitch,roll:roulis}; }
export function poserCalage(e){
  const {camera,renderer}=app; renderer.clippingPlanes=[]; cible=null; groundY=e.sol; hauteur=THREE.MathUtils.clamp(e.y-e.sol,0.3,2.5);
  yaw=e.yaw; pitch=e.pitch; roulis=e.roll||0; camera.position.set(e.x,groundY+hauteur,e.z); camera.rotation.set(pitch,yaw,roulis,'YXZ');
  majNiveau(groundY>ETAGE_FLOOR-0.8?'etage':'rez');
}
export function ajusterCalage({yaw:dy=0,pitch:dp=0,roll:dr=0,avant=0,cote=0,hauteur:dh=0}){
  cible=null; yaw+=dy; pitch=THREE.MathUtils.clamp(pitch+dp,-1.3,1.3); roulis=THREE.MathUtils.clamp(roulis+dr,-0.5,0.5); hauteur=THREE.MathUtils.clamp(hauteur+dh,0.3,2.5);
  const c=app.camera.position; c.x+=-Math.sin(yaw)*avant+Math.cos(yaw)*cote; c.z+=-Math.cos(yaw)*avant-Math.sin(yaw)*cote;
}
export function finCalage(){ hauteur=EYE; roulis=0; }
export function regarder(dx,dy){ yaw-=dx*0.005; pitch-=dy*0.005; pitch=Math.max(-1.3,Math.min(1.3,pitch)); }

const rc=new THREE.Raycaster(), down=new THREE.Vector3(0,-1,0), o=new THREE.Vector3();
function visible(x){ while(x){ if(!x.visible) return false; x=x.parent; } return true; }
// Meubles visibles proches (rayon r autour de soi) : ils arrêtent la marche, au clavier, au pavé et au toucher
function meubles(r=Infinity){
  const c=app.camera.position;
  return Object.values(app.items).filter(i=>i.meta.c==='meuble'&&!i.hidden&&visible(i.g)&&(r===Infinity||Math.hypot(i.g.position.x-c.x,i.g.position.z-c.z)<r+Math.hypot(i.size.x,i.size.z)/2))
    .flatMap(i=>i.mats).filter(visible);
}
// Un meuble n'arrête que si l'on va vers lui (face tournée vers soi) : si l'on se retrouve dedans, on peut toujours en sortir
const nm=new THREE.Matrix3(), nf=new THREE.Vector3();
function devant(hits,d){ return hits.some(h=>!h.face||nf.copy(h.face.normal).applyMatrix3(nm.getNormalMatrix(h.object.matrixWorld)).dot(d)<0); }
// Obstacle sur le trajet ? Murs, muret, fenêtres, portes : trois rayons (bas : muret de l'escalier, ~95 cm au-dessus des
// marches ; mi-hauteur ; tête). Meubles : sept hauteurs, des pieds de table basse à la tête (le tapis ne gêne pas).
// marge : distance gardée devant l'obstacle
const H_MURS=[0.45,1.0,EYE+0.05], H_MEUBLES=[0.12,0.3,0.45,0.7,1.0,1.3,EYE+0.05];
export function bloque(v,marge=0.28,avecMeubles=true){
  const {camera,colliders,fenetres}=app, len=v.length(), d=v.clone().normalize();
  const autres=[...obstaclesPortes(),...fenetres.filter(visible)];
  for(const h of H_MURS){
    rc.set(o.set(camera.position.x,groundY+h,camera.position.z),d); rc.far=len+marge;
    if(rc.intersectObjects(colliders,false).length||rc.intersectObjects(autres,false).length) return true;
  }
  if(!avecMeubles) return false;
  const proches=meubles(len+marge+0.5); if(!proches.length) return false;
  for(const h of H_MEUBLES){
    rc.set(o.set(camera.position.x,groundY+h,camera.position.z),d); rc.far=len+marge;
    if(devant(rc.intersectObjects(proches,false),d)) return true;
  }
  return false;
}
// Sur les côtés du mouvement : le rayon de devant ne voit pas un mur longé presque parallèlement ; on s'en approchait
// pas à pas jusqu'à passer au travers (Mauro sorti par la baie, 9 octobre 2026). Un pas est refusé s'il amène à moins
// de 22 cm d'un mur, d'une vitre ou d'une porte sur le côté, sauf s'il en éloigne (on peut toujours se dégager)
const COTE=0.22, nCote=new THREE.Vector3(), dCote=new THREE.Vector3(), qCote=new THREE.Vector3();
function cote(p,d,obst){ rc.set(o.set(p.x,groundY+0.7,p.z),d); rc.far=COTE+0.05; const h=rc.intersectObjects(obst,false)[0]; return h?h.distance:Infinity; }
function avancer(v,marge,avecMeubles=true){
  if(!v.length()||bloque(v,marge,avecMeubles)) return false;
  const c=app.camera.position, obst=[...app.colliders,...obstaclesPortes(),...app.fenetres.filter(visible)];
  nCote.set(-v.z,0,v.x).normalize(); qCote.copy(c).add(v);
  for(const s of [1,-1]){ dCote.copy(nCote).multiplyScalar(s); const apres=cote(qCote,dCote,obst); if(apres<COTE&&apres<cote(c,dCote,obst)-0.001) return false; }
  c.add(v); return true;
}

// Après une téléportation : on s'écarte des murs et des meubles trop proches (40 cm), pour ne pas avoir le nez dessus
function degager(){
  const {camera,colliders,fenetres}=app, obst=[...colliders,...obstaclesPortes(),...fenetres.filter(visible),...meubles(1)], pousse=new THREE.Vector3();
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
// Toucher bref sur le sol : un pas (70 cm) vers le point touché, en douceur (accélération, ralentissement à l'arrivée) ;
// arrêt à 55 cm d'un mur, d'une porte fermée ou d'un meuble (Mauro : « 1 clic = 1 pas »)
export const PAS=0.7;
export function glisserVers(p){
  const y=solSous(p); if(y===null) return false;
  const c=app.camera.position, d=new THREE.Vector3(p.x-c.x,0,p.z-c.z); if(d.length()>PAS) d.setLength(PAS);
  cible=new THREE.Vector3(c.x+d.x,y,c.z+d.z); vitesse=0; return true;
}
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
    const mv=fw.multiplyScalar(f).add(rt.multiplyScalar(s)).normalize().multiplyScalar(1.5*app.vitesse*dt);
    // pas bloqué : demi-pas puis quart de pas (on s'approche au plus près, quelle que soit la vitesse d'affichage),
    // sinon on glisse le long de l'obstacle
    const essayer=v=>avancer(v)||avancer(v.clone().multiplyScalar(0.5))||avancer(v.clone().multiplyScalar(0.25));
    if(!essayer(mv)){ essayer(new THREE.Vector3(mv.x,0,0)) || essayer(new THREE.Vector3(0,0,mv.z)); }
  } else if(cible){
    const d=new THREE.Vector3(cible.x-camera.position.x,0,cible.z-camera.position.z), dist=d.length();
    if(dist<0.03) cible=null;
    else { const k=app.vitesse; vitesse=Math.min(1.6*k,(0.3+dist*1.3)*k,vitesse+2.5*k*dt); const pas=Math.min(dist,vitesse*dt);
      if(!avancer(d.setLength(pas),0.55)) cible=null; }
  }
  rc.set(o.set(camera.position.x,groundY+0.75,camera.position.z),down); rc.far=4;
  const h=rc.intersectObjects(floors,false)[0];
  if(h) groundY+= (h.point.y-groundY)*Math.min(1,dt*10);
  camera.position.y=groundY+hauteur;
  camera.rotation.set(pitch,yaw,roulis,'YXZ');
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
