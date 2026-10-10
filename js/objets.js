// Panneau des objets (étape 4, livraison 1) : bouton « Ajouter » de la barre (Éditer) avec les formes simples ; pour
// l'élément sélectionné : nom (objet ajouté), dimensions saisies en cm (cadenas des proportions, « Taille d'origine » pour
// un meuble du modèle, options de la forme, hauteur de pose), matières partie par partie (bibliothèque), suppression d'un
// objet ajouté (deux touchers, annulable). Un objet ajouté apparaît dans la pièce regardée, posé au sol, sélectionné.
// Remplacer (livraison 3) : le nouvel objet prend la place et l'orientation de l'ancien, qui est masqué (pas supprimé) ;
// une forme simple prend aussi ses dimensions ; une seule ligne d'historique, annulable.
import * as THREE from 'three';
import {app, $} from './app.js';
import {FORMES, parametres} from './formes_simples.js';
import {creerAjout, supprimerAjout, nouveauNom} from './ajouts.js';
import {etatDe, normaliser, appliquerEtat, majApparence, echelonner} from './etats.js';
import {selecteur, partiesDe, couleurPartie, cleDe} from './bibliotheque.js';
import {select, majAngle, setHidden} from './edition.js';
import {save} from './sauvegarde.js';
import {PIECES, pieceEn, bornes} from './pieces.js';
import {ETAGE_FLOOR} from './config.js';
import {niveauDuPlan, vuePlan, empreinte} from './plan.js';
import {solSous} from './visite.js';
import {caler} from './calques.js';
import {css} from './app.js';
import {ouvrirPhoto} from './photo.js';
import {ouvrirImport, texteOrigine} from './import3d.js';
import {ouvrirCatalogue} from './catalogue.js';

const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const cm=v=>Math.round(v*1000)/10;   // mètres → cm, au mm
const cmT=v=>String(cm(v)).replace('.',',');
const CADENAS='maison3d-cadenas';
let cadenas=false; try{ cadenas=localStorage.getItem(CADENAS)==='oui'; }catch{}
let partie=null;   // partie active du sélecteur de matières (clé, ou « * » pour tout l'objet)
let ici=false;     // enregistrement fait par le sélecteur lui-même : il ne se redessine pas (la pipette de couleur resterait ouverte)

