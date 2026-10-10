// Annuler / rétablir et historique local (étape 2) : chaque changement de la disposition (déplacer, tourner, masquer,
// recolorer, remettre en place, tout réinitialiser) est journalisé : quand et quoi, sur cet appareil (les comptes de
// l'étape 3 ajouteront « qui »). Il est retrouvé par différence avec l'état précédent à chaque enregistrement
// (évènement « disposition » de sauvegarde.js) : aucun outil n'a à le signaler. Les changements rapprochés d'un même
// meuble (curseur d'angle, glisser) ne font qu'une ligne. Annuler / Rétablir : boutons en tête du panneau (Éditer),
// Ctrl+Z, Ctrl+Y ou Ctrl+Maj+Z ; toucher une ligne de l'historique y ramène. Journal gardé dans ce navigateur
// (clé maison3d-historique, 200 lignes au plus).
import {app, $} from './app.js';
import {majAngle} from './edition.js';
import {save} from './sauvegarde.js';
import {etatDe, origineDe, egaux, appliquerEtat, estSurface, normaliser} from './etats.js';
import {creerAjout, supprimerAjout} from './ajouts.js';
import {lesSurfaces, appliquerSurface, libelleSurface} from './revetements.js';
import {nomChoix} from './bibliotheque.js';
import {etatAlertes, appliquerAlertes} from './alertes.js';
import {FORMES} from './formes_simples.js';

const CLE='maison3d-historique', MAX=200, FUSION=1500;
let cle=CLE;   // un journal par variante (étape 3) : clé maison3d-historique-<id de la variante>
let etat=null, journal=[], pos=0, enCours=false;   // journal[0..pos) : fait ; journal[pos..] : annulé, rétablissable
// état de chaque élément (etats.js) : meubles, objets ajoutés (absents = null), sols et murs habillés
const photo=()=>{ const s={}; for(const it of Object.values(app.items)) s[it.name]=etatDe(it); for(const [n,e] of lesSurfaces()) if(e) s[n]=e;
  const ea=normaliser('alertes',etatAlertes()); if(ea) s.alertes=ea; return s; };
const origine=(n,s)=>!estSurface(n)&&!!app.items[n]&&!app.items[n].ajout&&egaux(n,s,origineDe(n));
const m=v=>v.toFixed(2).replace('.',',')+' m', deg=r=>{ let a=Math.round(r*180/Math.PI)%360; if(a>180) a-=360; if(a<=-180) a+=360; return a; };
const cm=v=>String(Math.round(v*1000)/10).replace('.',',');
const dims=e=>e?.a?.p?`${cm(e.a.p.L)} × ${cm(e.a.p.P)} × ${cm(e.a.p.H)} cm`:'';
const json=v=>JSON.stringify(v??null);
function decrire(ch){
  if(ch.length>1){
    if(ch.every(c=>!c.apres&&c.avant?.a)) return `${ch.length} objets supprimés`;
    return ch.every(c=>c.apres&&origine(c.n,c.apres))?`${ch.length} éléments remis en place`:`${ch.length} éléments modifiés`;
  }
  const {n,avant:a,apres:b}=ch[0], it=app.items[n];
  if(n==='alertes'){ const ka=new Set((a?.g||[]).map(x=>x.k)), kb=new Set((b?.g||[]).map(x=>x.k));
    const plus=(b?.g||[]).find(x=>!ka.has(x.k)), moins=(a?.g||[]).find(x=>!kb.has(x.k));
    return plus?'Alerte ignorée : '+plus.t:moins?'Alerte réactivée : '+moins.t:'Alertes ignorées modifiées'; }
  if(estSurface(n)){ const v=b?.m&&Object.values(b.m)[0]; return libelleSurface(n)+' : '+(v?nomChoix(v)+(v.c?' '+v.c.toUpperCase():''):'matière d’origine'); }
  const nom=it?it.meta.l:(b||a)?.a?.n||(FORMES[(b||a)?.a?.f]?.nom)||n, l=[];
  if(!a&&b) return nom+' : ajouté ('+dims(b)+')';
  if(a&&!b) return nom+' : supprimé';
  if(origine(n,b)&&!origine(n,a)) return nom+' : remis en place';
  const d=Math.hypot(b.x-a.x,b.z-a.z); if(d>0.005) l.push('déplacé de '+m(d));
  if(Math.abs(b.r-a.r)>1e-4) l.push('tourné à '+deg(b.r)+'°');
  if(a.h!==b.h) l.push(b.h?'masqué':'affiché');
  if(a.c!==b.c) l.push(b.c?'couleur '+b.c.toUpperCase():'couleur d’origine');
  if(json(a.s)!==json(b.s)) l.push(b.s&&it?'dimensions '+cm(it.size0?.x*b.s[0]||it.size.x)+' × '+cm(it.size0?.z*b.s[2]||it.size.z)+' × '+cm(it.size0?.y*b.s[1]||it.size.y)+' cm':'taille d’origine');
  if(Math.abs((a.dy||0)-(b.dy||0))>1e-4&&it) l.push('posé à '+cm(it.home.y+(b.dy||0)-(it.lvl==='Étage'?2.74:0))+' cm');
  if(a.a&&b.a){ if(json(a.a.p)!==json(b.a.p)) l.push('dimensions '+dims(b)); if(a.a.n!==b.a.n) l.push('renommé'); if(a.a.e!==b.a.e) l.push('posé à '+cm(+b.a.e||0)+' cm'); }
  if(json(a.m)!==json(b.m)){ const k=Object.keys({...(a.m||{}),...(b.m||{})}).filter(k=>json(a.m?.[k])!==json(b.m?.[k]));
    const v=k.map(x=>b.m?.[x]).filter(Boolean); l.push(v.length?'matière '+[...new Set(v.map(nomChoix))].join(', '):'matière d’origine'); }
  return nom+' : '+(l.join(', ')||'modifié');
}
function garder(){ try{ localStorage.setItem(cle,JSON.stringify({journal,pos})); }catch{} }
function relire(){ journal=[]; pos=0; try{ const d=JSON.parse(localStorage.getItem(cle)||'{}'); if(Array.isArray(d.journal)){ journal=d.journal; pos=Math.min(d.pos??journal.length,journal.length); } }catch{} }

