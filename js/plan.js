// Plan 2D vu de dessus, par niveau (livraison 5). Deux styles, même cadrage :
// - « Architecte » : dessin SVG sur fond papier. Murs coupés à 1 m au-dessus du sol, en noir : les faces de la structure
//   coupées par ce plan donnent des segments, tracés sur une grille de 1 cm ; on la remplit depuis l'intérieur de chaque
//   pièce et depuis l'extérieur, ce qui n'est pas atteint est du mur (vue exactement d'au-dessus, les faces verticales ne
//   se voient pas : impossible de noircir les murs par le rendu 3D). Meubles en contour vu de dessus (calculé une fois
//   par meuble), portes avec leur arc d'ouverture, fenêtres, escalier, garde-corps et vide sur le salon.
// - « Réaliste » : la maquette vue exactement d'au-dessus (caméra orthographique), coupée comme les vues Rez / Étage.
// Glisser = se déplacer, molette ou pincement = zoom ; en Éditer, on attrape un meuble pour le déplacer.
// Repère : x vers la droite, −z (le nord) vers le haut, échelle s en pixels par mètre.
import * as THREE from 'three';
import {app, $, css} from './app.js';
import {ETAGE_FLOOR, REZ_CUT, ROOF_CUT, ETAGE_CUT, GARDE_CORPS} from './config.js';
import {PIECES, bornes} from './pieces.js';
import {PORTES} from './portes.js';
import {ESC} from './rez_structure.js';
import {select} from './edition.js';
import {save} from './sauvegarde.js';

export const camPlan=new THREE.OrthographicCamera(-1,1,1,-1,0.1,200); camPlan.up.set(0,0,-1);
const COUPE=1.0, SMIN=12, SMAX=600, NS='http://www.w3.org/2000/svg';
const vue={cx:15.4,cz:-21.2,s:40};
let anim=null, niveau='rez', actif=false, contenu=null;
export let style='archi';
const svg=()=>$('plan'), monde=()=>$('plan-monde');
const sol=()=>niveau==='etage'?ETAGE_FLOOR:0;

// ---------- caméra, transformation du calque SVG ----------
function taille(){ const r=svg().getBoundingClientRect(); return {W:r.width||innerWidth,H:r.height||innerHeight,r}; }
function majVue(){
  const {W,H}=taille();
  camPlan.left=-W/2/vue.s; camPlan.right=W/2/vue.s; camPlan.top=H/2/vue.s; camPlan.bottom=-H/2/vue.s; camPlan.updateProjectionMatrix();
  camPlan.position.set(vue.cx,60,vue.cz); camPlan.lookAt(vue.cx,0,vue.cz);
  monde().setAttribute('transform',`translate(${W/2-vue.cx*vue.s} ${H/2-vue.cz*vue.s}) scale(${vue.s})`);
}
// point de l'écran → (x, z) en mètres
function versMonde(px,py){ const {W,H,r}=taille(); return {x:vue.cx+(px-r.left-W/2)/vue.s, z:vue.cz+(py-r.top-H/2)/vue.s}; }
// Cadre un rectangle (mètres) dans la partie libre de l'écran (sous la barre, à gauche du panneau)
function cible(b,marge=0.6){
  const {W,H,r}=taille(), haut=Math.max(16,document.querySelector('.bar').getBoundingClientRect().bottom-r.top+12);
  const p=$('panel'), droite=!p.hidden&&innerWidth>760?p.getBoundingClientRect().width+32:16, gauche=16, bas=16;
  const lw=Math.max(80,W-gauche-droite), lh=Math.max(80,H-haut-bas);
  const s=THREE.MathUtils.clamp(Math.min(lw/(b.x1-b.x0+2*marge),lh/(b.z1-b.z0+2*marge)),SMIN,SMAX);
  const mx=gauche+lw/2-W/2, my=haut+lh/2-H/2;
  return {cx:(b.x0+b.x1)/2-mx/s, cz:(b.z0+b.z1)/2-my/s, s};
}
function bornesNiveau(){
  const l=PIECES.filter(p=>p.niveau===niveau).map(bornes);
  if(niveau==='etage') l.push({x0:12.87,x1:19.44,z0:-21.11,z1:-14.34});   // vide sur le salon
  return {x0:Math.min(...l.map(b=>b.x0)),x1:Math.max(...l.map(b=>b.x1)),z0:Math.min(...l.map(b=>b.z0)),z1:Math.max(...l.map(b=>b.z1))};
}
const doux=matchMedia('(prefers-reduced-motion: reduce)');
function allerVue(c,anime=true){ if(!anime||doux.matches){ Object.assign(vue,c); anim=null; majVue(); return; } anim={t:0,a:{...vue},b:c}; }
export function cadrerPlan(b){ allerVue(cible(b,0.8)); }

