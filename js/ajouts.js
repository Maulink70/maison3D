// Objets ajoutés (étape 4) : créés, reconstruits (nouvelles dimensions) et supprimés. Un objet ajouté est un élément
// comme les autres (app.items, liste, plan, alertes, fiche, lampes, annuler, synchronisation) ; sa définition (it.ajout)
// voyage dans la disposition de la variante où il a été ajouté. Nom interne : aj__<horodatage><hasard>.
import * as THREE from 'three';
import {app} from './app.js';
import {construireForme, FORMES} from './formes_simples.js';
import {appliquerEtat} from './etats.js';
import {invaliderPlan} from './plan.js';
import {select} from './edition.js';

export const nouveauNom=()=>'aj__'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const niveauDe=a=>a.v==='etage'?'Étage':'Rez';

// contenu 3D d'un objet ajouté, dans son groupe (repère propre : origine au centre du dessous)
function remplir(it,a){
  const {g,noms,taille}=construireForme(a.f,a.p);
  g.name=it.name+'__forme'; it.g.add(g); it.nomsParties=noms;
  it.mats=[]; g.traverse(o=>{ if(o.isMesh){ o.userData.item=it.name; it.mats.push(o); } });
  it.size=taille;
}
function vider(it){
  const g=it.g.getObjectByName(it.name+'__forme'); if(!g) return;
  g.traverse(o=>{ if(o.isMesh||o.isLineSegments){ o.geometry?.dispose(); for(const m of o.userData.cacheMat?.values()||[]) m.dispose(); } });
  g.removeFromParent();
}
const oublier=it=>{ it.plan=it.empreinte=it.cellules=it.planCoins=it.parties=it.partiesInfo=it.voiles=null; it.cleApparence=undefined; };

// e : état normalisé (etats.js), avec sa définition e.a
export function creerAjout(nom,e){
  const a=e.a; if(!a||!FORMES[a.f]||!app.mobilier) return null;
  const g=new THREE.Group(); g.name=nom; app.mobilier.add(g);
  const it={g,name:nom,meta:{l:a.n||FORMES[a.f].nom,c:'meuble'},lvl:niveauDe(a),hidden:false,color:null,mats:[],ajout:a,matieres:{}};
  remplir(it,a);
  g.position.set(e.x,(+a.y||0)+(+a.e||0),e.z); it.home=g.position.clone();
  app.items[nom]=it; appliquerEtat(it,e); invaliderPlan();
  return it;
}
// nouvelles dimensions, options, nom, hauteur de pose : la forme est refaite (les épaisseurs restent justes)
export function reconstruire(it,a){
  vider(it); oublier(it); it.ajout=a; it.meta={...it.meta,l:a.n||FORMES[a.f].nom}; it.lvl=niveauDe(a);
  remplir(it,a); it.g.position.y=(+a.y||0)+(+a.e||0); it.home.y=it.g.position.y;
  app.selBox?.update(); invaliderPlan();
}
export function supprimerAjout(nom){
  const it=app.items[nom]; if(!it?.ajout) return;
  if(app.selected===it) select(null);
  vider(it); it.g.removeFromParent(); delete app.items[nom]; invaliderPlan();
}
