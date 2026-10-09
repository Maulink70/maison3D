// « Aller à » : menu des pièces, dans les deux modes et les deux vues.
// Maquette : coupe au niveau de la pièce et cadrage animé (on garde l'orientation de la caméra, vue plongeante) ;
// 1re personne : arrivée à la porte de la pièce, regard vers l'intérieur (points dans pieces.js)
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR} from './config.js';
import {PIECES, surface, bornes, pieceEn} from './pieces.js';
import {allerA} from './visite.js';
import {setLevel} from './vues.js';
import {cadrerPlan} from './plan.js';
import {caler} from './calques.js';
import {isoler} from './isoler.js';

let anim=null;
const doux=matchMedia('(prefers-reduced-motion: reduce)');

function cadrer(p){
  const {camera,orbit}=app, b=bornes(p), y=(p.niveau==='etage'?ETAGE_FLOOR:0)+0.4;
  const c=new THREE.Vector3((b.x0+b.x1)/2,y,(b.z0+b.z1)/2), r=Math.max(2.0,Math.hypot(b.x1-b.x0,b.z1-b.z0)/2+0.3);   // petites pièces : un peu de recul
  const az=camera.position.clone().sub(orbit.target).setY(0); if(az.length()<0.01) az.set(1,0,1); az.normalize();
  const el=THREE.MathUtils.degToRad(surface(p)<6?72:62);
  const vfov=THREE.MathUtils.degToRad(camera.fov), hfov=2*Math.atan(Math.tan(vfov/2)*camera.aspect);
  const dist=Math.min(orbit.maxDistance,r/Math.sin(Math.min(vfov,hfov)/2));
  const pos=c.clone().addScaledVector(new THREE.Vector3(az.x*Math.cos(el),Math.sin(el),az.z*Math.cos(el)),dist);
  anim={t:0,dur:doux.matches?0.001:0.9,p0:camera.position.clone(),c0:orbit.target.clone(),p1:pos,c1:c};
}
// Caméras mémorisées : retour animé de la maquette à un point de vue (position de la caméra, point regardé)
export function animerVers(p1,c1){ const {camera,orbit}=app;
  anim={t:0,dur:doux.matches?0.001:0.9,p0:camera.position.clone(),c0:orbit.target.clone(),p1:new THREE.Vector3(...p1),c1:new THREE.Vector3(...c1)}; }
// Appelé à chaque image en maquette, avant orbit.update()
export function majCadrage(dt){
  if(!anim) return;
  anim.t=Math.min(1,anim.t+dt/anim.dur); const t=anim.t, k=t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  app.camera.position.lerpVectors(anim.p0,anim.p1,k); app.orbit.target.lerpVectors(anim.c0,anim.c1,k);
  if(t>=1) anim=null;
}

export function allerVers(id){
  const p=PIECES.find(q=>q.id===id); if(!p) return;
  if(app.mode==='walk') allerA(p.arrivee[0],p.arrivee[1],p.niveau,p.vers[0],p.vers[1],p.incl);
  else if(app.mode==='plan'){ setLevel(p.niveau,false); cadrerPlan(bornes(p)); }
  else { setLevel(p.niveau,false); cadrer(p); }
}

// ---------- menu ----------
// en maquette, « Aller | Isoler » en tête du menu : isoler cadre la pièce et cache (ou pâlit) le reste (isoler.js)
let modeIsoler=false;
const bouton=()=>$('aller'), menu=()=>$('aller-menu');
function majChoix(){ $('aller-choix').hidden=app.mode!=='orbit'; $('aller-va').setAttribute('aria-pressed',String(!modeIsoler)); $('aller-isole').setAttribute('aria-pressed',String(modeIsoler)); }
const m2=p=>surface(p).toFixed(1).replace('.',',')+' m²';
function ouvrir(oui){
  menu().hidden=!oui; bouton().setAttribute('aria-expanded',String(oui));
  if(!oui) return;
  majChoix(); caler(menu());
  // pièce où l'on est (1re personne) mise en évidence
  const c=app.camera.position, ici=app.mode==='walk'?pieceEn(c.x,c.z,c.y>ETAGE_FLOOR+0.5?'etage':'rez'):null;
  for(const b of menu().querySelectorAll('[data-piece]')) b.toggleAttribute('aria-current',b.dataset.piece===ici?.id);
  menu().querySelector('[data-piece]')?.focus();
}
export function initAller(){
  const m=menu();
  const ch=document.createElement('div'); ch.id='aller-choix'; ch.className='impr-ligne';
  ch.innerHTML='<span>Pièce</span><div class="seg" role="group" aria-label="Aller à la pièce ou l’isoler"><button type="button" id="aller-va">Aller</button><button type="button" id="aller-isole">Isoler</button></div>';
  m.append(ch);
  ch.querySelector('#aller-va').onclick=()=>{ modeIsoler=false; majChoix(); }; ch.querySelector('#aller-isole').onclick=()=>{ modeIsoler=true; majChoix(); };
  for(const [niv,titre] of [['rez','Rez'],['etage','Étage']]){
    const g=document.createElement('div'); g.className='menu-groupe'; g.setAttribute('role','group'); g.setAttribute('aria-label',titre);
    const t=document.createElement('div'); t.className='menu-titre'; t.textContent=titre; g.append(t);
    for(const p of PIECES.filter(q=>q.niveau===niv)){
      const b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem'); b.dataset.piece=p.id;
      const n=document.createElement('span'); n.textContent=p.nom; const s=document.createElement('span'); s.className='m2'; s.textContent=m2(p);
      b.append(n,s); b.onclick=()=>{ ouvrir(false); allerVers(p.id); if(modeIsoler&&app.mode==='orbit') isoler(p.id); }; g.append(b);
    }
    m.append(g);
  }
  bouton().onclick=e=>{ e.stopPropagation(); ouvrir(m.hidden); };
  addEventListener('pointerdown',e=>{ if(!m.hidden&&!m.contains(e.target)&&!bouton().contains(e.target)) ouvrir(false); });
  m.addEventListener('keydown',e=>{
    const items=[...m.querySelectorAll('[data-piece]')], i=items.indexOf(document.activeElement);
    // flèches et Échap restent dans le menu : en 1re personne, elles feraient aussi marcher
    if(['Escape','ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.key)){ e.preventDefault(); e.stopPropagation(); }
    if(e.key==='Escape'){ ouvrir(false); bouton().focus(); }
    else if(e.key==='ArrowDown'||e.key==='ArrowUp') items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
  });
  // toucher la vue, ou changer de niveau ou de vue, arrête le cadrage en cours (celui de « Aller à » démarre après son changement de niveau)
  for(const t of ['pointerdown','wheel']) app.canvas.addEventListener(t,()=>{ anim=null; },{passive:true});
  addEventListener('niveau',()=>{ anim=null; });
}
