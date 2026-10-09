// Portes intérieures ouvrables : battants reconstruits sur un pivot (charnière), ouverture automatique à
// l'approche en visite, fermeture quand on s'éloigne, ouverture / fermeture à la main en touchant la porte.
// Charnières déduites de la poignée du modèle ; une porte s'ouvre vers la pièce qu'elle dessert.
import * as THREE from 'three';
import {app} from './app.js';
import {ETAGE_FLOOR as F, EYE} from './config.js';
import {MAT, boite, fusionner, uvMonde} from './formes.js';
import {ENTREE} from './corrections.js';

// axe 'x' : mur à x constant (plan), battant de a0 à a1 en z ; axe 'z' : mur à z constant, battant en x.
// charniere : extrémité du battant côté charnière ; sens : côté (+1 / -1 sur la normale du mur) vers lequel il s'ouvre.
// cadre : 'modele' (cadre du modèle gardé), 'neuf' (cadre reconstruit, épaisseur du mur), 'aucun' (déjà construit)
// auto:false : pas d'ouverture à l'approche (le réduit, ouvert, barrerait l'entrée ; portes donnant dehors), seulement
// en la touchant. ext : porte donnant dehors, une barrière invisible empêche de sortir. vitree : ouvrant vitré
export const PORTES=[
  {nom:'rez__porte_entree',              axe:'z', plan:-21.08,  a0:11.66,   a1:12.56,   charniere:11.66,   sens:-1, y0:0, h:2.10, mat:'sombre', cadre:'aucun', auto:false, ext:true},   // porte d'entrée : vers l'intérieur
  {nom:'rez__element_mural',             axe:'x', plan:19.47,   a0:-23.86,  a1:-22.826, charniere:-23.86,  sens:-1, y0:0.02, h:2.08, cadre:'vitree', vitree:true, auto:false, ext:true},   // porte-fenêtre cuisine : vers le four
  {nom:'rez__porte_interieure_88x218',   axe:'x', plan:13.038,  a0:-25.889, a1:-25.189, charniere:-25.189, sens:-1, y0:0, h:2.09, bois:true,  cadre:'modele'},  // salle de bain
  {nom:'rez__porte_interieure_88x218_2', axe:'x', plan:13.038,  a0:-23.453, a1:-22.753, charniere:-22.753, sens:-1, y0:0, h:2.09, bois:true,  cadre:'modele'},  // WC / buanderie
  {nom:'rez__porte_interieure_98_(80)',  axe:'z', plan:-24.968, a0:13.263,  a1:14.063,  charniere:13.263,  sens:-1, y0:0, h:2.09, bois:true,  cadre:'modele'},  // chambre
  {nom:'rez__porte_reduit',              axe:'z', plan:-21.065, a0:12.95,   a1:13.68,   charniere:12.95,   sens:-1, y0:0, h:2.02, bois:false, cadre:'aucun', auto:false},   // réduit sous l'escalier : s'ouvre vers l'entrée, charnière côté porte d'entrée
  {nom:'etage__porte_dressing',          axe:'z', plan:-22.79,  a0:12.975,  a1:13.875,  charniere:13.875,  sens:-1, y0:F, h:2.05, bois:false, cadre:'neuf', ouv:[12.93,13.92], mur:0.08},
  {nom:'etage__porte_chambre_etage',     axe:'x', plan:16.74,   a0:-23.82,  a1:-22.91,  charniere:-22.91,  sens:+1, y0:F, h:2.05, bois:false, cadre:'neuf', ouv:[-23.86,-22.87], mur:0.08},
  {nom:'etage__porte_douche_etage',      axe:'x', plan:16.74,   a0:-22.74,  a1:-21.94,  charniere:-22.74,  sens:+1, y0:F, h:2.05, bois:false, cadre:'neuf', ouv:[-22.78,-21.90], mur:0.08}
];
const OUVERT=1.53;                       // ≈ 88°
const blancPorte=new THREE.MeshStandardMaterial({color:0xf2f0ed,roughness:0.45});
const verre=new THREE.MeshStandardMaterial({color:0xdcebf0,transparent:true,opacity:0.16,roughness:0.05,side:THREE.DoubleSide,depthWrite:false});

