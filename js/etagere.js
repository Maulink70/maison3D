// Bibliothèque le long de l'escalier (rez__armoire), reconstruite d'après la photo de Mauro :
// trois caissons posés au sol, de plus en plus hauts vers le haut de l'escalier, avec tiroirs, niches,
// portes et étagères. Le modèle SketchUp n'en avait qu'une carcasse ouverte à faces simples.
// Mesures reprises du modèle (m). Dos contre la cloison de l'escalier (x = 13,818), façade côté salon.
import * as THREE from 'three';
import {boite as poser} from './formes.js';

const DOS=13.818, FACE=14.268, T=0.016, FT=0.018, JEU=0.003;
// Chaque caisson : étendue en z, hauteur, niveaux des tablettes, façades (type, bas, haut)
const CAISSONS=[
  {z0:-18.618, z1:-17.558, h:1.19, tablettes:[0.41,0.78],
    facades:[['tiroir',0,0.205],['tiroir',0.205,0.41]]},
  {z0:-19.678, z1:-18.618, h:1.97, tablettes:[0.41,0.78,1.58],
    facades:[['tiroir',0,0.41],['portes',0.78,1.58]]},
  {z0:-20.768, z1:-19.678, h:2.36, tablettes:[0.41,0.78,1.58,1.955],
    facades:[['tiroir',0,0.205],['tiroir',0.205,0.41],['portes',0.78,1.58]]}
];

export function construireEtagere(){
  const g=new THREE.Group(); g.name='bibliotheque_escalier';
  const caisse=new THREE.MeshStandardMaterial({color:0xece7dc,roughness:0.65});
  const facade=new THREE.MeshStandardMaterial({color:0xf1ede4,roughness:0.5});
  const boite=(...a)=>poser(g,...a);
  const avant=FACE-FT;   // la carcasse s'arrête derrière les façades
  for(const c of CAISSONS){
    boite(DOS,avant,0,c.h,c.z0,c.z0+T,caisse);            // côtés
    boite(DOS,avant,0,c.h,c.z1-T,c.z1,caisse);
    boite(DOS,DOS+T,0,c.h,c.z0+T,c.z1-T,caisse);          // fond
    boite(DOS+T,avant,0,T,c.z0+T,c.z1-T,caisse);          // dessous
    boite(DOS+T,avant,c.h-T,c.h,c.z0+T,c.z1-T,caisse);    // dessus
    for(const y of c.tablettes) boite(DOS+T,avant,y,y+T,c.z0+T,c.z1-T,caisse);
    for(const [type,y0,y1] of c.facades){
      if(type==='tiroir') boite(avant,FACE,y0+JEU,y1-JEU,c.z0+JEU,c.z1-JEU,facade,true);
      else { const zm=(c.z0+c.z1)/2;
        boite(avant,FACE,y0+JEU,y1-JEU,c.z0+JEU,zm-JEU/2,facade,true);
        boite(avant,FACE,y0+JEU,y1-JEU,zm+JEU/2,c.z1-JEU,facade,true); }
    }
  }
  return g;
}