// ---------- style : fond, calques de la caméra, coupes ----------
const papier=new THREE.Color();
function majCouleurs(){ papier.set(css('--panel')||'#ffffff'); if(actif&&style==='archi') app.scene.background=papier.clone(); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>setTimeout(majCouleurs));
new MutationObserver(()=>setTimeout(majCouleurs)).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
function poserStyle(){
  const archi=actif&&style==='archi';
  camPlan.layers.set(archi?31:0);   // architecte : la 3D ne dessine que le fond papier, tout le plan est en SVG
  app.scene.background=archi?papier.clone():new THREE.Color(css('--scene')||'#dfe3e6');
  const plans=[];   // réaliste : coupes des vues Rez / Étage de la maquette
  if(actif&&!archi) plans.push(new THREE.Plane(new THREE.Vector3(0,-1,0),niveau==='etage'?ROOF_CUT:REZ_CUT));
  if(actif&&!archi&&niveau==='etage') plans.push(new THREE.Plane(new THREE.Vector3(0,1,0),-ETAGE_CUT));
  app.renderer.clippingPlanes=plans;
  svg().classList.toggle('reel',style==='reel');
}

// ---------- contours : bords entre cellules pleines et vides d'une grille, enchaînés en boucles, simplifiés ----------
// plein[j*nx+i] ; (x0, z0) coin de la grille ; renvoie un chemin SVG en mètres (remplissage pair-impair)
function contours(plein,nx,nz,x0,z0,pas,tol){
  const P=(i,j)=>i>=0&&j>=0&&i<nx&&j<nz&&plein[j*nx+i]===1, cle=(i,j)=>j*(nx+1)+i, depart=new Map();
  const ajout=(a,b,c,d)=>{ const k=cle(a,b); if(!depart.has(k)) depart.set(k,[]); depart.get(k).push([a,b,c,d]); };
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){ if(!P(i,j)) continue;
    if(!P(i,j-1)) ajout(i,j,i+1,j); if(!P(i+1,j)) ajout(i+1,j,i+1,j+1); if(!P(i,j+1)) ajout(i+1,j+1,i,j+1); if(!P(i-1,j)) ajout(i,j+1,i,j); }
  const boucles=[];
  for(const liste of depart.values()) while(liste.length){
    let [a,b,c,d]=liste.pop(); const pts=[[a,b]];
    for(let garde=0;garde<1e7;garde++){ pts.push([c,d]); const suite=depart.get(cle(c,d)); if(!suite||!suite.length) break;
      const dx=c-a, dz=d-b; let k=suite.findIndex(e=>(e[2]-e[0])*dz-(e[3]-e[1])*dx<0); if(k<0) k=0;   // au point double, on tourne du même côté
      [a,b,c,d]=suite.splice(k,1)[0]; }
    if(pts.length>3) boucles.push(simplifier(pts.map(([i,j])=>[x0+i*pas,z0+j*pas]),tol));
  }
  return boucles.filter(b=>b.length>=3).map(b=>'M'+b.map(p=>p[0].toFixed(3)+' '+p[1].toFixed(3)).join('L')+'Z').join('');
}

