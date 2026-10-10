// Photos des pièces (étape 5, livraison 1, 10 octobre 2026) : galerie des vraies photos de chaque pièce, gardées dans
// Airtable (table « Photos » : nom, pièce, petite vignette, calage ; l'image elle-même, réduite à 2048 px, dans la table
// Fichiers, comme les objets ajoutés : relue par n8n puis gardée dans le cache du navigateur). Bouton « Photos » de la
// barre : filtre par pièce, vignettes, visionneuse en grand (flèches, glisser, clavier, diaporama, plein écran).
// En Éditer : ajouter (fichiers, ou appareil photo de la tablette), renommer, changer de pièce, supprimer, « Caler la
// maquette » (calage.js). « Voir avec la maquette » (Visite et Éditer) : la photo posée sur la 1re personne calée.
// Livraison 2 : onglet « Rendus » (historique des rendus réalistes par pièce, rien n'est écrasé), avant / après (barre à
// glisser ou alternance), télécharger ; « Rendu réaliste… » (photo calée) et « Mode Image » (photo ou rendu) en Éditer.
import {app, $} from './app.js';
import {appel, moi} from './api.js';
import {envoyerFichier, lireFichier} from './fichiers.js';
import {PIECES, pieceEn} from './pieces.js';
import {ETAGE_FLOOR} from './config.js';
import {caler, voirAvecMaquette} from './calage.js';
import {chargerRendus, lesRendus, imageRendu, imageAvant, supprimerRendu, preparerRendu} from './rendu.js';
import {ouvrirModeImage} from './image.js';

const MAXI=2048, VIGN=320, DIAPO=4000;
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const sansAccents=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const nomPiece=id=>PIECES.find(p=>p.id===id)?.nom||'Sans pièce';

