// Rendu réaliste depuis la maquette (étape 5, livraison 2) : la vraie photo montre l'appartement tel qu'il est, c'est-à-dire
// la variante « Base ». On compare la variante affichée à la Base (objets ajoutés, retirés, déplacés, recolorés), puis on
// compose une image à la taille de la photo, avec la caméra calée : la photo en fond, la profondeur de la maquette
// d'origine (murs et meubles inchangés cachent ce qui est derrière eux), en rouge transparent ce qui doit disparaître
// (meubles retirés, et la place d'origine des meubles déplacés), puis les meubles ajoutés ou déplacés en 3D, à leur place.
// kie.ai (Nano Banana Pro, 2K, workflow n8n « Maison3D Rendu ») reçoit la vraie photo, cette image composée et les
// images des nouveaux meubles, avec une consigne écrite ici. Confirmation avant chaque envoi (crédits) ; le rendu est
// suivi, puis gardé dans la table Rendus (image dans Fichiers) : historique par pièce dans la galerie.
import * as THREE from 'three';
import {app, $} from './app.js';
import {appel, moi} from './api.js';
import {envoyerFichier, lireFichier} from './fichiers.js';
import {etatDe, origineDe} from './etats.js';
import {varianteCourante} from './synchro.js';
import {imageMeuble} from './impression.js';
import {imagePhoto} from './galerie.js';
import {PIECES} from './pieces.js';

const RENDU='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d-rendu';
export const COUT=18;   // crédits kie.ai d'un rendu 2K (≈ 0,09 $)
const L_ROUGE=27, L_NEUF=28, MAX_PRODUITS=6;
const RATIOS=[['1:1',1],['2:3',2/3],['3:2',3/2],['3:4',3/4],['4:3',4/3],['4:5',4/5],['5:4',5/4],['9:16',9/16],['16:9',16/9],['21:9',21/9]];
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const jeton=()=>{ try{ return JSON.parse(localStorage.getItem('maison3d-compte')||'null')?.jeton||''; }catch{ return ''; } };
const nomPiece=id=>PIECES.find(p=>p.id===id)?.nom||'pièce';
const nomDe=it=>it.ajout?.n||it.meta?.l||it.name;
const cm=v=>Math.max(1,Math.round(v*100));
const dims=it=>`${cm(it.size.x)} × ${cm(it.size.z)} × ${cm(it.size.y)} cm`;
export const ratioDe=(w,h)=>RATIOS.reduce((m,r)=>Math.abs(Math.log(r[1]*h/w))<Math.abs(Math.log(m[1]*h/w))?r:m)[0];

// ---------- appels au workflow n8n ----------
export async function n8nRendu(corps){
  let r; try{ r=await fetch(RENDU,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...corps,jeton:jeton()}),cache:'no-store'}); }
  catch{ return {ok:false,horsLigne:true,erreur:'Pas de connexion au serveur'}; }
  return r.json().catch(()=>({ok:false,erreur:'Réponse illisible'}));
}
export async function soldeKie(){ const r=await n8nRendu({action:'solde'}); return r.ok?r.solde:null; }

