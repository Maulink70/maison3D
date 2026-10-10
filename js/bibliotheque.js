// Bibliothèque de matières (étape 4, livraison 1) : les matières validées par le questionnaire des textures et les plus
// courantes, rangées par famille (même liste que le questionnaire). Pour tout objet, existant ou ajouté, on choisit la
// matière partie par partie (on touche la partie dans la vue, ou on la choisit dans la liste), avec une couleur au choix ;
// « Autre » : un nom libre et une couleur. Aussi pour les sols et murs de chaque pièce (revetements.js).
// Choix gardés dans la disposition : m = {partie: {i: matière, c: couleur ou null, n: nom libre pour « Autre »}}.
import * as THREE from 'three';
import {motif, motifPret} from './matieres.js';

export const FAMILLES=['Tissus','Cuirs','Bois','Finitions','Métal','Verre','Pierre et céramique','Sols','Autres'];
// id, nom, famille, motif (texture dessinée), couleur, rugosité, métal, taille du motif (m) si différente, opacité, lumière
const L=(i,n,f,mo,c,r=0.6,o={})=>({i,n,f,mo,c,r,...o});
export const MATIERES=[
  L('toile','Toile','Tissus','tissu',0xd9d2c5,0.9), L('lin','Lin','Tissus','lin',0xcfc4ae,0.95), L('velours','Velours','Tissus','velours',0x3b4a6b,0.85),
  L('bouclette','Bouclette','Tissus','bouclette',0xece6da,1), L('tapis','Tapis à poils longs','Tissus','tapis',0xf3f0ea,1),
  L('cuir','Cuir','Cuirs','cuir',0x6f1f2b,0.55), L('cuir-cognac','Cuir cognac','Cuirs','cuir',0x8a4b22,0.5), L('cuir-noir','Cuir noir','Cuirs','cuir',0x1d1c1c,0.45),
  L('simili','Simili cuir','Cuirs','cuir',0xe8e2d6,0.4,{t:0.12}),
  L('chene-clair','Chêne clair','Bois','bois',0xd9b98a), L('chene','Chêne','Bois','bois',0xc28a4f), L('noyer','Noyer','Bois','bois',0x6b4428),
  L('hetre','Hêtre','Bois','bois',0xd8b48a), L('pin','Pin','Bois','bois',0xe2c48f), L('bois-blanchi','Bois blanchi','Bois','bois',0xe9e1d3),
  L('wenge','Bois foncé (wengé)','Bois','bois',0x3a2a20), L('lambris','Lambris','Bois','lambris',0xe2c48f), L('rotin','Rotin, cannage','Bois','rotin',0xc9a46a),
  L('laque-blanc','Laqué blanc','Finitions',null,0xf4f4f2,0.25), L('laque','Laqué couleur','Finitions',null,0x6f1f2b,0.25),
  L('mat-blanc','Mat blanc','Finitions',null,0xeeeeea,0.9), L('mat','Mat couleur','Finitions',null,0x7a8c8e,0.9),
  L('peinture','Peinture','Finitions','peinture',0xebe6db,0.85), L('melamine','Mélaminé','Finitions',null,0xe4ddd0,0.5),
  L('inox','Inox brossé','Métal','inox',0xc3c7cb,0.3,{m:0.3}), L('chrome','Chrome','Métal',null,0xd8dde2,0.12,{m:0.35}),
  L('alu','Aluminium','Métal','inox',0xd0d3d6,0.4,{m:0.25}), L('laiton','Laiton','Métal','inox',0xc9a54b,0.3,{m:0.35}),
  L('cuivre','Cuivre','Métal','inox',0xb87333,0.3,{m:0.35}), L('metal-noir','Métal noir mat','Métal',null,0x1f2022,0.7,{m:0.2}),
  L('verre','Verre clair','Verre',null,0xdcebf0,0.05,{o:0.2}), L('verre-fume','Verre fumé','Verre',null,0x3a3f44,0.05,{o:0.55}),
  L('verre-depoli','Verre dépoli','Verre',null,0xe8eef0,0.4,{o:0.75}), L('verre-opaque','Verre opaque','Verre',null,0xe2ecf3,0.08),
  L('marbre','Marbre blanc','Pierre et céramique','marbre',0xf2f0ec,0.2), L('marbre-gris','Marbre gris','Pierre et céramique','marbre',0x9a9c9e,0.2),
  L('granit','Granit noir','Pierre et céramique','pierre',0x2a2b2d,0.25), L('pierre','Pierre','Pierre et céramique','pierre',0x8a8780,0.75),
  L('beton','Béton','Pierre et céramique','beton',0xa7a49d,0.8), L('terrazzo','Terrazzo','Pierre et céramique','terrazzo',0xe6e1d8,0.35),
  L('ceramique','Céramique blanche','Pierre et céramique',null,0xfafaf8,0.2), L('faience','Faïence 15 × 15','Pierre et céramique','carrelage',0xf4f4f2,0.2,{t:0.3}),
  L('brique','Brique','Pierre et céramique','brique',0xa4583a,0.85),
  L('parquet','Parquet chêne','Sols','parquet',0xc89a62,0.55), L('parquet-clair','Parquet clair','Sols','parquet',0xe0c9a2,0.55),
  L('parquet-fonce','Parquet foncé','Sols','parquet',0x7a5236,0.55), L('chevron','Parquet en chevron','Sols','chevron',0xc28a4f,0.55),
  L('carrelage-30','Carrelage 30 × 30','Sols','carrelage',0xd8d4cc,0.3), L('carrelage-60','Carrelage 60 × 60','Sols','dalle',0xc9c5bd,0.3),
  L('tomettes','Tomettes','Sols','carrelage',0xa5552f,0.7,{t:0.4}), L('beton-cire','Béton ciré','Sols','beton',0xb9b4ab,0.45),
  L('moquette','Moquette','Sols','moquette',0x8e8a82,1), L('vinyle','Vinyle imitation bois','Sols','parquet',0xd2b48a,0.4),
  L('plastique','Plastique','Autres',null,0xf0f0ee,0.4), L('plastique-noir','Plastique noir','Autres',null,0x202122,0.4),
  L('lumiere','Lumière (abat-jour)','Autres',null,0xfff7e6,0.6,{e:0.55}), L('autre','Autre…','Autres',null,0xb0a89a,0.6)
];
export const matiere=id=>MATIERES.find(m=>m.i===id)||null;
export const nomChoix=ch=>!ch?'':ch.i==='autre'?(ch.n||'Autre'):(matiere(ch.i)?.n||ch.i||'');
const hex=c=>'#'+new THREE.Color(c).getHexString();

