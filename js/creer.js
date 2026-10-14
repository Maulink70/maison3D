// « Créer avec l'IA » (12 octobre 2026, demande de Mauro) : on décrit un meuble ou un objet, l'IA de kie.ai en dessine
// de 1 à 4 propositions sur fond blanc (workflow n8n « Maison3D Rendu », action creer : modèles de outils/n8n/creer_modeles.js,
// reçus avec le solde ; 40 créations par jour au plus). Modèle et nombre choisis dès la première étape, coût et solde affichés :
// le bouton « Créer » est la confirmation (crédits). On choisit ensuite une proposition :
//  - « Image plate » (par défaut, gratuit) : fond blanc retiré, objet à plat posé dans la maquette (panneau photo) ;
//  - « Vraie 3D » : panneau photo rempli, « Mettre en 3D (Tripo) » (confirmation des crédits Tripo) ;
//  - « L'essayer sur une photo » : montage avec l'objet posé sur une photo de la pièce (bonus accepté par Mauro).
// Ouvert depuis le menu « + », le montage (« Ajouter un produit précis » → l'objet est posé sur la photo) et l'assistant.
// L'IA dessine n'importe quel sujet (meuble, lampe, plante, animal, vélo…) : tout dépend de la description. « ✨ Améliorer »
// (comme dans Familia, demandé par Mauro) la réécrit en une description riche, en anglais, par le modèle de texte de kie.ai
// (workflow « Maison3D Assistant », action ameliorer, ≈ 0,05 crédit) ; « ↶ Mon texte » rend le texte d'avant.
import {app} from './app.js';
import {n8nRendu} from './rendu.js';

const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const CLE='maison3d-modele-creer';
const PAR_DEFAUT=[{id:'nano-banana-pro',nom:'Nano Banana Pro',cout:18,note:''}];
let fen=null, modeles=null, solde=null, opts={}, propositions=[], choisie=null, enCours=false, nombre=1, avant=null;
const ASSISTANT='https://n8n.srv1123557.hstgr.cloud/webhook/maison3d-assistant';
const jeton=()=>{ try{ return JSON.parse(localStorage.getItem('maison3d-compte')||'null')?.jeton||''; }catch{ return ''; } };

export const modelesCreer=()=>modeles||PAR_DEFAUT;
async function lireSolde(){
  const r=await n8nRendu({action:'solde'});
  if(Array.isArray(r.modelesCreer)&&r.modelesCreer.length) modeles=r.modelesCreer;
  solde=r.ok?r.solde:null; return r;
}
const dire=(t,err=false)=>{ const m=fen.querySelector('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',err); };
const q=s=>fen.querySelector(s);
const cmDe=i=>{ const v=Number(String(q(i).value).replace(',','.')); return Number.isFinite(v)&&v>0&&v<2000?Math.round(v*10)/10:null; };
const dims=()=>({L:cmDe('#cr-l'),P:cmDe('#cr-p'),H:cmDe('#cr-h')});
function nomPropose(){ const d=(avant??q('#cr-desc').value).trim();   // le nom vient du texte de Mauro, pas de la version anglaise const n=q('#cr-nom').value.trim(); if(n) return n.slice(0,60);
  const m=d.split(/[,.;:\n]/)[0].trim(); return (m.charAt(0).toUpperCase()+m.slice(1)).slice(0,60)||'Objet créé par l’IA'; }
const modeleChoisi=()=>{ const l=modelesCreer(), v=q('#cr-modele').value; return l.find(m=>m.id===v)||l[0]; };

