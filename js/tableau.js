// Tableau des meubles de la variante affichée (11 octobre 2026, demande de Mauro : « la liste des meubles d'une variante
// en tableau : dimensions, matière, lien ») : niveau, pièce, nom, dimensions (cm), matières (choisies, sinon celles du
// modèle), couleur, changements par rapport à la maquette d'origine, source et lien (catalogue, produit d'une boutique).
// Filtres : niveau, changements seulement, portes et fenêtres. « Télécharger (Excel) » : fichier .csv (séparateur « ; »,
// UTF-8 avec BOM : Excel l'ouvre directement) ; « Copier » : à coller dans Excel ou Google Sheets. Sans prix (Mauro).
import {app, $} from './app.js';
import {pieceEn, PIECES} from './pieces.js';
import {etatDe, origineDe} from './etats.js';
import {partiesDe, nomChoix, aspectDe} from './bibliotheque.js';
import {varianteCourante} from './synchro.js';

const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const cm=v=>Math.round(v*100);
// pièce d'un meuble : celle qui contient son centre, sinon la plus proche à moins de 80 cm (renfoncement, épaisseur d'un mur)
function pieceDe(x,z,niv){ const p=pieceEn(x,z,niv); if(p) return p; let m=null, dm=0.8;
  for(const q of PIECES) if(q.niveau===niv) for(const [x0,z0,x1,z1] of q.rects){ const d=Math.hypot(Math.max(x0-x,0,x-x1),Math.max(z0-z,0,z-z1)); if(d<dm){ dm=d; m=q; } }
  return m; }
const SOURCES={forme:'Forme simple',photo:'Photo (objet plat)',glb:'Modèle 3D'};
const COLONNES=['Niveau','Pièce','Nom','Catégorie','Largeur (cm)','Profondeur (cm)','Hauteur (cm)','Matières','Couleur','Changements','Source','Lien'];

