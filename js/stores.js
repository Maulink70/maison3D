// Stores et rideaux (14 octobre 2026, demande de Mauro : « en plus des fenêtres, des portes et du rideau de douche, ouvrir
// et fermer les stores ; s'il est tagué store ou rideau, il peut se relever, comme les lampes ») : tout le store monte ou
// descend (les lames se rangent en paquet en haut, pas d'orientation des lames : Mauro, même jour) ; un rideau se tire sur
// le côté (il se replie vers l'origine de son nœud dans Blender, sinon vers son bout gauche). Est un store un objet dont le
// nom contient « store », « volet », « plissé » ou « jalousie » ; un rideau, « rideau » ; ou tout objet coché « Store ou
// rideau » dans le panneau (Plus), comme « C'est une lampe » (clé maison3d-stores). Au chargement tout est remonté (vue et
// lumière, choix de Mauro) ; rien n'est enregistré, comme les portes. Baissé, un store descend jusqu'au bas de la fenêtre
// qu'il couvre, même s'il est dessiné à mi-hauteur ; un store intérieur posé sur l'ouvrant d'une fenêtre faite dans
// Blender suit la fenêtre quand elle bascule. Visite : toucher le store ; Éditer : bouton du panneau ; bouton « Stores »
// de la barre (seulement s'il y en a) : tout remonter ou tout baisser.
import * as THREE from 'three';
import {app, $} from './app.js';
import {ouvrantsDe} from './portes.js';
import {rideauDe} from './etage_pieces.js';
import {ouvrantsCopies} from './ouvrants3d.js';
import {nommer} from './icones.js';

const CLE='maison3d-stores', DUREE=1.6;
let choix={}; try{ choix=JSON.parse(localStorage.getItem(CLE)||'{}')||{}; }catch{ choix={}; }
const garder=()=>{ try{ localStorage.setItem(CLE,JSON.stringify(choix)); }catch{} };
const etats=new Map();   // nom de l'élément → état du store (pièce qui bouge, repos, paquet, position)
const simple=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const nomDe=it=>simple(it.meta?.l)+' '+simple(it.ajout?.fic?.n)+' '+simple(it.ajout?.n);
// les portes, fenêtres (ouvrants de la maquette) et le rideau de douche de la maquette ont déjà leur mécanique
const exclu=it=>!it||ouvrantsDe(it.name).length>0||!!rideauDe(it.name);
const parNom=it=>!!it.ajout&&/store|volet|pliss|jalousie|rideau/.test(nomDe(it));
export const estStore=it=>!exclu(it)&&(choix[it.name]?.store??parNom(it));
const sorte=it=>/rideau/.test(nomDe(it))?'rideau':'store';

// ---------- préparation : la pièce qui bouge, sa boîte au repos, le bas de la fenêtre ----------
const boiteDans=(objet,repere)=>{ const b=new THREE.Box3(), inv=repere.matrixWorld.clone().invert(), m=new THREE.Matrix4();
  objet.updateWorldMatrix(true,true);
  objet.traverse(o=>{ if(!o.isMesh||o.userData.attente||o.name==='alerte') return; o.geometry.computeBoundingBox();
    b.union(o.geometry.boundingBox.clone().applyMatrix4(m.multiplyMatrices(inv,o.matrixWorld))); });
  return b; };