// ---------- murs coupés à 1 m (grille de 1 cm, remplie depuis les pièces et l'extérieur) ----------
const POCHE=0.01, poches={};
function exclu(o){ while(o){ if(o.name==='toit_sud'||o.name==='rez__escalier') return true; o=o.parent; } return false; }
function murs(){
  if(poches[niveau]) return poches[niveau];
  const h=sol()+COUPE, racine=app.model.children[0]; racine.updateMatrixWorld(true);
  const x0=10.9, z0=-28.4, nx=Math.ceil((19.9-x0)/POCHE), nz=Math.ceil((-13.9-z0)/POCHE);
  const mur=new Uint8Array(nx*nz), A=new THREE.Vector3(), B=new THREE.Vector3(), C=new THREE.Vector3(), segs=[];
  const marque=(x,z)=>{ const i=Math.floor((x-x0)/POCHE), j=Math.floor((z-z0)/POCHE); if(i>=0&&j>=0&&i<nx&&j<nz) mur[j*nx+i]=1; };
  racine.traverse(o=>{
    if(!o.isMesh||o.userData.dos||o.material.transparent||exclu(o)) return;
    const bb=new THREE.Box3().setFromObject(o); if(bb.min.y>=h||bb.max.y<=h) return;
    const pos=o.geometry.attributes.position, idx=o.geometry.index, n=idx?idx.count:pos.count;
    for(let k=0;k<n;k+=3){
      A.fromBufferAttribute(pos,idx?idx.getX(k):k).applyMatrix4(o.matrixWorld);
      B.fromBufferAttribute(pos,idx?idx.getX(k+1):k+1).applyMatrix4(o.matrixWorld);
      C.fromBufferAttribute(pos,idx?idx.getX(k+2):k+2).applyMatrix4(o.matrixWorld);
      const s=[]; for(const [P,Q] of [[A,B],[B,C],[C,A]]) if((P.y-h)*(Q.y-h)<0){ const t=(h-P.y)/(Q.y-P.y); s.push(P.x+(Q.x-P.x)*t,P.z+(Q.z-P.z)*t); }
      if(s.length===4) segs.push(s);
    }
  });
  // Bouts de murs ouverts : aux portes et aux fenêtres, les deux faces d'un mur s'arrêtent sans face de bout, et le
  // remplissage entrait dans l'épaisseur du mur. Chaque extrémité libre est reliée à l'extrémité libre la plus proche
  // (à moins de 50 cm, plus proches l'une de l'autre que de toute autre ; une porte fait au moins 73 cm) : c'est la face
  // de bout qui manquait
  // (les faces en double, carrelage posé sur la peinture, sont d'abord écartées : elles cachaient des bouts ouverts)
  const cleP=(x,z)=>Math.round(x*500)+','+Math.round(z*500), nb=new Map(), uniques=new Set();
  for(let i=segs.length-1;i>=0;i--){ const a=cleP(segs[i][0],segs[i][1]), b=cleP(segs[i][2],segs[i][3]), k=a<b?a+';'+b:b+';'+a;
    if(a===b||uniques.has(k)) segs.splice(i,1); else uniques.add(k); }
  for(const t of segs) for(const k of [cleP(t[0],t[1]),cleP(t[2],t[3])]) nb.set(k,(nb.get(k)||0)+1);
  const libres=[]; for(const t of segs) for(const [x,z] of [[t[0],t[1]],[t[2],t[3]]]) if(nb.get(cleP(x,z))===1) libres.push([x,z]);
  const proche=i=>{ let m=-1, d=0.5; for(let j=0;j<libres.length;j++){ if(j===i) continue; const e=Math.hypot(libres[j][0]-libres[i][0],libres[j][1]-libres[i][1]); if(e<d){ d=e; m=j; } } return m; };
  for(let i=0;i<libres.length;i++){ const j=proche(i); if(j>i&&proche(j)===i) segs.push([...libres[i],...libres[j]]); }
  for(const t of segs){ const L=Math.ceil(Math.hypot(t[2]-t[0],t[3]-t[1])/(POCHE/2)); for(let q=0;q<=L;q++) marque(t[0]+(t[2]-t[0])*q/L,t[1]+(t[3]-t[1])*q/L); }
  // remplissage depuis le bord (dehors) et depuis le centre de chaque rectangle de pièce du niveau
  const vu=new Uint8Array(nx*nz), pile=new Int32Array(nx*nz*2); let n=0;
  const pousser=k=>{ if(!vu[k]&&!mur[k]){ vu[k]=1; pile[n++]=k; } };
  for(let i=0;i<nx;i++){ pousser(i); pousser((nz-1)*nx+i); } for(let j=0;j<nz;j++){ pousser(j*nx); pousser(j*nx+nx-1); }
  for(const p of PIECES.filter(q=>q.niveau===niveau)) for(const [a,b,c,d] of p.rects){ const i=Math.floor(((a+c)/2-x0)/POCHE), j=Math.floor(((b+d)/2-z0)/POCHE); pousser(j*nx+i); }
  while(n){ const k=pile[--n], i=k%nx; if(i>0) pousser(k-1); if(i<nx-1) pousser(k+1); if(k>=nx) pousser(k-nx); if(k<nx*(nz-1)) pousser(k+nx); }
  const plein=new Uint8Array(nx*nz); for(let k=0;k<nx*nz;k++) plein[k]=vu[k]?0:1;
  return poches[niveau]=contours(plein,nx,nz,x0,z0,POCHE,0.006);
}

