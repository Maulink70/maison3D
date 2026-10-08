// WC / buanderie du rez, reconstitué d'après les photos de Mauro (pièce vide dans le modèle SketchUp) :
// WC suspendu face à la porte, colonne lave-linge + sèche-linge dans la niche, lavabo sur meuble à persiennes.
import * as THREE from 'three';

import {MAT, boite, lignes, copier} from './formes.js';

const {blanc,ceramique,sombre,chrome}=MAT;
const hublot=new THREE.MeshStandardMaterial({color:0x5d666e,roughness:0.1,transparent:true,opacity:0.75});
const miroir=new THREE.MeshStandardMaterial({color:0xe4ebee,roughness:0.06});

function wc(root){
  const g=new THREE.Group(); g.name='rez__wc';
  const cuvette=root.getObjectByName('etage__wc'), plaque=root.getObjectByName('etage__bouton_wc_douche');
  // à l'étage le WC est adossé au mur z = -21,39 et regarde vers -z ; ici il est adossé au coffrage x = 11,45 et regarde vers +x
  if(cuvette) g.add(copier(cuvette,new THREE.Vector3(17.179,2.74,-21.39),new THREE.Vector3(11.45,0,-23.10),-Math.PI/2));
  if(plaque) g.add(copier(plaque,new THREE.Vector3(17.175,2.74,-21.423),new THREE.Vector3(11.45,0,-23.10),-Math.PI/2));
  return g;
}

function lavabo(){
  const g=new THREE.Group(); g.name='rez__lavabo_wc';
  const z0=-24.20, cx=12.59;
  // meuble à persiennes : une porte à gauche, deux tiroirs à droite
  const mx0=cx-0.28, mx1=cx+0.28, mz1=z0+0.33, h=0.60;
  boite(g,mx0,mx1,0.02,h,z0,mz1-0.018,blanc);
  boite(g,mx0+0.003,cx-0.003,0.03,h-0.01,mz1-0.018,mz1,blanc,true);
  boite(g,cx+0.003,mx1-0.003,h/2+0.003,h-0.01,mz1-0.018,mz1,blanc,true);
  boite(g,cx+0.003,mx1-0.003,0.03,h/2-0.003,mz1-0.018,mz1,blanc,true);
  lignes(g,mx0+0.03,cx-0.03,0.06,h-0.04,mz1+0.001,0.025);
  lignes(g,cx+0.03,mx1-0.03,h/2+0.03,h-0.04,mz1+0.001,0.025);
  lignes(g,cx+0.03,mx1-0.03,0.06,h/2-0.03,mz1+0.001,0.025);
  for(const [x,y] of [[cx-0.04,h-0.08],[cx+0.14,h*0.75],[cx+0.14,h*0.25]]){
    const b=new THREE.Mesh(new THREE.SphereGeometry(0.012,12,8),blanc); b.position.set(x,y,mz1+0.012); g.add(b); }
  // vasque 50 × 40 cm, creuse
  const v0=cx-0.25, v1=cx+0.25, vz1=z0+0.40, y0=0.69, y1=0.85, e=0.02;
  boite(g,v0,v1,y0,y0+0.04,z0,vz1,ceramique);
  boite(g,v0,v1,y0,y1,z0,z0+0.08,ceramique);
  boite(g,v0,v1,y0,y1,vz1-e,vz1,ceramique);
  boite(g,v0,v0+e,y0,y1,z0,vz1,ceramique);
  boite(g,v1-e,v1,y0,y1,z0,vz1,ceramique);
  // robinet
  const pied=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.02,0.14,16),chrome); pied.position.set(cx+0.02,y1+0.07,z0+0.05); g.add(pied);
  boite(g,cx+0.005,cx+0.035,y1+0.11,y1+0.13,z0+0.05,z0+0.16,chrome);
  // miroir
  boite(g,cx-0.26,cx+0.26,1.12,1.87,z0,z0+0.006,miroir);
  return g;
}

function machines(){
  const g=new THREE.Group(); g.name='rez__lave_linge';
  const x0=11.41, x1=12.01, zb=-24.91, zf=-24.31, cx=(x0+x1)/2;
  // lave-linge (0 à 0,85 m)
  boite(g,x0,x1,0,0.85,zb,zf,blanc,true);
  boite(g,x0+0.07,x0+0.40,0.74,0.81,zf,zf+0.008,sombre);
  boite(g,x1-0.19,x1-0.03,0.70,0.80,zf,zf+0.03,blanc,true);
  const anneau=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.03,12,40),chrome); anneau.position.set(cx,0.40,zf+0.03); g.add(anneau);
  const vitre=new THREE.Mesh(new THREE.CircleGeometry(0.15,40),hublot); vitre.position.set(cx,0.40,zf+0.035); g.add(vitre);
  // sèche-linge posé dessus (0,86 à 1,71 m) : grille d'aération, grande porte plate, bandeau de commande en haut
  boite(g,x0,x1,0.86,1.71,zb,zf,blanc,true);
  lignes(g,x0+0.05,x1-0.05,0.90,1.07,zf+0.001,0.018);
  boite(g,x0+0.01,x1-0.01,1.09,1.58,zf,zf+0.03,blanc,true);
  boite(g,x0+0.08,x0+0.42,1.61,1.69,zf,zf+0.008,sombre);
  return g;
}

export function construireBuanderie(root){ return [wc(root),lavabo(),machines()]; }

// Sol du WC : la mosaïque bleue SketchUp devient le carrelage anthracite 30 × 30 cm des photos
export function carrelerSol(mesh){
  const c=document.createElement('canvas'); c.width=c.height=128;
  const x=c.getContext('2d'); x.fillStyle='#55595e'; x.fillRect(0,0,128,128);
  x.fillStyle='#3a3e43'; x.fillRect(2,2,124,124);
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.colorSpace=THREE.SRGBColorSpace;
  // UV recalculés en coordonnées monde : un carreau tous les 30 cm
  mesh.updateMatrixWorld(true);
  const geo=mesh.geometry.clone(), p=geo.attributes.position, v=new THREE.Vector3(), uv=[];
  for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld); uv.push(v.x/0.30,v.z/0.30); }
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); mesh.geometry=geo;
  mesh.material=new THREE.MeshStandardMaterial({map:tex,roughness:0.6});
}
