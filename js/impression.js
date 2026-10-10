// Impression en PDF (livraison 8) : bouton « Imprimer », puis un panneau : quoi (plan d'un niveau, vue à l'écran, fiche
// du meuble sélectionné), format (A4 / A3), orientation (auto, portrait, paysage) et, pour le plan, échelle (ajustée à la
// page avec barre d'échelle, ou exacte 1:50 / 1:100). Le PDF est fabriqué dans le navigateur, puis téléchargé : jsPDF et
// svg2pdf.js, chargés au premier usage depuis jsDelivr, et les polices IBM Plex du site (dossier polices/).
// Plan : dessin vectoriel. Le plan d'architecte (plan.js), les calques cochés (calques.js) et les mesures (mesure.js)
// sont redessinés pour le papier dans un SVG hors écran (1 unité = 0,25 mm : un texte de 12 px à l'écran fait 3 mm),
// leurs styles sont figés en attributs (svg2pdf ne lit pas les feuilles de style), puis convertis.
// Vue à l'écran : image de la 3D rendue plus finement, avec le plan, les calques et les mesures par-dessus, en vectoriel.
// Fiche : image du meuble seul, dimensions, position (pièce, distances aux murs), couleur et matières, vue de dessus.
import * as THREE from 'three';
import {texteOrigine} from './import3d.js';
import {app, $} from './app.js';
import {ETAGE_FLOOR} from './config.js';
import {pieceEn, bornes} from './pieces.js';
import {dessinPlan, emprisePlan, echellePlan, niveauDuPlan, style as stylePlan, camPlan, empreinte} from './plan.js';
import {calquesImpression, etat, caler, versMur} from './calques.js';
import {mesuresImpression} from './mesure.js';

const NS='http://www.w3.org/2000/svg', CLE='maison3d-impression', U=0.25;
const PAPIER={a4:[210,297],a3:[297,420]}, MARGE=10, HAUT=17, BAS=10;
const LIBS=['https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js','https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.4/dist/svg2pdf.umd.min.js'];
const POLICES=[['IBMPlexSans-Regular.ttf','IBM Plex Sans','normal'],['IBMPlexSans-SemiBold.ttf','IBM Plex Sans','bold'],
  ['IBMPlexMono-Regular.ttf','IBM Plex Mono','normal'],['IBMPlexMono-Medium.ttf','IBM Plex Mono','bold']];
const choix={quoi:'plan',niveau:'rez',format:'a4',orient:'auto',echelle:'ajuste'};
const ENCRE=[28,34,39], GRIS=[91,102,112];
const m=v=>v.toFixed(2).replace('.',',')+' m', cm=v=>Math.round(v*100)+' cm';
const sol=niv=>niv==='etage'?ETAGE_FLOOR:0, niveauDe=it=>it.lvl==='Étage'?'etage':'rez';
const el=(nom,attrs,parent)=>{ const n=document.createElementNS(NS,nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); parent?.append(n); return n; };
function garder(){ try{ localStorage.setItem(CLE,JSON.stringify(choix)); }catch{} }
function relire(){ try{ const d=JSON.parse(localStorage.getItem(CLE)||'{}'); for(const k of ['quoi','format','orient','echelle']) if(d[k]) choix[k]=d[k]; }catch{} }

