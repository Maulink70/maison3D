// Comparaison de deux variantes (étape 3), depuis le menu « Variantes » : la variante affichée (A) et une autre (B),
// sur la même vue, en maquette, en 1re personne et sur le plan (vue de dessus réaliste : le plan d'architecte, dessiné
// d'après la disposition affichée, passe en réaliste le temps de la comparaison).
//  - Barre : A à gauche de la barre, B à droite ; on fait glisser la barre (souris ou doigt).
//  - Fondu : un curseur passe de A à B (images rendues dans deux textures, mélangées).
// Seuls les éléments qui diffèrent entre A et B sont déplacés le temps de dessiner B, puis remis : rien n'est enregistré.
// Pendant la comparaison, toucher la vue ne sélectionne ni n'ouvre rien.
import * as THREE from 'three';
import {app, $} from './app.js';
import {paint, select} from './edition.js';
import {lesVariantes, varianteCourante} from './synchro.js';
import {stylePlan, style as styleDuPlan} from './plan.js';

let comp=null;   // {a, b, mode:'barre'|'fondu', part, t, diff:[{it, A, B}], styleAvant}
export const comparaisonActive=()=>!!comp;

const etatDe=it=>({x:it.g.position.x,z:it.g.position.z,r:it.g.rotation.y,h:!!it.hidden,c:it.color||null});
const origine=it=>({x:it.home.x,z:it.home.z,r:0,h:false,c:null});
const meme=(a,b)=>Math.abs(a.x-b.x)<1e-4&&Math.abs(a.z-b.z)<1e-4&&Math.abs(a.r-b.r)<1e-5&&a.h===b.h&&a.c===b.c;
function poser(it,s){ it.g.position.x=s.x; it.g.position.z=s.z; it.g.rotation.y=s.r; it.g.visible=!s.h; if((it.color||null)!==s.c) paint(it,s.c); }
const versB=()=>{ for(const d of comp.diff) poser(d.it,d.B); app.model.updateMatrixWorld(true); };
const versA=()=>{ for(const d of comp.diff) poser(d.it,d.A); app.model.updateMatrixWorld(true); };

// ---------- fondu : deux rendus dans des textures, mélangés ----------
let rtA=null, rtB=null, quad=null;
function preparerFondu(){
  const t=app.renderer.getDrawingBufferSize(new THREE.Vector2());
  if(!rtA){
    const o={samples:4}; rtA=new THREE.WebGLRenderTarget(t.x,t.y,o); rtB=new THREE.WebGLRenderTarget(t.x,t.y,o);
    const mat=new THREE.ShaderMaterial({uniforms:{a:{value:rtA.texture},b:{value:rtB.texture},t:{value:0.5}},depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader:'uniform sampler2D a; uniform sampler2D b; uniform float t; varying vec2 vUv; void main(){ gl_FragColor=mix(texture2D(a,vUv),texture2D(b,vUv),t);\n#include <colorspace_fragment>\n}'});
    quad={scene:new THREE.Scene(),cam:new THREE.OrthographicCamera(-1,1,1,-1,0,1),mat};
    const m=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat); m.frustumCulled=false; quad.scene.add(m);
  } else if(rtA.width!==t.x||rtA.height!==t.y){ rtA.setSize(t.x,t.y); rtB.setSize(t.x,t.y); }
}

// appelé par main.js à chaque image, à la place du rendu simple (base : rendu habituel, pièce isolée ou vue éclatée)
export function rendreComparaison(cam,base){
  if(app.mode==='plan'&&styleDuPlan!=='reel'){ comp.styleAvant=comp.styleAvant||styleDuPlan; stylePlan('reel'); }
  const r=app.renderer;
  if(comp.mode==='barre'){
    base(cam);
    const w=app.canvas.clientWidth, h=app.canvas.clientHeight, x=Math.round(w*comp.part);
    r.setScissorTest(true); r.setScissor(x,0,w-x,h);
    try{ versB(); base(cam); } finally { versA(); r.setScissorTest(false); }
  } else {
    preparerFondu();
    try{ r.setRenderTarget(rtA); base(cam); versB(); r.setRenderTarget(rtB); base(cam); }
    finally{ versA(); r.setRenderTarget(null); }
    quad.mat.uniforms.t.value=comp.t; const ac=r.autoClear, cp=r.clippingPlanes; r.autoClear=true; r.clippingPlanes=[];
    r.render(quad.scene,quad.cam); r.autoClear=ac; r.clippingPlanes=cp;
  }
}

