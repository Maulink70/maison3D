// Annuler / rétablir et historique local (étape 2) : chaque changement de la disposition (déplacer, tourner, masquer,
// recolorer, remettre en place, tout réinitialiser) est journalisé : quand et quoi, sur cet appareil (les comptes de
// l'étape 3 ajouteront « qui »). Il est retrouvé par différence avec l'état précédent à chaque enregistrement
// (évènement « disposition » de sauvegarde.js) : aucun outil n'a à le signaler. Les changements rapprochés d'un même
// meuble (curseur d'angle, glisser) ne font qu'une ligne. Annuler / Rétablir : boutons en tête du panneau (Éditer),
// Ctrl+Z, Ctrl+Y ou Ctrl+Maj+Z ; toucher une ligne de l'historique y ramène. Journal gardé dans ce navigateur
// (clé maison3d-historique, 200 lignes au plus).
import {app, $} from './app.js';
import {paint, setHidden, majAngle} from './edition.js';
import {save} from './sauvegarde.js';

const CLE='maison3d-historique', MAX=200, FUSION=1500;
let etat=null, journal=[], pos=0, enCours=false;   // journal[0..pos) : fait ; journal[pos..] : annulé, rétablissable
const lire=it=>({x:+it.g.position.x.toFixed(4),z:+it.g.position.z.toFixed(4),r:+it.g.rotation.y.toFixed(5),h:!!it.hidden,c:it.color||null});
const photo=()=>{ const s={}; for(const it of Object.values(app.items)) s[it.name]=lire(it); return s; };
const egal=(a,b)=>a.x===b.x&&a.z===b.z&&a.r===b.r&&a.h===b.h&&a.c===b.c;
const origine=(n,s)=>{ const it=app.items[n]; return it&&Math.abs(s.x-it.home.x)<1e-3&&Math.abs(s.z-it.home.z)<1e-3&&Math.abs(s.r)<1e-4&&!s.h&&!s.c; };
const m=v=>v.toFixed(2).replace('.',',')+' m', deg=r=>{ let a=Math.round(r*180/Math.PI)%360; if(a>180) a-=360; if(a<=-180) a+=360; return a; };
function decrire(ch){
  if(ch.length>1) return ch.every(c=>origine(c.n,c.apres))?`${ch.length} éléments remis en place`:`${ch.length} éléments modifiés`;
  const {n,avant:a,apres:b}=ch[0], it=app.items[n], nom=it?it.meta.l:n, l=[];
  if(origine(n,b)&&!origine(n,a)) return nom+' : remis en place';
  const d=Math.hypot(b.x-a.x,b.z-a.z); if(d>0.005) l.push('déplacé de '+m(d));
  if(Math.abs(b.r-a.r)>1e-4) l.push('tourné à '+deg(b.r)+'°');
  if(a.h!==b.h) l.push(b.h?'masqué':'affiché');
  if(a.c!==b.c) l.push(b.c?'couleur '+b.c.toUpperCase():'couleur d’origine');
  return nom+' : '+(l.join(', ')||'modifié');
}
function garder(){ try{ localStorage.setItem(CLE,JSON.stringify({journal,pos})); }catch{} }
function relire(){ try{ const d=JSON.parse(localStorage.getItem(CLE)||'{}'); if(Array.isArray(d.journal)){ journal=d.journal; pos=Math.min(d.pos??journal.length,journal.length); } }catch{} }

// à chaque enregistrement : ce qui a changé depuis le précédent
function noter(){
  if(!app.mobilierPret) return;
  const now=photo(); if(enCours||!etat){ etat=now; return; }
  const ch=[]; for(const [n,a] of Object.entries(etat)){ const b=now[n]; if(b&&!egal(a,b)) ch.push({n,avant:a,apres:b}); }
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
  for(const c of e.ch){ const it=app.items[c.n], s=c[quoi]; if(!it) continue;
    it.g.position.x=s.x; it.g.position.z=s.z; it.g.rotation.set(0,s.r,0);
    if(!!it.hidden!==s.h) setHidden(it,s.h); if((it.color||null)!==s.c) paint(it,s.c); }
  if(app.selected){ if(app.selected.hidden){ app.tc.detach(); } app.selBox?.update(); majAngle(); $('t-hide').textContent=app.selected.hidden?'Afficher':'Masquer'; }
  enCours=true; save(); enCours=false; etat=photo();
}
export function annuler(){ if(pos<=0) return false; appliquer(journal[--pos],'avant'); garder(); majPanneau(); return true; }
export function retablir(){ if(pos>=journal.length) return false; appliquer(journal[pos++],'apres'); garder(); majPanneau(); return true; }
function allerA(k){ while(pos>k+1) annuler(); while(pos<k+1) retablir(); }
export const leJournal=()=>({journal,pos});

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
