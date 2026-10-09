// Fenêtres ouvrables (demande de Mauro du 9 octobre 2026). Dans le modèle, cadre, ouvrant et vitre sont fondus : ils sont
// retirés et reconstruits en code (dormant dans l'épaisseur du mur, ouvrant sur charnière, vitre, poignée), mêmes
// mesures et même bois. Sens d'ouverture et poignées d'après les annotations de Mauro ; ouverture à la main seulement
// (jamais à l'approche), comme les portes : toucher la fenêtre, bouton du panneau en Éditer, « Ouvrir les fenêtres ».
import * as THREE from 'three';
import {app} from './app.js';
import {MAT, boite, fusionner, uvMonde} from './formes.js';

const VERRE=new THREE.MeshStandardMaterial({color:0xdcebf0,transparent:true,opacity:0.16,roughness:0.05,side:THREE.DoubleSide,depthWrite:false});
const DROIT=Math.PI/2;

// axe 'x' : mur à x constant (a = z) ; axe 'z' : mur à z constant (a = x). int / ext : faces intérieure et extérieure du
// cadre (l'intérieur de la pièce est du côté de int). a, y : contour extérieur du dormant (le trou du mur).
// d : largeur des montants du dormant [gauche, droite, bas, haut] (le haut comprend le caisson de store s'il y en a un).
// meneaux : montants fixes intermédiaires. ouvrants : a, y (contour), p (largeur des profilés), type 'battant' (charnière
// verticale en a = charniere), 'bas' (charnière en bas, bascule vers l'intérieur), part = part de l'ouverture complète
// (90°) ; poignee : position [a, y] côté pièce. store : zone (a, y) du store intérieur du modèle, qui suit l'ouvrant.
export const FENETRES=[
  {nom:'rez__fenetre_salon_grande', axe:'x', int:19.438, ext:19.618, a:[-17.193,-15.218], y:[0.575,2.56], d:[0.06,0.06,0.06,0.32],
    ouvrants:[{a:[-17.133,-15.278], y:[0.635,2.24], p:0.08, type:'battant', charniere:-15.278, part:1, poignee:[-17.085,1.30]}]},
  {nom:'rez__Fenetre_salon_haute', axe:'x', int:19.438, ext:19.658, a:[-20.478,-18.403], y:[1.93,3.255], d:[0.06,0.06,0.06,0.305],
    ouvrants:[{a:[-20.418,-18.463], y:[1.99,2.95], p:0.08, type:'bas', part:1, poignee:[-19.45,2.915]}]},
  {nom:'rez__fenetre_chambre_coucher', axe:'x', int:19.418, ext:19.638, a:[-26.978,-25.093], y:[1.03,2.39], d:[0.07,0.07,0.06,0.36],
    meneaux:[[-26.21,-26.15]],                                       // deux fenêtres collées (précisé par Mauro)
    ouvrants:[{a:[-26.908,-26.21], y:[1.09,2.03], p:0.08, type:'battant', charniere:-26.908, part:1, poignee:[-26.255,1.47]},
              {a:[-26.15,-25.163], y:[1.09,2.03], p:0.08, type:'battant', charniere:-25.163, part:1, poignee:[-26.105,1.47]}]},
  {nom:'rez__Fenetre_salle_de_bain', axe:'z', int:-27.778, ext:-27.998, a:[11.738,13.093], y:[0.89,1.26], d:[0.02,0.02,0.02,0.02],
    ouvrants:[{a:[11.758,13.073], y:[0.91,1.24], p:0.02, type:'bas', part:0.3, poignee:[12.45,1.225]}], store:{a:[11.77,13.06],y:[0.915,1.215]}},
  {nom:'rez__store_fenetre', axe:'z', int:-21.128, ext:-20.908, a:[11.458,12.533], y:[3.60,4.32], d:[0.06,0.06,0.06,0.06], bois:'Material_13',
    ouvrants:[{a:[11.518,12.473], y:[3.66,4.26], p:0.08, type:'bas', part:0.3, poignee:[11.965,4.215]}], store:{a:[11.59,12.40],y:[3.67,4.18]}},
  {nom:'etage__Fenetre_chambre_etage', axe:'x', int:19.418, ext:19.538, a:[-25.423,-24.248], y:[3.76,5.185], d:[0.06,0.06,0.06,0.325],
    ouvrants:[{a:[-25.363,-24.308], y:[3.82,4.86], p:0.07, type:'battant', charniere:-24.308, part:1, poignee:[-25.31,4.26]}]},
  {nom:'etage__fenetre_douche_etage', axe:'x', int:19.418, ext:19.538, a:[-22.748,-22.078], y:[4.06,4.72], d:[0.06,0.06,0.06,0.06],
    ouvrants:[{a:[-22.688,-22.138], y:[4.12,4.66], p:0.08, type:'battant', charniere:-22.688, part:1, poignee:[-22.185,4.48]}]}
];
// Baie vitrée : le panneau ouest (poignée) coulisse devant le panneau fixe et s'arrête à hauteur de la télévision
export const BAIE={nom:'rez__baie_vitree', int:-14.347, ext:-14.111, a:[12.888,18.588], y:[0.02,2.72], mobile:[13.11,15.72], fixe:[15.60,18.52],
  bas:0.06, haut:2.38, course:1.38};