// ---------- outils PDF : chargés une fois, au premier PDF ----------
let outils=null;
const base64=b=>{ let s=''; for(let i=0;i<b.length;i+=8192) s+=String.fromCharCode(...b.subarray(i,i+8192)); return btoa(s); };
function charger(){
  if(outils) return outils;
  const script=src=>new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>ko(new Error('outil PDF non chargé ('+src.split('/').pop()+')')); document.head.append(s); });
  outils=(async()=>{
    if(!window.jspdf) await script(LIBS[0]);
    if(!window.svg2pdf) await script(LIBS[1]);
    const polices=await Promise.all(POLICES.map(async([f])=>{ const r=await fetch('polices/'+f); if(!r.ok) throw new Error('police '+f+' introuvable'); return base64(new Uint8Array(await r.arrayBuffer())); }));
    return {jsPDF:window.jspdf.jsPDF,polices};
  })();
  outils.catch(()=>{ outils=null; });
  return outils;
}
function nouveauDoc(o,format,orient){
  const doc=new o.jsPDF({unit:'mm',format,orientation:orient==='paysage'?'landscape':'portrait',compress:true});
  POLICES.forEach(([f,nom,st],k)=>{ doc.addFileToVFS(f,o.polices[k]); doc.addFont(f,nom,st); });
  doc.setFont('IBM Plex Sans','normal'); doc.setTextColor(...ENCRE); doc.setDrawColor(...ENCRE); doc.setLineHeightFactor(1.3);
  return doc;
}
const page=(format,orient)=>{ const [w,h]=PAPIER[format]; return orient==='paysage'?{W:h,H:w}:{W:w,H:h}; };
const quand=()=>new Date().toLocaleString('fr-FR',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
function entete(doc,W,titre,sous,droite){
  doc.setFont('IBM Plex Sans','bold'); doc.setFontSize(15); doc.setTextColor(...ENCRE); doc.text(titre,MARGE,MARGE+5);
  doc.setFont('IBM Plex Sans','normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIS); doc.text(sous,MARGE,MARGE+10.5);
  if(droite){ doc.setFont('IBM Plex Mono','normal'); doc.text(droite,W-MARGE,MARGE+5,{align:'right'}); }
  doc.setDrawColor(211,217,222); doc.setLineWidth(0.3); doc.line(MARGE,MARGE+HAUT-4,W-MARGE,MARGE+HAUT-4);
}
function pied(doc,W,H){
  doc.setFont('IBM Plex Sans','normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
  doc.text('Appartement Diolly · Maison3D',MARGE,H-MARGE+2); doc.text('Imprimé le '+quand(),W-MARGE,H-MARGE+2,{align:'right'});
}
// barre d'échelle : blocs de 1 m en général (plus petits sur une fiche, plus grands sur un plan très réduit), k en mm par mètre
const nombre=v=>String(+v.toFixed(2)).replace('.',',');
function barre(doc,x,y,k){
  const pas=[5,2,1,0.5,0.2,0.1].find(p=>p*k<=25)||0.1, n=Math.max(1,Math.min(5,Math.floor(40/(pas*k)))), h=1.6;
  doc.setLineWidth(0.2); doc.setDrawColor(...ENCRE);
  for(let i=0;i<n;i++){ doc.setFillColor(...(i%2?[255,255,255]:ENCRE)); doc.rect(x+i*pas*k,y,pas*k,h,'FD'); }
  doc.setFont('IBM Plex Mono','normal'); doc.setFontSize(7.5); doc.setTextColor(...ENCRE);
  for(let i=0;i<=n;i++) doc.text(i===n?nombre(i*pas)+' m':nombre(i*pas),x+i*pas*k,y+h+3.2,{align:'center'});
}
function nord(doc,x,y){
  doc.setFillColor(...ENCRE); doc.triangle(x,y,x-2.2,y+6,x+2.2,y+6,'F');
  doc.setFont('IBM Plex Sans','bold'); doc.setFontSize(8); doc.setTextColor(...ENCRE); doc.text('N',x,y-1.2,{align:'center'});
}

// ---------- SVG hors écran et styles figés ----------
// Le dessin pour le papier est posé dans un conteneur invisible aux couleurs du thème clair (classe .impression), pour
// que les styles du site s'y appliquent ; ils sont ensuite recopiés en attributs sur une copie, que svg2pdf convertit
function feuille(w,h){
  let c=document.querySelector('.impression'); if(!c){ c=document.createElement('div'); c.className='impression'; c.setAttribute('aria-hidden','true'); document.body.append(c); }
  return el('svg',{width:w,height:h,viewBox:`0 0 ${w} ${h}`},c);
}
const PROPS=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','text-anchor','dominant-baseline'];
function couleur(v){ const r=/rgba?\(([^)]+)\)/.exec(v); if(!r) return {v}; const p=r[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  if(p.length>3&&p[3]===0) return {v:'none'}; return {v:`rgb(${p[0]},${p[1]},${p[2]})`,a:p.length>3?p[3]:1}; }
// trait de largeur fixe à l'écran (vector-effect) : sa largeur est rapportée au repère de l'élément
const echelle=s=>{ const c=s.getCTM?.(); return c?Math.hypot(c.a,c.b)||1:1; };
function figer(src){
  const dst=src.cloneNode(true), a=[src,...src.querySelectorAll('*')], b=[dst,...dst.querySelectorAll('*')], halos=[];
  a.forEach((s,i)=>{
    const d=b[i]; if(s.tagName==='title'){ d.remove(); return; }
    const cs=getComputedStyle(s); d.removeAttribute('class'); d.removeAttribute('style'); d.removeAttribute('data-id'); d.removeAttribute('data-cote'); d.removeAttribute('data-item'); d.removeAttribute('data-mesure');
    if(cs.display==='none'){ d.remove(); return; }
    if(s.tagName==='svg'||s.tagName==='g') return;
    const k=cs.vectorEffect==='non-scaling-stroke'?echelle(s):1;
    for(const p of PROPS){ let v=cs.getPropertyValue(p); if(!v) continue;
      if(p==='fill'||p==='stroke'){ const c=couleur(v); v=c.v; if(c.a!==undefined&&c.a<1) d.setAttribute(p+'-opacity',String(c.a)); }
      else if(p==='stroke-width') v=String(parseFloat(v)/k);
      else if(p==='stroke-dasharray'&&v!=='none') v=v.split(/[ ,]+/).filter(Boolean).map(x=>parseFloat(x)/k).join(' ');
      d.setAttribute(p,v); }
    if(s.tagName==='text'||s.tagName==='tspan'){
      const fs=parseFloat(cs.fontSize);
      d.setAttribute('font-family',/mono/i.test(cs.fontFamily)?'IBM Plex Mono':'IBM Plex Sans'); d.setAttribute('font-size',String(fs));
      d.setAttribute('font-weight',parseInt(cs.fontWeight)>=500?'bold':'normal');
      const dy=s.getAttribute('dy'); if(dy&&/em$/.test(dy)) d.setAttribute('dy',String(parseFloat(dy)*fs));
      if(s.tagName==='text'&&/^stroke/.test(cs.paintOrder)&&cs.stroke!=='none'&&parseFloat(cs.strokeWidth)>0) halos.push(d);
    }
  });
  // texte détouré (paint-order: stroke) : svg2pdf l'ignore. Les textes passent au-dessus de tout, chacun dans un groupe
  // qui reprend les transformations de ses parents : d'abord tous les halos (copie du texte, trait et remplissage de la
  // couleur du fond), qui effacent les traits dessous, puis tous les textes (un halo ne mange plus le texte voisin)
  const couche=(t)=>{ const tr=[]; for(let n=t.parentNode;n&&n!==dst;n=n.parentNode) if(n.getAttribute?.('transform')) tr.unshift(n.getAttribute('transform')); return tr.join(' '); };
  const textes=[...dst.querySelectorAll('text')].map(t=>({t,tr:couche(t),halo:halos.includes(t)}));
  const gh=el('g',{},dst), gt=el('g',{},dst);
  for(const {t,tr,halo} of textes){
    if(halo){ const h=t.cloneNode(true), c=t.getAttribute('stroke');
      for(const n of [h,...h.querySelectorAll('tspan')]){ n.setAttribute('fill',c); n.removeAttribute('fill-opacity'); }
      el('g',tr?{transform:tr}:{},gh).append(h);
      for(const n of [t,...t.querySelectorAll('tspan')]) n.setAttribute('stroke','none'); }
    el('g',tr?{transform:tr}:{},gt).append(t);
  }
  return dst;
}
async function versPDF(doc,svg,x,y,w,h){
  const f=figer(svg); svg.after(f);
  try{ await doc.svg(f,{x,y,width:w,height:h}); } finally { f.remove(); }
}

// ---------- plan d'un niveau ----------
// mise en page : orientation, échelle (mm par mètre) et tient-il sur la page ?
function miseEnPage(c=choix){
  const e=emprisePlan(c.niveau), b={x0:e.x0-0.3,x1:e.x1+0.3,z0:e.z0-0.3,z1:e.z1+0.3}, ew=b.x1-b.x0, eh=b.z1-b.z0;   // 30 cm autour des murs : cotes des fenêtres
  const essai=o=>{ const {W,H}=page(c.format,o), zw=W-2*MARGE, zh=H-2*MARGE-HAUT-BAS;
    const k=c.echelle==='ajuste'?Math.min(zw/ew,zh/eh):1000/Number(c.echelle);
    return {o,W,H,k,zw,zh,b,tient:ew*k<=zw+0.01&&eh*k<=zh+0.01}; };
  if(c.orient!=='auto') return essai(c.orient);
  const p=essai('portrait'), l=essai('paysage');
  if(c.echelle==='ajuste') return l.k>p.k*1.02?l:p;
  return p.tient||!l.tient?p:l;
}
const nomsCalques=()=>{ const l=[]; if(etat.noms) l.push('noms'); if(etat.surfaces) l.push('surfaces'); if(etat.hauteurs) l.push('hauteurs');
  if(etat.cPieces||etat.cMurs||etat.cMeuble||etat.cOuv) l.push('cotes'); if(etat.mesures) l.push('mesures'); return l; };
async function pdfPlan(o){
  const c={...choix}, mp=miseEnPage(c);
  if(!mp.tient) throw new Error('le plan ne tient pas sur la page');
  const doc=nouveauDoc(o,c.format,mp.o), {W,H,k,b}=mp, ech=c.echelle==='ajuste'?'≈ 1:'+Math.round(1000/k):'1:'+c.echelle;
  const niv=c.niveau==='etage'?'de l’étage':'du rez', cq=nomsCalques();
  entete(doc,W,'Plan '+niv,'Appartement Diolly'+(cq.length?' · calques : '+cq.join(', '):''),`Échelle ${ech} · ${c.format.toUpperCase()}`);
  const ox=MARGE+(mp.zw-(b.x1-b.x0)*k)/2, oy=MARGE+HAUT+(mp.zh-(b.z1-b.z0)*k)/2, S=k/U;
  const proj=(x,z)=>({x:(ox+(x-b.x0)*k)/U,y:(oy+(z-b.z0)*k)/U});
  const svg=feuille(W/U,H/U);
  try{
    dessinPlan(c.niveau,el('g',{class:'plan-svg',transform:`translate(${ox/U} ${oy/U}) scale(${S}) translate(${-b.x0} ${-b.z0})`},svg));
    calquesImpression(c.niveau,el('g',{class:'calques-svg'},svg),(x,y,z)=>proj(x,z));
    if(etat.mesures) mesuresImpression(c.niveau,el('g',{class:'mesures-svg'},svg),proj);
    await versPDF(doc,svg,0,0,W,H);
  } finally { svg.remove(); }
  barre(doc,MARGE,H-MARGE-BAS+1,k); nord(doc,W-MARGE-3,MARGE+HAUT+2);
  doc.setFont('IBM Plex Sans','normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
  doc.text(c.echelle==='ajuste'?'Échelle ajustée à la page : mesurer avec la barre':`À imprimer à 100 % (taille réelle) pour garder l’échelle ${ech}`,MARGE+48,H-MARGE-BAS+2.6);
  pied(doc,W,H);
  return {doc,nom:`Maison3D-plan-${c.niveau}-${c.echelle==='ajuste'?'ajuste':'1-'+c.echelle}-${c.format.toUpperCase()}.pdf`};
}

// ---------- vue à l'écran ----------
// image de la vue, rendue k fois plus fine (le rendu normal reprend aussitôt, rien ne clignote)
// (fond du thème clair : une page sombre userait l'encre)
function photo(k,cam){
  const {renderer,scene}=app, pr=renderer.getPixelRatio(), fond=scene.background;
  scene.background=new THREE.Color(app.mode==='plan'&&stylePlan==='archi'?'#ffffff':'#dfe3e6');
  renderer.setPixelRatio(k); renderer.render(scene,cam); const url=renderer.domElement.toDataURL('image/jpeg',0.9);
  scene.background=fond; renderer.setPixelRatio(pr); renderer.render(scene,cam); return url;
}
function descriptionVue(){
  const niv={all:'tout l’appartement',rez:'rez',etage:'étage'};
  if(app.mode==='plan') return `Plan ${stylePlan==='reel'?'réaliste':'d’architecte'} · ${niveauDuPlan()==='etage'?'étage':'rez'}`;
  if(app.mode==='walk'){ const c=app.camera.position, n=c.y>ETAGE_FLOOR+0.5?'etage':'rez', p=pieceEn(c.x,c.z,n); return '1re personne · '+(p?p.nom:niv[n]); }
  return 'Maquette · '+niv[app.level||'all'];
}
async function pdfVue(o){
  const c={...choix}, r=app.canvas.getBoundingClientRect(), w=r.width, h=r.height;
  const orient=c.orient==='auto'?(w>=h?'paysage':'portrait'):c.orient, {W,H}=page(c.format,orient), doc=nouveauDoc(o,c.format,orient);
  const zw=W-2*MARGE, zh=H-2*MARGE-HAUT-BAS, k=Math.min(zw/w,zh/h), iw=w*k, ih=h*k, ix=MARGE+(zw-iw)/2, iy=MARGE+HAUT+(zh-ih)/2;
  entete(doc,W,'Vue à l’écran',descriptionVue()+(nomsCalques().length?' · calques : '+nomsCalques().join(', '):''),c.format.toUpperCase());
  doc.addImage(photo(Math.min(3,Math.max(1.5,2600/w)),app.mode==='plan'?camPlan:app.camera),'JPEG',ix,iy,iw,ih);
  // plan, calques et mesures par-dessus, en vectoriel (pixels de l'écran) ; copiés dans le conteneur hors écran pour
  // prendre les couleurs du thème clair
  const svg=feuille(w,h);
  try{
    for(const id of ['plan','calques','mesures']){ const s=$(id); if(s.hasAttribute('hidden')) continue;
      const c=s.cloneNode(true); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id')); c.setAttribute('width',w); c.setAttribute('height',h);
      svg.after(c); const f=figer(c); c.remove(); el('g',{},svg).append(...f.childNodes); }
    if(svg.childNodes.length){ svg.setAttribute('viewBox',`0 0 ${w} ${h}`); await doc.svg(svg,{x:ix,y:iy,width:iw,height:ih}); }
  } finally { svg.remove(); }
  doc.setDrawColor(211,217,222); doc.setLineWidth(0.2); doc.rect(ix,iy,iw,ih);
  if(app.mode==='plan') barre(doc,MARGE,H-MARGE-BAS+1,echellePlan()*k);
  if($('bandeau-piece')&&!$('bandeau-piece').hidden){ doc.setFont('IBM Plex Sans','normal'); doc.setFontSize(8.5); doc.setTextColor(...ENCRE); doc.text($('bandeau-piece').textContent,MARGE,H-MARGE-BAS+3.5); }
  pied(doc,W,H);
  return {doc,nom:`Maison3D-vue-${new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')}.pdf`};
}

// ---------- fiche du meuble sélectionné ----------
// le meuble seul, vu de trois quarts depuis le milieu de sa pièce (il y fait face), sur fond blanc, recadré
export function imageMeuble(it){
  const {renderer,scene,canvas}=app, L=29, avant=[], caches=[];
  const marquer=o=>{ avant.push([o,o.layers.mask]); o.layers.enable(L); };
  it.g.traverse(o=>{ marquer(o); if((o.name?.endsWith('__couvercle')||o.name==='alerte')&&o.visible){ caches.push(o); o.visible=false; } });   // ni couvercle ni voile rouge
  scene.traverse(o=>{ if(o.isLight) marquer(o); });
  const vis=it.g.visible; it.g.visible=true; it.g.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(it.g), c=box.getCenter(new THREE.Vector3()), R=Math.max(0.15,box.getSize(new THREE.Vector3()).length()/2);
  const p=pieceEn(c.x,c.z,niveauDe(it)), bp=p?bornes(p):null;
  const dir=bp?new THREE.Vector3((bp.x0+bp.x1)/2-c.x,0,(bp.z0+bp.z1)/2-c.z):new THREE.Vector3(1,0,1);
  if(dir.lengthSq()<0.04) dir.set(1,0,1);
  dir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),0.55); dir.y=0.62; dir.normalize();
  const r=canvas.getBoundingClientRect(), cam=new THREE.PerspectiveCamera(28,r.width/r.height,0.01,200); cam.layers.set(L);
  const demi=THREE.MathUtils.degToRad(28)/2, ang=Math.min(demi,Math.atan(Math.tan(demi)*cam.aspect));
  cam.position.copy(c).addScaledVector(dir,R/Math.sin(ang)*1.04); cam.lookAt(c); cam.updateMatrixWorld();
  const fond=scene.background, plans=renderer.clippingPlanes, pr=renderer.getPixelRatio();
  scene.background=new THREE.Color('#ffffff'); renderer.clippingPlanes=[]; renderer.setPixelRatio(Math.min(3,Math.max(1.5,2000/r.width)));
  let url;
  try{ renderer.render(scene,cam); url=canvas.toDataURL('image/png'); }
  finally{
    for(const [o,mk] of avant) o.layers.mask=mk; for(const o of caches) o.visible=true; it.g.visible=vis;
    scene.background=fond; renderer.clippingPlanes=plans; renderer.setPixelRatio(pr);
    renderer.render(scene,app.mode==='plan'?camPlan:app.camera);
  }
  // recadrage sur le meuble (coins de sa boîte projetés)
  const xs=[], ys=[]; for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]){ const v=new THREE.Vector3(x,y,z).project(cam); xs.push((v.x+1)/2); ys.push((1-v.y)/2); }
  return new Promise(ok=>{ const im=new Image(); im.onload=()=>{
    const W=im.width, H=im.height, mx=0.04*W, x0=Math.max(0,Math.min(...xs)*W-mx), x1=Math.min(W,Math.max(...xs)*W+mx), y0=Math.max(0,Math.min(...ys)*H-mx), y1=Math.min(H,Math.max(...ys)*H+mx);
    const cv=document.createElement('canvas'); cv.width=Math.max(1,Math.round(x1-x0)); cv.height=Math.max(1,Math.round(y1-y0));
    const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height); g.drawImage(im,x0,y0,cv.width,cv.height,0,0,cv.width,cv.height);
    ok({url:cv.toDataURL('image/jpeg',0.92),w:cv.width,h:cv.height}); }; im.src=url; });
}
const MATIERE={cuir:'cuir',tissu:'tissu',tapis:'tapis',bois:'bois',pierre:'pierre',peinture:'peinture',inox:'inox brossé'};
function nomMatiere(mt){ if(mt.userData?.matiere) return mt.userData.matiere.toLowerCase(); if(MATIERE[mt.userData?.motif]) return MATIERE[mt.userData.motif]; if(mt.transparent&&mt.opacity<0.9) return 'verre';
  if((mt.metalness||0)>0.5) return 'métal'; if(mt.map) return 'texture du modèle'; return 'lisse'; }