// Matériau d'une matière (couleur choisie, sinon celle de la matière). Coordonnées de texture en mètres à prévoir sur la
// géométrie quand userData.taille est posée.
export function materiau(ch){
  const d=matiere(ch.i)||matiere('autre'), m=new THREE.MeshStandardMaterial({color:ch.c||d.c,roughness:d.r,metalness:d.m||0});
  if(d.mo){ const t=motif(d.mo); m.map=t.map; m.bumpMap=t.bump; m.bumpScale=t.bumpScale; m.userData.motif=d.mo; m.userData.taille=d.t||t.taille; }
  if(d.o){ m.transparent=true; m.opacity=d.o; m.depthWrite=false; m.side=THREE.DoubleSide; }
  if(d.e){ m.emissive=new THREE.Color(0xfff1d6); m.emissiveIntensity=d.e; }
  m.name=d.i; m.userData.matiere=nomChoix(ch); m.userData.emissif={h:m.emissive.getHex(),i:m.emissiveIntensity}; return m;
}
// Géométrie avec coordonnées de texture en mètres (chaque triangle projeté selon sa normale, en coordonnées monde, comme
// matieres.js) : la géométrie d'origine est gardée (o.userData.geoOrig) pour revenir à la matière du modèle
const A=new THREE.Vector3(), B=new THREE.Vector3(), C=new THREE.Vector3(), N=new THREE.Vector3();
export function geoMetres(src,matrice,taille){
  const g=src.index?src.toNonIndexed():src.clone(), p=g.attributes.position, uv=new Float32Array(p.count*2);
  for(let i=0;i+2<p.count;i+=3){
    A.fromBufferAttribute(p,i).applyMatrix4(matrice); B.fromBufferAttribute(p,i+1).applyMatrix4(matrice); C.fromBufferAttribute(p,i+2).applyMatrix4(matrice);
    N.subVectors(C,B).cross(B.clone().sub(A)); const ax=Math.abs(N.x), ay=Math.abs(N.y), az=Math.abs(N.z), k=ay>=ax&&ay>=az?0:ax>=az?1:2;
    [A,B,C].forEach((v,j)=>{ uv[(i+j)*2]=(k===1?v.z:v.x)/taille; uv[(i+j)*2+1]=(k===0?v.z:v.y)/taille; });
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); return g;
}