// ---------- contour d'un meuble vu de dessus (grille de 2 cm, repère du meuble), calculé une fois ----------
const PAS=0.02;
function silhouette(it){
  if(it.plan) return it.plan;
  const g=it.g; g.updateMatrixWorld(true);
  const inv=g.matrixWorld.clone().invert(), m=new THREE.Matrix4(), v=new THREE.Vector3();
  const hx=it.size.x/2+0.04, hz=it.size.z/2+0.04, nx=Math.max(2,Math.ceil(2*hx/PAS)), nz=Math.max(2,Math.ceil(2*hz/PAS));
  const plein=new Uint8Array(nx*nz), mark=(x,z)=>{ const i=Math.floor((x+hx)/PAS), j=Math.floor((z+hz)/PAS); if(i>=0&&j>=0&&i<nx&&j<nz) plein[j*nx+i]=1; };
  g.traverse(o=>{
    if(!o.isMesh||o.name.endsWith('__couvercle')) return;
    m.multiplyMatrices(inv,o.matrixWorld);
    const pos=o.geometry.attributes.position, idx=o.geometry.index, n=idx?idx.count:pos.count, t=[0,0,0,0,0,0];
    for(let k=0;k<n;k+=3){
      for(let q=0;q<3;q++){ v.fromBufferAttribute(pos,idx?idx.getX(k+q):k+q).applyMatrix4(m); t[2*q]=v.x; t[2*q+1]=v.z; }
      const [ax,az,bx,bz,cx,cz]=t;
      for(const [px,pz,qx,qz] of [[ax,az,bx,bz],[bx,bz,cx,cz],[cx,cz,ax,az]]){ const L=Math.ceil(Math.hypot(qx-px,qz-pz)/(PAS/2)); for(let s=0;s<=L;s++) mark(px+(qx-px)*s/L,pz+(qz-pz)*s/L); }
      const aire=(bx-ax)*(cz-az)-(cx-ax)*(bz-az); if(Math.abs(aire)<1e-6) continue;
      const i0=Math.max(0,Math.floor((Math.min(ax,bx,cx)+hx)/PAS)), i1=Math.min(nx-1,Math.floor((Math.max(ax,bx,cx)+hx)/PAS));
      const j0=Math.max(0,Math.floor((Math.min(az,bz,cz)+hz)/PAS)), j1=Math.min(nz-1,Math.floor((Math.max(az,bz,cz)+hz)/PAS));
      for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const x=-hx+(i+0.5)*PAS, z=-hz+(j+0.5)*PAS;
        const w0=(bx-ax)*(z-az)-(x-ax)*(bz-az), w1=(cx-bx)*(z-bz)-(x-bx)*(cz-bz), w2=(ax-cx)*(z-cz)-(x-cx)*(az-cz);
        if((w0>=0&&w1>=0&&w2>=0)||(w0<=0&&w1<=0&&w2<=0)) plein[j*nx+i]=1; }
    }
  });
  return it.plan=contours(plein,nx,nz,-hx,-hz,PAS,0.012);
}
// Douglas-Peucker (1,2 cm) : les escaliers de la grille deviennent des diagonales ou des courbes. La boucle fermée est
// coupée en deux au point le plus éloigné du départ
function simplifier(pts,tol=0.012){
  let k=0, dm=0; for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1]); if(d>dm){ dm=d; k=i; } }
  if(k===0) return [];
  return [...dp(pts.slice(0,k+1),tol).slice(0,-1),...dp(pts.slice(k),tol).slice(0,-1)];
}
function dp(pts,tol){
  const garder=new Uint8Array(pts.length); garder[0]=garder[pts.length-1]=1;
  const pile=[[0,pts.length-1]];
  while(pile.length){ const [a,b]=pile.pop(); let dmax=0, k=-1; const [ax,az]=pts[a], [bx,bz]=pts[b], L=Math.hypot(bx-ax,bz-az)||1e-9;
    for(let i=a+1;i<b;i++){ const d=Math.abs((bx-ax)*(az-pts[i][1])-(ax-pts[i][0])*(bz-az))/L; if(d>dmax){ dmax=d; k=i; } }
    if(dmax>tol){ garder[k]=1; pile.push([a,k],[k,b]); } }
  return pts.filter((_,i)=>garder[i]);
}