// ---------- où poser un nouvel objet : la pièce regardée ----------
function lieu(L,P){
  let niv, x, z;
  if(app.mode==='plan'){ niv=niveauDuPlan(); const v=vuePlan(); x=v.cx; z=v.cz; }
  else if(app.mode==='walk'){ const d=new THREE.Vector3(); app.camera.getWorldDirection(d); d.y=0; d.normalize();
    niv=app.camera.position.y>ETAGE_FLOOR+0.5?'etage':'rez'; x=app.camera.position.x+d.x*1.5; z=app.camera.position.z+d.z*1.5; }
  else { niv=app.level==='etage'?'etage':'rez'; x=app.orbit.target.x; z=app.orbit.target.z; }
  let p=pieceEn(x,z,niv);
  if(!p){ let best=Infinity; for(const q of PIECES.filter(q=>q.niveau===niv)) for(const [x0,z0,x1,z1] of q.rects){ const d=Math.hypot(Math.max(x0-x,0,x-x1),Math.max(z0-z,0,z-z1)); if(d<best){ best=d; p=q; } } }
  // dans le rectangle de la pièce le plus proche, l'objet entier si possible
  const r=p.rects.find(([x0,z0,x1,z1])=>x>=x0&&x<=x1&&z>=z0&&z<=z1)||p.rects[0];
  const borne=(v,a,b,l)=>b-a>l+0.1?Math.min(b-l/2-0.05,Math.max(a+l/2+0.05,v)):(a+b)/2;
  x=borne(x,r[0],r[2],L); z=borne(z,r[1],r[3],P);
  // une place libre de la pièce, la plus proche : emprises réelles des meubles posés (contours du plan, comme les alertes),
  // grille de 5 cm ; passage laissé autour : 80 cm si possible (pas d'alerte dès l'arrivée), sinon 70 cm (pas d'alerte grave), 40, 5 cm
  const base=niv==='etage'?ETAGE_FLOOR:0, PAS=0.05, b=bornes(p), X0=b.x0-1, Z0=b.z0-1, NX=Math.ceil((b.x1-b.x0+2)/PAS), NZ=Math.ceil((b.z1-b.z0+2)/PAS);
  const occ=new Uint8Array(NX*NZ);
  for(const it of Object.values(app.items)){
    if(it.hidden||it.meta.c!=='meuble'||(it.lvl==='Étage')!==(niv==='etage')||it.g.position.y-base>=1||it.size.y<0.05) continue;
    const e=empreinte(it), co=Math.cos(it.g.rotation.y), si=Math.sin(it.g.rotation.y), px=it.g.position.x, pz=it.g.position.z;
    for(let j=0;j<e.nz;j++) for(let i=0;i<e.nx;i++){ if(!e.plein[j*e.nx+i]) continue; const lx=-e.hx+(i+0.5)*e.pas, lz=-e.hz+(j+0.5)*e.pas;
      const gx=Math.floor((px+lx*co+lz*si-X0)/PAS), gz=Math.floor((pz-lx*si+lz*co-Z0)/PAS); if(gx>=0&&gz>=0&&gx<NX&&gz<NZ) occ[gz*NX+gx]=1; }
  }
  const S=new Uint32Array((NX+1)*(NZ+1));   // somme cumulée : nombre de cases occupées d'un rectangle en 4 lectures
  for(let j=0;j<NZ;j++) for(let i=0;i<NX;i++) S[(j+1)*(NX+1)+i+1]=occ[j*NX+i]+S[j*(NX+1)+i+1]+S[(j+1)*(NX+1)+i]-S[j*(NX+1)+i];
  const pris=(xa,za,xb,zb)=>{ const i0=Math.max(0,Math.floor((xa-X0)/PAS)), j0=Math.max(0,Math.floor((za-Z0)/PAS)), i1=Math.min(NX,Math.ceil((xb-X0)/PAS)), j1=Math.min(NZ,Math.ceil((zb-Z0)/PAS));
    return S[j1*(NX+1)+i1]-S[j0*(NX+1)+i1]-S[j1*(NX+1)+i0]+S[j0*(NX+1)+i0]; };
  const libre=(cx,cz,g)=>p.rects.some(([x0,z0,x1,z1])=>cx-L/2>=x0+g&&cx+L/2<=x1-g&&cz-P/2>=z0+g&&cz+P/2<=z1-g)&&!pris(cx-L/2-g,cz-P/2-g,cx+L/2+g,cz+P/2+g);
  if(!libre(x,z,0.8)){ const c=[];
    for(const [x0,z0,x1,z1] of p.rects) for(let cx=x0+L/2+0.05;cx<=x1-L/2-0.05;cx+=0.1) for(let cz=z0+P/2+0.05;cz<=z1-P/2-0.05;cz+=0.1) c.push([cx,cz,Math.hypot(cx-x,cz-z)]);
    c.sort((a,b)=>a[2]-b[2]);
    for(const g of [0.8,0.72,0.4,0.05]){ const t=c.find(([cx,cz])=>libre(cx,cz,g)); if(t){ x=t[0]; z=t[1]; break; } } }
  const y=solSous(new THREE.Vector3(x,base,z))??base;
  return {x,z,y,niv};
}
// ajoute un objet (définition a sans niveau ni position : forme, photo, fichier 3D, catalogue), posé dans la pièce regardée,
// ou à la place de l'élément à remplacer
export function ajouterObjet(a){
  const ancien=remplacement&&app.items[remplacement];
  let o, r=0;
  if(ancien){ const niv=ancien.lvl==='Étage'?'etage':'rez', base=niv==='etage'?ETAGE_FLOOR:0, x=ancien.g.position.x, z=ancien.g.position.z;
    o={x,z,niv,y:solSous(new THREE.Vector3(x,base,z))??base}; r=ancien.g.rotation.y; }
  else o=lieu(a.p.L,a.p.P);
  const nom=nouveauNom();
  const e=normaliser(nom,{x:o.x,z:o.z,r,h:false,c:null,a:{...a,v:o.niv,y:+o.y.toFixed(4),e:0}});
  const it=creerAjout(nom,e); if(!it) return null;
  if(ancien) setHidden(ancien,true); if(remplacement) finRemplacement();
  dispatchEvent(new CustomEvent('meubles'));
  select(nom); $('t-dims').open=true; save();   // un seul enregistrement : une ligne d'historique « remplacé par »
  return it;
}
export function ajouterForme(f){
  const ancien=remplacement&&app.items[remplacement], p=parametres(f);
  if(ancien){ const s=ancien.size; if(FORMES[f].rond){ p.L=p.P=+((s.x+s.z)/2).toFixed(4); } else { p.L=+s.x.toFixed(4); p.P=+s.z.toFixed(4); } p.H=+s.y.toFixed(4); }
  return ajouterObjet({t:'forme',f,p,n:FORMES[f].nom});
}