// la forme (objet ajouté : modèle dans son groupe « __forme ») ou le nœud de la maquette
function pieceDe(it){
  const f=it.g.getObjectByName(it.name+'__forme');
  if(f){ const c=f.children.find(o=>!o.userData.attente&&o.name!=='alerte'); return c?{forme:f,corps:c}:null; }
  const c=it.g.children.find(o=>o.name===it.name)||it.g.children[0]; return c?{forme:null,corps:c}:null;
}
// bas de la fenêtre que couvre le store (la fenêtre la plus proche : même largeur, à moins de 40 cm devant ou derrière)
function basFenetre(it,bw){
  let bas=null, mieux=0;
  for(const f of Object.values(app.items)){
    if(f===it||f.meta.c!=='ouverture'||!/fenetre|baie|element_mural|porte_fenetre|velux/i.test(f.name+' '+nomDe(f))) continue;
    const b=new THREE.Box3().setFromObject(f.g); if(b.isEmpty()) continue;
    const lx=Math.min(bw.max.x,b.max.x)-Math.max(bw.min.x,b.min.x), lz=Math.min(bw.max.z,b.max.z)-Math.max(bw.min.z,b.min.z);
    const large=Math.max(lx/(bw.max.x-bw.min.x||1),lz/(bw.max.z-bw.min.z||1)), proche=Math.min(lx,lz)>-0.4;
    if(!proche||large<0.5||b.max.y<bw.min.y||b.min.y>bw.max.y) continue;
    if(large>mieux){ mieux=large; bas=b.min.y; } }
  return bas;
}
function preparer(it){
  const p=pieceDe(it); if(!p) return null;
  const {forme,corps}=p, repere=corps.parent; repere.updateWorldMatrix(true,false);
  const b=boiteDans(corps,repere); if(b.isEmpty()) return null;
  const s={it, sorte:sorte(it), forme, corps, repos:corps.matrix.clone(), b, t:1, cible:1, suit:null};
  if(s.sorte==='store'){
    const H=b.max.y-b.min.y||0.01, bw=boiteDans(corps,app.scene);
    let bas=basFenetre(it,bw); const y0=repere.matrixWorld.elements[13];   // le repère ne tourne qu'autour de la verticale
    s.kBas=bas===null?1:Math.max(1,(b.max.y-(bas-y0))/H); s.kHaut=Math.min(0.5,Math.max(0.06,0.07*H*s.kBas)/H);
  } else {
    const lx=b.max.x-b.min.x, lz=b.max.z-b.min.z; s.axe=lx>=lz?'x':'z'; const L=Math.max(lx,lz)||0.01;
    // côté où il se replie : l'origine du nœud de Blender (premier nœud nommé du modèle), sinon le bout « gauche »
    // (export de Blender : « nom » à l'origine choisie, son maillage « nom_Corps » décalé dessous)
    let ancre=b.min[s.axe], n=null; corps.traverse(o=>{ if(!n&&/_corps$/i.test(o.name||'')&&o.parent) n=o.parent; });
    if(n){ const o=new THREE.Vector3().setFromMatrixPosition(n.matrixWorld).applyMatrix4(repere.matrixWorld.clone().invert())[s.axe];
      if(Math.abs(o-(b.min[s.axe]+b.max[s.axe])/2)>0.2*L) ancre=o<(b.min[s.axe]+b.max[s.axe])/2?b.min[s.axe]:b.max[s.axe]; }
    s.ancre=ancre; s.kBas=1; s.kHaut=Math.min(0.5,Math.max(0.12,0.2*L)/L);
  }
  return s;
}
// pièce qui bouge : écrasée autour du haut (store) ou du côté du repli (rideau)
const A=new THREE.Matrix4(), T=new THREE.Matrix4(), S=new THREE.Matrix4();
const lisse=x=>x*x*(3-2*x);
function poser(s){
  const k=s.kBas+(s.kHaut-s.kBas)*lisse(s.t);
  if(s.sorte==='store'){ const y=s.b.max.y; A.makeTranslation(0,y,0).multiply(S.makeScale(1,k,1)).multiply(T.makeTranslation(0,-y,0)); }
  else { const a=s.ancre, v=s.axe==='x'?[a,0,0]:[0,0,a]; A.makeTranslation(...v).multiply(S.makeScale(s.axe==='x'?k:1,1,s.axe==='z'?k:1)).multiply(T.makeTranslation(...v.map(x=>-x))); }
  s.corps.matrix.multiplyMatrices(A,s.repos); s.corps.matrix.decompose(s.corps.position,s.corps.quaternion,s.corps.scale);
}
// store intérieur sur l'ouvrant d'une fenêtre de Blender : il bascule avec lui (mouvement du nœud de l'ouvrant)
function rattacher(s){
  if(!s.forme||s.suit) return;
  const c=boiteDans(s.corps,app.scene).getCenter(new THREE.Vector3());
  for(const q of ouvrantsCopies()){ if(!q.def.fenetre) continue;
    q.pivot.updateWorldMatrix(true,true); const b=new THREE.Box3().setFromObject(q.pivot).expandByScalar(0.06); if(!b.containsPoint(c)) continue;
    const N0=q.pivot.parent.matrixWorld.clone().multiply(q.L0), F0=s.forme.matrix.clone();
    s.suit=q; q.suiveurs.push(s);
    s.suivre=()=>{ if(!s.forme.parent) return; q.pivot.updateWorldMatrix(true,false); const P=s.it.g.matrixWorld;
      const D=q.pivot.matrixWorld.clone().multiply(N0.clone().invert());
      s.forme.matrix.copy(P.clone().invert().multiply(D).multiply(P).multiply(F0)); s.forme.matrix.decompose(s.forme.position,s.forme.quaternion,s.forme.scale); };
    return; }
}

