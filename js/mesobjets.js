// « Mes objets 3D » (13 octobre 2026, Mauro : la machine à espresso faite dans « Retouches », dans ses autres variantes
// sans la refaire) : menu « + », les objets 3D (fichier, Tripo, catalogue) et les images plates (panneau photo) déjà
// ajoutés dans les variantes, une fois chacun (même fichier) ; « Ajouter ici » = le même objet dans la variante affichée :
// même fichier (rien n'est réenvoyé, aucun crédit), même taille, couleur, matières et hauteur de pose, à la même place que
// dans la variante d'où il vient (ou à la place de l'objet à remplacer) ; un meuble du modèle masqué là-bas à cet endroit
// (remplacé par lui, comme la machine à café du bar) est masqué aussi, case cochée d'avance.
// Recherche et tri (15 octobre 2026, Mauro : « cette liste n'est pas triée, pas de champ de recherche… ne faudrait-il pas
// séparer les objets de base avec ceux créés ? ») : champ de recherche (nom, variante, boutique, sans accents), pastilles
// « Mes ajouts » (objets qui ne sont dans aucune base : la machine, le porte-fruits…, montrés d'office), « Objets des bases »
// (les objets Blender de la base « Réalisme »…), « Tous » (les deux, par groupe) ; case « Cacher ceux déjà dans cette
// variante » ; liste par ordre alphabétique ; choix gardés sur l'appareil (clé maison3d-mesobjets).
import {app} from './app.js';
import {lesVariantes, varianteCourante, verrouillee} from './synchro.js';
import {lireDisposition} from './sauvegarde.js';
import {ajouterObjet, remplacementEnCours} from './objets.js';
import {nomDe} from './ajouts.js';
import {lireFichier} from './fichiers.js';
import {texteOrigine} from './import3d.js';

const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const cm=v=>String(Math.round((+v||0)*1000)/10).replace('.',',');
const cle=a=>a.t==='glb'&&a.fic?.id?'g:'+a.fic.id:a.t==='photo'&&a.img?.id?'p:'+a.img.id:null;
const sans=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const CLE='maison3d-mesobjets';
const lireChoix=()=>{ try{ const c=JSON.parse(localStorage.getItem(CLE)||'{}'); return {filtre:['mes','bases','tous'].includes(c.filtre)?c.filtre:'mes',cacher:!!c.cacher}; }catch{ return {filtre:'mes',cacher:false}; } };
let fen=null, liste=[], choix=lireChoix(), filtreVu='mes';
const garder=()=>{ try{ localStorage.setItem(CLE,JSON.stringify(choix)); }catch{} };

