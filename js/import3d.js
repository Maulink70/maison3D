// Import d'un fichier 3D (étape 4, livraison 2) : un .glb téléchargé par Mauro (Tripo, site d'un fabricant…). Le site
// affiche la taille trouvée dans le fichier (et son unité supposée), on saisit les vraies dimensions (proportions gardées
// par défaut) ; avant l'envoi, le modèle est allégé dans le navigateur pour rester fluide sur la tablette : textures
// réduites à 1024 px, maillages trop détaillés simplifiés (120 000 triangles au plus, meshoptimizer), recentré (origine au
// centre du dessous), matériaux renommés « Partie n » (matières choisies partie par partie). Gardé dans Airtable
// (fichiers.js) ; à l'affichage, une boîte d'attente le temps de le relire, puis le modèle aux dimensions voulues.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {enFlottants} from './formes.js';
import {envoyerFichier, lireFichier} from './fichiers.js';
import {ajouterObjet} from './objets.js';

const TRIANGLES=120000, TEXTURE=1024;
let lecteur=null;
function chargeur(){
  if(lecteur) return lecteur;
  const d=new DRACOLoader(); d.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
  lecteur=new GLTFLoader(); lecteur.setDRACOLoader(d); lecteur.setMeshoptDecoder(MeshoptDecoder); return lecteur;
}
const lire=buf=>new Promise((ok,ko)=>chargeur().parse(buf,'',g=>ok(g.scene||g.scenes?.[0]),ko));
const boite=o=>{ o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };

// ---------- l'objet 3D ----------
const modeles=new Map();
function modele(f){
  if(!modeles.has(f.id)) modeles.set(f.id,(async()=>{ const b=await lireFichier(f.id,f.n||1,'model/gltf-binary'); if(!b){ modeles.delete(f.id); return null; }
    try{ return await lire(await b.arrayBuffer()); }catch{ modeles.delete(f.id); return null; } })());
  return modeles.get(f.id);
}
export function construireGLB(a){
  const {L,P,H}=a.p, g=new THREE.Group();
  const att=new THREE.Mesh(new THREE.BoxGeometry(L,H,P).translate(0,H/2,0),new THREE.MeshStandardMaterial({color:0xc9ced3,transparent:true,opacity:0.45,depthWrite:false}));
  att.userData.attente=true; att.raycast=()=>{}; g.add(att);
  const pret=a.fic?.id?modele(a.fic).then(m=>{ if(!m) return false;
    const c=m.clone(true), d=a.d||[1,1,1]; c.scale.set(L/d[0],H/d[1],P/d[2]); g.remove(att); att.geometry.dispose(); g.add(c);
    const noms={}; c.traverse(o=>{ if(o.isMesh&&!Array.isArray(o.material)) noms[o.material.name]=o.material.name; }); g.userData.noms=noms; return true; }):null;
  return {g,noms:{},taille:new THREE.Vector3(L,H,P),pret};
}

// ---------- allègement ----------
let simplificateur=null;
async function simplifier(racine,dire){
  const meshes=[]; racine.traverse(o=>{ if(o.isMesh) meshes.push(o); });
  let total=0; for(const m of meshes){ const g=m.geometry; total+=(g.index?g.index.count:g.attributes.position.count)/3; }
  if(total<=TRIANGLES) return total;
  dire(`Modèle très détaillé (${Math.round(total).toLocaleString('fr-FR')} triangles) : simplification…`);
  if(!simplificateur){ const {MeshoptSimplifier}=await import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready; simplificateur=MeshoptSimplifier; }
  const r=TRIANGLES/total; let apres=0;
  for(const m of meshes){
    let g=enFlottants(m.geometry); if(!g.index) g=mergeVertices(g,1e-6);
    const pos=g.attributes.position.array, idx=new Uint32Array(g.index.array), cible=Math.max(3,Math.floor(idx.length*r/3)*3);
    const [nouv]=simplificateur.simplify(idx,pos instanceof Float32Array?pos:new Float32Array(pos),3,cible,0.02);
    g.setIndex(new THREE.BufferAttribute(nouv,1)); m.geometry=g; apres+=nouv.length/3;
  }
  return apres;
}
function reduireTextures(racine){
  const vues=new Set();
  racine.traverse(o=>{ if(!o.isMesh) return; for(const mat of [].concat(o.material)) for(const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','alphaMap']){
    const t=mat[k]; if(!t||vues.has(t)||!t.image) continue; vues.add(t); const im=t.image, w=im.width, h=im.height; if(!w||!h) continue;
    const s=Math.min(1,TEXTURE/Math.max(w,h)); const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w*s)); c.height=Math.max(1,Math.round(h*s));
    c.getContext('2d').drawImage(im,0,0,c.width,c.height); t.image=c; t.needsUpdate=true;
    t.userData.mimeType=k==='map'&&mat.transparent?'image/png':'image/jpeg'; } });
}
async function preparer(scene,dire){
  // une seule racine, recentrée : origine au centre du dessous ; matériaux nommés « Partie n »
  const b=boite(scene), c=b.getCenter(new THREE.Vector3()), racine=new THREE.Group(); racine.name='modele';
  scene.position.sub(new THREE.Vector3(c.x,b.min.y,c.z)); racine.add(scene);
  const mats=new Map(); let n=0;
  scene.traverse(o=>{ if(!o.isMesh) return; if(Array.isArray(o.material)) o.material=o.material[0];   // un matériau par maillage
    if(!mats.has(o.material)){ o.material.name='Partie '+(++n); mats.set(o.material,1); } o.skeleton=null; o.morphTargetInfluences=undefined; });
  const triangles=await simplifier(racine,dire); reduireTextures(racine);
  dire('Préparation du fichier…');
  const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  const buf=await new GLTFExporter().parseAsync(racine,{binary:true,maxTextureSize:TEXTURE,onlyVisible:true});
  return {blob:new Blob([buf],{type:'model/gltf-binary'}),triangles,parties:n};
}

