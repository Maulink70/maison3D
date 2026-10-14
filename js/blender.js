// « Créer avec Blender » (14 octobre 2026, demande de Mauro : « beaucoup plus efficace avec Blender et Claude Code que
// Tripo », « je dois pouvoir créer comme sur Tripo : à partir de zéro, d'une image… ») : l'application dépose une demande
// dans la file d'attente du workflow n8n « Maison3D Blender » ; le programme « pont Blender » du PC de Mauro
// (outils/pont_blender/, Blender ouvert avec Blender MCP) la prend, lance Claude Code, envoie l'avancement puis le modèle
// (.glb, table Fichiers) ; l'application le suit et ouvre la fenêtre « Fichier 3D » pour l'ajouter (dimensions, allègement).
// Quatre façons : à partir de zéro (description), d'après une ou plusieurs images (photo, produit, image de l'IA), d'après
// un produit de la liste « Produits », ou modifier un objet (son fichier, ou l'image d'un meuble de la maquette) : le
// résultat prend alors sa place (l'ancien est masqué). PC éteint : la demande attend qu'il soit allumé. Rien à payer.
// Ouvert par le menu « + », le panneau photo, « Créer avec l'IA », la liste « Produits », l'onglet « Plus » de l'objet et
// l'assistant. Demandes de cet appareil gardées (clé maison3d-blender) : suivies même page rechargée.
import * as THREE from 'three';
import {app, $} from './app.js';
import {connecte} from './api.js';
import {envoyerFichier, lireFichier} from './fichiers.js';
import {importerModele} from './import3d.js';
import {setEdition} from './vues.js';
import {ETAGE_FLOOR} from './config.js';
import {solSous} from './visite.js';
import {imageMeuble} from './impression.js';

const URL_B='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d-blender', CLE='maison3d-blender', CLE_CHOIX='maison3d-blender-choix';
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) if(v!=null) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const jeton=()=>{ try{ return JSON.parse(localStorage.getItem('maison3d-compte')||'null')?.jeton||''; }catch{ return ''; } };
const cm=v=>Math.round(v*1000)/10;
const duree=s=>{ s=Math.max(0,Math.round(s)); return s<60?s+' s':s<3600?Math.floor(s/60)+' min '+String(s%60).padStart(2,'0'):Math.floor(s/3600)+' h '+String(Math.floor(s%3600/60)).padStart(2,'0'); };
const ilYa=s=>s<90?'à l’instant':s<3600?'il y a '+Math.round(s/60)+' min':s<86400?'il y a '+Math.round(s/3600)+' h':'il y a '+Math.round(s/86400)+' j';

let fen=null, mode='zero', images=[], objet=null, ctx={}, serveur={pcs:[],demandes:[],recu:0,ecart:0}, minuterie=0, envoiEnCours=false, aSuppr=null;
const apercus=new Map();   // id du fichier d'aperçu → adresse d'objet

// ---------- demandes de cet appareil (où poser le résultat, quoi remplacer, de quoi renvoyer une demande perdue) ----------
function local(){ try{ const o=JSON.parse(localStorage.getItem(CLE)||'{}'); return o&&o.d?o:{d:{}}; }catch{ return {d:{}}; } }
function garder(o){ const l=Object.entries(o.d).sort((a,b)=>b[1].cree-a[1].cree).slice(0,40); try{ localStorage.setItem(CLE,JSON.stringify({d:Object.fromEntries(l)})); }catch{} }

async function poster(corps){
  try{ const r=await fetch(URL_B,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...corps,jeton:jeton()}),cache:'no-store'});
    if(r.status===404) return {ok:false,erreur:'Le pont Blender n’est pas encore branché sur le serveur.'};
    return await r.json(); }
  catch{ return {ok:false,horsLigne:true,erreur:'Pas de connexion au serveur : réessayez quand le réseau revient.'}; }
}

// ---------- état du PC ----------
function etatPC(){
  const p=serveur.pcs[0], vieux=serveur.recu?(Date.now()-serveur.recu)/1000:0;
  if(!p) return {cle:'jamais',texte:'Le pont Blender n’a encore jamais été lancé sur le PC : les demandes attendront qu’il le soit.'};
  const s=p.ilya+vieux;
  if(s<100) return p.occupe?{cle:'occupe',texte:`${p.nom} : allumé, Blender travaille sur une demande.`}:{cle:'pret',texte:`${p.nom} : allumé et prêt (Blender).`};
  return {cle:'eteint',texte:`${p.nom} : éteint ou pont arrêté (vu ${ilYa(s)}). La demande attendra qu’il soit rallumé avec Blender ouvert.`};
}

