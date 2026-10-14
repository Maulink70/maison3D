// Liste « Produits » (mode photo, livraison 2, 11 octobre 2026, « go » de Mauro) : les idées d'achat, partagées entre le PC
// et la tablette (table Airtable « Produits », action « produit » du workflow n8n « Maison3D API »), sans prix. On ajoute un
// produit par le lien de sa page (n8n la lit : photo, nom, dimensions), par une image collée ou choisie, par « Partager »
// sur la tablette ou par le favori « Envoyer à Maison3D » sur PC (recu.js). Chaque produit : « Essayer en photo » (montage
// sur une photo de la pièce), « Mettre en 3D » (Tripo, posé dans la maquette, avec le lien du produit), page de la
// boutique, modifier, supprimer. Bouton de la barre (sac) ; la liste se lit et s'écrit aussi en Visite (elle ne touche
// pas la maquette).
import {app, $} from './app.js';
import {appel} from './api.js';
import {envoyerFichier, lireFichier} from './fichiers.js';
import {BOUTIQUES, lienRecherche, lireProduit} from './boutiques.js';
import {PIECES} from './pieces.js';
import {choisirPhoto, faireMontage} from './galerie.js';
import {ouvrirPhotoAvec} from './photo.js';
import {setEdition} from './vues.js';

const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const nomPiece=id=>PIECES.find(p=>p.id===id)?.nom||'';
const hote=u=>{ try{ return new URL(u).hostname.replace(/^www\./,''); }catch{ return ''; } };
const cm=v=>{ const n=+String(v??'').replace(',','.'); return isFinite(n)&&n>0?Math.round(n*10)/10:null; };
const dims=p=>p.L&&p.P&&p.H?`${p.L} × ${p.P} × ${p.H} cm`:[p.L&&'L '+p.L,p.P&&'P '+p.P,p.H&&'H '+p.H].filter(Boolean).join(' · ')+(p.L||p.P||p.H?' cm':'');

// ---------- la liste (gardée 30 s en mémoire) ----------
let liste=null, lu=0;
export const lesProduits=()=>liste||[];
export async function chargerProduits(force=false){
  if(liste&&!force&&Date.now()-lu<30000) return liste;
  const l=[]; let offset=null;
  do{ const r=await appel('produit',{op:'liste',...(offset?{offset}:{})}); if(!r.ok) throw new Error(r.horsLigne?'Hors connexion : la liste des produits n’a pas pu être lue.':(r.erreur||'Lecture impossible')); l.push(...(r.produits||[])); offset=r.offset||null; }while(offset);
  liste=l; lu=Date.now(); return liste;
}
async function enregistrer(p,champs){
  const r=await appel('produit',{op:'enregistrer',produit:{id:p.id,...champs}});
  if(r.ok){ Object.assign(p,champs); delete p.nouveau; }
  return r;
}