// Velux : charnière en haut côté extérieur, tout l'ouvrant part vers l'extérieur, le bas se soulève, 30 % de l'ouverture (précisé par Mauro)
export const VELUX=[{nom:'etage__Velux', x:[15.363,16.118]}, {nom:'etage__Velux_2', x:[12.733,13.488]}];
const VELUX_BAS=new THREE.Vector3(0,3.567,-26.990), VELUX_HAUT=new THREE.Vector3(0,4.699,-26.357);

// Pièce de bois : boîte en coordonnées locales du parent (a le long du mur, y, d dans l'épaisseur), veinage à l'échelle
function piece(g,f,a0,a1,y0,y1,d0,d1,mat){
  const [la,ha]=[Math.min(a0,a1),Math.max(a0,a1)], [ld,hd]=[Math.min(d0,d1),Math.max(d0,d1)];
  const b=f.axe==='x'?boite(g,ld,hd,y0,y1,la,ha,mat):boite(g,la,ha,y0,y1,ld,hd,mat);
  if(mat.map){ b.geometry.translate(b.position.x,b.position.y,b.position.z); b.position.set(0,0,0); uvMonde(b.geometry); }
  return b;
}
// Ouvrant : profilés, vitre au milieu de l'épaisseur, construits dans le repère du pivot (charnière)
function cadreOuvrant(g,f,o,orig,s,bois){
  const [a0,a1]=o.a.map(v=>v-orig.a), [y0,y1]=o.y.map(v=>v-orig.y), p=o.p, e=0.07, d0=0, d1=-s*e;    // de la face intérieure vers l'extérieur
  piece(g,f,a0,a0+p,y0,y1,d0,d1,bois); piece(g,f,a1-p,a1,y0,y1,d0,d1,bois);
  piece(g,f,a0+p,a1-p,y0,y0+p,d0,d1,bois); piece(g,f,a0+p,a1-p,y1-p,y1,d0,d1,bois);
  const v=piece(g,f,a0+p,a1-p,y0+p,y1-p,-s*0.032,-s*0.038,VERRE); v.userData.vitre=true;
  // poignée côté pièce : béquille verticale (battant) ou horizontale (bascule), rosette
  const [pa,py]=[o.poignee[0]-orig.a,o.poignee[1]-orig.y];
  piece(g,f,pa-0.015,pa+0.015,py-0.035,py+0.035,s*0.0,s*0.012,MAT.chrome);
  if(o.type==='bas') piece(g,f,pa-0.07,pa+0.07,py-0.01,py+0.01,s*0.012,s*0.03,MAT.chrome);
  else piece(g,f,pa-0.01,pa+0.01,py-0.12,py+0.01,s*0.012,s*0.03,MAT.chrome);
}

