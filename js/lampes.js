// Lampes allumées le soir (étape 2, demande de Mauro du 9 octobre 2026) : en lumière « Soir » ou « Nuit », les lampes
// s'allument : leurs parties lumineuses brillent d'un blanc chaud (matière « lumiere » des luminaires construits en code :
// abat-jours, globes, réglettes, bandeaux ; pour un autre objet marqué lampe, ses parties claires), et les 4 lampes
// allumées les plus proches de ce qu'on regarde éclairent vraiment la pièce (4 sources ponctuelles au plus, pas d'ombres :
// la tablette reste fluide). Est une lampe : tout élément qui a une partie en matière « lumiere » (lampadaire, lampe du
// buffet, suspension, lustre, plafonniers, appliques, lampes des chevets…), ou tout objet coché « C'est une lampe » dans
// le panneau (Éditer) — les objets ajoutés plus tard (étape 4) pourront être marqués de même. Chaque lampe s'allume ou
// s'éteint : bouton du panneau (Éditer), ou toucher la lampe en Visite le soir. Choix gardés (clé maison3d-lampes).
import * as THREE from 'three';
import {app, $} from './app.js';
import {etat} from './calques.js';

const CLE='maison3d-lampes', CHAUD=new THREE.Color(0xffd29a), MAX=4, FORCE={soir:1.8,nuit:2.6};
let choix={}, sources=null, dernier=0, allume=null;
try{ choix=JSON.parse(localStorage.getItem(CLE)||'{}')||{}; }catch{ choix={}; }
const garder=()=>{ try{ localStorage.setItem(CLE,JSON.stringify(choix)); }catch{} };
const base=o=>o.userData.orig||o.material;   // matériau d'origine (avant recoloration ou allumage)
const LUMINEUX=['lumiere','cristal'];   // abat-jours, globes, réglettes, bandeaux ; pampilles du lustre
const parNature=it=>it.mats.some(o=>LUMINEUX.includes(base(o)?.name))||/lustre|lampe|lampadaire|suspension|plafonnier|applique/i.test(it.name);
export const estLampe=it=>!!it&&(choix[it.name]?.lampe??parNature(it));
export const estAllumee=it=>estLampe(it)&&choix[it.name]?.allumee!==false;
export const soirOuNuit=()=>etat.lumiere==='soir'||etat.lumiere==='nuit';
// parties qui brillent : matière « lumiere », sinon les parties claires et non métalliques
function parties(it){
  if(it.parties) return it.parties;
  let l=it.mats.filter(o=>LUMINEUX.includes(base(o)?.name));
  if(!l.length) l=it.mats.filter(o=>{ const m=base(o); if(!m?.color||(m.metalness||0)>0.5) return false; const c=m.color; return 0.2126*c.r+0.7152*c.g+0.0722*c.b>0.55; });
  return it.parties=l;
}
// allume ou éteint l'aspect d'une lampe (matériau propre à chaque partie, comme pour la recoloration)
function briller(it,oui){
  for(const o of parties(it)){
    if(!o.userData.orig){ if(!oui) continue; o.userData.orig=o.material; o.material=o.material.clone(); }   // éteinte et jamais allumée : rien à faire
    const m=o.material, b=o.userData.orig; if(!m.emissive) continue;
    if(oui){ m.emissive.copy(CHAUD); m.emissiveIntensity=etat.lumiere==='nuit'?2.2:1.6; } else { m.emissive.copy(b.emissive||new THREE.Color(0)); m.emissiveIntensity=b.emissiveIntensity??1; }
  }
}
function centre(it){ const b=new THREE.Box3(); for(const o of parties(it)) b.expandByObject(o); return b.isEmpty()?new THREE.Box3().setFromObject(it.g).getCenter(new THREE.Vector3()):b.getCenter(new THREE.Vector3()); }

export function basculerLampe(it,oui=!estAllumee(it)){ if(!estLampe(it)) return; choix[it.name]={...choix[it.name],allumee:oui}; garder(); dernier=0; allume=null; majPanneauLampe(); }
export function marquerLampe(it,oui){ choix[it.name]={...choix[it.name],lampe:oui}; if(!oui) briller(it,false); it.parties=null; garder(); dernier=0; allume=null; majPanneauLampe(); }
export function majPanneauLampe(){
  const it=app.selected, c=$('t-lampe'), b=$('t-allumer'); if(!c) return;
  if(!it){ return; } c.checked=estLampe(it); b.hidden=!estLampe(it);
  b.textContent=estAllumee(it)?'Éteindre la lampe (le soir)':'Allumer la lampe (le soir)'; b.setAttribute('aria-pressed',String(estAllumee(it)));
}
// À chaque image (au plus 3 fois par seconde pour les sources) : aspect des lampes, et 4 sources près de ce qu'on regarde
export function majLampes(){
  if(!app.mobilierPret) return;
  const soir=soirOuNuit(), cle=soir+etat.lumiere;
  if(cle!==allume){ allume=cle; for(const it of Object.values(app.items)) if(estLampe(it)||it.parties) briller(it,soir&&estAllumee(it)&&!it.hidden); }
  if(!soir&&!sources) return;
  if(!sources){ sources=[]; for(let k=0;k<MAX;k++){ const l=new THREE.PointLight(CHAUD,0,8,1.6); app.scene.add(l); sources.push(l); } }
  const t=performance.now(); if(t-dernier<300) return; dernier=t;
  const vue=app.mode==='orbit'?app.orbit.target:app.camera.position;
  const lampes=soir?Object.values(app.items).filter(it=>estAllumee(it)&&!it.hidden).map(it=>({it,p:centre(it)})).sort((a,b)=>a.p.distanceTo(vue)-b.p.distanceTo(vue)).slice(0,MAX):[];
  sources.forEach((l,k)=>{ const q=lampes[k]; l.intensity=q?FORCE[etat.lumiere]:0; if(q) l.position.copy(q.p); });
}
