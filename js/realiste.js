// Rendu réaliste (14 octobre 2026, « go » de Mauro) : choix « Rendu : Normal | Réaliste » dans le groupe Affichage du menu
// « Calques », « Réaliste » d'office quand la base « Réalisme » (ou l'une de ses variantes) est affichée ; deux choix gardés
// sur l'appareil (clé maison3d-rendu) : l'un pour la base Réalisme, l'autre pour tout le reste. « Réaliste » =
// 1. éclairage d'ambiance par une pièce « studio » préfiltrée (RoomEnvironment de three.js) sur tous les matériaux : lumière
//    douce venue de partout et vrais reflets (métal, verre, laque), force selon la lumière du jour ; les lumières d'ambiance
//    (lumiere.js) sont baissées d'autant ;
// 2. couleurs « appareil photo » (tone mapping « Neutral » de Khronos : zones claires adoucies, teintes des matières gardées) ;
// 3. ombres de contact (occlusion ambiante GTAO de three.js, case « Ombres de contact », à décocher si la tablette rame) :
//    maquette et 1re personne seulement (ni plan, ni comparaison, isolement, vue éclatée ou murs transparents), vitres et
//    objets transparents exclus, moitié de la résolution sur tablette. Bibliothèques chargées au premier usage.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {app, $} from './app.js';
import {etat as calques} from './calques.js';
import {lesVariantes, varianteCourante, groupeDe} from './synchro.js';

const CLE='maison3d-rendu';
const choix={rendu:'normal',renduR:'realiste',ao:true};
try{ Object.assign(choix,JSON.parse(localStorage.getItem(CLE)||'{}')); }catch{}
const garder=()=>{ try{ localStorage.setItem(CLE,JSON.stringify(choix)); }catch{} };

// ---------- quel rendu ----------
const simple=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
export function dansRealisme(){
  const v=varianteCourante(); if(!v) return false;
  const g=groupeDe(v), b=lesVariantes().find(x=>x.id===g); return simple(b?.nom)==='realisme';
}
const cle=()=>dansRealisme()?'renduR':'rendu';
export const renduReel=()=>choix[cle()]==='realiste';

// ---------- éclairage d'ambiance (aussi le reflet des objets importés en rendu normal, reflets.js) ----------
let env=null;
export function environnement(){
  if(!env){ const p=new THREE.PMREMGenerator(app.renderer), piece=new RoomEnvironment();
    env=p.fromScene(piece,0.04).texture; piece.traverse(o=>{ o.geometry?.dispose(); o.material?.dispose?.(); }); p.dispose(); }
  return env;
}
export const FORCE={normale:1,matin:0.85,midi:1,soir:0.65,nuit:0.2};   // force de l'environnement selon la lumière du jour
// réglages (regler() les change pour les essais) : force de l'environnement, exposition, ombres de contact (rayon en mètres)
export const REGLAGES={ambiance:0.8,exposition:1.05,aoRayon:0.5,aoEchelle:1.2,aoMelange:0.85};
export const BAISSE={ciel:0.4,soleil:0.85,appoint:0.4};   // lumières de lumiere.js en rendu réaliste (l'environnement éclaire déjà)

let pose=null;
// à chaque image : rien à faire tant que ni le rendu ni la lumière du jour ne changent
export function majRealiste(){
  const reel=renduReel(), f=FORCE[calques.lumiere]??1, k=reel+'|'+f; if(k===pose) return;
  const change=!pose||pose.split('|')[0]!==String(reel); pose=k;
  const r=app.renderer, s=app.scene;
  r.toneMapping=reel?THREE.NeutralToneMapping:THREE.NoToneMapping; r.toneMappingExposure=reel?REGLAGES.exposition:1;
  s.environment=reel?environnement():null; s.environmentIntensity=reel?REGLAGES.ambiance*f:1;
  if(change){ dispatchEvent(new CustomEvent('rendu',{detail:{reel}})); majBoutons(); }
}

