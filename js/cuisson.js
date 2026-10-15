// Lumière précalculée (lot « réalisme », phase 1, 15 octobre 2026, demande de Mauro) : la lumière du ciel qui entre par les
// fenêtres et rebondit dans l'appartement est cuite une fois dans Blender (Cycles, outils/cuisson/cuire.py) sur la structure
// telle que le site la construit (murs, sols, plafonds, toit, escalier, cadres des portes et fenêtres de la maquette ; sans
// les meubles, qui bougent), puis posée sur ces faces en « lightMap » : cuisson/lumiere.webp (atlas), cuisson/lumiere_uv.bin
// (coordonnées u, v de chaque sommet, Uint16), cuisson/lumiere.json (fiche : version, force, empreinte des maillages).
// Rien n'est remodelé : les coordonnées sont posées sur les maillages dans l'ordre où le site les crée (maillagesCuits()),
// chacun vérifié par son nombre de sommets et une empreinte de ses coordonnées ; un maillage qui ne correspond plus reste
// sans lumière cuite (après toute modification de corrections.js ou des éléments construits : relancer la cuisson, voir
// outils/cuisson/LISEZMOI.md). Case « Lumière précalculée » du menu « Réaliste » (clé maison3d-cuisson, cochée d'office),
// force selon la lumière du jour ; la lumière d'ambiance baisse quand la cuisson est active (lumiere.js).
import * as THREE from 'three';
import {app} from './app.js';
import {etat} from './calques.js';
import {curseur, facteur, filtreLumiere} from './curseurs.js';

const CLE='maison3d-cuisson', FICHE='cuisson/lumiere.json';
export const FORCE={normale:1,matin:0.8,midi:1.15,soir:0.55,nuit:0.12};   // force de la lumière cuite selon la lumière du jour
// curseur « Effet » sous la case (Mauro, 15 octobre 2026) : à droite, lumière cuite plus forte et ambiance plus basse (plus de
// contraste entre les fenêtres et les coins), à gauche l'inverse ; 0 = réglage d'origine
export const baisseAmbiance=()=>Math.min(1,BAISSE_AMBIANCE/facteur('cuisson'));
export const BAISSE_AMBIANCE=0.6;   // lumière d'ambiance (hémisphère de lumiere.js) quand la cuisson éclaire déjà
let actif=true, dispo=false, atlas=null, intensite=1, mats=[], posee='';
try{ actif=JSON.parse(localStorage.getItem(CLE)??'true')!==false; }catch{}
export const cuissonActive=()=>actif&&dispo;
export const cuissonDisponible=()=>dispo;

// Maillages cuits, dans l'ordre : la structure (racine de structure.glb avec ses corrections et ses éléments construits)
// sans les dos, les vitres et le transparent ; puis les parties fixes des portes et fenêtres de la maquette (cadres, pas
// les battants ni les ouvrants : userData.porte). Le même ordre sert à l'export (outils/cuisson/exporter_structure.mjs).
const cuisible=o=>o.isMesh&&!o.userData.dos&&!o.userData.vitre&&!o.userData.murTransparent&&!o.userData.porte&&o.name!=='alerte'
  &&!o.name.endsWith('__couvercle')&&!Array.isArray(o.material)&&!o.material.transparent&&o.material.depthWrite!==false;
export function maillagesCuits(){
  const l=[], racine=app.model.children[0]; if(!racine) return l;
  racine.traverse(o=>{ if(cuisible(o)) l.push(o); });
  for(const it of Object.values(app.items)){ if(it.meta?.c!=='ouverture'||it.ajout) continue; it.g.traverse(o=>{ if(cuisible(o)) l.push(o); }); }
  return l;
}
// Empreinte d'une géométrie : nombre de sommets et somme pondérée des coordonnées (la cuisson doit correspondre au maillage)
export function empreinte(geo){
  const p=geo.attributes.position, n=p.count; let s=0;
  for(let i=0;i<n;i++) s+=p.getX(i)*1.7+p.getY(i)*2.3+p.getZ(i)*3.1;
  return {n,s:Math.round(s*100)};
}
// Chaque face a ses propres coordonnées dans l'atlas : la géométrie complète (murs transparents : userData.geoComplete) est
// rendue non indexée ; ses dos partagent la nouvelle
function nonIndexe(o){
  const g=o.userData.geoComplete||o.geometry; if(!g.index) return g;
  const n=g.toNonIndexed(); if(o.geometry===g) o.geometry=n; if(o.userData.geoComplete===g) o.userData.geoComplete=n;
  o.traverse(c=>{ if(c!==o&&c.isMesh&&c.geometry===g) c.geometry=n; }); return n;
}
// Dès que la structure est là, avant la première image : les murs transparents (transparence.js) sépareront ensuite des
// géométries qui partagent ces sommets, et la cuisson s'y posera aussi
export function preparerStructure(){ const r=app.model.children[0]; if(r) r.traverse(o=>{ if(cuisible(o)) nonIndexe(o); }); }
export function preparerCuisson(){ return maillagesCuits().map(o=>{ const geo=nonIndexe(o); return {o,geo,...empreinte(geo)}; }); }
// coordonnées de l'atlas posées sur la géométrie complète et sur celles qui partagent ses sommets (sols et murs séparés)
function poserUv(o,geo,attr){
  geo.setAttribute('uv1',attr);
  const autres=[o.geometry]; o.traverse(c=>{ if(c.userData.murTransparent) autres.push(c.geometry); });
  for(const g of autres) if(g!==geo&&g.attributes.position===geo.attributes.position) g.setAttribute('uv1',attr);
}

