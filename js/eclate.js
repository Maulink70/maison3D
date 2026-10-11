// Vue éclatée (étape 2) : curseur « Vue éclatée » du menu « Calques » (groupe Affichage), en maquette avec « Tout » :
// l'étage s'élève au-dessus du rez (jusqu'à 3 m) pour voir les deux niveaux d'un coup d'œil. Rendu en deux passes : le rez
// (coupé à 2,38 m, sous le plancher de l'étage), puis tout l'appartement soulevé, coupé sous 2,38 m. Calques et mesures
// de l'étage suivent. Pendant l'éclaté, toucher la maquette ne sélectionne ni n'ouvre rien (remettre le curseur à 0).
// Murs soulevés de leur dalle (11 octobre 2026, curseur « Murs soulevés », 0 à 2 m) : sols, plafonds, escalier et meubles
// restent, les murs (faces à plus de 45°, séparées comme pour les murs transparents), les portes et les fenêtres montent ;
// deux passes de plus, murs seuls, chacune avec sa coupe montée d'autant.
import * as THREE from 'three';
import {app} from './app.js';
import {ETAGE_CUT} from './config.js';
import {etat} from './calques.js';
import {partiesStructure, mursTransparents} from './transparence.js';

const bas=new THREE.Plane(new THREE.Vector3(0,-1,0),ETAGE_CUT), haut=new THREE.Plane(new THREE.Vector3(0,1,0),0);
export const eclatActif=()=>app.mode==='orbit'&&app.level==='all'&&((+etat.eclat||0)>0.01||(+etat.ecartMurs||0)>0.01);
export const decalage=y=>eclatActif()&&y>ETAGE_CUT-0.1?+etat.eclat||0:0;   // hauteur ajoutée à un point de l'étage
// la caméra suit (point regardé monté de la moitié de l'écart) : le zoom (molette, pincement) se fait au milieu des
// deux niveaux et l'étage ne sort pas de l'écran ; un changement de niveau recadre tout et repart de zéro
let monte=0;
addEventListener('niveau',()=>{ monte=0; });
export function suivreEclat(){
  const voulu=eclatActif()?((+etat.eclat||0)+(+etat.ecartMurs||0))/2:0, d=voulu-monte; if(Math.abs(d)<1e-4||app.mode!=='orbit') return;
  app.orbit.target.y+=d; app.camera.position.y+=d; monte=voulu;
}
// deux passes : le rez (sous la coupe), puis l'appartement soulevé de d et coupé sous la coupe + d ; en plus soulevé de w
function passes(cam,d,w){
  const {renderer,scene,model}=app;
  bas.constant=ETAGE_CUT+w; model.position.y=w; renderer.clippingPlanes=[bas]; renderer.render(scene,cam);
  renderer.autoClear=false; scene.background=null;   // (un fond de couleur effacerait la passe d'avant)
  model.position.y=d+w; haut.constant=-(ETAGE_CUT+d+w); renderer.clippingPlanes=[haut]; renderer.render(scene,cam);
}
const vide=new THREE.BufferGeometry();
let autres=null;   // maillages de la structure qui ne sont pas des murs (escalier, garde-corps, décor…) : restent sur la dalle
function lesAutres(parts){
  if(autres) return autres; const pris=new Set();
  for(const p of parts){ pris.add(p.o); if(p.dos) pris.add(p.dos); pris.add(p.mur); }
  autres=[]; app.model.children[0]?.traverse(o=>{ if(o.isMesh&&!pris.has(o)) autres.push(o); }); return autres;
}
export function rendreEclate(cam){
  const {renderer,scene,model}=app, d=+etat.eclat||0, w=+etat.ecartMurs||0, ac=renderer.autoClear, fond=scene.background, base=renderer.clippingPlanes;
  const vis=new Map(), cacher=(o,v=false)=>{ if(!vis.has(o)) vis.set(o,o.visible); o.visible=v; };
  const geos=[];
  try{
    if(w<0.01){ passes(cam,d,0); return; }
    const parts=partiesStructure(), transp=mursTransparents(), ouv=new Set(Object.values(app.items).filter(i=>i.meta.c==='ouverture').map(i=>i.g));
    const revet=model.children.find(o=>o.name==='revetements')?.children||[];
    const poser=(p,g)=>{ geos.push([p.o,p.o.geometry]); p.o.geometry=g; if(p.dos){ geos.push([p.dos,p.dos.geometry]); p.dos.geometry=g; } };
    // 1. la dalle : sols, plafonds, escalier, meubles (murs, portes et fenêtres cachés)
    for(const p of parts){ poser(p,p.horizontal); cacher(p.mur); }
    for(const g of ouv) cacher(g,false); for(const r of revet) if(r.name.startsWith('murs__')) cacher(r);
    passes(cam,d,0);
    // 2. les murs seuls, soulevés de w : tout le reste caché
    for(const [o,v] of vis) o.visible=v; vis.clear();
    for(const p of parts){ if(transp){ poser(p,vide); cacher(p.mur,true); } else { poser(p,p.mur.geometry); cacher(p.mur); } }
    for(const o of lesAutres(parts)) cacher(o);
    for(const o of app.mobilier?.children||[]) if(!ouv.has(o)) cacher(o);
    for(const r of revet) if(!r.name.startsWith('murs__')) cacher(r);
    for(const o of model.children) if(o!==model.children[0]&&o!==app.mobilier&&o.name!=='revetements') cacher(o);
    passes(cam,d,w);
  } finally {
    for(let k=geos.length-1;k>=0;k--) geos[k][0].geometry=geos[k][1];
    for(const [o,v] of vis) o.visible=v;
    model.position.y=0; model.updateMatrixWorld(true); scene.background=fond; renderer.autoClear=ac; renderer.clippingPlanes=base;
  }
}
