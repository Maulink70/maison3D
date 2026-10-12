// Vue éclatée (étape 2) : curseur « Vue éclatée » du menu « Calques » (groupe Affichage), en maquette avec « Tout » :
// l'étage s'élève au-dessus du rez (jusqu'à 3 m) pour voir les deux niveaux d'un coup d'œil. Rendu en deux passes : le rez
// (coupé à 2,38 m, sous le plancher de l'étage), puis tout l'appartement soulevé, coupé sous 2,38 m. Calques et mesures
// de l'étage suivent. Pendant l'éclaté, toucher la maquette ne sélectionne ni n'ouvre rien (remettre le curseur à 0).
// Tout éclaté (12 octobre 2026, à la place des « Murs soulevés » ; Mauro : « tout bouge en élément, comme la vue éclatée
// mais pour tout ») : curseur « Tout éclaté » (0 à 100 %), même condition. Les pièces s'écartent du centre de
// l'appartement et l'étage monte ; dans chaque pièce, tout s'écarte de son centre : chaque face de la structure (murs,
// sols, plafonds, toit, escalier, carrelages, revêtements) part le long de sa normale, d'autant plus qu'elle est loin du
// centre de la pièce (la boîte s'ouvre : murs vers l'extérieur, plafond vers le haut, le sol reste) ; chaque face suit
// la pièce qu'elle regarde (les deux côtés d'une cloison se séparent). Meubles, portes et fenêtres partent en bloc (portes
// et fenêtres le long de la normale de leur mur seulement, sans glisser de côté). Une seule passe : géométries de la
// structure recopiées (une fois par géométrie, positions refaites quand un curseur bouge), meubles déplacés le temps de
// l'image. Calques, mesures et points de vue des photos suivent (decaler()).
import * as THREE from 'three';
import {app} from './app.js';
import {ETAGE_CUT, ETAGE_FLOOR} from './config.js';
import {etat} from './calques.js';
import {PIECES} from './pieces.js';

const bas=new THREE.Plane(new THREE.Vector3(0,-1,0),ETAGE_CUT), haut=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const tout=()=>+etat.toutEclat||0, etage=()=>+etat.eclat||0;
export const eclatActif=()=>app.mode==='orbit'&&app.level==='all'&&(etage()>0.01||tout()>0.01);
const toutActif=()=>eclatActif()&&tout()>0.01;
// à 100 % : pièces écartées de 80 % de leur distance au centre de l'appartement, contenu de chaque pièce de 70 % de sa
// distance au centre de la pièce, étage monté de 3 m (plus la vue éclatée)
const K=0.8, A=0.7, L=3;
// la caméra suit (point regardé monté de la moitié de l'écart) : le zoom (molette, pincement) se fait au milieu des
// deux niveaux et l'étage ne sort pas de l'écran ; un changement de niveau recadre tout et repart de zéro
let monte=0;
addEventListener('niveau',()=>{ monte=0; });
export function suivreEclat(){
  const voulu=eclatActif()?(etage()+tout()*L)/2:0, d=voulu-monte; if(Math.abs(d)<1e-4||app.mode!=='orbit') return;
  app.orbit.target.y+=d; app.camera.position.y+=d; monte=voulu;
}

// ---------- pièces : centre (au sol) et rattachement d'un point ----------
const SALLES=PIECES.map(p=>{ let s=0,cx=0,cz=0; for(const [x0,z0,x1,z1] of p.rects){ const a=(x1-x0)*(z1-z0); s+=a; cx+=a*(x0+x1)/2; cz+=a*(z0+z1)/2; }
  return {p,etage:p.niveau==='etage',cx:cx/s,cz:cz/s,sol:p.niveau==='etage'?ETAGE_FLOOR:0}; });
