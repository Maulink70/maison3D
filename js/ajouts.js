// Objets ajoutés (étape 4) : créés, reconstruits (nouvelles dimensions) et supprimés. Un objet ajouté est un élément
// comme les autres (app.items, liste, plan, alertes, fiche, lampes, annuler, synchronisation) ; sa définition (it.ajout)
// voyage dans la disposition de la variante où il a été ajouté. Nom interne : aj__<horodatage><hasard>.
import * as THREE from 'three';
import {app} from './app.js';
import {construireForme, FORMES} from './formes_simples.js';
import {construirePhoto} from './photo.js';
import {construireGLB} from './import3d.js';
import {appliquerEtat, majApparence} from './etats.js';
import {invaliderPlan} from './plan.js';
import {select} from './edition.js';

export const nouveauNom=()=>'aj__'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const niveauDe=a=>a.v==='etage'?'Étage':'Rez';

// sortes d'objets ajoutés : forme simple, photo (livraison 2), fichier 3D (livraison 2)
const construire=a=>a.t==='photo'?construirePhoto(a):a.t==='glb'?construireGLB(a):construireForme(a.f,a.p);
export const sorteConnue=a=>!!a&&(a.t==='photo'||a.t==='glb'||!!FORMES[a.f]);
export const nomDe=a=>a.n||FORMES[a.f]?.nom||(a.t==='glb'?'Objet 3D':'Objet');
// parties de l'objet (sans les voiles des alertes ni l'éclairage d'une partie touchée, posés en enfants des maillages)
const recueillir=(it,g)=>{ it.mats=[]; g.traverse(o=>{ if(o.isMesh&&!o.userData.attente&&o.name!=='alerte'&&!o.userData.eclat){ o.userData.item=it.name; it.mats.push(o); } }); };
// contenu 3D d'un objet ajouté, dans son groupe (repère propre : origine au centre du dessous). Une photo ou un fichier
// 3D arrivent ensuite (pret) : on reprend alors les parties, l'apparence, le plan
function remplir(it,a){
  const {g,noms,taille,pret}=construire(a);
  g.name=it.name+'__forme'; it.g.add(g); it.nomsParties=noms;
  recueillir(it,g); it.size=taille;
  if(pret) pret.then(ok=>{ if(!ok||g.parent!==it.g) return; recueillir(it,g); oublier(it); it.nomsParties=g.userData.noms||it.nomsParties;
    majApparence(it,true); invaliderPlan(); app.selBox?.update(); dispatchEvent(new CustomEvent('objet-pret',{detail:{it}})); });
}
function vider(it){
  const g=it.g.getObjectByName(it.name+'__forme'); if(!g) return;
  g.traverse(o=>{ if(o.isMesh||o.isLineSegments){ o.geometry?.dispose(); for(const m of o.userData.cacheMat?.values()||[]) m.dispose(); } });
  g.removeFromParent();
}
const oublier=it=>{ it.plan=it.empreinte=it.cellules=it.planCoins=it.parties=it.partiesInfo=it.voiles=null; it.cleApparence=undefined; };

// e : état normalisé (etats.js), avec sa définition e.a
export function creerAjout(nom,e){
  const a=e.a; if(!sorteConnue(a)||!app.mobilier) return null;
  const g=new THREE.Group(); g.name=nom; app.mobilier.add(g);
  const it={g,name:nom,meta:{l:nomDe(a),c:'meuble'},lvl:niveauDe(a),hidden:false,color:null,mats:[],ajout:a,matieres:{}};
  remplir(it,a);
  g.position.set(e.x,(+a.y||0)+(+a.e||0),e.z); it.home=g.position.clone();
  app.items[nom]=it; appliquerEtat(it,e); invaliderPlan();
  return it;
}
// nouvelles dimensions, options, nom, hauteur de pose : la forme est refaite (les épaisseurs restent justes)
export function reconstruire(it,a){
  const sans=x=>JSON.stringify({...x,n:'',e:0});
  if(it.ajout&&sans(it.ajout)===sans(a)){   // seulement renommé ou posé plus haut (aimant, « Posé à ») : rien à refaire
    it.ajout=a; it.meta={...it.meta,l:nomDe(a)}; it.g.position.y=(+a.y||0)+(+a.e||0); it.home.y=it.g.position.y; app.selBox?.update(); return; }
  vider(it); oublier(it); it.ajout=a; it.meta={...it.meta,l:nomDe(a)}; it.lvl=niveauDe(a);
  remplir(it,a); it.g.position.y=(+a.y||0)+(+a.e||0); it.home.y=it.g.position.y;
  app.selBox?.update(); invaliderPlan();
}
export function supprimerAjout(nom){
  const it=app.items[nom]; if(!it?.ajout) return;
  if(app.selected===it) select(null);
  vider(it); it.g.removeFromParent(); delete app.items[nom]; invaliderPlan();
}