// ---------- contenu du calque SVG ----------
const el=(nom,attrs,parent)=>{ const n=document.createElementNS(NS,nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); parent?.append(n); return n; };
const f3=v=>(+v).toFixed(3);
const meublesDuNiveau=()=>Object.values(app.items).filter(it=>it.meta.c==='meuble'&&it.lvl===(niveau==='etage'?'Étage':'Rez')&&it.home.y-sol()<COUPE);
function construire(){
  const m=monde(); m.replaceChildren(); contenu={niveau,meubles:new Map(),avecMobilier:app.mobilierPret};
  const archi=el('g',{class:'archi-seul'},m);
  el('path',{class:'poche',d:murs()},archi);
  if(niveau==='etage'){
    // vide sur le salon (double hauteur) et garde-corps vitré de la mezzanine
    const v={x0:12.87,x1:19.44,z0:-21.11,z1:-14.34};
    el('path',{class:'vide',d:`M${v.x0} ${v.z0}L${v.x1} ${v.z1}M${v.x1} ${v.z0}L${v.x0} ${v.z1}`},archi);
    const g=GARDE_CORPS; el('rect',{class:'gc',x:g.x0,y:g.z0,width:g.x1-g.x0,height:g.z1-g.z0},archi);
  } else {
    // escalier : marches, flèche de montée (du salon vers la mezzanine)
    const e=ESC, d=[`M${e.x0} ${e.zHaut}H${e.x1}V${e.zBas}H${e.x0}Z`];
    for(let k=1;k<e.n;k++){ const z=e.zBas-k*e.giron; if(z>e.zHaut) d.push(`M${e.x0} ${f3(z)}H${e.x1}`); }
    el('path',{class:'esc',d:d.join('')},archi);
    const xm=(e.x0+e.x1)/2; el('path',{class:'esc-fleche',d:`M${xm} ${e.zBas-0.15}V${e.zHaut+0.25}M${xm-0.12} ${e.zHaut+0.42}L${xm} ${e.zHaut+0.25}L${xm+0.12} ${e.zHaut+0.42}`},archi);
  }
  // fenêtres (cadre et vitre) ; Velux au-dessus de la coupe : en pointillé
  for(const it of Object.values(app.items)){
    if(it.meta.c!=='ouverture'||it.hidden||it.lvl!==(niveau==='etage'?'Étage':'Rez')||!/fenetre|baie|velux|element_mural/i.test(it.name)) continue;
    const b=new THREE.Box3().setFromObject(it.g), lx=b.max.x-b.min.x, lz=b.max.z-b.min.z;
    if(/velux/i.test(it.name)){ el('rect',{class:'velux',x:f3(b.min.x),y:f3(b.min.z),width:f3(lx),height:f3(lz)},archi); continue; }
    el('rect',{class:'fen',x:f3(b.min.x),y:f3(b.min.z),width:f3(lx),height:f3(lz)},archi);
    el('path',{class:'fen-l',d:lx>lz?`M${f3(b.min.x)} ${f3((b.min.z+b.max.z)/2)}H${f3(b.max.x)}`:`M${f3((b.min.x+b.max.x)/2)} ${f3(b.min.z)}V${f3(b.max.z)}`},archi);
  }
  // meubles
  const gm=el('g',{class:'meubles'},m);
  for(const it of meublesDuNiveau()){ const p=el('path',{class:'meuble','data-item':it.name,d:silhouette(it)},gm); p.append(Object.assign(document.createElementNS(NS,'title'),{textContent:it.meta.l})); contenu.meubles.set(it,{p,cle:''}); }
  // portes : battant ouvert et arc d'ouverture (porte d'entrée et porte-fenêtre comprises)
  for(const pt of app.portes){
    const d=pt.def; if(d.fenetre||(d.y0>1)!==(niveau==='etage')) continue;
    const h=d.axe==='x'?[d.plan,d.charniere]:[d.charniere,d.plan], autre=d.charniere===d.a0?d.a1:d.a0;
    const f=d.axe==='x'?[d.plan,autre]:[autre,d.plan], vx=f[0]-h[0], vz=f[1]-h[1], a=pt.ouvert, c=Math.cos(a), s=Math.sin(a);
    const o=[h[0]+vx*c+vz*s, h[1]-vx*s+vz*c], w=Math.hypot(vx,vz), sens=(vx*(o[1]-h[1])-vz*(o[0]-h[0]))>0?1:0;
    el('path',{class:'arc',d:`M${f3(f[0])} ${f3(f[1])}A${f3(w)} ${f3(w)} 0 0 ${sens} ${f3(o[0])} ${f3(o[1])}`},archi);
    el('path',{class:'porte',d:`M${f3(h[0])} ${f3(h[1])}L${f3(o[0])} ${f3(o[1])}`},archi);
  }
  majMeubles(true);
}
// position, rotation, masquage et sélection des meubles (à chaque image, seulement s'ils ont changé)
function majMeubles(force=false){
  for(const [it,e] of contenu.meubles){
    const g=it.g, k=`${g.position.x.toFixed(4)} ${g.position.z.toFixed(4)} ${g.rotation.y.toFixed(4)} ${it.hidden} ${app.selected===it}`;
    if(!force&&k===e.cle) continue; e.cle=k;
    e.p.setAttribute('transform',`translate(${g.position.x.toFixed(4)} ${g.position.z.toFixed(4)}) rotate(${(-g.rotation.y*180/Math.PI).toFixed(3)})`);
    e.p.style.display=it.hidden?'none':''; e.p.classList.toggle('sel',app.selected===it);
  }
}