const xs=PIECES.flatMap(p=>p.rects.flatMap(r=>[r[0],r[2]])), zs=PIECES.flatMap(p=>p.rects.flatMap(r=>[r[1],r[3]]));
const CX=(Math.min(...xs)+Math.max(...xs))/2, CZ=(Math.min(...zs)+Math.max(...zs))/2;
const auNiveau=y=>y>=ETAGE_FLOOR-0.17;   // un point à 2,57 m ou plus est d'abord cherché à l'étage
const ecartRect=(r,x,z)=>Math.hypot(Math.max(r[0]-x,0,x-r[2]),Math.max(r[1]-z,0,z-r[3]));
// pièce qui contient le point (son niveau d'abord, puis l'autre : le haut du salon n'est sous aucune pièce de l'étage) ;
// sinon, avec proche, la plus proche (pénalité de 1 m pour l'autre niveau)
function salleEn(x,y,z,proche){
  const et=auNiveau(y);
  for(const passe of [et,!et]) for(const s of SALLES) if(s.etage===passe&&s.p.rects.some(r=>ecartRect(r,x,z)<=0.02)) return s;
  if(!proche) return null;
  let m=null, dm=1e9; for(const s of SALLES){ const d=Math.min(...s.p.rects.map(r=>ecartRect(r,x,z)))+(s.etage===et?0:1); if(d<dm){ dm=d; m=s; } }
  return m;
}
// déplacement à 100 % (sans l'étage soulevé par la vue éclatée) d'un point de la salle s : pièce écartée, contenu écarté
// du centre de la pièce (n : seulement le long de cette normale ; axe : seulement le long de x ou de z)
function ecart(s,x,y,z,n,axe,out){
  let ix=x-s.cx, iy=y-s.sol, iz=z-s.cz;
  if(n){ const k=ix*n.x+iy*n.y+iz*n.z; ix=k*n.x; iy=k*n.y; iz=k*n.z; }
  else if(axe==='x'){ iy=0; iz=0; } else if(axe==='z'){ ix=0; iy=0; }
  return out.set(K*(s.cx-CX)+A*ix, A*iy+(s.etage?L:0), K*(s.cz-CZ)+A*iz);
}
// point (Vector3, modifié en place) : calques, mesures, points de vue des photos
const w=new THREE.Vector3();
export function decaler(p){
  if(!eclatActif()) return p;
  if(!toutActif()){ if(p.y>ETAGE_CUT-0.1) p.y+=etage(); return p; }
  const s=salleEn(p.x,p.y,p.z,true); ecart(s,p.x,p.y,p.z,null,null,w);
  return p.set(p.x+w.x*tout(),p.y+w.y*tout()+(s.etage?etage():0),p.z+w.z*tout());
}

// ---------- structure : chaque face part avec sa pièce ----------
// géométrie d'origine → copie non indexée, positions monde de départ, déplacement à 100 % et étage par sommet
const eclates=new WeakMap(), M=new THREE.Matrix4();
function eclatee(o){
  let x=eclates.get(o.geometry);
  if(x&&x.m.equals(o.matrixWorld)) return x;
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(), pos=g.attributes.position, n=pos.count;
  const W=new Float32Array(n*3), D=new Float32Array(n*3), E=new Uint8Array(n);
  const a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3(), G=new THREE.Vector3(), N=new THREE.Vector3(), q=new THREE.Vector3(), d=new THREE.Vector3();
  for(let t=0;t+2<n;t+=3){
    a.fromBufferAttribute(pos,t).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos,t+1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos,t+2).applyMatrix4(o.matrixWorld);
    G.copy(a).add(b).add(c).divideScalar(3); N.subVectors(b,a).cross(q.subVectors(c,a)); const l=N.length(); if(l>1e-12) N.divideScalar(l); else N.set(0,0,0);
    // la pièce que la face regarde (un peu devant elle), sinon celle derrière le mur (façades), sinon la plus proche
    let s=null; for(const k of [0.05,0.2,-0.15,-0.35,-0.6]){ q.copy(G).addScaledVector(N,k); if((s=salleEn(q.x,q.y,q.z,false))) break; }
    s=s||salleEn(G.x,G.y,G.z,true); ecart(s,G.x,G.y,G.z,N,null,d);
    for(const [i,v] of [[t,a],[t+1,b],[t+2,c]]){ W[i*3]=v.x; W[i*3+1]=v.y; W[i*3+2]=v.z; D[i*3]=d.x; D[i*3+1]=d.y; D[i*3+2]=d.z; E[i]=s.etage?1:0; }
  }
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
  x={g,W,D,E,m:o.matrixWorld.clone(),inv:o.matrixWorld.clone().invert(),cle:''}; eclates.set(o.geometry,x); return x;
}
function poser(x,e,h){
  const cle=e.toFixed(4)+'/'+h.toFixed(4); if(x.cle===cle) return; x.cle=cle;
  const p=x.g.attributes.position, A=p.array, W=x.W, D=x.D, E=x.E, m=x.inv.elements, n=p.count;
  for(let i=0;i<n;i++){ const k=i*3, X=W[k]+e*D[k], Y=W[k+1]+e*D[k+1]+E[i]*h, Z=W[k+2]+e*D[k+2];
    A[k]=m[0]*X+m[4]*Y+m[8]*Z+m[12]; A[k+1]=m[1]*X+m[5]*Y+m[9]*Z+m[13]; A[k+2]=m[2]*X+m[6]*Y+m[10]*Z+m[14]; }
  p.needsUpdate=true; x.g.computeBoundingSphere(); x.g.computeBoundingBox();
}
function structure(o,liste){ if(o===app.mobilier||!o.visible) return; if(o.isMesh) liste.push(o); for(const c of o.children) structure(c,liste); }

