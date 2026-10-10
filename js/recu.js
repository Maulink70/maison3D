// Produit partagé depuis une autre appli (étape 5, livraison 3) : l'application installée apparaît dans « Partager »
// d'Android (manifeste, share_target) ; le lien du produit arrive dans l'adresse (?lien=…&texte=…&titre=… : beaucoup
// d'applis mettent le lien dans le texte). Une fois la maquette chargée, n8n lit la page du produit (boutiques.js), puis
// on propose : l'essayer sur une photo de pièce (mode Image), ou l'ajouter à la maquette (panneau photo : photo ou Tripo).
import {app} from './app.js';
import {extraireLien, lireProduit} from './boutiques.js';
import {setEdition} from './vues.js';
import {ouvrirPhotoAvec} from './photo.js';
import {choisirPhoto} from './galerie.js';
import {ouvrirModeImage} from './image.js';

const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
let recu=null, fen=null;
export function initRecu(){
  const q=new URLSearchParams(location.search); if(!['lien','texte','titre'].some(k=>q.has(k))) return;
  recu={lien:extraireLien(q.get('lien'))||extraireLien(q.get('texte'))||extraireLien(q.get('titre')),titre:(q.get('titre')||'').slice(0,80)};
  try{ history.replaceState(null,'',location.pathname); }catch{}   // l'adresse redevient propre (pas de nouvelle lecture au rechargement)
}
function dire(t,erreur=false){ const m=fen.querySelector('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',erreur); }
function construire(){
  fen=el('div',{id:'recu-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Produit reçu'});
  fen.innerHTML=`<div class="fenetre-carte">
    <div class="fenetre-tete"><h2>Produit reçu</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <div class="recu-produit" hidden><img alt=""><div><strong></strong><span class="mat-aide"></span></div></div>
    <p class="ph-message" role="status"></p>
    <div class="ph-boutons" hidden><button type="button" class="btn primary" id="recu-image">L’essayer sur une photo (mode Image)</button>
      <button type="button" class="btn" id="recu-maquette">L’ajouter à la maquette</button></div>
    <a class="btn" id="recu-page" target="_blank" rel="noopener" hidden>Ouvrir la page du produit</a></div>`;
  document.body.append(fen);
  fen.querySelector('.fermer').onclick=()=>{ fen.hidden=true; };
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') fen.hidden=true; });
}
export async function traiterRecu(){
  if(!recu) return; const r=recu; recu=null;
  if(!fen) construire(); fen.hidden=false;
  const q=s=>fen.querySelector(s);
  if(!r.lien){ dire('Le partage ne contenait pas de lien de produit. Dans l’appli de la boutique, partagez la page du produit (son lien).',true); return; }
  q('#recu-page').href=r.lien; dire('Lecture de la page du produit…');
  const p=await lireProduit(r.lien);
  if(!p.ok||!p.image){ dire((p.erreur||'Page illisible')+' Ouvrez la page, copiez l’image du produit, puis « Photos » → une photo → « Mode Image » → « Coller l’image ».',true); q('#recu-page').hidden=false; return; }
  const d=p.dims||{}, nom=p.nom||r.titre||'Produit';
  q('.recu-produit').hidden=false; q('.recu-produit img').src=p.image; q('.recu-produit strong').textContent=nom;
  q('.recu-produit .mat-aide').textContent=[p.site,d.L&&d.P&&d.H?`${d.L} × ${d.P} × ${d.H} cm`:'dimensions non trouvées'].filter(Boolean).join(' · ');
  dire('Que voulez-vous en faire ?'); q('.ph-boutons').hidden=false;
  q('#recu-image').onclick=()=>{ fen.hidden=true;
    choisirPhoto(ph=>ouvrirModeImage({nom:ph.nom,piece:ph.piece,photo:ph.id,image:ph.image},{image:p.image,nom,dims:d}),`Choisissez la photo de la pièce où essayer « ${nom} ».`); };
  q('#recu-maquette').onclick=async()=>{
    if(!app.edition) setEdition(true);
    if(!app.edition){ dire('Pour l’ajouter à la maquette, passez en « Éditer » (une variante modifiable, pas la « Base »).',true); return; }
    fen.hidden=true; ouvrirPhotoAvec(await (await fetch(p.image)).blob(),{nom,L:d.L,P:d.P,H:d.H}); };
}