// ---------- remplacer un élément : on choisit ensuite le nouvel objet dans le menu « + » ----------
let remplacement=null;   // nom de l'élément à remplacer
export function remplacer(it){
  if(!it||it.meta.c==='ouverture') return;
  remplacement=it.name; const b=$('bandeau-remplacer'); b.hidden=false;
  $('remplacer-texte').textContent=`Remplacer « ${it.meta.l} » : choisissez le nouvel objet dans le menu « + ». Il prendra sa place et l’ancien sera masqué.`;
  ouvrirMenu(true);
}
function finRemplacement(){ remplacement=null; $('bandeau-remplacer').hidden=true; if(!$('ajouter-menu').hidden) ouvrirMenu(true); }

// ---------- menu « Ajouter » ----------
function ouvrirMenu(oui){
  const m=$('ajouter-menu'); m.hidden=!oui; $('ajouter').setAttribute('aria-expanded',String(oui)); if(!oui) return;
  const ancien=remplacement&&app.items[remplacement];
  m.replaceChildren(el('div',{class:'menu-titre'},ancien?`Remplacer « ${ancien.meta.l} » par`:'N’importe quel objet'));
  for(const [k,t,d,f] of [['catalogue','Catalogue 3D…','Poly Haven, Sketchfab',ouvrirCatalogue],['photo','D’après une photo…','image, Tripo',ouvrirPhoto],['glb','Fichier 3D (.glb)…','Tripo, fabricant',ouvrirImport]]){
    const b=el('button',{type:'button','data-ajout':k}); b.append(el('span',{},t),el('span',{class:'m2'},d)); b.onclick=()=>{ ouvrirMenu(false); f(true); }; m.append(b); }
  const g=el('div',{class:'menu-groupe'}); g.append(el('div',{class:'menu-titre'},'Formes simples')); m.append(g);
  for(const [f,d] of Object.entries(FORMES)){
    const b=el('button',{type:'button','data-forme':f}); b.append(el('span',{},d.nom),el('span',{class:'m2'},d.rond?`⌀ ${cmT(d.L)} × H ${cmT(d.H)} cm`:`${cmT(d.L)} × ${cmT(d.P)} × ${cmT(d.H)} cm`));
    b.onclick=()=>{ ouvrirMenu(false); ajouterForme(f); }; g.append(b);
  }
  m.append(el('div',{class:'menu-pied'},'')); m.lastChild.append(el('p',{},ancien?'Le nouvel objet prend la place et l’orientation de l’ancien (une forme simple prend aussi ses dimensions) ; l’ancien est masqué, « Annuler » le rétablit.'
    :'L’objet apparaît dans la pièce que vous regardez. Ses dimensions et ses matières se règlent ensuite dans le panneau.'));
  caler(m);
}

