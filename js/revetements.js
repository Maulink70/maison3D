// Sols et murs des pièces (étape 4, livraison 1, demande de Mauro) : chaque pièce peut recevoir une autre matière pour son
// sol et pour ses murs (bibliothèque de matières). Le modèle n'est pas modifié : on pose un revêtement, copie des faces de
// la structure à quelques millimètres devant elles. Les faces sont découpées à la zone de la pièce : ses rectangles
// (pieces.js) élargis jusqu'au milieu des murs qui la séparent d'une autre pièce (seuils des portes partagés), et jusqu'à
// 25 cm vers l'extérieur (tableaux des fenêtres). Sol : faces tournées vers le haut au niveau du sol de la pièce. Murs :
// faces verticales tournées vers la pièce (ou le long d'elle : tableaux), ou dont le dos donne sur la pièce (murs à une
// seule face). Les revêtements sont rangés à part (groupe « revetements ») : ni la visite, ni le plan ne les voient ;
// en murs transparents, ceux des murs le deviennent aussi. Disposition : sol__<pièce> et murs__<pièce> = {m:{sol|murs: choix}}.
import * as THREE from 'three';
import {app, $} from './app.js';
import {PIECES, pieceEn} from './pieces.js';
import {ETAGE_FLOOR} from './config.js';
import {materiau, geoMetres, selecteur, nomChoix} from './bibliotheque.js';
import {mursTransparents} from './transparence.js';
import {save} from './sauvegarde.js';
import {select} from './edition.js';
import {css} from './app.js';

const EXCLUS=['rez__escalier','rez__decor_entree','etage__garde_corps','toit_sud'];
const DECAL=0.003, MURS=0.25, SOLS=0.12;
const etats={};          // nom → état normalisé ({m:{…}}) ou absent
const poses=new Map();   // nom → maillage du revêtement
let groupe=null, transparentVu=false;
export const nomsSurfaces=()=>PIECES.flatMap(p=>['sol__'+p.id,'murs__'+p.id]);
export const lesSurfaces=()=>Object.entries(etats);
export const etatSurface=n=>etats[n]||null;
const pieceDe=n=>PIECES.find(p=>p.id===n.split('__')[1]);
export const libelleSurface=n=>{ const p=pieceDe(n); return (n.startsWith('sol')?'Sol':'Murs')+' · '+(p?p.nom:n); };
const sol=niv=>niv==='etage'?ETAGE_FLOOR:0;

// ---------- zone d'une pièce : ses rectangles élargis, sans empiéter au-delà du milieu des murs voisins ----------
function zone(p,E){
  const autres=PIECES.filter(q=>q!==p&&q.niveau===p.niveau).flatMap(q=>q.rects);
  return p.rects.map(([x0,z0,x1,z1])=>{
    const lim=(cote)=>{ let l=E;
      for(const [a0,b0,a1,b1] of autres){
        if(cote==='x1'&&b0<z1&&b1>z0&&a0>=x1-1e-3) l=Math.min(l,(a0-x1)/2);
        if(cote==='x0'&&b0<z1&&b1>z0&&a1<=x0+1e-3) l=Math.min(l,(x0-a1)/2);
        if(cote==='z1'&&a0<x1&&a1>x0&&b0>=z1-1e-3) l=Math.min(l,(b0-z1)/2);
        if(cote==='z0'&&a0<x1&&a1>x0&&b1<=z0+1e-3) l=Math.min(l,(z0-b1)/2);
      }
      return Math.max(0,l); };
    return [x0-lim('x0'),z0-lim('z0'),x1+lim('x1'),z1+lim('z1')];
  });
}
const dist=(rects,x,z)=>{ let d=Infinity; for(const [x0,z0,x1,z1] of rects){ const dx=Math.max(x0-x,0,x-x1), dz=Math.max(z0-z,0,z-z1); d=Math.min(d,Math.hypot(dx,dz)); } return d; };

