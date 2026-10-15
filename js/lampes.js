// Lampes allumées le soir (étape 2, demande de Mauro du 9 octobre 2026) : en lumière « Soir » ou « Nuit », les lampes
// s'allument : leurs parties lumineuses brillent d'un blanc chaud (matière « lumiere » des luminaires construits en code :
// abat-jours, globes, réglettes, bandeaux ; pour un autre objet marqué lampe, ses parties claires), et les 4 lampes
// allumées les plus proches de ce qu'on regarde éclairent vraiment la pièce (6 sources ponctuelles au plus depuis le 15 octobre
// 2026, 4 avant ; en 1re personne, celles dans le champ de vision d'abord ; pas d'ombres :
// la tablette reste fluide). Est une lampe : tout élément qui a une partie en matière « lumiere » (lampadaire, lampe du
// buffet, suspension, lustre, plafonniers, appliques, lampes des chevets…), ou tout objet coché « C'est une lampe » dans
// le panneau (Éditer) — les objets ajoutés plus tard (étape 4) pourront être marqués de même. Chaque lampe s'allume ou
// s'éteint : bouton du panneau (Éditer), ou toucher la lampe en Visite le soir. Choix gardés (clé maison3d-lampes).
import * as THREE from 'three';
import {app, $} from './app.js';
import {etat} from './calques.js';
import {nommer, poserIcone} from './icones.js';

const CLE='maison3d-lampes', CHAUD=new THREE.Color(0xffd29a), MAX=6, FORCE={soir:1.8,nuit:2.6};
let eclairees=new Set();   // lampes qui portent une source (gardées de préférence : pas de halo qui saute d'une lampe à l'autre)
let choix={}, sources=null, dernier=0, allume=null;
try{ choix=JSON.parse(localStorage.getItem(CLE)||'{}')||{}; }catch{ choix={}; }
const garder=()=>{ try{ localStorage.setItem(CLE,JSON.stringify(choix)); }catch{} };
const base=o=>o.userData.orig||o.material;   // matériau d'origine (avant recoloration ou allumage)
const LUMINEUX=['lumiere','cristal'];   // abat-jours, globes, réglettes, bandeaux ; pampilles du lustre
// objets 3D importés (Blender…) : parties lumineuses d'après le nom d'origine de leur matière (gardé à l'import).
// Lampe boule ajourée de la sellette (base Réalisme, 15 octobre 2026, Mauro : « tous les trous font traverser la lumière ») :
// dans le fichier, une partie des trous a un disque « Lampe_Boule_Interieur », les autres un disque gris
// « Ceramique_Alveole_Lampe » : les alvéoles d'une lampe brillent aussi, tous les trous s'allument.
const LUMIERE_IMPORT=/opale|abat.?jour|ampoule|lumi|spot|diffus|interieur_lampe|lampe_boule_interieur|cristal|alveole.*lampe|lampe.*alveole/i;
const lumineuseImport=o=>LUMIERE_IMPORT.test(base(o)?.userData?.nom||'');
const parNature=it=>it.mats.some(o=>LUMINEUX.includes(base(o)?.name))||(!!it.ajout&&it.mats.some(lumineuseImport))||/lustre|lampe|lampadaire|suspension|plafonnier|applique/i.test(it.name)||(!!it.ajout&&/lustre|lampe|lampadaire|suspension|plafonnier|applique/i.test(it.meta?.l||''))
  ||['lampe','lampadaire'].includes(it.ajout?.f);   // formes « Lampe à poser » et « Lampadaire » (étape 4)
export const estLampe=it=>!!it&&(choix[it.name]?.lampe??parNature(it));
export const estAllumee=it=>estLampe(it)&&choix[it.name]?.allumee!==false;
export const soirOuNuit=()=>etat.lumiere==='soir'||etat.lumiere==='nuit';
// parties qui brillent : matière « lumiere », sinon les parties claires et non métalliques
function parties(it){
  if(it.parties) return it.parties;
  let l=it.mats.filter(o=>LUMINEUX.includes(base(o)?.name)||base(o)?.name==='abatjour'||(!!it.ajout&&lumineuseImport(o)));
  if(!l.length) l=it.mats.filter(o=>{ const m=base(o); if(!m?.color||(m.metalness||0)>0.5) return false; const c=m.color; return 0.2126*c.r+0.7152*c.g+0.0722*c.b>0.55; });
  return it.parties=l;
}
// allume ou éteint l'aspect d'une lampe (matériau propre à chaque partie, comme pour la recoloration)
function briller(it,oui){
  for(const o of parties(it)){
    if(!o.userData.orig){ if(!oui) continue; o.userData.orig=o.material; o.material=o.material.clone(); }   // éteinte et jamais allumée : rien à faire
    const m=o.material, b=o.userData.orig; if(!m.emissive) continue;
    // éteinte : l'éclat propre du matériau (matière choisie dans la bibliothèque, sinon celui d'origine)
    const nat=m.userData.emissif;
    if(oui){ m.emissive.copy(CHAUD); m.emissiveIntensity=etat.lumiere==='nuit'?2.2:1.6; }
    else if(nat){ m.emissive.setHex(nat.h); m.emissiveIntensity=nat.i; } else { m.emissive.copy(b.emissive||new THREE.Color(0)); m.emissiveIntensity=b.emissiveIntensity??1; }
  }
}
function centre(it){ const b=new THREE.Box3(); for(const o of parties(it)) b.expandByObject(o); return b.isEmpty()?new THREE.Box3().setFromObject(it.g).getCenter(new THREE.Vector3()):b.getCenter(new THREE.Vector3()); }