// ---------- suivi : toutes les 5 s quand une demande de cet appareil est en cours, 20 s fenêtre ouverte ----------
async function rafraichir(){
  clearTimeout(minuterie); minuterie=0;
  if(!connecte()) return;
  const r=await poster({action:'etat'});
  if(r.ok){ serveur={pcs:r.pcs||[],demandes:r.demandes||[],recu:Date.now(),ecart:(r.maintenant||Date.now())-Date.now()}; await suivreLocales(); }
  majFenetre(); majBandeau();
  const o=local(), actives=Object.entries(o.d).some(([id,l])=>{ const d=serveur.demandes.find(x=>x.id===id); return !l.importe&&!l.oublie&&(!d||['attente','en_cours'].includes(d.etat)); });
  const ms=actives?5000:fen&&!fen.hidden?20000:0;
  if(ms) minuterie=setTimeout(rafraichir,ms);
}
async function suivreLocales(){
  const o=local(); let change=false;
  for(const [id,l] of Object.entries(o.d)){
    if(l.importe||l.oublie) continue;
    const d=serveur.demandes.find(x=>x.id===id);
    // demande absente du serveur (deux écritures en même temps) : renvoyée, pendant 30 min au plus
    if(!d){ if(l.payload&&Date.now()-l.cree<1800000&&Date.now()-(l.renvoi||0)>12000){ l.renvoi=Date.now(); change=true; await poster({action:'creer',...l.payload}); } continue; }
    if(d.etat==='fini'&&!l.annonce){ l.annonce=true; change=true;
      // ouvert tout de suite si l'on est en Éditer et qu'aucune autre fenêtre n'est ouverte ; sinon le bandeau le propose
      const autre=[...document.querySelectorAll('.fenetre')].some(f=>!f.hidden&&f!==fen);
      if(app.edition&&app.mobilierPret&&!autre){ garder(o); await ouvrirResultat(d); return; } }
    if(d.etat==='echec'&&!l.annonceEchec){ l.annonceEchec=true; change=true; }
  }
  if(change) garder(o);
}

// ---------- résultat : fenêtre « Fichier 3D » (dimensions, allègement, « Ajouter ») ----------
export async function ouvrirResultat(d){
  if(typeof d==='string') d=serveur.demandes.find(x=>x.id===d); if(!d?.resultat?.fic) return;
  if(!app.mobilierPret){ dire('La maquette se charge encore : réessayez dans un instant.',true); return; }
  if(!app.edition) setEdition(true);
  if(!app.edition){ ouvrirBlender(true); dire('Pour l’ajouter, passez en « Éditer » dans une variante modifiable (une base ne se modifie pas : « Créer » une copie dans le menu des variantes), puis « Ajouter à la maquette » ici.',true); return; }
  const o=local(), l=o.d[d.id]||(o.d[d.id]={cree:d.cree});
  if(fen&&!fen.hidden) dire('Lecture du modèle…');
  const blob=await lireFichier(d.resultat.fic.id,d.resultat.fic.n||1,'model/gltf-binary');
  if(!blob){ ouvrirBlender(true); dire('Le modèle n’a pas pu être lu : réessayez « Ajouter à la maquette ».',true); return; }
  // remplacer : place, orientation et hauteur de pose de l'ancien, qui est masqué au même enregistrement
  let place=l.place||d.place||null, plus={};
  const anc=l.remplace&&app.items[l.remplace];
  if(anc&&!anc.hidden){ const niv=anc.lvl==='Étage'?'etage':'rez', base=niv==='etage'?ETAGE_FLOOR:0, x=anc.g.position.x, z=anc.g.position.z;
    const sol=solSous(new THREE.Vector3(x,base,z))??base, pose=anc.g.position.y-sol;
    place={x,z,r:anc.g.rotation.y,niv}; plus={masquer:[anc.name],pose:pose>0.02?+pose.toFixed(3):0}; }
  l.importe=true; garder(o); ouvrirBlender(false); majBandeau();
  const r=d.resultat, notes=r.notes?' Note de Blender : '+r.notes:'';
  await importerModele(new File([blob],'blender.glb',{type:'model/gltf-binary'}),{nom:d.nom,place,plus,origine:l.origine||null,
    message:`Modèle fait dans Blender sur le PC${r.duree?' (en '+duree(r.duree)+')':''}.${notes} Vérifiez les dimensions (cm), puis « Ajouter »`+(anc?` : il prendra la place de « ${anc.meta.l} », qui sera masqué.`:'.')});
}

