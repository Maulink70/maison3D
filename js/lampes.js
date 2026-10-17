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
import {obstaclesPortes} from './portes.js';
import {nommer, poserIcone} from './icones.js';

const CLE='maison3d-lampes', CHAUD=new THREE.Color(0xffd29a), MAX=6, FORCE={soir:1.8,nuit:2.6};
// spots (plusieurs disques lumineux dans une même partie « spot » : les 5 spots sous les meubles hauts de la cuisine) : une source
// dirigée vers le bas par disque, en plus des 6 sources ponctuelles ; cône large et bord très doux (spots encastrés sans cache)
export const NB_SPOTS=5, SPOT={angle:THREE.MathUtils.degToRad(52), penumbre:1, decroit:2, portee:4, force:{soir:1.6,nuit:2.4}, dessous:0.015};   // ×2 le 17 octobre 2026 : à 0,8 / 1,2 les spots n'éclairaient presque pas le granit noir (reflets seuls)
let spotsL=null;   // les sources des spots (créées au premier soir où une lampe à plusieurs spots est allumée)
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
// les spots d'une lampe à plusieurs spots (les 5 de la cuisine) sont émissifs d'origine (matière Blender) : éteints, ils s'éteignent
// vraiment (Mauro, 15 octobre 2026 : « ou les 5 allumés, ou les 5 éteints »)
const spotEteignable=(it,o)=>/spot/i.test(base(o)?.userData?.nom||'')&&plusieursSpots(it);
function briller(it,oui){
  for(const o of parties(it)){
    if(!o.userData.orig){ if(!oui&&!spotEteignable(it,o)) continue; o.userData.orig=o.material; o.material=o.material.clone(); }   // éteinte et jamais allumée : rien à faire
    const m=o.material, b=o.userData.orig; if(!m.emissive) continue;
    // éteinte : l'éclat propre du matériau (matière choisie dans la bibliothèque, sinon celui d'origine)
    const nat=m.userData.emissif;
    if(oui){ m.emissive.copy(CHAUD); m.emissiveIntensity=etat.lumiere==='nuit'?2.2:1.6; }
    else if(nat){ m.emissive.setHex(nat.h); m.emissiveIntensity=nat.i; }
    else if(spotEteignable(it,o)){ m.emissive.setHex(0); m.emissiveIntensity=0; }
    else { m.emissive.copy(b.emissive||new THREE.Color(0)); m.emissiveIntensity=b.emissiveIntensity??1; }
  }
}
function centre(it){ const b=new THREE.Box3(); for(const o of parties(it)) b.expandByObject(o); return b.isEmpty()?new THREE.Box3().setFromObject(it.g).getCenter(new THREE.Vector3()):b.getCenter(new THREE.Vector3()); }
// un mur (plafond, plancher) ou une porte fermée entre le point de vue et la lampe ? (murs de la visite, app.colliders, et battants
// visibles des portes ; le garde-corps vitré et les vitres ne comptent pas ; 15 cm de marge au bout : une applique touche son mur,
// un plafonnier son plafond)
const rc=new THREE.Raycaster(), dv=new THREE.Vector3();
function cachee(p,vue){ dv.copy(p).sub(vue); const L=dv.length(); if(L<0.3) return false;
  rc.set(vue,dv.normalize()); rc.near=0.05; rc.far=L-0.15;
  return rc.intersectObjects([...(app.colliders||[]),...obstaclesPortes()],false).some(h=>!h.object.material?.transparent); }