// les objets des variantes (la plus récemment modifiée d'abord : c'est sa place et son aspect qui sont repris) ; chaque objet
// sait dans quelles variantes et dans quelles bases il est (un objet d'une base est « de base », même s'il est aussi dans une copie)
function recueillir(){
  const cour=varianteCourante(), ici=lireDisposition(), vus=new Map(), deja=new Set();
  for(const e of Object.values(ici)) if(e?.a){ const k=cle(e.a); if(k) deja.add(k); }
  const vs=lesVariantes().filter(v=>!v.origine).sort((a,b)=>(b.id===cour?.id)-(a.id===cour?.id)||String(b.modifieeLe||'').localeCompare(String(a.modifieeLe||'')));
  for(const v of vs){
    const d=v.id===cour?.id?ici:(v.disposition||{}), base=verrouillee(v);
    for(const [n,e] of Object.entries(d)){
      if(!e?.a||(e.a.t!=='glb'&&e.a.t!=='photo')) continue; const k=cle(e.a); if(!k) continue;
      let o=vus.get(k); if(!o){ o={k,n,e,d,v,noms:[],bases:[]}; vus.set(k,o); }
      const l=base?o.bases:o.noms; if(!l.includes(v.nom)) l.push(v.nom);
    }
  }
  return [...vus.values()].map(o=>({...o,ici:deja.has(o.k),masques:masquesLa(o),nom:nomDe(o.e.a),deBase:o.bases.length>0,
    texte:sans([nomDe(o.e.a),...o.noms,...o.bases,o.e.a.o?texteOrigine(o.e.a.o):'',o.e.a.t==='glb'?'modele 3d':'image plate'].join(' '))}))
    .sort((a,b)=>sans(a.nom).localeCompare(sans(b.nom),'fr'));
}
// meubles du modèle masqués dans la variante d'origine, à moins de 60 cm de l'objet, et visibles ici (l'objet les remplaçait)
function masquesLa(o){
  const r=[];
  for(const [n,x] of Object.entries(o.d)){
    const it=app.items[n]; if(!x?.h||!it||it.ajout||it.hidden) continue;
    if(Math.hypot((+x.x||0)-o.e.x,(+x.z||0)-o.e.z)<0.6) r.push(it);
  }
  return r;
}
function construire(){
  fen=el('div',{id:'mesobjets-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Mes objets 3D',hidden:''});
  fen.innerHTML=`<div class="fenetre-carte">
    <div class="fenetre-tete"><h2>Mes objets 3D</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <p class="mat-aide mo-aide"></p>
    <div class="mo-outils">
      <input type="search" id="mo-recherche" placeholder="Rechercher un objet (nom, variante, boutique)…" aria-label="Rechercher un objet" autocomplete="off">
      <div class="mo-pastilles" role="group" aria-label="Montrer">
        <button type="button" class="pastille" data-f="mes">Mes ajouts</button>
        <button type="button" class="pastille" data-f="bases">Objets des bases</button>
        <button type="button" class="pastille" data-f="tous">Tous</button>
        <label class="mo-cacher"><input type="checkbox" id="mo-cacher-ici"> Cacher ceux déjà dans cette variante</label>
      </div>
    </div>
    <ul class="mo-liste"></ul></div>`;
  document.body.append(fen);
  fen.querySelector('.fermer').onclick=()=>ouvrirMesObjets(false);
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') ouvrirMesObjets(false); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen) ouvrirMesObjets(false); });
  fen.querySelector('#mo-recherche').addEventListener('input',remplir);
  for(const b of fen.querySelectorAll('.pastille')) b.onclick=()=>{ choix.filtre=filtreVu=b.dataset.f; garder(); remplir(); };
  const c=fen.querySelector('#mo-cacher-ici'); c.checked=choix.cacher; c.onchange=()=>{ choix.cacher=c.checked; garder(); remplir(); };
}
const CUBE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
// pour l'assistant : y a-t-il au moins un objet 3D ou une image plate à reprendre ?
export function mesObjetsDisponibles(){ return recueillir().length; }
export function ouvrirMesObjets(oui=true){
  if(oui&&!fen) construire(); if(!fen) return; fen.hidden=!oui; if(!oui) return;
  liste=recueillir(); const rempl=remplacementEnCours();
  fen.querySelector('.mo-aide').textContent=!liste.length?'Aucun objet 3D ni image plate dans vos variantes pour l’instant : ils apparaîtront ici dès que vous en aurez ajouté un (fichier 3D, Tripo, catalogue, photo).'
    :rempl?`Le nouvel objet prend la place et l’orientation de « ${rempl.meta.l} », qui sera masqué. Même fichier : rien n’est refait, aucun crédit.`
    :'Les objets déjà ajoutés dans vos variantes. « Ajouter ici » les met dans la variante affichée, à la même place, même taille et mêmes matières : rien n’est refait, aucun crédit.';
  fen.querySelector('.mo-outils').hidden=!liste.length;
  // la pastille gardée, sauf si elle ne montrerait rien alors qu'il y a des objets ailleurs (pas encore d'ajout à soi : « Tous »)
  const nMes=liste.filter(o=>!o.deBase).length, nBases=liste.length-nMes;
  filtreVu=choix.filtre; if((filtreVu==='mes'&&!nMes)||(filtreVu==='bases'&&!nBases)) filtreVu='tous';
  const q=fen.querySelector('#mo-recherche'); q.value=''; remplir();
  if(matchMedia('(hover:hover) and (pointer:fine)').matches) q.focus();
}
function remplir(){
  const ul=fen.querySelector('.mo-liste'), rempl=remplacementEnCours(), q=sans(fen.querySelector('#mo-recherche').value.trim()), cacher=fen.querySelector('#mo-cacher-ici').checked;
  const nMes=liste.filter(o=>!o.deBase).length, nBases=liste.length-nMes;
  for(const b of fen.querySelectorAll('.pastille')){ const f=b.dataset.f; b.setAttribute('aria-pressed',String(f===filtreVu)); b.textContent=(f==='mes'?'Mes ajouts':f==='bases'?'Objets des bases':'Tous')+` (${f==='mes'?nMes:f==='bases'?nBases:liste.length})`; }
  const garde=o=>(filtreVu==='tous'||(filtreVu==='mes')!==o.deBase)&&(!cacher||!o.ici)&&(!q||o.texte.includes(q));
  const mes=liste.filter(o=>!o.deBase&&garde(o)), bases=liste.filter(o=>o.deBase&&garde(o));
  ul.replaceChildren();
  if(!mes.length&&!bases.length){ ul.append(el('li',{class:'mo-vide mat-aide'},q?'Aucun objet ne correspond à cette recherche.':cacher?'Tout ce qui est ici est déjà dans cette variante.':'Rien dans ce groupe.')); return; }
  if(filtreVu==='tous'&&mes.length&&bases.length){ ul.append(el('li',{class:'mo-titre'},`Mes ajouts (${mes.length})`)); for(const o of mes) ul.append(carte(o,rempl)); ul.append(el('li',{class:'mo-titre'},`Objets des bases (${bases.length})`)); for(const o of bases) ul.append(carte(o,rempl)); }
  else for(const o of [...mes,...bases]) ul.append(carte(o,rempl));
}
function carte(o,rempl){
  const a=o.e.a, li=el('li',{class:'mo-carte'}), vg=el('div',{class:'mo-vign'}), inf=el('div',{class:'mo-info'});
  vg.innerHTML=CUBE;
  if(a.t==='photo'&&a.img?.id) lireFichier(a.img.id,a.img.n||1,a.img.type||'image/jpeg').then(b=>{ if(!b) return; vg.replaceChildren(el('img',{src:URL.createObjectURL(b),alt:''})); }).catch(()=>{});
  inf.append(el('strong',{},o.nom),el('span',{},(a.t==='glb'?'Modèle 3D':'Image plate')+` · ${cm(a.p?.L)} × ${cm(a.p?.P)} × ${cm(a.p?.H)} cm`));
  if(a.o) inf.append(el('span',{class:'mat-aide'},texteOrigine(a.o)));
  const q=l=>l.map(x=>`« ${x} »`).join(', '), parts=[];
  if(o.bases.length) parts.push((o.bases.length>1?'les bases ':'la base ')+q(o.bases));
  if(o.noms.length) parts.push((o.noms.length>1?'les variantes ':'la variante ')+q(o.noms));
  inf.append(el('span',{class:'mat-aide'},'Dans '+parts.join(' et ')));
  if(o.ici) inf.append(el('span',{class:'mo-ici'},'déjà dans cette variante'));
  const cases=[];
  if(!rempl) for(const it of o.masques){ const lb=el('label',{class:'mo-masquer'}), c=el('input',{type:'checkbox'}); c.checked=true; cases.push([c,it]);
    lb.append(c,el('span',{},`masquer aussi « ${it.meta.l} », comme dans « ${o.v.nom} »`)); inf.append(lb); }
  const b=el('button',{type:'button',class:'btn primary'},rempl?'Mettre à sa place':'Ajouter ici');
  b.onclick=()=>{
    const e=o.e, x={...a}; delete x.v; delete x.y; delete x.e;
    const it=ajouterObjet(x,{x:e.x,z:e.z,r:e.r||0,niv:a.v==='etage'?'etage':'rez'},{c:e.c||null,m:e.m||null,pose:+a.e||0,masquer:cases.filter(([c])=>c.checked).map(([,i])=>i.name)});
    if(it) ouvrirMesObjets(false);
  };
  li.append(vg,inf,b); return li;
}
