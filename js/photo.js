// Panneau photo (étape 4, livraison 2) : un objet d'après la photo d'un meuble (site marchand, galerie de la tablette…).
// On colle l'image (Ctrl+V ou bouton « Coller l'image »), on la choisit ou on la glisse ; rien n'est fait tout seul
// (décision de Mauro) : « Recadrer », « Gomme », « Retirer le fond » (fond uni, dans le navigateur) et « Nettoyer (IA) »
// (kie.ai par n8n, confirmation avant chaque appel : crédits) sont des boutons. Puis nom et dimensions (cm), « Ajouter ».
// L'objet : la silhouette de la photo (contour de ses parties visibles) extrudée sur la profondeur, la photo sur la face
// avant, la couleur dominante sur les côtés et le dos ; photo gardée dans Airtable (fichiers.js), contour dans la disposition.
import * as THREE from 'three';
import {$} from './app.js';
import {envoyerFichier, lireFichier} from './fichiers.js';
import {ajouterObjet} from './objets.js';
import {nettoyerPhoto} from './ia.js';
import {soldeTripo, creer3D} from './tripo.js';
import {ouvrirImport, importerModele} from './import3d.js';

const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
const MAXI=1024;
let fen=null, src=null, origine=null, pile=[], outil=null, cadre=null, fondAvant=null, ratio=1;

// ---------- l'objet 3D ----------
const textures=new Map();
function texture(img){
  if(!textures.has(img.id)) textures.set(img.id,(async()=>{
    const b=await lireFichier(img.id,img.n||1,img.type); if(!b) { textures.delete(img.id); return null; }
    // image bitmap : pas de retournement par WebGL (flipY sans effet) : le haut de l'image est en v = 0, d'où 1 − y/H plus bas
    const bm=await createImageBitmap(b); const t=new THREE.Texture(bm); t.flipY=false; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; t.needsUpdate=true; return t;
  })());
  return textures.get(img.id);
}
// triangles d'une géométrie non indexée qui passent le test (normale du triangle), en nouvelle géométrie
function trier(geo,test){
  const p=geo.attributes.position, n=geo.attributes.normal, uv=geo.attributes.uv, P=[], N=[], U=[];
  for(let i=0;i+2<p.count;i+=3){ if(!test(n.getZ(i))) continue;
    for(let k=i;k<i+3;k++){ P.push(p.getX(k),p.getY(k),p.getZ(k)); N.push(n.getX(k),n.getY(k),n.getZ(k)); U.push(uv.getX(k),uv.getY(k)); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); return g;
}
export function construirePhoto(a){
  const {L,P,H}=a.p, g=new THREE.Group(), k=Array.isArray(a.k)&&a.k.length>=3?a.k:[[0,0],[1,0],[1,1],[0,1]];
  let pts=k.map(([u,v])=>new THREE.Vector2(u*L-L/2,v*H)); if(THREE.ShapeUtils.isClockWise(pts)) pts=pts.reverse();
  const UV={generateTopUV:(geo,v,a1,b,c)=>[a1,b,c].map(i=>new THREE.Vector2((v[i*3]+L/2)/L,1-v[i*3+1]/H)),
    generateSideWallUV:()=>[new THREE.Vector2(0,0),new THREE.Vector2(1,0),new THREE.Vector2(1,1),new THREE.Vector2(0,1)]};
  const geo=new THREE.ExtrudeGeometry(new THREE.Shape(pts),{depth:P,bevelEnabled:false,curveSegments:1,UVGenerator:UV}); geo.translate(0,0,-P/2);
  const face=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.85,alphaTest:0.5}); face.name='photo'; face.userData.matiere='Photo';
  const cotes=new THREE.MeshStandardMaterial({color:a.c||'#b8b0a4',roughness:0.85,side:THREE.DoubleSide}); cotes.name='cotes';
  g.add(new THREE.Mesh(trier(geo,z=>z>0.5),face),new THREE.Mesh(trier(geo,z=>z<=0.5),cotes)); geo.dispose();
  // la photo arrive ensuite (cache du navigateur ou n8n) : posée sur le matériau d'origine et ses copies (couleur, matière)
  const pret=a.img?.id?texture(a.img).then(t=>{ if(!t) return false; const m=g.children[0];
    for(const x of [m.userData.orig||m.material,m.material,...(m.userData.cacheMat?.values()||[])]) if(x&&!x.userData?.motif){ x.map=t; x.needsUpdate=true; } return true; }):null;
  return {g,noms:{photo:'Photo (face avant)',cotes:'Côtés et dos'},taille:new THREE.Vector3(L,H,P),pret};
}