// ---------- parties d'un objet ----------
// partie = nom du matériau d'origine (les couvercles des coupes, dans la matière de la partie la plus coupée, suivent)
export const cleDe=o=>(o.userData.orig||o.material)?.name||'sans_nom';
// parties d'un objet, de la plus grande à la plus petite (aire), avec la couleur et l'aspect d'origine
export function partiesDe(it){
  if(it.partiesInfo) return it.partiesInfo;
  const t=new Map();
  for(const o of it.mats){ if(o.userData.vitre||Array.isArray(o.material)||o.name.endsWith('__couvercle')) continue;
    const base=o.userData.orig||o.material, k=cleDe(o); let e=t.get(k);
    if(!e){ e={cle:k,base,aire:0,nom:it.ajout?.parties?.[k]||''}; t.set(k,e); }
    e.aire+=aire(o); }
  const l=[...t.values()].sort((a,b)=>b.aire-a.aire);
  l.forEach((e,k)=>{ if(!e.nom) e.nom='Partie '+(k+1)+' · '+aspect(e.base); });
  return it.partiesInfo=l;
}
function aire(o){ const g=o.geometry, p=g.attributes.position, idx=g.index, n=idx?idx.count:p.count; let s=0;
  for(let k=0;k+2<n;k+=3){ A.fromBufferAttribute(p,idx?idx.getX(k):k); B.fromBufferAttribute(p,idx?idx.getX(k+1):k+1); C.fromBufferAttribute(p,idx?idx.getX(k+2):k+2);
    s+=B.sub(A).cross(C.sub(A)).length()/2; } return s; }
function aspect(m){ if(m.userData?.matiere) return m.userData.matiere; const mo=m.userData?.motif;
  if(mo) return {cuir:'cuir',tissu:'tissu',tapis:'tapis',bois:'bois',pierre:'pierre',peinture:'peinture',inox:'inox'}[mo]||mo;
  if(m.transparent&&m.opacity<0.9) return 'verre'; if((m.metalness||0)>0.25) return 'métal'; if(m.map) return 'texture'; return 'lisse'; }
export const couleurPartie=e=>e.base?.color?hex(e.base.color):'#cccccc';

// ---------- apparence d'un objet : couleur générale (it.color) et matières par partie (it.matieres) ----------
// Chaque partie garde son matériau d'origine (userData.orig) et reçoit un matériau propre (gardé en cache par choix) :
// les lampes (lampes.js) allument ce matériau propre sans toucher aux autres objets.
const echelle=it=>it.g.scale.toArray().map(v=>v.toFixed(4)).join(',');
export function appliquerApparence(it){
  const parts=it.matieres||{};
  it.g.updateMatrixWorld(true);
  for(const o of it.mats){
    if(o.userData.vitre||Array.isArray(o.material)) continue;
    if(!o.userData.orig) o.userData.orig=o.material;
    const base=o.userData.orig, ch=parts[cleDe(o)], cle=(ch?`${ch.i||''}|${ch.c||''}|${ch.n||''}`:'')+'|'+(it.color||'');
    const cache=o.userData.cacheMat||(o.userData.cacheMat=new Map());
    let m=cache.get(cle);
    if(!m){
      if(ch?.i) m=materiau(ch); else { m=base.clone(); if(ch?.c) m.color.set(ch.c); }
      if(it.color) m.color.set(it.color);
      if(base.polygonOffset){ m.polygonOffset=true; m.polygonOffsetFactor=base.polygonOffsetFactor; m.polygonOffsetUnits=base.polygonOffsetUnits; }
      cache.set(cle,m);
    }
    o.material=m;
    // géométrie : coordonnées en mètres pour une matière à motif, sinon celle d'origine
    if(!o.userData.geoOrig) o.userData.geoOrig=o.geometry;
    const taille=ch?.i?m.userData.taille:null;
    if(taille){ const k=taille+'|'+echelle(it); if(o.userData.geoUV?.k!==k){ o.userData.geoUV?.g.dispose(); o.userData.geoUV={k,g:geoMetres(o.userData.geoOrig,o.matrixWorld,taille)}; } o.geometry=o.userData.geoUV.g; }
    else o.geometry=o.userData.geoOrig;
  }
  dispatchEvent(new CustomEvent('apparence',{detail:{it}}));   // lampes : le matériau propre a changé, on rallume
}