// à chaque enregistrement : ce qui a changé depuis le précédent (sauf un changement venu d'ailleurs : autre appareil,
// autre variante, qui n'est pas une action de cette personne ici)
function noter(e){
  if(!app.mobilierPret) return;
  const now=photo(); if(enCours||!etat||e?.detail?.distant){ etat=now; return; }
  const ch=[]; for(const n of new Set([...Object.keys(etat),...Object.keys(now)])){ const a=etat[n]??null, b=now[n]??null; if(json(a)!==json(b)) ch.push({n,avant:a,apres:b}); }
  etat=now; if(!ch.length) return;
  journal.length=pos;   // un nouveau changement efface ce qui avait été annulé
  const der=journal[pos-1], t=Date.now();
  if(der&&t-der.t<FUSION&&der.ch.length===1&&ch.length===1&&der.ch[0].n===ch[0].n){ der.ch[0].apres=ch[0].apres; der.t=t; der.texte=decrire(der.ch); }
  else journal.push({t,ch,texte:decrire(ch)});
  if(journal.length>MAX) journal.splice(0,journal.length-MAX);
  pos=journal.length; garder(); majPanneau();
}
// remet chaque élément dans l'état voulu (avant ou après)
function appliquer(e,quoi){
  let liste=false;
  for(const c of e.ch){ const s=c[quoi];
    if(c.n==='alertes'){ appliquerAlertes(s); continue; }
    if(estSurface(c.n)){ appliquerSurface(c.n,s); continue; }
    if(!s){ if(app.items[c.n]?.ajout){ supprimerAjout(c.n); liste=true; } continue; }
    let it=app.items[c.n]; if(!it&&s.a){ it=creerAjout(c.n,s); liste=true; }
    if(it) appliquerEtat(it,s); }
  if(liste) dispatchEvent(new CustomEvent('meubles'));
  if(app.selected){ if(app.selected.hidden){ app.tc.detach(); } app.selBox?.update(); majAngle(); $('t-hide').textContent=app.selected.hidden?'Afficher':'Masquer'; }
  enCours=true; save(); enCours=false; etat=photo();
}
export function annuler(){ if(pos<=0) return false; appliquer(journal[--pos],'avant'); garder(); majPanneau(); return true; }
export function retablir(){ if(pos>=journal.length) return false; appliquer(journal[pos++],'apres'); garder(); majPanneau(); return true; }
function allerA(k){ while(pos>k+1) annuler(); while(pos<k+1) retablir(); }
export const leJournal=()=>({journal,pos});
// changement de variante : on passe à son journal (annuler ne doit pas toucher une autre variante)
export function changerJournal(id){ const c=id?CLE+'-'+id:CLE; if(c===cle) return; cle=c; relire(); etat=app.mobilierPret?photo():null; majPanneau(); }

// ---------- panneau ----------
const heure=t=>new Date(t).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
function majPanneau(){
  const a=$('h-annuler'), r=$('h-retablir'); if(!a) return;
  a.disabled=pos<=0; r.disabled=pos>=journal.length;
  a.title=pos>0?'Annuler : '+journal[pos-1].texte:'Rien à annuler'; r.title=pos<journal.length?'Rétablir : '+journal[pos].texte:'Rien à rétablir';
  $('h-titre').textContent=`Historique (${journal.length})`;
  const l=$('h-liste'); l.replaceChildren();
  if(!journal.length){ const p=document.createElement('p'); p.className='vide'; p.textContent='Aucune modification pour l’instant.'; l.append(p); return; }
  for(let k=journal.length-1;k>=Math.max(0,journal.length-40);k--){
    const e=journal[k], b=document.createElement('button'); b.type='button'; b.className='h-ligne'+(k>=pos?' annule':''); b.dataset.k=String(k);
    const h=document.createElement('span'); h.className='h-heure'; h.textContent=heure(e.t);
    const t=document.createElement('span'); t.textContent=e.texte+(k>=pos?' (annulé)':'');
    b.append(h,t); b.title='Revenir juste après ce changement'; b.onclick=()=>allerA(k); l.append(b);
  }
}
export function initHistorique(){
  relire();
  addEventListener('disposition',noter);
  $('h-annuler').onclick=annuler; $('h-retablir').onclick=retablir;
  addEventListener('keydown',e=>{
    if(!app.edition||!(e.ctrlKey||e.metaKey)||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k=e.key.toLowerCase();
    if(k==='z'&&!e.shiftKey){ e.preventDefault(); annuler(); } else if(k==='y'||(k==='z'&&e.shiftKey)){ e.preventDefault(); retablir(); }
  });
  majPanneau();
}
// appelé quand les meubles sont chargés et la disposition reprise : point de départ des différences
export function demarrerHistorique(){ etat=photo(); majPanneau(); }