// ---------- ce qui change par rapport à la Base ----------
export function changements(){
  const l=[];
  for(const it of Object.values(app.items)){
    if(it.ajout){ if(!it.hidden) l.push({it,type:'ajout'}); continue; }
    const o=origineDe(it.name); if(!o) continue;
    const e=etatDe(it);
    if(e.h){ l.push({it,type:'retire'}); continue; }
    const da=Math.abs(Math.atan2(Math.sin(e.r-o.r),Math.cos(e.r-o.r)));
    const taille=!!e.s, bouge=Math.hypot(e.x-o.x,e.z-o.z)>0.02||da>0.017||Math.abs(e.dy||0)>0.01;
    if(bouge||taille) l.push({it,type:'deplace',taille,aspect:!!(e.c||e.m)});
    else if(e.c||e.m) l.push({it,type:'aspect'});
  }
  return l;
}
// sols et murs changés de la pièce (revêtements posés, revetements.js)
function surfaces(piece){
  const g=app.model.getObjectByName('revetements'); if(!g) return [];
  return g.children.filter(m=>m.visible&&m.userData.surface&&m.userData.surface.endsWith('__'+piece));
}
// un meuble à sa place d'origine le temps d'une image (rendu de la place d'origine, en rouge)
function versBase(it){
  const g=it.g, p=g.position.clone(), r=g.rotation.clone(), s=g.scale.clone(), v=g.visible;
  g.position.copy(it.home); g.rotation.set(0,0,0); g.scale.set(1,1,1); g.visible=true; g.updateMatrixWorld(true);
  return ()=>{ g.position.copy(p); g.rotation.copy(r); g.scale.copy(s); g.visible=v; g.updateMatrixWorld(true); };
}
// caméra de la photo (calage) aux proportions de la photo
export function camPhoto(p){
  const c=p.calage, ap=p.image.w/p.image.h, fv=2*Math.atan(Math.tan(c.fov*Math.PI/360)/ap)*180/Math.PI;
  const cam=new THREE.PerspectiveCamera(fv,ap,0.05,300); cam.position.set(c.x,c.y,c.z); cam.rotation.set(c.pitch,c.yaw,c.roll||0,'YXZ');
  cam.updateMatrixWorld(); cam.updateProjectionMatrix(); return cam;
}
// changements visibles sur la photo (leur boîte, à la place actuelle ou d'origine, coupe le champ de la caméra)
export function dansLaPhoto(p,ch){
  const cam=camPhoto(p), f=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
  const voit=(it,base)=>{ const fin=base?versBase(it):null; const b=new THREE.Box3().setFromObject(it.g); fin?.(); return !b.isEmpty()&&f.intersectsBox(b); };
  return ch.filter(c=>c.type==='ajout'||c.type==='aspect'?voit(c.it,false):c.type==='retire'?voit(c.it,true):voit(c.it,false)||voit(c.it,true));
}

// ---------- l'image composée ----------
const PROFONDEUR=new THREE.MeshBasicMaterial({colorWrite:false});
const ROUGE=new THREE.MeshBasicMaterial({color:0xff1f1f,transparent:true,opacity:0.55,depthWrite:false,side:THREE.DoubleSide});
const charger=src=>new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ko(new Error('image illisible')); i.src=src; });
export async function composer(p,ch,piece=p.piece){
  const url=await imagePhoto(p); if(!url) throw new Error('la photo n’a pas pu être lue');
  const img=await charger(url), tex=new THREE.Texture(img); tex.colorSpace=THREE.SRGBColorSpace; tex.needsUpdate=true;
  const {renderer,scene,canvas}=app, W=p.image.w, H=p.image.h, cam=camPhoto(p);
  const masques=[], caches=[], marquer=(o,L)=>{ masques.push([o,o.layers.mask]); o.layers.set(L); };
  const fond=scene.background, plans=renderer.clippingPlanes, pr=renderer.getPixelRatio(), taille=renderer.getSize(new THREE.Vector2()), auto=renderer.autoClear, ov=scene.overrideMaterial;
  const cacher=o=>{ if(o&&o.visible){ caches.push(o); o.visible=false; } };
  let image;
  try{
    for(const c of ch) c.it.g.traverse(o=>{ if(o.name?.endsWith('__couvercle')||o.name==='alerte'){ cacher(o); return; } marquer(o,c.type==='retire'||c.type==='deplace'?L_ROUGE:L_NEUF); });
    for(const m of surfaces(piece)) marquer(m,L_NEUF);
    scene.traverse(o=>{ if(o.isLight){ masques.push([o,o.layers.mask]); o.layers.enable(L_ROUGE); o.layers.enable(L_NEUF); } });
    cacher(app.ciel); cacher(app.selBox); cacher(app.tc.getHelper?app.tc.getHelper():app.tc);
    renderer.setPixelRatio(1); renderer.setSize(W,H,false); renderer.clippingPlanes=[];
    // 1. la photo en fond, et la profondeur de ce qui ne change pas (sans les vitres ni les voiles transparents)
    const verres=[]; scene.traverse(o=>{ if(o.isMesh&&o.visible&&!Array.isArray(o.material)&&o.material?.transparent&&o.material.opacity<0.95){ verres.push(o); o.visible=false; } });
    scene.background=tex; scene.overrideMaterial=PROFONDEUR; renderer.autoClear=true; cam.layers.set(0); renderer.render(scene,cam);
    for(const o of verres) o.visible=true;
    // 2. en rouge : les meubles retirés et la place d'origine des meubles déplacés
    scene.background=null; renderer.autoClear=false; scene.overrideMaterial=ROUGE; cam.layers.set(L_ROUGE);
    const remettre=ch.filter(c=>c.type==='retire'||c.type==='deplace').map(c=>versBase(c.it));
    renderer.render(scene,cam); remettre.forEach(f=>f());
    // 3. les meubles ajoutés, déplacés ou recolorés, à leur place, avec leurs matières
    for(const c of ch.filter(c=>c.type==='deplace')) c.it.g.traverse(o=>{ if(o.layers.mask===1<<L_ROUGE) o.layers.set(L_NEUF); });
    scene.overrideMaterial=null; cam.layers.set(L_NEUF); renderer.render(scene,cam);
    image=canvas.toDataURL('image/jpeg',0.9);
  } finally {
    for(const [o,mk] of masques) o.layers.mask=mk; for(const o of caches) o.visible=true;
    scene.background=fond; scene.overrideMaterial=ov; renderer.autoClear=auto; renderer.clippingPlanes=plans;
    renderer.setPixelRatio(pr); renderer.setSize(taille.x,taille.y,false); tex.dispose();
  }
  return image;
}