// ---------- entrée, sortie, niveau, style ----------
export function entrerPlan(l){
  niveau=l==='etage'?'etage':'rez'; actif=true; svg().removeAttribute('hidden'); svg().classList.toggle('visite',!app.edition);
  app.tc.detach(); majCouleurs(); poserStyle(); construire(); allerVue(cible(bornesNiveau()),false);
}
export function sortirPlan(){ if(!actif) return; actif=false; anim=null; svg().setAttribute('hidden',''); poserStyle(); }
export function niveauPlan(l,recadrer=true){ niveau=l==='etage'?'etage':'rez'; poserStyle(); construire(); if(recadrer) allerVue(cible(bornesNiveau())); }
export function stylePlan(s){ style=s==='reel'?'reel':'archi'; for(const k of ['archi','reel']) $('ps-'+k).setAttribute('aria-pressed',String(k===style)); if(actif) poserStyle(); }
export function planActif(){ return actif; }

// Appelé à chaque image en plan : animation du cadrage, meubles, mode Visite / Éditer
export function majPlan(dt){
  if(!actif) return;
  if(anim){ anim.t=Math.min(1,anim.t+dt/0.6); const t=anim.t, k=t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    vue.cx=anim.a.cx+(anim.b.cx-anim.a.cx)*k; vue.cz=anim.a.cz+(anim.b.cz-anim.a.cz)*k; vue.s=anim.a.s*Math.pow(anim.b.s/anim.a.s,k); if(t>=1) anim=null; }
  majVue();
  if(!contenu||contenu.niveau!==niveau||(!contenu.avecMobilier&&app.mobilierPret)) construire(); else majMeubles();
  svg().classList.toggle('visite',!app.edition);
}