// ---------- dimensions ----------
function champ(id,lib,val,suffixe='cm'){
  const l=el('label',{class:'dimrow',for:id}); l.append(el('span',{},lib));
  const i=el('input',{type:'number',id,min:'1',max:'2000',step:'0.5',inputmode:'decimal'}); i.value=String(val); i.onkeydown=e=>e.stopPropagation();
  l.append(i,el('span',{class:'unite'},suffixe)); return [l,i];
}
const lireCm=i=>{ const v=Number(String(i.value).replace(',','.')); return Number.isFinite(v)&&v>0?Math.min(2000,v)/100:null; };
function majDimensions(){
  const it=app.selected, box=$('t-dims-corps'); if(!it||!box) return; box.replaceChildren();
  const a=it.ajout, f=a?FORMES[a.f]:null, rond=!!f?.rond;
  const dims=a?{L:a.p.L,P:a.p.P,H:a.p.H}:{L:it.size.x,P:it.size.z,H:it.size.y};
  const [lL,iL]=champ('d-l',rond?'Diamètre':'Largeur',cm(dims.L)), [lP,iP]=champ('d-p','Profondeur',cm(dims.P)), [lH,iH]=champ('d-h','Hauteur',cm(dims.H));
  box.append(lL); if(!rond) box.append(lP); box.append(lH);
  const c=el('label',{class:'crans'}), ci=el('input',{type:'checkbox',id:'d-cadenas'}); ci.checked=cadenas; c.append(ci,' Garder les proportions');
  ci.onchange=()=>{ cadenas=ci.checked; try{ localStorage.setItem(CADENAS,cadenas?'oui':'non'); }catch{} };
  box.append(c);
  const appliquer=(qui)=>{
    let L=lireCm(iL)??dims.L, P=rond?L:(lireCm(iP)??dims.P), H=lireCm(iH)??dims.H;
    if(cadenas){ const k=qui==='L'?L/dims.L:qui==='P'?P/dims.P:H/dims.H; L=dims.L*k; P=rond?L:dims.P*k; H=dims.H*k; }
    if(a){ const q={...a.p,L:+L.toFixed(4),P:+P.toFixed(4),H:+H.toFixed(4)}; changerAjout(it,{...a,p:q}); }
    else { const s0=it.size0||it.size, s=[L/s0.x,H/s0.y,P/s0.z]; echelonner(it,s); app.selBox?.update(); save(); majDimensions(); majTitre(); }
  };
  iL.onchange=()=>appliquer('L'); iP.onchange=()=>appliquer('P'); iH.onchange=()=>appliquer('H');
  if(a){
    for(const [k,lib,type,min,max] of f?.options||[]){
      if(type==='oui'){ const l=el('label',{class:'crans'}), i=el('input',{type:'checkbox'}); i.checked=!!a.p[k]; l.append(i,' '+lib); i.onchange=()=>changerAjout(it,{...a,p:{...a.p,[k]:i.checked?1:0}}); box.append(l); }
      else { const [l,i]=champ('d-'+k,lib,a.p[k],''); i.min=String(min); i.max=String(max); i.step='1'; i.onchange=()=>{ const v=Math.round(+i.value); if(v>=min&&v<=max) changerAjout(it,{...a,p:{...a.p,[k]:v}}); else majDimensions(); }; box.append(l); }
    }
    const [lE,iE]=champ('d-pose','Posé à',cm(+a.e||0),'cm du sol'); iE.min='0';
    iE.onchange=()=>{ const v=Number(String(iE.value).replace(',','.')); if(Number.isFinite(v)&&v>=0&&v<=500) changerAjout(it,{...a,e:+(v/100).toFixed(4)}); else majDimensions(); };
    box.append(lE);
  } else {
    // hauteur de pose (demande de Mauro) : la lampe du buffet est « posée à 92,5 cm » ; on peut la monter ou la descendre
    const sol=it.lvl==='Étage'?ETAGE_FLOOR:0, [lE,iE]=champ('d-pose','Posé à',cm(Math.max(0,it.g.position.y-sol)),'cm du sol'); iE.min='0';
    iE.onchange=()=>{ const v=Number(String(iE.value).replace(',','.')); if(Number.isFinite(v)&&v>=0&&v<=500){ it.g.position.y=sol+v/100; app.selBox?.update(); save(); } majDimensions(); };
    box.append(lE);
    const b=el('button',{type:'button',class:'btn',id:'d-origine'},'Taille d’origine'); b.disabled=it.g.scale.equals(new THREE.Vector3(1,1,1));
    b.onclick=()=>{ echelonner(it,[1,1,1]); app.selBox?.update(); save(); majDimensions(); majTitre(); }; box.append(b);
  }
}
function changerAjout(it,a){ appliquerEtat(it,normaliser(it.name,{...etatDe(it),a})); app.selBox?.update(); dispatchEvent(new CustomEvent('meubles')); save(); majDimensions(); majTitre(); majMatieres(); }
const f1=v=>(Math.round(v*1000)/1000).toFixed(2).replace('.',',');
function majTitre(){ const it=app.selected; if(!it) return; $('sel-name').textContent=it.meta.l; $('sel-dims').textContent='L '+f1(it.size.x)+' × P '+f1(it.size.z)+' × H '+f1(it.size.y)+' m'; }

