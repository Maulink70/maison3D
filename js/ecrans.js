// Écrans de la télévision et des ordinateurs (Mauro, 21 octobre 2026 : « la télévision fait trop un rectangle noir… idem pour
// l'écran du PC », puis « allumée dans les deux cas, en appuyant dessus je peux l'éteindre… comme un store ») : allumés au chargement,
// de jour comme de nuit, avec une image (textures/ecran_tv.webp pour la télévision, ecran_pc.webp pour les ordinateurs : photos
// « alps_field » et « lakeside_sunrise » de Poly Haven, CC0) ; toucher l'objet en Visite l'éteint (verre gris très foncé et brillant,
// rugosité basse dans reflets.js) ou le rallume ; état non enregistré, comme les stores. Parties reconnues par le
// nom d'origine de leur matière (TV_Ecran, Ecran_Noir_Brillant ; pas l'afficheur de l'imprimante). Coordonnées de texture calculées
// sur la face de l'écran (vue de face, haut en haut), sans toucher au fichier.
import * as THREE from 'three';
import {app} from './app.js';

export const ECRAN=/ecran|screen/i;
const PAS_ECRAN=/imprimante|printer/i;
export const estEcran=m=>{ const n=m?.userData?.nom||''; return ECRAN.test(n)&&!PAS_ECRAN.test(n); };
const JOUR=new THREE.Color(0x2a2e35);
const images={}, charge=new THREE.TextureLoader();
function image(n){ if(!images[n]){ const t=charge.load(`textures/ecran_${n}.webp?v=1`,()=>{ t.needsUpdate=true; }); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; images[n]=t; } return images[n]; }
const eteints=new Set();

// coordonnées de texture de l'écran : u de gauche à droite et v de bas en haut, vu de face (dans le repère du monde, une fois)
function poserUV(o,racine){
  const g=o.geometry; if(g.userData.ecranUV) return; o.updateWorldMatrix(true,false);
  const pos=g.attributes.position, nrm=g.attributes.normal, p=new THREE.Vector3(), n=new THREE.Vector3();
  const P=[]; let cx=0,cz=0;
  for(let i=0;i<pos.count;i++){ p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld); P.push(p.clone()); cx+=p.x; cz+=p.z; }
  cx/=pos.count; cz/=pos.count;
  // largeur de l'écran : direction horizontale où ses points s'étalent le plus (axe principal en x, z)
  let xx=0,xz=0,zz=0; for(const q of P){ const dx=q.x-cx, dz=q.z-cz; xx+=dx*dx; xz+=dx*dz; zz+=dz*dz; }
  const t=0.5*Math.atan2(2*xz,xx-zz), droite=new THREE.Vector3(Math.cos(t),0,Math.sin(t)), N=new THREE.Vector3(-droite.z,0,droite.x);
  // côté de l'image : normales des faces si elles le disent, sinon à l'opposé du centre de l'objet (pied, dos de l'écran)
  let s=0; const nm=new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
  if(nrm) for(let i=0;i<nrm.count;i++) s+=n.fromBufferAttribute(nrm,i).applyMatrix3(nm).normalize().dot(N);
  if(Math.abs(s)<0.3*pos.count){ const c=new THREE.Box3().setFromObject(racine).getCenter(new THREE.Vector3()); s=(cx-c.x)*N.x+(cz-c.z)*N.z; }
  if(s<0){ N.negate(); droite.negate(); }
  droite.negate();   // sens vérifié à l'image (télévision et écran du PC)
  const u=P.map(q=>q.dot(droite)), v=P.map(q=>q.y), u0=Math.min(...u), u1=Math.max(...u), v0=Math.min(...v), v1=Math.max(...v);
  const uv=new Float32Array(pos.count*2);
  for(let i=0;i<pos.count;i++){ uv[2*i]=(u[i]-u0)/(u1-u0||1); uv[2*i+1]=(v[i]-v0)/(v1-v0||1); }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.userData.ecranUV=true;
}
function regler(it,o){
  const m=o.material; if(!m?.isMeshStandardMaterial) return;
  if(!m.userData.ecran0) m.userData.ecran0={color:m.color.clone(),emissive:m.emissive.clone(),map:m.emissiveMap,k:m.emissiveIntensity};
  const on=!eteints.has(it.name), tex=on?image(/tv|t[ée]l[ée]/i.test(it.name+' '+(it.ajout?.n||'')+' '+m.userData.nom)?'tv':'pc'):null;
  m.userData.ecranAllume=on;
  if(on){ poserUV(o,it.g); m.color.setRGB(0,0,0); m.emissive.setRGB(1,1,1); m.emissiveIntensity=0.85; }
  else { m.color.copy(JOUR); m.emissive.setRGB(0,0,0); m.emissiveIntensity=1; }
  if(m.emissiveMap!==tex){ m.emissiveMap=tex; m.needsUpdate=true; }
}
function ecransDe(it){ return (it.mats||[]).filter(o=>estEcran(o.material)); }
export function reglerEcrans(it){ for(const o of ecransDe(it)) regler(it,o); }
export const aEcran=it=>!!it&&ecransDe(it).length>0;
export const ecranAllume=it=>!eteints.has(it.name);
export function basculerEcran(it){ if(eteints.has(it.name)) eteints.delete(it.name); else eteints.add(it.name);
  reglerEcrans(it); dispatchEvent(new CustomEvent('apparence',{detail:{it}})); }   // reflets (rugosité), vignette
addEventListener('apparence',e=>reglerEcrans(e.detail.it));