// Triangles d'un maillage dont le centre passe le test (coordonnées monde) : nouveau maillage, en coordonnées monde
// (les attributs du modèle sont compressés en entiers normalisés : ils sont d'abord convertis en flottants)
function enFlottants(geo){
  const g=new THREE.BufferGeometry(), lire=['getX','getY','getZ','getW'];
  for(const [nom,att] of Object.entries(geo.attributes)){ const n=att.itemSize, a=new Float32Array(att.count*n);
    for(let i=0;i<att.count;i++) for(let j=0;j<n;j++) a[i*n+j]=att[lire[j]](i);
    g.setAttribute(nom,new THREE.BufferAttribute(a,n)); }
  if(geo.index) g.setIndex(geo.index.clone()); return g;
}
function extraire(mesh,test){
  mesh.updateMatrixWorld(true);
  let g=enFlottants(mesh.geometry); if(g.index) g=g.toNonIndexed(); g.applyMatrix4(mesh.matrixWorld);
  const p=g.attributes.position, garde=[], c=new THREE.Vector3(), t=new THREE.Vector3();
  for(let i=0;i+2<p.count;i+=3){ c.fromBufferAttribute(p,i).add(t.fromBufferAttribute(p,i+1)).add(t.fromBufferAttribute(p,i+2)).multiplyScalar(1/3); if(test(c)) garde.push(i,i+1,i+2); }
  if(!garde.length) return null;
  const ng=new THREE.BufferGeometry();
  for(const [nom,att] of Object.entries(g.attributes)){ const n=att.itemSize, arr=new att.array.constructor(garde.length*n);
    garde.forEach((i,k)=>{ for(let j=0;j<n;j++) arr[k*n+j]=att.array[i*n+j]; }); ng.setAttribute(nom,new THREE.BufferAttribute(arr,n)); }
  return new THREE.Mesh(ng,mesh.material);
}

// après fusion par matériau, la vitre garde son étiquette (vitres reconnues par les tests et la sélection)
function marquerVitres(g){ g.traverse(o=>{ if(o.isMesh&&o.material===VERRE) o.userData.vitre=true; }); return g; }
function enregistrer(node,pivot,ouvert,poser,nom,vitesse=2){
  node.updateMatrixWorld(true); const c=new THREE.Box3().setFromObject(pivot).getCenter(new THREE.Vector3());
  const p={def:{nom,fenetre:true,auto:false,y0:0}, nom, pivot, feuille:null, ouvert, angle:0, cible:false, manuel:false, node, poser, vitesse,
    centreLocal:node.worldToLocal(c)};
  pivot.traverse(o=>{ if(o.isMesh){ o.userData.porte=p; if(!p.feuille&&!o.userData.vitre) p.feuille=o; } });
  app.portes.push(p); return p;
}

