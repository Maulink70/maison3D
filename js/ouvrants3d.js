// Portes et fenêtres faites dans Blender (base « Réalisme », 14 octobre 2026) : un objet 3D ajouté dont un nœud s'appelle
// « …__battant », « …__ouvrant », « …__ouvrant2 » ou « …__panneau_coulissant » (origine du nœud sur la charnière, comme
// dans la maquette) habille la porte ou la fenêtre de la maquette la plus proche : il en reprend toute la mécanique
// (ouverture à l'approche, au toucher, boutons « Ouvrir les portes / les fenêtres », bouton du panneau, sens et angle,
// baie coulissante), l'élément de la maquette restant masqué dans la variante. Le mouvement est celui du pivot de la
// maquette (ses réglages de js/portes.js et js/fenetres.js), rejoué sur le nœud de Blender. L'objet passe dans « Portes
// et fenêtres » (catégorie ouverture : ni alertes, ni contour de meuble sur le plan) ; ses maillages arrêtent la marche
// comme les vraies portes et fenêtres.
import * as THREE from 'three';
import {app} from './app.js';
import {centrePorte} from './portes.js';
import {invaliderPlan} from './plan.js';

const MOBILE=/__(battant|ouvrant\d*|panneau_coulissant|vantail\d*)$/i;
const poserMaquette=(p,v)=>{ if(p.poser) p.poser(v); else p.pivot.rotation.y=v; p.pivot.updateWorldMatrix(true,false); };
const M=new THREE.Matrix4(), v1=new THREE.Vector3(), v2=new THREE.Vector3();

// élément encore dans la scène (objet supprimé, ou refait avec de nouvelles dimensions : ses nœuds ont changé)
function vivant(o,it){ if(!it) return false; while(o){ if(o===it.g) return !!it.g.parent; o=o.parent; } return false; }
const itemDe=o=>{ while(o){ if(o.userData.item) return app.items[o.userData.item]; o=o.parent; } return null; };

// mouvement du pivot de la maquette (repère du monde, au repos = identité) rejoué sur le nœud de Blender
function copier(q,v){
  const p=q.source, a=p.angle;
  poserMaquette(p,v); M.copy(q.W0i).multiply(p.pivot.matrixWorld); poserMaquette(p,a);
  q.pivot.matrix.copy(q.L0).multiply(M); q.pivot.matrix.decompose(q.pivot.position,q.pivot.quaternion,q.pivot.scale);
  for(const s of q.suiveurs) s.suivre?.();
}
// ouvrant de la maquette (pas une copie) le plus proche : charnière à moins de 25 cm, sinon le battant de la maquette
// qui recouvre le plus le nœud (baie coulissante, dont le pivot n'est pas au bord du panneau)
function ouvrantProche(node){
  const o=v1.setFromMatrixPosition(node.matrixWorld), bn=new THREE.Box3().setFromObject(node);
  let best=null, d=0.25;
  for(const p of app.portes){ if(p.copie) continue; const a=p.angle; poserMaquette(p,0);
    const e=v2.setFromMatrixPosition(p.pivot.matrixWorld).distanceTo(o); poserMaquette(p,a); if(e<d){ d=e; best=p; } }
  if(best) return best;
  let iou=0.3;
  for(const p of app.portes){ if(p.copie) continue; const a=p.angle; poserMaquette(p,0);
    const bp=new THREE.Box3().setFromObject(p.pivot); poserMaquette(p,a); if(bp.isEmpty()) continue;
    const i=bp.clone().intersect(bn); if(i.isEmpty()) continue;
    const vol=b=>{ const s=b.getSize(v2); return Math.max(s.x,1e-3)*Math.max(s.y,1e-3)*Math.max(s.z,1e-3); };
    const r=vol(i)/(vol(bp)+vol(bn)-vol(i)); if(r>iou){ iou=r; best=p; } }
  return best;
}
function lier(it,node){
  it.g.updateMatrixWorld(true);
  const p=ouvrantProche(node); if(!p) return null;
  const a=p.angle; poserMaquette(p,0); const W0i=p.pivot.matrixWorld.clone().invert(); poserMaquette(p,a);
  const q={def:p.def, nom:it.name, pivot:node, feuille:null, ouvert:p.ouvert, angle:0, cible:false, manuel:false, node:it.g,
    centreLocal:it.g.worldToLocal(centrePorte(p).clone()), vitesse:p.vitesse, copie:true, source:p, L0:node.matrix.clone(), W0i, suiveurs:[]};
  q.poser=v=>copier(q,v);
  node.traverse(o=>{ if(!o.isMesh) return; o.userData.porte=q; o.userData.copie=true;
    if(!q.feuille&&!(o.material?.transparent&&o.material.opacity<0.6)) q.feuille=o; });
  if(!q.feuille) node.traverse(o=>{ if(!q.feuille&&o.isMesh) q.feuille=o; });
  node.userData.lie=q; app.portes.push(q);
  const m=app.items[p.nom]; if(m){ (m.habillePar||=new Set()).add(it.name); }
  return q;
}

// À chaque changement des meubles (objet ajouté, prêt, supprimé, variante) : copies disparues retirées, nouvelles liées
export function lierOuvrants(){
  if(!app.portes) return;
  for(let k=app.portes.length-1;k>=0;k--){ const q=app.portes[k]; if(q.copie&&!vivant(q.pivot,app.items[q.nom])) app.portes.splice(k,1); }
  const garder=m=>!m.userData.copie||vivant(m,itemDe(m));
  app.battants=app.battants.filter(garder); app.fenetres=app.fenetres.filter(garder);
  for(const m of Object.values(app.items)) if(m.habillePar) for(const n of [...m.habillePar]) if(!app.items[n]) m.habillePar.delete(n);
  let nouveau=false;
  for(const it of Object.values(app.items)){
    if(it.ajout?.t!=='glb') continue;
    const noeuds=[], chercher=o=>{ if(MOBILE.test(o.name||'')){ if(!o.userData.lie) noeuds.push(o); return; } for(const c of o.children) chercher(c); };
    chercher(it.g);
    if(!noeuds.length) continue;
    const qs=noeuds.map(n=>lier(it,n)).filter(Boolean); if(!qs.length) continue;
    it.meta={...it.meta,c:'ouverture'}; it.g.userData.portesBlender=true; nouveau=true;
    // maillages : battants des portes avec les autres battants, le reste (cadre, vitres, ouvrants des fenêtres) avec les fenêtres
    it.g.traverse(o=>{ if(!o.isMesh||o.userData.attente||o.name==='alerte') return; o.userData.copie=true;
      const q=o.userData.porte; if(q&&!q.def.fenetre){ if(!app.battants.includes(o)) app.battants.push(o); }
      else if(!app.fenetres.includes(o)) app.fenetres.push(o); });
  }
  if(nouveau){ invaliderPlan(); dispatchEvent(new CustomEvent('meubles'));   // plan (fenêtres habillées), liste (« Portes et fenêtres ») ; ici, plus rien de neuf à lier
  }
}
// porte ou fenêtre de la maquette masquée mais habillée par un objet visible (plan : on la dessine encore)
export const habillee=it=>!!it?.habillePar&&[...it.habillePar].some(n=>app.items[n]&&!app.items[n].hidden);
// ouvrants faits dans Blender d'un objet (stores intérieurs qui suivent la fenêtre)
export const ouvrantsCopies=()=>app.portes.filter(q=>q.copie);

export function initOuvrants3D(){
  addEventListener('objet-pret',()=>lierOuvrants());
  addEventListener('meubles',()=>lierOuvrants());
  addEventListener('disposition',()=>lierOuvrants());
}
