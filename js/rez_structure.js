// Structure du rez corrigée d'après les photos : escalier en marches (et non en bloc plein) avec un réduit
// dessous, muret rampant le long de l'escalier, cloison du réduit, plafond rampant du salon, tableau électrique.
import * as THREE from 'three';
import {MAT, boite, plafond, fusionner} from './formes.js';

// Escalier relevé dans le modèle : 14 marches de 28,3 cm, contremarches de 18,27 cm, 90 cm de large
const ESC={x0:12.868, x1:13.768, zBas:-17.148, giron:0.2829, haut:0.18267, n:14, zHaut:-21.108};

// Remplace un élément du modèle par un groupe vide du même nom (l'élément peut être un simple maillage)
function remplacer(node,root){ const g=new THREE.Group(); g.name=node.name; node.removeFromParent(); root.add(g); return g; }

export function remplacerEscalier(node,root){
  const g=remplacer(node,root), {x0,x1,zBas,giron,haut,n}=ESC;
  for(let i=0;i<n;i++){
    const zf=zBas-i*giron, zb=zf-giron, y=(i+1)*haut;
    boite(g,x0,x1,y-0.03,y,zb,zf+0.02,MAT.pierre);                 // marche (débord de 2 cm)
    boite(g,x0,x1,i*haut,y-0.03,zf-0.02,zf,MAT.pierre);             // contremarche
    boite(g,x0,x1,y-0.012,y,zf+0.02,zf+0.026,MAT.inox);             // nez de marche alu
  }
  boite(g,x0,x1,n*haut,15*haut,ESC.zHaut,ESC.zHaut+0.02,MAT.pierre); // dernière contremarche jusqu'à l'étage
  // sous-face rampante : plafond du réduit
  const pente=(15*haut)/(ESC.zHaut-zBas), yS=z=>Math.max(0,(z-zBas)*pente-0.30);
  const zPied=zBas+0.30/pente, sous=new THREE.MeshStandardMaterial({color:0xf0ede6,roughness:0.8,side:THREE.DoubleSide});
  fusionner(g);
  const sf=plafond([[x0,0,zPied],[x1,0,zPied],[x1,yS(ESC.zHaut),ESC.zHaut],[x0,yS(ESC.zHaut),ESC.zHaut]],sous);
  sf.userData.collider=true; g.add(sf);                              // en visite, la sous-face arrête dans le réduit
}

// Le mur entre l'escalier et la bibliothèque est un muret qui suit la pente (≈ 95 cm au-dessus des nez de marche)
export function remplacerCloison(node,root){
  let mat=MAT.mur; node.traverse(o=>{ if(o.isMesh&&!o.userData.dos) mat=o.material; });
  const g=remplacer(node,root);
  const s=new THREE.Shape(), zb=ESC.zBas+0.05;
  s.moveTo(zb,0); s.lineTo(ESC.zHaut,0); s.lineTo(ESC.zHaut,3.72); s.lineTo(ESC.zBas,1.13); s.lineTo(zb,1.13); s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:0.05,bevelEnabled:false}); geo.rotateY(-Math.PI/2); geo.translate(13.818,0,0);
  g.add(new THREE.Mesh(geo,mat));
}

// Cloison du réduit sous l'escalier, percée pour sa porte (x 12,93 → 13,70, hauteur 2,04 m ; la porte est un
// élément de la liste « Portes et fenêtres »)
export function cloisonReduit(){
  const g=new THREE.Group(); g.name='rez__cloison_reduit';
  boite(g,ESC.x0,12.93,0,2.40,-21.10,-21.03,MAT.mur); boite(g,13.70,ESC.x1,0,2.40,-21.10,-21.03,MAT.mur);
  boite(g,12.93,13.70,2.04,2.40,-21.10,-21.03,MAT.mur);
  return g;
}

// Pan sud du toit, absent du modèle : de 2,74 m au-dessus de la baie au faîte (5,80 m), au-dessus du salon et
// des pièces de l'étage. Visible seulement par-dessous, pour que la vue maquette reste ouverte.
export const yToitSud=z=>2.74+(5.80-2.74)*(-14.14-z)/(-14.14+25.5);
export function toitSud(){
  const g=new THREE.Group(); g.name='toit_sud';
  const y=yToitSud;
  const mat=new THREE.MeshStandardMaterial({color:0xf2efe9,roughness:0.85});
  g.add(plafond([[12.67,y(-14.14),-14.14],[19.64,y(-14.14),-14.14],[19.64,y(-20.91),-20.91],[12.67,y(-20.91),-20.91]],mat));
  g.add(plafond([[11.11,y(-20.91),-20.91],[19.64,y(-20.91),-20.91],[19.64,y(-25.5),-25.5],[11.11,y(-25.5),-25.5]],mat));
  g.traverse(o=>{ o.raycast=()=>{}; });
  return g;
}

// Détails muraux de l'entrée : tableau électrique et cache bas (mur ouest, x = 11,45)
export function decorEntree(){
  const g=new THREE.Group(); g.name='rez__decor_entree';
  boite(g,11.45,11.47,1.25,1.88,-22.10,-21.62,MAT.blanc,true);
  boite(g,11.45,11.465,0.12,0.52,-22.22,-21.55,MAT.blanc,true);
  g.traverse(o=>{ o.raycast=()=>{}; });
  return g;
}
