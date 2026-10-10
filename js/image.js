// Mode « Image » (étape 5, livraison 3) : on modifie la photo, pas la maquette. Sur une photo de pièce (ou un rendu
// précédent), le trombone « Ajouter un objet » prend l'image d'un meuble : fichier, image collée, lien d'un produit
// (n8n lit la page : photo, nom, dimensions), ou raccourcis vers les boutiques (Suisse). On la place à peu près sur la
// photo (rectangle à glisser, coin pour la taille), on peut aussi marquer en rouge ce qu'il faut effacer. « Lancer le
// rendu » (confirmation, crédits) envoie à kie.ai la photo, la photo avec les objets posés et les zones rouges, et les
// images des objets ; le rendu rejoint l'historique de la pièce (avant / après). « Créer en 3D » ouvre le panneau photo
// avec l'image de l'objet, d'où Tripo le crée et le pose dans la maquette.
import {app, $} from './app.js';
import {lireFichier} from './fichiers.js';
import {BOUTIQUES, lienRecherche, lireProduit} from './boutiques.js';
import {soldeKie, COUT, ratioDe, demarrerRendu, suivre} from './rendu.js';
import {ouvrirPhotoAvec} from './photo.js';
import {PIECES} from './pieces.js';

const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const nomPiece=id=>PIECES.find(p=>p.id===id)?.nom||'pièce';
const charger=src=>new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ko(new Error('image illisible')); i.src=src; });
const versDataURL=b=>new Promise((ok,ko)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result)); r.onerror=ko; r.readAsDataURL(b); });
async function reduire(src,max=1024,type='image/jpeg'){
  const i=await charger(src), k=Math.min(1,max/Math.max(i.width,i.height)), c=el('canvas'); c.width=Math.round(i.width*k); c.height=Math.round(i.height*k);
  const g=c.getContext('2d'); if(type==='image/jpeg'){ g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); } g.drawImage(i,0,0,c.width,c.height);
  return {url:c.toDataURL(type,0.88),w:c.width,h:c.height};
}

// ---------- état : la base (photo ou rendu), les objets posés, les zones à effacer ----------
let fen=null, mi=null, sel=null, prep=null;
// base = {nom, piece, photo (id de la photo d'origine), image:{id,n,type,w,h}}
export async function ouvrirModeImage(base,produit){
  if(!fen) construire();
  if(!mi||mi.base.image.id!==base.image.id) mi={base,objets:[],zones:[]};
  fen.hidden=false; sel=null; prep=null; fen.querySelector('.mi-confirmer').hidden=true;
  fen.querySelector('.vis-titre strong').textContent='Mode Image : « '+base.nom+' »';
  fen.querySelector('.vis-titre span').textContent=nomPiece(base.piece)+' · on modifie la photo, pas la maquette';
  const img=fen.querySelector('.mi-photo'); img.removeAttribute('src');
  const b=await lireFichier(base.image.id,base.image.n||1,base.image.type||'image/jpeg');
  if(!b){ dire('La photo n’a pas pu être lue.',true); return; }
  if(mi.url) URL.revokeObjectURL(mi.url); mi.url=URL.createObjectURL(b); img.src=mi.url;
  await img.decode().catch(()=>{}); caler(); dessiner(); majListe();
  dire(mi.objets.length?'':'Touchez « Ajouter un objet » : image d’un meuble (fichier, image copiée, lien d’un produit ou boutique).');
  if(produit) await ajouterProduit(produit);
}
function fermer(){ if(fen) fen.hidden=true; }
function dire(t,erreur=false){ const m=fen.querySelector('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',erreur); }
// le cadre de la photo dans la zone (proportions de la photo)
function caler(){
  if(!mi) return; const z=fen.querySelector('.mi-zone').getBoundingClientRect(), ap=mi.base.image.w/mi.base.image.h;
  let w=z.width-16, h=z.height-16; if(w/h>ap) w=h*ap; else h=w/ap;
  Object.assign(fen.querySelector('.mi-cadre').style,{width:w+'px',height:h+'px',left:(z.width-w)/2+'px',top:(z.height-h)/2+'px'});
}
// un objet : {id, nom, L, P, H (cm, null si inconnu), img (data URL), w, h (pixels), x, y, lw, lh (rectangle, 0..1 de la photo)}
async function ajouterProduit({image,nom,dims}){
  if(!mi) return;
  let r; try{ r=await reduire(image); }catch{ dire('Cette image n’a pas pu être lue.',true); return; }
  const ap=mi.base.image.w/mi.base.image.h, lw=0.3, lh=Math.min(0.7,lw*ap*r.h/r.w);
  const o={id:'o'+Date.now().toString(36),nom:(nom||'Objet '+(mi.objets.length+1)).slice(0,60),L:dims?.L||null,P:dims?.P||null,H:dims?.H||null,img:r.url,w:r.w,h:r.h,
    x:0.5-lw/2+0.04*mi.objets.length,y:0.55-lh/2,lw,lh};
  mi.objets.push(o); sel=o.id; dessiner(); majListe();
  dire('Objet ajouté : faites-le glisser à sa place sur la photo (coin en bas à droite pour sa taille), et vérifiez ses dimensions.');
}
function ajouterZone(){ if(!mi) return; const z={id:'z'+Date.now().toString(36),x:0.38,y:0.38,lw:0.24,lh:0.24}; mi.zones.push(z); sel=z.id; dessiner(); dire('Zone rouge : placez-la sur ce qu’il faut effacer de la photo.'); }