// Charge la cuisson (si elle existe) et la pose sur les maillages qui correspondent ; appelé une fois le mobilier installé
export async function appliquerCuisson(){
  if(dispo||!app.model.children[0]) return;
  const liste=preparerCuisson();   // avant toute attente : le même ordre et les mêmes géométries que l'export
  let fiche; try{ const r=await fetch(FICHE,{cache:'no-store'}); if(!r.ok) return; fiche=await r.json(); }catch{ return; }
  const v='?v='+encodeURIComponent(fiche.version||'1');
  const [bin,tex]=await Promise.all([
    fetch('cuisson/lumiere_uv.bin'+v).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null),
    new Promise(res=>new THREE.TextureLoader().load('cuisson/lumiere.webp'+v,t=>res(t),undefined,()=>res(null)))]);
  if(!bin||!tex) return;
  tex.colorSpace=THREE.SRGBColorSpace; tex.channel=1;
  const u=new Uint16Array(bin), N=Math.min(liste.length,fiche.maillages.length), cuits=new Set();
  let k=0, nOk=0;
  for(let i=0;i<N;i++){
    const {o,geo,n,s}=liste[i], m=fiche.maillages[i];
    if(n===m.n&&s===m.s&&k+n*2<=u.length){ const uv=new Float32Array(n*2); for(let j=0;j<n*2;j++) uv[j]=u[k+j]/65535;
      poserUv(o,geo,new THREE.BufferAttribute(uv,2)); cuits.add(o); nOk++; }
    k+=m.n*2;
  }
  if(!nOk){ console.warn('Lumière précalculée : aucun maillage ne correspond (cuisson à refaire)'); return; }
  if(nOk<liste.length) console.warn(`Lumière précalculée : ${liste.length-nOk} maillage(s) sur ${liste.length} sans cuisson (à recuire)`);
  // matériaux : ceux des maillages cuits recevront l'atlas ; tout autre maillage de la scène qui partage l'un d'eux en prend
  // une copie sans atlas (sans coordonnées uv1, il lirait un seul point de l'atlas)
  const partages=new Set(); for(const o of cuits) partages.add(o.material);
  app.scene.traverse(o=>{ if(o.isMesh&&!cuits.has(o)&&!Array.isArray(o.material)&&partages.has(o.material)) o.material=o.material.clone(); });
  mats=[...partages]; atlas=tex; intensite=+fiche.intensite||1; dispo=true; posee='';
  dispatchEvent(new CustomEvent('cuisson',{detail:{actif:cuissonActive(),cuits:nOk,total:liste.length}}));
}
// À chaque image : atlas posé ou retiré, force selon la lumière du jour (rien à faire tant que rien ne change)
export function majCuisson(){
  if(!dispo) return;
  const on=actif, f=on?intensite*(FORCE[etat.lumiere]??1)*filtreLumiere(etat.lumiere)*facteur('cuisson'):0, cle=on+'|'+f.toFixed(4); if(cle===posee) return; posee=cle;
  for(const m of mats){ const avait=!!m.lightMap; m.lightMap=on?atlas:null; m.lightMapIntensity=f; if(avait!==on) m.needsUpdate=true; }
}
export function initCuisson(){
  const c=document.getElementById('cq-cuisson'), l=document.getElementById('cq-cuisson-l');
  if(c){ c.checked=actif; c.onchange=()=>{ actif=c.checked; try{ localStorage.setItem(CLE,JSON.stringify(actif)); }catch{} dispatchEvent(new CustomEvent('cuisson',{detail:{actif:cuissonActive()}})); }; }
  const lc=document.getElementById('cq-cuisson-curseur-l');
  addEventListener('cuisson',()=>{ if(l) l.hidden=!dispo; if(lc) lc.hidden=!dispo||!actif; });
}
