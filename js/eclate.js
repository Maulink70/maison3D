// Vue éclatée (étape 2) : curseur « Vue éclatée » du menu « Calques » (groupe Affichage), en maquette avec « Tout » :
// l'étage s'élève au-dessus du rez (jusqu'à 3 m) pour voir les deux niveaux d'un coup d'œil. Rendu en deux passes : le rez
// (coupé à 2,38 m, sous le plancher de l'étage), puis tout l'appartement soulevé, coupé sous 2,38 m. Calques et mesures
// de l'étage suivent. Pendant l'éclaté, toucher la maquette ne sélectionne ni n'ouvre rien (remettre le curseur à 0).
import * as THREE from 'three';
import {app} from './app.js';
import {ETAGE_CUT} from './config.js';
import {etat} from './calques.js';

const bas=new THREE.Plane(new THREE.Vector3(0,-1,0),ETAGE_CUT), haut=new THREE.Plane(new THREE.Vector3(0,1,0),0);
export const eclatActif=()=>app.mode==='orbit'&&app.level==='all'&&(+etat.eclat||0)>0.01;
export const decalage=y=>eclatActif()&&y>ETAGE_CUT-0.1?+etat.eclat:0;   // hauteur ajoutée à un point de l'étage
// la caméra suit (point regardé monté de la moitié de l'écart) : le zoom (molette, pincement) se fait au milieu des
// deux niveaux et l'étage ne sort pas de l'écran ; un changement de niveau recadre tout et repart de zéro
let monte=0;
addEventListener('niveau',()=>{ monte=0; });
export function suivreEclat(){
  const voulu=eclatActif()?(+etat.eclat)/2:0, d=voulu-monte; if(Math.abs(d)<1e-4||app.mode!=='orbit') return;
  app.orbit.target.y+=d; app.camera.position.y+=d; monte=voulu;
}
export function rendreEclate(cam){
  const {renderer,scene,model}=app, d=+etat.eclat, ac=renderer.autoClear, fond=scene.background, base=renderer.clippingPlanes;
  try{
    renderer.clippingPlanes=[bas]; renderer.render(scene,cam);
    renderer.autoClear=false; scene.background=null;   // (un fond de couleur effacerait la première passe)
    model.position.y=d; haut.constant=-(ETAGE_CUT+d); renderer.clippingPlanes=[haut]; renderer.render(scene,cam);
  } finally { model.position.y=0; model.updateMatrixWorld(true); scene.background=fond; renderer.autoClear=ac; renderer.clippingPlanes=base; }
}