function fenetre(root,f){
  const node=root.getObjectByName(f.nom); if(!node) return;
  node.updateMatrixWorld(true);
  let bois=null; node.traverse(o=>{ if(o.isMesh&&o.material.name===(f.bois||'Material_297')&&!bois) bois=o.material; });
  bois=bois||MAT.chene;
  const s=Math.sign(f.int-f.ext);                                   // vers la pièce
  // le store intérieur du modèle (lames, tissu, cordon) est gardé et suivra l'ouvrant
  const stores=[];
  if(f.store){ const [la,ha]=f.store.a, [ly,hy]=f.store.y;
    node.traverse(m=>{ if(!m.isMesh||/Material_297|Material_13|Material_30[01]/.test(m.material.name)||m.userData.vitre) return;
      const x=extraire(m,c=>{ const a=f.axe==='x'?c.z:c.x, d=f.axe==='x'?c.x:c.z, dd=(d-f.int)*s;
        return a>la&&a<ha&&c.y>ly&&c.y<hy&&dd>-0.03&&dd<0.08; });
      if(x) stores.push(x); }); }
  const vieux=[]; node.traverse(o=>{ if(o.isMesh) vieux.push(o); }); for(const o of vieux) o.removeFromParent();
  // dormant : montants, traverses, caisson, meneaux, sur toute l'épaisseur
  const g=new THREE.Group(), [A0,A1]=f.a, [Y0,Y1]=f.y, [dg,dd,db,dh]=f.d;
  piece(g,f,A0,A0+dg,Y0,Y1,f.int,f.ext,bois); piece(g,f,A1-dd,A1,Y0,Y1,f.int,f.ext,bois);
  piece(g,f,A0+dg,A1-dd,Y0,Y0+db,f.int,f.ext,bois); piece(g,f,A0+dg,A1-dd,Y1-dh,Y1,f.int,f.ext,bois);
  for(const [m0,m1] of f.meneaux||[]) piece(g,f,m0,m1,Y0+db,Y1-dh,f.int,f.ext,bois);
  fusionner(g); node.attach(g);
  for(const [k,o] of f.ouvrants.entries()){
    const pivot=new THREE.Group(); pivot.name=f.nom+'__ouvrant'+(k||'');
    const orig={a:o.type==='battant'?o.charniere:(o.a[0]+o.a[1])/2, y:o.y[0]};
    if(f.axe==='x') pivot.position.set(f.int,orig.y,orig.a); else pivot.position.set(orig.a,orig.y,f.int);
    cadreOuvrant(pivot,f,o,orig,s,bois); marquerVitres(fusionner(pivot));
    node.updateMatrixWorld(true); node.attach(pivot);
    const angle=o.part*DROIT; let ouvert, poser;
    if(o.type==='battant'){ const dir=Math.sign((o.a[0]+o.a[1])/2-o.charniere); ouvert=(f.axe==='x'?s*dir:-s*dir)*angle; poser=v=>{ pivot.rotation.y=v; }; }
    else if(f.axe==='x'){ ouvert=-s*angle; poser=v=>{ pivot.rotation.z=v; }; }
    else { ouvert=s*angle; poser=v=>{ pivot.rotation.x=v; }; }
    if(k===0) for(const m of stores){ pivot.updateMatrixWorld(true); pivot.attach(m); }
    enregistrer(node,pivot,ouvert,poser,f.nom);
  }
}