// ---------- gestes : glisser, pincer, molette ; en Éditer, attraper un meuble ----------
const doigts=new Map(); let geste=null;
const ecart=()=>{ const [a,b]=[...doigts.values()]; return Math.hypot(a.x-b.x,a.y-b.y); };
const milieu=()=>{ const [a,b]=[...doigts.values()]; return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}; };
function zoomer(f,px,py){ const avant=versMonde(px,py); vue.s=THREE.MathUtils.clamp(vue.s*f,SMIN,SMAX); majVue(); const apres=versMonde(px,py);
  vue.cx+=avant.x-apres.x; vue.cz+=avant.z-apres.z; majVue(); }
export function initPlan(){
  const s=svg();
  s.addEventListener('contextmenu',e=>e.preventDefault());
  s.addEventListener('wheel',e=>{ e.preventDefault(); anim=null; zoomer(Math.exp(-e.deltaY*0.0015),e.clientX,e.clientY); },{passive:false});
  s.addEventListener('pointerdown',e=>{
    s.setPointerCapture(e.pointerId); doigts.set(e.pointerId,{x:e.clientX,y:e.clientY}); anim=null;
    if(doigts.size===2){ if(geste?.type==='meuble'&&geste.bouge) save(); geste={type:'pince',d:ecart(),m:milieu(),s:vue.s}; return; }
    if(doigts.size>2) return;
    const cibleMeuble=app.edition&&e.target.closest?.('[data-item]');
    if(cibleMeuble){ const it=app.items[cibleMeuble.dataset.item]; if(app.selected!==it) select(it.name);
      geste={type:'meuble',it,x:e.clientX,y:e.clientY,gx:it.g.position.x,gz:it.g.position.z,bouge:false}; }
    else geste={type:'pan',x:e.clientX,y:e.clientY,cx:vue.cx,cz:vue.cz,bouge:false};
  });
  s.addEventListener('pointermove',e=>{
    if(!doigts.has(e.pointerId)||!geste) return; doigts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(geste.type==='pince'&&doigts.size===2){ const m=milieu(), avant=versMonde(geste.m.x,geste.m.y);
      vue.s=THREE.MathUtils.clamp(geste.s*ecart()/Math.max(20,geste.d),SMIN,SMAX); majVue();
      const apres=versMonde(m.x,m.y); vue.cx+=avant.x-apres.x; vue.cz+=avant.z-apres.z; geste.m=m; geste.s=vue.s; geste.d=ecart(); majVue(); return; }
    const dx=e.clientX-geste.x, dy=e.clientY-geste.y; if(Math.hypot(dx,dy)>4) geste.bouge=true;
    if(geste.type==='pan'){ vue.cx=geste.cx-dx/vue.s; vue.cz=geste.cz-dy/vue.s; majVue(); }
    else if(geste.type==='meuble'&&geste.bouge){ geste.it.g.position.x=geste.gx+dx/vue.s; geste.it.g.position.z=geste.gz+dy/vue.s; app.selBox?.update(); }
  });
  const fin=e=>{
    if(!doigts.delete(e.pointerId)) return;
    if(geste?.type==='meuble'&&geste.bouge) save();
    else if(geste?.type==='pan'&&!geste.bouge&&app.edition&&app.selected&&e.type==='pointerup') select(null);   // toucher le vide désélectionne
    if(doigts.size===1){ const [p]=doigts.values(); geste={type:'pan',x:p.x,y:p.y,cx:vue.cx,cz:vue.cz,bouge:true}; } else if(!doigts.size) geste=null;
  };
  s.addEventListener('pointerup',fin); s.addEventListener('pointercancel',fin);
  addEventListener('resize',()=>{ if(actif) majVue(); });
}