// ---------- données ----------
let photos=null, chargeLe=0;
export const lesPhotos=()=>photos||[];
export async function chargerPhotos(force=false){
  if(photos&&!force&&Date.now()-chargeLe<60000) return photos;
  const tout=[]; let offset=null;
  do{ const r=await appel('photo',{op:'liste',...(offset?{offset}:{})});
    if(!r.ok) throw new Error(r.horsLigne?'Pas de connexion au serveur : les photos ne peuvent pas être lues.':(r.erreur||'Lecture des photos impossible'));
    tout.push(...(r.photos||[])); offset=r.offset; }while(offset);
  photos=tout.filter(p=>p.id&&p.image&&p.image.id); chargeLe=Date.now(); return photos;
}
// écrit les champs donnés (seuls ceux-là partent : un calage ne renvoie pas la vignette)
export async function enregistrerPhoto(p,champs){
  const r=await appel('photo',{op:'enregistrer',photo:{id:p.id,...champs}});
  if(!r.ok) return r;
  Object.assign(p,champs); delete p.nouvelle; p.modifieePar=r.modifieePar; p.modifieeLe=r.modifieeLe;
  if(fen&&!fen.hidden) majGrille(); return r;
}
// l'image en grand (adresse d'objet), lue une fois par appareil
const adresses=new Map();
export function imagePhoto(p){
  const id=p.image.id;
  if(!adresses.has(id)) adresses.set(id,lireFichier(id,p.image.n||1,p.image.type||'image/jpeg').then(b=>{ if(!b){ adresses.delete(id); return null; } return URL.createObjectURL(b); }));
  return adresses.get(id);
}
// image choisie → JPEG de 2048 px au plus (orientation de l'appareil appliquée) + vignette de 320 px
async function preparer(f){
  let bm; try{ bm=await createImageBitmap(f,{imageOrientation:'from-image'}); }catch{ throw new Error('« '+f.name+' » : image illisible (JPEG, PNG ou WebP)'); }
  const k=Math.min(1,MAXI/Math.max(bm.width,bm.height)), w=Math.round(bm.width*k), h=Math.round(bm.height*k);
  const c=el('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(bm,0,0,w,h); bm.close?.();
  const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',0.88));
  const kv=Math.min(1,VIGN/Math.max(w,h)), v=el('canvas'); v.width=Math.round(w*kv); v.height=Math.round(h*kv);
  v.getContext('2d').drawImage(c,0,0,v.width,v.height);
  return {blob,w,h,vignette:v.toDataURL('image/jpeg',0.72)};
}
// pièce où l'on est (1re personne) ou que l'on regarde (maquette, plan)
function pieceIci(){
  const c=app.mode==='walk'?app.camera.position:app.orbit.target;
  const n=app.mode==='walk'?(c.y>ETAGE_FLOOR+0.5?'etage':'rez'):(app.level==='etage'?'etage':'rez');
  return pieceEn(c.x,c.z,n)?.id||null;
}
const nouveauNom=piece=>{ const deja=lesPhotos().filter(p=>p.piece===piece).map(p=>+(/(\d+)$/.exec(p.nom)?.[1]||0)); return nomPiece(piece)+' '+(Math.max(0,...deja)+1); };
async function ajouter(fichiers){
  const l=[...fichiers].filter(f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp)$/i.test(f.name)); if(!l.length||!app.edition) return;
  const piece=fen.querySelector('#gal-piece').value||pieceIci()||'salon', erreurs=[]; let n=0, faites=0;
  fen.querySelectorAll('.gal-ajout button').forEach(b=>b.disabled=true);
  for(const f of l){
    dire(`Envoi de la photo ${++n} sur ${l.length}…`);
    try{
      const {blob,w,h,vignette}=await preparer(f);
      const e=await envoyerFichier(blob,{nom:sansAccents(f.name).replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'-').slice(0,60)||'photo',type:'photo'});
      if(e.erreur) throw new Error(e.erreur);
      const p={id:'ph'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),nom:nouveauNom(piece),piece,image:{id:e.id,n:e.n,type:'image/jpeg',w,h},
        vignette,calage:null,ordre:0,creeePar:moi()||'',creeeLe:new Date().toISOString()};
      const r=await appel('photo',{op:'enregistrer',photo:{...p,nouvelle:true}});
      if(!r.ok) throw new Error(r.horsLigne?'Pas de connexion : réessayez quand le réseau revient.':(r.erreur||'Enregistrement impossible'));
      (photos||(photos=[])).push(p); faites++; majGrille();
    }catch(err){ erreurs.push(err.message||String(err)); }
  }
  fen.querySelectorAll('.gal-ajout button').forEach(b=>b.disabled=false);
  filtre=piece; majPieces(); majGrille();
  dire((faites?`${faites} photo${faites>1?'s':''} ajoutée${faites>1?'s':''} dans « ${nomPiece(piece)} ».`:'')+(erreurs.length?' '+erreurs.join(' · '):''),!!erreurs.length);
}