// ---------- images des nouveaux meubles et de la photo ----------
const versDataURL=b=>new Promise((ok,ko)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result)); r.onerror=ko; r.readAsDataURL(b); });
async function reduire(src,max=1024,fondBlanc=true){
  const i=await charger(src), k=Math.min(1,max/Math.max(i.width,i.height)), c=el('canvas'); c.width=Math.round(i.width*k); c.height=Math.round(i.height*k);
  const g=c.getContext('2d'); if(fondBlanc){ g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); } g.drawImage(i,0,0,c.width,c.height); return c.toDataURL('image/jpeg',0.88);
}
export async function photoEnDataURL(p){ const b=await lireFichier(p.image.id,p.image.n||1,p.image.type||'image/jpeg'); if(!b) throw new Error('la photo n’a pas pu être lue'); return versDataURL(b); }
async function produits(ch){
  const l=[];
  for(const c of ch.filter(c=>c.type==='ajout'||c.type==='aspect'||(c.type==='deplace'&&c.aspect)).slice(0,MAX_PRODUITS)){
    const it=c.it; let src=null;
    if(it.ajout?.t==='photo'&&it.ajout.img){ const b=await lireFichier(it.ajout.img.id,it.ajout.img.n||1,it.ajout.img.type); if(b) src=URL.createObjectURL(b); }
    try{ if(!src) src=(await imageMeuble(it)).url; l.push({it,nom:nomDe(it),dims:dims(it),image:await reduire(src)}); }catch{}
    finally{ if(src?.startsWith('blob:')) URL.revokeObjectURL(src); }
  }
  return l;
}
// ---------- la consigne (en anglais : le modèle la suit mieux ; les noms des meubles restent en français) ----------
export function consigne(piece,ch,prods,precisions,surf){
  const L=[`Image 1 is a real photograph of a room of an apartment (${nomPiece(piece)}).`,
    'Image 2 is the same photograph on which the planned changes are drawn: plain 3D shapes show the furniture to add or move, at their exact position, size and orientation; areas tinted red show furniture that must disappear.'];
  if(prods.length){ L.push('The next images show what the new furniture really looks like:'); prods.forEach((p,k)=>L.push(`- image ${k+3}: "${p.nom}" (${p.dims}, width × depth × height).`)); }
  L.push('Changes to make:');
  const img=it=>{ const k=prods.findIndex(p=>p.it===it); return k<0?'':` (looking like image ${k+3})`; };
  for(const c of ch){ const n=`"${nomDe(c.it)}"`;
    if(c.type==='ajout') L.push(`- Add the ${n} (${dims(c.it)}) exactly where its 3D shape is drawn${img(c.it)||', with the colors and materials of its 3D shape'}.`);
    else if(c.type==='retire') L.push(`- Remove the ${n} (red area) and show what would be behind it (wall, floor, skirting board), consistent with the rest of the room.`);
    else if(c.type==='deplace') L.push(`- Move the ${n}: remove it from its old place (red area) and put the same real piece where its 3D shape is drawn${c.taille?` (new size: ${dims(c.it)})`:''}${c.aspect?', with the new color or material of its 3D shape'+img(c.it):''}.`);
    else L.push(`- Give the ${n} the new color or material of its 3D shape${img(c.it)}, without moving it.`); }
  for(const s of surf||[]) L.push(`- ${s.startsWith('sol')?'Replace the floor covering':'Repaint or recover the walls'} as shown on image 2.`);
  if(!ch.length&&!(surf||[]).length) L.push('- No change of furniture: keep the room as it is and only improve the photograph (light, sharpness).');
  L.push('Result: a photorealistic photograph identical to image 1 (same framing, perspective, lens, lighting, white balance, walls, floor and every other object) with only these changes applied. Respect the position, size and orientation of each 3D shape exactly, with realistic contact shadows, reflections and lighting matching the room. Do not add anything else. No text, no watermark, no red tint left.');
  if(precisions) L.push('Additional instructions from the owner (in French): '+precisions.slice(0,600));
  return L.join('\n');
}
export function detailFrancais(ch,surf){
  const L=ch.map(c=>c.type==='ajout'?`Ajouté : ${nomDe(c.it)} (${dims(c.it)})`:c.type==='retire'?`Retiré : ${nomDe(c.it)}`:
    c.type==='deplace'?`Déplacé${c.taille?' et redimensionné':''} : ${nomDe(c.it)}${c.aspect?' (nouvelle couleur ou matière)':''}`:`Nouvelle couleur ou matière : ${nomDe(c.it)}`);
  for(const s of surf||[]) L.push(s.startsWith('sol')?'Sol changé':'Murs changés');
  return L;
}

