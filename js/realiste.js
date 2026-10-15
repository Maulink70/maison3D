// Rendu réaliste (14 octobre 2026, « go » de Mauro) : bouton « Réaliste » de la barre et son menu (15 octobre 2026, Mauro :
// les ombres de contact et les ombres du soleil « dans l'icône Réaliste » ; la ligne « Rendu : Normal | Réaliste » du menu
// « Affichage » est retirée) : ligne « Rendu réaliste » (enfoncée = réaliste), cases « Ombres de contact » (en réaliste
// seulement) et « Ombres du soleil » (ombres.js), note. « Réaliste » d'office quand la base « Réalisme » (ou l'une de ses
// variantes) est affichée ; deux choix gardés sur l'appareil (clé maison3d-rendu) : l'un pour la base Réalisme, l'autre
// pour tout le reste. « Réaliste » =
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
import {facteur, filtreLumiere} from './curseurs.js';
import {etat as calques} from './calques.js';
import {lesVariantes, varianteCourante, groupeDe} from './synchro.js';
import {nommer} from './icones.js';

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
  const reel=renduReel(), f=(FORCE[calques.lumiere]??1)*filtreLumiere(calques.lumiere), k=reel+'|'+f.toFixed(4); if(k===pose) return;   // filtre du menu « Lumière » (curseurs.js)
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
  // vitres et objets transparents (verre, voiles, poignées de l'outil de déplacement) : pas d'ombre de contact autour ;
  // le dehors (ciel, montagnes, collines, arbres) non plus : loin, il n'a pas d'ombre de contact, et derrière un mur absent
  // du calcul il venait se peindre sur le mur (Mauro, 14 octobre 2026 : silhouette des montagnes sur un mur du salon)
  class Contact extends GTAOPass{
    overrideVisibility(){ const cache=this._visibilityCache;
      this.scene.traverse(o=>{ cache.set(o,o.visible); if(o.isPoints||o.isLine||o.isSprite||o.name==='ciel'){ o.visible=false; return; }
        if(o.isMesh&&[].concat(o.material).every(m=>!m||m.depthWrite===false||(m.transparent&&m.opacity<0.95))) o.visible=false; }); }
  }
  const c=new EffectComposer(app.renderer); c.renderTarget1.samples=c.renderTarget2.samples=4;   // bords lissés comme sans effet
  const g=new Contact(app.scene,app.camera,1,1);
  // relief de la pièce (profondeur et normales) avec les deux faces de chaque surface : le matériau de remplacement du
  // calcul ne dessinait que l'avant des faces, et une surface vue par son envers (pièce d'un objet de Blender à deux
  // faces, dos des murs) disparaissait du calcul : l'ombre de ce qu'il y a derrière se posait dessus
  g.normalMaterial.side=THREE.DoubleSide;
  g.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,rings:2,samples:tablette?8:16});
  c.addPass(new RenderPass(app.scene,app.camera)); c.addPass(g); c.addPass(new OutputPass());
  comp=c; gtao=g; reglerOmbres();
}
function reglerOmbres(){ if(!gtao) return;
  // curseur « Effet » sous la case (Mauro, 15 octobre 2026) : à droite ombres plus marquées (échelle × 2 au bout), à gauche plus légères
  gtao.updateGtaoMaterial({radius:REGLAGES.aoRayon,distanceExponent:1,thickness:1,scale:REGLAGES.aoEchelle*facteur('ao'),samples:tablette?8:16}); gtao.blendIntensity=REGLAGES.aoMelange; }
addEventListener('curseur',e=>{ if(e.detail.nom==='ao') reglerOmbres(); });
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

// ---------- bouton « Réaliste » de la barre et son menu ----------
function majBoutons(){
  majBoutonBarre();
  const t=$('rendu-reel'); if(!t) return; const reel=renduReel();
  t.setAttribute('aria-pressed',String(reel));
  $('cq-ao-l').hidden=!reel; $('cq-ao').checked=!!choix.ao; $('cq-ao-curseur-l').hidden=!reel||!choix.ao;
  $('cq-rendu-note').textContent=dansRealisme()?'Base « Réalisme » : « Réaliste » d’office.':'« Réaliste » : lumière d’ambiance, reflets, couleurs « appareil photo ».';
}
// bouton « Réaliste » de la barre, à côté de « Affichage » (Mauro, 14 octobre 2026) : enfoncé en rendu réaliste ; il ouvre le menu (barre.js)
function majBoutonBarre(){
  const b=$('realiste'); if(!b) return; const reel=renduReel();
  b.setAttribute('aria-pressed',String(reel)); nommer(b,'Rendu réaliste et ombres : '+(reel?'réaliste':'normal'));
}
const basculer=()=>{ choix[cle()]=renduReel()?'normal':'realiste'; garder(); majRealiste(); majBoutons(); };
export function initRealiste(){
  $('rendu-reel')?.addEventListener('click',basculer);
  $('realiste')?.addEventListener('click',()=>majBoutons());   // le menu s'ouvre (barre.js) : état à jour
  $('cq-ao')?.addEventListener('change',e=>{ choix.ao=e.target.checked; garder(); majBoutons(); });
  addEventListener('rendu',()=>majBoutonBarre());
  addEventListener('variantes',()=>majBoutons());
  majBoutons();
}