// ---------- la galerie ----------
let fen=null, filtre=null, onglet='photos', choix=null;
// la galerie sert aussi à choisir une photo (produit reçu par « Partager » → mode Image sur cette photo)
export function choisirPhoto(rappel,texte){ onglet='photos'; ouvrirGalerie(true).then(()=>{}); choix={rappel,texte}; majMode(); }
const estRendu=x=>!!x&&'etat' in x;
const date=t=>{ const d=new Date(t); return isNaN(d)?'':d.toLocaleDateString('fr-CH',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('fr-CH',{hour:'2-digit',minute:'2-digit'}); };
const ETATS={attente:'en cours…',echec:'échec'};
function dire(t,erreur=false){ const m=fen.querySelector('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',erreur); }
const visibles=()=>{ const l=lesPhotos().filter(p=>!filtre||p.piece===filtre); const o=id=>PIECES.findIndex(q=>q.id===id); return l.sort((a,b)=>o(a.piece)-o(b.piece)); };
const rendusVisibles=()=>lesRendus().filter(r=>!filtre||r.piece===filtre);   // les plus récents d'abord
function majPieces(){
  const z=fen.querySelector('.gal-pieces'); z.replaceChildren();
  const l=onglet==='rendus'?lesRendus():lesPhotos();
  for(const b of fen.querySelectorAll('[data-onglet]')){ const n=b.dataset.onglet==='rendus'?lesRendus().length:lesPhotos().length; b.textContent=(b.dataset.onglet==='rendus'?'Rendus':'Photos')+(n?' · '+n:''); b.setAttribute('aria-pressed',String(b.dataset.onglet===onglet)); }
  const bouton=(id,texte)=>{ const n=l.filter(p=>!id||p.piece===id).length, b=el('button',{type:'button',class:'cat-idee','aria-pressed':String(filtre===id),'data-piece':id||''},texte+(n?' · '+n:''));
    b.onclick=()=>{ filtre=id; if(id) fen.querySelector('#gal-piece').value=id; majPieces(); majGrille(); }; return b; };
  z.append(bouton(null,'Toutes'));
  for(const p of PIECES) z.append(bouton(p.id,p.nom));
}
function carte(p,i){
  const b=el('button',{type:'button',class:'gal-photo','data-photo':p.id,'aria-label':p.nom+' ('+nomPiece(p.piece)+')'});
  const img=el('img',{src:p.vignette||'',alt:'',loading:'lazy'}), cadre=el('span',{class:'gal-image'}); cadre.append(img);
  b.append(cadre,el('span',{class:'cat-titre'},p.nom));
  if(p.calage) b.append(el('span',{class:'cat-info calee'},'✓ maquette calée'));
  b.onclick=()=>{ if(choix){ const c=choix; choix=null; ouvrirGalerie(false); c.rappel(p); return; } ouvrirVisionneuse(visibles(),i); }; return b;
}
function carteRendu(r,i,l){
  const b=el('button',{type:'button',class:'gal-photo','data-rendu':r.id,'aria-label':r.titre}), cadre=el('span',{class:'gal-image'});
  if(r.vignette) cadre.append(el('img',{src:r.vignette,alt:'',loading:'lazy'})); else cadre.append(el('span',{class:'gal-attente'},ETATS[r.etat]||'…'));
  b.append(cadre,el('span',{class:'cat-titre'},r.titre),el('span',{class:'cat-info'+(r.etat==='echec'?' echec':'')},[date(r.creeLe),ETATS[r.etat]||'',r.mode==='image'?'mode Image':''].filter(Boolean).join(' · ')));
  b.onclick=()=>ouvrirVisionneuse(l,i); return b;
}
function majGrille(){
  if(!fen) return; const g=fen.querySelector('.gal-grille'); g.replaceChildren();
  if(onglet==='rendus'){ const l=rendusVisibles();
    if(!l.length){ g.append(el('p',{class:'vide'},'Aucun rendu'+(filtre?' pour cette pièce':'')+'. Ouvrez une photo calée et touchez « Rendu réaliste… », ou « Mode Image » (en Éditer).')); return; }
    l.forEach((r,i)=>g.append(carteRendu(r,i,l))); return; }
  const l=visibles();
  if(!l.length){ g.append(el('p',{class:'vide'},filtre?'Aucune photo de cette pièce.'+(app.edition?' Ajoutez-en ci-dessus.':''):'Aucune photo.')); return; }
  let piece=null;
  l.forEach((p,i)=>{ if(!filtre&&p.piece!==piece){ piece=p.piece; const n=l.filter(q=>q.piece===piece).length; g.append(el('h3',{class:'gal-titre'},nomPiece(piece)+' · '+n+' photo'+(n>1?'s':''))); } g.append(carte(p,i)); });
}
function majMode(){
  if(!fen) return; fen.querySelector('.gal-ajout').hidden=!app.edition||onglet==='rendus';
  if(choix){ fen.querySelector('.gal-aide').textContent=choix.texte; return; }
  if(onglet==='rendus'){ fen.querySelector('.gal-aide').textContent='Les rendus réalistes de chaque pièce, les plus récents d’abord : touchez-en un pour le voir en grand, en avant / après.'; return; }
  fen.querySelector('.gal-aide').textContent=app.edition?'Touchez une photo pour la voir en grand, la renommer ou caler la maquette dessus.':'Touchez une photo pour la voir en grand. Pour ajouter des photos ou caler la maquette dessus, passez en « Éditer ».';
}
function construireFenetre(){
  fen=el('div',{id:'galerie-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Photos des pièces'});
  fen.innerHTML=`<div class="fenetre-carte gal-carte">
    <div class="fenetre-tete"><h2>Photos des pièces</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <div class="seg gal-onglets" role="group" aria-label="Photos ou rendus"><button type="button" data-onglet="photos" aria-pressed="true">Photos</button><button type="button" data-onglet="rendus" aria-pressed="false">Rendus</button></div>
    <div class="gal-pieces cat-idees" role="group" aria-label="Pièce"></div>
    <div class="gal-ajout" hidden>
      <label>Ajouter dans <select id="gal-piece" aria-label="Pièce des nouvelles photos"></select></label>
      <button type="button" class="btn primary" id="gal-choisir">Ajouter des photos</button>
      <button type="button" class="btn" id="gal-appareil" hidden>Prendre une photo</button>
      <input type="file" id="gal-fichiers" accept="image/*" multiple hidden>
      <input type="file" id="gal-camera" accept="image/*" capture="environment" hidden>
    </div>
    <p class="mat-aide gal-aide"></p>
    <p class="ph-message" role="status"></p>
    <div class="gal-grille"></div></div>`;
  document.body.append(fen);
  const q=s=>fen.querySelector(s), sel=q('#gal-piece');
  for(const niv of ['rez','etage']){ const g=el('optgroup',{label:niv==='rez'?'Rez':'Étage'}); for(const p of PIECES.filter(x=>x.niveau===niv)) g.append(el('option',{value:p.id},p.nom)); sel.append(g); }
  q('.fermer').onclick=()=>ouvrirGalerie(false);
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') ouvrirGalerie(false); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen) ouvrirGalerie(false); });
  q('#gal-choisir').onclick=()=>q('#gal-fichiers').click(); q('#gal-appareil').onclick=()=>q('#gal-camera').click();
  q('#gal-appareil').hidden=!matchMedia('(pointer:coarse)').matches;   // tablette, téléphone : l'appareil photo directement
  for(const i of ['#gal-fichiers','#gal-camera']) q(i).onchange=e=>{ const f=[...e.target.files]; e.target.value=''; ajouter(f); };
  // glisser des fichiers sur la fenêtre (PC)
  fen.addEventListener('dragover',e=>{ if(app.edition){ e.preventDefault(); } });
  fen.addEventListener('drop',e=>{ if(!app.edition) return; e.preventDefault(); ajouter(e.dataTransfer.files); });
  addEventListener('edition',majMode);
  for(const b of fen.querySelectorAll('[data-onglet]')) b.onclick=()=>{ onglet=b.dataset.onglet; majMode(); majPieces(); majGrille(); };
  addEventListener('rendus',()=>{ if(!fen.hidden){ majPieces(); majGrille(); } });
}
export async function ouvrirGalerie(oui=true,piece,quoi){
  if(oui&&!fen) construireFenetre(); if(!fen) return; fen.hidden=!oui; $('photos').setAttribute('aria-expanded',String(oui));
  if(!oui){ choix=null; return; }
  if(piece!==undefined) filtre=piece; if(quoi) onglet=quoi;
  fen.querySelector('#gal-piece').value=filtre||pieceIci()||'salon';
  majMode(); majPieces(); majGrille();
  if(!photos) dire('Chargement des photos…');
  try{ await chargerPhotos(); await chargerRendus(); dire(''); majPieces(); majGrille(); }catch(e){ dire(e.message,true); }
}

// ---------- la visionneuse : en grand, flèches, glisser, diaporama, plein écran ----------
let vis=null, liste=[], idx=0, diapo=0, aSupprimer=false, avap='non', alterne=0, coupe=0.5;
const courante=()=>liste[idx];
function construireVisionneuse(){
  vis=el('div',{id:'visionneuse',class:'visionneuse',role:'dialog','aria-modal':'true','aria-label':'Photo'});
  vis.innerHTML=`<div class="vis-haut"><div class="vis-titre"><strong></strong><span></span></div>
      <button type="button" class="vis-b" id="vis-diapo" aria-label="Diaporama" title="Diaporama">▶</button>
      <button type="button" class="vis-b" id="vis-plein" aria-label="Plein écran" title="Plein écran">⛶</button>
      <button type="button" class="vis-b" id="vis-fermer" aria-label="Fermer" title="Fermer">×</button></div>
    <div class="vis-zone"><img class="vis-img" alt=""><img class="vis-avant" alt="Avant" hidden>
      <span class="vis-coupe" hidden aria-hidden="true"></span><span class="vis-etiq g" hidden>Avant</span><span class="vis-etiq d" hidden>Après</span>
      <span class="vis-attente" hidden></span>
      <button type="button" class="vis-fleche" id="vis-prec" aria-label="Photo précédente">‹</button>
      <button type="button" class="vis-fleche" id="vis-suiv" aria-label="Photo suivante">›</button></div>
    <div class="vis-bas">
      <button type="button" class="btn primary" id="vis-voir">Voir avec la maquette</button>
      <button type="button" class="btn" id="vis-caler">Caler la maquette</button>
      <button type="button" class="btn primary" id="vis-rendu">Rendu réaliste…</button>
      <span class="seg vis-avap" role="group" aria-label="Avant / après"><button type="button" data-av="non" aria-pressed="true">Rendu</button><button type="button" data-av="barre" aria-pressed="false">Avant / après</button><button type="button" data-av="alterne" aria-pressed="false">Alternance</button></span>
      <a class="btn" id="vis-telecharger" download>Télécharger</a>
      <button type="button" class="btn" id="vis-image">Mode Image</button>
      <span class="vis-edition">
        <input type="text" id="vis-nom" maxlength="60" aria-label="Nom de la photo">
        <select id="vis-piece" aria-label="Pièce de la photo"></select>
      </span>
      <button type="button" class="btn danger" id="vis-suppr">Supprimer</button></div>`;
  document.body.append(vis);
  const q=s=>vis.querySelector(s), sel=q('#vis-piece');
  for(const niv of ['rez','etage']){ const g=el('optgroup',{label:niv==='rez'?'Rez':'Étage'}); for(const p of PIECES.filter(x=>x.niveau===niv)) g.append(el('option',{value:p.id},p.nom)); sel.append(g); }
  q('#vis-fermer').onclick=()=>fermerVisionneuse();
  q('#vis-prec').onclick=()=>aller(-1); q('#vis-suiv').onclick=()=>aller(1);
  q('#vis-diapo').onclick=()=>diaporama(!diapo);
  q('#vis-plein').onclick=()=>{ if(document.fullscreenElement) document.exitFullscreen?.(); else vis.requestFullscreen?.().catch(()=>{}); };
  q('#vis-voir').onclick=()=>{ const p=courante(); fermerVisionneuse(); ouvrirGalerie(false); voirAvecMaquette(p); };
  q('#vis-caler').onclick=()=>{ const p=courante(); fermerVisionneuse(); ouvrirGalerie(false); caler(p); };
  q('#vis-rendu').onclick=async()=>{ const p=courante(); fermerVisionneuse(); ouvrirGalerie(false); await voirAvecMaquette(p); preparerRendu(p); };
  q('#vis-image').onclick=()=>{ const p=courante(), r=estRendu(p); fermerVisionneuse(); ouvrirGalerie(false);
    ouvrirModeImage({nom:r?p.titre:p.nom,piece:p.piece,photo:r?p.photo:p.id,image:p.image}); };
  for(const b of vis.querySelectorAll('[data-av]')) b.onclick=()=>{ avap=b.dataset.av; majAvap(); };
  // barre de l'avant / après : glisser sur l'image
  const zone=q('.vis-zone'); let tire=false;
  const placer=e=>{ const r=zone.getBoundingClientRect(); coupe=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); majAvap(); };
  zone.addEventListener('pointerdown',e=>{ if(avap!=='barre'||e.target.closest('button')) return; tire=true; zone.setPointerCapture(e.pointerId); placer(e); e.stopImmediatePropagation(); },true);
  zone.addEventListener('pointermove',e=>{ if(tire) placer(e); });
  for(const t of ['pointerup','pointercancel']) zone.addEventListener(t,()=>{ tire=false; });
  const renommer=async()=>{ const p=courante(), n=q('#vis-nom').value.trim(); if(!n||n===p.nom) return; const r=await enregistrerPhoto(p,{nom:n}); if(!r.ok) q('#vis-nom').value=p.nom; montrer(); };
  q('#vis-nom').onchange=renommer; q('#vis-nom').onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') q('#vis-nom').blur(); if(e.key==='Escape'){ q('#vis-nom').value=courante().nom; q('#vis-nom').blur(); } };
  sel.onchange=async()=>{ const p=courante(); await enregistrerPhoto(p,{piece:sel.value}); montrer(); };
  q('#vis-suppr').onclick=async()=>{
    const p=courante(), b=q('#vis-suppr');
    if(!aSupprimer){ aSupprimer=true; b.textContent='Supprimer ? (toucher encore)'; setTimeout(()=>{ if(aSupprimer){ aSupprimer=false; b.textContent='Supprimer'; } },4000); return; }
    aSupprimer=false; b.textContent='Suppression…'; b.disabled=true;
    const r=estRendu(p)?await supprimerRendu(p):await appel('photo',{op:'supprimer',id:p.id}); b.disabled=false; b.textContent='Supprimer';
    if(!r.ok){ q('.vis-titre span').textContent=r.erreur||'Suppression impossible'; return; }
    if(!estRendu(p)) photos=lesPhotos().filter(x=>x!==p); liste=liste.filter(x=>x!==p); if(fen) { majPieces(); majGrille(); }
    if(!liste.length){ fermerVisionneuse(); return; } idx=Math.min(idx,liste.length-1); montrer();
  };
  vis.addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return; e.stopPropagation();
    if(e.key==='Escape'){ if(!document.fullscreenElement) fermerVisionneuse(); } else if(e.key==='ArrowLeft') aller(-1); else if(e.key==='ArrowRight') aller(1);
    else if(e.key===' '){ e.preventDefault(); diaporama(!diapo); } });
  // glisser vers la gauche ou la droite (doigt ou souris)
  let x0=null; const z=q('.vis-zone');
  z.addEventListener('pointerdown',e=>{ if(e.target.closest('button')||avap==='barre') return; x0=e.clientX; });
  z.addEventListener('pointerup',e=>{ if(x0===null) return; const dx=e.clientX-x0; x0=null; if(Math.abs(dx)>50) aller(dx<0?1:-1); });
  z.addEventListener('pointercancel',()=>{ x0=null; });
  addEventListener('edition',()=>{ if(vis&&!vis.hidden) montrer(); });
  addEventListener('rendus',()=>{ if(vis&&!vis.hidden&&estRendu(courante())) montrer(); });
}
// avant / après d'un rendu : la photo de départ par-dessus, coupée à la barre, ou en alternance
function majAvap(){
  const p=courante(), q=s=>vis.querySelector(s), a=q('.vis-avant'), on=estRendu(p)&&p.etat==='fini'&&p.avant&&avap!=='non';
  clearInterval(alterne); alterne=0;
  for(const b of vis.querySelectorAll('[data-av]')) b.setAttribute('aria-pressed',String(b.dataset.av===avap));
  a.hidden=!on; q('.vis-coupe').hidden=!(on&&avap==='barre'); q('.vis-etiq.g').hidden=q('.vis-etiq.d').hidden=!on;
  if(!on){ a.style.clipPath=''; return; }
  if(!a.dataset.pour||a.dataset.pour!==p.id){ a.dataset.pour=p.id; a.removeAttribute('src'); imageAvant(p).then(u=>{ if(courante()===p&&u) a.src=u; }); }
  if(avap==='barre'){ a.style.opacity='1'; a.style.clipPath=`inset(0 ${(1-coupe)*100}% 0 0)`; q('.vis-coupe').style.left=coupe*100+'%'; q('.vis-etiq.g').hidden=coupe<0.08; q('.vis-etiq.d').hidden=coupe>0.92; }
  else { a.style.clipPath=''; let avant=true; const pas=()=>{ a.style.opacity=avant?'1':'0'; q('.vis-etiq.g').hidden=!avant; q('.vis-etiq.d').hidden=avant; avant=!avant; }; pas(); alterne=setInterval(pas,1500); }
}
function aller(d){ if(!liste.length) return; idx=(idx+d+liste.length)%liste.length; aSupprimer=false; montrer(); }
function diaporama(oui){
  clearInterval(diapo); diapo=oui?setInterval(()=>aller(1),DIAPO):0;
  const b=vis.querySelector('#vis-diapo'); b.textContent=oui?'❚❚':'▶'; b.setAttribute('aria-label',oui?'Arrêter le diaporama':'Diaporama'); b.title=b.getAttribute('aria-label');
}
function montrerRendu(p){
  const q=s=>vis.querySelector(s), img=q('.vis-img'), fini=p.etat==='fini';
  q('.vis-titre strong').textContent=p.titre;
  q('.vis-titre span').textContent=[nomPiece(p.piece),date(p.creeLe),(idx+1)+' / '+liste.length,p.mode==='image'?'mode Image':'',p.etat==='echec'?'échec : '+(p.erreur||'raison inconnue'):''].filter(Boolean).join(' · ');
  img.classList.toggle('flou',fini); if(p.vignette) img.src=p.vignette; else img.removeAttribute('src'); img.alt=p.titre;
  q('.vis-attente').hidden=fini; q('.vis-attente').textContent=p.etat==='attente'?'Rendu en cours chez kie.ai…':p.etat==='echec'?'Ce rendu a échoué.':'';
  const t=q('#vis-telecharger'); t.hidden=!fini; t.removeAttribute('href');
  if(fini) imageRendu(p).then(u=>{ if(courante()===p&&u){ img.src=u; img.classList.remove('flou'); t.href=u; t.download='Maison3D '+p.titre.replace(/[\\/:*?"<>|]+/g,' ')+'.jpg'; } });
  q('#vis-voir').hidden=q('#vis-caler').hidden=q('#vis-rendu').hidden=true; q('.vis-edition').hidden=true;
  q('.vis-avap').hidden=!(fini&&p.avant); q('#vis-image').hidden=!(app.edition&&fini); q('#vis-image').textContent='Retoucher en mode Image';
  q('#vis-suppr').hidden=!app.edition; majAvap();
}
function montrer(){
  const p=courante(); if(!p) return; const q=s=>vis.querySelector(s), img=q('.vis-img');
  q('#vis-prec').hidden=q('#vis-suiv').hidden=liste.length<2; q('#vis-diapo').hidden=liste.length<2;
  if(estRendu(p)){ montrerRendu(p); return; }
  q('.vis-attente').hidden=true; q('#vis-telecharger').hidden=true; q('.vis-avap').hidden=true; avap='non'; majAvap();
  q('#vis-rendu').hidden=!(app.edition&&p.calage); q('#vis-image').hidden=!app.edition; q('#vis-image').textContent='Mode Image'; q('#vis-suppr').hidden=!app.edition;
  q('.vis-titre strong').textContent=p.nom;
  q('.vis-titre span').textContent=nomPiece(p.piece)+' · '+(idx+1)+' / '+liste.length+(p.calage?' · maquette calée':'');
  img.classList.add('flou'); img.src=p.vignette||''; img.alt=p.nom;
  imagePhoto(p).then(u=>{ if(courante()===p&&u){ img.src=u; img.classList.remove('flou'); } });
  const suivante=liste[(idx+1)%liste.length]; if(suivante&&suivante!==p) imagePhoto(suivante);   // la suivante est préparée
  q('#vis-prec').hidden=q('#vis-suiv').hidden=liste.length<2; q('#vis-diapo').hidden=liste.length<2;
  q('#vis-voir').hidden=!p.calage; q('#vis-caler').hidden=!app.edition; q('#vis-caler').textContent=p.calage?'Recaler la maquette':'Caler la maquette';
  q('.vis-edition').hidden=!app.edition; q('#vis-nom').value=p.nom; q('#vis-piece').value=p.piece;
}
export function ouvrirVisionneuse(l,i=0){
  if(!vis) construireVisionneuse(); liste=[...l]; idx=Math.max(0,Math.min(i,liste.length-1)); aSupprimer=false;
  vis.hidden=false; diaporama(false); montrer(); setTimeout(()=>vis.querySelector('#vis-fermer').focus());
}
function fermerVisionneuse(){ if(!vis) return; diaporama(false); avap='non'; majAvap(); if(document.fullscreenElement) document.exitFullscreen?.(); vis.hidden=true; }

export function initGalerie(){
  $('photos').onclick=e=>{ e.stopPropagation(); ouvrirGalerie(!fen||fen.hidden); };
}
