// Portes intérieures ouvrables : battants reconstruits sur un pivot (charnière), ouverture automatique à
// l'approche en visite, fermeture quand on s'éloigne, ouverture / fermeture à la main en touchant la porte.
// Charnières déduites de la poignée du modèle ; une porte s'ouvre vers la pièce qu'elle dessert.
import * as THREE from 'three';
import {app} from './app.js';
import {ETAGE_FLOOR as F, EYE} from './config.js';
import {MAT, boite, fusionner} from './formes.js';

// axe 'x' : mur à x constant (plan), battant de a0 à a1 en z ; axe 'z' : mur à z constant, battant en x.
// charniere : extrémité du battant côté charnière ; sens : côté (+1 / -1 sur la normale du mur) vers lequel il s'ouvre.
// cadre : 'modele' (cadre du modèle gardé), 'neuf' (cadre reconstruit, épaisseur du mur), 'aucun' (déjà construit)
// auto:false : pas d'ouverture à l'approche (le réduit, ouvert, barrerait l'entrée), seulement en la touchant
export const PORTES=[
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

// Cadre blanc reconstruit (étage) : montants et traverse dans l'épaisseur du mur, chambranles des deux côtés
function cadreNeuf(g,d){
  const [o0,o1]=d.ouv, e=d.mur/2+0.012, ht=d.y0+d.h+0.09, c=0.07, m=blancPorte;
  const piece=(a0,a1,y0,y1,p0,p1)=>d.axe==='x'?boite(g,p0,p1,y0,y1,a0,a1,m):boite(g,a0,a1,y0,y1,p0,p1,m);
  piece(o0,o0+0.04,d.y0,ht,d.plan-e,d.plan+e); piece(o1-0.04,o1,d.y0,ht,d.plan-e,d.plan+e); piece(o0,o1,ht-0.04,ht,d.plan-e,d.plan+e);
  for(const s of [-1,1]){ const p0=d.plan+s*e, p1=p0+s*0.012, lo=Math.min(p0,p1), hi=Math.max(p0,p1);
    piece(o0-c,o0+0.01,d.y0,ht+c,lo,hi); piece(o1-0.01,o1+c,d.y0,ht+c,lo,hi); piece(o0-c,o1+c,ht,ht+c,lo,hi); }
}

// Battant (4 cm) et poignées à béquille des deux côtés, construits autour de la charnière
function battant(d,matBois){
  const w=Math.abs(d.a1-d.a0), dir=Math.sign((d.a0+d.a1)/2-d.charniere), mat=d.bois&&matBois?matBois:blancPorte;
  const pivot=new THREE.Group(); pivot.name=d.nom+'__pivot';
  if(d.axe==='x') pivot.position.set(d.plan,d.y0,d.charniere); else pivot.position.set(d.charniere,d.y0,d.plan);
  const geo=d.axe==='x'?new THREE.BoxGeometry(0.04,d.h,w):new THREE.BoxGeometry(w,d.h,0.04);
  const feuille=new THREE.Mesh(geo,mat); feuille.position.set(d.axe==='x'?0:dir*w/2,d.h/2,d.axe==='x'?dir*w/2:0); pivot.add(feuille);
  const a=dir*(w-0.07), l0=Math.min(a,a-dir*0.12), l1=Math.max(a,a-dir*0.12);   // poignée près du bord libre, à 1 m
  for(const s of [-1,1]){                                        // rosace + béquille dirigée vers la charnière, des deux côtés
    const n0=Math.min(s*0.02,s*0.03), n1=Math.max(s*0.02,s*0.03), b0=Math.min(s*0.03,s*0.065), b1=Math.max(s*0.03,s*0.065);
    if(d.axe==='x'){ boite(pivot,n0,n1,0.91,1.09,a-0.02,a+0.02,MAT.chrome); boite(pivot,b0,b1,0.985,1.005,l0,l1,MAT.chrome); }
    else { boite(pivot,a-0.02,a+0.02,0.91,1.09,n0,n1,MAT.chrome); boite(pivot,l0,l1,0.985,1.005,b0,b1,MAT.chrome); }
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
      if(o.material.name==='Material_13') matBois=o.material;
      const s=new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()), large=Math.max(s.x,s.z);
      const cadre=d.cadre==='modele'&&s.y>2.15&&large>0.85;          // le cadre du modèle (sans le battant) est gardé
      if(d.cadre!=='aucun'&&!cadre) vieux.push(o); });
    for(const o of vieux) o.removeFromParent();
    const g=new THREE.Group(); if(d.cadre==='neuf') fusionner(cadreNeuf(g,d)||g);
    const {pivot,feuille,ouvert}=battant(d,matBois); fusionner(pivot); g.add(pivot);   // poignées et chambranles fusionnés : moins d'appels de dessin
    node.updateMatrixWorld(true); node.attach(g);
    const centre=new THREE.Vector3(d.axe==='x'?d.plan:(d.a0+d.a1)/2,d.y0+1,d.axe==='x'?(d.a0+d.a1)/2:d.plan);
    const p={def:d, nom:d.nom, pivot, feuille, ouvert, angle:0, cible:false, manuel:false, centreLocal:node.worldToLocal(centre.clone()), node};
    feuille.userData.porte=p; for(const c of pivot.children) c.userData.porte=p;
    app.portes.push(p); app.battants.push(feuille);
  }
}

const v=new THREE.Vector3();
function visible(o){ while(o){ if(!o.visible) return false; o=o.parent; } return true; }
export function centrePorte(p){ return v.copy(p.centreLocal).applyMatrix4(p.node.matrixWorld); }

// Ouverture automatique à l'approche (1re personne), fermeture au-delà de 2 m ; un geste manuel est respecté
// tant qu'on reste à moins de 3 m ; « Tout ouvrir » suspend l'automatisme. La porte du réduit ne s'ouvre qu'à la main
export function majPortes(dt){
  const cam=app.camera.position, pied=cam.y-EYE;
  for(const p of app.portes){
    if(!visible(p.pivot)) continue;
    if(app.mode==='walk'&&!app.toutOuvert){
      const c=centrePorte(p), dist=Math.hypot(cam.x-c.x,cam.z-c.z), memeNiveau=Math.abs(pied-p.def.y0)<1.2;
      if(p.manuel){ if(dist>3||!memeNiveau) p.manuel=false; }
      else if(memeNiveau&&dist<1.3&&p.def.auto!==false) p.cible=true;
      else if(dist>2||!memeNiveau) p.cible=false;
    }
    const but=p.cible?p.ouvert:0, pas=3*dt;
    if(p.angle!==but){ p.angle+=Math.max(-pas,Math.min(pas,but-p.angle)); p.pivot.rotation.y=p.angle; }
  }
}
export function basculerPorte(p){ p.cible=!p.cible; p.manuel=true; }
export function toutOuvrir(oui){ app.toutOuvert=oui; for(const p of app.portes){ p.cible=oui; p.manuel=false; } }
export function porteDe(nom){ return app.portes.find(p=>p.nom===nom); }
export function obstaclesPortes(){ return app.battants.filter(visible); }