// matières : par partie, de la plus grande à la plus petite (choisie dans la bibliothèque, sinon l'aspect du modèle)
function matieresDe(it){
  const l=[]; for(const p of partiesDe(it).slice(0,5)){ const ch=it.matieres?.[p.cle], t=ch?.i?nomChoix(ch):aspectDe(p.base); if(t&&!l.includes(t)) l.push(t); }
  return l.join(', ');
}
function changements(it){
  if(it.ajout&&!it.base) return it.hidden?'ajouté, masqué':'ajouté';
  const e=etatDe(it), o=origineDe(it.name)||{}, l=[];
  if(it.hidden) l.push('masqué');
  if(it.base&&e.a&&o.a&&JSON.stringify(e.a)!==JSON.stringify(o.a)) l.push('refait');   // objet de l'Appart Base : dimensions, nom ou hauteur de pose changés
  const d=Math.hypot((e.x||0)-(o.x||0),(e.z||0)-(o.z||0)); if(d>0.02) l.push('déplacé de '+d.toFixed(2).replace('.',',')+' m');
  const a=Math.round((e.r||0)*180/Math.PI)%360; if(Math.abs(a)>=1) l.push('tourné de '+a+'°');
  if(e.s) l.push('redimensionné'); if(e.dy) l.push('posé à '+Math.round(e.dy*100)+' cm');
  if(e.c) l.push('recoloré'); if(e.m) l.push('matières changées');
  return l.join(', ');
}
export function lignes({niveau='tout',changes=false,ouvertures=false}={}){
  const r=[];
  for(const it of Object.values(app.items)){
    if(it.meta.c!=='meuble'&&!(ouvertures&&it.meta.c==='ouverture')) continue; if(it.coulisses) continue;
    const niv=it.lvl==='Étage'?'etage':'rez'; if(niveau!=='tout'&&niveau!==niv) continue;
    const ch=changements(it); if(changes&&!ch) continue;
    const s=it.size, a=it.ajout, o=a?.o;
    r.push({niveau:it.lvl,piece:pieceDe(it.g.position.x,it.g.position.z,niv)?.nom||'',nom:it.meta.l,categorie:a&&!it.base?'Objet ajouté':it.meta.c==='ouverture'?'Porte ou fenêtre':'Mobilier',
      L:cm(s.x),P:cm(s.z),H:cm(s.y),matieres:matieresDe(it),couleur:it.color||'',changements:ch,
      source:o?(o.produit?o.site:o.site+(o.auteur?' · '+o.auteur:'')+(o.licence?' · '+o.licence:'')):it.base?'Appart Base (Blender)':a?SOURCES[a.t]||'':'Maquette',lien:o?.lien||'',nomCle:it.name});
  }
  const ordreNiv=n=>n==='Rez'?0:1;
  return r.sort((x,y)=>ordreNiv(x.niveau)-ordreNiv(y.niveau)||x.piece.localeCompare(y.piece,'fr')||x.nom.localeCompare(y.nom,'fr'));
}
const valeurs=l=>[l.niveau,l.piece,l.nom,l.categorie,l.L,l.P,l.H,l.matieres,l.couleur,l.changements,l.source,l.lien];
export function versCSV(ls){
  const q=v=>{ const t=String(v??''); return /[;"\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t; };
  return '﻿'+[COLONNES,...ls.map(valeurs)].map(r=>r.map(q).join(';')).join('\r\n')+'\r\n';
}
const versTSV=ls=>[COLONNES,...ls.map(valeurs)].map(r=>r.map(v=>String(v??'').replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n');

let fen=null; const choix={niveau:'tout',changes:false,ouvertures:false};
const nomVariante=()=>varianteCourante()?.nom||'Actuel';
function dire(t,erreur=false){ const m=fen.querySelector('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',erreur); }
function construire(){
  fen=el('div',{id:'tableau-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Tableau des meubles'});
  fen.innerHTML=`<div class="fenetre-carte tab-carte">
    <div class="fenetre-tete"><h2></h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <div class="tab-outils">
      <div class="seg" role="group" aria-label="Niveau"><button type="button" data-niv="tout">Tout</button><button type="button" data-niv="rez">Rez</button><button type="button" data-niv="etage">Étage</button></div>
      <label class="crans"><input type="checkbox" id="tab-changes"> Seulement ce qui a changé</label>
      <label class="crans"><input type="checkbox" id="tab-ouv"> Portes et fenêtres</label>
      <span class="spacer"></span>
      <button type="button" class="btn" id="tab-copier">Copier</button><button type="button" class="btn primary" id="tab-csv">Télécharger (Excel)</button>
    </div>
    <div class="tab-zone"><table class="tab-meubles"><thead></thead><tbody></tbody></table></div>
    <p class="ph-message" role="status"></p></div>`;
  document.body.append(fen);
  const q=s=>fen.querySelector(s);
  q('.fermer').onclick=()=>ouvrirTableau(false);
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') ouvrirTableau(false); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen) ouvrirTableau(false); });
  for(const b of fen.querySelectorAll('[data-niv]')) b.onclick=()=>{ choix.niveau=b.dataset.niv; majTableau(); };
  q('#tab-changes').onchange=e=>{ choix.changes=e.target.checked; majTableau(); };
  q('#tab-ouv').onchange=e=>{ choix.ouvertures=e.target.checked; majTableau(); };
  q('#tab-csv').onclick=()=>{
    const ls=lignes(choix), b=new Blob([versCSV(ls)],{type:'text/csv;charset=utf-8'}), a=el('a',{download:`Maison3D-meubles-${nomVariante().replace(/[\\/:*?"<>|]+/g,' ').trim()}-${new Date().toISOString().slice(0,10)}.csv`});
    a.href=URL.createObjectURL(b); document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),30000);
    dire(`Fichier téléchargé (${ls.length} lignes) : il s’ouvre dans Excel.`); };
  q('#tab-copier').onclick=async()=>{ try{ await navigator.clipboard.writeText(versTSV(lignes(choix))); dire('Tableau copié : collez-le dans Excel ou Google Sheets (Ctrl+V).'); }catch{ dire('Copie impossible : utilisez « Télécharger (Excel) ».',true); } };
}
function majTableau(){
  if(!fen||fen.hidden) return; const q=s=>fen.querySelector(s);
  q('h2').textContent=`Meubles de la variante « ${nomVariante()} »`;
  for(const b of fen.querySelectorAll('[data-niv]')) b.setAttribute('aria-pressed',String(b.dataset.niv===choix.niveau));
  q('#tab-changes').checked=choix.changes; q('#tab-ouv').checked=choix.ouvertures;
  const ls=lignes(choix), th=q('thead'), tb=q('tbody'); th.replaceChildren(); tb.replaceChildren();
  const tr=el('tr'); for(const c of COLONNES) tr.append(el('th',{scope:'col'},c)); th.append(tr);
  for(const l of ls){ const r=el('tr'); if(l.changements) r.className='change';
    valeurs(l).forEach((v,k)=>{ const td=el('td',k>=4&&k<=6?{class:'nb'}:{});
      if(k===11&&/^https?:\/\//.test(v)){ const a=el('a',{href:v,target:'_blank',rel:'noopener'},'ouvrir'); a.title=v; td.append(a); }
      else if(k===8&&v){ td.append(el('span',{class:'tab-pastille',style:'background:'+v}),document.createTextNode(' '+v)); }
      else if(k===2){ const b=el('button',{type:'button',class:'tab-nom','data-n':l.nomCle},v); td.append(b); }
      else td.textContent=v;
      r.append(td); });
    tb.append(r); }
  if(!ls.length){ const r=el('tr'), td=el('td',{colspan:String(COLONNES.length),class:'vide'},choix.changes?'Rien n’a changé par rapport à la maquette d’origine.':'Aucun meuble.'); r.append(td); tb.append(r); }
  dire(`${ls.length} ligne${ls.length>1?'s':''}`+(choix.changes?' (changements seulement)':'')+'. Touchez un nom pour le voir dans la maquette.');
}
export function ouvrirTableau(oui=true){
  if(oui&&!app.mobilierPret) return;
  if(oui&&!fen) construire(); if(!fen) return; fen.hidden=!oui; if(oui) majTableau();
}
export function initTableau(rappelNom){
  addEventListener('click',e=>{ const b=e.target.closest?.('#tableau-fenetre .tab-nom'); if(!b) return; const it=app.items[b.dataset.n]; if(!it) return; ouvrirTableau(false); rappelNom?.(it); });
  for(const t of ['disposition','meubles','variantes']) addEventListener(t,()=>majTableau());
}
