// Structure de l'étage corrigée d'après les photos de Mauro : sol de la douche au niveau du plancher,
// lames de pin sous le pan sud du toit (chambre, douche + WC, dressing ; le pan nord reste blanc),
// mur sud du dressing aubergine.
import * as THREE from 'three';
import {ETAGE_FLOOR} from './config.js';
import {boite, plafond} from './formes.js';
import {yToitSud} from './rez_structure.js';

// Carrelage : carreaux carrés de « pas » mètres, couleur du carreau et du joint
function texCarreau(carreau,joint){
  const c=document.createElement('canvas'); c.width=c.height=128;
  const x=c.getContext('2d'); x.fillStyle=joint; x.fillRect(0,0,128,128); x.fillStyle=carreau; x.fillRect(2,2,124,124);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t;
}
// Lames de pin : 8 lames de 12 cm sur 0,96 m, longues de 2,4 m, joints décalés, veinage et nœuds (tirage fixe)
function texPin(){
  const c=document.createElement('canvas'); c.width=1024; c.height=256; const x=c.getContext('2d');
  let s=7; const r=()=>((s=(s*16807)%2147483647)/2147483647);
  for(let i=0;i<8;i++){
    const y0=i*32, f=0.9+r()*0.14, ton=[218,172,112].map(v=>Math.round(v*f));
    x.fillStyle=`rgb(${ton})`; x.fillRect(0,y0,1024,32);
    for(let k=0;k<14;k++){ x.strokeStyle=`rgba(150,100,55,${0.10+r()*0.15})`; x.lineWidth=0.6+r(); x.beginPath();
      const yy=y0+2+r()*28; x.moveTo(0,yy); for(let u=0;u<=1024;u+=64) x.lineTo(u,yy+Math.sin(u/90+k)*1.5*r()); x.stroke(); }
    for(let k=0;k<2;k++){ x.fillStyle='rgba(120,75,35,0.55)'; x.beginPath(); x.ellipse(r()*1024,y0+6+r()*20,4+r()*4,2.5+r()*2,0,0,Math.PI*2); x.fill(); }
    x.fillStyle='rgba(95,60,30,0.75)'; x.fillRect(0,y0,1024,1.5);
    const j=Math.round(r()*1024); x.fillRect(j,y0,1.5,32);
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}

// Plafond en pente sous le toit, de z0 à z1, abaissé de 3 cm sous le toit ; lames parallèles au faîte (axe x)
function pente(g,x0,x1,z0,z1,yToit,mat){
  const y0=yToit(z0)-0.03, y1=yToit(z1)-0.03;
  const m=plafond([[x0,y0,z0],[x1,y0,z0],[x1,y1,z1],[x0,y1,z1]],mat), l=Math.hypot(z1-z0,y1-y0);
  m.geometry.setAttribute('uv',new THREE.Float32BufferAttribute([x0/2.4,0, x1/2.4,0, x1/2.4,l/0.96, x0/2.4,l/0.96],2));
  g.add(m);
}

export function plafondsPin(){
  const g=new THREE.Group(); g.name='etage__plafonds_pin';
  const pin=new THREE.MeshStandardMaterial({map:texPin(),roughness:0.7});
  pente(g,16.78,19.44,-25.50,-22.83,yToitSud,pin);                                         // chambre de l'étage
  pente(g,11.31,13.97,-25.50,-22.83,yToitSud,pin);                                         // dressing
  pente(g,16.78,19.44,-22.75,-21.40,yToitSud,pin); pente(g,17.62,19.44,-21.40,-21.19,yToitSud,pin);   // douche + WC
  g.traverse(o=>{ o.raycast=()=>{}; });
  return g;
}

// Sol de la douche + WC : dans le modèle il est 34 cm trop bas (2,40 m) ; carrelage bleu ardoise des photos
export function solDouche(){
  const g=new THREE.Group(); g.name='etage__sol_douche';
  const mat=new THREE.MeshStandardMaterial({map:texCarreau('#3d4a56','#5b6670'),roughness:0.55});
  for(const [x0,x1,z0,z1] of [[16.78,19.44,-22.79,-21.40],[17.62,19.44,-21.40,-21.19],[16.70,16.86,-22.83,-21.80]]){   // pièce + seuil (couvre aussi le pied des chambranles)
    const geo=new THREE.PlaneGeometry(x1-x0,z1-z0); geo.rotateX(-Math.PI/2); geo.translate((x0+x1)/2,ETAGE_FLOOR+0.002,(z0+z1)/2);
    const p=geo.attributes.position, uv=[]; for(let i=0;i<p.count;i++) uv.push(p.getX(i)/0.30,p.getZ(i)/0.30);
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.add(new THREE.Mesh(geo,mat));
  }
  return g;
}

// Mur sud du dressing peint en aubergine, côté intérieur (de part et d'autre de la porte et au-dessus)
export function murAubergine(){
  const g=new THREE.Group(); g.name='etage__mur_dressing';
  const mat=new THREE.MeshStandardMaterial({color:0x452532,roughness:0.8}), z=-22.83, h=yToitSud(z)-0.01;
  boite(g,11.31,12.93,ETAGE_FLOOR,h,z-0.006,z,mat); boite(g,12.93,13.92,4.88,h,z-0.006,z,mat); boite(g,13.92,13.97,ETAGE_FLOOR,h,z-0.006,z,mat);
  g.traverse(o=>{ o.raycast=()=>{}; });
  return g;
}

// Dans le modèle, la face du mur ouest de la douche (côté douche, x = 16,78) bouche l'ouverture de la porte :
// on neutralise les triangles de cette face situés dans l'ouverture (z -22,79 → -21,89, jusqu'au linteau 4,88 m)
export function ouvrirPorteDouche(root){
  const st=root.getObjectByName('structure_etage'); if(!st) return 0;
  st.updateMatrixWorld(true); const v=new THREE.Vector3(); let n=0;
  const dedans=()=>Math.abs(v.x-16.778)<0.006&&v.z>-22.79&&v.z<-21.89&&v.y>ETAGE_FLOOR-0.01&&v.y<4.885;
  st.traverse(o=>{ if(!o.isMesh||!o.geometry.index) return;
    const idx=o.geometry.index, p=o.geometry.attributes.position;
    for(let t=0;t<idx.count;t+=3){
      let ok=true; for(let k=0;k<3&&ok;k++){ v.fromBufferAttribute(p,idx.getX(t+k)).applyMatrix4(o.matrixWorld); ok=dedans(); }
      if(ok){ const a=idx.getX(t); idx.setX(t+1,a); idx.setX(t+2,a); n++; }
    }
    idx.needsUpdate=true; });
  return n;
}

// Murs de la douche + WC : la texture « marbre » du modèle devient le carrelage des photos, carreaux gris clair
// de 25 cm et frise sombre à 1,80 m (texture de 0,50 × 2,50 m posée en coordonnées monde, depuis le plancher)
export function carrelerDouche(root){
  const c=document.createElement('canvas'); c.width=256; c.height=1280; const x=c.getContext('2d'), px=512;
  x.fillStyle='#e6e6e3'; x.fillRect(0,0,256,1280);
  let s=5; for(let i=0;i<2;i++) for(let j=0;j<10;j++){ s=(s*16807)%2147483647; const t=196+s%10; x.fillStyle=`rgb(${t},${t+1},${t+2})`; x.fillRect(i*128+2,j*128+2,124,124); }
  const y0=(2.50-1.86)*px, h=0.06*px;                                   // frise : bande noire à motif blanc
  x.fillStyle='#22262b'; x.fillRect(0,y0,256,h); x.strokeStyle='#d8dadc'; x.lineWidth=3; x.beginPath();
  for(let u=0;u<=256;u+=16){ x.lineTo(u,y0+(u/16%2?h*0.25:h*0.75)); } x.stroke();
  const tex=new THREE.CanvasTexture(c); tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.ClampToEdgeWrapping; tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.MeshStandardMaterial({map:tex,roughness:0.35}), v=new THREE.Vector3(), n=new THREE.Vector3(), nm=new THREE.Matrix3();
  root.traverse(o=>{ if(!o.isMesh||o.material.name!=='Material_364') return;
    o.updateMatrixWorld(true); nm.getNormalMatrix(o.matrixWorld);
    const geo=o.geometry.clone(), p=geo.attributes.position, no=geo.attributes.normal, uv=[];
    for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld); n.fromBufferAttribute(no,i).applyMatrix3(nm);
      uv.push((Math.abs(n.x)>Math.abs(n.z)?v.z:v.x)/0.50,(v.y-ETAGE_FLOOR)/2.50); }
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); o.geometry=geo; o.material=mat; });
}