// Porte-fenêtre de la cuisine (le modèle n'a que des faces plates collées au mur) : dormant en bois dans
// l'épaisseur du mur (montants, imposte jusqu'au plafond), seuil alu
function dormantVitree(g,matBois){
  const x0=19.438, x1=19.638, m=matBois||MAT.chene;
  const piece=(y0,y1,z0,z1,mat)=>{ const b=boite(g,x0,x1,y0,y1,z0,z1,mat);       // veinage du bois à l'échelle
    if(mat.map){ b.geometry.translate(b.position.x,b.position.y,b.position.z); b.position.set(0,0,0); uvMonde(b.geometry); } };
  piece(0,2.40,-23.963,-23.86,m); piece(0,2.40,-22.826,-22.723,m); piece(2.10,2.40,-23.86,-22.826,m); piece(0,0.02,-23.86,-22.826,MAT.inox);
}

// Cadre blanc reconstruit (étage) : montants et traverse dans l'épaisseur du mur, chambranles des deux côtés
function cadreNeuf(g,d){
  const [o0,o1]=d.ouv, e=d.mur/2+0.012, ht=d.y0+d.h+0.09, c=0.07, m=blancPorte, b0=Math.min(d.a0,d.a1), b1=Math.max(d.a0,d.a1);
  const piece=(a0,a1,y0,y1,p0,p1)=>d.axe==='x'?boite(g,p0,p1,y0,y1,a0,a1,m):boite(g,a0,a1,y0,y1,p0,p1,m);
  // montants et traverse jusqu'au battant : aucun jour autour de la porte fermée (audit du 9 octobre 2026)
  piece(o0,b0,d.y0,ht,d.plan-e,d.plan+e); piece(b1,o1,d.y0,ht,d.plan-e,d.plan+e); piece(o0,o1,d.y0+d.h,ht,d.plan-e,d.plan+e);
  for(const s of [-1,1]){ const p0=d.plan+s*e, p1=p0+s*0.012, lo=Math.min(p0,p1), hi=Math.max(p0,p1);
    piece(o0-c,o0+0.01,d.y0,ht+c,lo,hi); piece(o1-0.01,o1+c,d.y0,ht+c,lo,hi); piece(o0-c,o1+c,ht,ht+c,lo,hi); }
}

// Battant (4 cm) et poignées à béquille des deux côtés, construits autour de la charnière
function battant(d,matBois){
  const w=Math.abs(d.a1-d.a0), dir=Math.sign((d.a0+d.a1)/2-d.charniere);
  const mat=d.mat==='sombre'?MAT.porteSombre:d.bois&&matBois?matBois:blancPorte;
  const pivot=new THREE.Group(); pivot.name=d.nom+'__pivot';
  if(d.axe==='x') pivot.position.set(d.plan,d.y0,d.charniere); else pivot.position.set(d.charniere,d.y0,d.plan);
  // pièce du battant : a le long du mur (depuis la charnière), y en hauteur, e dans l'épaisseur
  const piece=(a0,a1,y0,y1,e0,e1,m)=>d.axe==='x'?boite(pivot,e0,e1,y0,y1,Math.min(a0,a1),Math.max(a0,a1),m):boite(pivot,Math.min(a0,a1),Math.max(a0,a1),y0,y1,e0,e1,m);
  let feuille;
  if(d.vitree){                                                  // ouvrant vitré : profilés en bois de 6,5 cm (comme le dormant) et vitre
    const r=0.065, pb=matBois||MAT.chene; feuille=piece(0,dir*w,0,d.h,-0.004,0.004,verre); feuille.userData.fusion=false; feuille.userData.vitre=true;
    const bois=(...a)=>{ const b=piece(...a,pb); if(pb.map){ b.geometry.translate(b.position.x,b.position.y,b.position.z); b.position.set(0,0,0); uvMonde(b.geometry); } };
    bois(0,dir*r,0,d.h,-0.03,0.03); bois(dir*(w-r),dir*w,0,d.h,-0.03,0.03);
    bois(dir*r,dir*(w-r),0,0.09,-0.03,0.03); bois(dir*r,dir*(w-r),d.h-r,d.h,-0.03,0.03);
    const s=d.sens, a=dir*(w-0.035);                               // poignée (crémone) côté pièce, près du bord libre
    piece(a-0.012,a+0.012,1.0,1.16,Math.min(s*0.03,s*0.045),Math.max(s*0.03,s*0.045),MAT.chrome);
    piece(a-0.01,a+0.01,0.94,1.08,Math.min(s*0.045,s*0.065),Math.max(s*0.045,s*0.065),MAT.chrome);
  } else {
    feuille=piece(0,dir*w,0,d.h,-0.02,0.02,mat); feuille.userData.fusion=false;
    const a=dir*(w-0.07), l0=Math.min(a,a-dir*0.12), l1=Math.max(a,a-dir*0.12);   // poignée près du bord libre, à 1 m
    for(const s of [-1,1]){                                        // rosace + béquille dirigée vers la charnière, des deux côtés
      const n0=Math.min(s*0.02,s*0.03), n1=Math.max(s*0.02,s*0.03), b0=Math.min(s*0.03,s*0.065), b1=Math.max(s*0.03,s*0.065);
      piece(a-0.02,a+0.02,0.91,1.09,n0,n1,MAT.chrome); piece(l0,l1,0.985,1.005,b0,b1,MAT.chrome);
    }
  }
  const ouvert=d.axe==='x'?d.sens*dir*OUVERT:-d.sens*dir*OUVERT;
  return {pivot,feuille,ouvert};
}

