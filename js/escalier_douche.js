// Escalier et douche + WC de l'étage en photo (21 octobre 2026, images de la session BLENDER d'après les photos de Mauro,
// Drive « Maison 3D / Textures site / escalier_et_douche_etage ») :
// - escalier : dessus des marches en pierre anthracite pailletée (0,361 × 0,237 m par image), contremarches un peu plus
//   claires et bleutées (0,525 × 0,171 m, avec relief) ; les joints des carreaux sont dessinés en code (rez_structure.js) ;
// - douche + WC de l'étage : faïence brillante gris très clair veinée (0,33 m par image), carreaux de 25 × 33 cm en hauteur
//   et joints fins gris clair, frise de 25 × 7 cm à 1,80 m (avec relief) : l'image de carrelerDouche (etage_structure.js,
//   0,50 × 2,50 m de mur) est refaite avec les photos, joints et frise compris.
// Tant que les images ne sont pas arrivées, les motifs dessinés en code restent. Les cartes de relief des marches et de la
// faïence (refaites en 1024 px par la session BLENDER, version 2) sont posées aussi.
import * as THREE from 'three';
import {app} from './app.js';
import {textureDe} from './matieres.js';

export const ESC_TEX={dossier:'textures/', version:2,
  marche:{fichier:'esc_marche', L:0.361, H:0.237, rugosite:0.75, relief:true, normales:0.7},
  contre:{fichier:'esc_contre', L:0.525, H:0.171, rugosite:0.75, relief:true, normales:0.7}};
export const DOUCHE_TEX={dossier:'textures/', version:2, faience:0.33, carreau:[0.25,0.33], frise:{y:1.80, h:0.07, l:0.25},
  joint:0.002, couleurJoint:'#c9cac7', rugosite:0.10, pxm:1280};

const image=src=>new Promise((ok,non)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=non; i.src=src; });
const texture=(src,srgb)=>new Promise((ok,non)=>new THREE.TextureLoader().load(src,t=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=Math.min(8,app.renderer?.capabilities.getMaxAnisotropy()||1); if(srgb) t.colorSpace=THREE.SRGBColorSpace; ok(t); },undefined,non));
// matériaux de la scène portant ce nom (les dos des faces en ont une copie du même nom)
function materiaux(nom){ const s=new Set(); app.scene.traverse(o=>{ if(o.isMesh&&!Array.isArray(o.material)&&o.material.name===nom) s.add(o.material); }); return [...s]; }

// Marches et contremarches : leurs coordonnées sont en mètres / taille du motif « pierre » (poserCoordonnees)
async function escalier(){
  const v='?v='+ESC_TEX.version; let n=0;
  for(const [nom,d] of [['escMarche',ESC_TEX.marche],['escContre',ESC_TEX.contre]]){
    const mats=materiaux(nom); if(!mats.length) continue;
    const [c,r]=await Promise.all([texture(ESC_TEX.dossier+d.fichier+'_couleur.webp'+v,true),d.relief?texture(ESC_TEX.dossier+d.fichier+'_relief.webp'+v,false):null]);
    for(const m of mats){ const t=m.userData.taille||1;
      for(const x of [c,r]) if(x) x.repeat.set(t/d.L,t/d.H);
      m.map=c; m.normalMap=r; if(r) m.normalScale.set(d.normales,d.normales); m.bumpMap=null; m.color.set(0xffffff);
      m.roughness=d.rugosite; m.metalness=0; m.userData.photo=true; m.needsUpdate=true; n++; }
  }
  return n;
}

// Image de la douche : 0,50 m de large (deux carreaux) sur 2,50 m de haut depuis le sol de l'étage (v = 0 en bas)
function dessin(faience,frise,relief){   // relief : faience = carte de relief de la faïence
  const D=DOUCHE_TEX, px=D.pxm, W=Math.round(0.50*px), H=Math.round(2.50*px), [cl,ch]=D.carreau, f=D.frise;
  const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  const yc=y=>H-y*px;                                                     // hauteur au-dessus du sol → ligne de l'image
  const s=Math.round(D.faience*px); for(let u=0;u<W;u+=s) for(let w=0;w<H;w+=s) x.drawImage(faience,u,w,s,s);
  // joints : verticaux tous les 25 cm, horizontaux tous les 33 cm de part et d'autre de la frise
  const j=Math.max(2,Math.round(D.joint*px)); x.fillStyle=relief?'rgb(128,128,240)':D.couleurJoint;
  for(let u=0;u<=W;u+=Math.round(cl*px)) x.fillRect(u-j/2,0,j,H);
  for(let y=f.y;y>0;y-=ch) x.fillRect(0,yc(y)-j/2,W,j);
  for(let y=f.y+f.h;y<2.5;y+=ch) x.fillRect(0,yc(y)-j/2,W,j);
  // frise : un élément de 25 × 7 cm répété
  const fl=Math.round(f.l*px), fh=Math.round(f.h*px);
  for(let u=0;u<W;u+=fl) x.drawImage(frise,u,yc(f.y+f.h),fl,fh);
  return c;
}
async function douche(){
  const D=DOUCHE_TEX, v='?v='+D.version, mats=materiaux('douche_faience'); if(!mats.length) return 0;
  const [fa,fr,fan,fn]=await Promise.all(['douche_faience_couleur','douche_frise_couleur','douche_faience_relief','douche_frise_relief'].map(f=>image(D.dossier+f+'.webp'+v)));
  const couleur=textureDe(dessin(fa,fr,false)), normales=textureDe(dessin(fan,fn,true),false);
  for(const t of [couleur,normales]){ t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.ClampToEdgeWrapping; t.anisotropy=Math.min(8,app.renderer?.capabilities.getMaxAnisotropy()||1); }
  couleur.colorSpace=THREE.SRGBColorSpace;
  for(const m of mats){ m.map=couleur; m.normalMap=normales; m.normalScale.set(0.6,0.6); m.roughness=D.rugosite; m.color.set(0xffffff);
    m.userData.photo=true; m.needsUpdate=true; }
  return mats.length;
}

export function habillerEscalierDouche(){
  return Promise.all([escalier(),douche()]).then(([e,d])=>{ dispatchEvent(new CustomEvent('escalier-douche',{detail:{escalier:e,douche:d}})); return {e,d}; })
    .catch(e=>{ console.warn('Escalier et douche de l’étage en photo indisponibles :',e?.message||e); return null; });
}