// ---------- vignettes ----------
const vignettes=new Map();
export function vignette(d,taille=56){
  const k=d.i+taille; if(vignettes.has(k)) return copie(vignettes.get(k));
  const cv=document.createElement('canvas'); cv.width=cv.height=taille; const g=cv.getContext('2d'), col=new THREE.Color(d.c);
  if(d.mo){
    const px=motif(d.mo).pixels, n=px.n, im=new ImageData(n,n), lin=c=>Math.pow(c,1/2.2);
    const r=lin(col.r), gg=lin(col.g), b=lin(col.b);   // teinte appliquée comme dans la vue (couleur × motif, en sRGB approché)
    for(let i=0;i<n*n;i++){ im.data[i*4]=px.d[i*4]*r; im.data[i*4+1]=px.d[i*4+1]*gg; im.data[i*4+2]=px.d[i*4+2]*b; im.data[i*4+3]=255; }
    const t=document.createElement('canvas'); t.width=t.height=n; t.getContext('2d').putImageData(im,0,0);
    const part=Math.min(1,0.6/(d.t||motif(d.mo).taille));   // environ 60 cm de matière dans la vignette
    for(let y=0;y<taille;y+=taille*part) for(let x=0;x<taille;x+=taille*part) g.drawImage(t,x,y,taille*part,taille*part);
  } else {
    const h='#'+col.getHexString(), gr=g.createLinearGradient(0,0,taille,taille);
    if(d.o){ g.fillStyle='#fff'; g.fillRect(0,0,taille,taille); g.fillStyle='#d6d9dc'; for(let y=0;y<taille;y+=8) for(let x=(y/8)%2*8;x<taille;x+=16) g.fillRect(x,y,8,8); g.globalAlpha=Math.max(0.35,d.o); }
    gr.addColorStop(0,h); gr.addColorStop(0.55,h); gr.addColorStop(1,'#'+col.clone().multiplyScalar(d.m?0.6:d.r<0.3?0.82:0.92).getHexString());
    g.fillStyle=gr; g.fillRect(0,0,taille,taille); g.globalAlpha=1;
    if(d.m||d.r<0.3){ const s=g.createLinearGradient(0,0,taille,taille*0.6); s.addColorStop(0,'rgba(255,255,255,0.55)'); s.addColorStop(0.4,'rgba(255,255,255,0)'); g.fillStyle=s; g.fillRect(0,0,taille,taille); }
    if(d.i==='autre'){ g.fillStyle='rgba(255,255,255,0.85)'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('?',taille/2,taille/2); }
  }
  vignettes.set(k,cv); return copie(cv);
}
function copie(cv){ const c=document.createElement('canvas'); c.width=cv.width; c.height=cv.height; c.getContext('2d').drawImage(cv,0,0); return c; }