// Spots d'une lampe : une même partie « spot » peut porter plusieurs disques lumineux séparés (les 5 spots de la cuisine, Mauro,
// 15 octobre 2026 : « les reflets donnent pas bien du tout » et « il faudrait que ça allume les 5 en même temps » : une seule source
// au milieu des 5 faisait de gros reflets ronds sur le granit, et un seul « spot » semblait allumé). Disques = îlots de sommets
// reliés (anneau et disque d'un même spot réunis à 1 cm près), calculés une fois dans le repère du meuble : ils le suivent.
function spotsDe(it){
  if(it.spotsPos!==undefined) return it.spotsPos;
  const res=[]; it.g.updateWorldMatrix(true,true);
  for(const o of parties(it)){
    if(!/spot/i.test(base(o)?.userData?.nom||'')) continue;
    const pos=o.geometry?.attributes?.position; if(!pos) continue;
    const idx=o.geometry.index, n=pos.count, par=new Int32Array(n); for(let i=0;i<n;i++) par[i]=i;
    const f=a=>{ while(par[a]!==a){ par[a]=par[par[a]]; a=par[a]; } return a; };
    const nt=idx?idx.count/3:n/3;
    for(let t=0;t<nt;t++){ const a=idx?idx.getX(3*t):3*t, b=idx?idx.getX(3*t+1):3*t+1, c=idx?idx.getX(3*t+2):3*t+2; par[f(a)]=f(b); par[f(b)]=f(c); }
    const boites=new Map(), v=new THREE.Vector3();
    for(let i=0;i<n;i++){ v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld); const k=f(i); let b=boites.get(k); if(!b) boites.set(k,b=new THREE.Box3()); b.expandByPoint(v); }
    const fus=[]; for(const b of boites.values()){ const m=fus.find(x=>x.clone().expandByScalar(0.01).intersectsBox(b)); if(m) m.union(b); else fus.push(b.clone()); }
    for(const b of fus) res.push(it.g.worldToLocal(b.getCenter(new THREE.Vector3())));
  }
  return it.spotsPos=res;
}
const plusieursSpots=it=>spotsDe(it).length>1;
// matériau d'une partie changé (bibliothèque de matières, étape 4) : la lampe garde son état allumé ou éteint
addEventListener('apparence',e=>{ const it=e.detail.it; if(estLampe(it)||it.parties) briller(it,soirOuNuit()&&estAllumee(it)&&!it.hidden); });
export function basculerLampe(it,oui=!estAllumee(it)){ if(!estLampe(it)) return; choix[it.name]={...choix[it.name],allumee:oui}; garder(); dernier=0; allume=null; majPanneauLampe(); }
export function marquerLampe(it,oui){ choix[it.name]={...choix[it.name],lampe:oui}; if(!oui) briller(it,false); it.parties=null; it.spotsPos=undefined; garder(); dernier=0; allume=null; majPanneauLampe(); }
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
  // une lampe derrière un mur, un plafond ou un plancher (rayon de la vue à la lampe contre les murs de la visite) n'éclaire pas la pièce
  // (16 octobre 2026, Mauro : « des reflets très mal placés » : dans la cuisine, le lustre et les lampes de la chambre, le plafonnier
  // de la salle de bain et une applique de la mezzanine, tous derrière un mur ou le plafond, prenaient 5 des 6 sources et se reflétaient
  // dans le granit à travers les murs ; sans ombres, une source traverse tout)
  const score=(it,p)=>{ let d=p.distanceTo(vue); if(cachee(p,vue)) return Infinity;
    if(marche){ const c=v.copy(p).sub(vue).normalize().dot(dir); d*=c>=champ?1:c>0?2.2:3.5; }
    return eclairees.has(it.name)?d*0.8:d; };
  const allumees=soir?Object.values(app.items).filter(it=>estAllumee(it)&&!it.hidden):[];
  const lampes=allumees.filter(it=>!plusieursSpots(it)).map(it=>{ const p=centre(it); return {it,p,s:score(it,p)}; }).filter(q=>isFinite(q.s)).sort((a,b)=>a.s-b.s).slice(0,MAX);
  eclairees=new Set(lampes.map(q=>q.it.name));
  sources.forEach((l,k)=>{ const q=lampes[k]; l.intensity=q?FORCE[etat.lumiere]:0; if(q) l.position.copy(q.p); });
  // la lampe à plusieurs spots la plus proche : une source par spot (les NB_SPOTS plus proches de la vue s'il y en a davantage)
  const multi=allumees.filter(plusieursSpots).map(it=>({it,s:score(it,centre(it))})).filter(q=>isFinite(q.s)).sort((a,b)=>a.s-b.s)[0];
  if(multi&&!spotsL){ spotsL=[]; for(let k=0;k<NB_SPOTS;k++){ const l=new THREE.SpotLight(CHAUD,0,SPOT.portee,SPOT.angle,SPOT.penumbre,SPOT.decroit); app.scene.add(l,l.target); spotsL.push(l); } }
  if(!spotsL) return;
  const pts=multi?spotsDe(multi.it).map(p=>multi.it.g.localToWorld(p.clone())).sort((a,b)=>a.distanceTo(vue)-b.distanceTo(vue)).slice(0,NB_SPOTS):[];
  spotsL.forEach((l,k)=>{ const p=pts[k]; l.intensity=p?SPOT.force[etat.lumiere]:0; if(p){ l.position.set(p.x,p.y-SPOT.dessous,p.z); l.target.position.set(p.x,p.y-1,p.z); l.target.updateMatrixWorld(); } });
}
