// Dessus des éléments coupés par les vues « Rez » (2,33 m) et « Étage » (5,15 m). Un meuble plus haut que la coupe
// (armoire du dégagement jusqu'au plafond, bibliothèque, retombée de la cuisine, cadres des fenêtres…) était creux vu
// d'en haut : ses faces n'ont qu'un côté, on voyait le sol à travers (Mauro, 9 octobre 2026). Au chargement, on calcule
// sa section juste sous la coupe (triangles coupés par le plan → segments → grille de 6 mm remplie depuis l'extérieur :
// ce que l'extérieur n'atteint pas est plein, même si le meuble n'a pas de fond ni de dos) et on y pose un couvercle
// dans la matière la plus présente sur la coupe. Les couvercles ne sont affichés que lorsque leur coupe est active.
// Les murs de la structure n'en ont pas besoin (leurs dos sont doublés), ni les parties mobiles des portes et fenêtres.
import * as THREE from 'three';
import {app} from './app.js';
import {REZ_CUT, ROOF_CUT} from './config.js';

const PAS=0.006, SOUS=0.004, couvercles=[];
const A=new THREE.Vector3(), B=new THREE.Vector3(), C=new THREE.Vector3();

// Segments [x0, z0, x1, z1] où le plan y = h coupe les faces de l'élément, et longueur coupée par matériau
function section(racine,h){
  const segs=[], parMat=new Map();
  racine.updateMatrixWorld(true);
  racine.traverse(o=>{
    if(!o.isMesh||o.userData.dos||o.userData.porte||o.userData.vitre) return;
    const m=o.material; if(Array.isArray(m)||m.transparent) return;
    const bb=new THREE.Box3().setFromObject(o); if(bb.min.y>=h||bb.max.y<=h) return;
    const pos=o.geometry.attributes.position, idx=o.geometry.index, n=idx?idx.count:pos.count;
    for(let i=0;i<n;i+=3){
      A.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(o.matrixWorld);
      B.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1).applyMatrix4(o.matrixWorld);
      C.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2).applyMatrix4(o.matrixWorld);
      const s=[];
      for(const [P,Q] of [[A,B],[B,C],[C,A]]) if((P.y-h)*(Q.y-h)<0){ const t=(h-P.y)/(Q.y-P.y); s.push(P.x+(Q.x-P.x)*t,P.z+(Q.z-P.z)*t); }
      if(s.length===4){ segs.push(s); parMat.set(m,(parMat.get(m)||0)+Math.hypot(s[2]-s[0],s[3]-s[1])); }
    }
  });
  return {segs,parMat};
}

// Couvercle (coordonnées monde, face vers le haut) : cellules de la grille non atteintes depuis le bord, regroupées
// en rectangles (rangées identiques fusionnées)
function couvercle(segs,y){
  let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
  for(const s of segs){ x0=Math.min(x0,s[0],s[2]); x1=Math.max(x1,s[0],s[2]); z0=Math.min(z0,s[1],s[3]); z1=Math.max(z1,s[1],s[3]); }
  x0-=2*PAS; z0-=2*PAS; x1+=2*PAS; z1+=2*PAS;
  const nx=Math.ceil((x1-x0)/PAS), nz=Math.ceil((z1-z0)/PAS); if(nx*nz>600000) return null;
  const mur=new Uint8Array(nx*nz), dehors=new Uint8Array(nx*nz);
  for(const [ax,az,bx,bz] of segs){
    const k=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/(PAS*0.5)));
    for(let i=0;i<=k;i++) mur[Math.floor((az+(bz-az)*i/k-z0)/PAS)*nx+Math.floor((ax+(bx-ax)*i/k-x0)/PAS)]=1;
  }
  const pile=[]; for(let i=0;i<nx;i++) pile.push(i,(nz-1)*nx+i); for(let j=0;j<nz;j++) pile.push(j*nx,j*nx+nx-1);
  while(pile.length){ const k=pile.pop(); if(dehors[k]||mur[k]) continue; dehors[k]=1; const i=k%nx, j=(k-i)/nx;
    if(i>0) pile.push(k-1); if(i<nx-1) pile.push(k+1); if(j>0) pile.push(k-nx); if(j<nz-1) pile.push(k+nx); }
  const rects=[]; let ouverts=new Map();
  for(let j=0;j<=nz;j++){
    const suivants=new Map();
    if(j<nz) for(let i=0;i<nx;){ if(dehors[j*nx+i]){ i++; continue; } let f=i; while(f<nx&&!dehors[j*nx+f]) f++;
      const cle=i+','+f, r=ouverts.get(cle); if(r){ r.j1=j+1; suivants.set(cle,r); ouverts.delete(cle); } else suivants.set(cle,{i0:i,i1:f,j0:j,j1:j+1}); i=f; }
    for(const r of ouverts.values()) rects.push(r);
    ouverts=suivants;
  }
  if(!rects.length) return null;
  const p=[], uv=[], ind=[];
  for(const r of rects){
    const xa=x0+r.i0*PAS, xb=x0+r.i1*PAS, za=z0+r.j0*PAS, zb=z0+r.j1*PAS, b=p.length/3;
    p.push(xa,y,za, xa,y,zb, xb,y,zb, xb,y,za); uv.push(xa,za, xa,zb, xb,zb, xb,za);
    ind.push(b,b+1,b+2, b,b+2,b+3);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(p.length).fill(0).map((_,k)=>k%3===1?1:0),3)); g.setIndex(ind);
  return g;
}

// Pose les couvercles : éléments de la liste (dans leur groupe, ils suivent déplacement, rotation, masquage et couleur)
// et éléments fixes construits en code (escalier, muret, cloison du réduit). Appelé une fois le mobilier installé.
const FIXES=['rez__escalier','rez__cloison','rez__cloison_reduit'];
export function poserCouvercles(){
  const cibles=[...Object.values(app.items).map(it=>({o:it.g,it})),
    ...FIXES.map(n=>app.model.getObjectByName(n)).filter(Boolean).map(o=>({o,it:null}))];
  for(const {o,it} of cibles){
    const etage=o.name.startsWith('etage'), h=(etage?ROOF_CUT:REZ_CUT)-SOUS;
    const bb=new THREE.Box3().setFromObject(o); if(bb.min.y>=h||bb.max.y<=h) continue;
    const {segs,parMat}=section(o,h); if(!segs.length) continue;
    const geo=couvercle(segs,h); if(!geo) continue;
    const mat=[...parMat.entries()].sort((a,b)=>b[1]-a[1])[0][0];
    geo.applyMatrix4(o.matrixWorld.clone().invert());
    const m=new THREE.Mesh(geo,mat); m.name=o.name+'__couvercle'; m.userData.coupe=etage?'etage':'rez'; m.visible=false;
    if(it){ m.userData.item=it.name; it.mats.push(m); } else m.raycast=()=>{};
    o.add(m); couvercles.push(m);
  }
}
// À chaque image : un couvercle n'est visible que si la coupe de son niveau est active (vue Rez ou Étage en maquette)
export function majCouvercles(){
  const plans=app.renderer.clippingPlanes;
  const rez=plans.some(p=>p.normal.y<0&&Math.abs(p.constant-REZ_CUT)<1e-6), etage=plans.some(p=>p.normal.y<0&&Math.abs(p.constant-ROOF_CUT)<1e-6);
  // un meuble redimensionné (étape 4) n'a plus la section calculée : pas de couvercle
  for(const m of couvercles){ const e=m.parent?.scale; m.visible=(m.userData.coupe==='rez'?rez:etage)&&(!e||(e.x===1&&e.y===1&&e.z===1)); }
}