// ---------- traitement de l'image ----------
const ctx2=c=>c.getContext('2d',{willReadFrequently:true});
function toile(w,h){ const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; }
async function charger(blob){
  const bm=await createImageBitmap(blob); const k=Math.min(1,MAXI/Math.max(bm.width,bm.height));
  const c=toile(bm.width*k,bm.height*k); ctx2(c).drawImage(bm,0,0,c.width,c.height); bm.close?.(); return c;
}
const copie=c=>{ const d=toile(c.width,c.height); ctx2(d).drawImage(c,0,0); return d; };
function memoriser(){ pile.push(copie(src)); if(pile.length>12) pile.shift(); majBoutons(); }
// fond uni : rempli depuis les bords, de proche en proche, tant que la couleur reste proche de celle du bord
function retirerFond(base,tol){
  const c=copie(base), x=ctx2(c), im=x.getImageData(0,0,c.width,c.height), d=im.data, w=c.width, h=c.height;
  const bord=[]; for(let i=0;i<w;i++){ bord.push(i,(h-1)*w+i); } for(let j=0;j<h;j++){ bord.push(j*w,j*w+w-1); }
  const cols=bord.filter(k=>d[k*4+3]>10).map(k=>[d[k*4],d[k*4+1],d[k*4+2]]);
  if(!cols.length) return {c,uni:true};
  const med=i=>cols.map(q=>q[i]).sort((a,b)=>a-b)[cols.length>>1], ref=[med(0),med(1),med(2)];
  const dist=k=>Math.hypot(d[k*4]-ref[0],d[k*4+1]-ref[1],d[k*4+2]-ref[2]);
  const proches=bord.filter(k=>d[k*4+3]<=10||dist(k)<tol).length/bord.length;   // part du bord dans la couleur du fond
  const fond=new Uint8Array(w*h), pile2=[];
  for(const k of bord) if(d[k*4+3]<=10||dist(k)<tol){ fond[k]=1; pile2.push(k); }
  while(pile2.length){ const k=pile2.pop(), i=k%w, j=(k-i)/w;
    for(const q of [i>0?k-1:-1,i<w-1?k+1:-1,j>0?k-w:-1,j<h-1?k+w:-1]) if(q>=0&&!fond[q]&&(d[q*4+3]<=10||dist(q)<tol)){ fond[q]=1; pile2.push(q); } }
  for(let k=0;k<w*h;k++){ if(fond[k]){ d[k*4+3]=0; continue; }
    const i=k%w, j=(k-i)/w; if((i>0&&fond[k-1])||(i<w-1&&fond[k+1])||(j>0&&fond[k-w])||(j<h-1&&fond[k+w])) d[k*4+3]=Math.min(d[k*4+3],dist(k)<tol*1.6?110:200); }
  x.putImageData(im,0,0);
  return {c,uni:proches>0.6};
}
// réduit l'image à sa partie visible (pixels non transparents)
function rogner(c){
  const d=ctx2(c).getImageData(0,0,c.width,c.height).data; let x0=c.width,y0=c.height,x1=-1,y1=-1;
  for(let j=0;j<c.height;j++) for(let i=0;i<c.width;i++) if(d[(j*c.width+i)*4+3]>12){ if(i<x0)x0=i; if(i>x1)x1=i; if(j<y0)y0=j; if(j>y1)y1=j; }
  if(x1<0) return c; const r=toile(x1-x0+1,y1-y0+1); ctx2(r).drawImage(c,x0,y0,r.width,r.height,0,0,r.width,r.height); return r;
}
// contour de la partie visible (grille réduite, plus grande tache), simplifié ; coordonnées 0..1, v vers le haut
function contour(c){
  const n=96, k=n/Math.max(c.width,c.height), w=Math.max(2,Math.round(c.width*k)), h=Math.max(2,Math.round(c.height*k));
  const r=toile(w,h), x=ctx2(r); x.drawImage(c,0,0,w,h); const d=x.getImageData(0,0,w,h).data;
  const plein=(i,j)=>i>=0&&j>=0&&i<w&&j<h&&d[(j*w+i)*4+3]>110;
  let opaque=true; for(let q=3;q<d.length;q+=4) if(d[q]<=110){ opaque=false; break; }
  if(opaque) return [[0,0],[1,0],[1,1],[0,1]];
  // bord extérieur : on part du premier pixel plein (balayage) et on suit le contour (voisinage de Moore)
  let s=null; for(let j=0;j<h&&!s;j++) for(let i=0;i<w;i++) if(plein(i,j)){ s=[i,j]; break; }
  if(!s) return [[0,0],[1,0],[1,1],[0,1]];
  const dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]], pts=[]; let p=s, dir=6, garde=0;
  do{ pts.push(p); let trouve=false;
    for(let t=0;t<8;t++){ const dd=(dir+6+t)%8, q=[p[0]+dirs[dd][0],p[1]+dirs[dd][1]]; if(plein(q[0],q[1])){ p=q; dir=dd; trouve=true; break; } }
    if(!trouve) break;
  } while((p[0]!==s[0]||p[1]!==s[1])&&++garde<20000);
  const simple=dp(pts.map(([i,j])=>[(i+0.5)/w,1-(j+0.5)/h]),0.8/n);
  return simple.length>=3?simple.map(([u,v])=>[+u.toFixed(4),+v.toFixed(4)]):[[0,0],[1,0],[1,1],[0,1]];
}
function dp(pts,tol){
  if(pts.length<4) return pts;
  const garder=new Uint8Array(pts.length); garder[0]=garder[pts.length-1]=1; const pile3=[[0,pts.length-1]];
  while(pile3.length){ const [a,b]=pile3.pop(); let m=-1, dm=tol;
    for(let i=a+1;i<b;i++){ const [x,y]=pts[i], [x1,y1]=pts[a], [x2,y2]=pts[b], L=Math.hypot(x2-x1,y2-y1)||1e-9, d=Math.abs((x2-x1)*(y1-y)-(x1-x)*(y2-y1))/L; if(d>dm){ dm=d; m=i; } }
    if(m>0){ garder[m]=1; pile3.push([a,m],[m,b]); } }
  return pts.filter((_,i)=>garder[i]);
}
function dominante(c){
  const d=ctx2(c).getImageData(0,0,c.width,c.height).data; let r=0,g=0,b=0,n=0;
  for(let q=0;q<d.length;q+=16) if(d[q+3]>200){ r+=d[q]; g+=d[q+1]; b+=d[q+2]; n++; }
  if(!n) return '#b8b0a4'; const h=v=>Math.round(v/n).toString(16).padStart(2,'0'); return '#'+h(r)+h(g)+h(b);
}
const versBlob=c=>new Promise(ok=>c.toBlob(b=>{ if(b&&b.type==='image/webp') ok(b); else c.toBlob(ok,'image/png'); },'image/webp',0.9));