// ---------- ombres de contact ----------
let comp=null, gtao=null, chargement=null, vu='';
const tablette=matchMedia('(hover:none),(pointer:coarse)').matches;
async function preparer(){
  const J='three/addons/postprocessing/';
  const [{EffectComposer},{RenderPass},{GTAOPass},{OutputPass}]=await Promise.all([
    import(J+'EffectComposer.js'),import(J+'RenderPass.js'),import(J+'GTAOPass.js'),import(J+'OutputPass.js')]);
  // vitres et objets transparents (verre, voiles, poignées de l'outil de déplacement) : pas d'ombre de contact autour
  class Contact extends GTAOPass{
    overrideVisibility(){ const cache=this._visibilityCache;
      this.scene.traverse(o=>{ cache.set(o,o.visible); if(o.isPoints||o.isLine||o.isSprite){ o.visible=false; return; }
        if(o.isMesh&&[].concat(o.material).every(m=>!m||m.depthWrite===false||(m.transparent&&m.opacity<0.95))) o.visible=false; }); }
  }
  const c=new EffectComposer(app.renderer); c.renderTarget1.samples=c.renderTarget2.samples=4;   // bords lissés comme sans effet
  const g=new Contact(app.scene,app.camera,1,1);
  g.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,rings:2,samples:tablette?8:16});
  c.addPass(new RenderPass(app.scene,app.camera)); c.addPass(g); c.addPass(new OutputPass());
  comp=c; gtao=g; reglerOmbres();
}
function reglerOmbres(){ if(!gtao) return;
  gtao.updateGtaoMaterial({radius:REGLAGES.aoRayon,distanceExponent:1,thickness:1,scale:REGLAGES.aoEchelle,samples:tablette?8:16}); gtao.blendIntensity=REGLAGES.aoMelange; }
export function regler(r){ Object.assign(REGLAGES,r); pose=null; reglerOmbres(); }
function taille(){
  const r=app.renderer, t=r.getSize(new THREE.Vector2()), k=t.x+'x'+t.y+'@'+r.getPixelRatio(); if(k===vu) return; vu=k;
  comp.setPixelRatio(r.getPixelRatio()); comp.setSize(t.x,t.y);
  if(tablette) gtao.setSize(Math.max(1,Math.round(t.x*r.getPixelRatio()/2)),Math.max(1,Math.round(t.y*r.getPixelRatio()/2)));
}
// appelé par main.js à la place du rendu simple : vrai si l'image a été faite ici
export function rendreReel(cam){
  const r=app.renderer;
  if(!renduReel()||!choix.ao||cam!==app.camera||app.mode==='plan'||r.getScissorTest()||(calques.murs&&app.mode==='orbit')) return false;
  if(!comp){ if(!chargement) chargement=preparer().catch(e=>{ console.warn('Ombres de contact indisponibles :',e); choix.ao=false; majBoutons(); }); return false; }
  taille(); comp.render(); return true;
}

// ---------- menu « Calques » (groupe Affichage) ----------
function majBoutons(){
  const m=$('cq-rendu'); if(!m) return; const reel=renduReel();
  for(const b of m.querySelectorAll('[data-rendu]')) b.setAttribute('aria-pressed',String(b.dataset.rendu===(reel?'realiste':'normal')));
  $('cq-ao-l').hidden=!reel; $('cq-ao').checked=!!choix.ao;
  $('cq-rendu-note').textContent=dansRealisme()?'Base « Réalisme » : « Réaliste » d’office.':'« Réaliste » : lumière d’ambiance, reflets, couleurs « appareil photo ».';
}
export function initRealiste(){
  const lum=$('cq-lum-normale')?.closest('.impr-ligne'); if(!lum) return;
  const l=document.createElement('div'); l.className='impr-ligne'; l.id='cq-rendu';
  l.innerHTML='<span id="cq-t-rendu">Rendu</span><div class="seg" role="group" aria-labelledby="cq-t-rendu">'+
    '<button type="button" id="cq-rendu-normal" data-rendu="normal">Normal</button><button type="button" id="cq-rendu-realiste" data-rendu="realiste">Réaliste</button></div>';
  l.querySelectorAll('[data-rendu]').forEach(b=>b.onclick=()=>{ choix[cle()]=b.dataset.rendu; garder(); majRealiste(); majBoutons(); });
  const a=document.createElement('label'); a.className='case'; a.id='cq-ao-l';
  a.innerHTML='<input type="checkbox" id="cq-ao"> Ombres de contact (plus lent sur tablette)';
  a.querySelector('input').onchange=e=>{ choix.ao=e.target.checked; garder(); };
  const n=document.createElement('p'); n.className='cq-note'; n.id='cq-rendu-note';
  lum.after(l,a,n);
  $('calques-bouton')?.addEventListener('click',()=>majBoutons());
  $('cq-raz')?.addEventListener('click',()=>{ choix[cle()]='normal'; garder(); majRealiste(); majBoutons(); });   // « Tout décocher » : rendu normal
  addEventListener('variantes',()=>majBoutons());
  majBoutons();
}