// Remplace les battants du modèle par des battants pivotants (appelé avant la création des meubles)
export function installerPortes(root){
  app.portes=[]; app.battants=[];
  root.updateMatrixWorld(true);
  for(const d of PORTES){
    const node=root.getObjectByName(d.nom); if(!node) continue;
    let matBois=null; const vieux=[];
    node.traverse(o=>{ if(!o.isMesh) return;
      if(o.material.name==='Material_13'||o.material.name==='Material_303') matBois=o.material;
      const s=new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()), large=Math.max(s.x,s.z);
      const cadre=d.cadre==='modele'&&s.y>2.15&&large>0.85;          // le cadre du modèle (sans le battant) est gardé
      if(d.cadre!=='aucun'&&!cadre) vieux.push(o); });
    for(const o of vieux) o.removeFromParent();
    const g=new THREE.Group(); if(d.cadre==='neuf') fusionner(cadreNeuf(g,d)||g);
    if(d.cadre==='vitree'){ dormantVitree(g,matBois); fusionner(g); }
    if(d.ext) barriere(d);
    const {pivot,feuille,ouvert}=battant(d,matBois); fusionner(pivot); g.add(pivot);   // poignées et chambranles fusionnés : moins d'appels de dessin
    node.updateMatrixWorld(true); node.attach(g);
    const centre=new THREE.Vector3(d.axe==='x'?d.plan:(d.a0+d.a1)/2,d.y0+1,d.axe==='x'?(d.a0+d.a1)/2:d.plan);
    const p={def:d, nom:d.nom, pivot, feuille, ouvert, angle:0, cible:false, manuel:false, centreLocal:node.worldToLocal(centre.clone()), node};
    feuille.userData.porte=p; for(const c of pivot.children) c.userData.porte=p;
    app.portes.push(p); app.battants.push(feuille);
  }
}

