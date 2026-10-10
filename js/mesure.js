// Règle de mesure (livraison 7) : bouton « Mesurer », puis deux touchers donnent la distance, en maquette, en
// 1re personne et sur le plan. Les points s'aimantent aux coins proches (à moins de 14 px) : sommets de la face touchée
// en 3D ; sur le plan, coins exacts des murs coupés à 1 m et coins des meubles posés ; partout, extrémités des mesures
// déjà faites. Les mesures sont gardées (clé maison3d-mesures) et dessinées dans toutes les vues ; pendant la règle,
// toucher la valeur d'une mesure l'efface. Au survol (souris), un trait en pointillé suit le pointeur depuis le 1er point.
import * as THREE from 'three';
import {app, $} from './app.js';
import {ETAGE_FLOOR} from './config.js';
import {viser} from './edition.js';
import {versEcran, versMonde, niveauDuPlan, murs} from './plan.js';
import {etat} from './calques.js';
import {decalage} from './eclate.js';

const CLE='maison3d-mesures', NS='http://www.w3.org/2000/svg', AIMANT=14;
let mesures=[], premier=null, survol=null;
const m=v=>v.toFixed(2).replace('.',',')+' m', sol=niv=>niv==='etage'?ETAGE_FLOOR:0;
const niveauDuPoint=p=>p[1]>ETAGE_FLOOR-0.5?'etage':'rez';
function garder(){ try{ localStorage.setItem(CLE,JSON.stringify(mesures)); }catch{} }
function relire(){ try{ mesures=(JSON.parse(localStorage.getItem(CLE)||'[]')||[]).filter(q=>q.a&&q.b); }catch{ mesures=[]; } }
export function lesMesures(){ return mesures; }
// partage (étape 3) : chaque changement est annoncé (synchro.js) ; la liste du serveur remplace la locale
const annoncer=(op,q)=>dispatchEvent(new CustomEvent('mesures-change',{detail:{op,mesure:q}}));
export function remplacerMesures(liste){ mesures=liste.filter(q=>q&&q.a&&q.b); garder(); majBandeau(); }

// ---------- projection selon la vue ----------
const v3=new THREE.Vector3(), w3=new THREE.Vector3();
function projection(){
  if(app.mode==='plan') return p=>versEcran(p[0],p[2]);
  const r=$('mesures').getBoundingClientRect(), cam=app.camera;
  return p=>{ v3.set(p[0],p[1]+decalage(p[1]),p[2]).project(cam); if(v3.z>1||v3.z<-1) return null; return {x:(v3.x+1)/2*r.width,y:(1-v3.y)/2*r.height}; };
}
// segment à l'écran ; en 3D, la partie derrière la caméra est coupée (une longue mesure reste visible quand on est dessus)
function segmentEcran(a,b){
  if(app.mode==='plan') return {A:versEcran(a[0],a[2]),B:versEcran(b[0],b[2]),va:true,vb:true};
  const cam=app.camera, r=$('mesures').getBoundingClientRect(), lim=-cam.near-0.02;
  const pa=v3.set(a[0],a[1]+decalage(a[1]),a[2]).applyMatrix4(cam.matrixWorldInverse).clone(), pb=w3.set(b[0],b[1]+decalage(b[1]),b[2]).applyMatrix4(cam.matrixWorldInverse).clone();   // vue éclatée : étage soulevé
  const va=pa.z<lim, vb=pb.z<lim; if(!va&&!vb) return null;
  if(!va) pa.lerp(pb,(lim-pa.z)/(pb.z-pa.z)); else if(!vb) pb.lerp(pa,(lim-pb.z)/(pa.z-pb.z));
  const ecran=q=>{ q.applyMatrix4(cam.projectionMatrix); return {x:(q.x+1)/2*r.width,y:(1-q.y)/2*r.height}; };
  return {A:ecran(pa),B:ecran(pb),va,vb};
}
// une mesure est montrée si ses deux points sont au niveau affiché (plan : son niveau ; maquette : Rez, Étage ou Tout)
const visible=q=>{
  if(app.mode==='walk') return true;
  const niv=app.mode==='plan'?niveauDuPlan():app.level;
  return niv==='all'||niv==null||(niveauDuPoint(q.a)===niv&&niveauDuPoint(q.b)===niv);
};