// ---------- images : réduite (1200 px, JPEG sur fond blanc) et vignette (240 px) ----------
async function preparerImage(blob){
  const b=await createImageBitmap(blob), k=Math.min(1,1200/Math.max(b.width,b.height)), w=Math.round(b.width*k), h=Math.round(b.height*k);
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,w,h); x.drawImage(b,0,0,w,h);
  const kv=Math.min(1,240/Math.max(w,h)), v=document.createElement('canvas'); v.width=Math.round(w*kv); v.height=Math.round(h*kv);
  const xv=v.getContext('2d'); xv.fillStyle='#fff'; xv.fillRect(0,0,v.width,v.height); xv.drawImage(c,0,0,v.width,v.height);
  return {blob:await new Promise(ok=>c.toBlob(ok,'image/jpeg',0.9)),w,h,vignette:v.toDataURL('image/jpeg',0.8)};
}
const enDataURL=b=>new Promise((ok,ko)=>{ const r=new FileReader(); r.onload=()=>ok(r.result); r.onerror=ko; r.readAsDataURL(b); });
async function imageDe(p){ return p.image?.id?lireFichier(p.image.id,p.image.n||1,p.image.type||'image/jpeg'):null; }
// image du presse-papiers (bouton « Coller l'image » : la tablette n'a pas Ctrl+V)
async function lirePressePapiers(){
  try{ for(const it of await navigator.clipboard.read()){ const t=it.types.find(x=>x.startsWith('image/')); if(t) return {image:await it.getType(t)};
      if(it.types.includes('text/plain')){ const s=await (await it.getType('text/plain')).text(); if(/^https?:\/\//.test(s.trim())) return {lien:s.trim()}; } } }
  catch{ return {erreur:'Le navigateur n’a pas donné accès au presse-papiers : utilisez Ctrl+V, ou « Choisir une image ».'}; }
  return {erreur:'Le presse-papiers ne contient ni image ni lien.'};
}

// enregistre un nouveau produit (image : Blob ou null) ; renvoie le produit ou {erreur}
async function creer({nom,lien,boutique,L,P,H,piece,note,image}){
  const p={id:'pr'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),nom:(nom||'Produit').slice(0,160),lien:lien||'',boutique:boutique||hote(lien)||'',
    L:cm(L),P:cm(P),H:cm(H),piece:piece||'',note:note||'',image:null,vignette:''};
  if(image){ const im=await preparerImage(image), f=await envoyerFichier(im.blob,{nom:p.nom,type:'photo'}); if(f.erreur) return {erreur:f.erreur};
    p.image={id:f.id,n:f.n,type:'image/jpeg',w:im.w,h:im.h}; p.vignette=im.vignette; }
  const {id,...champs}=p, r=await enregistrer(p,{...champs,nouveau:true});
  if(!r.ok) return {erreur:r.horsLigne?'Hors connexion : le produit n’a pas pu être enregistré.':(r.erreur||'Enregistrement impossible')};
  p.creePar=r.modifiePar||''; p.creeLe=r.modifieLe||new Date().toISOString();
  if(liste) liste.unshift(p); return p;
}

// ---------- la fenêtre ----------
let fen=null, brouillon=null, enCours=false, mis=null, aSuppr=null, edite=null;
function dire(t,erreur=false){ if(!fen) return; const m=fen.querySelector('.pr-carte>.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',erreur); }
const optionsPieces=()=>'<option value="">—</option>'+['rez','etage'].map(n=>`<optgroup label="${n==='rez'?'Rez':'Étage'}">`+PIECES.filter(p=>p.niveau===n).map(p=>`<option value="${p.id}">${p.nom}</option>`).join('')+'</optgroup>').join('');
// favori « Envoyer à Maison3D » : dans la page du produit, il prend le lien, le titre et la photo (og:image) et ouvre
// Maison3D, qui ajoute le produit à la liste (recu.js) ; la photo vue ainsi sert si la boutique refuse la lecture par n8n
export const favori=()=>"javascript:(()=>{const g=n=>(document.querySelector('meta[property=\"'+n+'\"],meta[name=\"'+n+'\"]')||{}).content||'',u=new URL('"+location.origin+"/');"+
  "u.searchParams.set('lien',location.href);u.searchParams.set('titre',(g('og:title')||document.title||'').slice(0,150));const i=g('og:image')||g('twitter:image');"+
  "if(i)try{u.searchParams.set('img',new URL(i,location.href).href)}catch(e){}open(u.href,'_blank')})()";
function construire(){
  fen=el('div',{id:'produits-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Produits'});
  fen.innerHTML=`<div class="fenetre-carte pr-carte">
    <div class="fenetre-tete"><h2>Produits · idées d’achat</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <details class="pr-bloc" id="pr-ajout"><summary>Ajouter un produit</summary>
      <span class="mi-lien"><input type="url" id="pr-lien" placeholder="Collez le lien du produit (https://…)" aria-label="Lien du produit"><button type="button" class="btn" id="pr-lire">Lire le lien</button></span>
      <div class="ph-boutons petits"><button type="button" class="btn" id="pr-coller">Coller l’image</button><label class="btn">Choisir une image<input type="file" accept="image/*" id="pr-fichier" hidden></label></div>
      <div class="pr-apercu" hidden><img alt="" class="pr-img"><div class="pr-champs">
        <label class="dimrow"><span>Nom</span><input type="text" id="pr-nom" maxlength="160"></label>
        <label class="dimrow"><span>Largeur</span><input type="number" id="pr-l" min="1" max="2000" step="0.5"><span class="unite">cm</span></label>
        <label class="dimrow"><span>Profondeur</span><input type="number" id="pr-p" min="1" max="2000" step="0.5"><span class="unite">cm</span></label>
        <label class="dimrow"><span>Hauteur</span><input type="number" id="pr-h" min="1" max="2000" step="0.5"><span class="unite">cm</span></label>
        <label class="dimrow"><span>Pour la pièce</span><select id="pr-piece">${optionsPieces()}</select></label>
        <button type="button" class="btn primary wide" id="pr-ajouter">Ajouter à la liste</button></div></div>
    </details>
    <details class="pr-bloc"><summary>Chercher dans une boutique</summary>
      <span class="mi-lien"><input type="search" id="pr-q" placeholder="Ce que vous cherchez (canapé d’angle, lampe…)" aria-label="Recherche"></span>
      <div class="ph-boutons petits pr-boutiques"></div>
      <p class="mat-aide">La boutique s’ouvre dans un nouvel onglet. Choisissez le produit, puis envoyez-le ici : sur PC avec le bouton « Envoyer à Maison3D » (ci-dessous) ou en copiant son lien ; sur la tablette avec « Partager » → Maison3D.</p>
    </details>
    <details class="pr-bloc"><summary>Sur PC : le bouton « Envoyer à Maison3D »</summary>
      <ol class="pr-etapes"><li>Affichez la barre des favoris de Chrome ou d’Edge : touches <kbd>Ctrl</kbd> + <kbd>Maj</kbd> + <kbd>B</kbd>.</li>
        <li>Faites glisser ce bouton dans la barre des favoris : <a class="btn primary pr-favori" draggable="true">Envoyer à Maison3D</a></li>
        <li>Sur la page d’un produit (IKEA, Galaxus…), cliquez sur ce favori : Maison3D s’ouvre dans un nouvel onglet et ajoute le produit à la liste, avec sa photo.</li></ol>
      <p class="mat-aide">Si le glisser ne marche pas : clic droit sur la barre des favoris → « Ajouter une page… », nom « Envoyer à Maison3D », et dans « URL » collez le code copié ici : <button type="button" class="btn" id="pr-copier-favori">Copier le code</button></p>
    </details>
    <p class="ph-message" role="status"></p>
    <div class="pr-liste" aria-label="Liste des produits"></div></div>`;
  document.body.append(fen);
  const q=s=>fen.querySelector(s);
  q('.fermer').onclick=()=>ouvrirProduits(false);
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') ouvrirProduits(false); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen) ouvrirProduits(false); });
  q('#pr-lire').onclick=()=>lireLien(q('#pr-lien').value.trim());
  q('#pr-lien').addEventListener('keydown',e=>{ if(e.key==='Enter') lireLien(q('#pr-lien').value.trim()); });
  q('#pr-coller').onclick=async()=>{ const r=await lirePressePapiers(); if(r.erreur) dire(r.erreur,true); else if(r.image) prendreImage(r.image); else lireLien(r.lien); };
  q('#pr-fichier').onchange=e=>{ const f=e.target.files?.[0]; if(f) prendreImage(f); e.target.value=''; };
  // Ctrl+V dans la fenêtre : une image, ou un lien
  fen.addEventListener('paste',e=>{ if(e.target.closest('input[type=text],input[type=url],input[type=search],textarea')&&!e.clipboardData?.files?.length) return;
    const f=[...(e.clipboardData?.files||[])].find(x=>x.type.startsWith('image/')); if(f){ e.preventDefault(); q('#pr-ajout').open=true; prendreImage(f); return; }
    const t=(e.clipboardData?.getData('text')||'').trim(); if(/^https?:\/\//.test(t)&&!e.target.closest('input')){ e.preventDefault(); q('#pr-ajout').open=true; q('#pr-lien').value=t; lireLien(t); } });
  q('#pr-ajouter').onclick=ajouterBrouillon;
  for(const s of ['#pr-nom','#pr-l','#pr-p','#pr-h','#pr-q']) q(s).addEventListener('keydown',e=>e.stopPropagation());
  const box=q('.pr-boutiques');
  for(const b of BOUTIQUES){ const x=el('button',{type:'button',class:'btn'},b.nom);
    x.onclick=()=>{ const t=q('#pr-q').value.trim(); open(lienRecherche(b,t),'_blank','noopener'); dire(`${b.nom} s’ouvre dans un nouvel onglet${b.recherche&&t?' sur votre recherche':''}.`); }; box.append(x); }
  const fav=q('.pr-favori'); fav.href=favori(); fav.onclick=e=>{ e.preventDefault(); dire('Faites glisser ce bouton dans la barre des favoris (ne cliquez pas dessus ici).'); };
  q('#pr-copier-favori').onclick=async()=>{ try{ await navigator.clipboard.writeText(favori()); dire('Code du favori copié.'); }catch{ dire('Copie impossible : faites glisser le bouton.',true); } };
}
function majBrouillon(){
  const q=s=>fen.querySelector(s), a=q('.pr-apercu'); a.hidden=!brouillon; if(!brouillon) return;
  const img=q('.pr-img'); img.hidden=!brouillon.url; if(brouillon.url) img.src=brouillon.url;
}
function nouveauBrouillon(){ if(brouillon?.url) URL.revokeObjectURL(brouillon.url); brouillon={image:null,url:null,lien:'',boutique:''};
  const q=s=>fen.querySelector(s); for(const s of ['#pr-nom','#pr-l','#pr-p','#pr-h']) q(s).value=''; q('#pr-piece').value=''; }
function prendreImage(blob){ if(!brouillon) nouveauBrouillon(); if(brouillon.url) URL.revokeObjectURL(brouillon.url);
  brouillon.image=blob; brouillon.url=URL.createObjectURL(blob); majBrouillon(); dire('Donnez-lui un nom et ses dimensions si vous les connaissez, puis « Ajouter à la liste ».'); fen.querySelector('#pr-nom').focus(); }
async function lireLien(u){
  if(!/^https?:\/\//i.test(u)){ dire('Collez le lien complet de la page du produit (https://…).',true); return; }
  const q=s=>fen.querySelector(s); q('#pr-ajout').open=true;
  const deja=lesProduits().find(p=>p.lien===u); if(deja){ montrerProduit(deja.id,`« ${deja.nom} » est déjà dans la liste.`); return; }
  nouveauBrouillon(); brouillon.lien=u; brouillon.boutique=hote(u); q('#pr-lien').value=u;
  dire('Lecture de la page du produit…'); q('#pr-lire').disabled=true;
  const p=await lireProduit(u); q('#pr-lire').disabled=false;
  if(p.image){ const b=await (await fetch(p.image)).blob(); brouillon.image=b; brouillon.url=URL.createObjectURL(b); }
  if(p.site) brouillon.boutique=p.site;
  q('#pr-nom').value=(p.nom||'').slice(0,160); const d=p.dims||{}; q('#pr-l').value=d.L||''; q('#pr-p').value=d.P||''; q('#pr-h').value=d.H||'';
  majBrouillon();
  dire(p.ok?'Vérifiez le nom et les dimensions, puis « Ajouter à la liste ».':(p.erreur||'Page illisible')+' Vous pouvez l’ajouter quand même avec son lien, ou copier l’image du produit et « Coller l’image ».',!p.ok);
}
async function ajouterBrouillon(){
  if(!brouillon||enCours) return; const q=s=>fen.querySelector(s);
  if(!brouillon.image&&!brouillon.lien){ dire('Il faut au moins une image ou un lien.',true); return; }
  enCours=true; q('#pr-ajouter').disabled=true; dire('Enregistrement…');
  const p=await creer({...brouillon,nom:q('#pr-nom').value.trim()||'Produit',L:q('#pr-l').value,P:q('#pr-p').value,H:q('#pr-h').value,piece:q('#pr-piece').value});
  enCours=false; q('#pr-ajouter').disabled=false;
  if(p.erreur){ dire(p.erreur,true); return; }
  nouveauBrouillon(); brouillon=null; majBrouillon(); q('#pr-lien').value=''; q('#pr-ajout').open=false;
  montrerProduit(p.id,`« ${p.nom} » ajouté à la liste.`);
}

function carte(p){
  const c=el('div',{class:'pr-produit'+(p.id===mis?' mis':''),'data-id':p.id});
  const im=el('div',{class:'gal-image'}); if(p.vignette){ const i=el('img',{alt:'',src:p.vignette}); im.append(i); } else im.append(el('span',{class:'gal-attente'},'pas d’image'));
  const info=[p.boutique,dims(p),nomPiece(p.piece)].filter(Boolean).join(' · ');
  c.append(im,el('strong',{},p.nom||'Produit'),el('span',{class:'mat-aide'},info||'—'));
  if(p.note) c.append(el('span',{class:'mat-aide pr-note'},p.note));
  const b=el('div',{class:'ph-boutons petits'});
  const essai=el('button',{type:'button',class:'btn primary','data-a':'photo'},'Essayer en photo'), d3=el('button',{type:'button',class:'btn','data-a':'3d'},'Mettre en 3D');
  essai.disabled=d3.disabled=!p.image; if(!p.image) essai.title=d3.title='Ajoutez d’abord une image (« Modifier »)';
  const bl=el('button',{type:'button',class:'btn','data-a':'blender'},'Blender'); bl.disabled=!p.image; bl.title=p.image?'Le faire modéliser dans Blender, sur le PC':'Ajoutez d’abord une image (« Modifier »)';
  b.append(essai,d3,bl);
  if(p.lien) b.append(el('a',{class:'btn',href:p.lien,target:'_blank',rel:'noopener'},'Page'));
  b.append(el('button',{type:'button',class:'btn','data-a':'modifier'},'Modifier'),el('button',{type:'button',class:'btn danger','data-a':'suppr','aria-label':'Supprimer '+(p.nom||'ce produit')},aSuppr===p.id?'Supprimer ?':'×'));
  c.append(b);
  if(edite===p.id){
    const f=el('div',{class:'pr-edition'});
    f.innerHTML=`<label class="dimrow"><span>Nom</span><input type="text" data-k="nom" maxlength="160"></label>
      <label class="dimrow"><span>Largeur</span><input type="number" data-k="L" min="1" step="0.5"><span class="unite">cm</span></label>
      <label class="dimrow"><span>Profondeur</span><input type="number" data-k="P" min="1" step="0.5"><span class="unite">cm</span></label>
      <label class="dimrow"><span>Hauteur</span><input type="number" data-k="H" min="1" step="0.5"><span class="unite">cm</span></label>
      <label class="dimrow"><span>Pour la pièce</span><select data-k="piece">${optionsPieces()}</select></label>
      <label class="pr-note-saisie"><span>Note</span><textarea data-k="note" rows="2" maxlength="4000"></textarea></label>
      <div class="ph-boutons petits"><button type="button" class="btn" data-a="img-coller">Coller une autre image</button><label class="btn">Choisir une image<input type="file" accept="image/*" data-a="img-fichier" hidden></label></div>
      <div class="ph-boutons petits"><button type="button" class="btn primary" data-a="enregistrer">Enregistrer</button><button type="button" class="btn" data-a="annuler">Annuler</button></div>`;
    for(const i of f.querySelectorAll('[data-k]')){ i.value=p[i.dataset.k]??''; i.addEventListener('keydown',e=>e.stopPropagation()); }
    c.append(f);
  }
  return c;
}
function majListe(){
  if(!fen) return; const box=fen.querySelector('.pr-liste'); box.replaceChildren();
  if(!liste){ box.append(el('p',{class:'vide'},'Chargement de la liste…')); return; }
  if(!liste.length){ box.append(el('p',{class:'vide'},'Aucun produit pour l’instant : « Ajouter un produit », le bouton « Envoyer à Maison3D » sur PC, ou « Partager » sur la tablette.')); return; }
  for(const p of liste) box.append(carte(p));
}
export function montrerProduit(id,texte){ mis=id; majListe(); if(texte) dire(texte); fen?.querySelector(`.pr-produit[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({block:'nearest'}); }

async function action(p,a,cible){
  if(a==='photo') return essayer(p);
  if(a==='3d') return en3D(p);
  if(a==='blender'){ const {ouvrirBlender}=await import('./blender.js'); ouvrirProduits(false); ouvrirBlender(true,{produit:p}); return; }
  if(a==='modifier'){ edite=edite===p.id?null:p.id; majListe(); return; }
  if(a==='annuler'){ edite=null; majListe(); return; }
  if(a==='suppr'){
    if(aSuppr!==p.id){ aSuppr=p.id; majListe(); setTimeout(()=>{ if(aSuppr===p.id){ aSuppr=null; majListe(); } },4000); return; }
    aSuppr=null; dire('Suppression…'); const r=await appel('produit',{op:'supprimer',id:p.id});
    if(!r.ok){ dire(r.erreur||'Suppression impossible',true); return; }
    liste=lesProduits().filter(x=>x!==p); majListe(); dire(`« ${p.nom} » retiré de la liste.`); return; }
  if(a==='img-coller'){ const r=await lirePressePapiers(); if(r.image) return nouvelleImage(p,r.image); dire(r.erreur||'Le presse-papiers ne contient pas d’image.',true); return; }
  if(a==='enregistrer'){
    const f=cible.closest('.pr-produit').querySelector('.pr-edition'), v=k=>f.querySelector(`[data-k="${k}"]`).value;
    const ch={nom:v('nom').trim()||'Produit',L:cm(v('L')),P:cm(v('P')),H:cm(v('H')),piece:v('piece'),note:v('note').trim()};
    const r=await enregistrer(p,ch); if(!r.ok){ dire(r.erreur||'Enregistrement impossible',true); return; }
    edite=null; montrerProduit(p.id,'Enregistré.'); }
}
async function nouvelleImage(p,blob){
  dire('Envoi de l’image…'); const im=await preparerImage(blob), f=await envoyerFichier(im.blob,{nom:p.nom,type:'photo'});
  if(f.erreur){ dire(f.erreur,true); return; }
  const r=await enregistrer(p,{image:{id:f.id,n:f.n,type:'image/jpeg',w:im.w,h:im.h},vignette:im.vignette});
  if(!r.ok){ dire(r.erreur||'Enregistrement impossible',true); return; }
  montrerProduit(p.id,'Image changée.');
}
// essayer en photo : on choisit la photo de la pièce, le montage s'ouvre avec le produit posé dessus
async function essayer(p){
  dire('Lecture de l’image…'); const b=await imageDe(p); if(!b){ dire('L’image du produit n’a pas pu être lue.',true); return; }
  const image=await enDataURL(b); dire(''); ouvrirProduits(false);
  choisirPhoto(ph=>faireMontage(ph,{image,nom:p.nom,dims:{L:p.L,P:p.P,H:p.H},lien:p.lien,site:p.boutique}),`Choisissez la photo de la pièce où essayer « ${p.nom} ».`,p.piece||undefined);
}
// mettre en 3D : panneau photo rempli (Tripo), le lien du produit suit dans l'objet (panneau, tableau des meubles, fiche)
async function en3D(p){
  if(!app.mobilierPret){ dire('La maquette se charge encore : réessayez dans un instant.',true); return; }
  if(!app.edition) setEdition(true);
  if(!app.edition){ dire('Pour le mettre en 3D, passez en « Éditer » (une variante modifiable, pas la « Base »).',true); return; }
  dire('Lecture de l’image…'); const b=await imageDe(p); if(!b){ dire('L’image du produit n’a pas pu être lue.',true); return; }
  dire(''); ouvrirProduits(false);
  ouvrirPhotoAvec(b,{nom:p.nom,L:p.L,P:p.P,H:p.H,origine:{produit:true,site:p.boutique||hote(p.lien)||'boutique',titre:String(p.nom||'Produit').slice(0,80),lien:p.lien||''}});
}

export async function ouvrirProduits(oui=true){
  if(oui&&!fen) construire(); if(!fen) return; fen.hidden=!oui; $('produits').setAttribute('aria-expanded',String(oui));
  if(!oui){ mis=null; return; }
  majListe();
  try{ await chargerProduits(); majListe(); }catch(e){ dire(e.message,true); }
}
// produit reçu par « Partager » (tablette) ou par le favori « Envoyer à Maison3D » (PC) : ajouté à la liste
export async function ajouterRecu({lien,titre,img}){
  await ouvrirProduits(true);
  if(!lien){ dire('Le partage ne contenait pas de lien de produit : partagez la page du produit (son lien).',true); return null; }
  const deja=lesProduits().find(p=>p.lien===lien); if(deja){ montrerProduit(deja.id,`« ${deja.nom} » est déjà dans la liste.`); return deja; }
  dire('Lecture de la page du produit…');
  const r=await lireProduit(lien,img); let image=null;
  if(r.image){ try{ image=await (await fetch(r.image)).blob(); }catch{} }
  const d=r.dims||{}, p=await creer({nom:r.nom||titre||hote(lien)||'Produit',lien,boutique:r.site||hote(lien),L:d.L,P:d.P,H:d.H,image});
  if(p.erreur){ dire(p.erreur,true); return null; }
  montrerProduit(p.id,`« ${p.nom} » ajouté à la liste`+(image?'.':' (sans image : la boutique refuse la lecture de sa page ; « Modifier » → « Coller une autre image »).'));
  return p;
}
export function initProduits(){
  $('produits').onclick=e=>{ e.stopPropagation(); ouvrirProduits(!fen||fen.hidden); };
  addEventListener('click',e=>{ const b=e.target.closest?.('#produits-fenetre [data-a]'); if(!b||b.tagName==='INPUT') return;
    const p=lesProduits().find(x=>x.id===b.closest('.pr-produit')?.dataset.id); if(p) action(p,b.dataset.a,b); });
  addEventListener('change',e=>{ const i=e.target; if(!i.matches?.('#produits-fenetre input[data-a="img-fichier"]')) return;
    const p=lesProduits().find(x=>x.id===i.closest('.pr-produit')?.dataset.id), f=i.files?.[0]; i.value=''; if(p&&f) nouvelleImage(p,f); });
}
