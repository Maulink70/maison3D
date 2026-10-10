// Aimant (demande de Mauro du 10 octobre 2026) : un petit objet (lampe, vase, plante, écran, cadre…) lâché au-dessus
// d'une table, d'un buffet, d'une étagère se pose tout seul sur le dessus ; lâché à côté, il redescend au sol. Les sièges
// (chaise, tabouret, banquette, fauteuil) et les gros meubles ne sont pas concernés (une chaise glissée sous une table ne
// doit pas sauter dessus), ni les luminaires suspendus. Case « Aimant » du panneau (mémorisée, clé maison3d-aimant).
// Appelé quand on lâche un objet (poignée 3D, plan) ; la hauteur se règle aussi à la main (« Posé à »).
import * as THREE from 'three';
import {app} from './app.js';
import {ETAGE_FLOOR} from './config.js';
import {etatDe, normaliser, appliquerEtat} from './etats.js';

const CLE='maison3d-aimant';
try{ app.aimant=localStorage.getItem(CLE)!=='non'; }catch{ app.aimant=true; }
export function reglerAimant(oui){ app.aimant=oui; try{ localStorage.setItem(CLE,oui?'oui':'non'); }catch{} }

const siege=it=>it.ajout?.f==='chaise'||/chaise|tabouret|banquette|fauteuil|canape/i.test(it.name);
const suspendu=it=>/suspension|lustre|plafonnier|applique|spot/i.test(it.name);
export const aimantable=it=>!!it&&it.meta.c==='meuble'&&!siege(it)&&!suspendu(it)&&it.size.x<=0.8&&it.size.z<=0.8&&it.size.y<=1.3&&!['tapis'].includes(it.ajout?.f);
const sol=it=>it.lvl==='Étage'?ETAGE_FLOOR:0;
const rc=new THREE.Raycaster(), bas=new THREE.Vector3(0,-1,0);

// hauteur du dessus du meuble sous le centre de l'objet (ou le sol), visée d'en haut, sous le plafond du niveau
export function support(it){
  const s=sol(it), cibles=[];
  for(const o of Object.values(app.items)) if(o!==it&&!o.hidden&&o.meta.c==='meuble'&&!suspendu(o)&&o.g.visible) cibles.push(o.g);
  rc.set(new THREE.Vector3(it.g.position.x,s+2.3,it.g.position.z),bas); rc.far=2.3+0.05;
  const h=rc.intersectObjects(cibles,true).find(x=>x.object.name!=='alerte'&&!x.object.userData.eclat&&x.object.visible&&x.face&&x.face.normal.clone().transformDirection(x.object.matrixWorld).y>0.5);
  return h?Math.max(s,h.point.y):s;
}
// pose l'objet sur ce qui est en dessous ; renvoie vrai s'il a bougé en hauteur
export function aimanter(it){
  if(!app.aimant||!aimantable(it)) return false;
  it.g.updateMatrixWorld(true); app.model.updateMatrixWorld(true);
  const y=support(it); if(Math.abs(y-it.g.position.y)<0.003) return false;
  if(it.ajout) appliquerEtat(it,normaliser(it.name,{...etatDe(it),a:{...it.ajout,e:+Math.max(0,y-(+it.ajout.y||0)).toFixed(4)}}));
  else it.g.position.y=y;
  app.selBox?.update(); return true;
}