// ---------- points aimantés ----------
const coinsMurs={};
// coins exacts des murs coupés à 1 m : extrémités des segments où le mur tourne (deux segments non alignés) ou s'arrête
// (la grille du plan, à 1 cm, rentre chaque mur d'un centimètre)
function coinsDesMurs(segs){
  const cle=(x,z)=>Math.round(x*500)+','+Math.round(z*500), dirs=new Map();
  for(const [x1,z1,x2,z2] of segs){ const L=Math.hypot(x2-x1,z2-z1); if(L<1e-4) continue;
    for(const [x,z,dx,dz] of [[x1,z1,(x2-x1)/L,(z2-z1)/L],[x2,z2,(x1-x2)/L,(z1-z2)/L]]){ const k=cle(x,z); if(!dirs.has(k)) dirs.set(k,{x,z,d:[]}); dirs.get(k).d.push([dx,dz]); } }
  const out=[];
  for(const {x,z,d} of dirs.values()){
    let coin=d.length===1;
    for(let i=0;i<d.length&&!coin;i++) for(let j=i+1;j<d.length;j++) if(d[i][0]*d[j][0]+d[i][1]*d[j][1]>-0.94){ coin=true; break; }
    if(coin) out.push([x,z]);
  }
  return out;
}
// coins d'un contour de meuble (chemin SVG du plan, repère du meuble) : là où il tourne d'au moins 35° entre deux côtés
// d'au moins 10 cm (les arrondis, découpés en petits côtés, n'en ont pas)
function vraisCoins(chemin){
  const out=[];
  for(const b of chemin.split('M').filter(Boolean)){
    const n=b.match(/-?[\d.]+/g)||[], pts=[]; for(let k=0;k+1<n.length;k+=2) pts.push([+n[k],+n[k+1]]);
    for(let i=0;i<pts.length;i++){ const p=pts[i], a=pts[(i-1+pts.length)%pts.length], c=pts[(i+1)%pts.length];
      const ux=p[0]-a[0], uz=p[1]-a[1], vx=c[0]-p[0], vz=c[1]-p[1], lu=Math.hypot(ux,uz), lv=Math.hypot(vx,vz);
      if(lu>=0.1&&lv>=0.1&&(ux*vx+uz*vz)/(lu*lv)<Math.cos(35*Math.PI/180)) out.push(p); }
  }
  return out;
}
function coinsDuPlan(niv){
  if(!coinsMurs[niv]) coinsMurs[niv]=coinsDesMurs(murs(niv).segs);
  const c=[...coinsMurs[niv]];
  for(const it of Object.values(app.items)){
    if(it.hidden||it.meta.c!=='meuble'||(it.lvl==='Étage')!==(niv==='etage')||/plante/i.test(it.meta.l)) continue;
    // coins du contour dessiné sur le plan (repère du meuble), sinon ceux de sa boîte
    const g=it.g, co=Math.cos(g.rotation.y), si=Math.sin(g.rotation.y), hx=it.size.x/2, hz=it.size.z/2;
    if(it.plan&&it.planCoins?.de!==it.plan) it.planCoins={de:it.plan,pts:vraisCoins(it.plan)};
    const pts=it.plan?it.planCoins.pts:[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]];
    for(const [lx,lz] of pts) c.push([g.position.x+lx*co+lz*si, g.position.z-lx*si+lz*co]);
  }
  for(const q of mesures) for(const p of [q.a,q.b]) if(niveauDuPoint(p)===niv) c.push([p[0],p[2]]);
  return c;
}
// point du plan sous le pointeur (x, z en mètres), aimanté
function pointPlan(cx,cy){
  const niv=niveauDuPlan(), w=versMonde(cx,cy), r=$('mesures').getBoundingClientRect();
  let best=null, d=AIMANT;
  for(const [x,z] of coinsDuPlan(niv)){ const e=versEcran(x,z), dd=Math.hypot(e.x+r.left-cx,e.y+r.top-cy); if(dd<d){ d=dd; best=[x,z]; } }
  const [x,z]=best||[w.x,w.z];
  return {p:[x,sol(niv)+0.01,z],aimante:!!best};
}
// point de la vue 3D sous le pointeur : face touchée, aimanté à ses sommets ou aux extrémités des mesures
const A=new THREE.Vector3();
function point3D(cx,cy){
  const h=viser(cx,cy); if(!h) return null;
  const proj=projection(), r=$('mesures').getBoundingClientRect(), cands=[];
  if(h.face){ const pos=h.object.geometry.attributes.position; for(const k of ['a','b','c']){ A.fromBufferAttribute(pos,h.face[k]).applyMatrix4(h.object.matrixWorld); cands.push([A.x,A.y,A.z]); } }
  for(const q of mesures) if(visible(q)) cands.push(q.a,q.b);
  let best=null, d=AIMANT;
  for(const c of cands){ const e=proj(c); if(!e) continue; const dd=Math.hypot(e.x+r.left-cx,e.y+r.top-cy); if(dd<d){ d=dd; best=c; } }
  return {p:best?[...best]:[h.point.x,h.point.y,h.point.z],aimante:!!best};
}
const pointSous=(cx,cy)=>app.mode==='plan'?pointPlan(cx,cy):point3D(cx,cy);