// ---------- la fenêtre ----------
function dire(t,erreur=false){ const m=fen.querySelector('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',erreur); }
function majBoutons(){
  if(!fen) return; const a=!!src;
  fen.querySelector('.ph-source').hidden=a; fen.querySelector('.ph-edition').hidden=!a;
  fen.querySelector('#ph-annuler').disabled=!pile.length;
  for(const b of fen.querySelectorAll('[data-outil]')) b.setAttribute('aria-pressed',String(outil===b.dataset.outil));
  fen.querySelector('.ph-gomme').hidden=outil!=='gomme'; fen.querySelector('.ph-recadrer').hidden=outil!=='recadrer'; fen.querySelector('.ph-fond').hidden=outil!=='fond';
  fen.querySelector('.ph-ia').hidden=outil!=='ia';
  if(!cadre) fen.querySelector('.ph-cadre').hidden=true;
  dessiner();
}
function dessiner(){ if(!src) return; const v=fen.querySelector('#ph-vue'); v.width=src.width; v.height=src.height; const x=ctx2(v); x.clearRect(0,0,v.width,v.height); x.drawImage(src,0,0); }
async function prendre(blob){
  if(!blob||!/^image\//.test(blob.type)){ dire('Ce n’est pas une image : copiez l’image elle-même (clic droit sur la photo, « Copier l’image »).',true); return; }
  try{ src=await charger(blob); }catch{ dire('Cette image n’a pas pu être lue.',true); return; }
  origine=copie(src); pile=[]; outil=null; cadre=null; ratio=src.height/src.width; dire('');
  const L=lireCm('#ph-l')||80; fen.querySelector('#ph-h').value=String(Math.round(L*ratio)); majBoutons();
}
const lireCm=sel=>{ const v=Number(String(fen.querySelector(sel).value).replace(',','.')); return Number.isFinite(v)&&v>0?v:null; };
async function coller(){
  try{
    const items=await navigator.clipboard.read();
    for(const it of items){ const t=it.types.find(x=>x.startsWith('image/')); if(t){ await prendre(await it.getType(t)); return; } }
    dire('Le presse-papiers ne contient pas d’image : sur le site du magasin, appui long (ou clic droit) sur la photo, « Copier l’image ».',true);
  }catch{ dire('Le navigateur refuse de lire le presse-papiers : utilisez Ctrl+V, ou « Choisir une photo ».',true); }
}
function point(e){ const v=fen.querySelector('#ph-vue'), r=v.getBoundingClientRect(); return [(e.clientX-r.left)*v.width/r.width,(e.clientY-r.top)*v.height/r.height]; }
function construireFenetre(){
  fen=el('div',{id:'photo-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Ajouter un objet d’après une photo'});
  fen.innerHTML=`<div class="fenetre-carte">
    <div class="fenetre-tete"><h2>Objet d’après une photo</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <div class="ph-source">
      <p>Sur le site du magasin : clic droit (ou appui long sur la tablette) sur la photo du meuble, « Copier l’image », puis :</p>
      <div class="ph-boutons"><button type="button" class="btn primary" id="ph-coller">Coller l’image</button>
        <label class="btn">Choisir une photo<input type="file" accept="image/*" id="ph-fichier" hidden></label></div>
      <p class="mat-aide">Sur PC, Ctrl+V marche aussi. Vous pouvez aussi glisser l’image dans cette fenêtre.</p>
    </div>
    <div class="ph-edition" hidden>
      <div class="ph-outils" role="group" aria-label="Retouches (sur demande)">
        <button type="button" class="btn" data-outil="recadrer" aria-pressed="false">Recadrer</button>
        <button type="button" class="btn" data-outil="gomme" aria-pressed="false">Gomme</button>
        <button type="button" class="btn" data-outil="fond" aria-pressed="false">Retirer le fond</button>
        <button type="button" class="btn" data-outil="ia" aria-pressed="false">Nettoyer (IA)</button>
      </div>
      <div class="ph-recadrer" hidden><span>Tracez un cadre sur la photo.</span><button type="button" class="btn primary" id="ph-recadrer-ok" disabled>Recadrer</button></div>
      <div class="ph-gomme" hidden><label>Taille de la gomme <input type="range" id="ph-gomme-taille" min="4" max="80" value="24"></label><span class="mat-aide">Passez sur ce qui est en trop.</span></div>
      <div class="ph-fond" hidden><label>Tolérance <input type="range" id="ph-tol" min="8" max="140" value="42"></label><button type="button" class="btn primary" id="ph-fond-ok">Garder</button></div>
      <div class="ph-ia" hidden><p>Envoyer la photo à l’IA (kie.ai) pour ne garder que le meuble, sur fond blanc ? Cela consomme quelques crédits.</p>
        <div class="ph-boutons"><button type="button" class="btn primary" id="ph-ia-ok">Oui, nettoyer</button><button type="button" class="btn" id="ph-ia-non">Non</button></div></div>
      <div class="ph-zone"><canvas id="ph-vue" aria-label="Photo"></canvas><div class="ph-cadre" hidden></div></div>
      <div class="ph-boutons petits"><button type="button" class="btn" id="ph-annuler">↶ Annuler</button><button type="button" class="btn" id="ph-recommencer">Photo d’origine</button><button type="button" class="btn" id="ph-autre">Autre photo</button></div>
      <div class="ph-mesures">
        <label class="dimrow"><span>Nom</span><input type="text" id="ph-nom" maxlength="60" placeholder="Fauteuil, lampe…"></label>
        <label class="dimrow"><span>Largeur</span><input type="number" id="ph-l" min="1" max="2000" step="0.5" value="80"><span class="unite">cm</span></label>
        <label class="dimrow"><span>Profondeur</span><input type="number" id="ph-p" min="1" max="2000" step="0.5" value="50"><span class="unite">cm</span></label>
        <label class="dimrow"><span>Hauteur</span><input type="number" id="ph-h" min="1" max="2000" step="0.5" value="80"><span class="unite">cm</span></label>
        <label class="crans"><input type="checkbox" id="ph-ratio" checked> Hauteur d’après la photo (largeur × proportions)</label>
      </div>
      <p class="ph-message" role="status"></p>
      <div class="ph-tripo" hidden><p>Tripo va créer un vrai modèle 3D d’après cette photo (1 à 3 minutes). Cela consomme des crédits Tripo<span class="ph-solde"></span>.</p>
        <p class="mat-aide">Meilleur résultat : le meuble seul, entier, sur un fond uni (« Nettoyer (IA) » d’abord si besoin).</p>
        <div class="ph-boutons"><button type="button" class="btn primary" id="ph-tripo-ok">Oui, créer en 3D</button><button type="button" class="btn" id="ph-tripo-non">Non</button></div></div>
      <div class="ph-final">
        <button type="button" class="btn primary wide" id="ph-tripo">Créer en 3D (Tripo)</button>
        <button type="button" class="btn wide" id="ph-ajouter">Ajouter en photo (juste de face)</button>
      </div>
    </div></div>`;
  document.body.append(fen);
  const q=s=>fen.querySelector(s);
  q('.fermer').onclick=()=>ouvrirPhoto(false);
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') ouvrirPhoto(false); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen) ouvrirPhoto(false); });
  q('#ph-coller').onclick=coller;
  q('#ph-fichier').onchange=e=>{ const f=e.target.files?.[0]; if(f) prendre(f); e.target.value=''; };
  fen.addEventListener('dragover',e=>e.preventDefault());
  fen.addEventListener('drop',e=>{ e.preventDefault(); const f=[...(e.dataTransfer?.files||[])].find(x=>/^image\//.test(x.type)); if(f) prendre(f); else dire('Glissez un fichier image (enregistrez d’abord l’image depuis le site si besoin).',true); });
  addEventListener('paste',e=>{ if(!fen||fen.hidden) return; const f=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'))?.getAsFile(); if(f){ e.preventDefault(); prendre(f); } });
  for(const b of fen.querySelectorAll('[data-outil]')) b.onclick=()=>choisirOutil(outil===b.dataset.outil?null:b.dataset.outil);
  q('#ph-annuler').onclick=()=>{ if(!pile.length) return; src=pile.pop(); fondAvant=null; outil=null; majBoutons(); };
  q('#ph-recommencer').onclick=()=>{ if(!origine) return; memoriser(); src=copie(origine); outil=null; majBoutons(); };
  q('#ph-autre').onclick=()=>{ src=null; origine=null; pile=[]; outil=null; majBoutons(); };
  // recadrer : tracer un cadre
  const vue=q('#ph-vue'); let tir=null;
  vue.addEventListener('pointerdown',e=>{ if(outil==='recadrer'){ tir=point(e); cadre=[...tir,...tir]; vue.setPointerCapture(e.pointerId); majCadre(); }
    else if(outil==='gomme'){ memoriser(); tir=point(e); gommer(tir,tir); vue.setPointerCapture(e.pointerId); } });
  vue.addEventListener('pointermove',e=>{ if(!tir) return; const p=point(e);
    if(outil==='recadrer'){ cadre[2]=p[0]; cadre[3]=p[1]; majCadre(); } else if(outil==='gomme'){ gommer(tir,p); tir=p; } });
  const lacher=()=>{ tir=null; if(outil==='recadrer') q('#ph-recadrer-ok').disabled=!cadre||Math.abs(cadre[2]-cadre[0])<8||Math.abs(cadre[3]-cadre[1])<8; };
  vue.addEventListener('pointerup',lacher); vue.addEventListener('pointercancel',lacher);
  q('#ph-recadrer-ok').onclick=()=>{ if(!cadre) return; const x0=Math.max(0,Math.min(cadre[0],cadre[2])), y0=Math.max(0,Math.min(cadre[1],cadre[3])), x1=Math.min(src.width,Math.max(cadre[0],cadre[2])), y1=Math.min(src.height,Math.max(cadre[1],cadre[3]));
    memoriser(); const r=toile(x1-x0,y1-y0); ctx2(r).drawImage(src,x0,y0,r.width,r.height,0,0,r.width,r.height); src=r; cadre=null; outil=null; majHauteur(); majBoutons(); };
  // retirer le fond : aperçu à chaque réglage, « Garder » valide
  q('#ph-tol').oninput=()=>appliquerFond();
  q('#ph-fond-ok').onclick=()=>{ fondAvant=null; outil=null; majHauteur(); majBoutons(); };
  q('#ph-ia-non').onclick=()=>{ outil=null; majBoutons(); };
  q('#ph-ia-ok').onclick=lancerIA;
  // mesures
  q('#ph-l').oninput=()=>majHauteur();
  q('#ph-ratio').onchange=()=>majHauteur();
  for(const s of ['#ph-nom','#ph-l','#ph-p','#ph-h']) q(s).addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') e.target.blur(); });
  q('#ph-ajouter').onclick=ajouter;
  q('#ph-l').addEventListener('input',()=>{ largeurSaisie=true; });
  q('#ph-tripo').onclick=demanderTripo;
  q('#ph-tripo-non').onclick=()=>{ q('.ph-tripo').hidden=true; };
  q('#ph-tripo-ok').onclick=lancerTripo;
}
function majHauteur(){ if(!src||!fen.querySelector('#ph-ratio').checked) return; const r=rogner(src); ratio=r.height/r.width; const L=lireCm('#ph-l'); if(L) fen.querySelector('#ph-h').value=String(Math.round(L*ratio*2)/2); }
function majCadre(){ const v=fen.querySelector('#ph-vue'), c=fen.querySelector('.ph-cadre'); if(!cadre){ c.hidden=true; return; }
  const k=v.getBoundingClientRect().width/v.width, z=fen.querySelector('.ph-zone').getBoundingClientRect(), r=v.getBoundingClientRect();
  Object.assign(c.style,{left:(r.left-z.left+Math.min(cadre[0],cadre[2])*k)+'px',top:(r.top-z.top+Math.min(cadre[1],cadre[3])*k)+'px',width:Math.abs(cadre[2]-cadre[0])*k+'px',height:Math.abs(cadre[3]-cadre[1])*k+'px'}); c.hidden=false; }
function gommer(a,b){ const x=ctx2(src), t=+fen.querySelector('#ph-gomme-taille').value*src.width/600;
  x.save(); x.globalCompositeOperation='destination-out'; x.lineCap='round'; x.lineWidth=t*2; x.beginPath(); x.moveTo(a[0],a[1]); x.lineTo(b[0]+0.01,b[1]); x.stroke(); x.restore(); dessiner(); }
function choisirOutil(o){
  if(outil==='fond'&&fondAvant&&o!=='fond'){ src=fondAvant; fondAvant=null; pile.pop(); }   // aperçu du fond non gardé
  outil=o; cadre=null;
  if(o==='fond'){ memoriser(); fondAvant=copie(src); appliquerFond(); }
  if(o==='recadrer') fen.querySelector('#ph-recadrer-ok').disabled=true;
  majBoutons();
}
function appliquerFond(){ if(!fondAvant) return; const {c,uni}=retirerFond(fondAvant,+fen.querySelector('#ph-tol').value); src=c; dessiner();
  dire(uni?'Fond retiré : réglez la tolérance si besoin, puis « Garder ».':'Le fond n’a pas l’air uni : essayez la tolérance, la gomme ou « Nettoyer (IA) ».',!uni); }
async function lancerIA(){
  const b=fen.querySelector('#ph-ia-ok'); b.disabled=true; dire('Nettoyage par l’IA en cours (10 à 60 secondes)…');
  const r=await nettoyerPhoto(await versBlob(src),fen.querySelector('#ph-nom').value.trim());
  b.disabled=false;
  if(r.erreur){ dire(r.erreur,true); return; }
  memoriser(); src=await charger(r.blob); outil=null; majBoutons(); majHauteur();
  dire('Photo nettoyée par l’IA. Vous pouvez maintenant « Retirer le fond » (blanc) pour ne garder que le meuble.');
}
// vrai modèle 3D par Tripo : confirmation (solde affiché), puis création ; le modèle s'ouvre dans la fenêtre d'import 3D
// (dimensions : celles de Tripo, ou la largeur saisie ici avec les proportions du modèle)
let tripoEnCours=false, largeurSaisie=false;
async function demanderTripo(){
  if(!src||tripoEnCours) return;
  const t=fen.querySelector('.ph-tripo'), s=t.querySelector('.ph-solde'), ok=t.querySelector('#ph-tripo-ok'); t.hidden=false; s.textContent=' (solde : …)';
  const r=await soldeTripo();
  s.textContent=r.erreur?'':' (solde : '+Math.floor(r.solde).toLocaleString('fr-FR')+' crédits)';
  // solde vide : rien n'est envoyé (les crédits de l'application web Tripo ne servent pas pour l'API)
  ok.disabled=!r.erreur&&r.solde<=0;
  if(r.erreur) dire(r.erreur,true);
  else if(r.solde<=0) dire('Plus de crédits API chez Tripo : rechargez sur developers.tripo3d.ai (Billing). Les crédits du site Tripo ne servent pas ici.',true);
}
async function lancerTripo(){
  if(!src||tripoEnCours) return; tripoEnCours=true;
  fen.querySelector('.ph-tripo').hidden=true;
  const boutons=['#ph-tripo','#ph-ajouter'].map(x=>fen.querySelector(x)); boutons.forEach(b=>b.disabled=true);
  dire('Envoi de la photo à Tripo…');
  const fin=rogner(src), blob=await new Promise(ok=>fin.toBlob(ok,'image/png'));
  const nom=fen.querySelector('#ph-nom').value.trim().slice(0,60)||'Objet 3D', L=largeurSaisie?lireCm('#ph-l'):null;
  const r=await creer3D(blob,(p,st)=>dire(!p&&st!=='running'?'En file d’attente chez Tripo…':`Tripo crée le modèle 3D… ${p} %`));
  tripoEnCours=false; boutons.forEach(b=>b.disabled=false);
  if(r.erreur){ dire(r.erreur,true); return; }
  ouvrirPhoto(false); ouvrirImport(true);
  // Tripo exporte l'avant du modèle vers +x (export_orientation par défaut) : un quart de tour pour le mettre vers +z
  await importerModele(new File([r.blob],'tripo.glb',{type:'model/gltf-binary'}),{nom,largeur:L,tourner:-Math.PI/2,
    message:'Modèle 3D créé par Tripo'+(r.credits?` (${r.credits} crédits)`:'')+'. Vérifiez les dimensions (cm), puis « Ajouter ».'});
}
async function ajouter(){
  if(!src) return;
  const L=lireCm('#ph-l'), P=lireCm('#ph-p'), H=lireCm('#ph-h'); if(!L||!P||!H){ dire('Indiquez la largeur, la profondeur et la hauteur (en cm).',true); return; }
  const b=fen.querySelector('#ph-ajouter'); b.disabled=true; dire('Envoi de la photo…');
  const fin=rogner(src), k=contour(fin), c=dominante(fin), blob=await versBlob(fin), nom=fen.querySelector('#ph-nom').value.trim().slice(0,60)||'Objet (photo)';
  const r=await envoyerFichier(blob,{nom,type:'photo'});
  b.disabled=false;
  if(r.erreur){ dire(r.erreur,true); return; }
  const it=ajouterObjet({t:'photo',f:'photo',p:{L:+(L/100).toFixed(4),P:+(P/100).toFixed(4),H:+(H/100).toFixed(4)},img:{id:r.id,n:r.n,type:blob.type,w:fin.width,h:fin.height},k,c,n:nom});
  if(!it){ dire('L’objet n’a pas pu être ajouté.',true); return; }
  ouvrirPhoto(false);
}
export function ouvrirPhoto(oui=true){
  if(oui&&!fen) construireFenetre();
  if(!fen) return; fen.hidden=!oui;
  if(oui){ src=null; origine=null; pile=[]; outil=null; cadre=null; fondAvant=null; largeurSaisie=false; dire(''); fen.querySelector('#ph-nom').value=''; fen.querySelector('.ph-tripo').hidden=true; majBoutons(); setTimeout(()=>fen.querySelector('#ph-coller').focus()); }
}