// découpe d'un polygone (points 3D) par un demi-espace : axe 0 x, 1 y, 2 z ; garde v ≥ lim (sens 1) ou v ≤ lim (sens −1)
function couper(poly,axe,lim,sens){
  const out=[]; for(let i=0;i<poly.length;i++){ const P=poly[i], Q=poly[(i+1)%poly.length], dp=(P[axe]-lim)*sens, dq=(Q[axe]-lim)*sens;
    if(dp>=0) out.push(P); if((dp>=0)!==(dq>=0)){ const t=dp/(dp-dq); out.push([P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t,P[2]+(Q[2]-P[2])*t]); } }
  return out;
}
function decouper(tri,[x0,z0,x1,z1],y0,y1){
  let p=tri; for(const [a,l,s] of [[0,x0,1],[0,x1,-1],[2,z0,1],[2,z1,-1],[1,y0,1],[1,y1,-1]]){ p=couper(p,a,l,s); if(p.length<3) return null; }
  return p;
}
// triangles de la structure, en coordonnées monde, avec leur normale (une fois)
let triangles=null;
function lireStructure(){
  triangles=[]; const racine=app.model.children[0]; if(!racine) return; racine.updateMatrixWorld(true);
  const exclu=o=>{ for(;o;o=o.parent) if(EXCLUS.includes(o.name)) return true; return false; };
  const A=new THREE.Vector3(), B=new THREE.Vector3(), C=new THREE.Vector3(), N=new THREE.Vector3();
  racine.traverse(o=>{
    if(!o.isMesh||o.userData.dos||o.userData.vitre||o.userData.murTransparent||Array.isArray(o.material)||o.material.transparent||exclu(o)) return;
    const geo=o.userData.geoComplete||o.geometry, pos=geo.attributes.position, idx=geo.index, n=idx?idx.count:pos.count;
    for(let k=0;k+2<n;k+=3){
      A.fromBufferAttribute(pos,idx?idx.getX(k):k).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(pos,idx?idx.getX(k+1):k+1).applyMatrix4(o.matrixWorld);
      C.fromBufferAttribute(pos,idx?idx.getX(k+2):k+2).applyMatrix4(o.matrixWorld);
      N.subVectors(B,A).cross(C.clone().sub(A)); const l=N.length(); if(l<1e-9) continue; N.divideScalar(l);
      triangles.push({p:[A.toArray(),B.toArray(),C.toArray()],n:N.toArray(),
        bx0:Math.min(A.x,B.x,C.x),bx1:Math.max(A.x,B.x,C.x),bz0:Math.min(A.z,B.z,C.z),bz1:Math.max(A.z,B.z,C.z),by0:Math.min(A.y,B.y,C.y),by1:Math.max(A.y,B.y,C.y)});
    }
  });
}
// géométrie du revêtement (positions et normales, coordonnées monde)
function geometrie(p,type){
  if(!triangles) lireStructure();
  const rects=p.rects, Z=zone(p,type==='sol'?SOLS:MURS), y0=sol(p.niveau), pos=[], nor=[];
  const yb=type==='sol'?y0-0.02:y0-0.01, yh=type==='sol'?y0+0.05:p.id==='salon'?6.2:p.niveau==='rez'?ETAGE_FLOOR:6.2;
  for(const t of triangles){
    const [nx,ny,nz]=t.n;
    if(t.by1<yb||t.by0>yh) continue;
    if(type==='sol'?ny<0.9:Math.abs(ny)>0.2) continue;
    for(const r of Z){
      if(t.bx1<r[0]||t.bx0>r[2]||t.bz1<r[1]||t.bz0>r[3]) continue;
      const poly=decouper(t.p,r,yb,yh); if(!poly) continue;
      let sens=1;
      if(type==='murs'){
        const c=poly.reduce((s,q)=>[s[0]+q[0]/poly.length,s[1]+q[1]/poly.length,s[2]+q[2]/poly.length],[0,0,0]);
        const d0=dist(rects,c[0],c[2]), dv=dist(rects,c[0]+nx*0.05,c[2]+nz*0.05);
        if(dv>d0+1e-4){ if(d0<0.02) sens=-1; else continue; }   // tournée vers l'extérieur : son dos donne sur la pièce s'il est au bord
      }
      const d=DECAL*sens, q=poly.map(v=>[v[0]+nx*d,v[1]+ny*d,v[2]+nz*d]);
      for(let i=1;i+1<q.length;i++){ const tri=sens>0?[q[0],q[i],q[i+1]]:[q[0],q[i+1],q[i]];
        for(const v of tri){ pos.push(...v); nor.push(nx*sens,ny*sens,nz*sens); } }
    }
  }
  if(!pos.length) return null;
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3*2),2)); return g;
}

// ---------- pose ----------
const cacheMat=new Map();
function materiauSurface(ch,mur){
  const k=JSON.stringify(ch)+mur; if(cacheMat.has(k)) return cacheMat.get(k);
  const m=materiau(ch); m.polygonOffset=true; m.polygonOffsetFactor=-1; m.polygonOffsetUnits=-4; m.userData.mur=mur;
  cacheMat.set(k,m); return m;
}
const transparents=new Map();
function versionTransparente(m){ let t=transparents.get(m); if(!t){ t=m.clone(); t.transparent=true; t.opacity=0.3; t.depthWrite=false; t.side=THREE.DoubleSide; transparents.set(m,t); } return t; }