// ---------- toucher : premier point, puis second point = une mesure ----------
export function mesureToucher(cx,cy){
  const q=pointSous(cx,cy); if(!q) return;
  if(!premier){ premier=q.p; survol=null; majBandeau(); return; }
  const a=premier, b=q.p; premier=null; survol=null;
  if(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])<0.005){ majBandeau(); return; }
  const nouvelle={a:a.map(v=>+v.toFixed(4)),b:b.map(v=>+v.toFixed(4)),t:Math.max(Date.now(),(mesures.at(-1)?.t||0)+1)};   // t sert d'identifiant
  mesures.push(nouvelle); garder(); majBandeau(); annoncer('ajouter',nouvelle);
}
function activer(oui){
  app.mesure=oui; premier=null; survol=null; $('mesurer').setAttribute('aria-pressed',String(oui)); $('app').classList.toggle('mesure',oui); majBandeau();
}
function majBandeau(){
  const b=$('bandeau-mesure'); b.hidden=!app.mesure; if(!app.mesure) return;
  $('mesure-texte').textContent=premier?'Touchez le 2e point.':'Règle : touchez deux points (ils s’aimantent aux coins). Touchez une mesure pour l’effacer.';
  $('mesure-effacer').hidden=!mesures.length;
}

// ---------- dessin ----------
const pool=new Map();
const el=(nom,attrs,parent)=>{ const n=document.createElementNS(NS,nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); parent?.append(n); return n; };
const creer=(classe,parent)=>{ const g=el('g',{class:classe},parent); return {g,trait:el('path',{class:'trait'},g),bouts:el('path',{class:'bouts'},g),texte:el('text',{class:'valeur'},g)}; };
function noeud(id,classe){
  let n=pool.get(id); if(n) return n;
  n=creer(classe,$('mesures')); n.g.dataset.id=id;
  pool.set(id,n); return n;
}
const rond=p=>`M${(p.x-4).toFixed(1)} ${p.y.toFixed(1)}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`;
function dessinerSegment(n,{A,B,va=true,vb=true},texte){
  n.trait.setAttribute('d',`M${A.x.toFixed(1)} ${A.y.toFixed(1)}L${B.x.toFixed(1)} ${B.y.toFixed(1)}`);
  n.bouts.setAttribute('d',(va?rond(A):'')+(vb?rond(B):''));
  let ang=Math.atan2(B.y-A.y,B.x-A.x)*180/Math.PI; if(ang>90) ang-=180; if(ang<-90) ang+=180;
  const L=Math.hypot(B.x-A.x,B.y-A.y)||1, nx=-(B.y-A.y)/L, ny=(B.x-A.x)/L, s=ny>0?-1:1;   // valeur au-dessus du trait
  n.texte.textContent=texte; n.texte.setAttribute('transform',`translate(${((A.x+B.x)/2+nx*10*s).toFixed(1)} ${((A.y+B.y)/2+ny*10*s).toFixed(1)}) rotate(${ang.toFixed(1)})`);
}
const texteMesure=(a,b)=>{ const d=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]), dh=Math.abs(b[1]-a[1]); return m(d)+(dh>0.05?' · Δh '+m(dh):''); };
export function majMesures(){
  const svg=$('mesures'); if(!svg) return;
  const montrer=app.mobilierPret&&(app.mesure||etat.mesures)&&(mesures.length||premier);
  svg.toggleAttribute('hidden',!montrer); if(!montrer){ for(const n of pool.values()) n.g.remove(); pool.clear(); return; }
  const vus=new Set();
  for(const q of mesures){
    if(!visible(q)) continue;
    const seg=segmentEcran(q.a,q.b); if(!seg) continue;
    const id='m'+q.t, n=noeud(id,'mesure'); vus.add(id); n.texte.dataset.mesure=String(q.t);
    dessinerSegment(n,seg,texteMesure(q.a,q.b));
  }
  if(premier){ const seg=survol?segmentEcran(premier,survol):null, A=seg?null:projection()(premier);
    if(seg||A){ const n=noeud('en-cours','mesure en-cours'); vus.add('en-cours');
      if(seg) dessinerSegment(n,seg,texteMesure(premier,survol));
      else { n.trait.setAttribute('d',''); n.bouts.setAttribute('d',rond(A)); n.texte.textContent=''; } } }
  for(const [id,n] of pool) if(!vus.has(id)){ n.g.remove(); pool.delete(id); }
}