// Porte donnant dehors : on ne sort pas de l'appartement (bloc invisible dans la moitié extérieure du mur)
function barriere(d){
  const b=d.vitree?new THREE.Box3(new THREE.Vector3(19.56,0,-23.86),new THREE.Vector3(19.62,2.1,-22.826))
    :new THREE.Box3(new THREE.Vector3(ENTREE.x0,0,-20.98),new THREE.Vector3(ENTREE.x1,ENTREE.h,-20.93));
  const s=b.getSize(new THREE.Vector3()), m=new THREE.Mesh(new THREE.BoxGeometry(s.x,s.y,s.z),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  b.getCenter(m.position); m.updateMatrixWorld(true); app.colliders.push(m);
}

const v=new THREE.Vector3();
function visible(o){ while(o){ if(!o.visible) return false; o=o.parent; } return true; }
export function centrePorte(p){ return v.copy(p.centreLocal).applyMatrix4(p.node.matrixWorld); }

// Ouverture automatique à l'approche (1re personne), fermeture au-delà de 2 m ; un geste manuel est respecté
// tant qu'on reste à moins de 3 m (ou de la distance d'où on l'a fait, plus 1,5 m) ; bouton « Portes auto » (app.portesAuto) pour l'arrêter. La porte du réduit ne s'ouvre qu'à la main ;
// les fenêtres (js/fenetres.js, même liste app.portes, def.fenetre) jamais à l'approche
export function majPortes(dt){
  const cam=app.camera.position, pied=cam.y-EYE;
  for(const p of app.portes){
    if(!visible(p.pivot)) continue;
    if(app.mode==='walk'&&app.portesAuto&&!p.def.fenetre){            // les fenêtres ne s'ouvrent et ne se ferment qu'à la main
      const c=centrePorte(p), dist=Math.hypot(cam.x-c.x,cam.z-c.z), memeNiveau=Math.abs(pied-p.def.y0)<1.2;
      if(p.manuel){ if(dist>Math.max(3,p.distManuel+1.5)||!memeNiveau) p.manuel=false; }
      else if(memeNiveau&&dist<1.3&&p.def.auto!==false) p.cible=true;
      else if(dist>2||!memeNiveau) p.cible=false;
    }
    const but=p.cible?p.ouvert:0, pas=(p.vitesse||3)*dt;
    if(p.angle!==but){ p.angle+=Math.max(-pas,Math.min(pas,but-p.angle)); if(p.poser) p.poser(p.angle); else p.pivot.rotation.y=p.angle; }
  }
}
// Geste manuel : respecté tant qu'on ne s'éloigne pas de plus de 1,5 m par rapport à l'endroit d'où l'on a touché la porte
// (au moins 3 m), même si on l'a touchée de loin
export function basculerPorte(p){ const c=centrePorte(p), cam=app.camera.position;
  p.cible=!p.cible; p.manuel=true; p.distManuel=Math.hypot(cam.x-c.x,cam.z-c.z); }
// Bouton du panneau (Éditer) : ouvre tous les ouvrants de l'élément s'il en reste un fermé, sinon les ferme
export function basculerElement(nom){ const l=ouvrantsDe(nom), ouvrir=l.some(p=>!p.cible); for(const p of l) if(p.cible!==ouvrir) basculerPorte(p); return ouvrir; }
// « Ouvrir les portes » (la baie suit aussi) : elles restent ouvertes, l'automatisme s'arrête (sinon il refermerait celles
// dont on s'éloigne) ; « Fermer les portes » : toutes fermées, comme à la main (l'automatisme, s'il est en marche, ne rouvre
// la porte près de laquelle on se tient qu'après s'en être éloigné)
export function toutOuvrir(oui){ app.toutOuvert=oui; if(oui) app.portesAuto=false; const cam=app.camera.position;
  for(const p of app.portes) if(!p.def.fenetre||p.def.porte){ p.cible=oui; p.manuel=!oui;
    if(!oui){ const c=centrePorte(p); p.distManuel=Math.hypot(cam.x-c.x,cam.z-c.z); } } }
// « Portes auto » : en 1re personne, les portes s'ouvrent à l'approche et se referment quand on s'éloigne
export function portesAuto(oui){ app.portesAuto=oui; if(oui){ app.toutOuvert=false; for(const p of app.portes) if(!p.def.fenetre) p.manuel=false; } }
// « Ouvrir les fenêtres » : toutes ouvertes ou toutes fermées (elles restent ainsi : pas d'automatisme)
export function toutesFenetres(oui){ app.fenetresOuvertes=oui; for(const p of app.portes) if(p.def.fenetre) p.cible=oui; }
export function porteDe(nom){ return app.portes.find(p=>p.nom===nom); }
export function ouvrantsDe(nom){ return app.portes.filter(p=>p.nom===nom); }
export function obstaclesPortes(){ return app.battants.filter(visible); }
