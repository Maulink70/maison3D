// Historique partagé (étape 3) : dans le panneau des meubles, « Historique » montre au choix « Tous » (les
// modifications de la variante affichée faites par tout le monde, sur tous les appareils : quand, qui, quoi ; lues dans
// Airtable, 50 dernières) ou « Cet appareil » (le journal local, où toucher une ligne y ramène ; Annuler / Rétablir
// portent sur ses propres gestes). Mis à jour à l'ouverture et après chaque enregistrement.
import {$} from './app.js';
import {appel, connecte} from './api.js';
import {varianteCourante} from './synchro.js';

let vue='tous', dernier=0, enCours=false, lignes=[], cle='';
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const quand=t=>{ const d=new Date(t), h=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  return d.toDateString()===new Date().toDateString()?h:d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' '+h; };

function afficher(){
  const tous=vue==='tous'&&connecte();
  $('h-tous').setAttribute('aria-pressed',String(tous)); $('h-ici').setAttribute('aria-pressed',String(!tous));
  $('h-liste').hidden=tous; $('h-partage').hidden=!tous;
  const box=$('h-partage'); box.replaceChildren();
  if(!tous) return;
  if(!lignes.length){ box.append(el('p',{class:'vide'},enCours?'Chargement…':'Aucune modification enregistrée pour cette variante.')); return; }
  for(const l of lignes){ const r=el('div',{class:'h-ligne partagee'});
    r.append(el('span',{class:'h-heure'},quand(l.t)),el('span',{class:'h-qui'},l.qui),el('span',{},l.texte)); box.append(r); }
}
async function rafraichir(force){
  const v=varianteCourante(); if(!connecte()||!v||v.fixe||!$('h-details').open||vue!=='tous') return;   // Base : pas d'historique
  const c=v.id+':'+v.version; if(!force&&c===cle&&Date.now()-dernier<60000) return;
  if(enCours) return; enCours=true; if(c.split(':')[0]!==cle.split(':')[0]) lignes=[]; afficher();
  const r=await appel('historique',{variante:v.id,n:50}); enCours=false;
  if(r.ok){ lignes=r.lignes||[]; cle=c; dernier=Date.now(); }
  afficher();
}

export function initPartage(){
  const d=$('h-details'), seg=el('div',{class:'seg','role':'group','aria-label':'Historique à afficher'});
  const tous=el('button',{type:'button',id:'h-tous','aria-pressed':'true'},'Tous'), ici=el('button',{type:'button',id:'h-ici','aria-pressed':'false'},'Cet appareil');
  seg.append(tous,ici); d.querySelector('summary').after(seg); $('h-liste').after(el('div',{id:'h-partage'}));
  tous.onclick=()=>{ vue='tous'; afficher(); rafraichir(true); };
  ici.onclick=()=>{ vue='ici'; afficher(); };
  d.addEventListener('toggle',()=>{ if(d.open) rafraichir(); });
  addEventListener('variantes',()=>rafraichir());   // après chaque enregistrement (la version de la variante change)
  addEventListener('compte',()=>{ lignes=[]; cle=''; afficher(); });
  afficher();
}
