// Mode « Image » (étape 5, livraison 3) : on modifie la photo, pas la maquette. Sur une photo de pièce (ou un rendu
// précédent), le trombone « Ajouter un objet » prend l'image d'un meuble : fichier, image collée, lien d'un produit
// (n8n lit la page : photo, nom, dimensions), ou raccourcis vers les boutiques (Suisse). On la place à peu près sur la
// photo (rectangle à glisser, coin pour la taille), on peut aussi marquer en rouge ce qu'il faut effacer. « Lancer le
// rendu » (confirmation, crédits) envoie à kie.ai la photo, la photo avec les objets posés et les zones rouges, et les
// images des objets ; le rendu rejoint l'historique de la pièce (avant / après). « Créer en 3D » ouvre le panneau photo
// avec l'image de l'objet, d'où Tripo le crée et le pose dans la maquette.
// Le 11 octobre 2026 (« Photo réaliste », photo et 3D séparées) : le mode Image devient le « montage » ; « Mettre en 3D »
// remplace « Créer en 3D » et, si la photo est calée, le meuble est posé dans la maquette là où il est sur la photo
// (rayon de la caméra calée par le pied de l'image posée, jusqu'au sol de la pièce).
// Le 12 octobre 2026 (Mauro : « il faudrait que ce soit plus clair ») : à chaque ouverture, deux choix : « Décrire ce que je
// veux » (demande écrite seule, l'IA choisit les objets et le style, chaque rendu est différent ; exemples à toucher) ou
// « Ajouter un produit précis » (image, lien, boutique, posé sur la photo à ses dimensions, plus des précisions
// facultatives) ; « ← Changer » revient au choix, « Effacer une zone » dans les deux. Un produit reçu (liste « Produits »,
// « Partager ») ouvre directement le second ; une image ou un lien collés y passent aussi. « Mes produits » (même jour) :
// la liste « Produits » en vignettes (ceux de la pièce de la photo d'abord), toucher un produit le pose sur la photo.
import * as THREE from 'three';
import {app, $} from './app.js';
import {lireFichier} from './fichiers.js';
import {BOUTIQUES, lienRecherche, lireProduit} from './boutiques.js';
import {soldeKie, ratioDe, demarrerRendu, suivre, camPhoto, modelesRendu, coutRendu} from './rendu.js';
import {ouvrirPhotoAvec} from './photo.js';
import {PIECES, pieceEn} from './pieces.js';
import {ETAGE_FLOOR} from './config.js';

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
// base = {nom, piece, photo (id de la photo d'origine), image:{id,n,type,w,h}, cal:{calage, image} si la photo est calée}
export async function ouvrirModeImage(base,produit){
  if(!fen) construire();
  if(!mi||mi.base.image.id!==base.image.id) mi={base,objets:[],zones:[],texte:{decrire:'',produit:''}}; else mi.base=base;
  fen.hidden=false; sel=null; prep=null; fen.querySelector('.mi-confirmer').hidden=true;
  fen.querySelector('.vis-titre strong').textContent='Montage : « '+base.nom+' »';
  fen.querySelector('.vis-titre span').textContent=nomPiece(base.piece)+' · on modifie la photo, pas la maquette'+(base.cal?' · photo calée':'');
  const img=fen.querySelector('.mi-photo'); img.removeAttribute('src');
  const b=await lireFichier(base.image.id,base.image.n||1,base.image.type||'image/jpeg');
  if(!b){ dire('La photo n’a pas pu être lue.',true); return; }
  if(mi.url) URL.revokeObjectURL(mi.url); mi.url=URL.createObjectURL(b); img.src=mi.url;
  mi.mode=undefined; choisirMode(produit?'produit':null);
  await img.decode().catch(()=>{}); caler(); dessiner(); majListe();
  if(produit) await ajouterProduit(produit);
}
// les deux façons de faire un montage (12 octobre 2026) ; null : l'écran de choix. Chaque mode garde son texte ; les
// produits posés sont mis de côté pendant « Décrire » (la photo part seule) et reviennent avec « Ajouter un produit précis »
const MODES={
  decrire:{nom:'Décrire ce que je veux',champ:'Votre demande : ajoute de la décoration, ambiance du soir…',libelle:'Votre demande pour le rendu',
    note:'L’IA choisit elle-même les objets, le style et les couleurs : chaque rendu est différent (lancez-en 2 à 4 pour choisir). Pour un meuble précis, prenez plutôt « Ajouter un produit précis ».',
    msg:'Écrivez votre demande (ou touchez un exemple), puis « Lancer le rendu… ».'},
  produit:{nom:'Ajouter un produit précis',champ:'Précisions (facultatif) : contre le mur, lumière du soir…',libelle:'Précisions pour le rendu (facultatif)',
    note:'L’IA reproduit votre produit là où vous le posez sur la photo, à ses dimensions.',
    msg:'Collez l’image ou le lien du produit (Ctrl+V sur PC), ou choisissez une image ; posez-le sur la photo, vérifiez ses dimensions, puis « Lancer le rendu… ».'},
};
function choisirMode(m){
  if(!mi||mi.mode===m) return;
  const champ=fen.querySelector('#mi-precisions');
  if(mi.mode) mi.texte[mi.mode]=champ.value;
  if(m==='decrire'&&mi.objets.length){ mi.gardes=mi.objets; mi.objets=[]; }
  if(m==='produit'&&mi.gardes?.length&&!mi.objets.length){ mi.objets=mi.gardes; mi.gardes=null; }
  mi.mode=m; fen.dataset.mode=m||'choix'; sel=null; prep=null; fen.querySelector('.mi-confirmer').hidden=true;
  const d=MODES[m]; champ.value=m?mi.texte[m]||'':''; champ.placeholder=d?.champ||''; champ.setAttribute('aria-label',d?.libelle||'');
  fen.querySelector('.mi-mode-nom').textContent=d?.nom||''; fen.querySelector('.mi-note-mode').textContent=d?.note||'';
  dessiner(); majListe(); dire(d?d.msg:'Choisissez : décrire ce que vous voulez (l’IA choisit), ou ajouter un produit précis.');
  if(m==='decrire') champ.focus();
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
async function ajouterProduit({image,nom,dims,lien,site}){
  if(!mi) return; choisirMode('produit');
  let r; try{ r=await reduire(image); }catch{ dire('Cette image n’a pas pu être lue.',true); return; }
  const ap=mi.base.image.w/mi.base.image.h, lw=0.3, lh=Math.min(0.7,lw*ap*r.h/r.w);
  const o={id:'o'+Date.now().toString(36),nom:(nom||'Objet '+(mi.objets.length+1)).slice(0,60),L:dims?.L||null,P:dims?.P||null,H:dims?.H||null,img:r.url,w:r.w,h:r.h,lien:lien||null,site:site||null,
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
// ---------- la liste des objets : nom, dimensions, « Mettre en 3D » ----------
function majListe(){
  const l=fen.querySelector('.mi-objets'); l.replaceChildren(); if(!mi) return;
  mi.objets.forEach((o,k)=>{
    const li=el('div',{class:'mi-objet'}), i=el('img',{src:o.img,alt:''}), n=el('input',{type:'text',value:o.nom,maxlength:'60','aria-label':'Nom de l’objet '+(k+1)});
    n.onchange=()=>{ o.nom=n.value.trim()||o.nom; };
    const cote=(c,t)=>{ const f=el('input',{type:'number',min:'1',max:'2000',step:'1',value:o[c]??'',placeholder:t,'aria-label':t+' (cm)'}); f.onchange=()=>{ const v=+f.value; o[c]=v>0?v:null; }; return f; };
    const d=el('span',{class:'mi-dims'}); d.append(cote('L','L'),el('span',{},'×'),cote('P','P'),el('span',{},'×'),cote('H','H'),el('span',{},'cm'));
    const t=el('button',{type:'button',class:'btn petit-b'},'Mettre en 3D');
    t.title=mi.base.cal?'Tripo crée ce meuble en 3D et le pose dans la maquette, là où il est sur la photo':'Tripo crée ce meuble en 3D et le pose dans la maquette (pièce de la photo)';
    t.onclick=async()=>{ if(!app.edition){ dire('Passez en « Éditer » pour ajouter un objet à la maquette.',true); return; }
      const b=await (await fetch(o.img)).blob(), place=placeDansMaquette(o); fermer(); ouvrirPhotoAvec(b,{nom:o.nom,L:o.L,P:o.P,H:o.H,origine:o.lien?{produit:true,site:o.site||'boutique',titre:o.nom,lien:o.lien}:null},false,place); };
    const x=el('button',{type:'button',class:'btn petit-b danger','aria-label':'Retirer '+o.nom},'×'); x.onclick=()=>{ mi.objets=mi.objets.filter(q=>q!==o); dessiner(); majListe(); };
    li.append(el('span',{class:'mi-num'},String(k+1)),i,n,d,t,x); l.append(li);
  });
}
// ---------- où poser dans la maquette un meuble du montage (photo calée) ----------
// le pied de l'image posée (bas de l'image, contenue dans son rectangle) est le devant du meuble, au sol de la pièce :
// rayon de la caméra calée par ce point jusqu'au sol, puis une demi-profondeur plus loin ; tourné vers l'appareil, au
// quart de tour le plus proche (murs droits). null : photo non calée, ou point hors des pièces (posé alors comme d'habitude)
const rc=new THREE.Raycaster();
export function placeDansMaquette(o,base=mi?.base){
  const cal=base?.cal; if(!cal?.calage||!cal.image?.w) return null;
  const W=base.image.w||cal.image.w, H=base.image.h||cal.image.h, k=Math.min(o.lw*W/o.w,o.lh*H/o.h);
  const u=o.x+o.lw/2, v=o.y+o.lh/2+o.h*k/H/2;
  const cam=camPhoto({calage:cal.calage,image:cal.image}); rc.setFromCamera(new THREE.Vector2(u*2-1,1-v*2),cam);
  const {origin:a,direction:d}=rc.ray, sol=+cal.calage.sol||0; if(d.y>-0.02) return null;
  const t=(sol-a.y)/d.y; if(!(t>0&&t<15)) return null;
  const h=Math.hypot(d.x,d.z)||1, P=(o.P||50)/100, x=a.x+d.x*t+d.x/h*P/2, z=a.z+d.z*t+d.z/h*P/2;
  const niv=sol>ETAGE_FLOOR-0.3?'etage':'rez'; if(!pieceEn(x,z,niv)) return null;
  const r=Math.round(Math.atan2(a.x-x,a.z-z)/(Math.PI/2))*(Math.PI/2);
  return {x:+x.toFixed(3),z:+z.toFixed(3),r:+(Math.abs(r)<1e-9?0:r).toFixed(4),niv};
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
  await ajouterProduit({image:r.image,nom:r.nom,dims:r.dims,lien:u,site:r.site});
  const d=r.dims||{}; if(!(d.L&&d.P&&d.H)) dire(`« ${r.nom||'Produit'} » ajouté (${r.site}) : dimensions ${d.L||d.P||d.H?'en partie trouvées':'non trouvées'} sur la page, complétez-les (cm).`);
}

// « Mes produits » : la liste « Produits » (idées d'achat) en vignettes ; ceux prévus pour la pièce de la photo d'abord
async function mesProduits(){
  const z=fen.querySelector('.mi-mesproduits'), b=fen.querySelector('#mi-mes-produits');
  if(!z.hidden){ z.hidden=true; b.setAttribute('aria-expanded','false'); return; }
  z.hidden=false; b.setAttribute('aria-expanded','true'); z.replaceChildren(el('p',{class:'mat-aide'},'Lecture de la liste « Produits »…'));
  let l; try{ const {chargerProduits}=await import('./produits.js'); l=[...await chargerProduits()]; }
  catch(e){ z.replaceChildren(el('p',{class:'mat-aide'},e.message||'La liste « Produits » n’a pas pu être lue.')); return; }
  if(!l.length){ z.replaceChildren(el('p',{class:'mat-aide'},'Votre liste « Produits » est vide : ajoutez-y vos idées d’achat avec le bouton « Produits » (le sac) de la barre.')); return; }
  const ici=mi?.base.piece; l.sort((a,c)=>(c.piece===ici)-(a.piece===ici));
  z.replaceChildren(...l.map(p=>{
    const t=el('button',{type:'button',class:'mi-produit','data-id':p.id,title:'Poser « '+p.nom+' » sur la photo'});
    t.append(p.vignette?el('img',{src:p.vignette,alt:''}):el('span',{class:'mi-produit-vide'},'pas d’image'),el('strong',{},p.nom||'Produit'),
      el('span',{},[p.L&&p.P&&p.H?`${p.L} × ${p.P} × ${p.H} cm`:'',p.piece===ici&&ici?nomPiece(ici):''].filter(Boolean).join(' · ')));
    t.disabled=!p.image?.id;
    t.onclick=async()=>{ dire('Lecture de l’image de « '+p.nom+' »…');
      const bl=await lireFichier(p.image.id,p.image.n||1,p.image.type||'image/jpeg'); if(!bl){ dire('L’image du produit n’a pas pu être lue.',true); return; }
      z.hidden=true; b.setAttribute('aria-expanded','false');
      await ajouterProduit({image:await versDataURL(bl),nom:p.nom,dims:{L:p.L,P:p.P,H:p.H},lien:p.lien||null,site:p.boutique||null}); };
    return t; }));
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
function consigne(precisions,nRef=6){   // nRef : images des objets envoyées (le modèle en accepte parfois moins)
  // une demande écrite seule (Mauro, 11 octobre 2026 : « ajoute de la décoration dans cette chambre ») : la photo seule est envoyée
  if(!mi.objets.length&&!mi.zones.length) return [`Edit image 1, a photo of a room (${nomPiece(mi.base.piece)} of an apartment), following this request from the owner (in French): « ${precisions.slice(0,600)} ».`,
    'Keep everything the request does not ask to change exactly as in image 1: framing, perspective, lens, light, white balance, walls, windows, floor and the existing furniture. The result must be a photorealistic photograph of the same room, with realistic contact shadows and reflections, without any text or watermark.'].join('\n');
  // « Décrire ce que je veux » avec des zones à effacer : la demande reste la consigne principale
  if(!mi.objets.length) return [`Edit image 1 into a photorealistic photograph of this room (${nomPiece(mi.base.piece)} of an apartment).`,
    'Image 1 is a photo of the room where RED areas mark what must be removed; image 2 is the original photo, only as a reference for the real materials and light.',
    `- Remove completely what is inside the ${mi.zones.length>1?mi.zones.length+' red areas':'red area'} and rebuild what is behind it (wall, floor, skirting board), so that nothing of it remains.`,
    ...(precisions?[`- Then follow this request from the owner (in French): « ${precisions.slice(0,600)} ».`]:[]),
    'Keep everything else exactly as in image 2: framing, perspective, lens, light, white balance, walls, windows, floor and the existing furniture. Add realistic contact shadows and reflections. The result must not show any red tint, text or watermark.'].join('\n');
  const L=[`Edit image 1 into a photorealistic photograph of this room (${nomPiece(mi.base.piece)} of an apartment).`,
    'Image 1 is a photo of the room on which pictures of products are pasted where the new furniture should go (the position is approximate and the pasted size is only indicative), and RED areas mark what must be removed.',
    'Image 2 is the original photo of the room, only as a reference for the real materials and light.'];
  const dimsTexte=o=>o.L&&o.P&&o.H?`${o.L} × ${o.P} × ${o.H} cm (width × depth × height)`:o.L||o.H?`${o.L?'width '+o.L+' cm':''}${o.L&&o.H?', ':''}${o.H?'height '+o.H+' cm':''}`:'real size unknown: use a plausible size';
  if(mi.objets.length&&nRef){ L.push('Reference pictures of the new furniture:'); mi.objets.slice(0,nRef).forEach((o,k)=>L.push(`- image ${k+3}: "${o.nom}" (${dimsTexte(o)}).`)); }
  L.push('Changes:');
  mi.objets.forEach((o,k)=>L.push(k<nRef?`- Replace the pasted picture of "${o.nom}" by the real piece of furniture of image ${k+3}, at the correct real-world scale for its dimensions and for this room, standing on the floor or against the wall as appropriate, with the right perspective and orientation. It must look exactly like image ${k+3} (shape, colors, materials).`
    :`- Replace the pasted picture of "${o.nom}" (${dimsTexte(o)}) by the real piece of furniture it shows, at the correct real-world scale for this room, with the right perspective and orientation, looking exactly like the pasted picture.`));
  if(mi.zones.length) L.push(`- Remove completely what is inside the ${mi.zones.length>1?mi.zones.length+' red areas':'red area'} and rebuild what is behind it (wall, floor, skirting board), so that nothing of it remains.`);
  L.push('Keep everything else exactly as in image 2: framing, perspective, lens, light, white balance, walls, floor and every other object. Add realistic contact shadows and reflections. The result must not show any red tint, pasted-picture edge, text or watermark, and must not contain any furniture that is not asked for.');
  if(precisions) L.push('Additional instructions from the owner (in French): '+precisions.slice(0,600));
  return L.join('\n');
}
async function preparer(){
  if(!mi) return;   // en Visite aussi (Mauro, 11 octobre 2026 : le montage ne touche pas la maquette) ; confirmation avant chaque rendu (crédits)
  if(mi.mode==='decrire'&&!mi.zones.length&&!fen.querySelector('#mi-precisions').value.trim()){ dire('Écrivez votre demande (par exemple « ajoute de la décoration dans cette chambre »), ou touchez un exemple.',true); fen.querySelector('#mi-precisions').focus(); return; }
  if(mi.mode!=='decrire'&&!mi.objets.length&&!mi.zones.length){ dire('Ajoutez d’abord un produit : collez son image ou son lien, ou choisissez une image.',true); return; }
  const z=fen.querySelector('.mi-confirmer'), ok=z.querySelector('#mi-ok'); z.hidden=false; ok.disabled=true;
  z.querySelector('.mi-cout').textContent='Préparation…';
  try{ prep={composee:await composer()}; z.querySelector('img').src=prep.composee; }catch(e){ z.querySelector('.mi-cout').textContent='Préparation impossible : '+(e.message||e); return; }
  prep.solde=await soldeKie(); remplirModeles(); choisirNombre(1); majCout();
}
// Modèle de kie.ai pour le rendu (Mauro, 11 octobre 2026) : menu d'après la liste du workflow n8n, choix retenu sur l'appareil
const CLE_MODELE='maison3d-modele-rendu';
const seule=()=>!mi.objets.length&&!mi.zones.length;   // demande écrite seule : la photo seule part
function modeleChoisi(){ const l=modelesRendu(), v=fen.querySelector('#mi-modele').value; return l.find(m=>m.id===v)||l[0]; }
// images envoyées pour ce modèle : image composée, vraie photo, puis les objets tant que le modèle en accepte
const nbImages=m=>seule()?1:Math.min(m.max,2+Math.min(6,mi.objets.length));
function remplirModeles(){
  const s=fen.querySelector('#mi-modele'), l=modelesRendu(); let garde=null; try{ garde=localStorage.getItem(CLE_MODELE); }catch{}
  s.replaceChildren(...l.map(m=>el('option',{value:m.id},m.nom)));
  s.value=l.some(m=>m.id===garde)?garde:l[0].id;
}
// nombre de rendus des mêmes images (1 à 4, Mauro, 11 octobre 2026) : 1 à chaque ouverture (crédits)
const nombreChoisi=()=>+(fen.querySelector('.mi-nombre button[aria-pressed="true"]')?.dataset.n||1);
function choisirNombre(n){ for(const x of fen.querySelectorAll('.mi-nombre button')) x.setAttribute('aria-pressed',String(+x.dataset.n===n)); }
const virgule=v=>String(+v.toFixed(2)).replace('.',',');
function majCout(){
  if(!prep) return; const m=modeleChoisi(), n=nbImages(m), u=coutRendu(m,n), k=nombreChoisi(), c=u*k, z=fen.querySelector('.mi-confirmer'), ok=z.querySelector('#mi-ok'), solde=prep.solde;
  const coupe=!seule()&&mi.objets.length>n-2?` · ${m.nom} n'accepte que ${m.max} images : ${n-2} objet${n-2>1?'s':''} sur ${mi.objets.length} envoyé${n-2>1?'s':''}`:'';
  z.querySelector('.mi-cout').textContent=`Coût : ${k>1?k+' × '+virgule(u)+' = ':''}${virgule(c)} crédits kie.ai (≈ ${(c*0.005).toFixed(2).replace('.',',')} $)`
    +(solde!=null?` · solde : ${Math.floor(solde).toLocaleString('fr-FR')} crédits`:'')+` · environ 1 minute${k>1?', en même temps':''}`+coupe;
  z.querySelector('.mi-note').textContent=m.note||'';
  ok.textContent=k>1?`Oui, lancer ${k} rendus`:'Oui, lancer le rendu';
  ok.disabled=solde!=null&&solde<c; if(ok.disabled) z.querySelector('.mi-cout').textContent+=' : plus assez de crédits.';
}
async function lancer(){
  if(!prep||!mi) return; const z=fen.querySelector('.mi-confirmer'), ok=z.querySelector('#mi-ok'); ok.disabled=true;
  const precisions=fen.querySelector('#mi-precisions').value.trim(), b=mi.base;
  dire('Envoi à kie.ai…');
  try{
    const m=modeleChoisi(), n=nbImages(m), photo=await reduire(mi.url,2048), images=seule()?[photo.url]:[prep.composee,photo.url,...mi.objets.slice(0,n-2).map(o=>o.img)];
    try{ localStorage.setItem(CLE_MODELE,m.id); }catch{}
    const detail=[...mi.objets.map(o=>`Ajouté (photo) : ${o.nom}${o.L&&o.P&&o.H?` (${o.L} × ${o.P} × ${o.H} cm)`:''}`),...mi.zones.map((_,k)=>`Zone effacée ${k+1}`),...(precisions?[`${mi.mode==='decrire'?'Demande':'Précisions'} : ${precisions.slice(0,200)}`]:[]),`Modèle : ${m.nom}`];
    const k=nombreChoisi(), r=await demarrerRendu({images,modele:m.id,nombre:k,consigne:consigne(precisions,seule()?0:n-2),ratio:ratioDe(b.image.w,b.image.h),titre:`${b.nom} · montage`,
      champs:{piece:b.piece,photo:b.photo||'',avant:b.image,variante:'',mode:'image',detail}});
    if(!r.id){ dire(r.erreur,true); ok.disabled=false; return; }
    z.hidden=true; prep=null;
    const lot=r.lot||[r], N=lot.length, refus=r.refusees?` (${r.refusees} refusé${r.refusees>1?'s':''} par kie.ai)`:'';
    dire((N>1?`${N} rendus en cours chez kie.ai${refus}…`:'Rendu en cours chez kie.ai…')+' (environ 1 minute ; vous pouvez fermer : '+(N>1?'ils arriveront':'il arrivera')+' dans les rendus de la pièce)');
    let dernier=0; const etat=()=>{ const f=lot.filter(x=>x.etat==='fini').length; return N>1?`${N} rendus en cours chez kie.ai… ${f} / ${N} prêt${f>1?'s':''} · ${dernier} s`:`Rendu en cours chez kie.ai… ${dernier} s`; };
    await Promise.all(lot.map(x=>suivre(x,s=>{ dernier=Math.max(dernier,s); if(!fen.hidden) dire(etat()); }).then(()=>{ if(!fen.hidden&&N>1) dire(etat()); })));
    const prets=lot.filter(x=>x.etat==='fini').length;
    if(prets===N) dire(N>1?`${N} rendus prêts : « Photo réaliste », onglet « Rendus », pour les voir en avant / après.`:'Rendu prêt : « Photo réaliste », onglet « Rendus », pour le voir en avant / après.');
    else if(prets) dire(`${prets} rendu${prets>1?'s':''} prêt${prets>1?'s':''} sur ${N} (« Photo réaliste », onglet « Rendus ») ; les autres ont échoué : ${lot.find(x=>x.etat!=='fini')?.erreur||'raison inconnue'}`,true);
    else dire((N>1?'Les rendus ont échoué : ':'Le rendu a échoué : ')+(r.erreur||'raison inconnue'),true);
  }catch(e){ dire('Rendu impossible : '+(e.message||e),true); ok.disabled=false; }
}

// ---------- la fenêtre ----------
function construire(){
  fen=el('div',{id:'mode-image',class:'visionneuse mode-image',role:'dialog','aria-modal':'true','aria-label':'Montage photo'});
  fen.innerHTML=`<div class="vis-haut"><div class="vis-titre"><strong></strong><span></span></div>
      <button type="button" class="vis-b" id="mi-fermer" aria-label="Fermer" title="Fermer">×</button></div>
    <div class="vis-zone mi-zone"><div class="mi-cadre"><img class="mi-photo" alt="Photo de la pièce" draggable="false"><div class="mi-calques"></div></div></div>
    <div class="mi-bas">
      <div class="mi-choix">
        <button type="button" class="mi-carte" id="mi-mode-decrire"><strong>✍️ Décrire ce que je veux</strong><span>Une demande écrite : l’IA choisit elle-même les objets et le style. Chaque rendu est différent.</span></button>
        <button type="button" class="mi-carte" id="mi-ajouter"><strong>📎 Ajouter un produit précis</strong><span>Une image, un lien ou une boutique : l’IA reproduit ce produit là où vous le posez, à ses dimensions.</span></button>
      </div>
      <div class="mi-tete"><button type="button" class="btn" id="mi-changer">← Changer</button><strong class="mi-mode-nom"></strong><button type="button" class="btn" id="mi-effacer">Effacer une zone</button></div>
      <p class="mi-note-mode"></p>
      <div class="mi-exemples"></div>
      <div class="mi-ajout">
        <div class="mi-ligne"><button type="button" class="btn" id="mi-mes-produits" aria-expanded="false">🛍 Mes produits</button><button type="button" class="btn" id="mi-coller">Coller l’image</button><button type="button" class="btn" id="mi-choisir">Choisir une image</button>
          <input type="file" id="mi-fichier" accept="image/*" hidden>
          <span class="mi-lien"><input type="url" id="mi-lien" placeholder="ou collez le lien du produit (https://…)" aria-label="Lien du produit"><button type="button" class="btn" id="mi-lien-lire">Lire le lien</button></span></div>
        <div class="mi-mesproduits" hidden></div>
        <div class="mi-ligne mi-boutiques"><input type="search" id="mi-q" placeholder="Chercher dans une boutique : canapé, lampe…" aria-label="Recherche dans une boutique"></div>
        <p class="mat-aide">Sur la page du produit : copiez son lien (ou l’image : appui long ou clic droit, « Copier l’image »), revenez ici et collez-le. Sur PC, Ctrl+V marche aussi.</p>
      </div>
      <div class="mi-objets"></div>
      <div class="mi-outils">
        <input type="text" id="mi-precisions" maxlength="600" placeholder="" aria-label="Votre demande pour le rendu">
        <button type="button" class="btn primary" id="mi-rendu">Lancer le rendu…</button>
      </div>
      <div class="mi-confirmer" hidden><img alt="Photo avec les objets posés"><div class="mi-conf">
        <h3 class="mi-conf-titre">Lancer le rendu réaliste</h3>
        <div class="mi-conf-ligne"><span class="mi-conf-lib">Modèle</span><select id="mi-modele" aria-label="Modèle de kie.ai pour le rendu"></select></div>
        <p class="mi-note"></p>
        <div class="mi-conf-ligne"><span class="mi-conf-lib">Nombre de rendus</span><span class="seg mi-nombre" role="group" aria-label="Nombre de rendus">${[1,2,3,4].map(n=>`<button type="button" data-n="${n}" aria-pressed="${n===1}">${n}</button>`).join('')}</span></div>
        <p class="mi-cout"></p>
        <div class="ph-boutons"><button type="button" class="btn primary" id="mi-ok">Oui, lancer le rendu</button><button type="button" class="btn" id="mi-non">Annuler</button></div></div></div>
      <p class="ph-message" role="status"></p>
    </div>`;
  document.body.append(fen);
  const q=s=>fen.querySelector(s);
  q('#mi-fermer').onclick=fermer;
  q('#mi-ajouter').onclick=()=>choisirMode('produit'); q('#mi-mode-decrire').onclick=()=>choisirMode('decrire'); q('#mi-changer').onclick=()=>choisirMode(null);
  for(const t of ['Ajoute de la décoration','Ambiance du soir, lampes allumées','Ajoute des plantes','Style scandinave','Remplace le canapé par un canapé en velours vert']){
    const x=el('button',{type:'button',class:'cat-idee'},t); x.onclick=()=>{ const c=q('#mi-precisions'); c.value=c.value.trim()?c.value.trim()+', '+t.toLowerCase():t; c.focus(); }; q('.mi-exemples').append(x); }
  q('#mi-effacer').onclick=ajouterZone;
  q('#mi-coller').onclick=coller; q('#mi-mes-produits').onclick=mesProduits; q('#mi-choisir').onclick=()=>q('#mi-fichier').click();
  q('#mi-fichier').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; depuisFichier(f); };
  q('#mi-lien-lire').onclick=lien;
  q('#mi-rendu').onclick=preparer; q('#mi-modele').onchange=majCout;
  for(const b of fen.querySelectorAll('.mi-nombre button')) b.onclick=()=>{ for(const x of fen.querySelectorAll('.mi-nombre button')) x.setAttribute('aria-pressed',String(x===b)); majCout(); }; q('#mi-ok').onclick=lancer; q('#mi-non').onclick=()=>{ q('.mi-confirmer').hidden=true; prep=null; };
  for(const b of BOUTIQUES){ const x=el('button',{type:'button',class:'cat-idee',title:'Lien : '+b.lien},b.nom);
    x.onclick=()=>{ const t=q('#mi-q').value.trim(); open(lienRecherche(b,t),'_blank','noopener'); dire(`${b.nom} s’ouvre dans un nouvel onglet${b.recherche&&t?' sur votre recherche':''} : choisissez le produit, copiez son lien${b.lien==='copier l’image'?' ou plutôt son image (ce site refuse la lecture automatique)':''}, puis revenez ici et collez-le.`); };
    q('.mi-boutiques').append(x); }
  for(const i of ['#mi-lien','#mi-q','#mi-precisions']) q(i).addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){ if(i==='#mi-lien') lien(); e.target.blur(); } });
  fen.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!/INPUT/.test(e.target.tagName)){ e.stopPropagation(); fermer(); } });
  // Ctrl+V : une image ou un lien collés pendant que le montage est ouvert
  addEventListener('paste',async e=>{ if(!fen||fen.hidden||/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const f=[...(e.clipboardData?.files||[])].find(x=>/^image\//.test(x.type)); if(f){ e.preventDefault(); await depuisFichier(f); return; }
    const t=e.clipboardData?.getData('text'); if(/^https?:\/\//i.test(t||'')){ e.preventDefault(); q('#mi-lien').value=t.trim(); lien(); } });
  // le cadre de la photo suit la place libre (le panneau du bas grandit quand on ajoute des objets ou ouvre l'ajout)
  new ResizeObserver(()=>{ if(!fen.hidden) caler(); }).observe(q('.mi-zone'));
}