const boite=new THREE.Box3(), cB=new THREE.Vector3(), tB=new THREE.Vector3(), dB=new THREE.Vector3();
function rendreTout(cam){
  const {renderer,scene,model}=app, e=tout(), h=etage(), geos=[], places=[];
  try{
    const liste=[]; for(const c of model.children) structure(c,liste);
    for(const o of liste){ const x=eclatee(o); poser(x,e,h); geos.push([o,o.geometry]); o.geometry=x.g; }
    // meubles, portes et fenêtres : en bloc (boîtes mesurées avant de bouger quoi que ce soit)
    const blocs=[]; for(const c of app.mobilier?.children||[]){ if(!c.visible) continue; boite.setFromObject(c); if(boite.isEmpty()) continue;
      boite.getCenter(cB); boite.getSize(tB); blocs.push([c,cB.clone(),tB.x<tB.z?'x':'z',boite.min.y]); }
    const ouv=new Set(Object.values(app.items).filter(i=>i.meta.c==='ouverture').map(i=>i.g));
    for(const [c,ctr,axe,y0] of blocs){
      const s=salleEn(ctr.x,y0+0.05,ctr.z,true); ecart(s,ctr.x,ctr.y,ctr.z,null,ouv.has(c)?axe:null,dB).multiplyScalar(e); if(s.etage) dB.y+=h;
      places.push([c,c.position.clone()]); c.parent.worldToLocal(tB.copy(c.getWorldPosition(cB)).add(dB)); c.position.copy(tB);
    }
    renderer.render(scene,cam);
  } finally {
    for(let k=geos.length-1;k>=0;k--) geos[k][0].geometry=geos[k][1];
    for(const [c,p] of places) c.position.copy(p);
    model.updateMatrixWorld(true);
  }
}

// vue éclatée seule : deux passes, le rez (sous la coupe), puis l'appartement soulevé de d et coupé sous la coupe + d
export function rendreEclate(cam){
  if(toutActif()){ rendreTout(cam); return; }
  const {renderer,scene,model}=app, d=etage(), ac=renderer.autoClear, fond=scene.background, base=renderer.clippingPlanes;
  try{
    bas.constant=ETAGE_CUT; renderer.clippingPlanes=[bas]; renderer.render(scene,cam);
    renderer.autoClear=false; scene.background=null;   // (un fond de couleur effacerait la passe d'avant)
    model.position.y=d; haut.constant=-(ETAGE_CUT+d); renderer.clippingPlanes=[haut]; renderer.render(scene,cam);
  } finally {
    model.position.y=0; model.updateMatrixWorld(true); scene.background=fond; renderer.autoClear=ac; renderer.clippingPlanes=base;
  }
}