// ---------- sélecteur de matière (panneau) ----------
// options : parties [{cle, nom, couleur}], active (clé), valeur(cle) → choix, choisir(cle, choix|null), changerPartie(cle)
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
// famille affichée : celle choisie dans ce sélecteur (onglet touché), sinon celle de la matière de la partie, sinon celle
// proposée (Sols pour un sol) ; on revient au choix automatique quand l'objet ou la partie change
export function selecteur(box,o){
  box.replaceChildren();
  const active=o.active??o.parties[0]?.cle, ch=o.valeur(active), cible=(o.cible||'')+'|'+active;
  if(box.dataset.cible!==cible){ box.dataset.cible=cible; box.dataset.famille=''; }
  if(o.parties.length>1){
    const p=el('div',{class:'mat-parties',role:'group','aria-label':'Partie'});
    if(o.tout){ const b=el('button',{type:'button',class:'mat-partie'+(active==='*'?' sel':'')},'Tout l’objet'); b.onclick=()=>o.changerPartie('*'); p.append(b); }
    for(const e of o.parties){ const b=el('button',{type:'button',class:'mat-partie'+(e.cle===active?' sel':''),'data-partie':e.cle});
      const s=el('span',{class:'pastille'}); s.style.background=e.couleur; b.append(s,el('span',{},e.nom+(o.valeur(e.cle)?' : '+nomChoix(o.valeur(e.cle)):''))); b.onclick=()=>o.changerPartie(e.cle); p.append(b); }
    box.append(p);
    if(o.aide) box.append(el('p',{class:'mat-aide'},o.aide));
  }
  const fam=box.dataset.famille||(ch?.i&&matiere(ch.i)?.f)||o.famille||FAMILLES[0];
  const onglets=el('div',{class:'mat-familles',role:'tablist','aria-label':'Familles de matières'});
  for(const f of FAMILLES){ const b=el('button',{type:'button',role:'tab','aria-selected':String(f===fam)},f); b.onclick=()=>{ box.dataset.famille=f; selecteur(box,o); }; onglets.append(b); }
  box.append(onglets);
  const grille=el('div',{class:'mat-grille',role:'listbox','aria-label':fam});
  const liste=MATIERES.filter(d=>d.f===fam);
  for(const d of liste){
    const b=el('button',{type:'button',class:'mat-vignette'+(ch?.i===d.i?' sel':''),role:'option','aria-selected':String(ch?.i===d.i),'data-matiere':d.i,title:d.n});
    const cadre=el('span',{class:'mat-image'}); b.append(cadre,el('span',{class:'mat-nom'},d.n));
    b.onclick=()=>{ const c=ch?.i===d.i?ch.c:null; o.choisir(active,{i:d.i,c:c||null,...(d.i==='autre'?{n:ch?.n||''}:{})}); };
    grille.append(b);
    // motifs dessinés à la demande, sans figer l'écran
    if(!d.mo||motifPret(d.mo)) cadre.append(vignette(d)); else setTimeout(()=>{ if(b.isConnected) cadre.append(vignette(d)); },0);
  }
  box.append(grille);
  // couleur de la partie, nom libre pour « Autre », retour à l'origine
  const pied=el('div',{class:'mat-pied'});
  const coul=el('input',{type:'color','aria-label':'Couleur de la matière'}); coul.value=ch?.c||(ch?.i?hex(matiere(ch.i)?.c??0xffffff):o.parties.find(e=>e.cle===active)?.couleur||'#ffffff');
  coul.oninput=()=>o.choisir(active,{...(ch||{i:null}),c:coul.value},true);
  const lc=el('label',{class:'mat-couleur'}); lc.append(el('span',{},'Couleur'),coul);
  const raz=el('button',{type:'button',class:'btn'},o.origine||'Matière d’origine'); raz.disabled=!ch; raz.onclick=()=>o.choisir(active,null);
  if(ch?.i||!o.matiereAvantCouleur) pied.append(lc);   // sols et murs : une matière d'abord, puis sa couleur
  if(ch?.c){ const rc=el('button',{type:'button',class:'btn'},'Couleur de la matière'); rc.onclick=()=>o.choisir(active,{...ch,c:null}); pied.append(rc); }
  pied.append(raz);
  if(ch?.i==='autre'){ const t=el('input',{type:'text',maxlength:'60',placeholder:'Nom de la matière (ex. velours côtelé)','aria-label':'Nom de la matière'}); t.value=ch.n||'';
    t.onchange=()=>o.choisir(active,{...ch,n:t.value.trim()}); t.onkeydown=e=>e.stopPropagation(); pied.prepend(t); }
  box.append(pied);
}