function construire(){
  fen=el('div',{id:'creer-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Créer avec l’IA'});
  fen.innerHTML=`<div class="fenetre-carte cr-carte">
    <div class="fenetre-tete"><h2>✨ Créer avec l’IA</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <div class="cr-etape1">
      <label class="cr-champ"><span>Décrivez ce que l’IA doit dessiner (meuble, lampe, plante, animal, vélo…)</span><textarea id="cr-desc" rows="3" maxlength="800" placeholder="ex. : buffet bas en chêne clair, style scandinave, pieds fins, deux portes cannées"></textarea></label>
      <div class="cr-ligne cr-ameliorer"><button type="button" class="btn" id="cr-ameliorer">✨ Améliorer la description</button><button type="button" class="btn" id="cr-avant" hidden>↶ Mon texte</button>
        <span class="mat-aide">réécrite en anglais, plus précise, ≈ 0,05 crédit</span></div>
      <div class="cr-ligne"><label class="cr-champ cr-nom"><span>Nom (facultatif)</span><input type="text" id="cr-nom" maxlength="60" placeholder="Buffet en chêne"></label></div>
      <div class="cr-ligne cr-dims"><span class="cr-lib">Dimensions (cm, facultatif)</span>
        <label>L <input type="number" id="cr-l" min="1" max="2000" step="0.5" inputmode="decimal"></label>
        <label>P <input type="number" id="cr-p" min="1" max="2000" step="0.5" inputmode="decimal"></label>
        <label>H <input type="number" id="cr-h" min="1" max="2000" step="0.5" inputmode="decimal"></label></div>
      <div class="cr-ligne"><span class="cr-lib">Modèle</span><select id="cr-modele" aria-label="Modèle de kie.ai"></select></div>
      <p class="cr-note mat-aide"></p>
      <div class="cr-ligne"><span class="cr-lib">Propositions</span><div class="seg cr-nombre" role="group" aria-label="Nombre de propositions">
        <button type="button" data-n="1">1</button><button type="button" data-n="2">2</button><button type="button" data-n="3">3</button><button type="button" data-n="4">4</button></div></div>
      <p class="cr-cout"></p>
      <div class="ph-boutons"><button type="button" class="btn primary" id="cr-ok">Créer</button><button type="button" class="btn" id="cr-non">Annuler</button></div>
    </div>
    <p class="ph-message" role="status"></p>
    <div class="cr-resultats" hidden>
      <div class="cr-grille"></div>
      <div class="ph-boutons cr-actions"></div>
      <button type="button" class="btn" id="cr-refaire">↶ Changer la description et recommencer</button>
    </div></div>`;
  document.body.append(fen);
  q('.fermer').onclick=()=>fermer(); q('#cr-non').onclick=()=>fermer();
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') fermer(); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen&&!enCours) fermer(); });
  for(const i of fen.querySelectorAll('input,textarea')) i.addEventListener('keydown',e=>e.stopPropagation());
  q('#cr-modele').onchange=()=>{ try{ localStorage.setItem(CLE,q('#cr-modele').value); }catch{} majCout(); };
  for(const b of fen.querySelectorAll('.cr-nombre button')) b.onclick=()=>{ nombre=+b.dataset.n; majCout(); };
  q('#cr-ok').onclick=lancer;
  q('#cr-ameliorer').onclick=ameliorer;
  q('#cr-avant').onclick=()=>{ if(avant!=null) q('#cr-desc').value=avant; avant=null; q('#cr-avant').hidden=true; dire(''); q('#cr-desc').focus(); };
  q('#cr-refaire').onclick=()=>{ q('.cr-resultats').hidden=true; q('.cr-etape1').hidden=false; dire(''); majCout(); q('#cr-desc').focus(); };
}
function remplirModeles(){
  const s=q('#cr-modele'), l=modelesCreer(); let garde=null; try{ garde=localStorage.getItem(CLE); }catch{}
  const v=s.value||garde; s.replaceChildren(...l.map(m=>el('option',{value:m.id},`${m.nom} · ${m.cout} crédit${m.cout>1?'s':''} l’image`)));
  s.value=l.some(m=>m.id===v)?v:l[0].id;
}
function majCout(){
  if(!fen) return; const m=modeleChoisi();
  for(const b of fen.querySelectorAll('.cr-nombre button')) b.setAttribute('aria-pressed',String(+b.dataset.n===nombre));
  q('.cr-note').textContent=m.note||'';
  const c=m.cout*nombre, ok=q('#cr-ok');
  q('.cr-cout').textContent=`Coût : ${nombre>1?nombre+' × '+m.cout+' = ':''}${c} crédit${c>1?'s':''} kie.ai`+(solde==null?' · solde en cours de lecture…':` · solde : ${Math.floor(solde).toLocaleString('fr-CH')} crédits`);
  ok.textContent=nombre>1?`Créer ${nombre} propositions`:'Créer une proposition';
  ok.disabled=enCours||solde==null||solde<c;
  if(solde!=null&&solde<c) dire('Plus assez de crédits kie.ai pour ce choix : prenez un modèle moins cher ou moins de propositions.',true);
}
function fermer(){ if(!fen) return; fen.hidden=true; enCours=false; }
// « ✨ Améliorer » : la description réécrite par le modèle de texte de kie.ai (n8n), en anglais ; le texte de Mauro est gardé
async function ameliorer(){
  const t=q('#cr-desc').value.trim(); if(t.length<3){ dire('Écrivez d’abord quelques mots.',true); q('#cr-desc').focus(); return; }
  const b=q('#cr-ameliorer'), lib=b.textContent; b.disabled=true; b.textContent='✨ Amélioration…'; dire('');
  const d=dims(), dt=[d.L&&d.L+' cm wide',d.P&&d.P+' cm deep',d.H&&d.H+' cm high'].filter(Boolean).join(', ');
  let r; try{ const x=await fetch(ASSISTANT,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},cache:'no-store',
    body:JSON.stringify({action:'ameliorer',texte:t,dims:dt,modele:modeleChoisi().nom,jeton:jeton()})}); r=await x.json(); }
  catch{ r={ok:false,erreur:'Pas de connexion au serveur'}; }
  b.disabled=false; b.textContent=lib; if(fen.hidden) return;
  if(!r?.ok||!r.texte){ dire((r?.erreur||'Amélioration impossible')+'.',true); return; }
  if(avant==null) avant=t;
  q('#cr-desc').value=r.texte; q('#cr-avant').hidden=false;
  dire('Description améliorée (en anglais, pour l’IA) : vous pouvez la retoucher, ou « ↶ Mon texte ».');
}