// ---------- la fenêtre ----------
const el=(nom,attrs={},texte)=>{ const n=document.createElement(nom); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(texte!==undefined) n.textContent=texte; return n; };
let fen=null, charge=null;   // {scene, d:[w,h,p] dans l'unité du fichier, nom, taille}
const UNITES={m:1,cm:0.01,mm:0.001};
function dire(t,erreur=false){ const m=fen.querySelector('.ph-message'); m.textContent=t||''; m.classList.toggle('cx-erreur',erreur); }
const cm=v=>String(Math.round(v*1000)/10).replace('.',',');
const lireCm=sel=>{ const v=Number(String(fen.querySelector(sel).value).replace(',','.')); return Number.isFinite(v)&&v>0?v:null; };
function majDims(depuis){
  if(!charge) return; const u=UNITES[fen.querySelector('#g3-unite').value], [w,h,p]=charge.d.map(v=>v*u);
  if(!depuis){ fen.querySelector('#g3-l').value=cm(w).replace(',','.'); fen.querySelector('#g3-p').value=cm(p).replace(',','.'); fen.querySelector('#g3-h').value=cm(h).replace(',','.'); return; }
  if(!fen.querySelector('#g3-prop').checked) return;
  const v=lireCm('#g3-'+depuis); if(!v) return; const k=v/100/({l:w,p,h}[depuis]);
  for(const [q,x] of [['l',w],['p',p],['h',h]]) if(q!==depuis) fen.querySelector('#g3-'+q).value=String(Math.round(x*k*1000)/10);
}
async function prendre(f){
  if(!f||!/\.glb$/i.test(f.name)){ dire('Choisissez un fichier .glb (Tripo : « Download », format GLB).',true); return; }
  dire('Lecture du fichier…'); fen.querySelector('.g3-info').hidden=true;
  try{ const scene=await lire(await f.arrayBuffer()); const b=boite(scene), s=b.getSize(new THREE.Vector3());
    if(b.isEmpty()||!(s.x>0)) throw new Error('vide');
    let tri=0, tex=new Set(); scene.traverse(o=>{ if(o.isMesh){ const g=o.geometry; tri+=(g.index?g.index.count:g.attributes.position.count)/3; for(const m of [].concat(o.material)) if(m.map) tex.add(m.map); } });
    charge={scene,d:[s.x,s.y,s.z],nom:f.name.replace(/\.glb$/i,'').replace(/[_-]+/g,' ').slice(0,60),taille:f.size};
    const max=Math.max(s.x,s.y,s.z); fen.querySelector('#g3-unite').value=max>300?'mm':max>8?'cm':'m';
    fen.querySelector('#g3-nom').value=charge.nom;
    fen.querySelector('.g3-detail').textContent=`${(f.size/1048576).toFixed(1).replace('.',',')} Mo · ${Math.round(tri).toLocaleString('fr-FR')} triangles · ${tex.size} texture${tex.size>1?'s':''} · taille dans le fichier : ${[s.x,s.z,s.y].map(v=>v.toFixed(2).replace('.',',')).join(' × ')} (L × P × H)`;
    majDims(); fen.querySelector('.g3-info').hidden=false; dire('Vérifiez les dimensions (en cm), puis « Ajouter ».');
  }catch(e){ charge=null; dire('Ce fichier .glb n’a pas pu être lu.',true); }
}
// modèle reçu d'ailleurs (Tripo, depuis le panneau photo) : lu comme un fichier choisi, nom et largeur repris (proportions
// du modèle gardées)
export async function importerModele(f,{nom,largeur,message}={}){
  await prendre(f); if(!charge) return false;
  if(nom) fen.querySelector('#g3-nom').value=nom;
  if(largeur){ fen.querySelector('#g3-prop').checked=true; fen.querySelector('#g3-l').value=String(largeur); majDims('l'); }
  if(message) dire(message);
  return true;
}
async function ajouter(){
  if(!charge) return; const L=lireCm('#g3-l'), P=lireCm('#g3-p'), H=lireCm('#g3-h'); if(!L||!P||!H){ dire('Indiquez les trois dimensions (cm).',true); return; }
  const b=fen.querySelector('#g3-ajouter'); b.disabled=true;
  try{
    dire('Allègement du modèle…'); const {blob,triangles,parties}=await preparer(charge.scene,dire);
    const relu=await lire(await blob.arrayBuffer()), s=boite(relu).getSize(new THREE.Vector3());
    dire(`Envoi (${(blob.size/1048576).toFixed(1).replace('.',',')} Mo, ${Math.round(triangles).toLocaleString('fr-FR')} triangles)…`);
    const nom=fen.querySelector('#g3-nom').value.trim().slice(0,60)||'Objet 3D';
    const r=await envoyerFichier(blob,{nom,type:'glb'}); if(r.erreur){ dire(r.erreur,true); return; }
    const it=ajouterObjet({t:'glb',f:'glb',p:{L:+(L/100).toFixed(4),P:+(P/100).toFixed(4),H:+(H/100).toFixed(4)},fic:{id:r.id,n:r.n},d:[+s.x.toFixed(5),+s.y.toFixed(5),+s.z.toFixed(5)],n:nom});
    if(!it){ dire('L’objet n’a pas pu être ajouté.',true); return; }
    ouvrirImport(false);
  }catch(e){ dire('Préparation impossible : '+(e?.message||e),true); }
  finally{ b.disabled=false; }
}
function construireFenetre(){
  fen=el('div',{id:'import-fenetre',class:'fenetre',role:'dialog','aria-modal':'true','aria-label':'Ajouter un objet 3D (fichier .glb)'});
  fen.innerHTML=`<div class="fenetre-carte">
    <div class="fenetre-tete"><h2>Objet 3D (fichier .glb)</h2><button type="button" class="fermer" aria-label="Fermer">×</button></div>
    <p>Un fichier .glb fait sur Tripo (« Download », format GLB) ou téléchargé chez un fabricant.</p>
    <div class="ph-boutons"><label class="btn primary">Choisir un fichier .glb<input type="file" accept=".glb,model/gltf-binary" id="g3-fichier" hidden></label></div>
    <div class="g3-info" hidden>
      <p class="mat-aide g3-detail"></p>
      <label class="dimrow"><span>Unité du fichier</span><select id="g3-unite"><option value="m">mètres</option><option value="cm">centimètres</option><option value="mm">millimètres</option></select></label>
      <label class="dimrow"><span>Nom</span><input type="text" id="g3-nom" maxlength="60"></label>
      <label class="dimrow"><span>Largeur</span><input type="number" id="g3-l" min="1" max="2000" step="0.5"><span class="unite">cm</span></label>
      <label class="dimrow"><span>Profondeur</span><input type="number" id="g3-p" min="1" max="2000" step="0.5"><span class="unite">cm</span></label>
      <label class="dimrow"><span>Hauteur</span><input type="number" id="g3-h" min="1" max="2000" step="0.5"><span class="unite">cm</span></label>
      <label class="crans"><input type="checkbox" id="g3-prop" checked> Garder les proportions du modèle</label>
      <button type="button" class="btn primary wide" id="g3-ajouter">Ajouter à la maquette</button>
    </div>
    <p class="ph-message" role="status"></p></div>`;
  document.body.append(fen);
  const q=s=>fen.querySelector(s);
  q('.fermer').onclick=()=>ouvrirImport(false);
  fen.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') ouvrirImport(false); });
  fen.addEventListener('pointerdown',e=>{ if(e.target===fen) ouvrirImport(false); });
  q('#g3-fichier').onchange=e=>{ const f=e.target.files?.[0]; if(f) prendre(f); e.target.value=''; };
  fen.addEventListener('dragover',e=>e.preventDefault());
  fen.addEventListener('drop',e=>{ e.preventDefault(); const f=[...(e.dataTransfer?.files||[])][0]; if(f) prendre(f); });
  q('#g3-unite').onchange=()=>majDims();
  for(const k of ['l','p','h']){ q('#g3-'+k).oninput=()=>majDims(k); q('#g3-'+k).addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') e.target.blur(); }); }
  q('#g3-nom').addEventListener('keydown',e=>e.stopPropagation());
  q('#g3-ajouter').onclick=ajouter;
}
export function ouvrirImport(oui=true){
  if(oui&&!fen) construireFenetre(); if(!fen) return; fen.hidden=!oui;
  if(oui){ charge=null; fen.querySelector('.g3-info').hidden=true; dire(''); }
}
// pour les tests : préparer un fichier sans passer par la fenêtre
export const _preparer=preparer, _lire=lire;