// Baie vitrée : dormant, panneau fixe (rail extérieur), panneau coulissant (rail intérieur, côté pièce) avec sa poignée
function baie(root){
  const b=BAIE, f={axe:'z'}, node=root.getObjectByName(b.nom); if(!node) return;
  node.updateMatrixWorld(true);
  let bois=null; node.traverse(o=>{ if(o.isMesh&&o.material.name==='Material_297'&&!bois) bois=o.material; });
  // gardé : le seuil (2 cm) ; le reste (cadre, vitre, poignée) est refait
  const vieux=[]; node.traverse(o=>{ if(o.isMesh&&new THREE.Box3().setFromObject(o).max.y>0.021) vieux.push(o); });
  for(const o of vieux) o.removeFromParent();
  const g=new THREE.Group(), [A0,A1]=b.a, [Y0,Y1]=b.y;
  piece(g,f,A0,b.mobile[0],Y0,Y1,b.int,b.ext,bois); piece(g,f,b.fixe[1],A1,Y0,Y1,b.int,b.ext,bois);
  piece(g,f,b.mobile[0],b.fixe[1],Y0,b.bas,b.int,b.ext,bois); piece(g,f,b.mobile[0],b.fixe[1],b.haut,Y1,b.int,b.ext,bois);
  // panneau fixe, rail extérieur
  const panneau=(gp,a0,a1,d0,d1,pg,pd)=>{ piece(gp,f,a0,a0+pg,b.bas,b.haut,d0,d1,bois); piece(gp,f,a1-pd,a1,b.bas,b.haut,d0,d1,bois);
    piece(gp,f,a0+pg,a1-pd,b.bas,b.bas+0.10,d0,d1,bois); piece(gp,f,a0+pg,a1-pd,b.haut-0.09,b.haut,d0,d1,bois);
    const v=piece(gp,f,a0+pg,a1-pd,b.bas+0.10,b.haut-0.09,(d0+d1)/2-0.003,(d0+d1)/2+0.003,VERRE); v.userData.vitre=true; };
  panneau(g,b.fixe[0],b.fixe[1],b.ext-0.08,b.ext,0.13,0.09);
  marquerVitres(fusionner(g)); node.attach(g);
  // panneau coulissant, rail intérieur ; poignée de tirage verticale côté pièce
  const pivot=new THREE.Group(); pivot.name=b.nom+'__ouvrant';
  panneau(pivot,b.mobile[0],b.mobile[1],b.int,b.int+0.08,0.09,0.13);
  piece(pivot,f,b.mobile[0]+0.035,b.mobile[0]+0.06,0.92,1.28,b.int-0.035,b.int,MAT.chrome);
  marquerVitres(fusionner(pivot)); node.updateMatrixWorld(true); node.attach(pivot);
  // le nœud du modèle est mis à l'échelle (géométrie compressée) : la course est convertie dans son repère
  const base=pivot.position.clone(), dir=node.worldToLocal(new THREE.Vector3(1,0,0)).sub(node.worldToLocal(new THREE.Vector3()));
  // la baie est aussi une porte : elle suit « Ouvrir les portes » (et « Ouvrir les fenêtres »), sans ouverture automatique
  enregistrer(node,pivot,b.course,v=>{ pivot.position.copy(base).addScaledVector(dir,v); },b.nom,1.2).def.porte=true;
  // on ne sort pas par la baie ouverte : bloc invisible dans la moitié extérieure du mur
  const m=new THREE.Mesh(new THREE.BoxGeometry(b.fixe[1]-b.mobile[0],2.4,0.03),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  m.position.set((b.mobile[0]+b.fixe[1])/2,1.2,b.ext-0.02); m.updateMatrixWorld(true); app.colliders.push(m);
}

// Velux : cadre blanc et vitre dans le plan du toit (la doublure du modèle reste), charnière en haut côté extérieur :
// tout l'ouvrant part vers l'extérieur, le bas se soulève (30 %), rien n'entre dans la pièce ; barre de manœuvre en bas
function velux(root,v){
  const node=root.getObjectByName(v.nom); if(!node) return;
  let blanc=null; node.traverse(o=>{ if(o.isMesh&&o.material.name==='Material_363'&&!blanc) blanc=o.material; });
  const vieux=[]; node.traverse(o=>{ if(o.isMesh&&o.material.name!=='Material_368') vieux.push(o); }); for(const o of vieux) o.removeFromParent();
  const u=new THREE.Vector3(1,0,0), w=new THREE.Vector3().subVectors(VELUX_HAUT,VELUX_BAS), L=w.length(); w.normalize();
  const n=new THREE.Vector3().crossVectors(u,w);                    // vers l'intérieur (sud, vers le bas)
  const cadre=new THREE.Group(); cadre.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,w,n));
  cadre.position.set((v.x[0]+v.x[1])/2,(VELUX_BAS.y+VELUX_HAUT.y)/2,(VELUX_BAS.z+VELUX_HAUT.z)/2);
  const lx=(v.x[1]-v.x[0])/2, ly=L/2, p=0.06, m=blanc||MAT.blanc, H=ly+p, E=-0.03;
  const pivot=new THREE.Group(); pivot.name=v.nom+'__ouvrant'; pivot.position.set(0,H,E); cadre.add(pivot);   // arête haute, face extérieure
  const b=(x0,x1,y0,y1,z0,z1,mat)=>boite(pivot,x0,x1,y0-H,y1-H,z0-E,z1-E,mat);
  b(-lx-p,-lx,-ly-p,ly+p,-0.03,0.03,m); b(lx,lx+p,-ly-p,ly+p,-0.03,0.03,m);
  b(-lx,lx,-ly-p,-ly,-0.03,0.03,m); b(-lx,lx,ly,ly+p,-0.03,0.03,m);
  const verre=b(-lx,lx,-ly,ly,-0.003,0.003,VERRE); verre.userData.vitre=true;
  b(-lx+0.02,lx-0.02,-ly-0.03,-ly-0.005,0.03,0.05,MAT.inox);         // barre de manœuvre en bas, côté pièce
  marquerVitres(fusionner(pivot)); node.updateMatrixWorld(true); node.attach(cadre);
  enregistrer(node,pivot,0.3*DROIT,a=>{ pivot.rotation.x=a; },v.nom);  // angle positif : le bas part vers l'extérieur (−n)
}

export function installerFenetres(root){
  root.updateMatrixWorld(true);
  for(const f of FENETRES) fenetre(root,f);
  baie(root);
  for(const v of VELUX) velux(root,v);
}