// ouvre la fenêtre ; o : {description, nom, dims:{L,P,H}, retour(img, info), texteRetour, place}
//   retour : l'image choisie est rendue à l'appelant (montage : posée sur la photo ; assistant) au lieu des actions habituelles
export async function ouvrirCreer(o={}){
  if(!fen) construire();
  opts=o; propositions=[]; choisie=null; enCours=false; fen.hidden=false;
  q('.cr-etape1').hidden=false; q('.cr-resultats').hidden=true; dire('');
  q('#cr-desc').value=o.description||''; q('#cr-nom').value=o.nom||''; avant=null; q('#cr-avant').hidden=true;
  for(const [k,i] of [['L','#cr-l'],['P','#cr-p'],['H','#cr-h']]) q(i).value=o.dims?.[k]?String(o.dims[k]):'';
  if(o.nombre) nombre=Math.min(4,Math.max(1,o.nombre));
  remplirModeles(); majCout(); setTimeout(()=>q('#cr-desc').focus());
  await lireSolde(); if(fen.hidden) return;
  remplirModeles(); majCout();
}

async function lancer(){
  const desc=q('#cr-desc').value.trim();
  if(desc.length<3){ dire('Décrivez l’objet à créer (quelques mots suffisent).',true); q('#cr-desc').focus(); return; }
  const m=modeleChoisi(), d=dims();
  enCours=true; majCout(); dire(`L’IA dessine ${nombre>1?nombre+' propositions':'l’objet'}… (environ 30 secondes)`);
  const r0=await n8nRendu({action:'creer',description:desc,dims:d,modele:m.id,nombre});
  if(!r0.ok){ enCours=false; majCout(); dire((r0.horsLigne?'Pas de connexion : ':'')+(r0.erreur||'kie.ai a refusé la demande'),true); return; }
  const taches=Array.isArray(r0.taches)&&r0.taches.length?r0.taches:[r0.tache];
  propositions=taches.map(t=>({tache:t,etat:'attente',image:null})); choisie=null;
  q('.cr-etape1').hidden=true; q('.cr-resultats').hidden=false; majResultats();
  const t0=Date.now();
  while(Date.now()-t0<4*60000&&propositions.some(p=>p.etat==='attente')&&!fen.hidden){
    await new Promise(ok=>setTimeout(ok,4000));
    await Promise.all(propositions.filter(p=>p.etat==='attente').map(async p=>{
      const s=await n8nRendu({action:'suivre',tache:p.tache});
      if(!s.ok){ if(!s.horsLigne){ p.etat='echec'; p.erreur=s.erreur; } return; }
      if(s.etat==='echec'){ p.etat='echec'; p.erreur=s.raison||'échec'; return; }
      if(s.etat==='fini'&&s.image){ p.etat='fini'; p.image=s.image; if(!choisie) choisie=p; }
    }));
    const prets=propositions.filter(p=>p.etat==='fini').length;
    dire(propositions.some(p=>p.etat==='attente')?`${prets} / ${propositions.length} prête${prets>1?'s':''}…`:'');
    majResultats();
  }
  enCours=false;
  for(const p of propositions) if(p.etat==='attente'){ p.etat='echec'; p.erreur='pas de résultat après 4 minutes'; }
  const ok=propositions.filter(p=>p.etat==='fini');
  dire(ok.length?(ok.length>1?'Touchez la proposition qui vous plaît, puis choisissez ce que vous en faites.':'Voici la proposition : choisissez ce que vous en faites.')
    :'Aucune image n’a pu être créée : '+(propositions[0]?.erreur||'erreur inconnue'),!ok.length);
  majResultats();
}
function majResultats(){
  const g=q('.cr-grille'); g.replaceChildren();
  for(const [i,p] of propositions.entries()){
    const b=el('button',{type:'button',class:'cr-prop','aria-pressed':String(p===choisie),'aria-label':'Proposition '+(i+1)});
    if(p.etat==='fini') b.append(el('img',{src:p.image,alt:''})); else b.append(el('span',{class:'cr-attente'},p.etat==='attente'?'…':'échec'));
    b.disabled=p.etat!=='fini'; b.onclick=()=>{ choisie=p; majResultats(); }; g.append(b);
  }
  const a=q('.cr-actions'); a.replaceChildren();
  if(!choisie||enCours&&!choisie) return;
  const bouton=(t,f,prim)=>{ const b=el('button',{type:'button',class:'btn'+(prim?' primary':'')},t); b.onclick=f; a.append(b); };
  if(opts.retour) bouton(opts.texteRetour||'Prendre celle-ci',()=>rendre(),true);
  else {
    bouton('Image plate (gratuit)',()=>plat(),true);
    bouton('Vraie 3D (Tripo)',()=>en3D());
    bouton('Vraie 3D (Blender)',()=>enBlender());
    bouton('L’essayer sur une photo',()=>surPhoto());
  }
}