// ---------- début, fin, réglages ----------
export function comparer(idB){
  const a=varianteCourante(), b=lesVariantes().find(v=>v.id===idB); if(!a||!b||a.id===b.id) return false;
  select(null);
  const dB=b.disposition||{}, diff=[];
  for(const it of Object.values(app.items)){
    const A=etatDe(it), s=dB[it.name], B=s?{x:+s.x,z:+s.z,r:+s.r||0,h:!!s.h,c:s.c||null}:origine(it);
    if(!meme(A,B)) diff.push({it,A,B});
  }
  comp={a,b,mode:comp?.mode||'barre',part:0.5,t:0.5,diff,styleAvant:null};
  app.comparaison=true; majBandeau(); return true;
}
export function finComparaison(){
  if(!comp) return; const s=comp.styleAvant; comp=null; app.comparaison=false;
  if(s) stylePlan(s);
  $('bandeau-comparer').hidden=true; $('comparer-barre').hidden=true;
}
function majBandeau(){
  const b=$('bandeau-comparer'); b.hidden=!comp; if(!comp) return;
  const n=comp.diff.length;
  const diff=n?n+' élément'+(n>1?'s':'')+' différent'+(n>1?'s':''):'aucune différence';
  $('comparer-texte').textContent=comp.mode==='barre'?`« ${comp.a.nom} » à gauche de la barre, « ${comp.b.nom} » à droite · ${diff}`:`Fondu de « ${comp.a.nom} » (A) vers « ${comp.b.nom} » (B) · ${diff}`;
  for(const k of ['barre','fondu']) $('cmp-'+k).setAttribute('aria-pressed',String(comp.mode===k));
  $('cmp-fondu-box').hidden=comp.mode!=='fondu'; $('cmp-t').value=String(Math.round(comp.t*100));
  const barre=$('comparer-barre'); barre.hidden=comp.mode!=='barre';
  barre.querySelector('.cmp-g').textContent=comp.a.nom; barre.querySelector('.cmp-d').textContent=comp.b.nom;
  placerBarre();
}
function placerBarre(){ if(!comp) return; $('comparer-barre').style.left=(comp.part*100)+'%'; }

export function initComparer(){
  $('cmp-barre').onclick=()=>{ if(comp){ comp.mode='barre'; majBandeau(); } };
  $('cmp-fondu').onclick=()=>{ if(comp){ comp.mode='fondu'; majBandeau(); } };
  $('cmp-t').oninput=e=>{ if(comp) comp.t=(+e.target.value)/100; };
  $('cmp-fin').onclick=finComparaison;
  addEventListener('keydown',e=>{ if(comp&&e.key==='Escape'&&!/INPUT|TEXTAREA/.test(e.target.tagName)) finComparaison(); });
  // la barre se fait glisser (souris ou doigt)
  const barre=$('comparer-barre'); let tire=null;
  barre.addEventListener('pointerdown',e=>{ if(!comp) return; e.preventDefault(); e.stopPropagation(); tire=e.pointerId; barre.setPointerCapture(e.pointerId); });
  barre.addEventListener('pointermove',e=>{ if(tire!==e.pointerId||!comp) return; const r=app.canvas.getBoundingClientRect();
    comp.part=Math.min(0.98,Math.max(0.02,(e.clientX-r.left)/r.width)); placerBarre(); });
  const lacher=e=>{ if(tire===e.pointerId) tire=null; };
  barre.addEventListener('pointerup',lacher); barre.addEventListener('pointercancel',lacher);
  // la disposition affichée change (venue d'un autre appareil, liste du panneau…) : on recalcule les différences
  addEventListener('disposition',()=>{ if(comp){ const {mode,part,t,styleAvant}=comp; comparer(comp.b.id); Object.assign(comp,{mode,part,t,styleAvant}); majBandeau(); } });
  // la variante affichée change (autre variante, rechargement) : la comparaison s'arrête
  addEventListener('variantes',()=>{ if(comp&&varianteCourante()?.id!==comp.a.id) finComparaison(); });
}
