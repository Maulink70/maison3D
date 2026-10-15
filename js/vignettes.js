// Vignettes des meubles dans la liste du tiroir (audit du 15 octobre 2026, « ok on fait » de Mauro : la liste n'était qu'une
// colonne de noms). Chaque meuble est dessiné une fois, de trois quarts, par le vrai moteur 3D dans une petite cible
// (192 px, fond transparent : lisible en thème clair et sombre), seulement quand sa ligne arrive à l'écran, trois par image
// au plus ; l'image est gardée en mémoire (par nom) et refaite si l'aspect ou la forme de l'objet change.
import * as THREE from 'three';
import {app} from './app.js';

const T=192, L=29;
let rt=null, cam=null, pix=null, cv=null;
const cache=new Map();          // nom du meuble → adresse de l'image (data URL)
const attente=[];               // meubles dont la vignette est demandée, dans l'ordre
let planifie=false;
const vers=new THREE.Vector3(), centre=new THREE.Vector3(), taille=new THREE.Vector3(), haut=new THREE.Vector3(0,1,0);

export function invaliderVignette(nom){ if(nom) cache.delete(nom); else cache.clear(); }
export const vignetteDe=nom=>cache.get(nom)||null;

// dessine la vignette tout de suite (le meuble doit être prêt) ; null si le moteur n'est pas là
export function dessinerVignette(it){
  const {renderer,scene}=app; if(!renderer||!it?.g) return null;
  if(!rt){ rt=new THREE.WebGLRenderTarget(T,T); rt.texture.colorSpace=THREE.SRGBColorSpace; cam=new THREE.PerspectiveCamera(30,1,0.05,120); cam.layers.set(L);
    pix=new Uint8Array(T*T*4); cv=document.createElement('canvas'); cv.width=cv.height=T; }
  const avant=[], caches=[];
  const marquer=o=>{ avant.push([o,o.layers.mask]); o.layers.enable(L); };
  it.g.traverse(o=>{ marquer(o); if((o.name?.endsWith('__couvercle')||o.name==='alerte')&&o.visible){ caches.push(o); o.visible=false; } });
  scene.traverse(o=>{ if(o.isLight) marquer(o); });
  const vis=it.g.visible; it.g.visible=true; it.g.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(it.g); box.getCenter(centre); const R=Math.max(0.12,box.getSize(taille).length()/2);
  // de face (+z du meuble), un peu de côté et en plongée
  vers.set(0.55,0.62,1).applyAxisAngle(haut,it.g.rotation.y).normalize();
  cam.position.copy(centre).addScaledVector(vers,R/Math.sin(THREE.MathUtils.degToRad(15))*1.02); cam.lookAt(centre); cam.updateMatrixWorld();
  const fond=scene.background, plans=renderer.clippingPlanes, cible=renderer.getRenderTarget(), couleur=renderer.getClearColor(new THREE.Color()), alpha=renderer.getClearAlpha();
  let url=null;
  try{
    scene.background=null; renderer.clippingPlanes=[]; renderer.setRenderTarget(rt); renderer.setClearColor(0x000000,0); renderer.clear();
    renderer.render(scene,cam); renderer.readRenderTargetPixels(rt,0,0,T,T,pix);
    const g=cv.getContext('2d'), img=g.createImageData(T,T);
    for(let y=0;y<T;y++) img.data.set(pix.subarray((T-1-y)*T*4,(T-y)*T*4),y*T*4);   // lignes du bas vers le haut
    g.putImageData(img,0,0); url=cv.toDataURL('image/png');
  }catch(e){ console.warn('Vignette impossible :',it.name,e); }
  finally{
    for(const [o,mk] of avant) o.layers.mask=mk; for(const o of caches) o.visible=true; it.g.visible=vis;
    scene.background=fond; renderer.clippingPlanes=plans; renderer.setRenderTarget(cible); renderer.setClearColor(couleur,alpha);
  }
  if(url) cache.set(it.name,url);
  return url;
}
function tour(){
  planifie=false; let n=0;
  while(attente.length&&n<3){ const [it,rappel]=attente.shift(); if(!app.items[it.name]) continue;
    let url=cache.get(it.name); if(!url){ url=dessinerVignette(it); n++; }
    if(url) rappel(url); }
  if(attente.length){ planifie=true; requestAnimationFrame(tour); }
}
// demande la vignette d'un meuble : rappel(url) tout de suite si elle existe, sinon dès qu'elle est dessinée
export function demanderVignette(it,rappel){
  const url=cache.get(it.name); if(url){ rappel(url); return; }
  if(!attente.some(([x])=>x===it)) attente.push([it,rappel]);
  if(!planifie){ planifie=true; requestAnimationFrame(tour); }
}
export function initVignettes(){
  // l'aspect (couleur, matières), la forme (dimensions, options) ou le fichier d'un objet changent : sa vignette est refaite
  addEventListener('apparence',e=>{ const it=e.detail?.it; if(it) invaliderVignette(it.name); });
  addEventListener('objet-pret',e=>{ const it=e.detail?.it; if(it){ invaliderVignette(it.name); dispatchEvent(new CustomEvent('vignette',{detail:{it}})); } });
  addEventListener('rendu',()=>invaliderVignette());   // rendu normal ↔ réaliste : autre éclairage
}