// ---------- ce qu'on fait de la proposition choisie ----------
const charger=src=>new Promise((ok,ko)=>{ const i=new Image(); i.crossOrigin='anonymous'; i.onload=()=>ok(i); i.onerror=ko; i.src=src; });
// fond blanc retiré : remplissage depuis les bords sur les pixels presque blancs (l'image est faite sur fond blanc uni)
export async function sansFond(src){
  const i=await charger(src), c=el('canvas'); c.width=i.naturalWidth; c.height=i.naturalHeight;
  const g=c.getContext('2d'); g.drawImage(i,0,0); const d=g.getImageData(0,0,c.width,c.height), p=d.data, W=c.width, H=c.height;
  const blanc=k=>{ const r=p[k],v=p[k+1],b=p[k+2]; return Math.min(r,v,b)>226&&Math.max(r,v,b)-Math.min(r,v,b)<22; };
  const vu=new Uint8Array(W*H), pile=[];
  for(let x=0;x<W;x++){ pile.push(x,(H-1)*W+x); } for(let y=0;y<H;y++){ pile.push(y*W,y*W+W-1); }
  while(pile.length){ const n=pile.pop(); if(vu[n]) continue; const k=n*4; if(!blanc(k)) continue; vu[n]=1; p[k+3]=0;
    const x=n%W, y=(n-x)/W; if(x>0) pile.push(n-1); if(x<W-1) pile.push(n+1); if(y>0) pile.push(n-W); if(y<H-1) pile.push(n+W); }
  // bord adouci : un pixel opaque voisin du fond retiré devient à moitié transparent
  for(let n=0;n<W*H;n++){ if(vu[n]) continue; const x=n%W; if((x>0&&vu[n-1])||(x<W-1&&vu[n+1])||(n>=W&&vu[n-W])||(n<W*H-W&&vu[n+W])) p[n*4+3]=128; }
  g.putImageData(d,0,0);
  return new Promise(ok=>c.toBlob(ok,'image/png'));
}
const enBlob=async src=>(await fetch(src)).blob();
const versDataURL=b=>new Promise(ok=>{ const r=new FileReader(); r.onload=()=>ok(r.result); r.readAsDataURL(b); });
function info(){ const d=dims(); return {nom:nomPropose(),L:d.L,P:d.P,H:d.H}; }
async function plat(){
  const {ouvrirPhotoAvec}=await import('./photo.js'), i=info(), b=await sansFond(choisie.image);
  fermer(); await ouvrirPhotoAvec(b,i,false,opts.place);
  // dimensions connues : l'objet est posé tout de suite ; sinon on les complète dans le panneau
  if(i.L&&i.P&&i.H) document.querySelector('#ph-ajouter')?.click();
}
async function en3D(){
  const {ouvrirPhotoAvec}=await import('./photo.js'), i=info(), b=await enBlob(choisie.image);
  fermer(); await ouvrirPhotoAvec(b,i,false,opts.place);
}
async function enBlender(){
  const {ouvrirBlender}=await import('./blender.js'), i=info(), b=await enBlob(choisie.image), desc=(avant??q('#cr-desc').value).trim();
  fermer(); ouvrirBlender(true,{images:[b],nom:i.nom,description:desc,dims:{L:i.L,P:i.P,H:i.H},place:opts.place});
}
async function surPhoto(){
  const {choisirPhoto,faireMontage}=await import('./galerie.js'), i=info(), image=await versDataURL(await sansFond(choisie.image));
  fermer();
  choisirPhoto(ph=>faireMontage(ph,{image,nom:i.nom,dims:{L:i.L,P:i.P,H:i.H}}),`Choisissez la photo de la pièce où essayer « ${i.nom} ».`,opts.piece||undefined);
}
async function rendre(){
  const i=info(), image=await versDataURL(await sansFond(choisie.image)), f=opts.retour;
  fermer(); f(image,{nom:i.nom,dims:{L:i.L,P:i.P,H:i.H},brut:choisie.image});
}
export const creerOuvert=()=>!!fen&&!fen.hidden;
export function initCreer(){ addEventListener('edition',()=>{ if(!app.edition&&fen&&!fen.hidden&&!opts.retour) fermer(); }); }