// Impression (livraison 8) : les mesures d'un niveau dans le groupe svg, proj(x, z) donne le point sur le papier
export function mesuresImpression(niv,svg,proj){
  for(const q of mesures){ if(niveauDuPoint(q.a)!==niv||niveauDuPoint(q.b)!==niv) continue;
    dessinerSegment(creer('mesure',svg),{A:proj(q.a[0],q.a[2]),B:proj(q.b[0],q.b[2])},texteMesure(q.a,q.b)); }
}

// ---------- gestes ----------
export function initMesure(){
  relire();
  $('mesurer').onclick=()=>activer(!app.mesure);
  $('mesure-terminer').onclick=()=>activer(false);
  $('mesure-effacer').onclick=()=>{ mesures=[]; premier=null; garder(); majBandeau(); annoncer('toutEffacer'); };
  addEventListener('keydown',e=>{ if(app.mesure&&e.key==='Escape'){ if(premier){ premier=null; survol=null; majBandeau(); } else activer(false); } });
  // toucher la valeur d'une mesure l'efface (sans déplacer la vue)
  $('mesures').addEventListener('pointerdown',e=>{ const t=e.target.closest?.('[data-mesure]'); if(!t) return;
    e.preventDefault(); e.stopPropagation(); const q=mesures.find(q=>String(q.t)===t.dataset.mesure); mesures=mesures.filter(q=>String(q.t)!==t.dataset.mesure); garder(); majBandeau(); if(q) annoncer('supprimer',q); });
  // sur le plan, un toucher bref (sans glisser) pose un point ; la vue 3D passe par main.js (mesureToucher)
  // (un deuxième doigt, pour pincer, annule le toucher)
  let pd=null; const appuis=new Set();
  $('plan').addEventListener('pointerdown',e=>{ appuis.add(e.pointerId); pd=app.mesure&&appuis.size===1?{x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId}:null; },true);
  $('plan').addEventListener('pointerup',e=>{ appuis.delete(e.pointerId); if(!pd||pd.id!==e.pointerId) return; const court=Math.hypot(e.clientX-pd.x,e.clientY-pd.y)<6&&performance.now()-pd.t<600; pd=null;
    if(app.mesure&&court) mesureToucher(e.clientX,e.clientY); },true);
  $('plan').addEventListener('pointercancel',e=>{ appuis.delete(e.pointerId); pd=null; },true);
  // survol à la souris : trait élastique depuis le premier point (un calcul par image au plus)
  let attente=null;
  const survoler=e=>{ if(!app.mesure||!premier||e.pointerType==='touch'||e.buttons) return; attente=[e.clientX,e.clientY]; };
  $('plan').addEventListener('pointermove',survoler); app.canvas.addEventListener('pointermove',survoler);
  const boucle=()=>{ if(attente&&premier){ const q=pointSous(...attente); survol=q?q.p:null; } attente=null; requestAnimationFrame(boucle); }; requestAnimationFrame(boucle);
}