// ---------- fenêtre ----------
const q=s=>fen.querySelector(s);
function dire(t,err=false){ if(!fen) return; const m=q('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',err); }
function construire(){
  fen=el('div',{id:'blender-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Créer avec Blender'});
  fen.innerHTML=`<div class="fenetre-carte">
    <div class="fenetre-tete"><h2>Créer avec Blender</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <p class="bl-pc" data-etat="jamais" role="status"><span class="bl-pastille" aria-hidden="true"></span><span class="bl-pc-texte"></span></p>
    <p class="mat-aide">Claude Code modélise l’objet dans Blender, sur le PC (quelques minutes, sans crédits). Quand il est prêt, la fenêtre « Fichier 3D » s’ouvre pour l’ajouter.</p>
    <div class="bl-modes seg" role="group" aria-label="Point de départ">
      <button type="button" data-mode="zero" aria-pressed="true">À partir de zéro</button>
      <button type="button" data-mode="images" aria-pressed="false">D’après des images</button>
      <button type="button" data-mode="modifier" aria-pressed="false">Modifier un objet</button>
    </div>
    <div class="bl-bloc bl-images" hidden>
      <div class="bl-vignettes"></div>
      <div class="ph-boutons petits"><button type="button" class="btn" id="bl-coller">Coller l’image</button>
        <label class="btn">Choisir des images<input type="file" accept="image/*" multiple id="bl-fichiers" hidden></label>
        <button type="button" class="btn" id="bl-produits" aria-expanded="false">Mes produits…</button></div>
      <p class="mat-aide">Jusqu’à 4 images (plusieurs vues du même objet, c’est mieux). Ctrl+V et glisser-déposer marchent aussi.</p>
      <div class="bl-produits" hidden></div>
    </div>
    <div class="bl-bloc bl-objet" hidden>
      <label class="dimrow bl-choix-objet"><span>Objet</span><select id="bl-objet"></select></label>
      <p class="mat-aide bl-objet-info"></p>
    </div>
    <label class="cr-champ"><span class="bl-desc-titre">Décrivez l’objet</span><textarea id="bl-desc" rows="4" maxlength="3000"></textarea></label>
    <label class="dimrow"><span>Nom</span><input type="text" id="bl-nom" maxlength="60" placeholder="Fauteuil, lampe…"></label>
    <div class="bl-dims">
      <label class="dimrow"><span>Largeur</span><input type="number" id="bl-l" min="1" max="2000" step="0.5"><span class="unite">cm</span></label>
      <label class="dimrow"><span>Profondeur</span><input type="number" id="bl-p" min="1" max="2000" step="0.5"><span class="unite">cm</span></label>
      <label class="dimrow"><span>Hauteur</span><input type="number" id="bl-h" min="1" max="2000" step="0.5"><span class="unite">cm</span></label>
    </div>
    <fieldset class="ph-textures"><legend>Niveau de détail</legend>
      <label><input type="radio" name="bl-detail" value="simple"><span><strong>Simple</strong> : les formes principales · quelques minutes</span></label>
      <label><input type="radio" name="bl-detail" value="normal" checked><span><strong>Normal</strong> : comme les meubles de la base « Réalisme »</span></label>
      <label><input type="radio" name="bl-detail" value="detaille"><span><strong>Très détaillé</strong> : poignées, chanfreins, coutures · plus long</span></label>
    </fieldset>
    <label class="crans"><input type="checkbox" id="bl-textures" checked> Vraies matières (bois veiné, tissu, métal brossé), sinon couleurs unies</label>
    <button type="button" class="btn primary wide" id="bl-envoyer">Envoyer à Blender</button>
    <p class="ph-message" role="status"></p>
    <h3 class="bl-titre-liste">Demandes à Blender</h3>
    <ul class="bl-liste"></ul>
  </div>`;
  document.body.append(fen);
  q('.fermer').onclick=()=>ouvrirBlender(false);
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') ouvrirBlender(false); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen) ouvrirBlender(false); });
  for(const b of fen.querySelectorAll('.bl-modes button')) b.onclick=()=>choisirMode(b.dataset.mode);
  q('#bl-fichiers').onchange=e=>{ for(const f of [...(e.target.files||[])]) ajouterImage({blob:f,nom:f.name}); e.target.value=''; };
  q('#bl-coller').onclick=coller;
  q('#bl-produits').onclick=mesProduits;
  fen.addEventListener('paste',e=>{ const f=[...(e.clipboardData?.files||[])].find(x=>/^image\//.test(x.type)); if(f){ e.preventDefault(); ajouterImage({blob:f,nom:'image collée'}); } });
  fen.addEventListener('dragover',e=>e.preventDefault());
  fen.addEventListener('drop',e=>{ e.preventDefault(); for(const f of [...(e.dataTransfer?.files||[])].filter(x=>/^image\//.test(x.type))) ajouterImage({blob:f,nom:f.name}); });
  q('#bl-objet').onchange=()=>{ const it=app.items[q('#bl-objet').value]; objet=it?objetDe(it):null; majObjet(); };
  q('#bl-envoyer').onclick=envoyer;
  for(const i of fen.querySelectorAll('input[type=text],input[type=number],textarea')) i.addEventListener('keydown',e=>e.stopPropagation());
  q('.bl-liste').addEventListener('click',e=>{ const b=e.target.closest('button[data-a]'); if(b) agir(b.dataset.a,b.closest('li').dataset.id); });
  try{ const c=JSON.parse(localStorage.getItem(CLE_CHOIX)||'{}'); if(c.detail) (fen.querySelector(`input[name="bl-detail"][value="${c.detail}"]`)||{}).checked=true; if(c.textures===false) q('#bl-textures').checked=false; }catch{}
}
function choisirMode(m){
  mode=m; for(const b of fen.querySelectorAll('.bl-modes button')) b.setAttribute('aria-pressed',String(b.dataset.mode===m));
  q('.bl-images').hidden=m!=='images'; q('.bl-objet').hidden=m!=='modifier';
  q('.bl-desc-titre').textContent=m==='zero'?'Décrivez l’objet (forme, matières, couleurs, style)':m==='images'?'Précisions (facultatif) : ce qui compte, ce qu’il faut changer':'Ce qu’il faut changer';
  q('#bl-desc').placeholder=m==='zero'?'ex. : fauteuil club en cuir cognac, accoudoirs ronds, pieds en noyer':m==='images'?'ex. : le même en chêne clair, sans le coussin':'ex. : pieds plus fins en laiton, plateau en marbre blanc';
  q('.bl-dims').hidden=false;
  if(m==='modifier') remplirObjets();
}
const objetDe=it=>({name:it.name,nom:it.meta.l,fic:it.ajout?.t==='glb'?it.ajout.fic:null,dims:{L:cm(it.size.x),P:cm(it.size.z),H:cm(it.size.y)}});
function remplirObjets(){
  const s=q('#bl-objet'); s.replaceChildren();
  const items=Object.values(app.items||{}).filter(it=>!it.hidden&&it.meta.c!=='fixe').sort((a,b)=>a.meta.l.localeCompare(b.meta.l,'fr'));
  const g1=el('optgroup',{label:'Objets 3D ajoutés (Blender, Tripo, catalogue…)'}), g2=el('optgroup',{label:'Meubles de la maquette (refaits d’après leur image)'});
  for(const it of items) (it.ajout?.t==='glb'?g1:g2).append(el('option',{value:it.name},it.meta.l));
  if(g1.children.length) s.append(g1); if(g2.children.length) s.append(g2);
  if(objet&&app.items[objet.name]) s.value=objet.name; else { objet=s.value?objetDe(app.items[s.value]):null; }
  majObjet();
}
function majObjet(){
  const i=q('.bl-objet-info'); if(!objet){ i.textContent='Aucun objet.'; return; }
  i.textContent=(objet.fic?'Blender reçoit son fichier 3D et le modifie.':'Blender reçoit son image (vue de la maquette) et le refait en vrai modèle.')+` Taille actuelle : ${objet.dims.L} × ${objet.dims.P} × ${objet.dims.H} cm. Le résultat prendra sa place (l’ancien sera masqué).`;
  if(!q('#bl-nom').value) q('#bl-nom').value=objet.nom.slice(0,60);
}
function ajouterImage(i){
  if(images.length>=4){ dire('4 images au plus.',true); return; }
  if(!i.url) i.url=i.blob?URL.createObjectURL(i.blob):i.vignette||'';
  images.push(i); if(mode!=='images') choisirMode('images'); majImages();
}
function majImages(){
  const v=q('.bl-vignettes'); v.replaceChildren();
  images.forEach((i,k)=>{ const f=el('figure',{class:'bl-vignette'}), im=el('img',{alt:i.nom||'image '+(k+1)}); im.src=i.url||''; const x=el('button',{type:'button',class:'btn','aria-label':'Retirer cette image'},'×');
    x.onclick=()=>{ images.splice(k,1); majImages(); }; f.append(im,x); v.append(f); });
  if(!images.length) v.append(el('p',{class:'mat-aide'},'Aucune image pour l’instant.'));
}
async function coller(){
  try{ for(const it of await navigator.clipboard.read()){ const t=it.types.find(x=>/^image\//.test(x)); if(t){ ajouterImage({blob:await it.getType(t),nom:'image collée'}); return; } }
    dire('Le presse-papiers ne contient pas d’image.',true); }
  catch{ dire('Collez avec Ctrl+V dans cette fenêtre (le navigateur refuse la lecture du presse-papiers).',true); }
}
async function mesProduits(){
  const b=q('#bl-produits'), box=q('.bl-produits'), ouvert=b.getAttribute('aria-expanded')==='true';
  b.setAttribute('aria-expanded',String(!ouvert)); box.hidden=ouvert; if(ouvert) return;
  box.replaceChildren(el('p',{class:'mat-aide'},'Lecture de la liste « Produits »…'));
  const {chargerProduits}=await import('./produits.js'), l=(await chargerProduits()).filter(p=>p.image?.id);
  box.replaceChildren(); if(!l.length){ box.append(el('p',{class:'mat-aide'},'Aucun produit avec une image dans la liste « Produits ».')); return; }
  for(const p of l){ const c=el('button',{type:'button',class:'bl-produit'}), im=el('img',{alt:''}); if(p.vignette) im.src=p.vignette; c.append(im,el('span',{},p.nom||'Produit'));
    c.onclick=()=>{ prendreProduit(p); b.setAttribute('aria-expanded','false'); box.hidden=true; }; box.append(c); }
}
function prendreProduit(p){
  ajouterImage({fic:{id:p.image.id,n:p.image.n||1,type:p.image.type||'image/jpeg'},vignette:p.vignette,nom:p.nom});
  if(!q('#bl-nom').value) q('#bl-nom').value=String(p.nom||'').slice(0,60);
  for(const [k,i] of [['L','#bl-l'],['P','#bl-p'],['H','#bl-h']]) if(p[k]&&!q(i).value) q(i).value=String(p[k]);
  ctx.origine={produit:true,site:p.boutique||'boutique',titre:String(p.nom||'Produit').slice(0,80),lien:p.lien||''}; ctx.lien=p.lien||''; ctx.site=p.boutique||'';
}
// image envoyée à Blender : 1600 px au plus (PNG si elle a de la transparence, JPEG sinon)
async function reduire(blob){
  try{ const b=await createImageBitmap(blob), k=Math.min(1,1600/Math.max(b.width,b.height)), c=document.createElement('canvas');
    c.width=Math.round(b.width*k); c.height=Math.round(b.height*k); c.getContext('2d').drawImage(b,0,0,c.width,c.height);
    const png=blob.type==='image/png'; return await new Promise(ok=>c.toBlob(ok,png?'image/png':'image/jpeg',0.9)); }
  catch{ return blob; }
}
const cmDe=i=>{ const v=Number(String(q(i).value).replace(',','.')); return Number.isFinite(v)&&v>0&&v<2000?Math.round(v*10)/10:null; };
async function envoyer(){
  if(envoiEnCours) return;
  if(!connecte()){ dire('Connectez-vous d’abord.',true); return; }
  const desc=q('#bl-desc').value.trim(), nom=(q('#bl-nom').value.trim()||(objet&&mode==='modifier'?objet.nom:'')||desc.split(/[,.;:]/)[0]||'Objet').slice(0,60);
  if(mode==='zero'&&desc.length<3){ dire('Décrivez l’objet (quelques mots suffisent).',true); q('#bl-desc').focus(); return; }
  if(mode==='images'&&!images.length){ dire('Ajoutez au moins une image.',true); return; }
  if(mode==='modifier'&&!objet){ dire('Choisissez l’objet à modifier.',true); return; }
  if(mode==='modifier'&&desc.length<3){ dire('Dites ce qu’il faut changer.',true); q('#bl-desc').focus(); return; }
  const detail=fen.querySelector('input[name="bl-detail"]:checked')?.value||'normal', textures=q('#bl-textures').checked;
  try{ localStorage.setItem(CLE_CHOIX,JSON.stringify({detail,textures})); }catch{}
  envoiEnCours=true; const b=q('#bl-envoyer'); b.disabled=true;
  try{
    const fics=[];
    if(mode==='images') for(const [k,i] of images.entries()){
      if(i.fic){ fics.push(i.fic); continue; }
      dire(`Envoi de l’image ${k+1} sur ${images.length}…`);
      const bl=await reduire(i.blob), r=await envoyerFichier(bl,{nom:'blender '+nom+' '+(k+1),type:'photo'});
      if(r.erreur){ dire(r.erreur,true); return; } fics.push({id:r.id,n:r.n,type:bl.type}); }
    let source=null;
    if(mode==='modifier'){
      const it=app.items[objet.name]; source={nom:objet.nom,element:objet.name,dims:objet.dims};
      if(objet.fic) source.fic=objet.fic;
      else { dire('Image de l’objet…'); const im=await imageMeuble(it), bl=await (await fetch(im.url)).blob(), r=await envoyerFichier(bl,{nom:'blender '+objet.nom,type:'photo'});
        if(r.erreur){ dire(r.erreur,true); return; } source.image={id:r.id,n:r.n,type:bl.type}; }
    }
    const id='bl'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    const payload={id,type:mode==='modifier'?'modifier':'creer',nom,description:desc,L:cmDe('#bl-l'),P:cmDe('#bl-p'),H:cmDe('#bl-h'),detail,textures,images:fics,
      lien:ctx.lien||'',site:ctx.site||'',source,place:ctx.place||null};
    dire('Envoi de la demande…');
    const r=await poster({action:'creer',...payload});
    if(!r.ok){ dire(r.erreur||'Demande refusée.',true); return; }
    const o=local(); o.d[id]={cree:Date.now(),nom,place:ctx.place||null,remplace:mode==='modifier'?objet.name:(ctx.remplace||null),origine:ctx.origine||null,payload};
    garder(o);
    if(r.pcs) serveur.pcs=r.pcs;
    const pc=etatPC();
    dire(`Demande envoyée : « ${nom} ». `+(pc.cle==='pret'?'Le PC la prend tout de suite.':pc.cle==='occupe'?'Le PC la fera après la demande en cours.':'Elle attend que le PC soit allumé avec le pont Blender.')+' Vous pouvez fermer cette fenêtre : le modèle s’ouvrira quand il sera prêt.');
    images=[]; ctx={}; objet=null; q('#bl-desc').value=''; q('#bl-nom').value=''; for(const i of ['#bl-l','#bl-p','#bl-h']) q(i).value='';
    choisirMode('zero'); majImages();
    dispatchEvent(new CustomEvent('blender-demande',{detail:{id,nom}}));
    await rafraichir();
  } finally { envoiEnCours=false; b.disabled=false; }
}

// ---------- liste des demandes ----------
const ETATS={attente:'en attente',en_cours:'Blender y travaille',fini:'prêt',echec:'échec',annule:'annulée'};
function texteEtat(d){
  const t=(Date.now()+serveur.ecart)/1000;
  if(d.etat==='attente') return 'En attente'+(d.position?` (${d.position+1}e dans la file)`:'')+' · '+(etatPC().cle==='pret'?'le PC va la prendre':etatPC().cle==='occupe'?'après la demande en cours':'PC éteint ou pont arrêté');
  if(d.etat==='en_cours') return `Blender y travaille · ${d.p||0} % · ${duree(t-(d.pris||d.cree)/1000)}`;
  if(d.etat==='fini') return 'Prêt'+(d.resultat?.duree?' en '+duree(d.resultat.duree):'')+(d.resultat?.taille?' · '+Math.round(d.resultat.taille/1024).toLocaleString('fr-FR')+' Ko':'');
  if(d.etat==='echec') return 'Échec : '+(d.erreur||'erreur inconnue');
  return 'Annulée';
}
function majFenetre(){
  if(!fen) return;
  const pc=etatPC(), p=q('.bl-pc'); p.dataset.etat=pc.cle; q('.bl-pc-texte').textContent=pc.texte;
  const ul=q('.bl-liste'), o=local(), l=serveur.demandes;
  ul.replaceChildren(); q('.bl-titre-liste').hidden=!l.length;
  for(const d of l){
    const li=el('li',{'data-id':d.id,'data-etat':d.etat}), im=el('span',{class:'bl-apercu','aria-hidden':'true'});
    const a=d.resultat?.apercu; if(a){ const u=apercus.get(a.id); if(u){ const i=el('img',{alt:''}); i.src=u; im.append(i); } else lireApercu(a); } else im.textContent=d.etat==='fini'?'🧊':'⋯';
    const txt=el('span',{class:'bl-txt'});
    txt.append(el('strong',{},d.nom+(d.type==='modifier'?' (modification)':'')),el('span',{class:'mat-aide'},texteEtat(d)+(d.qui?' · '+d.qui:'')));
    if(d.etat==='en_cours'&&d.texte) txt.append(el('span',{class:'mat-aide bl-note'},d.texte));
    if(d.etat==='en_cours'){ const br=el('span',{class:'ph-barre','aria-hidden':'true'}); const i=el('i'); i.style.width=(d.p||0)+'%'; br.append(i); txt.append(br); }
    if(d.etat==='fini'&&d.resultat?.notes) txt.append(el('span',{class:'mat-aide bl-note'},d.resultat.notes));
    const bt=el('span',{class:'bl-actions'}), b=(t,act,prim)=>bt.append(el('button',{type:'button',class:'btn'+(prim?' primary':''),'data-a':act},t));
    if(d.etat==='fini') b(o.d[d.id]?.importe?'Rouvrir':'Ajouter à la maquette','ajouter',!o.d[d.id]?.importe);
    if(['attente','en_cours'].includes(d.etat)) b('Annuler','annuler');
    if(['echec','annule'].includes(d.etat)) b('Relancer','relancer');
    if(d.etat!=='en_cours') bt.append(el('button',{type:'button',class:'btn danger','data-a':'suppr','aria-label':'Retirer « '+d.nom+' » de la liste'},aSuppr===d.id?'Retirer ?':'×'));
    li.append(im,txt,bt); ul.append(li);
  }
}
async function lireApercu(a){ if(apercus.has(a.id)) return; apercus.set(a.id,''); const b=await lireFichier(a.id,a.n||1,a.type||'image/png'); if(b){ apercus.set(a.id,URL.createObjectURL(b)); majFenetre(); } else apercus.delete(a.id); }
async function agir(a,id){
  const d=serveur.demandes.find(x=>x.id===id); if(!d) return;
  if(a==='ajouter') return ouvrirResultat(d);
  if(a==='suppr'&&aSuppr!==id){ aSuppr=id; majFenetre(); setTimeout(()=>{ if(aSuppr===id){ aSuppr=null; majFenetre(); } },4000); return; }
  aSuppr=null;
  const r=await poster({action:a==='suppr'?'supprimer':a,id});
  if(!r.ok){ dire(r.erreur||'Impossible pour le moment.',true); return; }
  const o=local();
  if(a==='relancer'&&o.d[id]){ Object.assign(o.d[id],{importe:false,annonce:false,annonceEchec:false,oublie:false}); garder(o); }
  if(a==='suppr'||a==='annuler'){ if(o.d[id]){ o.d[id].oublie=true; garder(o); } }
  dire(a==='annuler'?`« ${d.nom} » : demande annulée.`:a==='relancer'?`« ${d.nom} » : demande relancée.`:'');
  rafraichir();
}

// ---------- bandeau sous la barre (fenêtre fermée) et assistant ----------
function aSuivre(){
  const o=local(), l=serveur.demandes.filter(d=>{ const x=o.d[d.id]; return x&&!x.oublie&&!x.importe; });
  return l.find(d=>d.etat==='en_cours')||l.find(d=>d.etat==='attente')||l.find(d=>d.etat==='fini')||l.find(d=>d.etat==='echec'&&!o.d[d.id].vuEchec)||null;
}
function majBandeau(){
  let bd=$('bandeau-blender');
  if(!bd){ bd=el('div',{id:'bandeau-blender',hidden:''});
    bd.innerHTML='<span class="bt-texte" role="status"></span><span class="ph-barre" aria-hidden="true"><i></i></span><span class="bt-temps"></span><span class="actions"><button type="button" class="btn primary" id="bandeau-blender-ajouter" hidden>Ajouter</button><button type="button" class="btn" id="bandeau-blender-voir">Voir</button></span>';
    ($('bandeaux')||document.body).append(bd);
    bd.querySelector('#bandeau-blender-voir').onclick=()=>{ const d=aSuivre(); if(d?.etat==='echec'){ const o=local(); o.d[d.id].vuEchec=true; garder(o); } ouvrirBlender(true); };
    bd.querySelector('#bandeau-blender-ajouter').onclick=()=>{ const d=aSuivre(); if(d) ouvrirResultat(d); }; }
  const d=aSuivre(), ouvert=fen&&!fen.hidden;
  bd.hidden=!d||ouvert;
  const phase=d?{attente:'attente',en_cours:'creation',fini:'pret',echec:'echec'}[d.etat]:'';
  const titre=!d?'':d.etat==='attente'?`« ${d.nom} » : en attente du PC (Blender)`:d.etat==='en_cours'?`Blender modélise « ${d.nom} » · ${d.p||0} %`:d.etat==='fini'?`« ${d.nom} » est prêt (Blender)`:`« ${d.nom} » : échec de Blender`;
  const temps=d?.etat==='en_cours'?duree((Date.now()+serveur.ecart-(d.pris||d.cree))/1000):d?.etat==='attente'?etatPC().cle==='eteint'||etatPC().cle==='jamais'?'PC éteint':'':'';
  if(d){ bd.querySelector('.bt-texte').textContent=titre; bd.querySelector('.bt-temps').textContent=temps;
    const br=bd.querySelector('.ph-barre'); br.hidden=!['attente','en_cours'].includes(d.etat); br.querySelector('i').style.width=(d.etat==='en_cours'?d.p||0:0)+'%'; br.classList.toggle('indetermine',d.etat==='attente');
    bd.querySelector('#bandeau-blender-ajouter').hidden=d.etat!=='fini'; }
  dispatchEvent(new CustomEvent('blender-progres',{detail:{actif:!!d&&['attente','en_cours'].includes(d.etat),phase,nom:d?.nom||'',p:d?.etat==='fini'?100:d?.p||0,titre,temps,id:d?.id||null,erreur:d?.erreur||''}}));
}

// ---------- ouverture ----------
// o : {description, nom, dims:{L,P,H}, images:[Blob|{fic}], produit, modifier: élément, place, remplace, origine, lien, site}
export function ouvrirBlender(oui=true,o=null){
  if(oui&&!fen) construire(); if(!fen) return;
  fen.hidden=!oui;
  if(!oui){ majBandeau(); return; }
  if(o){
    images=[]; ctx={place:o.place||null,remplace:o.remplace||null,origine:o.origine||null,lien:o.lien||o.origine?.lien||'',site:o.site||o.origine?.site||''};
    q('#bl-desc').value=o.description||''; q('#bl-nom').value=String(o.nom||'').slice(0,60);
    for(const [k,i] of [['L','#bl-l'],['P','#bl-p'],['H','#bl-h']]) q(i).value=o.dims?.[k]?String(o.dims[k]):'';
    if(o.modifier){ objet=objetDe(o.modifier); choisirMode('modifier'); }
    else { objet=null; choisirMode('zero');
      for(const b of o.images||[]) ajouterImage(b instanceof Blob?{blob:b,nom:o.nom||'image'}:b);
      if(o.produit) prendreProduit(o.produit); }
    majImages(); dire('');
  } else if(!images.length) majImages();
  majFenetre(); rafraichir();
  setTimeout(()=>q('#bl-desc').focus());
}
export const blenderOuvert=()=>!!fen&&!fen.hidden;
export const _etatBlender=()=>({serveur,local:local()});
export function initBlender(){
  // au chargement : les demandes de cet appareil encore en cours (ou prêtes, pas encore ajoutées) sont reprises
  const depart=()=>{ if(!app.mobilierPret) return setTimeout(depart,1000); const o=local(); if(Object.values(o.d).some(l=>!l.importe&&!l.oublie)) rafraichir(); };
  depart();
  addEventListener('edition',()=>{ if(app.edition&&Object.values(local().d).some(l=>!l.importe&&!l.oublie)) rafraichir(); });
}