// ---------- liste des stores (à chaque changement des meubles) ----------
export function majListeStores(){
  for(const [n,s] of [...etats]){ const it=app.items[n], p=it&&pieceDe(it);
    if(!it||!p||p.corps!==s.corps){ etats.delete(n); continue; }   // objet supprimé ou refait (nouvelles dimensions)
    if(!estStore(it)){ poserRepos(s); etats.delete(n); } }
  for(const it of Object.values(app.items)){ if(etats.has(it.name)||!estStore(it)) continue;
    if(it.ajout?.t==='glb'&&!it.g.getObjectByName(it.name+'__forme')?.children.some(o=>!o.userData.attente)) continue;   // modèle pas encore là
    const s=preparer(it); if(!s) continue; etats.set(it.name,s); poser(s); }
  for(const s of etats.values()) rattacher(s);
  majBoutonStores();
}
const poserRepos=s=>{ s.corps.matrix.copy(s.repos); s.corps.matrix.decompose(s.corps.position,s.corps.quaternion,s.corps.scale); };
export const storeDe=it=>it?etats.get(it.name)||null:null;
export function basculerStore(s){ s.cible=s.cible?0:1; majBoutonStores(); }
// À chaque image : stores en mouvement
export function majStores(dt){
  for(const s of etats.values()){ if(s.t===s.cible) continue;
    const pas=dt/DUREE; s.t=s.cible>s.t?Math.min(s.cible,s.t+pas):Math.max(s.cible,s.t-pas); poser(s); }
}
// case « Store ou rideau » du panneau
export function marquerStore(it,oui){
  const s=etats.get(it.name); if(s&&!oui){ poserRepos(s); etats.delete(it.name); }
  choix[it.name]={...choix[it.name],store:oui}; garder(); majListeStores(); majPanneauStore(); }
export function majPanneauStore(){
  const it=app.selected, l=$('t-store-l'), c=$('t-store'); if(!l||!it) return;
  l.hidden=exclu(it); c.checked=estStore(it); }
export const texteStore=s=>s.sorte==='rideau'?(s.cible?'Tirer le rideau':'Ouvrir le rideau'):(s.cible?'Baisser le store':'Remonter le store');

// ---------- bouton « Stores » de la barre ----------
const visibles=()=>[...etats.values()].filter(s=>s.sorte==='store'&&!s.it.hidden);
function majBoutonStores(){
  const b=$('stores'); if(!b) return; const l=visibles(); b.hidden=!l.length; if(!l.length) return;
  const baisses=l.some(s=>!s.cible); b.setAttribute('aria-pressed',String(baisses)); nommer(b,baisses?'Remonter les stores':'Baisser les stores'); }
export function initStores(){
  const b=$('stores');
  if(b) b.onclick=()=>{ const l=visibles(), monter=l.some(s=>!s.cible); for(const s of l) s.cible=monter?1:0; majBoutonStores(); };
  for(const e of ['objet-pret','meubles','disposition','variantes']) addEventListener(e,()=>majListeStores());
  $('t-store')?.addEventListener('change',e=>{ if(app.selected) marquerStore(app.selected,e.target.checked); });
}