// ---------- les rectangles sur la photo (glisser = déplacer, coin = taille, × = retirer) ----------
function dessiner(){
  const c=fen.querySelector('.mi-calques'); c.replaceChildren(); if(!mi) return;
  const rect=(o,zone)=>{
    const d=el('div',{class:'mi-rect'+(zone?' zone':'')+(sel===o.id?' choisi':''),'data-id':o.id});
    Object.assign(d.style,{left:o.x*100+'%',top:o.y*100+'%',width:o.lw*100+'%',height:o.lh*100+'%'});
    if(!zone){ const i=el('img',{src:o.img,alt:o.nom,draggable:'false'}); d.append(i,el('span',{class:'mi-num'},String(mi.objets.indexOf(o)+1))); }
    const x=el('button',{type:'button',class:'mi-x','aria-label':'Retirer'},'×'), p=el('span',{class:'mi-poignee','aria-hidden':'true'});
    x.onclick=e=>{ e.stopPropagation(); if(zone) mi.zones=mi.zones.filter(q=>q!==o); else mi.objets=mi.objets.filter(q=>q!==o); dessiner(); majListe(); };
    d.append(x,p); glisser(d,o,p); c.append(d);
  };
  for(const z of mi.zones) rect(z,true); for(const o of mi.objets) rect(o,false);
}
function glisser(d,o,poignee){
  d.addEventListener('pointerdown',e=>{
    if(e.target.closest('.mi-x')) return; e.preventDefault(); d.setPointerCapture(e.pointerId); sel=o.id;
    fen.querySelectorAll('.mi-rect').forEach(r=>r.classList.toggle('choisi',r===d));
    const cadre=fen.querySelector('.mi-cadre').getBoundingClientRect(), taille=e.target===poignee, x0=e.clientX, y0=e.clientY, a={...o};
    const bouge=ev=>{ const dx=(ev.clientX-x0)/cadre.width, dy=(ev.clientY-y0)/cadre.height;
      if(taille){ o.lw=Math.max(0.03,Math.min(1-a.x,a.lw+dx)); o.lh=Math.max(0.03,Math.min(1-a.y,a.lh+dy)); }
      else { o.x=Math.max(-o.lw/2,Math.min(1-o.lw/2,a.x+dx)); o.y=Math.max(-o.lh/2,Math.min(1-o.lh/2,a.y+dy)); }
      Object.assign(d.style,{left:o.x*100+'%',top:o.y*100+'%',width:o.lw*100+'%',height:o.lh*100+'%'}); };
    const fin=()=>{ d.removeEventListener('pointermove',bouge); d.removeEventListener('pointerup',fin); d.removeEventListener('pointercancel',fin); };
    d.addEventListener('pointermove',bouge); d.addEventListener('pointerup',fin); d.addEventListener('pointercancel',fin);
  });
}
// ---------- la liste des objets : nom, dimensions, « Créer en 3D » ----------
function majListe(){
  const l=fen.querySelector('.mi-objets'); l.replaceChildren(); if(!mi) return;
  mi.objets.forEach((o,k)=>{
    const li=el('div',{class:'mi-objet'}), i=el('img',{src:o.img,alt:''}), n=el('input',{type:'text',value:o.nom,maxlength:'60','aria-label':'Nom de l’objet '+(k+1)});
    n.onchange=()=>{ o.nom=n.value.trim()||o.nom; };
    const cote=(c,t)=>{ const f=el('input',{type:'number',min:'1',max:'2000',step:'1',value:o[c]??'',placeholder:t,'aria-label':t+' (cm)'}); f.onchange=()=>{ const v=+f.value; o[c]=v>0?v:null; }; return f; };
    const d=el('span',{class:'mi-dims'}); d.append(cote('L','L'),el('span',{},'×'),cote('P','P'),el('span',{},'×'),cote('H','H'),el('span',{},'cm'));
    const t=el('button',{type:'button',class:'btn petit-b'},'Créer en 3D'); t.title='Ouvre le panneau photo avec cette image : « Créer en 3D (Tripo) » la pose dans la maquette';
    t.onclick=async()=>{ if(!app.edition){ dire('Passez en « Éditer » pour ajouter un objet à la maquette.',true); return; }
      const b=await (await fetch(o.img)).blob(); fermer(); ouvrirPhotoAvec(b,{nom:o.nom,L:o.L,P:o.P,H:o.H}); };
    const x=el('button',{type:'button',class:'btn petit-b danger','aria-label':'Retirer '+o.nom},'×'); x.onclick=()=>{ mi.objets=mi.objets.filter(q=>q!==o); dessiner(); majListe(); };
    li.append(el('span',{class:'mi-num'},String(k+1)),i,n,d,t,x); l.append(li);
  });
}
// ---------- sources : fichier, presse-papiers, lien, boutiques ----------
async function depuisFichier(f){ if(!f) return; if(!/^image\//.test(f.type)){ dire('Ce n’est pas une image.',true); return; } await ajouterProduit({image:await versDataURL(f),nom:f.name.replace(/\.[^.]+$/,'')}); }
async function coller(){
  try{ const items=await navigator.clipboard.read();
    for(const it of items){ const t=it.types.find(x=>x.startsWith('image/')); if(t){ await ajouterProduit({image:await versDataURL(await it.getType(t))}); return; } }
    dire('Le presse-papiers ne contient pas d’image : sur le site de la boutique, appui long (ou clic droit) sur la photo, « Copier l’image ».',true);
  }catch{ dire('Le navigateur refuse de lire le presse-papiers : utilisez Ctrl+V, ou « Choisir une image ».',true); }
}
async function lien(){
  const u=fen.querySelector('#mi-lien').value.trim(); if(!/^https?:\/\//i.test(u)){ dire('Collez le lien complet de la page du produit (https://…).',true); return; }
  dire('Lecture de la page du produit…'); fen.querySelector('#mi-lien-lire').disabled=true;
  const r=await lireProduit(u); fen.querySelector('#mi-lien-lire').disabled=false;
  if(!r.ok||!r.image){ dire((r.erreur||'Page illisible')+(r.nom?` (« ${r.nom} »)`:''),true); return; }
  fen.querySelector('#mi-lien').value='';
  await ajouterProduit({image:r.image,nom:r.nom,dims:r.dims});
  const d=r.dims||{}; if(!(d.L&&d.P&&d.H)) dire(`« ${r.nom||'Produit'} » ajouté (${r.site}) : dimensions ${d.L||d.P||d.H?'en partie trouvées':'non trouvées'} sur la page, complétez-les (cm).`);
}

// ---------- l'image composée et la consigne ----------
async function composer(){
  const b=mi.base.image, base=await charger(mi.url), c=el('canvas'); c.width=b.w||base.width; c.height=b.h||base.height;
  const g=c.getContext('2d'); g.drawImage(base,0,0,c.width,c.height);
  g.fillStyle='rgba(255,31,31,0.72)'; for(const z of mi.zones) g.fillRect(z.x*c.width,z.y*c.height,z.lw*c.width,z.lh*c.height);
  for(const o of mi.objets){ const i=await charger(o.img), rw=o.lw*c.width, rh=o.lh*c.height, k=Math.min(rw/i.width,rh/i.height), w=i.width*k, h=i.height*k;
    g.drawImage(i,o.x*c.width+(rw-w)/2,o.y*c.height+(rh-h)/2,w,h); }
  return c.toDataURL('image/jpeg',0.9);
}
function consigne(precisions){
  const L=[`Edit image 1 into a photorealistic photograph of this room (${nomPiece(mi.base.piece)} of an apartment).`,
    'Image 1 is a photo of the room on which pictures of products are pasted where the new furniture should go (the position is approximate and the pasted size is only indicative), and RED areas mark what must be removed.',
    'Image 2 is the original photo of the room, only as a reference for the real materials and light.'];
  const dimsTexte=o=>o.L&&o.P&&o.H?`${o.L} × ${o.P} × ${o.H} cm (width × depth × height)`:o.L||o.H?`${o.L?'width '+o.L+' cm':''}${o.L&&o.H?', ':''}${o.H?'height '+o.H+' cm':''}`:'real size unknown: use a plausible size';
  if(mi.objets.length){ L.push('Reference pictures of the new furniture:'); mi.objets.forEach((o,k)=>L.push(`- image ${k+3}: "${o.nom}" (${dimsTexte(o)}).`)); }
  L.push('Changes:');
  mi.objets.forEach((o,k)=>L.push(`- Replace the pasted picture of "${o.nom}" by the real piece of furniture of image ${k+3}, at the correct real-world scale for its dimensions and for this room, standing on the floor or against the wall as appropriate, with the right perspective and orientation. It must look exactly like image ${k+3} (shape, colors, materials).`));
  if(mi.zones.length) L.push(`- Remove completely what is inside the ${mi.zones.length>1?mi.zones.length+' red areas':'red area'} and rebuild what is behind it (wall, floor, skirting board), so that nothing of it remains.`);
  if(!mi.objets.length&&!mi.zones.length) L.push('- No furniture change: keep the room as it is.');
  L.push('Keep everything else exactly as in image 2: framing, perspective, lens, light, white balance, walls, floor and every other object. Add realistic contact shadows and reflections. The result must not show any red tint, pasted-picture edge, text or watermark, and must not contain any furniture that is not asked for.');
  if(precisions) L.push('Additional instructions from the owner (in French): '+precisions.slice(0,600));
  return L.join('\n');
}
async function preparer(){
  if(!mi) return; if(!app.edition){ dire('Les rendus se lancent en « Éditer » (ils consomment des crédits kie.ai).',true); return; }
  if(!mi.objets.length&&!mi.zones.length){ dire('Ajoutez d’abord un objet ou une zone à effacer.',true); return; }
  const z=fen.querySelector('.mi-confirmer'), ok=z.querySelector('#mi-ok'); z.hidden=false; ok.disabled=true;
  z.querySelector('.mi-cout').textContent='Préparation…';
  try{ prep={composee:await composer()}; z.querySelector('img').src=prep.composee; }catch(e){ z.querySelector('.mi-cout').textContent='Préparation impossible : '+(e.message||e); return; }
  const solde=await soldeKie();
  z.querySelector('.mi-cout').textContent=`Lancer le rendu ? Coût : ${COUT} crédits kie.ai (≈ 0,09 $)`+(solde!=null?` · solde : ${Math.floor(solde).toLocaleString('fr-FR')} crédits`:'')+' · environ 1 minute';
  ok.disabled=solde!=null&&solde<COUT; if(ok.disabled) z.querySelector('.mi-cout').textContent+=' : plus assez de crédits.';
}
async function lancer(){
  if(!prep||!mi) return; const z=fen.querySelector('.mi-confirmer'), ok=z.querySelector('#mi-ok'); ok.disabled=true;
  const precisions=fen.querySelector('#mi-precisions').value.trim(), b=mi.base;
  dire('Envoi à kie.ai…');
  try{
    const photo=await reduire(mi.url,2048), images=[prep.composee,photo.url,...mi.objets.slice(0,6).map(o=>o.img)];
    const detail=[...mi.objets.map(o=>`Ajouté (photo) : ${o.nom}${o.L&&o.P&&o.H?` (${o.L} × ${o.P} × ${o.H} cm)`:''}`),...mi.zones.map((_,k)=>`Zone effacée ${k+1}`)];
    const r=await demarrerRendu({images,consigne:consigne(precisions),ratio:ratioDe(b.image.w,b.image.h),titre:`${b.nom} · mode Image`,
      champs:{piece:b.piece,photo:b.photo||'',avant:b.image,variante:'',mode:'image',detail}});
    if(!r.id){ dire(r.erreur,true); ok.disabled=false; return; }
    z.hidden=true; prep=null;
    dire('Rendu en cours chez kie.ai… (environ 1 minute ; vous pouvez fermer : il arrivera dans les rendus de la pièce)');
    await suivre(r,s=>{ if(!fen.hidden) dire(`Rendu en cours chez kie.ai… ${s} s`); });
    if(r.etat==='fini') dire('Rendu prêt : bouton « Photos », onglet « Rendus », pour le voir en avant / après.');
    else dire('Le rendu a échoué : '+(r.erreur||'raison inconnue'),true);
  }catch(e){ dire('Rendu impossible : '+(e.message||e),true); ok.disabled=false; }
}

// ---------- la fenêtre ----------
function construire(){
  fen=el('div',{id:'mode-image',class:'visionneuse mode-image',role:'dialog','aria-modal':'true','aria-label':'Mode Image'});
  fen.innerHTML=`<div class="vis-haut"><div class="vis-titre"><strong></strong><span></span></div>
      <button type="button" class="vis-b" id="mi-fermer" aria-label="Fermer" title="Fermer">×</button></div>
    <div class="vis-zone mi-zone"><div class="mi-cadre"><img class="mi-photo" alt="Photo de la pièce"><div class="mi-calques"></div></div></div>
    <div class="mi-bas">
      <div class="mi-outils">
        <button type="button" class="btn primary" id="mi-ajouter" aria-expanded="false">📎 Ajouter un objet</button>
        <button type="button" class="btn" id="mi-effacer">Effacer une zone</button>
        <input type="text" id="mi-precisions" maxlength="600" placeholder="Précisions (facultatif) : lumière du soir…" aria-label="Précisions pour le rendu">
        <button type="button" class="btn primary" id="mi-rendu">Lancer le rendu…</button>
      </div>
      <div class="mi-ajout" hidden>
        <div class="mi-ligne"><button type="button" class="btn" id="mi-coller">Coller l’image</button><button type="button" class="btn" id="mi-choisir">Choisir une image</button>
          <input type="file" id="mi-fichier" accept="image/*" hidden>
          <span class="mi-lien"><input type="url" id="mi-lien" placeholder="ou collez le lien du produit (https://…)" aria-label="Lien du produit"><button type="button" class="btn" id="mi-lien-lire">Lire le lien</button></span></div>
        <div class="mi-ligne mi-boutiques"><input type="search" id="mi-q" placeholder="Chercher dans une boutique : canapé, lampe…" aria-label="Recherche dans une boutique"></div>
        <p class="mat-aide">Sur la page du produit : copiez son lien (ou l’image : appui long ou clic droit, « Copier l’image »), revenez ici et collez-le. Sur PC, Ctrl+V marche aussi.</p>
      </div>
      <div class="mi-objets"></div>
      <div class="mi-confirmer" hidden><img alt="Photo avec les objets posés"><div><p class="mi-cout"></p>
        <div class="ph-boutons"><button type="button" class="btn primary" id="mi-ok">Oui, lancer le rendu</button><button type="button" class="btn" id="mi-non">Annuler</button></div></div></div>
      <p class="ph-message" role="status"></p>
    </div>`;
  document.body.append(fen);
  const q=s=>fen.querySelector(s);
  q('#mi-fermer').onclick=fermer;
  q('#mi-ajouter').onclick=()=>{ const a=q('.mi-ajout'); a.hidden=!a.hidden; q('#mi-ajouter').setAttribute('aria-expanded',String(!a.hidden)); };
  q('#mi-effacer').onclick=ajouterZone;
  q('#mi-coller').onclick=coller; q('#mi-choisir').onclick=()=>q('#mi-fichier').click();
  q('#mi-fichier').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; depuisFichier(f); };
  q('#mi-lien-lire').onclick=lien;
  q('#mi-rendu').onclick=preparer; q('#mi-ok').onclick=lancer; q('#mi-non').onclick=()=>{ q('.mi-confirmer').hidden=true; prep=null; };
  for(const b of BOUTIQUES){ const x=el('button',{type:'button',class:'cat-idee',title:'Lien : '+b.lien},b.nom);
    x.onclick=()=>{ const t=q('#mi-q').value.trim(); open(lienRecherche(b,t),'_blank','noopener'); dire(`${b.nom} s’ouvre dans un nouvel onglet${b.recherche&&t?' sur votre recherche':''} : choisissez le produit, copiez son lien${b.lien==='copier l’image'?' ou plutôt son image (ce site refuse la lecture automatique)':''}, puis revenez ici et collez-le.`); };
    q('.mi-boutiques').append(x); }
  for(const i of ['#mi-lien','#mi-q','#mi-precisions']) q(i).addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){ if(i==='#mi-lien') lien(); e.target.blur(); } });
  fen.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!/INPUT/.test(e.target.tagName)){ e.stopPropagation(); fermer(); } });
  // Ctrl+V : une image ou un lien collés pendant que le mode Image est ouvert
  addEventListener('paste',async e=>{ if(!fen||fen.hidden||/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const f=[...(e.clipboardData?.files||[])].find(x=>/^image\//.test(x.type)); if(f){ e.preventDefault(); await depuisFichier(f); return; }
    const t=e.clipboardData?.getData('text'); if(/^https?:\/\//i.test(t||'')){ e.preventDefault(); q('#mi-lien').value=t.trim(); lien(); } });
  // le cadre de la photo suit la place libre (le panneau du bas grandit quand on ajoute des objets ou ouvre l'ajout)
  new ResizeObserver(()=>{ if(!fen.hidden) caler(); }).observe(q('.mi-zone'));
}