// ---------- rendus : liste, suivi, enregistrement ----------
let rendus=null;
export const lesRendus=()=>rendus||[];
export async function chargerRendus(){
  const tout=[]; let offset=null;
  do{ const r=await appel('rendu',{op:'liste',...(offset?{offset}:{})}); if(!r.ok) throw new Error(r.horsLigne?'Pas de connexion au serveur : les rendus ne peuvent pas être lus.':(r.erreur||'Lecture des rendus impossible'));
    tout.push(...(r.rendus||[])); offset=r.offset; }while(offset);
  rendus=tout.filter(r=>r.id); for(const r of rendus) if(r.etat==='attente'&&r.tache&&r.creePar===moi()) suivre(r);
  return rendus;
}
const annoncer=()=>dispatchEvent(new CustomEvent('rendus'));
export async function enregistrerRendu(r,champs){ const x=await appel('rendu',{op:'enregistrer',rendu:{id:r.id,...champs}}); if(x.ok){ Object.assign(r,champs); delete r.nouveau; annoncer(); } return x; }
export async function supprimerRendu(r){ const x=await appel('rendu',{op:'supprimer',id:r.id}); if(x.ok){ rendus=lesRendus().filter(q=>q!==r); annoncer(); } return x; }
// lance une tâche kie.ai (images, consigne) et la note dans l'historique (état « attente ») ; renvoie la ligne, ou {erreur}
export async function demarrerRendu({images,consigne:texte,ratio,titre,champs}){
  const r0=await n8nRendu({action:'demarrer',images,consigne:texte,ratio,titre:'Maison3D · '+titre});
  if(!r0.ok) return {erreur:(r0.horsLigne?'Pas de connexion : ':'')+(r0.erreur||'kie.ai a refusé le rendu')};
  const r={id:'rd'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),titre,consigne:texte,tache:r0.tache,etat:'attente',erreur:'',
    creePar:moi()||'',creeLe:new Date().toISOString(),vignette:'',image:null,...champs};
  const x=await appel('rendu',{op:'enregistrer',rendu:{...r,nouveau:true}});
  (rendus||(rendus=[])).unshift(r); annoncer();
  if(!x.ok) r.avertissement='rendu lancé, mais pas encore noté dans l’historique : '+(x.erreur||'erreur');
  return r;
}
const enSuivi=new Set();
// suit une tâche kie.ai jusqu'au résultat (8 min au plus), puis garde l'image (Fichiers) et sa vignette
export async function suivre(r,progres=()=>{}){
  if(enSuivi.has(r.id)) return; enSuivi.add(r.id);
  try{
    const t0=Date.now();
    while(Date.now()-t0<8*60000){
      await new Promise(ok=>setTimeout(ok,4000));
      const s=await n8nRendu({action:'suivre',tache:r.tache});
      if(!s.ok){ if(s.horsLigne) continue; await enregistrerRendu(r,{etat:'echec',erreur:String(s.erreur||'kie.ai a refusé').slice(0,190)}); return; }
      if(s.etat==='attente'){ progres(Math.round((Date.now()-t0)/1000)); continue; }
      if(s.etat==='echec'){ await enregistrerRendu(r,{etat:'echec',erreur:String(s.raison||'le rendu a échoué').slice(0,190)}); return; }
      const b=await (await fetch(s.image)).blob(), i=await charger(s.image);
      const e=await envoyerFichier(b,{nom:'rendu-'+r.id,type:'photo'});
      if(e.erreur){ await enregistrerRendu(r,{etat:'echec',erreur:'rendu reçu mais non gardé : '+e.erreur}); return; }
      const v=await reduire(s.image,320,false);
      await enregistrerRendu(r,{etat:'fini',erreur:'',image:{id:e.id,n:e.n,type:b.type||'image/jpeg',w:i.width,h:i.height},vignette:v}); return;
    }
    await enregistrerRendu(r,{etat:'echec',erreur:'pas de résultat après 8 minutes'});
  } finally { enSuivi.delete(r.id); }
}

