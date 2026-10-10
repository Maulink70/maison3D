// État d'un élément de la disposition (étape 4) : position x / z, rotation r, masqué h, couleur c, et désormais taille s
// ([sx, sy, sz], meubles du modèle), matières m ({partie: {i, c, n}}) et, pour un objet ajouté, sa définition a
// ({t:'forme', f, p:{L, P, H…}, n: nom, v: niveau, y: sol, e: hauteur de pose}). Sols et murs des pièces (sol__<pièce>,
// murs__<pièce>) : m seulement. Un même format, normalisé (arrondis, clés triées), sert à la sauvegarde, à la
// synchronisation (n8n le garde tel quel), à l'historique et à la comparaison des variantes.
import * as THREE from 'three';
import {app} from './app.js';
import {setHidden} from './edition.js';
import {appliquerApparence} from './bibliotheque.js';
import {reconstruire} from './ajouts.js';
import {invaliderPlan} from './plan.js';

const r4=v=>Math.round(v*1e4)/1e4, r5=v=>Math.round(v*1e5)/1e5;
export const estSurface=n=>/^(sol|murs)__/.test(n);
function trier(o){ if(Array.isArray(o)) return o.map(trier); if(o&&typeof o==='object'){ const r={}; for(const k of Object.keys(o).sort()) r[k]=trier(o[k]); return r; } return o; }
function matieresPropres(m){
  if(!m||typeof m!=='object') return null; const r={};
  for(const k of Object.keys(m).sort()){ const v=m[k]; if(!v||typeof v!=='object'||(!v.i&&!v.c)) continue; r[k]={i:v.i??null,c:v.c??null,...(v.n?{n:String(v.n)}:{})}; }
  return Object.keys(r).length?r:null;
}
export function normaliser(n,e){
  if(!e||typeof e!=='object') return null;
  if(estSurface(n)){ const m=matieresPropres(e.m); return m?{m}:null; }
  // alertes ignorées (alertes.js) : {g: [{k, p, t}]}
  if(n==='alertes'){ const g=(Array.isArray(e.g)?e.g:[]).filter(x=>x&&x.k).map(x=>trier({k:String(x.k),p:x.p||{},t:String(x.t||'')})).sort((a,b)=>a.k<b.k?-1:a.k>b.k?1:0); return g.length?{g}:null; }
  const r={x:r4(+e.x||0),z:r4(+e.z||0),r:r5(+e.r||0),h:!!e.h,c:e.c||null};
  if(Array.isArray(e.s)&&e.s.length===3&&e.s.some(v=>Math.abs(v-1)>1e-4)) r.s=e.s.map(v=>r4(+v||1));
  const m=matieresPropres(e.m); if(m) r.m=m;
  if(e.a&&typeof e.a==='object') r.a=trier(e.a);
  return r;
}
const texte=(n,e)=>JSON.stringify(normaliser(n,e));
export const egaux=(n,a,b)=>texte(n,a)===texte(n,b);

export function etatDe(it){
  return normaliser(it.name,{x:it.g.position.x,z:it.g.position.z,r:it.g.rotation.y,h:it.hidden,c:it.color,s:it.g.scale.toArray(),m:it.matieres,a:it.ajout});
}
// état d'origine : meuble du modèle à sa place ; objet ajouté, sol ou mur : rien (null)
export function origineDe(n){
  if(estSurface(n)) return null; const it=app.items[n]; if(!it||it.ajout) return null;
  return normaliser(n,{x:it.home.x,z:it.home.z,r:0,h:false,c:null});
}

// taille d'un meuble du modèle (facteurs par axe, dans son repère) : boîte, plan, emprise et alertes suivent
// leger : le temps d'une image (comparaison des variantes), sans refaire le contour du plan ni les emprises
export function echelonner(it,s,leger=false){
  const v=new THREE.Vector3(...s); if(v.equals(it.g.scale)) return;
  if(!it.size0) it.size0=it.size.clone();
  it.g.scale.copy(v); it.size=it.size0.clone().multiply(v);
  if(!leger){ it.plan=it.empreinte=it.cellules=it.planCoins=null; invaliderPlan(); }
  if(it.matieres&&Object.keys(it.matieres).length) appliquerApparence(it);   // coordonnées de texture à la nouvelle taille
}
// couleur générale et matières : appliquées seulement si elles changent (les meubles jamais retouchés gardent leur matériau)
export function majApparence(it,force=false){
  const k=JSON.stringify([it.color||null,matieresPropres(it.matieres)]);
  if(!force&&k===(it.cleApparence??JSON.stringify([null,null]))) return;
  it.cleApparence=k; appliquerApparence(it);
}
// met un élément dans l'état e (normalisé)
export function appliquerEtat(it,e){
  if(!e) return;
  if(it.ajout&&e.a&&JSON.stringify(trier(it.ajout))!==JSON.stringify(e.a)) reconstruire(it,e.a);
  it.g.position.x=e.x; it.g.position.z=e.z; it.g.rotation.set(0,e.r||0,0);
  if(!it.ajout) echelonner(it,e.s||[1,1,1]);
  it.color=e.c||null; it.matieres=e.m?JSON.parse(JSON.stringify(e.m)):{}; majApparence(it);
  if(!!it.hidden!==!!e.h) setHidden(it,!!e.h);
}