// ---------- matières ----------
export const matieresOuvertes=()=>!!app.selected&&$('t-mats').open;
function majMatieres(){
  const it=app.selected, box=$('t-mats-corps'); if(!it||!box||!$('t-mats').open) return;
  const parts=partiesDe(it).map(e=>({cle:e.cle,nom:it.nomsParties?.[e.cle]||e.nom,couleur:couleurPartie(e)}));
  if(!parts.length){ box.replaceChildren(el('p',{class:'mat-aide'},'Cet élément n’a pas de partie à habiller.')); return; }
  if(partie!=='*'&&!parts.some(e=>e.cle===partie)) partie=parts[0].cle;
  const tous=()=>{ const v=parts.map(e=>JSON.stringify(it.matieres?.[e.cle]||null)); return v.every(x=>x===v[0])?it.matieres?.[parts[0].cle]||null:null; };
  selecteur(box,{parties:parts,active:partie,tout:parts.length>1,cible:it.name,aide:'Touchez une partie de l’objet dans la vue pour la choisir.',
    valeur:cle=>cle==='*'?tous():it.matieres?.[cle]||null,
    choisir:(cle,ch,enDirect)=>{ const m={...(it.matieres||{})}; for(const k of cle==='*'?parts.map(e=>e.cle):[cle]){ if(ch) m[k]=ch; else delete m[k]; }
      it.matieres=m; majApparence(it); ici=true; save(); ici=false; if(!enDirect) majMatieres(); },
    changerPartie:cle=>{ partie=cle; majMatieres(); if(cle!=='*') eclairer(it,cle); }});
}
// toucher une partie de l'objet sélectionné (matières ouvertes) : elle devient la partie active, et s'éclaire un instant
export function choisirPartie(mesh){ const it=app.selected; if(!it) return; partie=cleDe(mesh); majMatieres(); eclairer(it,partie); }
function eclairer(it,cle){
  const mat=new THREE.MeshBasicMaterial({color:new THREE.Color(css('--accent')||'#2c5a86'),transparent:true,opacity:0.45,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const l=it.mats.filter(o=>cleDe(o)===cle&&!o.name.endsWith('__couvercle')).map(o=>{ const v=new THREE.Mesh(o.geometry,mat); v.raycast=()=>{}; v.renderOrder=4; v.userData.eclat=true; o.add(v); return v; });
  setTimeout(()=>{ for(const v of l) v.removeFromParent(); mat.dispose(); },800);
}

// ---------- sélection : nom, dimensions, matières, suppression ----------
function majPanneau(){
  const it=app.selected; if(!it) return;
  const a=it.ajout;
  $('t-nom-ligne').hidden=!a; if(a) $('t-nom').value=a.n||'';
  // modèle du catalogue : titre, auteur, licence et lien vers la page d'origine
  const og=$('t-origine'); og.hidden=!a?.o; og.replaceChildren(); if(a?.o){ og.append(texteOrigine(a.o)+' '); if(/^https:\/\//.test(a.o.lien||'')){ const l=el('a',{href:a.o.lien,target:'_blank',rel:'noopener'},'voir la page'); og.append(l); } }
  $('t-remplacer').hidden=it.meta.c==='ouverture';
  $('t-dims').hidden=it.meta.c==='ouverture';   // portes et fenêtres : leurs ouvrants sont réglés sur le modèle
  $('t-suppr').hidden=!a; $('t-reset').hidden=!!a; $('t-suppr').textContent='Supprimer cet objet'; $('t-suppr').classList.remove('arme');
  partie=null; majDimensions(); majMatieres();
}
export function initObjets(){
  const b=$('ajouter'), m=$('ajouter-menu');
  b.onclick=e=>{ e.stopPropagation(); ouvrirMenu(m.hidden); };
  addEventListener('pointerdown',e=>{ if(!m.hidden&&!m.contains(e.target)&&!b.contains(e.target)) ouvrirMenu(false); });
  m.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); ouvrirMenu(false); b.focus(); } });
  addEventListener('selection',majPanneau);
  $('t-mats').addEventListener('toggle',()=>majMatieres());
  $('t-nom').onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') e.target.blur(); };
  $('t-nom').onchange=e=>{ const it=app.selected; if(!it?.ajout) return; const n=e.target.value.trim().slice(0,60)||FORMES[it.ajout.f]?.nom||'Objet'; changerAjout(it,{...it.ajout,n}); };
  $('t-remplacer').onclick=()=>{ if(app.selected) remplacer(app.selected); };
  $('remplacer-annuler').onclick=()=>finRemplacement();
  $('remplacer-choisir').onclick=()=>ouvrirMenu(true);
  addEventListener('edition',()=>{ if(!app.edition&&remplacement) finRemplacement(); });
  let arme=0;
  $('t-suppr').onclick=()=>{ const it=app.selected; if(!it?.ajout) return; const s=$('t-suppr');
    if(Date.now()-arme>4000){ arme=Date.now(); s.textContent='Confirmer la suppression'; s.classList.add('arme'); setTimeout(()=>{ if(Date.now()-arme>=3900){ s.textContent='Supprimer cet objet'; s.classList.remove('arme'); } },4000); return; }
    arme=0; supprimerAjout(it.name); dispatchEvent(new CustomEvent('meubles')); save(); $('save-state').textContent='Objet supprimé (annulable).'; };
  // la disposition change (annuler, autre appareil) : le panneau suit
  addEventListener('disposition',()=>{ if(app.selected&&!app.items[app.selected.name]) select(null); else if(app.selected&&!ici){ majTitre(); majAngle(); majDimensions(); majMatieres(); } });
}