export function appliquerSurface(n,e){
  if(e) etats[n]=e; else delete etats[n];
  let mesh=poses.get(n); const ch=e?.m?Object.values(e.m)[0]:null;
  if(!ch){ if(mesh) mesh.visible=false; return; }
  const p=pieceDe(n); if(!p) return; const type=n.startsWith('sol')?'sol':'murs';
  if(!groupe){ groupe=new THREE.Group(); groupe.name='revetements'; app.model.add(groupe); }
  if(mesh===undefined){ const g=geometrie(p,type); mesh=g?new THREE.Mesh(g,materiauSurface(ch,type==='murs')):null; poses.set(n,mesh);
    if(mesh){ mesh.name=n; mesh.userData.surface=n; mesh.userData.geoBase=g; groupe.add(mesh); } }
  if(!mesh) return;
  const m=materiauSurface(ch,type==='murs'), taille=m.userData.taille||1;
  if(mesh.userData.taille!==taille){ const g=geoMetres(mesh.userData.geoBase,new THREE.Matrix4(),taille); if(mesh.geometry!==mesh.userData.geoBase) mesh.geometry.dispose(); mesh.geometry=g; mesh.userData.taille=taille; }
  mesh.userData.plein=m; mesh.material=type==='murs'&&mursTransparents()?versionTransparente(m):m; mesh.visible=true;
}
// à chaque image : en murs transparents, les revêtements des murs le deviennent aussi
export function majRevetements(){
  const t=mursTransparents(); if(t===transparentVu) return; transparentVu=t;
  for(const [n,mesh] of poses) if(mesh&&n.startsWith('murs')) mesh.material=t?versionTransparente(mesh.userData.plein):mesh.userData.plein;
}

// ---------- panneau : liste des pièces, sélection d'un sol ou des murs ----------
let choisie=null, boite=null;
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
export const surfaceChoisie=()=>choisie;
export function choisirSurface(n){
  choisie=n; if(boite){ app.scene.remove(boite); boite=null; }
  $('surf').hidden=!n; for(const b of document.querySelectorAll('[data-surface]')) b.setAttribute('aria-pressed',String(b.dataset.surface===n));
  if(!n) return;
  if(app.selected) select(null);
  const p=pieceDe(n), y0=sol(p.niveau), h=n.startsWith('sol')?0.02:(p.id==='salon'?5.6:2.4);
  const b=new THREE.Box3(); for(const [x0,z0,x1,z1] of p.rects) b.union(new THREE.Box3(new THREE.Vector3(x0,y0,z0),new THREE.Vector3(x1,y0+h,z1)));
  boite=new THREE.Box3Helper(b,new THREE.Color(css('--accent')||'#2c5a86')); app.scene.add(boite);
  $('surf-nom').textContent=libelleSurface(n); majPanneauSurface();
  $('surf').scrollIntoView({block:'nearest'});
}
function majPanneauSurface(){
  if(!choisie) return; const type=choisie.startsWith('sol')?'sol':'murs';
  selecteur($('surf-mat'),{parties:[{cle:type,nom:type==='sol'?'Sol':'Murs',couleur:'#cccccc'}],active:type,famille:type==='sol'?'Sols':'Finitions',cible:choisie,matiereAvantCouleur:true,
    origine:'Matière d’origine',valeur:()=>etats[choisie]?.m?.[type]||null,
    choisir:(cle,ch,enDirect)=>{ appliquerSurface(choisie,ch?{m:{[type]:ch}}:null); save(); if(!enDirect) majPanneauSurface(); },changerPartie:()=>{}});
  $('surf-etat').textContent=etats[choisie]?'Matière choisie : '+nomChoix(Object.values(etats[choisie].m)[0]):'Matière d’origine du modèle.';
}
// toucher un sol ou un mur dans la vue (Éditer, liste « Sols et murs » ouverte) : la pièce sous le point
export function surfaceEn(h){
  if(!h) return null; const n=h.face?h.face.normal.clone().transformDirection(h.object.matrixWorld):null; if(!n) return null;
  const niv=h.point.y>ETAGE_FLOOR-0.3?'etage':'rez';
  const p=pieceEn(h.point.x,h.point.z,niv)||PIECES.filter(q=>q.niveau===niv).map(q=>({q,d:dist(q.rects,h.point.x,h.point.z)})).sort((a,b)=>a.d-b.d).find(o=>o.d<0.4)?.q;
  if(!p) return null;
  if(n.y>0.8) return 'sol__'+p.id; if(Math.abs(n.y)<0.3) return 'murs__'+p.id; return null;
}
export function initRevetements(){
  const liste=$('sm-liste');
  for(const niv of ['rez','etage']){
    liste.append(el('div',{class:'level-title'},niv==='rez'?'Rez':'Étage'));
    for(const p of PIECES.filter(q=>q.niveau===niv)){
      const r=el('div',{class:'sm-ligne'}); r.append(el('span',{},p.nom));
      for(const [t,l] of [['sol','Sol'],['murs','Murs']]){ const b=el('button',{type:'button',class:'btn petit','data-surface':t+'__'+p.id,'aria-pressed':'false'},l); b.onclick=()=>{ const n=choisie===t+'__'+p.id?null:t+'__'+p.id; if(n) $('sm').open=false; choisirSurface(n); }; r.append(b); }
      liste.append(r);
    }
  }
  $('surf-fermer').onclick=()=>choisirSurface(null);
  addEventListener('disposition',()=>{ if(choisie) majPanneauSurface(); });
  addEventListener('edition',()=>{ if(!app.edition) choisirSurface(null); });
}