// ---------- la fenêtre de confirmation ----------
let fen=null, prep=null;
function dire(t,erreur=false){ const m=fen.querySelector('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',erreur); }
function construire(){
  fen=el('div',{id:'rendu-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Rendu réaliste'});
  fen.innerHTML=`<div class="fenetre-carte rendu-carte">
    <div class="fenetre-tete"><h2>Rendu réaliste</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <p class="rendu-titre"></p>
    <div class="rendu-apercu"><img alt="Photo avec les changements dessinés"></div>
    <ul class="rendu-liste"></ul>
    <label class="rendu-precisions"><span>Précisions (facultatif)</span><textarea id="rendu-precisions" rows="2" maxlength="600" placeholder="ex. : lumière du soir, rideaux tirés…"></textarea></label>
    <p class="rendu-cout"></p>
    <p class="ph-message" role="status"></p>
    <div class="rendu-resultat" hidden><img alt="Rendu réaliste"></div>
    <div class="ph-boutons"><button type="button" class="btn primary" id="rendu-ok">Oui, lancer le rendu</button><button type="button" class="btn" id="rendu-non">Annuler</button></div></div>`;
  document.body.append(fen);
  fen.querySelector('.fermer').onclick=()=>fermer(); fen.querySelector('#rendu-non').onclick=()=>fermer();
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') fermer(); });
  fen.querySelector('#rendu-ok').onclick=lancer;
}
function fermer(){ if(fen) fen.hidden=true; prep=null; }
// ouvre la confirmation pour une photo calée : changements visibles, image composée, coût et solde
export async function preparerRendu(p){
  if(!fen) construire(); fen.hidden=false; prep=null;
  const q=s=>fen.querySelector(s), ok=q('#rendu-ok');
  q('.rendu-titre').textContent=`« ${p.nom} » · variante « ${varianteCourante()?.nom||'Actuel'} »`;
  q('.rendu-liste').replaceChildren(); q('.rendu-apercu img').removeAttribute('src'); q('.rendu-resultat').hidden=true; q('#rendu-precisions').value='';
  q('.rendu-cout').textContent=''; ok.disabled=true; ok.textContent='Oui, lancer le rendu'; q('#rendu-non').textContent='Annuler';
  if(!p.calage){ dire('Calez d’abord la maquette sur cette photo (« Caler la maquette »).',true); return; }
  dire('Préparation de l’image (changements dessinés sur la photo)…');
  try{
    const tout=changements(), ch=dansLaPhoto(p,tout), surf=surfaces(p.piece).map(m=>m.userData.surface);
    const composee=await composer(p,ch);
    const prods=await produits(ch);
    prep={p,ch,surf,composee,prods,hors:tout.length-ch.length};
    q('.rendu-apercu img').src=composee;
    const li=detailFrancais(ch,surf); for(const t of li.length?li:['Aucun changement visible sur cette photo : le rendu gardera la pièce telle quelle.']) q('.rendu-liste').append(el('li',{},t));
    if(prep.hors) q('.rendu-liste').append(el('li',{class:'hors'},`${prep.hors} autre${prep.hors>1?'s':''} changement${prep.hors>1?'s':''} hors du champ de cette photo`));
    dire('Vérifiez l’image : les meubles en 3D seront remplacés par de vrais meubles, le rouge sera effacé.');
    ok.disabled=false;
    const solde=await soldeKie();
    if(prep) q('.rendu-cout').textContent=`Coût : ${COUT} crédits kie.ai (≈ 0,09 $)`+(solde!=null?` · solde : ${Math.floor(solde).toLocaleString('fr-FR')} crédits`:'')+' · environ 1 minute';
    if(solde!=null&&solde<COUT){ ok.disabled=true; dire('Plus assez de crédits kie.ai : rechargez votre compte kie.ai.',true); }
  }catch(e){ dire('Préparation impossible : '+(e.message||e),true); }
}
async function lancer(){
  if(!prep) return; const {p,ch,surf,composee,prods}=prep, q=s=>fen.querySelector(s), ok=q('#rendu-ok');
  ok.disabled=true; dire('Envoi à kie.ai…');
  try{
    const precisions=q('#rendu-precisions').value.trim(), variante=varianteCourante()?.nom||'Actuel';
    const images=[await photoEnDataURL(p),composee,...prods.map(x=>x.image)];
    const r=await demarrerRendu({images,consigne:consigne(p.piece,ch,prods,precisions,surf),ratio:ratioDe(p.image.w,p.image.h),titre:`${p.nom} · ${variante}`,
      champs:{piece:p.piece,photo:p.id,avant:p.image,variante,mode:'maquette',detail:detailFrancais(ch,surf)}});
    if(!r.id){ dire(r.erreur,true); ok.disabled=false; return; }
    if(r.avertissement) dire(r.avertissement,true);
    q('#rendu-non').textContent='Fermer (le rendu continue)'; prep=null;
    dire('Rendu en cours chez kie.ai… (environ 1 minute ; vous pouvez fermer, il arrivera dans l’historique des rendus)');
    await suivre(r,s=>{ if(!fen.hidden) dire(`Rendu en cours chez kie.ai… ${s} s`); });
    if(r.etat==='fini'){ const u=await imageRendu(r); if(u){ q('.rendu-resultat img').src=u; q('.rendu-resultat').hidden=false; q('.rendu-apercu').hidden=true; }
      dire('Rendu prêt : il est dans l’historique des rendus de la pièce (bouton « Photos », « Rendus »).'); q('#rendu-non').textContent='Fermer'; }
    else dire('Le rendu a échoué : '+(r.erreur||'raison inconnue'),true);
  }catch(e){ dire('Rendu impossible : '+(e.message||e),true); ok.disabled=false; }
  finally{ q('.rendu-apercu').hidden=false; }
}
// l'image d'un rendu fini (adresse d'objet, lue une fois par appareil)
const adresses=new Map();
export function imageRendu(r){
  if(!r.image?.id) return Promise.resolve(null); const id=r.image.id;
  if(!adresses.has(id)) adresses.set(id,lireFichier(id,r.image.n||1,r.image.type||'image/jpeg').then(b=>{ if(!b){ adresses.delete(id); return null; } return URL.createObjectURL(b); }));
  return adresses.get(id);
}
export function imageAvant(r){
  if(!r.avant?.id) return Promise.resolve(null); const id=r.avant.id;
  if(!adresses.has(id)) adresses.set(id,lireFichier(id,r.avant.n||1,r.avant.type||'image/jpeg').then(b=>{ if(!b){ adresses.delete(id); return null; } return URL.createObjectURL(b); }));
  return adresses.get(id);
}