// couleurs et matières du meuble, par surface (les plus présentes d'abord)
function matieres(it){
  const t=new Map(), A=new THREE.Vector3(), B=new THREE.Vector3(), C=new THREE.Vector3(); let tot=0;
  for(const o of it.mats){ const geo=o.geometry, pos=geo.attributes.position, idx=geo.index, n=idx?idx.count:pos.count, mats=Array.isArray(o.material)?o.material:[o.material];
    o.updateMatrixWorld(true);
    const aire=(a0,a1)=>{ let s=0; for(let k=a0;k<a1;k+=3){ A.fromBufferAttribute(pos,idx?idx.getX(k):k).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(pos,idx?idx.getX(k+1):k+1).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(pos,idx?idx.getX(k+2):k+2).applyMatrix4(o.matrixWorld); s+=B.sub(A).cross(C.sub(A)).length()/2; } return s; };
    const parts=geo.groups.length&&mats.length>1?geo.groups.map(g=>[mats[g.materialIndex],g.start,g.start+g.count]):[[mats[0],0,n]];
    for(const [mt,a0,a1] of parts){ if(!mt?.color) continue; const s=aire(a0,Math.min(a1,n)), hex='#'+mt.color.getHexString(), nom=nomMatiere(mt), cle=hex+nom;
      const e=t.get(cle)||{hex,nom,s:0}; e.s+=s; t.set(cle,e); tot+=s; } }
  return [...t.values()].sort((a,b)=>b.s-a.s).filter(e=>e.s/(tot||1)>0.005).slice(0,7).map(e=>({...e,part:e.s/(tot||1)}));
}
// distance jusqu'au bord de la pièce (une fenêtre ou la baie n'arrête pas la recherche des murs du plan)
function jusquAuBord(p,x,z,dx,dz){
  const r=p?.rects.find(r=>x>=r[0]-0.02&&x<=r[2]+0.02&&z>=r[1]-0.02&&z<=r[3]+0.02); if(!r) return null;
  const d=dx>0?r[2]-x:dx<0?x-r[0]:dz>0?r[3]-z:z-r[1]; return d>0.005?d:null;
}
function distancesMurs(it){
  const niv=niveauDe(it), g=it.g, c=Math.cos(g.rotation.y), s=Math.sin(g.rotation.y), hx=it.size.x/2, hz=it.size.z/2;
  const cs=[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([lx,lz])=>[g.position.x+lx*c+lz*s,g.position.z-lx*s+lz*c]);
  const x0=Math.min(...cs.map(q=>q[0])), x1=Math.max(...cs.map(q=>q[0])), z0=Math.min(...cs.map(q=>q[1])), z1=Math.max(...cs.map(q=>q[1])), mx=g.position.x, mz=g.position.z;
  const p=pieceEn(mx,mz,niv);
  return [['ouest',x0,mz,-1,0],['est',x1,mz,1,0],['nord',mx,z0,0,-1],['sud',mx,z1,0,1]].map(([nom,px,pz,dx,dz])=>{
    const d=versMur(niv,px+dx*0.005,pz+dz*0.005,dx,dz); if(d!==null) return [nom,m(d+0.005)];
    const b=jusquAuBord(p,px,pz,dx,dz); return [nom,b===null?'—':m(b)+' (fenêtre)']; });
}
async function pdfFiche(o){
  const it=app.selected; if(!it) throw new Error('aucun meuble sélectionné');
  const c={...choix}, orient=c.orient==='paysage'?'paysage':'portrait', {W,H}=page(c.format,orient), doc=nouveauDoc(o,c.format,orient);
  const niv=niveauDe(it), g=it.g, p=pieceEn(g.position.x,g.position.z,niv), cat=it.meta.c==='ouverture'?'Porte ou fenêtre':'Mobilier';
  entete(doc,W,it.meta.l,`Fiche ${it.meta.c==='ouverture'?'de l’élément':'du meuble'} · ${cat} · ${niv==='etage'?'Étage':'Rez'}${p?' · '+p.nom:''}`,c.format.toUpperCase());
  const y0=MARGE+HAUT+2, lg=W-2*MARGE, gauche=lg*0.56, xd=MARGE+gauche+8, ld=W-MARGE-xd;
  // image du meuble
  const im=await imageMeuble(it), kw=Math.min(gauche/im.w,(H*0.32)/im.h), iw=im.w*kw, ih=im.h*kw;
  doc.addImage(im.url,'JPEG',MARGE+(gauche-iw)/2,y0,iw,ih);
  // colonne de droite : dimensions et position
  let y=y0+3;
  const titre=t=>{ doc.setFont('IBM Plex Sans','bold'); doc.setFontSize(10); doc.setTextColor(...ENCRE); doc.text(t,xd,y); y+=5.5; };
  const ligne=(a,b,x=xd,l=ld)=>{ doc.setFont('IBM Plex Sans','normal'); doc.setFontSize(9); doc.setTextColor(...GRIS); doc.text(a,x,y);
    doc.setFont('IBM Plex Mono','normal'); doc.setTextColor(...ENCRE); doc.text(b,x+l,y,{align:'right'}); y+=5; };
  titre('Dimensions');
  ligne('Largeur',cm(it.size.x)); ligne('Profondeur',cm(it.size.z)); ligne('Hauteur',cm(it.size.y));
  ligne('Emprise au sol',(it.size.x*it.size.z).toFixed(2).replace('.',',')+' m²');
  y+=2; titre('Position');
  const ang=Math.round(THREE.MathUtils.radToDeg(g.rotation.y)), dep=Math.hypot(g.position.x-it.home.x,g.position.z-it.home.z);
  ligne('Niveau',niv==='etage'?'Étage':'Rez'); ligne('Pièce',p?p.nom:'—');
  ligne('Centre (x ; z)',`${g.position.x.toFixed(2).replace('.',',')} ; ${g.position.z.toFixed(2).replace('.',',').replace('-','−')}`);
  ligne('Rotation',`${ang}°`); if(g.position.y-sol(niv)>0.02) ligne('Posé à',cm(g.position.y-sol(niv))+' du sol');
  ligne('Déplacé',dep>0.005?'oui, de '+m(dep):'non'); ligne('Masqué',it.hidden?'oui':'non');
  y+=2; titre('Distances aux murs');
  for(const [nom,d] of distancesMurs(it)) ligne(nom[0].toUpperCase()+nom.slice(1),d);
  // sous l'image : couleur et matières
  y=Math.max(y,y0+ih+8);
  const yc=y; doc.setFont('IBM Plex Sans','bold'); doc.setFontSize(10); doc.setTextColor(...ENCRE); doc.text('Couleur et matières',MARGE,y); y+=5.5;
  if(it.color){ doc.setFillColor(it.color); doc.setDrawColor(180,186,192); doc.rect(MARGE,y-3.2,4,4,'FD'); doc.setFont('IBM Plex Sans','normal'); doc.setFontSize(9);
    doc.text('Couleur choisie '+it.color.toUpperCase(),MARGE+6,y); y+=5.5; }
  for(const e of matieres(it)){
    doc.setFillColor(e.hex); doc.setDrawColor(180,186,192); doc.setLineWidth(0.2); doc.rect(MARGE,y-3.2,4,4,'FD');
    doc.setFont('IBM Plex Sans','normal'); doc.setFontSize(9); doc.setTextColor(...ENCRE); doc.text(e.nom,MARGE+6,y);
    doc.setFont('IBM Plex Mono','normal'); doc.setTextColor(...GRIS); doc.text(`${e.hex.toUpperCase()}  ${Math.round(e.part*100)} %`,MARGE+gauche,y,{align:'right'}); y+=5; }
  // modèle du catalogue : titre, auteur, licence (à citer pour les licences « Attribution »), adresse de la page
  const og=it.ajout?.o; if(og){ y+=2; doc.setFont('IBM Plex Sans','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
    for(const t of doc.splitTextToSize('Modèle '+texteOrigine(og)+(og.lien?' — '+og.lien:''),gauche)){ doc.text(t,MARGE,y); y+=4.2; } }
  // vue de dessus, cotée
  const yv=Math.max(y+6,yc), hv=H-MARGE-BAS-yv-6, lv=lg, sx=it.size.x, sz=it.size.z;
  doc.setFont('IBM Plex Sans','bold'); doc.setFontSize(10); doc.setTextColor(...ENCRE); doc.text('Vue de dessus',MARGE,yv);
  if(hv>25){
    empreinte(it);   // contour vu de dessus (it.plan), calculé une fois
    const k=Math.min((lv-24)/sx,(hv-18)/sz,200), cx=MARGE+lv/2, cz=yv+6+(hv-6)/2, svg=feuille(W/U,H/U);
    try{
      const gp=el('g',{class:'plan-svg',transform:`translate(${cx/U} ${cz/U}) scale(${k/U})`},svg);
      el('path',{class:'meuble',d:it.plan||`M${-sx/2} ${-sz/2}H${sx/2}V${sz/2}H${-sx/2}Z`},gp);
      await versPDF(doc,svg,0,0,W,H);
    } finally { svg.remove(); }
    // cotes : largeur au-dessus, profondeur à droite (repère du meuble, sans sa rotation)
    doc.setDrawColor(44,90,134); doc.setTextColor(44,90,134); doc.setLineWidth(0.25); doc.setFont('IBM Plex Mono','normal'); doc.setFontSize(8.5);
    const xa=cx-sx*k/2, xb=cx+sx*k/2, za=cz-sz*k/2, zb=cz+sz*k/2;
    doc.line(xa,za-4,xb,za-4); doc.line(xa,za-5.5,xa,za-1); doc.line(xb,za-5.5,xb,za-1); doc.text(cm(sx),cx,za-5.5,{align:'center'});
    doc.line(xb+4,za,xb+4,zb); doc.line(xb+1,za,xb+5.5,za); doc.line(xb+1,zb,xb+5.5,zb); doc.text(cm(sz),xb+6,cz+1,{align:'left'});
    barre(doc,MARGE,H-MARGE-BAS+1,k);
  }
  pied(doc,W,H);
  return {doc,nom:`Maison3D-fiche-${it.meta.l.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'')}.pdf`};
}

// ---------- panneau « Imprimer » ----------
const OPTIONS=[
  ['quoi','Imprimer',[['plan','Plan'],['vue','Vue à l’écran'],['fiche','Fiche du meuble']]],
  ['niveau','Niveau',[['rez','Rez'],['etage','Étage']]],
  ['format','Format',[['a4','A4'],['a3','A3']]],
  ['orient','Orientation',[['auto','Auto'],['portrait','Portrait'],['paysage','Paysage']]],
  ['echelle','Échelle',[['ajuste','Ajustée'],['50','1:50'],['100','1:100']]]];
let occupe=false;
function majPanneau(){
  for(const [k,,vals] of OPTIONS) for(const [v] of vals) $(`impr-${k}-${v}`).setAttribute('aria-pressed',String(choix[k]===v));
  $('impr-l-niveau').hidden=$('impr-l-echelle').hidden=choix.quoi!=='plan';
  const info=$('impr-info'), bt=$('impr-creer'); let ok=true, t='';
  if(!app.mobilierPret){ ok=false; t='Attendez la fin du chargement des meubles.'; }
  else if(choix.quoi==='plan'){
    const mp=miseEnPage(), f=choix.format.toUpperCase()+' '+(mp.o==='paysage'?'paysage':'portrait');
    if(!mp.tient){ ok=false; t=`Trop grand pour une page ${f} à 1:${choix.echelle} : choisissez A3, l’autre orientation ou 1:100.`; }
    else t=choix.echelle==='ajuste'?`Plan agrandi pour remplir la page ${f} (≈ 1:${Math.round(1000/mp.k)}), avec barre d’échelle.`:`Échelle exacte 1:${choix.echelle} sur ${f} : imprimez à 100 %, « taille réelle ».`;
    const cq=nomsCalques(); t+=' Calques imprimés : '+(cq.length?cq.join(', '):'aucun')+' (bouton « Calques »).';
  }
  else if(choix.quoi==='vue') t='Ce que vous voyez à l’écran, avec les calques et les mesures affichés.';
  else if(app.selected) t='Fiche de : '+app.selected.meta.l+'.';
  else { ok=false; t='Sélectionnez d’abord un meuble : mode « Éditer », puis touchez le meuble.'; }
  info.textContent=t; bt.disabled=!ok||occupe;
}
async function creer(){
  if(occupe) return; occupe=true; const bt=$('impr-creer'), info=$('impr-info'); bt.textContent='Préparation du PDF…'; majPanneau();
  try{
    const o=await charger(), {doc,nom}=await (choix.quoi==='plan'?pdfPlan:choix.quoi==='vue'?pdfVue:pdfFiche)(o);
    doc.save(nom); app.dernierPDF={nom,pages:doc.getNumberOfPages()};
    occupe=false; majPanneau(); info.textContent='PDF créé : '+nom+' (dans vos téléchargements).';
  }catch(e){ occupe=false; majPanneau(); info.textContent='Impossible de créer le PDF : '+(e?.message||e)+'. Vérifiez la connexion et réessayez.'; console.warn(e); }
  finally{ bt.textContent='Créer le PDF'; }
}
export function initImpression(){
  relire();
  const bt=$('imprimer'), menu=$('impr-menu');
  const t=document.createElement('div'); t.className='menu-titre'; t.textContent='Imprimer en PDF'; menu.append(t);
  for(const [k,lib,vals] of OPTIONS){
    const l=document.createElement('div'); l.className='impr-ligne'; l.id='impr-l-'+k;
    const s=document.createElement('span'); s.textContent=lib; s.id='impr-t-'+k;
    const seg=document.createElement('div'); seg.className='seg'; seg.setAttribute('role','group'); seg.setAttribute('aria-labelledby','impr-t-'+k);
    for(const [v,txt] of vals){ const b=document.createElement('button'); b.type='button'; b.id=`impr-${k}-${v}`; b.textContent=txt;
      b.onclick=()=>{ choix[k]=v; garder(); majPanneau(); }; seg.append(b); }
    l.append(s,seg); menu.append(l);
  }
  const pied=document.createElement('div'); pied.className='menu-pied';
  const info=document.createElement('p'); info.id='impr-info'; info.setAttribute('role','status');
  const go=document.createElement('button'); go.type='button'; go.className='btn primary'; go.id='impr-creer'; go.textContent='Créer le PDF'; go.onclick=creer;
  pied.append(info,go); menu.append(pied);
  const ouvrir=oui=>{ menu.hidden=!oui; bt.setAttribute('aria-expanded',String(oui)); if(!oui) return;
    choix.niveau=app.mode==='plan'?niveauDuPlan():app.level==='etage'?'etage':app.mode==='walk'&&app.camera.position.y>ETAGE_FLOOR+0.5?'etage':'rez';
    majPanneau(); caler(menu); $('impr-quoi-'+choix.quoi).focus(); };
  bt.onclick=e=>{ e.stopPropagation(); ouvrir(menu.hidden); };
  addEventListener('pointerdown',e=>{ if(!menu.hidden&&!menu.contains(e.target)&&!bt.contains(e.target)) ouvrir(false); });
  menu.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); ouvrir(false); bt.focus(); } });
}