// matériau d'une partie changé (bibliothèque de matières, étape 4) : la lampe garde son état allumé ou éteint
addEventListener('apparence',e=>{ const it=e.detail.it; if(estLampe(it)||it.parties) briller(it,soirOuNuit()&&estAllumee(it)&&!it.hidden); });
export function basculerLampe(it,oui=!estAllumee(it)){ if(!estLampe(it)) return; choix[it.name]={...choix[it.name],allumee:oui}; garder(); dernier=0; allume=null; majPanneauLampe(); }
export function marquerLampe(it,oui){ choix[it.name]={...choix[it.name],lampe:oui}; if(!oui) briller(it,false); it.parties=null; garder(); dernier=0; allume=null; majPanneauLampe(); }
export function majPanneauLampe(){
  const it=app.selected, c=$('t-lampe'), b=$('t-allumer'); if(!c) return;
  if(!it){ return; } c.checked=estLampe(it); b.hidden=!estLampe(it);
  b.textContent=estAllumee(it)?'Éteindre la lampe (le soir)':'Allumer la lampe (le soir)'; b.setAttribute('aria-pressed',String(estAllumee(it)));
}
// menu « Ouvrir » de la barre : tous les éclairages d'un coup (Mauro, 14 octobre 2026 : « éteindre / allumer tous les
// éclairages ») ; comme une lampe seule, ils brillent le soir et la nuit, d'où « (le soir) » de jour
const lampesVisibles=()=>Object.values(app.items).filter(it=>!it.hidden&&estLampe(it));
export function toutesLampes(oui){ for(const it of lampesVisibles()) choix[it.name]={...choix[it.name],allumee:oui}; garder(); dernier=0; allume=null; majPanneauLampe(); majBoutonLampes(); }
let branche=false;
function majBoutonLampes(){
  const b=$('eclairages'); if(!b) return;
  if(!branche){ branche=true; b.addEventListener('click',()=>toutesLampes(!lampesVisibles().some(estAllumee))); }
  const l=lampesVisibles(); b.hidden=!l.length; if(!l.length) return;
  const on=l.some(estAllumee); b.setAttribute('aria-pressed',String(on));
  poserIcone(b,on?'lightbulb-off':'lightbulb'); nommer(b,(on?'Éteindre':'Allumer')+' tous les éclairages'+(soirOuNuit()?'':' (le soir)'));
}
for(const e of ['disposition','meubles','objet-pret']) addEventListener(e,()=>{ if(app.mobilierPret) majBoutonLampes(); });
// À chaque image (au plus 3 fois par seconde pour les sources) : aspect des lampes, et 4 sources près de ce qu'on regarde
export function majLampes(){
  if(!app.mobilierPret) return;
  const soir=soirOuNuit(), cle=soir+etat.lumiere;
  if(cle!==allume){ allume=cle; for(const it of Object.values(app.items)) if(estLampe(it)||it.parties) briller(it,soir&&estAllumee(it)&&!it.hidden); majBoutonLampes(); }
  if(!soir&&!sources) return;
  if(!sources){ sources=[]; for(let k=0;k<MAX;k++){ const l=new THREE.PointLight(CHAUD,0,8,1.6); app.scene.add(l); sources.push(l); } }
  const t=performance.now(); if(t-dernier<300) return; dernier=t;
  // en 1re personne, une lampe devant soi (dans le champ de vision) passe avant une lampe plus proche mais dans le dos ou de
  // côté (Mauro, 15 octobre 2026 : un pas vers la cuisine, et la lampe du buffet, au milieu de l'écran, perdait son halo et son
  // reflet sur la table au profit des éclairages de la cuisine) ; une lampe déjà éclairée garde un avantage (hystérésis)
  const vue=app.mode==='orbit'?app.orbit.target:app.camera.position, dir=new THREE.Vector3(), v=new THREE.Vector3();
  app.camera.getWorldDirection(dir); const marche=app.mode==='walk', champ=Math.cos(THREE.MathUtils.degToRad(Math.min(app.camera.fov*Math.max(1,app.camera.aspect)/2+12,80)));
  const score=(it,p)=>{ let d=p.distanceTo(vue);
    if(marche){ const c=v.copy(p).sub(vue).normalize().dot(dir); d*=c>=champ?1:c>0?2.2:3.5; }
    return eclairees.has(it.name)?d*0.8:d; };
  const lampes=soir?Object.values(app.items).filter(it=>estAllumee(it)&&!it.hidden).map(it=>{ const p=centre(it); return {it,p,s:score(it,p)}; }).sort((a,b)=>a.s-b.s).slice(0,MAX):[];
  eclairees=new Set(lampes.map(q=>q.it.name));
  sources.forEach((l,k)=>{ const q=lampes[k]; l.intensity=q?FORCE[etat.lumiere]:0; if(q) l.position.copy(q.p); });
}
